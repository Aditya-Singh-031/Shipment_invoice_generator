const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, VerticalAlign, BorderStyle, ShadingType,
  Header, Footer, TableLayoutType, ImageRun, PageOrientation
} = require('docx');
const fs = require('fs');
const path = require('path');

// --- HELPER FUNCTIONS ---

function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  return `${d.getDate()}-${d.toLocaleString('en-US', { month: 'short' })}-${d.getFullYear()}`;
}

const DEFAULT_BORDERS = {
  top: { style: BorderStyle.SINGLE, size: 2, color: "000000" },
  bottom: { style: BorderStyle.SINGLE, size: 2, color: "000000" },
  left: { style: BorderStyle.SINGLE, size: 2, color: "000000" },
  right: { style: BorderStyle.SINGLE, size: 2, color: "000000" },
};

// Helper to create a standard cell with borders
function cell(
  text,
  align = AlignmentType.CENTER,
  span = 1,
  bold = false,
  fontSize = 14,
  shading = null,
  color = "000000",
  width = null
) {
  const cellProps = {
    children: [
      new Paragraph({
        alignment: align,
        spacing: { before: 0, after: 0 },
        children: [new TextRun({ text: safeText(text, '-'), size: fontSize, bold, color })]
      })
    ],
    columnSpan: span,
    verticalAlign: VerticalAlign.CENTER,
    borders: DEFAULT_BORDERS
  };

  if (width) {
    cellProps.width = { size: width, type: WidthType.DXA };
  }

  if (shading) {
    cellProps.shading = { fill: shading, type: ShadingType.SOLID };
  }

  return new TableCell(cellProps);
}

function safeText(value, fallback = '-') {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value);
}

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function optionalLabelValueParagraphs(pairs, options) {
  return pairs
    .filter((pair) => hasValue(pair.value))
    .map((pair) => labelValueParagraph(`${pair.label}: `, pair.value, options));
}

function pickCompanyField(company, keys) {
  if (!company) return '';
  for (const key of keys) {
    if (company[key]) return company[key];
  }
  return '';
}

