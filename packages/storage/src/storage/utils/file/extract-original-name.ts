import type { Metadata } from "./metadata";

/**
 * Extracts the original filename from metadata object, checking multiple possible keys.
 * @param meta The metadata object to extract filename from
 * @returns The original filename if found, undefined otherwise
 */
const extractOriginalName = (meta: Metadata): string | undefined => meta.name || meta.title || meta.originalName || meta.filename;

export default extractOriginalName;
