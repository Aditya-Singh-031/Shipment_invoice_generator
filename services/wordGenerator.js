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
  color = "000000"
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

  if (shading) {
    cellProps.shading = { fill: shading, type: ShadingType.SOLID };
  }

  return new TableCell(cellProps);
}

function safeText(value, fallback = '-') {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value);
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

  const deliveryTermsMap = {
    FOB: 'FOB (Free on Board)',
    EXW: 'EXW (Ex Works)',
    CFR: 'CFR (Cost and Freight)',
    CIF: 'CIF (Cost, Insurance & Freight)'
  };

  const dispatchMap = {
    MUMBAI: "Ground Floor, Godown No. 25/B, Survey No.25/B, 26/1A1, 26/1A2, 25/1A & 26/1B, BLR Logistiks (I) Limited C/O M/S Forefront Logistics Pvt Ltd, Post Mothi Jui Uran, Taki Gaon Bus Stop, Dighode Chirner Road, Bhom, Raigad, Maharashtra 410206",
    SOLAPUR: "A/21/1, MIDC Chincholi, Solapur, Maharashtra - 413255"
  };
  const dispatchKey = String(invoiceData.dispatchLocation || '').trim().toUpperCase();
  const dispatchFrom = safeText(
    invoiceData.dispatchAddress || dispatchMap[dispatchKey] || invoiceData.dispatchLocation,
    '-'
  );

  const exporterInfoCell = new TableCell({
    children: [
      makeParagraph('Exporter / Shipper', { bold: true, size: 22 }),
      makeParagraph(safeText(exporter.name, ''), { bold: true, size: 20 }),
      ...(exporter.address ? [makeParagraph(exporter.address, { size: 18 })] : []),
      labelValueParagraph('GST: ', exporterGst, { labelSize: 18, valueSize: 18 }),
      labelValueParagraph('PAN: ', exporterPan, { labelSize: 18, valueSize: 18 }),
      labelValueParagraph('IEC: ', exporterIec, { labelSize: 18, valueSize: 18 })
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
      labelValueRow('Terms of Delivery:', deliveryTermsMap[invoiceData.termsOfDelivery] || safeText(invoiceData.termsOfDelivery, '-'))
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
    labelValueParagraph('GST: ', consigneeGst, { labelSize: 18, valueSize: 18 }),
    labelValueParagraph('PAN: ', consigneePan, { labelSize: 18, valueSize: 18 }),
    labelValueParagraph('IEC: ', consigneeIec, { labelSize: 18, valueSize: 18 })
  ];

  const buyerCellChildren = [
    makeParagraph('Buyer', { bold: true, size: 22 }),
    makeParagraph(safeText(buyer.name, ''), { bold: true, size: 20 }),
    ...(buyer.address ? [makeParagraph(buyer.address, { size: 18 })] : []),
    labelValueParagraph('GST: ', buyerGst, { labelSize: 18, valueSize: 18 }),
    labelValueParagraph('PAN: ', buyerPan, { labelSize: 18, valueSize: 18 }),
    labelValueParagraph('IEC: ', buyerIec, { labelSize: 18, valueSize: 18 })
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
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map(h => cell(h, AlignmentType.CENTER, 1, true, 20, 'E0E0E0', '000000'))
  });

  const rows = [headerRow];
  let subtotalAmount = 0;

  lineItems.forEach((item, i) => {
    const amount = Number(item.amount) || 0;
    subtotalAmount += amount;
    const rowShade = i % 2 === 1 ? 'F8F9FA' : null;
    rows.push(new TableRow({
      children: [
        cell(String(i + 1), AlignmentType.CENTER, 1, false, 18, rowShade),
        cell(item.refNo || '', AlignmentType.CENTER, 1, false, 18, rowShade),
        cell(item.partNo || '', AlignmentType.CENTER, 1, false, 18, rowShade),
        cell(item.description, AlignmentType.LEFT, 1, false, 18, rowShade),
        cell(item.hsn, AlignmentType.CENTER, 1, false, 18, rowShade),
        cell(item.qty !== undefined && item.qty !== null ? String(item.qty) : '', AlignmentType.CENTER, 1, false, 18, rowShade),
        cell(formatMoney(item.rate, currencyLabel), AlignmentType.CENTER, 1, false, 18, rowShade),
        cell(formatMoney(amount, currencyLabel), AlignmentType.CENTER, 1, false, 18, rowShade),
      ]
    }));
  });

  sectionChildren.push(new Table({
    rows,
    width: { size: 10080, type: WidthType.DXA },
    layout: TableLayoutType.AUTOFIT
  }));

  sectionChildren.push(new Paragraph({ text: '' }));

  const freightCharges = Number(invoiceData.freightCharges) || 0;
  const insuranceCharges = Number(invoiceData.insuranceCharges) || 0;
  const grandTotal = subtotalAmount + freightCharges + insuranceCharges;
  const symbol = currencySymbol(currencyLabel) || currencyLabel || '';

  const totalsTable = new Table({
    rows: [
      new TableRow({
        children: [
          cell('Subtotal', AlignmentType.RIGHT, 1, false, 18),
          cell(symbol, AlignmentType.CENTER, 1, false, 18),
          cell(subtotalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), AlignmentType.RIGHT, 1, false, 18)
        ]
      }),
      new TableRow({
        children: [
          cell('Freight', AlignmentType.RIGHT, 1, false, 18),
          cell(symbol, AlignmentType.CENTER, 1, false, 18),
          cell(freightCharges.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), AlignmentType.RIGHT, 1, false, 18)
        ]
      }),
      new TableRow({
        children: [
          cell('Insurance', AlignmentType.RIGHT, 1, false, 18),
          cell(symbol, AlignmentType.CENTER, 1, false, 18),
          cell(insuranceCharges.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), AlignmentType.RIGHT, 1, false, 18)
        ]
      }),
      new TableRow({
        children: [
          cell('TOTAL', AlignmentType.RIGHT, 1, true, 20),
          cell(symbol, AlignmentType.CENTER, 1, true, 20),
          cell(grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), AlignmentType.RIGHT, 1, true, 20)
        ]
      })
    ],
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

  // Top Details Table
  const topTable = new Table({
      rows: [
          new TableRow({
              children: [
                  new TableCell({
                      children: [
                          new Paragraph({ children: [new TextRun({ text: 'Exporter:', bold: true, size: 16 })] }),
                          new Paragraph({ children: [new TextRun({ text: invoiceData.exporter.name, bold: true, size: 16 })] }),
                          new Paragraph({ children: [new TextRun({ text: invoiceData.exporter.address, size: 14 })] }),
                          new Paragraph({ children: [new TextRun({ text: `GSTIN: ${invoiceData.exporter.gstNo}`, bold: true, size: 14 })] }),
                      ],
                      width: { size: 50, type: WidthType.PERCENTAGE }
                  }),
                  new TableCell({
                      children: [
                          new Paragraph({ children: [new TextRun({ text: `Invoice No: ${invoiceData.invoiceNumber}`, bold: true, size: 16 })] }),
                          new Paragraph({ children: [new TextRun({ text: `Date: ${formatDate(invoiceData.invoiceDate)}`, size: 14 })] }),
                          new Paragraph({ children: [new TextRun({ text: `Exchange Rate: ₹${exRate.toFixed(2)}`, bold: true, size: 14 })] }),
                      ],
                      width: { size: 50, type: WidthType.PERCENTAGE }
                  })
              ]
          }),
          new TableRow({
              children: [
                  new TableCell({
                      children: [
                          new Paragraph({ children: [new TextRun({ text: 'Consignee (Ship To):', bold: true, size: 16 })] }),
                          new Paragraph({ children: [new TextRun({ text: invoiceData.consignee?.name || '', bold: true, size: 16 })] }),
                          new Paragraph({ children: [new TextRun({ text: invoiceData.consignee?.address || '', size: 14 })] }),
                          new Paragraph({ children: [new TextRun({ text: `GSTIN: ${invoiceData.consignee?.gstNo || 'N/A'}`, size: 14 })] }),
                      ],
                      columnSpan: 2
                  })
              ]
          })
      ],
      width: { size: 100, type: WidthType.PERCENTAGE }
  });
  sectionChildren.push(topTable);
  sectionChildren.push(new Paragraph({ text: '' }));

  // Items Table Headers
  const headers = ['Sr', 'Description', 'HSN', 'Qty', 'Unit', 'Rate($)', 'Rate(₹)', 'Taxable(₹)', 'IGST%', 'IGST Amt', 'Total(₹)'];
  const headerRow = new TableRow({
      tableHeader: true,
      children: headers.map(h => cell(h, AlignmentType.CENTER, 1, true, 14, 'E0E0E0'))
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

      // --- 2. IGST CALCULATION ---
      let igstRate = 0;
      // Clean IGST string (handles "!8%", "0.18", "18%")
      let igstStr = String(item.igst || '0').replace(/[^0-9.]/g, ''); 
      const igstRaw = parseFloat(igstStr);

      // Logic: If < 1 (e.g. 0.18), treat as decimal. If > 1 (e.g. 18), treat as percentage.
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
              cell(String(idx + 1)),
              cell(item.description, AlignmentType.LEFT),
              cell(item.hsn),
              cell(String(qty)),
              cell(item.unit || 'NOS'), // Unit from Excel
              cell(rateUSD.toFixed(2)),
              cell(rateINR.toFixed(2)),
              cell(taxableValue.toFixed(2)),
              cell(`${igstRate}%`),
              cell(igstAmount.toFixed(2)),
              cell(totalRowINR.toFixed(2)),
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
      layout: TableLayoutType.AUTOFIT
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
