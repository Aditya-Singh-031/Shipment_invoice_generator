require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const xlsx = require('xlsx');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
// IMPORT generateTaxInvoiceWord HERE// ... existing imports ...
const { uploadToAzure } = require('./services/azureService'); // <--- Import this
const { generateDocument } = require('./services/documentService');
const { generateWordInvoice, generateTaxInvoiceWord } = require('./services/wordGenerator');
const libre = require('libreoffice-convert');
const archiver = require('archiver');

// --- 1. CONFIG & HELPER FIXES ---

const convertAsync = (buffer, format, filter) => {
    return new Promise((resolve, reject) => {
        libre.convert(buffer, format, filter, (err, done) => {
            if (err) reject(err);
            else resolve(done);
        });
    });
};

function safeParseFloat(val) {
    if (!val) return 0;
    const clean = String(val).replace(/[,₹$\s]/g, '');
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
}

function normalizeHeaderKey(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function hasValue(value) {
    return value !== undefined && value !== null && String(value).trim() !== '';
}

function toBoolean(value) {
    if (value === true || value === false) return value;
    if (value === 1 || value === '1') return true;
    if (value === 0 || value === '0') return false;
    const normalized = String(value || '').toLowerCase().trim();
    return normalized === 'true' || normalized === 'on' || normalized === 'yes';
}

function parseDateOnly(val) {
    if (!val) return new Date();
    if (val instanceof Date) return val;
    const str = String(val).trim();
    // Handle "YYYY-MM-DD" explicitly to avoid UTC shifts
    const ymdMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
    if (ymdMatch) {
        return new Date(Number(ymdMatch[1]), Number(ymdMatch[2]) - 1, Number(ymdMatch[3]));
    }
    const d = new Date(str);
    return isNaN(d.getTime()) ? new Date() : d;
}

function sanitizeFilename(name) {
    if (!name) return 'document';
    return String(name).trim().replace(/[\n\r]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_');
}

// --- 2. MODELS ---
const Buyer = require('./models/Buyer');
const Shipment = require('./models/Shipment');
const ShipmentDetail = require('./models/Shipment_detail');

const UserSchema = new mongoose.Schema({
    name: String, email: { type: String, unique: true }, username: { type: String, unique: true },
    role: String, status: String, hashed_password: String, created_at: { type: Date, default: Date.now }, last_login: Date
});
const User = mongoose.model('User', UserSchema, 'users');

const app = express();
const upload = multer({ dest: 'uploads/' });
const JWT_SECRET = process.env.JWT_SECRET || "morsebiz_secret_key_123";

app.use(cors({
    origin: true,
    credentials: true,
    exposedHeaders: ['Content-Disposition', 'X-Output-Format']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

mongoose.set('bufferCommands', false);
const redactedUri = (process.env.MONGO_URI || '').replace(/:([^@]+)@/, ':****@');
console.log('Connecting to:', redactedUri);

mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000, connectTimeoutMS: 8000 })
    .then(() => {
        console.log('MongoDB connected');
        const PORT = process.env.PORT || 3006;
        app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
    })
    .catch((err) => {
        console.error('DB connect failed:', err);
        process.exit(1);
    });

// --- 4. AUTH ---
app.post('/api/v1/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ $or: [{ email: email }, { username: email }] });
        if (!user || !(await bcrypt.compare(password, user.hashed_password))) return res.status(400).json({ error: "Invalid credentials" });
        const token = jwt.sign({ id: user._id, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '1d' });
        user.last_login = new Date(); await user.save();
        res.json({ token, user: { id: user._id, name: user.name, username: user.username, email: user.email, role: user.role } });
    } catch (err) { res.status(500).json({ error: "Login Error" }); }
});

app.get('/api/v1/auth/me', async (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.id).select('-hashed_password');
        res.json(user || {});
    } catch (err) { return res.status(403).json({ error: 'Invalid token' }); }
});

// --- 5. DATA ROUTES ---
app.get('/api/companies', async (req, res) => {
    const buyers = await Buyer.find({}).sort({ name: 1 }).lean();
    res.json(buyers);
});
app.post('/api/companies', async (req, res) => {
    try { const buyer = await Buyer.create(req.body); res.json({ success: true, id: buyer._id, name: buyer.name }); }
    catch (err) { res.status(500).json({ error: 'Create failed' }); }
});

