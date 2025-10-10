import mime from "mime/lite";

import type { FileReturn } from "../storage/utils/file";

/**
 * Check if a content type is valid for a specific media type
 * @param contentType MIME content type string
 * @param expectedType Expected media type ('image', 'video', or 'audio')
 * @returns True if the content type is valid for the expected media type
 */
export const isValidMediaType = (contentType: string | undefined, expectedType: "image" | "video" | "audio"): boolean => {
    if (!contentType) {
        return false;
    }

    return contentType.startsWith(`${expectedType}/`);
};

/**
 * Get format (extension) from content type using mime package
 * @param contentType MIME content type string
 * @returns Format string or undefined if not found
 */
export const getFormatFromContentType = (contentType: string | undefined): string | undefined => {
    if (!contentType) {
        return undefined;
    }

    return mime.getExtension(contentType) || undefined;
};

/**
 * Validate a media file for a specific type
 * @param file File to validate
 * @param expectedType Expected media type
 * @param config Validation configuration
 * @throws Error if validation fails
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
 * Validate that a content type is known and supported by the mime package
 * @param contentType MIME content type string
 * @returns True if the content type is known
 */
export const isKnownContentType = (contentType: string | undefined): boolean => {
    if (!contentType) {
        return false;
    }

    return !!mime.getExtension(contentType);
};
