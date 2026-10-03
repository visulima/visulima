import type { UploadResult } from "../types";

/** Spaces and commas separate Upload-Metadata pairs, so keys must not contain them (or other whitespace). */
const INVALID_METADATA_KEY_PATTERN = /[\s,]/u;

/** A URL with a scheme (`http:`, `https:`, ...) — anything else is resolved relative to the endpoint. */
const ABSOLUTE_URL_PATTERN = /^[a-z][\d+.a-z-]*:/iu;

/**
 * Encodes a UTF-8 string to base64.
 */
const encodeBase64Utf8 = (value: string): string => {
    const bytes = new TextEncoder().encode(value);
    let binary = "";

    for (const byte of bytes) {
        binary += String.fromCodePoint(byte);
    }

    return btoa(binary);
};

/**
 * Decodes a base64 string to UTF-8.
 */
const decodeBase64Utf8 = (value: string): string => {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.codePointAt(index) ?? 0;
    }

    return new TextDecoder().decode(bytes);
};

export const TUS_RESUMABLE_VERSION = "1.0.0";

/**
 * Validates user-supplied Upload-Metadata keys. Per the TUS spec a key MUST NOT
 * be empty and MUST NOT contain spaces or commas (the header's separators); keys
 * are already unique because they come from an object. Any other whitespace is
 * rejected too since it would equally corrupt the header.
 */
export const validateMetadataKeys = (metadata: Record<string, string>): void => {
    for (const key of Object.keys(metadata)) {
        if (key.length === 0) {
            throw new Error("Invalid TUS metadata key: keys must not be empty");
        }

        if (INVALID_METADATA_KEY_PATTERN.test(key)) {
            throw new Error(`Invalid TUS metadata key "${key}": keys must not contain spaces or commas`);
        }
    }
};

/**
 * Encodes metadata for TUS Upload-Metadata header. Empty values are sent as a
 * bare key, as the spec allows.
 */
export const encodeMetadata = (metadata: Record<string, string>): string =>
    Object.entries(metadata)
        .map(([key, value]) => {
            if (value === "") {
                return key;
            }

            return `${key} ${encodeBase64Utf8(value)}`;
        })
        .join(",");

/**
 * Decodes metadata from TUS Upload-Metadata header.
 */
export const decodeMetadata = (header: string | undefined): Record<string, string> => {
    if (!header) {
        return {};
    }

    const metadata: Record<string, string> = {};

    header.split(",").forEach((item) => {
        const [key, ...valueParts] = item.trim().split(" ");
        const encoded = valueParts.join(" ");

        if (key && !encoded) {
            // The spec allows a bare key for an empty value.
            metadata[key] = "";
        } else if (key) {
            try {
                metadata[key] = decodeBase64Utf8(encoded);
            } catch {
                // Ignore invalid metadata entries
            }
        }
    });

    return metadata;
};

/**
 * Whether a response status means the upload resource no longer exists. TUS
 * servers answer 404 or 410 for an unknown/expired upload; on HEAD, 403 is
 * allowed too (`includeForbidden`).
 */
export const isGoneStatus = (status: number, includeForbidden = false): boolean => status === 404 || status === 410 || (includeForbidden && status === 403);

/**
 * Parses an `Upload-Offset` header, falling back to 0 when it is missing or malformed.
 */
export const parseOffsetHeader = (header: string | null): number => {
    const parsed = header ? Number.parseInt(header, 10) : 0;

    return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * Resolves the `Location` returned by the creation POST into an absolute upload URL.
 * Relative locations are resolved against the endpoint; a relative endpoint is
 * resolved against the page origin (browser) or `http://localhost` (Node).
 */
export const resolveUploadUrl = (location: string, endpoint: string): string => {
    if (ABSOLUTE_URL_PATTERN.test(location)) {
        return location;
    }

    try {
        return new URL(location, endpoint).href;
    } catch {
        const baseUrl = "window" in globalThis ? globalThis.location.origin : "http://localhost";

        return new URL(location, baseUrl + endpoint).href;
    }
};

/**
 * Builds the visulima-compatible result of a finished upload. `headers` are the
 * final HEAD response's headers; they are absent when the server already dropped
 * the finished upload, in which case the result is built from the local file.
 */
export const toUploadResult = (file: File, uploadUrl: string, offset: number, headers: Headers | undefined): UploadResult => {
    const uploadMetadata = decodeMetadata(headers?.get("Upload-Metadata") ?? undefined);
    const originalName = uploadMetadata.filename ?? file.name;

    return {
        bytesWritten: offset,
        contentType: headers?.get("Content-Type") ?? uploadMetadata.filetype ?? file.type,
        filename: originalName,
        id: uploadUrl.split("/").pop() ?? "",
        metadata: uploadMetadata,
        offset,
        originalName,
        size: file.size,
        status: "completed",
        url: headers?.get("Location") ?? uploadUrl,
    };
};