// --- UPDATED EXCEL UPLOAD LOGIC ---
app.post('/api/upload-excel', upload.single('excelFile'), (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file' });
        const workbook = xlsx.readFile(req.file.path);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        // Detect header row (many files have title rows before headers)
        const rowsAsArrays = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        const headerKeywords = [
            'HSN', 'HSN CODE',
            'DESCRIPTION', 'DESCRIPTION OF GOODS', 'DESC',
            'QTY', 'QUANTITY',
            'RATE', 'PRICE', 'WITH FOB RATE',
            'PART NO', 'PART NUMBER',
            'REF NO', 'REFERENCE',
        ];
        const normalize = (v) => String(v || '').trim().toUpperCase();
        let headerRowIdx = -1;
        let bestScore = 0;

        rowsAsArrays.forEach((row, idx) => {
            const cells = row.map(normalize);
            if (cells.length === 0) return;
            let score = 0;
            headerKeywords.forEach(k => {
                if (cells.some(c => c === k || c.includes(k))) score += 1;
            });
            if (score > bestScore) {
                bestScore = score;
                headerRowIdx = idx;
            }
        });

        // Use detected header row if it looks valid, otherwise fall back to first row
        if (headerRowIdx < 0 || bestScore < 2) headerRowIdx = 0;

        const rawRows = xlsx.utils.sheet_to_json(sheet, { defval: '', range: headerRowIdx });

        let currencyLabel = 'USD';
        const headers = Object.keys(rawRows[0] || {});
        const headerText = headers.join(' ').toUpperCase();
        if (headerText.includes('INR') || headerText.includes('₹') || headerText.includes('RS') || headerText.includes('RUPEE')) {
            currencyLabel = 'INR';
        } else if (headerText.includes('USD') || headerText.includes('$')) {
            currencyLabel = 'USD';
        }

        // Check for a currency column or symbols in values
        if (!currencyLabel || currencyLabel === 'USD') {
            const sampleRows = rawRows.slice(0, 20);
            for (const row of sampleRows) {
                const normalizedRow = {};
                Object.keys(row || {}).forEach(k => { normalizedRow[normalizeHeaderKey(k)] = row[k]; });
                const currencyValue = normalizedRow.currency || normalizedRow.curr || '';
                const combinedValues = Object.values(row || {}).join(' ').toUpperCase();
                const currencySource = String(currencyValue || combinedValues);

                if (currencySource.includes('INR') || currencySource.includes('₹') || currencySource.includes('RS') || currencySource.includes('RUPEE')) {
                    currencyLabel = 'INR';
                    break;
                }
                if (currencySource.includes('USD') || currencySource.includes('$')) {
                    currencyLabel = 'USD';
                    break;
                }
            }
        }

        const items = rawRows.map(row => {
            const normalizedRow = {};
            Object.keys(row || {}).forEach(k => { normalizedRow[normalizeHeaderKey(k)] = row[k]; });

            const getValue = (...keys) => {
                for (const key of keys) {
                    const val = normalizedRow[normalizeHeaderKey(key)];
                    if (hasValue(val)) return val;
                }
                return '';
            };

            const desc = getValue('Description', 'Description of Goods', 'DESC');
            const qty = safeParseFloat(getValue('Qty', 'Quantity', 'QTY'));

            // PRIORITY: 'WITH FOB RATE' (from your input file) -> then 'Rate' -> then 'Price'
            const rate = safeParseFloat(getValue('WITH FOB RATE', 'Rate', 'Price', 'RATE'));

            return {
                description: desc,
                hsn: getValue('HSN', 'HSN Code'),
                qty: qty,
                rate: rate,
                amount: safeParseFloat(getValue('TOTAL', 'Amount', 'Total Amount')) || (qty * rate),
                partNo: getValue('Part number', 'Part No'),
                refNo: getValue('Order reference number', 'Ref No', 'Reference', 'Reference No'),

                // NEW FIELDS FOR TAX INVOICE
                unit: getValue('Unit', 'UOM', 'Unit of Measure') || 'NOS',
                igst: getValue('IGST Rate', 'IGST%', 'IGST', 'GST Rate', 'Tax Rate') || '0'
            };
        }).filter(i => i.description || i.qty > 0);

        res.json({ items, currencyLabel });
        fs.unlink(req.file.path, () => { });
    } catch (err) { res.status(500).json({ error: 'Excel failed' }); }
});