function formatDateDisplay(date) {
  if (!date) return '-';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDeliveryTerms(value) {
  const deliveryTermsMap = {
    FOB: 'FOB (Free on Board)',
    EXW: 'EXW (Ex Works)',
    CFR: 'CFR (Cost and Freight)',
    CIF: 'CIF (Cost, Insurance & Freight)'
  };
  if (!value) return '-';
  return deliveryTermsMap[value] || value;
}

function getDispatchAddress(invoiceData) {
  const dispatchMap = {
    MUMBAI: "Ground Floor, Godown No. 25/B, Survey No.25/B, 26/1A1, 26/1A2, 25/1A & 26/1B, BLR Logistiks (I) Limited C/O M/S Forefront Logistics Pvt Ltd, Post Mothi Jui Uran, Taki Gaon Bus Stop, Dighode Chirner Road, Bhom, Raigad, Maharashtra 410206",
    SOLAPUR: "A/21/1, MIDC Chincholi, Solapur, Maharashtra - 413255"
  };
  const dispatchKey = String(invoiceData?.dispatchLocation || '').trim().toUpperCase();
  return safeText(
    invoiceData?.dispatchAddress || dispatchMap[dispatchKey] || invoiceData?.dispatchLocation,
    '-'
  );
}

function currencySymbol(label) {
  if (!label) return '';
  const normalized = String(label).toUpperCase();
  if (normalized.includes('₹') || normalized === 'INR') return '₹';
  if (normalized.includes('$') || normalized === 'USD') return '$';
  if (normalized === 'EUR') return '€';
  if (normalized === 'GBP') return '£';
  return '';
}

function formatMoney(value, currencyLabel) {
  const num = Number(value);
  const amount = Number.isFinite(num) ? num : 0;
  const formatted = amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const symbol = currencySymbol(currencyLabel);
  return symbol ? `${symbol}${formatted}` : formatted;
}

function makeParagraph(text, { bold = false, size = 20, align = AlignmentType.LEFT, color = "000000" } = {}) {
  return new Paragraph({
    alignment: align,
    spacing: { before: 0, after: 0 },
    children: [new TextRun({ text: String(text || ''), bold, size, color })]
  });
}

function labelValueParagraph(label, value, { labelSize = 20, valueSize = 18 } = {}) {
  return new Paragraph({
    spacing: { before: 0, after: 0 },
    children: [
      new TextRun({ text: String(label || ''), bold: true, size: labelSize }),
      new TextRun({ text: safeText(value, '-'), size: valueSize })
    ]
  });
}

function labelValueRow(label, value, { labelSize = 20, valueSize = 20 } = {}) {
  return new TableRow({
    children: [
      new TableCell({
        children: [makeParagraph(label, { bold: true, size: labelSize })],
        width: { size: 2000, type: WidthType.DXA },
        verticalAlign: VerticalAlign.TOP,
        borders: DEFAULT_BORDERS
      }),
      new TableCell({
        children: [makeParagraph(safeText(value, '-'), { size: valueSize })],
        width: { size: 3000, type: WidthType.DXA },
        verticalAlign: VerticalAlign.TOP,
        borders: DEFAULT_BORDERS
      })
    ]
  });
}

// Helper to get image buffer safely
function getImageBuffer() {
  // Looks for image.png in the root or services folder
  const paths = [
      path.join(__dirname, '..', 'image.png'),
      path.join(__dirname, 'image.png')
  ];
  
  for (const p of paths) {
      if (fs.existsSync(p)) return fs.readFileSync(p);
  }
  return null;
}

// =========================================================================
// 1. COMMERCIAL INVOICE GENERATOR (Standard)
// =========================================================================
async function generateWordInvoice(invoiceData, lineItems, currencyLabel = 'USD') {
  
  // --- Header ---
  const headerChildren = [];
  const imgBuffer = getImageBuffer();
  if (imgBuffer) {
      headerChildren.push(new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new ImageRun({ data: imgBuffer, transformation: { width: 173, height: 60 } })]
      }));
  }
  const header = new Header({ children: headerChildren });

  // --- Footer ---
  const footer = new Footer({
      children: [
          new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: 'Morsebiz Technology Services Pvt Ltd', bold: true, size: 16 })]
          }),
          new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: 'Regd. Office: 20th Floor, Oberoi Garden City, Mumbai 400063', size: 14 })]
          }),
      ]
  });

  const sectionChildren = [];

  // Title
  sectionChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 200 },
      children: [new TextRun({ text: 'COMMERCIAL INVOICE', bold: true, size: 24, underline: {} })]
    })
  );

  const exporter = invoiceData.exporter || {};
  const buyer = invoiceData.buyer || {};
  const consignee = invoiceData.consignee || {};

  const exporterGst = pickCompanyField(exporter, ['gstNo', 'gst_number', 'gstNumber', 'gstin', 'gstIn', 'gst']);
  const exporterPan = pickCompanyField(exporter, ['panNo', 'pan_no', 'panNumber', 'pan']);
  const exporterIec = pickCompanyField(exporter, ['iecCode', 'iec_code', 'iec']);

  const buyerGst = pickCompanyField(buyer, ['gstNo', 'gst_number', 'gstNumber', 'gstin', 'gstIn', 'gst']);
  const buyerPan = pickCompanyField(buyer, ['panNo', 'pan_no', 'panNumber', 'pan']);
  const buyerIec = pickCompanyField(buyer, ['iecCode', 'iec_code', 'iec']);

  const consigneeGst = pickCompanyField(consignee, ['gstNo', 'gst_number', 'gstNumber', 'gstin', 'gstIn', 'gst']);
  const consigneePan = pickCompanyField(consignee, ['panNo', 'pan_no', 'panNumber', 'pan']);
  const consigneeIec = pickCompanyField(consignee, ['iecCode', 'iec_code', 'iec']);

  const dispatchFrom = getDispatchAddress(invoiceData);

  const exporterIdRows = optionalLabelValueParagraphs(
    [
      { label: 'GST', value: exporterGst },
      { label: 'PAN', value: exporterPan },
      { label: 'IEC', value: exporterIec }
    ],
    { labelSize: 18, valueSize: 18 }
  );

  const buyerIdRows = optionalLabelValueParagraphs(
    [
      { label: 'GST', value: buyerGst },
      { label: 'PAN', value: buyerPan },
      { label: 'IEC', value: buyerIec }
    ],
    { labelSize: 18, valueSize: 18 }
  );

  const consigneeIdRows = optionalLabelValueParagraphs(
    [
      { label: 'GST', value: consigneeGst },
      { label: 'PAN', value: consigneePan },
      { label: 'IEC', value: consigneeIec }
    ],
    { labelSize: 18, valueSize: 18 }
  );

  const exporterInfoCell = new TableCell({
    children: [
      makeParagraph('Exporter / Shipper', { bold: true, size: 22 }),
      makeParagraph(safeText(exporter.name, ''), { bold: true, size: 20 }),
      ...(exporter.address ? [makeParagraph(exporter.address, { size: 18 })] : []),
      ...exporterIdRows
    ],
    verticalAlign: VerticalAlign.TOP,
    borders: DEFAULT_BORDERS
  });

  const dispatchCell = new TableCell({
    children: [labelValueParagraph('Dispatch From: ', dispatchFrom, { labelSize: 20, valueSize: 18 })],
    verticalAlign: VerticalAlign.TOP,
    borders: DEFAULT_BORDERS
  });

  const exporterTable = new Table({
    rows: [
      new TableRow({ children: [exporterInfoCell] }),
      new TableRow({ children: [dispatchCell] })
    ],
    width: { size: 5040, type: WidthType.DXA }
  });

  const invoiceInfoTable = new Table({
    rows: [
      labelValueRow('Invoice No.:', invoiceData.invoiceNumber),
      labelValueRow('Invoice Date:', formatDateDisplay(invoiceData.invoiceDate)),
      labelValueRow('Expiry Date:', formatDateDisplay(invoiceData.invoiceExpiryDate)),
      labelValueRow('Terms of Payment:', invoiceData.termsOfPayment || '-'),
      labelValueRow('Terms of Delivery:', formatDeliveryTerms(invoiceData.termsOfDelivery))
    ],
    width: { size: 5000, type: WidthType.DXA }
  });

  const shippingTable = new Table({
    rows: [
      labelValueRow('Pre-Carriage By:', invoiceData.preCarriageBy || '-'),
      labelValueRow('Place of Receipt:', invoiceData.placeOfReceipt || '-'),
      labelValueRow('Port of Loading:', invoiceData.portOfLoading || '-'),
      labelValueRow('Port of Discharge:', invoiceData.portOfDischarge || '-'),
      labelValueRow('Total Net Weight:', invoiceData.totalNetWeight ? `${invoiceData.totalNetWeight} KGS` : '-'),
      labelValueRow('Total Gross Weight:', invoiceData.totalGrossWeight ? `${invoiceData.totalGrossWeight} KGS` : '-'),
      labelValueRow('Total Packages:', invoiceData.numberOfPackages || '-')
    ],
    width: { size: 5000, type: WidthType.DXA }
  });

  const rightCellChildren = [
    invoiceInfoTable,
    new Paragraph({ text: '' }),
    makeParagraph('Shipping & Logistics', { bold: true, size: 22 }),
    shippingTable
  ];

  const topTable = new Table({
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [exporterTable],
            width: { size: 5040, type: WidthType.DXA },
            verticalAlign: VerticalAlign.TOP,
            borders: DEFAULT_BORDERS
          }),
          new TableCell({
            children: rightCellChildren,
            width: { size: 5040, type: WidthType.DXA },
            verticalAlign: VerticalAlign.TOP,
            borders: DEFAULT_BORDERS
          })
        ]
      })
    ],
    width: { size: 10080, type: WidthType.DXA }
  });

  sectionChildren.push(topTable);
  sectionChildren.push(new Paragraph({ text: '' }));

  const consigneeCellChildren = [
    makeParagraph('Consignee', { bold: true, size: 22 }),
    makeParagraph(safeText(consignee.name, ''), { bold: true, size: 20 }),
    ...(consignee.address ? [makeParagraph(consignee.address, { size: 18 })] : []),
    ...consigneeIdRows
  ];

  const buyerCellChildren = [
    makeParagraph('Buyer', { bold: true, size: 22 }),
    makeParagraph(safeText(buyer.name, ''), { bold: true, size: 20 }),
    ...(buyer.address ? [makeParagraph(buyer.address, { size: 18 })] : []),
    ...buyerIdRows
  ];

  const partiesTable = new Table({
    rows: [
      new TableRow({
        children: [
          new TableCell({ children: consigneeCellChildren, width: { size: 5040, type: WidthType.DXA }, verticalAlign: VerticalAlign.TOP, borders: DEFAULT_BORDERS }),
          new TableCell({ children: buyerCellChildren, width: { size: 5040, type: WidthType.DXA }, verticalAlign: VerticalAlign.TOP, borders: DEFAULT_BORDERS })
        ]
      })
    ],
    width: { size: 10080, type: WidthType.DXA }
  });

  sectionChildren.push(partiesTable);
  sectionChildren.push(new Paragraph({ text: '' }));

  // Items Table
  const headers = ['Sr', 'Ref No', 'Part No', 'Description of Goods', 'HSN/SAC', 'Qty', 'Rate', 'Amount'];
  const colWidths = [500, 1700, 1200, 3300, 900, 500, 1000, 980];
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h, idx) => cell(h, AlignmentType.CENTER, 1, true, 20, 'E0E0E0', '000000', colWidths[idx]))
  });

  const rows = [headerRow];
  let subtotalAmount = 0;

  const splitFobFreight = Boolean(invoiceData.splitFobFreight);
  const baseFreightCharges = Number(invoiceData.freightCharges) || 0;
  const baseInsuranceCharges = Number(invoiceData.insuranceCharges) || 0;
  const splitExtraVal = splitFobFreight ? (baseFreightCharges + baseInsuranceCharges) : 0;
  const baseTotal = lineItems.reduce((sum, item) => {
    const qty = Number(item.qty) || 0;
    const rate = Number(item.rate) || 0;
    const baseAmount = Number(item.amount);
    const amount = Number.isFinite(baseAmount) && baseAmount !== 0 ? baseAmount : qty * rate;
    return sum + amount;
  }, 0);

  const adjustedItems = lineItems.map((item) => {
    const qty = Number(item.qty) || 0;
    const rate = Number(item.rate) || 0;
    const baseAmount = Number(item.amount);
    const amount = Number.isFinite(baseAmount) && baseAmount !== 0 ? baseAmount : qty * rate;

    if (splitFobFreight && baseTotal > 0 && splitExtraVal > 0) {
      const extraShare = (amount / baseTotal) * splitExtraVal;
      const splitAmount = amount + extraShare;
      const splitRate = qty > 0 ? splitAmount / qty : rate;
      return { ...item, amount: splitAmount, rate: splitRate };
    }
    return { ...item, amount };
  });

  adjustedItems.forEach((item, i) => {
    const amount = Number(item.amount) || 0;
    subtotalAmount += amount;
    const rowShade = i % 2 === 1 ? 'F8F9FA' : null;
    rows.push(new TableRow({
      children: [
        cell(String(i + 1), AlignmentType.CENTER, 1, false, 18, rowShade, "000000", colWidths[0]),
        cell(item.refNo || '', AlignmentType.CENTER, 1, false, 18, rowShade, "000000", colWidths[1]),
        cell(item.partNo || '', AlignmentType.CENTER, 1, false, 18, rowShade, "000000", colWidths[2]),
        cell(item.description, AlignmentType.LEFT, 1, false, 18, rowShade, "000000", colWidths[3]),
        cell(item.hsn, AlignmentType.CENTER, 1, false, 18, rowShade, "000000", colWidths[4]),
        cell(item.qty !== undefined && item.qty !== null ? String(item.qty) : '', AlignmentType.CENTER, 1, false, 18, rowShade, "000000", colWidths[5]),
        cell(formatMoney(item.rate, currencyLabel), AlignmentType.CENTER, 1, false, 18, rowShade, "000000", colWidths[6]),
        cell(formatMoney(amount, currencyLabel), AlignmentType.CENTER, 1, false, 18, rowShade, "000000", colWidths[7]),
      ]
    }));
  });

  sectionChildren.push(new Table({
    rows,
    width: { size: 10080, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths: colWidths
  }));

  sectionChildren.push(new Paragraph({ text: '' }));

  const freightCharges = splitFobFreight ? 0 : baseFreightCharges;
  const insuranceCharges = splitFobFreight ? 0 : baseInsuranceCharges;
  const grandTotal = subtotalAmount + freightCharges + insuranceCharges;

  // --- UPDATED TOTALS TABLE (Commercial Invoice) ---
  const totalsRows = [
    new TableRow({
      children: [
        cell('Subtotal', AlignmentType.RIGHT, 1, false, 18),
        cell(formatMoney(subtotalAmount, currencyLabel), AlignmentType.CENTER, 1, false, 18)
      ]
    })
  ];

  if (!splitFobFreight) {
    totalsRows.push(
      new TableRow({
        children: [
          cell('Freight', AlignmentType.RIGHT, 1, false, 18),
          cell(formatMoney(freightCharges, currencyLabel), AlignmentType.CENTER, 1, false, 18)
        ]
      }),
      new TableRow({
        children: [
          cell('Insurance', AlignmentType.RIGHT, 1, false, 18),
          cell(formatMoney(insuranceCharges, currencyLabel), AlignmentType.CENTER, 1, false, 18)
        ]
      })
    );
  }

  totalsRows.push(
    new TableRow({
      children: [
        cell('TOTAL', AlignmentType.RIGHT, 1, true, 20),
        cell(formatMoney(grandTotal, currencyLabel), AlignmentType.CENTER, 1, true, 20)
      ]
    })
  );

  const totalsTable = new Table({
    rows: totalsRows,
    // Aligned to RIGHT, same styling logic as main table, 2 columns
    width: { size: 4896, type: WidthType.DXA }, 
    alignment: AlignmentType.RIGHT
  });

  sectionChildren.push(totalsTable);

  const doc = new Document({
      sections: [{
          properties: { page: { margin: { top: 500, bottom: 500, left: 500, right: 500 } } },
          headers: { default: header },
          footers: { default: footer },
          children: sectionChildren
      }]
  });

  return await Packer.toBuffer(doc);
}

