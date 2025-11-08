import type { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { extname } from "node:path";

/**
 * Simple MIME type detection based on file extension
 * Common types for email attachments
 */
const MIME_TYPES: Record<string, string> = {
    // Images
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".bmp": "image/bmp",
    ".ico": "image/x-icon",

    // Documents
    ".pdf": "application/pdf",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".ppt": "application/vnd.ms-powerpoint",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".odt": "application/vnd.oasis.opendocument.text",
    ".ods": "application/vnd.oasis.opendocument.spreadsheet",
    ".odp": "application/vnd.oasis.opendocument.presentation",

    // Text
    ".txt": "text/plain",
    ".csv": "text/csv",
    ".html": "text/html",
    ".htm": "text/html",
    ".css": "text/css",
    ".js": "text/javascript",
    ".json": "application/json",
    ".xml": "application/xml",

    // Archives
    ".zip": "application/zip",
    ".tar": "application/x-tar",
    ".gz": "application/gzip",
    ".rar": "application/vnd.rar",
    ".7z": "application/x-7z-compressed",

    // Other
    ".rtf": "application/rtf",
    ".mp3": "audio/mpeg",
    ".mp4": "video/mp4",
    ".avi": "video/x-msvideo",
};

/**
 * Detect MIME type from filename
 * @param filename - The filename or path
 * @returns MIME type or application/octet-stream as fallback
 */
export const detectMimeType = (filename: string): string => {
    const ext = extname(filename).toLowerCase();
    return MIME_TYPES[ext] || "application/octet-stream";
};

/**
 * Generate a Content-ID for inline attachments
 * @param filename - The filename to generate CID from
 * @returns A unique Content-ID string
 */
export const generateContentId = (filename: string): string => {
    const name = filename.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
    const random = Math.random().toString(36).substring(2, 9);
    return `${name}-${random}@email`;
};

/**
 * Read file and return its content as Buffer
 * @param filePath - Path to the file
 * @returns Buffer containing file content
 */
export const readFileAsBuffer = async (filePath: string): Promise<Buffer> => {
    return readFile(filePath);
};

/**
 * Attachment options for helper methods
 */
export interface AttachmentOptions {
    /**
     * MIME type of the attachment
     * If not provided, will be detected from filename
     */
    contentType?: string;

    /**
     * Disposition type: 'attachment' (default) or 'inline'
     */
    disposition?: "attachment" | "inline";

    /**
     * Content-ID for inline attachments (used in HTML with cid:)
     * If not provided and disposition is 'inline', will be auto-generated
     */
    cid?: string;

    /**
     * Custom filename (if different from the file path)
     */
    filename?: string;
}

/**
 * Attachment data options (for raw data attachments)
 */
export interface AttachmentDataOptions extends AttachmentOptions {
    /**
     * Filename for the attachment
     */
    filename: string;
}
