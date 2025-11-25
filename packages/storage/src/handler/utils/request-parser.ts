import type { IncomingMessage } from "node:http";

import createHttpError from "http-errors";
import { hasBody } from "type-is";

import type { FileInit } from "../../storage/utils/file";
import { getHeader } from "../../utils/http";

/**
 * Parses metadata from X-File-Metadata header.
 * @param request The HTTP request
 * @param existingMetadata Existing metadata to merge with (optional)
 * @returns Parsed metadata object
 */
export const parseMetadata = (request: IncomingMessage, existingMetadata: Record<string, unknown> = {}): Record<string, unknown> => {
    const metadataHeader = getHeader(request, "x-file-metadata", true);

    if (!metadataHeader) {
        return existingMetadata;
    }

    try {
        return { ...existingMetadata, ...JSON.parse(metadataHeader) };
    } catch {
        // Ignore invalid JSON, return existing metadata
        return existingMetadata;
    }
};

/**
 * Parses filename from Content-Disposition header value string.
 * Uses a safer parsing approach to avoid ReDoS vulnerabilities.
 * @param contentDisposition The Content-Disposition header value
 * @returns Filename if found, undefined otherwise
 */
export const parseContentDispositionValue = (contentDisposition: string | null | undefined): string | undefined => {
    if (!contentDisposition) {
        return undefined;
    }

    // Safer parsing to avoid ReDoS: find "filename" or "filename*" and extract value
    // Limit search to prevent excessive backtracking
    const maxSearchLength = 2000; // Reasonable limit for header values
    const searchString = contentDisposition.length > maxSearchLength ? contentDisposition.slice(0, Math.max(0, maxSearchLength)) : contentDisposition;

    // Find "filename" or "filename*" (case-insensitive)
    const filenameIndex = searchString.toLowerCase().indexOf("filename");

    if (filenameIndex === -1) {
        return undefined;
    }

    // Find the "=" sign after "filename" (skip optional whitespace and asterisk)
    let equalsIndex = filenameIndex + 8; // "filename" is 8 chars

    // Skip optional asterisk and whitespace
    while (equalsIndex < searchString.length && (searchString[equalsIndex] === "*" || searchString[equalsIndex] === " " || searchString[equalsIndex] === "\t")) {
        equalsIndex++;
    }

    if (equalsIndex >= searchString.length || searchString[equalsIndex] !== "=") {
        return undefined;
    }

    equalsIndex++; // Skip the "="

    // Skip whitespace after "="
    while (equalsIndex < searchString.length && (searchString[equalsIndex] === " " || searchString[equalsIndex] === "\t")) {
        equalsIndex++;
    }

    if (equalsIndex >= searchString.length) {
        return undefined;
    }

    // Extract the value (quoted or unquoted)
    let valueStart = equalsIndex;
    let valueEnd: number;
    const firstChar = searchString[equalsIndex];

    if (firstChar === "\"" || firstChar === "'") {
        // Quoted value: find matching quote
        valueStart = equalsIndex + 1;
        valueEnd = searchString.indexOf(firstChar, valueStart);

        if (valueEnd === -1) {
            // Unclosed quote, use rest of string up to semicolon or end
            valueEnd = searchString.indexOf(";", valueStart);

            if (valueEnd === -1) {
                valueEnd = searchString.length;
            }
        }
    } else {
        // Unquoted value: find semicolon or end of string
        valueEnd = searchString.indexOf(";", valueStart);

        if (valueEnd === -1) {
            valueEnd = searchString.length;
        }
    }

    if (valueStart >= valueEnd) {
        return undefined;
    }

    const filename = searchString.substring(valueStart, valueEnd).trim();

    return filename || undefined;
};

/**
 * Parses filename from Content-Disposition header.
 * Uses a safer parsing approach to avoid ReDoS vulnerabilities.
 * @param request The HTTP request
 * @returns Filename if found, undefined otherwise
 */
export const parseContentDisposition = (request: IncomingMessage): string | undefined => {
    const contentDisposition = getHeader(request, "content-disposition", true);

    return parseContentDispositionValue(contentDisposition);
};

/**
 * Parses chunked upload headers (X-Chunk-Offset, X-Total-Size, etc.).
 * @param request The HTTP request
 * @returns Object with chunk offset, total size, and chunked upload flag
 */