// =========================================================================
// 2. TAX INVOICE GENERATOR (Indian Govt Format)
// =========================================================================
async function generateTaxInvoiceWord(invoiceData, lineItems, exchangeRate) {
  const exRate = parseFloat(exchangeRate) || 1;

  // --- Header ---
  const headerChildren = [];
  const imgBuffer = getImageBuffer();
  if (imgBuffer) {
      headerChildren.push(new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new ImageRun({ data: imgBuffer, transformation: { width: 173, height: 60 } })]
      }));
  }
  const header = new Header({ children: headerChildren });

  // --- Footer ---
  const footer = new Footer({
      children: [
          new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: 'Morsebiz Technology Services Pvt Ltd', bold: true, size: 16 })]
          }),
          new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: 'Regd. Office: 20th Floor, Oberoi Garden City, Mumbai 400063', size: 14 })]
          }),
      ]
  });

  const sectionChildren = [];

  // Title
  sectionChildren.push(
      new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 100, after: 100 },
          children: [new TextRun({ text: 'TAX INVOICE', bold: true, size: 28, underline: {} })]
      })
  );

  const exporter = invoiceData.exporter || {};
  const buyer = invoiceData.buyer || {};
  const consignee = invoiceData.consignee || {};

  const exporterGst = pickCompanyField(exporter, ['gstNo', 'gst_number', 'gstNumber', 'gstin', 'gstIn', 'gst']);
  const exporterPan = pickCompanyField(exporter, ['panNo', 'pan_no', 'panNumber', 'pan']);
  const exporterIec = pickCompanyField(exporter, ['iecCode', 'iec_code', 'iec']);

  const buyerGst = pickCompanyField(buyer, ['gstNo', 'gst_number', 'gstNumber', 'gstin', 'gstIn', 'gst']);
  const buyerPan = pickCompanyField(buyer, ['panNo', 'pan_no', 'panNumber', 'pan']);
  const buyerIec = pickCompanyField(buyer, ['iecCode', 'iec_code', 'iec']);

  const consigneeGst = pickCompanyField(consignee, ['gstNo', 'gst_number', 'gstNumber', 'gstin', 'gstIn', 'gst']);
  const consigneePan = pickCompanyField(consignee, ['panNo', 'pan_no', 'panNumber', 'pan']);
  const consigneeIec = pickCompanyField(consignee, ['iecCode', 'iec_code', 'iec']);

  const dispatchFrom = getDispatchAddress(invoiceData);

  // --- TOP SECTION (Redesigned to match Commercial Invoice) ---
  const exporterIdRows = optionalLabelValueParagraphs(
    [
      { label: 'GST', value: exporterGst },
      { label: 'PAN', value: exporterPan },
      { label: 'IEC', value: exporterIec }
    ],
    { labelSize: 18, valueSize: 18 }
  );

  const buyerIdRows = optionalLabelValueParagraphs(
    [
      { label: 'GST', value: buyerGst },
      { label: 'PAN', value: buyerPan },
      { label: 'IEC', value: buyerIec }
    ],
    { labelSize: 18, valueSize: 18 }
  );

  const consigneeIdRows = optionalLabelValueParagraphs(
    [
      { label: 'GST', value: consigneeGst },
      { label: 'PAN', value: consigneePan },
      { label: 'IEC', value: consigneeIec }
    ],
    { labelSize: 18, valueSize: 18 }
  );
  
  // Left Side: Exporter & Dispatch
  const exporterInfoCell = new TableCell({
    children: [
      makeParagraph('Exporter / Shipper', { bold: true, size: 22 }),
      makeParagraph(safeText(exporter.name, ''), { bold: true, size: 20 }),
      ...(exporter.address ? [makeParagraph(exporter.address, { size: 18 })] : []),
      ...exporterIdRows
    ],
    verticalAlign: VerticalAlign.TOP,
    borders: DEFAULT_BORDERS
  });

  const dispatchCell = new TableCell({
    children: [labelValueParagraph('Dispatch From: ', dispatchFrom, { labelSize: 20, valueSize: 18 })],
    verticalAlign: VerticalAlign.TOP,
    borders: DEFAULT_BORDERS
  });

  const exporterTable = new Table({
    rows: [
      new TableRow({ children: [exporterInfoCell] }),
      new TableRow({ children: [dispatchCell] })
    ],
    width: { size: 5040, type: WidthType.DXA }
  });

  // Right Side: Invoice Info & Shipping
  const invoiceInfoTable = new Table({
    rows: [
      labelValueRow('Invoice No.:', invoiceData.invoiceNumber),
      labelValueRow('Invoice Date:', formatDateDisplay(invoiceData.invoiceDate)),
      labelValueRow('Exchange Rate:', `₹${exRate.toFixed(2)}`), // Added for Tax Invoice
      labelValueRow('Terms of Payment:', invoiceData.termsOfPayment || '-'),
      labelValueRow('Terms of Delivery:', formatDeliveryTerms(invoiceData.termsOfDelivery))
    ],
    width: { size: 5000, type: WidthType.DXA }
  });

  const shippingTable = new Table({
    rows: [
      labelValueRow('Pre-Carriage By:', invoiceData.preCarriageBy || '-'),
      labelValueRow('Place of Receipt:', invoiceData.placeOfReceipt || '-'),
      labelValueRow('Port of Loading:', invoiceData.portOfLoading || '-'),
      labelValueRow('Port of Discharge:', invoiceData.portOfDischarge || '-'),
      labelValueRow('Total Net Weight:', invoiceData.totalNetWeight ? `${invoiceData.totalNetWeight} KGS` : '-'),
      labelValueRow('Total Gross Weight:', invoiceData.totalGrossWeight ? `${invoiceData.totalGrossWeight} KGS` : '-'),
      labelValueRow('Total Packages:', invoiceData.numberOfPackages || '-')
    ],
    width: { size: 5000, type: WidthType.DXA }
  });

  const rightCellChildren = [
    invoiceInfoTable,
    new Paragraph({ text: '' }),
    makeParagraph('Shipping & Logistics', { bold: true, size: 22 }),
    shippingTable
  ];

  // Combined Top Table
  const topTable = new Table({
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [exporterTable],
            width: { size: 5040, type: WidthType.DXA },
            verticalAlign: VerticalAlign.TOP,
            borders: DEFAULT_BORDERS
          }),
          new TableCell({
            children: rightCellChildren,
            width: { size: 5040, type: WidthType.DXA },
            verticalAlign: VerticalAlign.TOP,
            borders: DEFAULT_BORDERS
          })
        ]
      })
    ],
    width: { size: 10080, type: WidthType.DXA }
  });

  sectionChildren.push(topTable);
  sectionChildren.push(new Paragraph({ text: '' }));

  // --- PARTIES SECTION (Redesigned to match Commercial Invoice) ---
  
  const consigneeCellChildren = [
    makeParagraph('Consignee (Ship To)', { bold: true, size: 22 }),
    makeParagraph(safeText(consignee.name, ''), { bold: true, size: 20 }),
    ...(consignee.address ? [makeParagraph(consignee.address, { size: 18 })] : []),
    ...consigneeIdRows
  ];

  const buyerCellChildren = [
    makeParagraph('Buyer (Bill To)', { bold: true, size: 22 }),
    makeParagraph(safeText(buyer.name, ''), { bold: true, size: 20 }),
    ...(buyer.address ? [makeParagraph(buyer.address, { size: 18 })] : []),
    ...buyerIdRows
  ];

  const partiesTable = new Table({
    rows: [
      new TableRow({
        children: [
          new TableCell({ children: consigneeCellChildren, width: { size: 5040, type: WidthType.DXA }, verticalAlign: VerticalAlign.TOP, borders: DEFAULT_BORDERS }),
          new TableCell({ children: buyerCellChildren, width: { size: 5040, type: WidthType.DXA }, verticalAlign: VerticalAlign.TOP, borders: DEFAULT_BORDERS })
        ]
      })
    ],
    width: { size: 10080, type: WidthType.DXA }
  });

  sectionChildren.push(partiesTable);
  sectionChildren.push(new Paragraph({ text: '' }));

  // Items Table Headers
  const headers = ['Sr', 'Description', 'HSN', 'Qty', 'Unit', 'Rate($)', 'Rate(₹)', 'Taxable(₹)', 'IGST%', 'IGST Amt', 'Total(₹)'];
  const taxColWidths = [500, 2480, 900, 500, 700, 850, 850, 900, 600, 900, 900];
  const headerRow = new TableRow({
      tableHeader: true,
      children: headers.map((h, idx) => cell(h, AlignmentType.CENTER, 1, true, 14, 'E0E0E0', '000000', taxColWidths[idx]))
  });

  const rows = [headerRow];
  let totalTaxable = 0;
  let totalIGST = 0;
  let grandTotalINR = 0;

  lineItems.forEach((item, idx) => {
      // Parse Values
      const qty = parseFloat(item.qty) || 0;
      const rateUSD = parseFloat(item.rate) || 0;
      
      // --- 1. CURRENCY CONVERSION ---
      const rateINR = rateUSD * exRate;
      const taxableValue = qty * rateINR;

      // --- 2. IGST CALCULATION (Fixed) ---
      let igstRate = 0;
      // Clean IGST string (handles "!8%", "0.18", "18%")
      let igstStr = String(item.igst || '').replace(/[^0-9.]/g, ''); 
      let igstRaw = parseFloat(igstStr);

      // FIX: If missing or 0, default to 18
      if (isNaN(igstRaw) || igstRaw === 0) {
        igstRaw = 18;
      }

      // Logic: If < 1 (e.g. 0.18), treat as decimal. If >= 1 (e.g. 18), treat as percentage.
      if (igstRaw > 0 && igstRaw < 1) igstRate = igstRaw * 100;
      else igstRate = igstRaw;

      const igstAmount = taxableValue * (igstRate / 100);
      const totalRowINR = taxableValue + igstAmount;

      // Add to Totals
      totalTaxable += taxableValue;
      totalIGST += igstAmount;
      grandTotalINR += totalRowINR;

      // Add Row
      rows.push(new TableRow({
          children: [
              cell(String(idx + 1), AlignmentType.CENTER, 1, false, 14, null, "000000", taxColWidths[0]),
              cell(item.description, AlignmentType.LEFT, 1, false, 14, null, "000000", taxColWidths[1]),
              cell(item.hsn, AlignmentType.CENTER, 1, false, 14, null, "000000", taxColWidths[2]),
              cell(String(qty), AlignmentType.CENTER, 1, false, 14, null, "000000", taxColWidths[3]),
              cell(item.unit || 'NOS', AlignmentType.CENTER, 1, false, 14, null, "000000", taxColWidths[4]), // Unit from Excel
              cell(rateUSD.toFixed(2), AlignmentType.CENTER, 1, false, 14, null, "000000", taxColWidths[5]),
              cell(rateINR.toFixed(2), AlignmentType.CENTER, 1, false, 14, null, "000000", taxColWidths[6]),
              cell(taxableValue.toFixed(2), AlignmentType.CENTER, 1, false, 14, null, "000000", taxColWidths[7]),
              cell(`${igstRate}%`, AlignmentType.CENTER, 1, false, 14, null, "000000", taxColWidths[8]),
              cell(igstAmount.toFixed(2), AlignmentType.CENTER, 1, false, 14, null, "000000", taxColWidths[9]),
              cell(totalRowINR.toFixed(2), AlignmentType.CENTER, 1, false, 14, null, "000000", taxColWidths[10]),
          ]
      }));
  });

  // --- TOTAL ROW ---
  rows.push(new TableRow({
      children: [
          cell('Total', AlignmentType.RIGHT, 7, true), // Span first 7 columns
          cell(totalTaxable.toFixed(2), AlignmentType.CENTER, 1, true),
          cell('', AlignmentType.CENTER, 1),
          cell(totalIGST.toFixed(2), AlignmentType.CENTER, 1, true),
          cell(grandTotalINR.toFixed(2), AlignmentType.CENTER, 1, true),
      ]
  }));

  const itemsTable = new Table({
      rows: rows,
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
      columnWidths: taxColWidths
  });

  sectionChildren.push(itemsTable);

  // --- AMOUNT IN WORDS (Simple Representation) ---
  sectionChildren.push(new Paragraph({ text: '' }));
  sectionChildren.push(new Paragraph({
      children: [
          new TextRun({ text: 'Total Invoice Amount in INR: ', bold: true, size: 16 }), 
          new TextRun({ text: `₹ ${grandTotalINR.toFixed(2)}`, size: 16 })
      ]
  }));

  // --- DOCUMENT GENERATION ---
  const doc = new Document({
      sections: [{
          properties: {
              page: {
                  margin: { top: 500, bottom: 500, left: 500, right: 500 }, // Narrow margins
                  orientation: PageOrientation.LANDSCAPE // Landscape to fit columns
              }
          },
          headers: { default: header },
          footers: { default: footer },
          children: sectionChildren
      }]
  });

  return await Packer.toBuffer(doc);
}

module.exports = { generateWordInvoice, generateTaxInvoiceWord };
