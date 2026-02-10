const { BlobServiceClient } = require('@azure/storage-blob');
const fs = require('fs');
const path = require('path');

// Initialize Client
const AZURE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
const CONTAINER_NAME = process.env.AZURE_CONTAINER_NAME || 'images'; // e.g., imagesmay2025
const FOLDER_PREFIX = 'inventory-folder'; // The "folder" inside the container

let blobServiceClient;
let containerClient;

try {
    if (AZURE_CONNECTION_STRING) {
        blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_CONNECTION_STRING);
        containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);
    }
} catch (err) {
    console.error("⚠️ Azure Blob Storage setup failed. Check connection string.");
}

/**
 * Uploads a local file to Azure Blob Storage
 * @param {string} localFilePath - Path to the file on disk
 * @param {string} originalFileName - Original name of the file
 * @param {string} mimeType - File MIME type (e.g. image/png)
 */
async function uploadToAzure(localFilePath, originalFileName, mimeType) {
    if (!containerClient) throw new Error("Azure Storage not configured.");

    // Ensure container exists
    const exists = await containerClient.exists();
    if (!exists) await containerClient.create();

    // Create unique filename with folder prefix
    // Result: inventory-folder/123456789-myimage.png
    const uniqueName = `${Date.now()}-${originalFileName}`; 
    const blobName = `${FOLDER_PREFIX}/${uniqueName}`;
    
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    // Read file buffer
    const fileBuffer = fs.readFileSync(localFilePath);

    // Upload
    await blockBlobClient.upload(fileBuffer, fileBuffer.length, {
        blobHTTPHeaders: { blobContentType: mimeType }
    });

    // Return the public URL
    return blockBlobClient.url;
}

module.exports = { uploadToAzure };