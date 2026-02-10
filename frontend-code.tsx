"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Upload, FileText, Download, Plus, FileSpreadsheet, ArrowLeft, History, Save, Filter, ArrowUpDown, Archive } from "lucide-react"; 
import { toast } from "sonner"; 

import { 
  getCompanies, 
  createCompany, 
  uploadExcel, 
  generateDocumentAPI, 
  generateWorkingExcelAPI, 
  downloadSampleFile,
  getShipments,       
  getShipmentById,
  saveShipmentAPI,
  generateAllLettersAPI  // NEW: Add this to your lib/api.ts
} from "./lib/api";

// --- HELPER TO FIX DECIMAL128 ERROR ---
const getMongoNum = (val) => {
  if (val && typeof val === 'object' && val.$numberDecimal) {
    return parseFloat(val.$numberDecimal);
  }
  return val;
};

export default function ShipmentGeneratorPage() {
  const [viewMode, setViewMode] = useState("LIST");
  const [shipmentList, setShipmentList] = useState([]);
  const [currentShipmentId, setCurrentShipmentId] = useState(null);

  // NEW: Filter and Sort State
  const [filters, setFilters] = useState({
    dateFrom: "",
    dateTo: "",
    quantityMin: "",
    quantityMax: "",
  });
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState("desc");
  const [showFilters, setShowFilters] = useState(false);

  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [uploadedItems, setUploadedItems] = useState([]);
  const [detectedCurrency, setDetectedCurrency] = useState("USD");
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newCompany, setNewCompany] = useState({ name: "", address: "", gst_number: "", iec_code: "", pan_no: "" });

  const initialFormState = {
    buyer: "", consignee: "", consigneeSameAsBuyer: false, chaAgent: "",
    invoiceNumber: "", invoiceDate: new Date().toISOString().split('T')[0],
    termsOfPayment: "", preCarriageBy: "By Road", placeOfReceipt: "Nhava Sheva Mumbai",
    portOfLoading: "Nhava Sheva, India", portOfDischarge: "", dispatchLocation: "MUMBAI",
    termsOfDelivery: "FOB", numberOfPackages: "1", totalNetWeight: "", totalGrossWeight: "",
    freightCharges: "0", insuranceCharges: "0", splitFobFreight: false,
  };
  const [formData, setFormData] = useState(initialFormState);

  useEffect(() => { loadEssentials(); loadShipmentHistory(); }, []);
  useEffect(() => { if (viewMode === "LIST") loadShipmentHistory(); }, [viewMode, filters, sortBy, sortOrder]);

  const loadEssentials = async () => { try { setCompanies(await getCompanies()); } catch (e) {} };
  
  const loadShipmentHistory = async () => { 
    try { 
      setLoading(true); 
      // Build query params from filters and sort
      const params = new URLSearchParams();
      if (filters.dateFrom) params.append("dateFrom", filters.dateFrom);
      if (filters.dateTo) params.append("dateTo", filters.dateTo);
      if (filters.quantityMin) params.append("quantityMin", filters.quantityMin);
      if (filters.quantityMax) params.append("quantityMax", filters.quantityMax);
      if (sortBy) params.append("sortBy", sortBy);
      if (sortOrder) params.append("sortOrder", sortOrder);
      
      const data = await getShipments(params.toString());
      setShipmentList(data);
    } catch (e) { 
      toast.error("Failed to load history"); 
    } finally { 
      setLoading(false); 
    } 
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleSortChange = (field) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  };

  const clearFilters = () => {
    setFilters({ dateFrom: "", dateTo: "", quantityMin: "", quantityMax: "" });
    setSortBy("created_at");
    setSortOrder("desc");
  };

  // --- ACTIONS ---

  const handleCreateNew = () => {
    setFormData(initialFormState);
    setUploadedItems([]);
    setDetectedCurrency("USD");
    setCurrentShipmentId(null);
    setViewMode("EDITOR");
  };

  const handleEditShipment = async (id) => {
    try {
      setLoading(true);
      const { shipment, details } = await getShipmentById(id);
      
      setCurrentShipmentId(shipment._id);

      setFormData({
        buyer: shipment.buyer_id?._id || shipment.buyer_id || "",
        consignee: shipment.consignee_id?._id || shipment.consignee_id || "",
        consigneeSameAsBuyer: (shipment.buyer_id === shipment.consignee_id),
        chaAgent: shipment.cha_details || "",
        invoiceNumber: shipment.invoice_number || "",
        invoiceDate: shipment.invoice_date ? shipment.invoice_date.split('T')[0] : "",
        termsOfPayment: shipment.payment_terms || "",
        preCarriageBy: shipment.pre_carriage || "",
        placeOfReceipt: shipment.receipt_place || "",
        portOfLoading: shipment.loading_port || "",
        portOfDischarge: shipment.discharge_port || "",
        dispatchLocation: shipment.dispatch_location || "MUMBAI",
        termsOfDelivery: shipment.delivery_terms || "FOB",
        numberOfPackages: String(getMongoNum(shipment.package_count) || 0),
        totalNetWeight: String(getMongoNum(shipment.net_weight_kg) || 0),
        totalGrossWeight: String(getMongoNum(shipment.gross_weight_kg) || 0),
        freightCharges: String(getMongoNum(shipment.freight_cost) || 0),
        insuranceCharges: String(getMongoNum(shipment.insurance_cost) || 0),
        splitFobFreight: shipment.is_freight_in_split || false,
      });

      const items = details.map(d => ({
        refNo: d.reference_number, 
        partNo: d.part_number, 
        description: d.description,
        hsn: d.hsn_code, 
        qty: getMongoNum(d.quantity), 
        rate: getMongoNum(d.unit_price), 
        amount: getMongoNum(d.quantity) * getMongoNum(d.unit_price) 
      }));
      
      setUploadedItems(items);
      setDetectedCurrency(shipment.currency || "USD");
      setViewMode("EDITOR");
    } catch (err) { 
      console.error(err);
      toast.error("Failed to load details"); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleSaveOnly = async () => {
    const buyerObj = companies.find(c => c._id === formData.buyer);
    let consigneeObj = formData.consigneeSameAsBuyer ? buyerObj : companies.find(c => c._id === formData.consignee);

    const payload = {
      ...formData,
      _id: currentShipmentId,
      buyer: buyerObj,
      consignee: consigneeObj,
      lineItems: uploadedItems,
      currencyLabel: detectedCurrency
    };

    try {
      toast.loading("Saving...");
      const result = await saveShipmentAPI(payload);
      toast.dismiss();
      if (result.success) {
        toast.success("Shipment Saved!");
        setCurrentShipmentId(result.shipmentId);
      } else {
        toast.error("Save failed");
      }
    } catch (err) {
      toast.dismiss();
      toast.error("Save failed");
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
    if (name === "consigneeSameAsBuyer" && checked) {
      setFormData(prev => ({ ...prev, consigneeSameAsBuyer: true, consignee: prev.buyer }));
    }
  };

  const handleSelectChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    if (name === "buyer" && formData.consigneeSameAsBuyer) {
      setFormData(prev => ({ ...prev, consignee: value }));
    }
  };

  const handleFileUpload = async (e) => {
    if (!e.target.files[0]) return;
    setLoading(true);
    const data = new FormData();
    data.append("excelFile", e.target.files[0]);
    try {
      const result = await uploadExcel(data);
      if (result.error) toast.error(result.error);
      else {
        setUploadedItems(result.items);
        setDetectedCurrency(result.currencyLabel);
        toast.success(`Loaded ${result.items.length} items.`);
      }
    } catch (err) { toast.error("Upload failed."); } finally { setLoading(false); }
  };

  const handleSaveCompany = async () => {
    if (!newCompany.name) return toast.error("Name required");
    try {
      const result = await createCompany(newCompany);
      if (result.success) {
        toast.success("Party saved!");
        setIsModalOpen(false);
        loadEssentials();
        setNewCompany({ name: "", address: "", gst_number: "", iec_code: "", pan_no: "" });
      } else toast.error(result.error);
    } catch (err) { toast.error("Failed to save party."); }
  };

  const generate = async (variant) => {
    if (uploadedItems.length === 0 && !variant.includes('letter')) return toast.warning("Upload Excel first.");
    const buyerObj = companies.find(c => c._id === formData.buyer);
    let consigneeObj = formData.consigneeSameAsBuyer ? buyerObj : companies.find(c => c._id === formData.consignee);
    
    const payload = { ...formData, buyer: buyerObj, consignee: consigneeObj, lineItems: uploadedItems, downloadVariant: variant, currencyLabel: detectedCurrency };

    try {
      toast.loading("Generating...");
      let blob;
      let filename;
      if (variant === 'working_excel') {
          blob = await generateWorkingExcelAPI(payload);
          filename = `Working_File_${formData.invoiceNumber}.xlsx`;
      } else {
          blob = await generateDocumentAPI(payload);
          filename = `Invoice_${formData.invoiceNumber}_${variant}.pdf`;
      }
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.dismiss();
      toast.success("Downloaded!");
    } catch (err) { toast.dismiss(); toast.error("Generation failed."); }
  };

  // NEW: Download All Letters
  const handleDownloadAllLetters = async () => {
    if (!formData.invoiceNumber) return toast.warning("Please enter Invoice Number first.");
    if (!formData.invoiceDate) return toast.warning("Please enter Invoice Date first.");
    
    const buyerObj = companies.find(c => c._id === formData.buyer);
    let consigneeObj = formData.consigneeSameAsBuyer ? buyerObj : companies.find(c => c._id === formData.consignee);
    
    const payload = { 
      ...formData, 
      buyer: buyerObj, 
      consignee: consigneeObj, 
      lineItems: uploadedItems, 
      currencyLabel: detectedCurrency 
    };

    try {
      toast.loading("Generating all letters...");
      const blob = await generateAllLettersAPI(payload);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `All_Letters_${formData.invoiceNumber}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.dismiss();
      toast.success("All letters downloaded!");
    } catch (err) { 
      toast.dismiss(); 
      toast.error("Failed to generate all letters."); 
    }
  };

  if (viewMode === "LIST") {
    return (
      <div className="space-y-6 p-6 max-w-7xl mx-auto">
        <div className="flex justify-between items-center">
          <div><h2 className="text-3xl font-bold text-primary flex items-center gap-2"><History className="h-8 w-8" /> Shipment History</h2></div>
          <Button onClick={handleCreateNew} size="lg"><Plus className="h-5 w-5 mr-2" /> Create New Shipment</Button>
        </div>

        {/* NEW: Filter and Sort Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex justify-between items-center">
              <CardTitle className="text-base flex items-center gap-2">
                <Filter className="h-5 w-5" /> Filters & Sort
              </CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
                  {showFilters ? "Hide" : "Show"} Filters
                </Button>
                {(filters.dateFrom || filters.dateTo || filters.quantityMin || filters.quantityMax || sortBy !== "created_at") && (
                  <Button variant="ghost" size="sm" onClick={clearFilters}>Clear</Button>
                )}
              </div>
            </div>
          </CardHeader>
          {showFilters && (
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Date From</Label>
                  <Input 
                    type="date" 
                    value={filters.dateFrom} 
                    onChange={(e) => handleFilterChange("dateFrom", e.target.value)} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Date To</Label>
                  <Input 
                    type="date" 
                    value={filters.dateTo} 
                    onChange={(e) => handleFilterChange("dateTo", e.target.value)} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Min Quantity</Label>
                  <Input 
                    type="number" 
                    placeholder="Min" 
                    value={filters.quantityMin} 
                    onChange={(e) => handleFilterChange("quantityMin", e.target.value)} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Quantity</Label>
                  <Input 
                    type="number" 
                    placeholder="Max" 
                    value={filters.quantityMax} 
                    onChange={(e) => handleFilterChange("quantityMax", e.target.value)} 
                  />
                </div>
              </div>
              <div className="flex items-center gap-4 pt-2 border-t">
                <Label>Sort By:</Label>
                <div className="flex gap-2">
                  <Button 
                    variant={sortBy === "date" ? "default" : "outline"} 
                    size="sm"
                    onClick={() => handleSortChange("date")}
                  >
                    Date {sortBy === "date" && (sortOrder === "asc" ? "↑" : "↓")}
                  </Button>
                  <Button 
                    variant={sortBy === "quantity" ? "default" : "outline"} 
                    size="sm"
                    onClick={() => handleSortChange("quantity")}
                  >
                    Quantity {sortBy === "quantity" && (sortOrder === "asc" ? "↑" : "↓")}
                  </Button>
                  <Button 
                    variant={sortBy === "created_at" ? "default" : "outline"} 
                    size="sm"
                    onClick={() => handleSortChange("created_at")}
                  >
                    Created {sortBy === "created_at" && (sortOrder === "asc" ? "↑" : "↓")}
                  </Button>
                </div>
              </div>
            </CardContent>
          )}
        </Card>

        <Card>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer" onClick={() => handleSortChange("invoice_number")}>
                    Invoice No {sortBy === "invoice_number" && (sortOrder === "asc" ? "↑" : "↓")}
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSortChange("date")}>
                    Date {sortBy === "date" && (sortOrder === "asc" ? "↑" : "↓")}
                  </TableHead>
                  <TableHead>Buyer</TableHead>
                  <TableHead>Port</TableHead>
                  <TableHead className="text-right cursor-pointer" onClick={() => handleSortChange("quantity")}>
                    Qty {sortBy === "quantity" && (sortOrder === "asc" ? "↑" : "↓")}
                  </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">Loading...</TableCell>
                  </TableRow>
                ) : shipmentList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No shipments found</TableCell>
                  </TableRow>
                ) : (
                  shipmentList.map((ship) => (
                    <TableRow key={ship._id} className="cursor-pointer hover:bg-slate-50" onClick={() => handleEditShipment(ship._id)}>
                      <TableCell className="font-medium">{ship.invoice_number}</TableCell>
                      <TableCell>{new Date(ship.invoice_date).toLocaleDateString()}</TableCell>
                      <TableCell>{ship.buyer_id?.name || 'Unknown'}</TableCell>
                      <TableCell>{ship.discharge_port || '-'}</TableCell>
                      <TableCell className="text-right">{ship.totalQuantity !== undefined ? ship.totalQuantity : getMongoNum(ship.package_count)}</TableCell>
                      <TableCell className="text-right"><Button variant="ghost" size="sm">Open</Button></TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    );
  }

  // EDITOR VIEW
  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setViewMode("LIST")}><ArrowLeft className="h-6 w-6" /></Button>
          <h2 className="text-3xl font-bold text-primary flex items-center gap-2">
            <FileText className="h-8 w-8" /> {formData.invoiceNumber ? `Edit: ${formData.invoiceNumber}` : "New Shipment"}
          </h2>
        </div>
        
        <Button onClick={handleSaveOnly} className="bg-green-600 hover:bg-green-700">
          <Save className="h-4 w-4 mr-2" /> Save Shipment
        </Button>
      </div>
      
      {/* 1. EXPORTER */}
      <Card className="bg-slate-50">
        <CardHeader className="pb-3"><CardTitle className="text-sm text-slate-500 uppercase">1. Exporter Details</CardTitle></CardHeader>
        <CardContent><p className="text-sm font-medium">Morsebiz Technology Services Pvt Ltd</p><p className="text-xs text-slate-600">20th Floor, Building No/Flat No – CTS No 95 4 B 3&4, 590 Oberoi Garden City, Goregaon East, Mumbai</p></CardContent>
      </Card>

      {/* 2. PARTIES */}
      <Card>
        <CardHeader className="pb-3 border-b"><CardTitle className="text-base font-bold">2. Parties</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-6 pt-6">
          <div className="space-y-2">
            <Label>Buyer</Label>
            <Select value={formData.buyer} onValueChange={(v) => handleSelectChange("buyer", v)}>
              <SelectTrigger><SelectValue placeholder="Select Buyer..." /></SelectTrigger>
              <SelectContent>{companies.map(c => <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between"><Label>Consignee</Label>
              <div className="flex items-center gap-2"><Checkbox id="same" checked={formData.consigneeSameAsBuyer} onCheckedChange={(chk) => setFormData(p => ({...p, consigneeSameAsBuyer: chk, consignee: chk ? p.buyer : ""}))} /><label htmlFor="same" className="text-xs cursor-pointer">Same as Buyer</label></div>
            </div>
            <Select value={formData.consignee} onValueChange={(v) => handleSelectChange("consignee", v)} disabled={formData.consigneeSameAsBuyer}>
              <SelectTrigger><SelectValue placeholder="Select Consignee..." /></SelectTrigger>
              <SelectContent>{companies.map(c => <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>CHA Agent Name</Label><Input name="chaAgent" value={formData.chaAgent} onChange={handleInputChange} /></div>
        </CardContent>
      </Card>

      {/* 3. INVOICE & LOGISTICS */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3 border-b"><CardTitle className="text-base font-bold">3. Invoice Details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 pt-4">
            <div className="space-y-2"><Label>Invoice No</Label><Input name="invoiceNumber" value={formData.invoiceNumber} onChange={handleInputChange} /></div>
            <div className="space-y-2"><Label>Date</Label><Input type="date" name="invoiceDate" value={formData.invoiceDate} onChange={handleInputChange} /></div>
            <div className="col-span-2 space-y-2"><Label>Terms Payment</Label><Input name="termsOfPayment" value={formData.termsOfPayment} onChange={handleInputChange} /></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3 border-b"><CardTitle className="text-base font-bold">4. Logistics</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 pt-4">
            <div className="space-y-2"><Label>Pre-Carriage</Label><Input name="preCarriageBy" value={formData.preCarriageBy} onChange={handleInputChange} /></div>
            <div className="space-y-2"><Label>Receipt Place</Label><Input name="placeOfReceipt" value={formData.placeOfReceipt} onChange={handleInputChange} /></div>
            <div className="space-y-2"><Label>Port Loading</Label><Input name="portOfLoading" value={formData.portOfLoading} onChange={handleInputChange} /></div>
            <div className="space-y-2"><Label>Port Discharge</Label><Input name="portOfDischarge" value={formData.portOfDischarge} onChange={handleInputChange} /></div>
            <div className="space-y-2"><Label>Dispatch From</Label>
              <Select name="dispatchLocation" value={formData.dispatchLocation} onValueChange={(v) => handleSelectChange("dispatchLocation", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="MUMBAI">Mumbai</SelectItem><SelectItem value="SOLAPUR">Solapur</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Delivery Terms</Label>
              <Select name="termsOfDelivery" value={formData.termsOfDelivery} onValueChange={(v) => handleSelectChange("termsOfDelivery", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="FOB">FOB</SelectItem><SelectItem value="EXW">EXW</SelectItem><SelectItem value="CFR">CFR</SelectItem><SelectItem value="CIF">CIF</SelectItem></SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3 border-b"><CardTitle className="text-base font-bold">5. Cargo & Financials</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-4 gap-4 pt-4">
          <div className="space-y-2"><Label>Packages</Label><Input name="numberOfPackages" value={formData.numberOfPackages} onChange={handleInputChange} /></div>
          <div className="space-y-2"><Label>Net Wt (Kg)</Label><Input name="totalNetWeight" value={formData.totalNetWeight} onChange={handleInputChange} /></div>
          <div className="space-y-2"><Label>Gross Wt (Kg)</Label><Input name="totalGrossWeight" value={formData.totalGrossWeight} onChange={handleInputChange} /></div>
          <div className="space-y-2"><Label>Freight</Label><Input name="freightCharges" value={formData.freightCharges} onChange={handleInputChange} /></div>
          <div className="space-y-2"><Label>Insurance</Label><Input name="insuranceCharges" value={formData.insuranceCharges} onChange={handleInputChange} /></div>
          <div className="col-span-3 flex items-center gap-2 pt-8 pl-4">
            <Checkbox id="split" checked={formData.splitFobFreight} onCheckedChange={(c) => setFormData(p => ({...p, splitFobFreight: c}))} />
            <div><Label htmlFor="split">Split FOB Freight?</Label><p className="text-xs text-muted-foreground">PDF shows total only. Excel shows split details.</p></div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-dashed border-2">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-base flex items-center gap-2"><Upload className="h-5 w-5"/> Line Items</CardTitle>
            <Button variant="outline" size="sm" onClick={downloadSampleFile}><Download className="h-4 w-4 mr-2" /> Sample</Button>
          </div>
        </CardHeader>
        <CardContent>
          <Input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} />
          {uploadedItems.length > 0 && (
            <div className="mt-4 border rounded overflow-hidden max-h-60 overflow-auto">
              <Table>
                <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Ref</TableHead><TableHead>Part</TableHead><TableHead>Desc</TableHead><TableHead>Qty</TableHead><TableHead>Rate</TableHead><TableHead>Amt</TableHead></TableRow></TableHeader>
                <TableBody>
                  {uploadedItems.slice(0, 50).map((item, i) => (
                    <TableRow key={i}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell>{item.refNo}</TableCell>
                      <TableCell>{item.partNo}</TableCell>
                      <TableCell className="max-w-[150px] truncate">{item.description}</TableCell>
                      <TableCell>{getMongoNum(item.qty)}</TableCell>
                      <TableCell>{getMongoNum(item.rate)}</TableCell>
                      <TableCell>{(getMongoNum(item.amount) || 0).toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="bg-slate-900 text-white">
          <CardHeader><CardTitle>Generate</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            <Button variant="secondary" className="w-full h-12" onClick={() => generate('commercial_invoice')}>Generate Commercial Invoice (PDF)</Button>
            <Button variant="outline" className="w-full text-black bg-white" onClick={() => generate('working_excel')}><FileSpreadsheet className="h-4 w-4 mr-2 text-green-600"/> Working Excel</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Letters</CardTitle>
              {/* NEW: Download All Letters Button */}
              <Button 
                variant="default" 
                size="sm" 
                onClick={handleDownloadAllLetters}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Archive className="h-4 w-4 mr-2" /> Download All
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => generate('cha_letter')}>CHA</Button>
            <Button variant="outline" onClick={() => generate('evd_letter')}>EVD</Button>
            <Button variant="outline" onClick={() => generate('non_vintage_letter')}>Non-Vint</Button>
            <Button variant="outline" onClick={() => generate('scomet_letter')}>SCOMET</Button>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Party</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Name" value={newCompany.name} onChange={e => setNewCompany({...newCompany, name: e.target.value})} />
            <Input placeholder="Address" value={newCompany.address} onChange={e => setNewCompany({...newCompany, address: e.target.value})} />
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="GST" value={newCompany.gst_number} onChange={e => setNewCompany({...newCompany, gst_number: e.target.value})} />
              <Input placeholder="IEC" value={newCompany.iec_code} onChange={e => setNewCompany({...newCompany, iec_code: e.target.value})} />
            </div>
            <Input placeholder="PAN" value={newCompany.pan_no} onChange={e => setNewCompany({...newCompany, pan_no: e.target.value})} />
          </div>
          <DialogFooter><Button onClick={handleSaveCompany}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
