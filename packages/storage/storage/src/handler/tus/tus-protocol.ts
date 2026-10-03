import createHttpError from "http-errors";

import { Metadata } from "../../storage/utils/file";
import { getIdFromRequestUrl } from "../../utils/http";

export const TUS_RESUMABLE_VERSION = "1.0.0";
export const TUS_VERSION_VERSION = "1.0.0";

/**
 * Whether a header value is a non-negative integer, as the spec requires for `Upload-Length`
 * and `Upload-Offset`.
 * @param value Header value
 * @returns True for e.g. "0" or "42", false for "", "-1", "1.5" or "abc"
 */
export const isNonNegativeInteger = (value: string): boolean => /^\d+$/.test(value) && Number.isSafeInteger(Number(value));

/** Standard base64 alphabet; padding is optional (Buffer decodes unpadded values fine). */
const BASE64_PATTERN = /^[a-z\d+/]*={0,2}$/i;

/**
 * Metadata keys the server stores on an upload for its own bookkeeping. They are never echoed
 * back in `Upload-Metadata`, and a client can't set them.
 */
const INTERNAL_METADATA_KEYS = new Set(["partialIds", "uploadConcat"]);

/**
 * Parse TUS protocol metadata string into object.
 *
 * Follows the spec: pairs are comma separated, each pair is a key and an optional base64 value
 * separated by a single space. Keys MUST NOT be empty or contain spaces/commas and MUST be
 * unique; a malformed header is rejected with `400 Bad Request`. Empty pairs (e.g. from a
 * trailing comma) are ignored.
 * @param encoded Base64-encoded metadata string (optional, defaults to empty string)
 * @returns Parsed metadata object with decoded values
 * @throws {HttpError} 400 when the header is malformed
 */
export const parseMetadata = (encoded = ""): Metadata => {
    const metadata = Object.create(Metadata.prototype) as Record<string, string>;

    for (const pair of encoded.split(",")) {
        if (pair.trim() === "") {
            continue;
        }

        const parts = pair.trim().split(" ");
        const [key, value] = parts;

        if (!key || parts.length > 2) {
            throw createHttpError(400, "Invalid Upload-Metadata header: malformed key-value pair");
        }

        if (Object.hasOwn(metadata, key)) {
            throw createHttpError(400, `Invalid Upload-Metadata header: duplicate key "${key}"`);
        }

        if (INTERNAL_METADATA_KEYS.has(key)) {
            throw createHttpError(400, `Invalid Upload-Metadata header: reserved key "${key}"`);
        }

        if (value !== undefined && value !== "" && !BASE64_PATTERN.test(value)) {
            throw createHttpError(400, `Invalid Upload-Metadata header: value of "${key}" is not base64`);
        }

        metadata[key] = value ? Buffer.from(value, "base64").toString() : "";
    }

    return metadata;
};

/**
 * Serialize metadata object to TUS protocol format.
 * @param object Metadata object to serialize
 * @returns Base64-encoded metadata string in TUS format
 */
export const serializeMetadata = (object: Metadata | Record<string, unknown> | undefined): string => {
    if (!object || Object.keys(object).length === 0) {
        return "";
    }

    return Object.entries(object)
        .map(([key, value]) => {
            if (value === undefined) {
                return key;
            }

            return `${key} ${Buffer.from(String(value)).toString("base64")}`;
        })
        .toString();
};

/**
 * The client-visible part of an upload's metadata, without the server's bookkeeping keys.
 * @param metadata Stored metadata
 * @returns Metadata safe to echo in `Upload-Metadata`
 */
export const publicMetadata = (metadata: Record<string, unknown> | undefined): Record<string, unknown> =>
    Object.fromEntries(Object.entries(metadata ?? {}).filter(([key]) => !INTERNAL_METADATA_KEYS.has(key)));

/** Methods a client may tunnel through `X-HTTP-Method-Override`. */
const OVERRIDABLE_METHODS = new Set(["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST"]);

/**
 * Resolves an `X-HTTP-Method-Override` header to the method the server must use.
 * @param header Header value
 * @returns The upper-cased method, or undefined when the header is absent
 * @throws {HttpError} 400 for a method the TUS handler doesn't serve
 */
export const resolveMethodOverride = (header: string | undefined): string | undefined => {
    if (header === undefined || header.trim() === "") {
        return undefined;
    }

    const method = header.trim().toUpperCase();

    if (!OVERRIDABLE_METHODS.has(method)) {
        throw createHttpError(400, `Unsupported X-HTTP-Method-Override: ${header}`);
    }

    return method;
};

/**
 * Parses an `Upload-Concat: final;...` header (space-separated partial upload URLs) into upload IDs. The spec lists partial upload URLs
 * (absolute or relative); bare IDs are accepted too.
 * @param header Upload-Concat header value, starting with `final;`
 * @returns The partial upload IDs, in order
 * @throws {HttpError} 400 for an empty list or an unusable URL
 */
export const parseFinalConcatIds = (header: string): string[] => {
    const ids = header
        .slice("final;".length)
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((reference) => {
            let id: string | undefined;

            try {
                id = reference.includes("/") ? getIdFromRequestUrl(reference) : reference;
            } catch {
                id = undefined;
            }

            if (id === undefined) {
                throw createHttpError(400, `Upload-Concat final contains an invalid partial upload URL: ${reference}`);
            }

            return id;
        });

    if (ids.length === 0) {
        throw createHttpError(400, "Upload-Concat final must include at least one partial upload ID");
    }

    return ids;
};

/**
 * Validate Tus-Resumable header value.
 * @param tusResumable Tus-Resumable header value
 * @throws {HttpError} 412 if version doesn't match or header is missing
 */
export const validateTusResumable = (tusResumable: string | undefined): void => {
    if (!tusResumable) {
        throw createHttpError(412, "Missing Tus-Resumable header");
    }

    if (tusResumable !== TUS_RESUMABLE_VERSION) {
        throw createHttpError(412, `Unsupported TUS version: ${tusResumable}. Server supports: ${TUS_RESUMABLE_VERSION}`);
    }
};