app.get('/api/download-sample', (req, res) => {
    const filePath = path.join(__dirname, 'Sample.xlsx');
    if (fs.existsSync(filePath)) res.download(filePath, 'Import_Template.xlsx');
    else res.status(404).send("No sample file");
});

// --- 6. SHIPMENT ROUTES ---

// List with Filter & Sort
app.get('/api/shipments', async (req, res) => {
    try {
        const query = {};

        // Date Filter
        if (req.query.dateFrom || req.query.dateTo) {
            query.invoice_date = {};
            if (req.query.dateFrom) query.invoice_date.$gte = parseDateOnly(req.query.dateFrom);
            if (req.query.dateTo) {
                const to = parseDateOnly(req.query.dateTo);
                to.setHours(23, 59, 59, 999);
                query.invoice_date.$lte = to;
            }
        }

        // Sorting Setup
        let sortObj = { created_at: -1 };
        const sortBy = req.query.sortBy;
        const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

        if (sortBy === 'date' || sortBy === 'invoice_date') sortObj = { invoice_date: sortOrder };
        else if (sortBy === 'created_at') sortObj = { created_at: sortOrder };
        else if (sortBy === 'invoice_number') sortObj = { invoice_number: sortOrder };

        let shipments = await Shipment.find(query)
            .sort(sortObj)
            .limit(100)
            .populate('buyer_id', 'name')
            .lean();

        // Populate Quantity for Sorting/Display
        const shipmentIds = shipments.map(s => s._id);
        const quantityMap = await ShipmentDetail.aggregate([
            { $match: { shipment_id: { $in: shipmentIds } } },
            { $group: { _id: '$shipment_id', totalQty: { $sum: '$quantity' } } }
        ]);

        const qtyLookup = {};
        quantityMap.forEach(q => qtyLookup[q._id.toString()] = q.totalQty);

        shipments.forEach(s => {
            s.totalQuantity = qtyLookup[s._id.toString()] || s.package_count || 0;
        });

        // Handle Manual Sort by Quantity
        if (sortBy === 'quantity') {
            shipments.sort((a, b) => (a.totalQuantity - b.totalQuantity) * sortOrder);
        }

        // Filter Quantity
        if (req.query.quantityMin || req.query.quantityMax) {
            const min = parseFloat(req.query.quantityMin) || 0;
            const max = parseFloat(req.query.quantityMax) || Infinity;
            shipments = shipments.filter(s => s.totalQuantity >= min && s.totalQuantity <= max);
        }

        res.json(shipments);
    } catch (err) {
        console.error("List Error:", err);
        res.status(500).json({ error: "Fetch failed" });
    }
});

app.get('/api/shipments/:id', async (req, res) => {
    const shipment = await Shipment.findById(req.params.id).populate('buyer_id').populate('consignee_id').lean();
    if (!shipment) return res.status(404).json({ error: "Not Found" });
    const details = await ShipmentDetail.find({ shipment_id: req.params.id }).lean();
    res.json({ shipment, details });
});

app.post('/api/shipments/save', async (req, res) => {
    try {
        const body = req.body;
        const shipmentId = body._id;
        const rawInvoiceDate = parseDateOnly(body.invoiceDate);

        const shipmentData = {
            invoice_number: body.invoiceNumber,
            invoice_date: rawInvoiceDate,
            buyer_id: body.buyer?._id || body.buyer,
            consignee_id: body.consignee?._id || body.consignee,
            cha_details: body.chaAgent || '',
            dispatch_location: body.dispatchLocation,
            pre_carriage: body.preCarriageBy,
            receipt_place: body.placeOfReceipt,
            loading_port: body.portOfLoading,
            discharge_port: body.portOfDischarge,
            delivery_terms: body.termsOfDelivery,
            payment_terms: body.termsOfPayment,
            package_count: safeParseFloat(body.numberOfPackages),
            net_weight_kg: safeParseFloat(body.totalNetWeight),
            gross_weight_kg: safeParseFloat(body.totalGrossWeight),
            freight_cost: safeParseFloat(body.freightCharges),
            insurance_cost: safeParseFloat(body.insuranceCharges),
            is_freight_in_split: toBoolean(body.splitFobFreight),
            currency: body.currencyLabel || 'USD',
            status: body.status || 'Draft'
        };

        let savedShipment;
        if (shipmentId) {
            savedShipment = await Shipment.findByIdAndUpdate(shipmentId, shipmentData, { new: true });
            await ShipmentDetail.deleteMany({ shipment_id: shipmentId });
        } else {
            savedShipment = await Shipment.create(shipmentData);
        }

        if (body.lineItems?.length > 0) {
            const lineItemDocs = body.lineItems.map(item => ({
                shipment_id: savedShipment._id,
                reference_number: item.refNo || '',
                part_number: item.partNo || '',
                description: item.description || '',
                hsn_code: item.hsn || '',
                quantity: safeParseFloat(item.qty),
                unit_price: safeParseFloat(item.rate),
            }));
            await ShipmentDetail.insertMany(lineItemDocs);
        }
        res.json({ success: true, shipmentId: savedShipment._id });
    } catch (err) { console.error(err); res.status(500).json({ error: "Save failed" }); }
});

