import mime from "mime";

import type { FileReturn } from "../storage/utils/file";

/**
 * Check if a content type is valid for a specific media type.
 * @param contentType MIME content type string to validate
 * @param expectedType Expected media type ('image', 'video', or 'audio')
 * @returns True if the content type is valid for the expected media type
 */
export const isValidMediaType = (contentType: string | undefined, expectedType: "image" | "video" | "audio"): boolean => {
    if (!contentType) {
        return false;
    }

    return contentType.startsWith(`${expectedType}/`);
};

/** Common media types the `mime` package does not know, mapped to their format. */
const CONTENT_TYPE_FORMATS: Readonly<Record<string, string>> = {
    "audio/aiff": "aiff",
    "audio/flac": "flac",
    "audio/m4a": "m4a",
    "audio/opus": "opus",
    "audio/vnd.wave": "wav",
    "video/avi": "avi",
    "video/matroska": "mkv",
};

/** Formats whose `mime` type is not the registered one (`audio/x-flac`). */
const FORMAT_CONTENT_TYPES: Readonly<Record<string, string>> = {
    flac: "audio/flac",
};

/**
 * Get format (extension) from content type using mime package, plus common media types it lacks.
 * @param contentType MIME content type string to extract format from
 * @returns Format string or undefined if not found
 */
export const getFormatFromContentType = (contentType: string | undefined): string | undefined => {
    if (!contentType) {
        return undefined;
    }

    const type = contentType.split(";")[0]?.trim().toLowerCase() ?? "";

    return CONTENT_TYPE_FORMATS[type] ?? (mime.getExtension(type) || undefined);
};

/**
 * MIME type of a media format, e.g. `mkv` → `video/x-matroska`, `mov` → `video/quicktime`.
 * Container formats that hold audio or video alike (`ogg`, `mp4`, `webm`) take their top-level
 * type from `mediaType`, so a video transcoded to `ogg` is `video/ogg`, not `audio/ogg`.
 * @param format Format (file extension) of the media
 * @param mediaType Kind of media the format holds, when known
 * @returns The MIME type, or undefined for an unknown format
 */
export const getContentTypeFromFormat = (format: string | undefined, mediaType?: "image" | "video" | "audio"): string | undefined => {
    if (!format) {
        return undefined;
    }

    const type = FORMAT_CONTENT_TYPES[format.toLowerCase()] ?? mime.getType(format);

    if (!type || !mediaType || mediaType === "image" || type.startsWith(`${mediaType}/`) || !/^(?:audio|video)\//.test(type)) {
        return type ?? undefined;
    }

    return `${mediaType}/${type.slice(type.indexOf("/") + 1)}`;
};

/**
 * Check a content type against a list of supported formats. Matches any extension registered for
 * the type, so `image/jpeg` (preferred extension `jpg`) matches `jpeg` and `audio/mpeg` matches `mp3`.
 * @param contentType MIME content type string to check
 * @param supportedFormats Supported format names (file extensions)
 * @returns True if supported, or if the content type has no known extension to check
 */
export const isSupportedFormat = (contentType: string | undefined, supportedFormats: string[]): boolean => {
    const extensions = new Set(contentType ? mime.getAllExtensions(contentType) : undefined);
    const alias = getFormatFromContentType(contentType);

    if (alias) {
        extensions.add(alias);
    }

    return extensions.size === 0 || supportedFormats.some((format) => extensions.has(format));
};

/**
 * Validate a media file for a specific type with size and format checks.
 * @param file File to validate
 * @param expectedType Expected media type ('image', 'video', or 'audio')
 * @param config Validation configuration with optional maxSize and supportedFormats
 * @param config.maxSize Maximum allowed file size in bytes
 * @param config.supportedFormats Array of supported file formats
 * @throws Error if validation fails (size exceeded, wrong type, or unsupported format)
 */
export const validateMediaFile = (
    file: FileReturn,
    expectedType: "image" | "video" | "audio",
    config?: {
        maxSize?: number;
        supportedFormats?: string[];
    },
): void => {
    // Check file size
    const fileSize = typeof file.size === "string" ? Number.parseInt(file.size, 10) : file.size;

    if (config?.maxSize && fileSize > config.maxSize) {
        throw new Error(`${expectedType} size ${fileSize} exceeds maximum allowed size ${config.maxSize}`);
    }

    // Check if it's the expected media type
    if (!isValidMediaType(file.contentType, expectedType)) {
        throw new Error(`File is not ${expectedType === "image" ? "an" : "a"} ${expectedType}: ${file.contentType}`);
    }

    // Check format support
    if (config?.supportedFormats && !isSupportedFormat(file.contentType, config.supportedFormats)) {
        throw new Error(`Unsupported ${expectedType} format: ${getFormatFromContentType(file.contentType)}`);
    }
};

/**
 * Validate that a content type is known and supported by the mime package.
 * @param contentType MIME content type string to check
 * @returns True if the content type is known and has a registered extension
 */
export const isKnownContentType = (contentType: string | undefined): boolean => {
    if (!contentType) {
        return false;
    }

    return getFormatFromContentType(contentType) !== undefined;
};

/**
 * Version fingerprint of a stored original (ETag, modification time, size). Folded into transform
 * cache keys and persisted transform ids so replacing the original never serves a stale transform.
 * @param meta Metadata of the original file
 * @param meta.ETag Entity tag, when the adapter reports one
 * @param meta.modifiedAt Last modification time, when the adapter reports one
 * @param meta.size Size in bytes, when known
 * @returns A `|`-joined fingerprint, with empty parts for metadata the adapter does not report
 */
export const sourceVersion = (meta: { ETag?: string; modifiedAt?: Date | number | string; size?: number | string }): string =>
    [meta.ETag, meta.modifiedAt, meta.size].map((part) => (part instanceof Date ? part.toISOString() : String(part ?? ""))).join("|");
