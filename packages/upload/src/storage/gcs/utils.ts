import type { FilePart } from "../utils/file";
import { hasContent } from "../utils/file";
import GCSFile from "./gcs-file";

export function getRangeEnd(range: string): number {
    const end = +(range.split(/0-/)[1] as string);

    return end > 0 ? end + 1 : 0;
}

export function buildContentRange(part: Partial<FilePart> & GCSFile): string {
    if (hasContent(part)) {
        const end = part.contentLength ? part.start + part.contentLength - 1 : "*";
        return `bytes ${part.start}-${end}/${part.size ?? "*"}`;
    }
    return `bytes */${part.size ?? "*"}`;
}
