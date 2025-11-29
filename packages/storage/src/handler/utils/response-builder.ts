import mime from "mime";

import type { UploadFile } from "../../storage/utils/file";
import { HeaderUtilities } from "../../utils/headers";
import type { Header } from "../../utils/types";
import type { ResponseFile } from "../types";

const CONTENT_TYPE = "Content-Type";

/**
 * Builds a standard ResponseFile from a file object and headers.
 * @param file The file object to convert to a response
 * @param headers Additional headers to include
 * @param statusCode HTTP status code (default: 200)
 * @returns ResponseFile with file data and headers
 */
export const buildResponseFile = <TFile extends UploadFile>(
    file: TFile,
    headers: Record<string, string | number> = {},
    statusCode = 200,
): ResponseFile<TFile> =>
    ({
        ...file,
        headers,
        statusCode,
    }) as ResponseFile<TFile>;

/**
 * Builds standard file headers including Location, expiration, and ETag.
 * @param file The file object
 * @param locationUrl The Location header URL
 * @param additionalHeaders Additional headers to merge in
 * @returns Headers object with standard file headers
 */
export const buildFileHeaders = <TFile extends UploadFile>(
    file: TFile,
    locationUrl: string,
    additionalHeaders: Record<string, string | number> = {},
): Record<string, string | number> => {
    return {
        Location: locationUrl,
        ...file.expiredAt === undefined ? {} : { "X-Upload-Expires": file.expiredAt.toString() },
        ...file.ETag === undefined ? {} : { ETag: file.ETag },
        ...additionalHeaders,
    };
};

/**
 * Builds chunked upload headers for progress tracking.
 * @param file The file object with chunked upload metadata
 * @param isComplete Whether the upload is complete
 * @returns Headers object with chunked upload progress headers
 */
export const buildChunkedUploadHeaders = <TFile extends UploadFile>(file: TFile, isComplete: boolean): Record<string, string | number> => {
    const metadata = file.metadata || {};
    const headers: Record<string, string | number> = {
        "x-chunked-upload": "true",
        "x-upload-complete": isComplete ? "true" : "false",
        "x-upload-offset": String(file.bytesWritten || 0),
    };

    // Include received chunks info for resumability
    if (Array.isArray(metadata._chunks) && metadata._chunks.length > 0) {
        headers["x-received-chunks"] = JSON.stringify(metadata._chunks);
    }

    return headers;
};

/**
 * Builds a Location header URL for a file.
 * @param requestUrl The request URL or originalUrl
 * @param fileId The file ID
 * @param contentType The file content type (for extension)
 * @param useRelativeLocation Whether to use relative URLs
 * @param baseUrl The base URL (for absolute URLs)
 * @returns Location URL string
 */
export const buildLocationHeader = (
    requestUrl: string | undefined,
    fileId: string,
    contentType: string,
    useRelativeLocation: boolean,
    baseUrl?: string,
): string => {
    const url = new URL(requestUrl || "/", "http://localhost");
    const { pathname } = url;
    const relative = `${pathname}/${fileId}.${mime.getExtension(contentType)}`;

    return useRelativeLocation ? relative : `${baseUrl || ""}${relative}`;
};

/**
 * Builds standard file metadata headers for HEAD requests.
 * @param file The file object
 * @returns Headers object with file metadata
 */
export const buildFileMetadataHeaders = <TFile extends UploadFile>(file: TFile): Record<string, string | number> => {
    return {
        "Content-Length": String(file.size || 0),
        "Content-Type": file.contentType,
        ...file.expiredAt === undefined ? {} : { "X-Upload-Expires": file.expiredAt.toString() },
        ...file.modifiedAt === undefined ? {} : { "Last-Modified": file.modifiedAt.toString() },
        ...file.ETag === undefined ? {} : { ETag: file.ETag },
    };
};

/**
 * Converts headers from Record format to string format, handling arrays.
 * @param headers Headers object that may contain arrays
 * @returns Headers object with all values as strings
 */
export const convertHeadersToString = (headers: Record<string, Header>): Record<string, string> => {
    const result: Record<string, string> = {};

    for (const [key, value] of Object.entries(headers)) {
        result[key] = Array.isArray(value) ? value.join(", ") : String(value);
    }

    return result;
};

/**
 * Builds an error response body in standard format.
 * @param error The error object
 * @returns Error response body object
 */
export const buildErrorResponseBody = (error: {
    code?: string;
    message?: string;
    name?: string;
}): { error: { code: string; message: string; name: string } } => {
    return {
        error: {
            code: error.code || error.name || "Error",
            message: error.message || "Unknown error",
            name: error.name || "Error",
        },
    };
};

/**
 * Prepares response body and headers for sending, handling different body types.
 * @param body The response body (string, Buffer, or object)
 * @param headers Existing headers
 * @returns Object with prepared data and headers
 */
export const prepareResponseBody = (
    body: string | Buffer | object | undefined,
    headers: Record<string, string | number> = {},
): { data: Buffer | string; headers: Record<string, string | number> } => {
    const finalHeaders = { ...headers };
    let data: Buffer | string;

    if (typeof body === "string") {
        data = body;

        if (finalHeaders[CONTENT_TYPE] === undefined) {
            finalHeaders[CONTENT_TYPE] = HeaderUtilities.createContentType({ mediaType: "text/plain" });
        } else {
            // Ensure charset is present for text content
            const contentTypeValue = Array.isArray(finalHeaders[CONTENT_TYPE]) ? finalHeaders[CONTENT_TYPE].join(", ") : String(finalHeaders[CONTENT_TYPE]);

            finalHeaders[CONTENT_TYPE] = HeaderUtilities.ensureCharset(contentTypeValue);
        }

        if (finalHeaders["Content-Length"] === undefined) {
            finalHeaders["Content-Length"] = Buffer.byteLength(body);
        }
    } else if (body instanceof Buffer) {
        data = body;
    } else {
        data = JSON.stringify(body || {});

        if (!finalHeaders[CONTENT_TYPE]) {
            finalHeaders[CONTENT_TYPE] = HeaderUtilities.createContentType({
                charset: "utf8",
                mediaType: "application/json",
            });
        }
    }

    return { data, headers: finalHeaders };
};

/**
 * Cleans file data for serialization by removing non-serializable properties.
 * @param fileData File data object
 * @returns Cleaned file data object
 */
export const cleanFileData = <TFile extends UploadFile>(fileData: TFile & { content?: unknown; stream?: unknown }): Omit<TFile, "content" | "stream"> => {
    const cleaned = { ...fileData };

    if ("content" in cleaned) {
        delete cleaned.content;
    }

    if ("stream" in cleaned) {
        delete cleaned.stream;
    }

    return cleaned as Omit<TFile, "content" | "stream">;
};
