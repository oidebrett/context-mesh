import { nango } from '../nango.js';
import { createRequire } from 'module';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink } from 'fs/promises';
import path from 'path';
import os from 'os';

const require = createRequire(import.meta.url);
const execAsync = promisify(exec);

/**
 * MIME types for Google Docs, Sheets, and Slides
 */
const GOOGLE_DOC_MIME_TYPES = [
    'application/vnd.google-apps.document',
    'application/vnd.google-apps.spreadsheet',
    'application/vnd.google-apps.presentation'
];

/**
 * MIME type mapping for Google Drive export formats
 * Maps Google Workspace MIME types to exportable formats
 */
const GOOGLE_EXPORT_MIME_TYPES: Record<string, string> = {
    'application/vnd.google-apps.document': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.google-apps.spreadsheet': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.google-apps.presentation': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    // Fallback to plain text for other Google Workspace types
    'application/vnd.google-apps.script': 'text/plain',
    'application/vnd.google-apps.form': 'text/plain'
};

/**
 * Check if a file is a Google Doc/Sheet/Slide
 */
export function isGoogleDocument(mimeType: string | null): boolean {
    if (!mimeType) return false;
    return GOOGLE_DOC_MIME_TYPES.includes(mimeType);
}

/**
 * Check if a file is a OneDrive document
 */
export function isOneDriveDocument(provider: string, mimeType: string | null): boolean {
    if (provider !== 'one-drive') return false;
    if (!mimeType) return false;
    
    // OneDrive document types
    const oneDriveDocTypes = [
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/msword',
        'application/vnd.ms-excel',
        'application/vnd.ms-powerpoint'
    ];
    
    return oneDriveDocTypes.includes(mimeType);
}

/**
 * Fetch a Google Drive document using Nango SDK and return its content as Buffer
 */
async function fetchGoogleDriveDocument(
    connectionId: string,
    fileId: string,
    mimeType: string
): Promise<Buffer | null> {
    try {
        console.log(`Fetching Google Drive document: ${fileId} (${mimeType})`);

        // Determine export MIME type
        const exportMimeType = GOOGLE_EXPORT_MIME_TYPES[mimeType] || 'text/plain';

        // Use the Nango SDK to fetch via proxy
        // For Google Workspace files, use the export endpoint
        // Set decompress: false and responseType: 'arraybuffer' to get binary data
        const response = await nango.get({
            endpoint: `/drive/v3/files/${fileId}/export`,
            params: {
                mimeType: exportMimeType
            },
            providerConfigKey: 'google-drive',
            connectionId: connectionId,
            retries: 3,
            decompress: false,
            responseType: 'arraybuffer'
        });

        if (!response || !response.data) {
            console.error(`Failed to fetch Google Drive document ${fileId}: No data returned`);
            console.error('Response:', JSON.stringify(response, null, 2));
            return null;
        }

        console.log(`Response data type: ${typeof response.data}`);
        console.log(`Response data is Buffer: ${Buffer.isBuffer(response.data)}`);
        console.log(`Response data is Array: ${Array.isArray(response.data)}`);
        console.log(`Response data is ArrayBuffer: ${response.data instanceof ArrayBuffer}`);

        // Handle different response types
        let buffer: Buffer;

        if (Buffer.isBuffer(response.data)) {
            console.log(`Response data is already a Buffer, length: ${response.data.length}`);
            buffer = response.data;
        } else if (response.data instanceof ArrayBuffer) {
            console.log(`Response data is ArrayBuffer, byteLength: ${response.data.byteLength}`);
            buffer = Buffer.from(response.data);
        } else if (Array.isArray(response.data)) {
            console.log(`Response data is array, length: ${response.data.length}`);
            buffer = Buffer.from(response.data);
        } else if (ArrayBuffer.isView(response.data)) {
            console.log(`Response data is typed array, byteLength: ${response.data.byteLength}`);
            buffer = Buffer.from(response.data.buffer, response.data.byteOffset, response.data.byteLength);
        } else if (typeof response.data === 'string') {
            console.log(`Response data is string, length: ${response.data.length}`);
            // If it's a string, it might be base64 encoded or binary string
            // Try to detect if it's base64
            if (/^[A-Za-z0-9+/]+=*$/.test(response.data.substring(0, 100))) {
                console.log(`Looks like base64, decoding...`);
                buffer = Buffer.from(response.data, 'base64');
            } else {
                console.log(`Treating as binary string (latin1)...`);
                buffer = Buffer.from(response.data, 'latin1');
            }
        } else {
            console.warn(`Unexpected response data type: ${typeof response.data}, stringifying`);
            buffer = Buffer.from(JSON.stringify(response.data), 'utf-8');
        }

        console.log(`Final buffer length: ${buffer.length}`);
        console.log(`First 50 bytes (hex): ${buffer.subarray(0, 50).toString('hex')}`);

        return buffer;
    } catch (error) {
        console.error(`Failed to fetch Google Drive document ${fileId}:`, error);
        return null;
    }
}

