/**
 * Client-side upload restrictions, modelled on Uppy's `restrictions` block.
 *
 * Validating files before any network request gives consumers friendly errors
 * (e.g. "File is too large") instead of opaque server-side 413 responses.
 */
import type { UploadRestrictions } from "./types";

/**
 * Error thrown when a file violates the configured {@link UploadRestrictions}.
 */
class RestrictionError extends Error {
    /** Machine-readable reason for the violation. */
    public readonly reason: "fileTooLarge" | "fileTooSmall" | "tooManyFiles" | "typeNotAllowed";

    public constructor(message: string, reason: RestrictionError["reason"]) {
        super(message);

        this.name = "RestrictionError";
        this.reason = reason;
    }
}

/**
 * Checks whether a file's MIME type / extension matches an allow-list entry.
 * Supports exact MIME types (`image/png`), wildcard MIME types (`image/*`), and
 * extensions (`.pdf`).
 */
const matchesType = (file: File, allowed: string): boolean => {
    const pattern = allowed.trim().toLowerCase();

    if (pattern.startsWith(".")) {
        return file.name.toLowerCase().endsWith(pattern);
    }

    const type = (file.type || "").toLowerCase();

    if (pattern.endsWith("/*")) {
        return type.startsWith(pattern.slice(0, -1));
    }

    return type === pattern;
};

/**
 * Validates a single file against size / type restrictions.
 * @throws {RestrictionError} when the file violates a restriction.
 */
const validateFile = (file: File, restrictions?: UploadRestrictions): void => {
    if (!restrictions) {
        return;
    }

    const { allowedFileTypes, maxFileSize, minFileSize } = restrictions;

    if (maxFileSize !== undefined && file.size > maxFileSize) {
        throw new RestrictionError(`File "${file.name}" is too large (${String(file.size)} bytes, max ${String(maxFileSize)}).`, "fileTooLarge");
    }

    if (minFileSize !== undefined && file.size < minFileSize) {
        throw new RestrictionError(`File "${file.name}" is too small (${String(file.size)} bytes, min ${String(minFileSize)}).`, "fileTooSmall");
    }

    if (allowedFileTypes && allowedFileTypes.length > 0 && !allowedFileTypes.some((allowed) => matchesType(file, allowed))) {
        throw new RestrictionError(`File "${file.name}" type "${file.type || "unknown"}" is not allowed.`, "typeNotAllowed");
    }
};

/**
 * Validates a batch of files against size / type / count restrictions.
 * @throws {RestrictionError} on the first violation.
 */
const validateFiles = (files: File[], restrictions?: UploadRestrictions): void => {
    if (!restrictions) {
        return;
    }

    if (restrictions.maxNumberOfFiles !== undefined && files.length > restrictions.maxNumberOfFiles) {
        throw new RestrictionError(`Too many files (${String(files.length)}, max ${String(restrictions.maxNumberOfFiles)}).`, "tooManyFiles");
    }

    for (const file of files) {
        validateFile(file, restrictions);
    }
};

export { RestrictionError, validateFile, validateFiles };
