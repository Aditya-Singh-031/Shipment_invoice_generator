// Add these functions to your lib/api.ts file

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

export async function getShipments(queryParams?: string) {
  const url = queryParams ? `${API_BASE}/shipments?${queryParams}` : `${API_BASE}/shipments`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch shipments');
  return res.json();
}

export async function getShipmentById(id: string) {
  const res = await fetch(`${API_BASE}/shipments/${id}`);
  if (!res.ok) throw new Error('Failed to fetch shipment');
  return res.json();
}

export async function saveShipmentAPI(payload: any) {
  const res = await fetch(`${API_BASE}/shipments/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to save shipment');
  return res.json();
}

export async function generateDocumentAPI(payload: any) {
  const res = await fetch(`${API_BASE}/generate/invoice`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const error = await res.text();
    throw new Error(error || 'Generation failed');
  }
  return res.blob();
}

export async function generateWorkingExcelAPI(payload: any) {
  const res = await fetch(`${API_BASE}/generate/working-excel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to generate Excel');
  return res.blob();
}

// NEW: Download All Letters as ZIP
export async function generateAllLettersAPI(payload: any) {
  const res = await fetch(`${API_BASE}/generate/all-letters`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const error = await res.text();
    throw new Error(error || 'Failed to generate all letters');
  }
  return res.blob();
}

// Existing functions (keep these if you already have them)
export async function getCompanies() {
  const res = await fetch(`${API_BASE}/companies`);
  if (!res.ok) throw new Error('Failed to fetch companies');
  return res.json();
}

export async function createCompany(data: any) {
  const res = await fetch(`${API_BASE}/companies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create company');
  return res.json();
}

export async function uploadExcel(formData: FormData) {
  const res = await fetch(`${API_BASE}/upload-excel`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error('Upload failed');
  return res.json();
}

export async function downloadSampleFile() {
  const res = await fetch(`${API_BASE}/download-sample`);
  if (!res.ok) throw new Error('Failed to download sample');
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Import_Template.xlsx';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
