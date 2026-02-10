# Invoice Generator - Node.js Edition

A comprehensive invoice generation system built with Node.js, Express, and MongoDB. This application allows you to create professional commercial invoices, export documentation, and various letter templates (CHA, EVD, Non-Vintage, SCOMET) with support for both DOCX and PDF formats.

## Features

- **Company Master Data Management**: Create and manage exporters, buyers, consignees, and CHA (Customs House Agent) companies
- **Excel Import**: Upload Excel files with line items - automatic header detection and data parsing
- **Multiple Invoice Variants**:
  - Normal Invoice
  - Split Invoice (FOB & Freight split into line items)
  - Both (Normal + Split in ZIP)
- **Letter Generation**: Generate various export documentation letters:
  - CHA Letter
  - EVD Letter
  - Non-Vintage Letter
  - SCOMET Declaration Letter
- **Multiple Export Formats**: Generate invoices as DOCX or PDF
- **Professional Layout**: Matches Django template with proper formatting, borders, and styling
- **Currency Support**: Automatic detection of USD/INR from Excel files

## Prerequisites

- **Node.js** (v14 or higher)
- **MongoDB** (Atlas or local instance)
- **LibreOffice** (for PDF conversion - optional, DOCX works without it)

### Installing LibreOffice (for PDF support)

**macOS:**
```bash
brew install --cask libreoffice
```

**Linux:**
```bash
sudo apt-get install libreoffice
```

