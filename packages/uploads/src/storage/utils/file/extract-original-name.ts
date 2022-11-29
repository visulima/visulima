import { Metadata } from "./metadata";

const extractOriginalName = (meta: Metadata): string | undefined => meta.name || meta.title || meta.originalName || meta.filename;

export default extractOriginalName;
