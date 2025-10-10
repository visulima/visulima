import type File from "./file";
import type { FilePart } from "./types";

/**
 * Validates if a file part matches the expected file size and offset constraints.
 * Checks that the part doesn't exceed file size boundaries.
 * @param part Partial file part to validate
 * @param file File object to validate against
 * @returns True if the part is valid for the file, false otherwise
 */
const partMatch = (part: Partial<FilePart>, file: File): boolean => {
    if (part.size !== undefined && file.size !== undefined && part.size > 0 && file.size > 0 && part.size > file.size) {
        return false;
    }

    return (part.start || 0) + (part.contentLength || 0) <= (file.size as number);
};

export default partMatch;
