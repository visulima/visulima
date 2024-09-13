import type File from "./file";
import type { FilePart } from "./types";

const partMatch = (part: Partial<FilePart>, file: File): boolean => {
    if (part.size !== undefined && file.size !== undefined && part.size > 0 && file.size > 0 && part.size > file.size) {
        return false;
    }

    return (part.start || 0) + (part.contentLength || 0) <= (file.size as number);
};

export default partMatch;
