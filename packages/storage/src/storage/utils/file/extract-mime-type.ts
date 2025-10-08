import type { Metadata } from "./metadata";

const extractMimeType = (meta: Metadata): string | undefined => meta.mimeType || meta.contentType || meta.type || meta.filetype;

export default extractMimeType;
