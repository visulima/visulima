import { ERRORS, throwErrorCode } from "../../utils/errors";
import { getMetaVersion, setMetaVersion } from "../meta-storage";
import type { File } from "../utils/file";
import { parseMetadata } from "../utils/file/metadata";

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
 * Copy of `file` without its `Parts` list, for persisting: parts are re-fetched lazily via
 * `listParts` instead of growing the record with every chunk.
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
 * `ERRORS.PRECONDITION_FAILED`, any other error unchanged. A write's `If-Match` S3 answers
 * with `404` when no object is stored under the key, which is the predicate failing too. A
 * `409 ConditionalRequestConflict` (another conditional write to the key in flight; the multipart
 * upload can't be completed any more) becomes `ERRORS.FILE_CONFLICT`: the upload has to start again.
 * @param ifMatch Whether the request was a write that sent `If-Match`
 * @see https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-requests.html
 */
export const rethrowConditionalFailure =
    (ifMatch: boolean) =>
    (error: unknown): never => {
        const { $metadata, code, name } = (error ?? {}) as { $metadata?: { httpStatusCode?: number }; code?: string; name?: string };
        const status = $metadata?.httpStatusCode;

        if (status === 412 || (ifMatch && status === 404)) {
            throwErrorCode(ERRORS.PRECONDITION_FAILED, (error as Error).message);
        }

        if (status === 409 && (code ?? name) === "ConditionalRequestConflict") {
            throwErrorCode(ERRORS.FILE_CONFLICT, "A concurrent conditional write to the key won; start the upload again");
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

/**
 * Reads an upload record stored in the bucket: the JSON object body, or for a record written by an
 * older version (an empty object with the record in its `metadata` header) that header.
 * @param body The object's body
 * @param header The object's `x-amz-meta-metadata` header
 * @returns The record, or `undefined` when the object holds none
 */
export const parseMetaRecord = <T extends File>(body: string, header: string | undefined): T | undefined => {
    const json = body === "" && header !== undefined ? decodeURIComponent(header) : body;

    if (json === "") {
        return undefined;
    }

    const file = JSON.parse(json) as T;

    // A header record carries its metadata as an Upload-Metadata string, "" for an empty one.
    if (typeof file.metadata === "string") {
        file.metadata = file.metadata === "" ? {} : parseMetadata(file.metadata);
    }

    return file;
};
