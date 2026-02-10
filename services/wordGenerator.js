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

// Helper to create a standard cell with borders
function cell(text, align = AlignmentType.CENTER, span = 1, bold = false, fontSize = 14, shading = null) {
  const cellProps = {
      children: [
          new Paragraph({ 
              alignment: align, 
              children: [new TextRun({ text: String(text || '-'), size: fontSize, bold: bold })] 
          })
      ],
      columnSpan: span,
      verticalAlign: VerticalAlign.CENTER,
      borders: {
          top: { style: BorderStyle.SINGLE, size: 2, color: "000000" },
          bottom: { style: BorderStyle.SINGLE, size: 2, color: "000000" },
          left: { style: BorderStyle.SINGLE, size: 2, color: "000000" },
          right: { style: BorderStyle.SINGLE, size: 2, color: "000000" },
      }
  };

  if (shading) {
      cellProps.shading = { fill: shading, type: ShadingType.SOLID };
  }

  return new TableCell(cellProps);
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

  // Info Table
  const infoTable = new Table({
      rows: [
          new TableRow({
              children: [
                  new TableCell({
                      children: [
                          new Paragraph({ children: [new TextRun({ text: 'Exporter:', bold: true })] }),
                          new Paragraph({ text: invoiceData.exporter.name, bold: true }),
                          new Paragraph({ text: invoiceData.exporter.address }),
                      ],
                      width: { size: 50, type: WidthType.PERCENTAGE }
                  }),
                  new TableCell({
                      children: [
                          new Paragraph({ children: [new TextRun({ text: `Invoice No: ${invoiceData.invoiceNumber}`, bold: true })] }),
                          new Paragraph({ text: `Date: ${formatDate(invoiceData.invoiceDate)}` }),
                          new Paragraph({ text: `Payment Terms: ${invoiceData.termsOfPayment || '-'}` }),
                          new Paragraph({ text: `Incoterms: ${invoiceData.termsOfDelivery || '-'}` }),
                      ],
                      width: { size: 50, type: WidthType.PERCENTAGE }
                  })
              ]
          }),
          new TableRow({
              children: [
                  new TableCell({
                      children: [
                          new Paragraph({ children: [new TextRun({ text: 'Consignee:', bold: true })] }),
                          new Paragraph({ text: invoiceData.consignee?.name || '' }),
                          new Paragraph({ text: invoiceData.consignee?.address || '' }),
                      ],
                      columnSpan: 2
                  })
              ]
          })
      ],
      width: { size: 100, type: WidthType.PERCENTAGE }
  });
  sectionChildren.push(infoTable);
  sectionChildren.push(new Paragraph({ text: '' })); // Spacer

  // Items Table
  const headers = ['Sr', 'Description', 'HSN', 'Qty', `Rate (${currencyLabel})`, `Amount (${currencyLabel})`];
  const headerRow = new TableRow({
      tableHeader: true,
      children: headers.map(h => cell(h, AlignmentType.CENTER, 1, true, 16, 'E0E0E0'))
  });

  const rows = [headerRow];
  let totalAmount = 0;

  lineItems.forEach((item, i) => {
      totalAmount += item.amount;
      rows.push(new TableRow({
          children: [
              cell(String(i + 1)),
              cell(item.description, AlignmentType.LEFT),
              cell(item.hsn),
              cell(String(item.qty)),
              cell(item.rate.toFixed(2)),
              cell(item.amount.toFixed(2)),
          ]
      }));
  });

  // Total Row
  rows.push(new TableRow({
      children: [
          cell('Total', AlignmentType.RIGHT, 5, true, 16),
          cell(totalAmount.toFixed(2), AlignmentType.CENTER, 1, true, 16),
      ]
  }));

  sectionChildren.push(new Table({
      rows: rows,
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.AUTOFIT
  }));

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