// --- 7. GENERATION ROUTES ---

// Excel
app.post('/api/generate/working-excel', (req, res) => {
    try {
        const body = req.body;
        const lineItems = body.lineItems || [];
        const splitFobFreight = toBoolean(body.splitFobFreight);

        const freightVal = safeParseFloat(body.freightCharges);
        const insuranceVal = safeParseFloat(body.insuranceCharges);
        let baseTotal = 0;
        lineItems.forEach(item => { baseTotal += (safeParseFloat(item.qty) * safeParseFloat(item.rate)); });
        const splitExtraVal = freightVal + insuranceVal;

        const excelRows = lineItems.map((item, idx) => {
            const qty = safeParseFloat(item.qty);
            const rate = safeParseFloat(item.rate);
            const amount = qty * rate;
            let splitRate = rate;
            let splitAmount = amount;

            if (splitFobFreight && baseTotal > 0 && splitExtraVal > 0) {
                const freightShare = (amount / baseTotal) * splitExtraVal;
                splitAmount = amount + freightShare;
                if (qty > 0) splitRate = splitAmount / qty;
            }

            return {
                "Sr No": idx + 1, "Ref No": item.refNo, "Part No": item.partNo, "Description": item.description,
                "HSN": item.hsn, "Qty": qty, "Base Rate": rate, "Base Amount": amount,
                "Split Rate": splitRate.toFixed(2), "Split Total": splitAmount.toFixed(2)
            };
        });

        const grandTotal = baseTotal + freightVal + insuranceVal;
        excelRows.push({},
            { "Description": "SUBTOTAL", "Split Total": baseTotal.toFixed(2) },
            { "Description": "FREIGHT", "Split Total": freightVal.toFixed(2) },
            { "Description": "INSURANCE", "Split Total": insuranceVal.toFixed(2) },
            { "Description": "GRAND TOTAL", "Split Total": grandTotal.toFixed(2) }
        );

        const wb = xlsx.utils.book_new();
        const ws = xlsx.utils.json_to_sheet(excelRows);
        ws['!cols'] = [{ wch: 5 }, { wch: 15 }, { wch: 15 }, { wch: 30 }, { wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
        xlsx.utils.book_append_sheet(wb, ws, "Working File");

        const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="Working_File_${sanitizeFilename(body.invoiceNumber)}.xlsx"`);
        res.send(buffer);
    } catch (err) { res.status(500).json({ error: "Excel Gen Failed" }); }
});

// PDF & Letters & Tax Invoice
app.post('/api/generate/invoice', async (req, res) => {
    try {
        const body = req.body;
        const downloadVariant = body.downloadVariant || 'commercial_invoice';
        const safeInvoiceNo = sanitizeFilename(body.invoiceNumber);

        const CONSTANT_EXPORTER = {
            name: "Morsebiz Technology Services Pvt Ltd",
            address: "20th Floor, Building No/Flat No – CTS No 95 4 B 3&4, 590 Oberoi Garden City, Goregaon East, Mumbai, Mumbai Suburban, Maharashtra 400063",
            gstNo: "27AAGCM1373N1ZI", panNo: "", iecCode: ""
        };
        const rawInvoiceDate = parseDateOnly(body.invoiceDate);
        const calculatedExpiryDate = new Date(rawInvoiceDate);
        calculatedExpiryDate.setDate(rawInvoiceDate.getDate() + 90);

        let buffer;
        let filename;

        // --- 1. TAX INVOICE (NEW) ---
        if (downloadVariant === 'tax_invoice') {
            const exchangeRate = body.exchangeRate || 86.50; // Use provided rate or default

            // Map items passing through all raw data including Unit and IGST
            const processedItems = body.lineItems.map(item => ({
                ...item,
                qty: safeParseFloat(item.qty),
                rate: safeParseFloat(item.rate)
            }));

            buffer = await generateTaxInvoiceWord(
                {
                    exporter: CONSTANT_EXPORTER,
                    buyer: body.buyer,
                    consignee: body.consigneeSameAsBuyer ? body.buyer : body.consignee,
                    invoiceNumber: body.invoiceNumber,
                    invoiceDate: rawInvoiceDate,
                    invoiceExpiryDate: calculatedExpiryDate,
                    termsOfPayment: body.termsOfPayment,
                    dispatchLocation: body.dispatchLocation,
                    preCarriageBy: body.preCarriageBy,
                    placeOfReceipt: body.placeOfReceipt,
                    portOfLoading: body.portOfLoading,
                    portOfDischarge: body.portOfDischarge,
                    termsOfDelivery: body.termsOfDelivery,
                    numberOfPackages: body.numberOfPackages,
                    totalNetWeight: body.totalNetWeight,
                    totalGrossWeight: body.totalGrossWeight,
                    freightCharges: safeParseFloat(body.freightCharges),
                    insuranceCharges: safeParseFloat(body.insuranceCharges)
                },
                processedItems,
                exchangeRate
            );
            filename = `Tax_Invoice_${safeInvoiceNo}.pdf`;

            // --- 2. LETTERS ---
        } else if (['cha_letter', 'evd_letter', 'non_vintage_letter', 'scomet_letter'].includes(downloadVariant)) {
            const chaName = body.chaAgent || '';
            const formattedDate = rawInvoiceDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
            const context = {
                CHA_NAME: chaName, INVOICE_NO: body.invoiceNumber, DATE: formattedDate, INVOICE_DATE: formattedDate,
                cha_name: chaName, invoice_no: body.invoiceNumber, date: formattedDate, invoice_date: formattedDate
            };
            const templateMap = {
                cha_letter: 'CHA letter.docx',
                evd_letter: 'EVD_letter.docx',
                non_vintage_letter: 'non_vintage.docx',
                scomet_letter: 'scomet_declaration.docx',
            };
            // Fallback for SCOMET
            if (!fs.existsSync(path.join(__dirname, 'word docs', templateMap.scomet_letter))) {
                if (fs.existsSync(path.join(__dirname, 'word docs', 'scomet declaratio.docx'))) {
                    templateMap.scomet_letter = 'scomet declaratio.docx';
                }
            }
            buffer = await generateDocument(templateMap[downloadVariant], context, 'pdf');
            filename = `${downloadVariant}_${safeInvoiceNo}.pdf`;

            // --- 3. COMMERCIAL INVOICE ---
        } else {
            const processedItems = body.lineItems.map((item, idx) => ({
                description: item.description, hsn: item.hsn, qty: safeParseFloat(item.qty), rate: safeParseFloat(item.rate),
                amount: safeParseFloat(item.amount), partNo: item.partNo, refNo: item.refNo, idx: idx
            }));
            const splitFobFreight = toBoolean(body.splitFobFreight) || body.downloadVariant === 'split';
            const invoiceData = {
                exporter: CONSTANT_EXPORTER, buyer: body.buyer, consignee: body.consigneeSameAsBuyer ? body.buyer : body.consignee,
                chaAgent: { name: body.chaAgent || '' }, invoiceNumber: body.invoiceNumber, invoiceDate: rawInvoiceDate,
                invoiceExpiryDate: calculatedExpiryDate, termsOfPayment: body.termsOfPayment, dispatchLocation: body.dispatchLocation,
                preCarriageBy: body.preCarriageBy, placeOfReceipt: body.placeOfReceipt, portOfLoading: body.portOfLoading,
                portOfDischarge: body.portOfDischarge, termsOfDelivery: body.termsOfDelivery, numberOfPackages: body.numberOfPackages,
                totalNetWeight: body.totalNetWeight, totalGrossWeight: body.totalGrossWeight,
                freightCharges: safeParseFloat(body.freightCharges), insuranceCharges: safeParseFloat(body.insuranceCharges),
                splitFobFreight
            };
            buffer = await generateWordInvoice(invoiceData, processedItems, body.currencyLabel || 'USD');
            const typeLabel = invoiceData.splitFobFreight ? 'Split' : 'Commercial';
            filename = `${typeLabel}_Invoice_${safeInvoiceNo}.pdf`;
        }

        const outputFormat = body.outputFormat || 'pdf';

        if (outputFormat === 'docx') {
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
            res.setHeader('Content-Disposition', `attachment; filename="${filename.replace('.pdf', '.docx')}"`);
            res.send(buffer);
        } else {
            try {
                const pdfBuffer = await convertAsync(buffer, '.pdf', undefined);
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
                res.send(pdfBuffer);
            } catch (err) {
                console.error('PDF conversion failed. Falling back to DOCX:', err.message);
                // Fallback to DOCX if LibreOffice is not available on the server
                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
                res.setHeader('Content-Disposition', `attachment; filename="${filename.replace('.pdf', '.docx')}"`);
                res.setHeader('X-Output-Format', 'docx');
                res.send(buffer);
            }
        }

    } catch (error) { res.status(500).json({ error: error.message }); }
});

// Download All Letters (ZIP)
app.post('/api/generate/all-letters', async (req, res) => {
    try {
        const body = req.body;
        const safeInvoiceNo = sanitizeFilename(body.invoiceNumber);

        const rawInvoiceDate = parseDateOnly(body.invoiceDate);
        const formattedDate = rawInvoiceDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
        const context = {
            CHA_NAME: body.chaAgent || '', INVOICE_NO: body.invoiceNumber, DATE: formattedDate, INVOICE_DATE: formattedDate,
            cha_name: body.chaAgent || '', invoice_no: body.invoiceNumber, date: formattedDate, invoice_date: formattedDate
        };

        const letterTypes = [
            { key: 'cha_letter', template: 'CHA letter.docx', filename: 'CHA_Letter' },
            { key: 'evd_letter', template: 'EVD_letter.docx', filename: 'EVD_Letter' },
            { key: 'non_vintage_letter', template: 'non_vintage.docx', filename: 'Non_Vintage' },
            { key: 'scomet_letter', template: 'scomet_declaration.docx', filename: 'SCOMET_Declaration' }
        ];

        const scometPath = path.join(__dirname, 'word docs', 'scomet declaratio.docx');
        if (!fs.existsSync(scometPath)) letterTypes[3].template = 'scomet_declaration.docx';

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="All_Letters_${safeInvoiceNo}.zip"`);

        const archive = archiver('zip', { zlib: { level: 9 } });
        archive.pipe(res);

        for (const letter of letterTypes) {
            try {
                const buffer = await generateDocument(letter.template, context, 'pdf');
                try {
                    const pdfBuffer = await convertAsync(buffer, '.pdf', undefined);
                    archive.append(pdfBuffer, { name: `${letter.filename}_${safeInvoiceNo}.pdf` });
                } catch (err) {
                    console.error(`PDF conversion failed for ${letter.key}. Using DOCX:`, err.message);
                    archive.append(buffer, { name: `${letter.filename}_${safeInvoiceNo}.docx` });
                }
            } catch (err) { console.error(`Error generating ${letter.key}:`, err.message); }
        }
        archive.finalize();
    } catch (error) { res.status(500).json({ error: 'Zip Generation Failed' }); }
});

// --- NEW ROUTE: Upload Image to Azure ---
app.post('/api/upload-image', upload.single('imageFile'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No image uploaded' });

        console.log(`Uploading ${req.file.originalname} to Azure...`);

        // 1. Upload to Azure
        const azureUrl = await uploadToAzure(
            req.file.path,
            req.file.originalname,
            req.file.mimetype
        );

        // 2. Clean up local file (Multer saves it to /uploads first)
        fs.unlink(req.file.path, (err) => {
            if (err) console.error("Failed to delete local temp file:", err);
        });

        // 3. Respond with URL
        res.json({
            success: true,
            url: azureUrl,
            message: "Image uploaded successfully to Azure"
        });

    } catch (error) {
        console.error("Azure Upload Error:", error);
        res.status(500).json({ error: "Upload failed: " + error.message });
    }
});
// --- OPS MODULE ---
app.use('/api/v1/ops', require('./modules/ops'));

// --- 7. STARTUP REMOVED HERE (Now inside mongoose.connect) ---
