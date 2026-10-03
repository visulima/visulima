import type { IncomingMessage } from "node:http";

import createHttpError from "http-errors";
import { hasBody } from "type-is";

import type { FileInit } from "../../storage/utils/file";
import { getHeader } from "../../utils/http";

/**
 * Reads a request header by (lower-case) name. Lets the Node and Fetch handlers share header parsing.
 */
export type HeaderReader = (name: string) => string | null | undefined;

/**
 * Parses a header value that must be a non-negative decimal integer.
 * Unlike `Number.parseInt`, trailing garbage (`"12abc"`), signs and fractions are rejected.
 * @param value Raw header value
 * @returns The parsed integer, or `undefined` when the header is missing or malformed
 */
export const parseIntegerHeader = (value: string | null | undefined): number | undefined => {
    const trimmed = value?.trim();

    if (!trimmed || !/^\d+$/.test(trimmed)) {
        return undefined;
    }

    const parsed = Number(trimmed);

    return Number.isSafeInteger(parsed) ? parsed : undefined;
};

/**
 * Parses a `Content-Length` header that is required to be a positive integer.
 * @param value Raw header value
 * @returns The content length
 * @throws {HttpError} 400 when the header is missing, malformed or zero
 */
export const requirePositiveContentLength = (value: string | null | undefined): number => {
    const contentLength = parseIntegerHeader(value);

    if (contentLength === undefined || contentLength === 0) {
        throw createHttpError(400, "Content-Length is required and must be greater than 0");
    }

    return contentLength;
};

/**
 * Parses the `X-File-Metadata` header. Only JSON objects are accepted; invalid JSON,
 * `null`, arrays and primitives yield `undefined`.
 * @param value Raw header value
 * @returns The metadata object, or `undefined` when the header is missing or not a JSON object
 */
export const parseMetadataHeader = (value: string | null | undefined): Record<string, unknown> | undefined => {
    if (!value) {
        return undefined;
    }

    try {
        const parsed: unknown = JSON.parse(value);

        if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
            return { ...(parsed as Record<string, unknown>) };
        }
    } catch {
        // Ignore invalid JSON
    }

    return undefined;
};

/**
 * Parses metadata from X-File-Metadata header.
 * @param request The HTTP request
 * @param existingMetadata Existing metadata to merge with (optional)
 * @returns Parsed metadata object
 */
export const parseMetadata = (request: IncomingMessage, existingMetadata: Record<string, unknown> = {}): Record<string, unknown> => {
    const metadata = parseMetadataHeader(getHeader(request, "x-file-metadata", true));

    return metadata ? { ...existingMetadata, ...metadata } : existingMetadata;
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
    while (
        equalsIndex < searchString.length &&
        (searchString[equalsIndex] === "*" || searchString[equalsIndex] === " " || searchString[equalsIndex] === "\t")
    ) {
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

    if (firstChar === '"' || firstChar === "'") {
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
 * @param readHeader Reads a request header by name
 * @returns Object with chunk offset, total size, and chunked upload flag
 */
export const parseChunkHeaders = (
    readHeader: HeaderReader,
): {
    chunkOffset?: number;
    isChunkedUpload: boolean;
    totalSize?: number;
} => {
    const totalSize = parseIntegerHeader(readHeader("x-total-size"));

    return {
        chunkOffset: parseIntegerHeader(readHeader("x-chunk-offset")),
        isChunkedUpload: readHeader("x-chunked-upload") === "true",
        totalSize: totalSize === 0 ? undefined : totalSize,
    };
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
    if (!isChunkedUpload) {
        requirePositiveContentLength(getHeader(request, "content-length"));
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
    const contentLengthHeader = getHeader(request, "content-length");
    const contentLength = parseIntegerHeader(contentLengthHeader) ?? 0;

    if (contentLengthHeader && parseIntegerHeader(contentLengthHeader) === undefined) {
        throw createHttpError(400, "Content-Length must be a non-negative integer");
    }

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
 * Builds the file initialization config from request headers. Shared by the Node and Fetch REST handlers.
 * @param readHeader Reads a request header by name
 * @param contentLength The content length (already validated)
 * @param contentType The content type (default: application/octet-stream)
 * @returns FileInit configuration object
 */
export const buildFileInit = (readHeader: HeaderReader, contentLength: number, contentType = "application/octet-stream"): FileInit => {
    const originalName = parseContentDispositionValue(readHeader("content-disposition"));
    const metadata = parseMetadataHeader(readHeader("x-file-metadata")) ?? {};
    const { isChunkedUpload, totalSize } = parseChunkHeaders(readHeader);

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
 * Reads headers from a Node.js request.
 * @param request The HTTP request
 * @returns A {@link HeaderReader} for the request
 */
export const nodeHeaderReader =
    (request: IncomingMessage): HeaderReader =>
    (name: string) =>
        getHeader(request, name, true);

/**
 * Extracts file initialization config from request headers.
 * @param request The HTTP request
 * @param contentLength The content length (already validated)
 * @param contentType The content type (default: application/octet-stream)
 * @returns FileInit configuration object
 */
export const extractFileInit = (request: IncomingMessage, contentLength: number, contentType = "application/octet-stream"): FileInit =>
    buildFileInit(nodeHeaderReader(request), contentLength, contentType);