**Windows:**
Download from [LibreOffice.org](https://www.libreoffice.org/download/)

## Installation

1. **Clone or navigate to the project directory:**
   ```bash
   cd invoice-generator-node
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   Create a `.env` file in the root directory:
   ```env
   MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/database?appName=invoice-generator
   ```
   
   For local MongoDB:
   ```env
   MONGO_URI=mongodb://localhost:27017/invoice_generator
   ```

4. **Create required directories:**
   ```bash
   mkdir -p uploads
   mkdir -p "word docs"
   ```

5. **Add Word templates** (optional):
   Place your Word document templates in the `word docs/` directory:
   - `CHA letter.docx`
   - `EVD letter.docx`
   - `non vintage.docx`
   - `scomet declaration.docx`

## Running the Application

1. **Start the server:**
   ```bash
   node app.js
   ```

2. **Access the application:**
   Open your browser and navigate to:
   ```
   http://localhost:8000
   ```

## Usage Guide

### 1. Create Companies (Master Data)

Before generating invoices, you can create master data for companies:

- Click the **"+ Add"** button next to any party field (Exporter, Buyer, Consignee, CHA)
- Fill in the company details:
  - Name (required)
  - Address
  - GST No (for Indian companies)
  - PAN No (for Indian companies)
  - IEC Code (for exporters)
- Click **"Save & Select"** - the company will be automatically selected

### 2. Fill Invoice Details

1. **Select Exporter**: Choose from dropdown or add new
2. **Select Dispatch Location**: Mumbai or Solapur
3. **Select Buyer**: Choose from dropdown or add new
4. **Select Consignee**: Choose from dropdown, add new, or check "Same as Buyer"
5. **Select CHA Agent** (optional): For CHA letter generation
6. **Fill Invoice Information**:
   - Invoice Number
   - Invoice Date
   - Invoice Expiry Date (optional)
   - Terms of Payment
7. **Fill Shipment Details**:
   - Pre-Carriage By (default: "By Road")
   - Place of Receipt (default: "Nhava Sheva Mumbai")
   - Port of Loading (default: "Nhava Sheva, India")
   - Port of Discharge (required)
   - Terms of Delivery (EXW, FOB, CFR, CIF)
8. **Fill Cargo & Financials**:
   - Number of Packages
   - Total Net Weight (Kg)
   - Total Gross Weight (Kg)
   - Freight Charges
   - Insurance Charges
   - Split FOB & Freight (checkbox - splits freight into line items)

### 3. Upload Excel File

1. Click **"Choose File"** and select your Excel file (.xlsx or .xls)
2. The system will automatically:
   - Detect the header row (searches for "HSN" and "DESC"/"PART")
   - Parse line items
   - Detect currency (USD/INR)
   - Display a preview table
3. Verify the parsed data in the preview table

**Excel Format Requirements:**
- Headers should include: HSN, Description, Quantity, Rate
- Optional columns: Ref No, Part No
- The system will auto-detect column names (case-insensitive)

### 4. Generate Invoice

Choose your download option:

- **DOWNLOAD NORMAL**: Standard invoice with freight/insurance as separate line items
- **DOWNLOAD SPLIT**: Invoice with freight/insurance split proportionally into each line item
- **DOWNLOAD BOTH**: Generates both normal and split versions (currently returns normal)
- **DOWNLOAD CHA LETTER**: Generates CHA authorization letter
- **DOWNLOAD EVD LETTER**: Generates EVD letter
- **DOWNLOAD NON VINTAGE LETTER**: Generates Non-Vintage declaration
- **DOWNLOAD SCOMET LETTER**: Generates SCOMET declaration

Select format:
- **DOCX**: Word document format (always works)
- **PDF**: PDF format (requires LibreOffice)

## API Endpoints

### Company Management

- `GET /api/companies?role=EXPORTER` - Get companies by role
  - Roles: EXPORTER, BUYER, CONSIGNEE, CHA
- `POST /api/companies` - Create a new company
  ```json
  {
    "name": "Company Name",
    "address": "Full Address",
    "role": "EXPORTER",
    "gstNo": "GST123456",
    "panNo": "PAN123456",
    "iecCode": "IEC123456"
  }
  ```

### Excel Upload

- `POST /api/upload-excel` - Upload and parse Excel file
  - Form data: `excelFile` (multipart/form-data)
  - Returns: `{ items: [...], currencyLabel: "INR" | "USD" }`

### Invoice Generation

- `POST /api/generate/invoice` - Generate invoice or letter
  ```json
  {
    "invoiceNumber": "INV-001",
    "invoiceDate": "2024-01-15",
    "exporter": { ... },
    "buyer": { ... },
    "consignee": { ... },
    "lineItems": [...],
    "downloadVariant": "normal" | "split" | "both" | "cha_letter" | "evd_letter" | "non_vintage_letter" | "scomet_letter",
    "outputFormat": "docx" | "pdf",
    ...
  }
  ```

### Health Check

- `GET /api/health` - Check MongoDB connection status

## Project Structure

```
invoice-generator-node/
├── app.js                 # Main Express server and routes
├── models/
│   ├── Company.js        # Company/Master data model
│   └── Invoice.js        # Invoice model
├── services/
│   ├── documentService.js    # Template-based document generation (for letters)
│   └── wordGenerator.js      # Programmatic Word invoice generation
├── public/
│   └── index.html        # Frontend UI
├── uploads/              # Temporary file uploads
├── word docs/            # Word document templates
├── .env                  # Environment variables (create this)
└── package.json          # Dependencies
```

## Dependencies

- **express**: Web framework
- **mongoose**: MongoDB ODM
- **multer**: File upload handling
- **xlsx**: Excel file parsing
- **docx**: Programmatic Word document generation
- **libreoffice-convert**: DOCX to PDF conversion
- **dotenv**: Environment variable management

## Database Schema

### Company Model
```javascript
{
  name: String,
  address: String,
  role: Enum['EXPORTER', 'BUYER', 'CONSIGNEE', 'CHA'],
  gstNo: String,
  panNo: String,
  iecCode: String
}
```

### Invoice Model
```javascript
{
  exporter: Company,
  buyer: Company,
  consignee: Company,
  chaAgent: Company,
  invoiceNumber: String,
  invoiceDate: Date,
  invoiceExpiryDate: Date,
  dispatchLocation: Enum['MUMBAI', 'SOLAPUR'],
  portOfDischarge: String,
  termsOfDelivery: Enum['EXW', 'FOB', 'CFR', 'CIF'],
  lineItems: [LineItem],
  freightCharges: Number,
  insuranceCharges: Number,
  splitFobFreight: Boolean,
  currencyLabel: String,
  ...
}
```

## Troubleshooting

### MongoDB Connection Issues

- **Error**: "Operation buffering timed out"
  - **Solution**: Check your `MONGO_URI` in `.env` file
  - Ensure MongoDB Atlas IP whitelist includes your IP
  - Verify username/password are correct

### PDF Generation Fails

- **Error**: "PDF conversion failed"
  - **Solution**: Install LibreOffice (see Prerequisites)
  - Or use DOCX format instead
  - Check LibreOffice installation: `which soffice` or `which libreoffice`

### Excel Parsing Issues

- **Error**: "Excel reading failed"
  - **Solution**: Ensure Excel file has proper headers (HSN, Description, Quantity, Rate)
  - Check file format (.xlsx or .xls)
  - Verify file is not corrupted

### Port Already in Use

- **Error**: "Port 8000 already in use"
  - **Solution**: Change port in `app.js` (last line) or kill the process using port 8000

## Development

### Adding New Letter Templates

1. Add Word template to `word docs/` directory
2. Update `app.js` route handler to include new template mapping
3. Add button in `public/index.html` for new letter type

### Customizing Invoice Layout

Edit `services/wordGenerator.js`:
- Modify `generateWordInvoice()` function
- Adjust table structures, fonts, spacing
- Update footer/header content

## License

ISC

## Support

For issues or questions, please check:
1. MongoDB connection status: `GET /api/health`
2. Server logs for detailed error messages
3. Ensure all dependencies are installed: `npm install`

## Notes

- The application matches the Django version's invoice generation logic
- All formatting, borders, and layouts are designed to match the original template
- PDF conversion requires LibreOffice - DOCX format works without it
- Company master data is stored in MongoDB for reuse across invoices
