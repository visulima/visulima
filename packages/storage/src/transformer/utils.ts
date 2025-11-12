import mime from "mime";

import type { FileReturn } from "../storage/utils/file";

/**
 * Check if a content type is valid for a specific media type.
 * @param contentType - MIME content type string to validate
 * @param expectedType - Expected media type ('image', 'video', or 'audio')
 * @returns True if the content type is valid for the expected media type
 */
export const isValidMediaType = (contentType: string | undefined, expectedType: "image" | "video" | "audio"): boolean => {
    if (!contentType) {
        return false;
    }

    return contentType.startsWith(`${expectedType}/`);
};

/**
 * Get format (extension) from content type using mime package.
 * @param contentType - MIME content type string to extract format from
 * @returns Format string or undefined if not found
 */
export const getFormatFromContentType = (contentType: string | undefined): string | undefined => {
    if (!contentType) {
        return undefined;
    }

    return mime.getExtension(contentType) || undefined;
};

/**
 * Validate a media file for a specific type with size and format checks.
 * @param file - File to validate
 * @param expectedType - Expected media type ('image', 'video', or 'audio')
 * @param config - Validation configuration with optional maxSize and supportedFormats
 * @param config.maxSize - Maximum allowed file size in bytes
 * @param config.supportedFormats - Array of supported file formats
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
    const format = getFormatFromContentType(file.contentType);

    if (config?.supportedFormats && format && !config.supportedFormats.includes(format)) {
        throw new Error(`Unsupported ${expectedType} format: ${format}`);
    }
};

/**
 * Validate that a content type is known and supported by the mime package.
 * @param contentType - MIME content type string to check
 * @returns True if the content type is known and has a registered extension
 */
export const isKnownContentType = (contentType: string | undefined): boolean => {
    if (!contentType) {
        return false;
    }

    return !!mime.getExtension(contentType);
};