/**
 * Fetch a OneDrive document using Nango SDK and return its content as Buffer
 */
async function fetchOneDriveDocument(
    connectionId: string,
    driveId: string,
    itemId: string
): Promise<Buffer | null> {
    try {
        console.log(`Fetching OneDrive document: driveId=${driveId}, itemId=${itemId}`);

        // Use the Nango SDK to fetch via proxy
        // OneDrive API: GET /drives/{drive-id}/items/{item-id}/content
        // Set decompress: false and responseType: 'arraybuffer' to get binary data
        const response = await nango.get({
            endpoint: `/drives/${driveId}/items/${itemId}/content`,
            providerConfigKey: 'one-drive',
            connectionId: connectionId,
            retries: 3,
            decompress: false,
            responseType: 'arraybuffer'
        });

        if (!response || !response.data) {
            console.error(`Failed to fetch OneDrive document driveId=${driveId}, itemId=${itemId}: No data returned`);
            return null;
        }

        // Convert response to Buffer (same logic as Google Drive)
        let buffer: Buffer;

        if (Buffer.isBuffer(response.data)) {
            buffer = response.data;
        } else if (response.data instanceof ArrayBuffer) {
            buffer = Buffer.from(response.data);
        } else if (Array.isArray(response.data)) {
            buffer = Buffer.from(response.data);
        } else if (ArrayBuffer.isView(response.data)) {
            buffer = Buffer.from(response.data.buffer, response.data.byteOffset, response.data.byteLength);
        } else if (typeof response.data === 'string') {
            // Try latin1 encoding for binary strings
            buffer = Buffer.from(response.data, 'latin1');
        } else {
            buffer = Buffer.from(JSON.stringify(response.data), 'utf-8');
        }

        console.log(`OneDrive buffer length: ${buffer.length}`);
        return buffer;
    } catch (error) {
        console.error(`Failed to fetch OneDrive document driveId=${driveId}, itemId=${itemId}:`, error);
        return null;
    }
}

/**
 * Extract text from Office Open XML documents (docx, xlsx, pptx)
 */
async function extractTextFromOfficeDoc(buffer: Buffer, mimeType: string): Promise<string> {
    try {
        console.log(`Extracting text from Office doc, MIME type: ${mimeType}, buffer length: ${buffer.length}`);

        // For Word documents, extract text from document.xml
        if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            const tempFile = path.join(os.tmpdir(), `doc-${Date.now()}.docx`);
            console.log(`Writing buffer to temp file: ${tempFile}`);
            await writeFile(tempFile, buffer);

            try {
                console.log(`Executing unzip command on ${tempFile}`);
                const { stdout, stderr } = await execAsync(`unzip -p "${tempFile}" word/document.xml | sed -e 's/<[^>]*>/ /g' | tr -s ' '`);

                if (stderr) {
                    console.log(`Stderr from unzip:`, stderr);
                }

                console.log(`Extracted text length: ${stdout.length}`);
                console.log(`Extracted text preview: ${stdout.substring(0, 200)}`);

                await unlink(tempFile);
                return stdout.trim();
            } catch (error) {
                console.error(`Error during unzip/extraction:`, error);
                await unlink(tempFile).catch(() => {});
                throw error;
            }
        }

        // For other Office formats or if extraction fails, try to decode as UTF-8
        console.log(`Not a Word doc, decoding as UTF-8`);
        const text = buffer.toString('utf-8');
        console.log(`Decoded text length: ${text.length}, preview: ${text.substring(0, 200)}`);
        return text;
    } catch (error) {
        console.error('Failed to extract text from Office document:', error);
        // Fallback: try to decode as UTF-8
        const fallbackText = buffer.toString('utf-8');
        console.log(`Fallback text length: ${fallbackText.length}`);
        return fallbackText;
    }
}

