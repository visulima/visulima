import { ERRORS, throwErrorCode } from "../../utils/errors";
import { getMetaVersion, setMetaVersion } from "../meta-storage";

/** S3 rejects CompleteMultipartUpload when any part but the last is smaller than this. */
export const MIN_PART_SIZE: number = 5 * 1024 * 1024;

/** Default multipart part size. */
export const PART_SIZE: number = 16 * 1024 * 1024;

/**
 * Build the HTTP `Range` header value (`bytes=start-end`) from a structured range.
 *
 * Returns `undefined` for an absent range so call sites can spread it conditionally
 * (omit the `Range` field entirely rather than send `Range: undefined`). `start` is
 * clamped to `0` because S3 rejects negative offsets and an `end` of `undefined`
 * renders as the open-ended `bytes=start-` form (read to EOF).
 */
export const buildRangeHeader = (range: { end?: number; start: number } | undefined): string | undefined => {
    if (!range) {
        return undefined;
    }

    return `bytes=${Math.max(0, range.start)}-${range.end === undefined ? "" : range.end}`;
};

/**
 * Copy of `file` without its `Parts` list, for persisting. S3MetaStorage keeps meta in a
 * ~2KB user-metadata header that a long parts list would overflow; parts are re-fetched
 * lazily via `listParts` instead.
 */
export const withoutParts = <T extends { Parts?: unknown }>(file: T): T => {
    const { Parts: _parts, ...rest } = file;

    setMetaVersion(rest, getMetaVersion(file));

    return rest as T;
};

/**
 * Whether an S3 error is a 404: a missing object (NoSuchKey) or multipart upload (NoSuchUpload).
 */
export const isNotFound = (error: unknown): boolean => (error as { $metadata?: { httpStatusCode?: number } } | undefined)?.$metadata?.httpStatusCode === 404;

/**
 * Rethrows an S3 `412 Precondition Failed` (a conditional header that did not hold) as
 * `ERRORS.PRECONDITION_FAILED`; any other error unchanged.
 */
export const rethrowPreconditionFailed = (error: unknown): never => {
    if ((error as { $metadata?: { httpStatusCode?: number } } | undefined)?.$metadata?.httpStatusCode === 412) {
        throwErrorCode(ERRORS.PRECONDITION_FAILED, (error as Error).message);
    }

    throw error;
};

/**
 * Whether an UploadPart failure is S3 rejecting the `Content-MD5` digest.
 */
export const isBadDigest = (error: unknown): boolean => {
    const { Code, code, message, name } = (error ?? {}) as { Code?: string; code?: string; message?: string; name?: string };

    return [Code, code, name].includes("BadDigest") || (typeof message === "string" && message.includes("BadDigest"));
};

/**
 * Rejects a non-final part smaller than {@link MIN_PART_SIZE}. S3 would only refuse it at
 * CompleteMultipartUpload, after the client has uploaded everything; failing the chunk up front
 * saves that round trip.
 * @throws {UploadError} BAD_REQUEST when the part is too small and not the last one
 */
export const assertNextPartSize = (part: { contentLength?: number; start?: number }, file: { bytesWritten: number; size?: number }): void => {
    const contentLength = part.contentLength ?? 0;

    if (contentLength > 0 && contentLength < MIN_PART_SIZE && typeof file.size === "number" && (part.start ?? file.bytesWritten) + contentLength < file.size) {
        throwErrorCode(ERRORS.BAD_REQUEST, "S3 multipart uploads need chunks of at least 5 MiB except for the last one.");
    }
};