export const parseChunkHeaders = (
    request: IncomingMessage,
): {
    chunkOffset?: number;
    isChunkedUpload: boolean;
    totalSize?: number;
} => {
    const isChunkedUpload = getHeader(request, "x-chunked-upload", true) === "true";
    const chunkOffsetHeader = getHeader(request, "x-chunk-offset", true);
    const totalSizeHeader = getHeader(request, "x-total-size", true);

    const result: {
        chunkOffset?: number;
        isChunkedUpload: boolean;
        totalSize?: number;
    } = {
        isChunkedUpload,
    };

    if (chunkOffsetHeader) {
        const offset = Number.parseInt(chunkOffsetHeader, 10);

        if (!Number.isNaN(offset) && offset >= 0) {
            result.chunkOffset = offset;
        }
    }

    if (totalSizeHeader) {
        const size = Number.parseInt(totalSizeHeader, 10);

        if (!Number.isNaN(size) && size > 0) {
            result.totalSize = size;
        }
    }

    return result;
};

/**
 * Validates that a request has a body.
 * @param request The HTTP request
 * @param allowEmptyForChunked Whether to allow empty body for chunked uploads
 * @throws {HttpError} If body is required but missing
 */
export const validateRequestBody = (request: IncomingMessage, allowEmptyForChunked = false): void => {
    const isChunkedUpload = getHeader(request, "x-chunked-upload", true) === "true";

    if (allowEmptyForChunked && isChunkedUpload) {
        return; // Chunked uploads can have empty body for initialization
    }

    // Check if request has a body using type-is
    if (!hasBody(request)) {
        throw createHttpError(400, "Request body is required");
    }

    // Also check Content-Length header to ensure body is not empty
    const contentLength = Number.parseInt(getHeader(request, "content-length") || "0", 10);

    if (contentLength === 0 && !isChunkedUpload) {
        throw createHttpError(400, "Content-Length is required and must be greater than 0");
    }
};

/**
 * Validates Content-Length header.
 * @param request The HTTP request
 * @param allowZeroForChunked Whether to allow zero length for chunked uploads
 * @param maxSize Maximum allowed size
 * @returns Parsed content length
 * @throws {HttpError} If Content-Length is invalid or exceeds max size
 */
export const validateContentLength = (request: IncomingMessage, allowZeroForChunked = false, maxSize?: number): number => {
    const isChunkedUpload = getHeader(request, "x-chunked-upload", true) === "true";
    const contentLength = Number.parseInt(getHeader(request, "content-length") || "0", 10);

    // For chunked uploads, Content-Length can be 0 (initialization)
    // For regular uploads, Content-Length must be greater than 0
    if (!allowZeroForChunked && !isChunkedUpload && contentLength === 0) {
        throw createHttpError(400, "Content-Length is required and must be greater than 0");
    }

    if (maxSize !== undefined && contentLength > maxSize) {
        throw createHttpError(413, `File size exceeds maximum allowed size of ${maxSize} bytes`);
    }

    return contentLength;
};

/**
 * Extracts file initialization config from request headers.
 * @param request The HTTP request
 * @param contentLength The content length (already validated)
 * @param contentType The content type (default: application/octet-stream)
 * @returns FileInit configuration object
 */
export const extractFileInit = (request: IncomingMessage, contentLength: number, contentType = "application/octet-stream"): FileInit => {
    const originalName = parseContentDisposition(request);
    const metadata = parseMetadata(request);
    const { isChunkedUpload, totalSize } = parseChunkHeaders(request);

    const fileSize = isChunkedUpload && totalSize ? totalSize : contentLength;

    // For chunked uploads, store chunk tracking info in metadata
    if (isChunkedUpload && totalSize) {
        metadata._chunkedUpload = true;
        metadata._chunks = []; // Array to track received chunks: [{ offset, length }]
        metadata._totalSize = totalSize;
    }

    return {
        contentType,
        metadata,
        originalName,
        size: fileSize,
    };
};

/**
 * Validates chunk offset and size for chunked uploads.
 * @param chunkOffset The chunk offset
 * @param contentLength The chunk content length
 * @param totalSize The total file size
 * @throws {HttpError} If validation fails
 */
export const validateChunk = (chunkOffset: number, contentLength: number, totalSize: number): void => {
    if (Number.isNaN(chunkOffset) || chunkOffset < 0) {
        throw createHttpError(400, "X-Chunk-Offset must be a valid non-negative number");
    }

    if (chunkOffset + contentLength > totalSize) {
        throw createHttpError(400, `Chunk exceeds file size. Offset: ${chunkOffset}, Size: ${contentLength}, Total: ${totalSize}`);
    }
};

/**
 * Gets content type from request headers with fallback.
 * @param request The HTTP request
 * @param fallback Default content type if not found (default: application/octet-stream)
 * @returns Content type string
 */
export const getContentType = (request: IncomingMessage, fallback = "application/octet-stream"): string => getHeader(request, "content-type") || fallback;
