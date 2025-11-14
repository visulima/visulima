import type { Metadata } from "./metadata";

/**
 * Extracts the MIME type from metadata object, checking multiple possible keys.
 * @param meta The metadata object to extract MIME type from
 * @returns The MIME type if found, undefined otherwise
 */
const extractMimeType = (meta: Metadata): string | undefined => meta.mimeType || meta.type || meta.type || meta.filetype;

export default extractMimeType;