/**
 * Summarize document content from a Buffer
 */
async function summarizeDocument(buffer: Buffer, mimeType: string, numSentences: number = 3): Promise<string> {
    try {
        console.log(`Summarizing document, MIME type: ${mimeType}, buffer length: ${buffer.length}`);

        // Extract text based on MIME type
        let text: string;

        if (mimeType.includes('wordprocessingml') || mimeType.includes('spreadsheetml') || mimeType.includes('presentationml')) {
            console.log(`Extracting text from Office document`);
            text = await extractTextFromOfficeDoc(buffer, mimeType);
        } else {
            // For plain text or other formats, decode as UTF-8
            console.log(`Decoding as plain text`);
            text = buffer.toString('utf-8');
        }

        console.log(`Extracted text length: ${text.length}`);
        console.log(`Extracted text preview: ${text.substring(0, 300)}`);

        if (!text || text.trim().length === 0) {
            console.warn(`No text extracted from document`);
            return '';
        }

        // Use require to load CommonJS module
        console.log(`Loading summarizer with ${numSentences} sentences`);
        const { SummarizerManager } = require('node-summarizer');

        const mgr = new SummarizerManager(text, numSentences);
        const resultObj = await mgr.getSummaryByRank();

        console.log(`Summary result:`, resultObj);
        console.log(`Summary text: ${resultObj.summary || '(empty)'}`);

        return resultObj.summary || '';
    } catch (error) {
        console.error('Failed to summarize document:', error);
        return '';
    }
}

/**
 * Fetch and summarize a document from a cloud provider
 * Returns an object with description and summary fields
 */
export async function fetchAndSummarizeDocument(
    provider: string,
    connectionId: string,
    externalId: string,
    mimeType: string | null,
    metadataRaw: any
): Promise<{ description: string | null; summary: string | null }> {
    console.log(`Fetching and summarizing document: ${provider}/${externalId}`);
    console.log(`MIME type: ${mimeType}`);

    let documentBuffer: Buffer | null = null;
    let exportMimeType: string = mimeType || 'text/plain';

    // Fetch document based on provider
    if (provider === 'google-drive' && mimeType && isGoogleDocument(mimeType)) {
        console.log(`Fetching Google Drive document`);
        documentBuffer = await fetchGoogleDriveDocument(connectionId, externalId, mimeType);
        // Update MIME type to the export format
        exportMimeType = GOOGLE_EXPORT_MIME_TYPES[mimeType] || 'text/plain';
        console.log(`Export MIME type: ${exportMimeType}`);
    } else if (provider === 'one-drive' && isOneDriveDocument(provider, mimeType)) {
        console.log(`Fetching OneDrive document`);
        // Extract driveId and itemId from metadata
        const driveId = metadataRaw?.driveId || metadataRaw?.parentReference?.driveId;
        const itemId = externalId;

        if (driveId) {
            documentBuffer = await fetchOneDriveDocument(connectionId, driveId, itemId);
        } else {
            console.warn(`No driveId found in metadata for OneDrive file ${itemId}`);
        }
    }

    // If we couldn't fetch the document, return nulls
    if (!documentBuffer) {
        console.warn(`No document buffer retrieved for ${provider}/${externalId}`);
        return { description: null, summary: null };
    }

    console.log(`Document buffer retrieved, length: ${documentBuffer.length}`);

    // Summarize the document
    const summary = await summarizeDocument(documentBuffer, exportMimeType, 5);

    console.log(`Final summary length: ${summary?.length || 0}`);
    console.log(`Final summary: ${summary || '(empty)'}`);

    return {
        description: summary || null,
        summary: summary || null
    };
}

