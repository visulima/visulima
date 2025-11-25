import type { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";

import mime from "mime";

/**
 * Detect MIME type from filename using mime package
 * Falls back to application/octet-stream if not found
 * @param filename The filename or path
 * @returns MIME type or application/octet-stream as fallback
 */
export const detectMimeType = (filename: string): string => mime.getType(filename) || "application/octet-stream";

/**
 * Generate a Content-ID for inline attachments
 * @param filename The filename to generate CID from
 * @returns A unique Content-ID string
 */
export const generateContentId = (filename: string): string => {
    const name = filename.replaceAll(/[^a-z0-9]/gi, "-").replaceAll(/-+/g, "-").replaceAll(/^-|-$/g, "").toLowerCase();
    const random = Math.random().toString(36).slice(2, 9);

    return `${name}-${random}@email`;
};

/**
 * Read file and return its content as Buffer
 * @param filePath Path to the file
 * @returns Buffer containing file content
 */
export const readFileAsBuffer = async (filePath: string): Promise<Buffer> => readFile(filePath);

/**
 * Attachment options for helper methods
 */
export interface AttachmentOptions {
    /**
     * Content-ID for inline attachments (used in HTML with cid:)
     * If not provided and contentDisposition is 'inline', will be auto-generated
     */
    cid?: string;

    /**
     * Content disposition: 'attachment' (default) or 'inline'
     */
    contentDisposition?: "attachment" | "inline";

    /**
     * MIME type of the attachment
     * If not provided, will be detected from filename
     */
    contentType?: string;

    /**
     * Content transfer encoding (e.g., 'base64', '7bit', 'quoted-printable')
     */
    encoding?: string;

    /**
     * Custom filename (if different from the file path)
     */
    filename?: string;

    /**
     * Custom headers for this attachment
     */
    headers?: Record<string, string>;
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
