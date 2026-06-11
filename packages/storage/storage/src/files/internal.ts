import { Readable } from "node:stream";

import type { OperationOptions } from "../storage/types";
import type { File as StorageFile } from "../storage/utils/file";
import { ERRORS, throwErrorCode } from "../utils/errors";
import type { BulkError, FileBody, FileObject } from "./types";

export const DEFAULT_BULK_CONCURRENCY = 8;

const isWebReadableStream = (value: unknown): value is ReadableStream<Uint8Array> =>
    typeof value === "object" && value !== null && typeof (value as { getReader?: unknown }).getReader === "function";

const isNodeReadable = (value: unknown): value is NodeJS.ReadableStream =>
    typeof value === "object" &&
    value !== null &&
    typeof (value as { pipe?: unknown }).pipe === "function" &&
    typeof (value as { read?: unknown }).read === "function";

/**
 * Normalizes any supported body into a Node `Readable` + a known size when derivable.
 */
export const normalizeBody = async (body: FileBody, sizeHint?: number): Promise<{ size?: number; stream: Readable }> => {
    if (typeof body === "string") {
        const buffer = Buffer.from(body);

        return { size: buffer.byteLength, stream: Readable.from(buffer) };
    }

    if (Buffer.isBuffer(body)) {
        return { size: body.byteLength, stream: Readable.from(body) };
    }

    if (body instanceof Uint8Array) {
        const buffer = Buffer.from(body.buffer, body.byteOffset, body.byteLength);

        return { size: buffer.byteLength, stream: Readable.from(buffer) };
    }

    if (body instanceof ArrayBuffer) {
        const buffer = Buffer.from(body);

        return { size: buffer.byteLength, stream: Readable.from(buffer) };
    }

    if (ArrayBuffer.isView(body)) {
        const view = body;
        const buffer = Buffer.from(view.buffer, view.byteOffset, view.byteLength);

        return { size: buffer.byteLength, stream: Readable.from(buffer) };
    }

    if (typeof Blob !== "undefined" && body instanceof Blob) {
        return { size: body.size, stream: Readable.fromWeb(body.stream() as unknown as Parameters<typeof Readable.fromWeb>[0]) };
    }

    if (isWebReadableStream(body)) {
        return { size: sizeHint, stream: Readable.fromWeb(body as unknown as Parameters<typeof Readable.fromWeb>[0]) };
    }

    if (isNodeReadable(body)) {
        return { size: sizeHint, stream: body as Readable };
    }

    throw new TypeError(`Unsupported body type: ${Object.prototype.toString.call(body)}`);
};

export const toFileObject = (file: StorageFile, fallbackKey?: string): FileObject => {
    return {
        contentType: file.contentType ?? "application/octet-stream",
        etag: file.ETag,
        key: file.name || file.id || fallbackKey || "",
        lastModified: file.modifiedAt ?? file.createdAt,
        metadata: file.metadata,
        size: typeof file.size === "number" ? file.size : undefined,
    };
};

/**
 * Reject `.` and `..` path segments. A prefix or key containing them would let a caller escape the
 * configured namespace/root once it is joined into `${prefix}/${key}` (e.g. `prefix: "users"` +
 * `key: "../admin/secret"`), so we fail closed before any adapter call.
 */
export const assertNoRelativeSegments = (value: string, label: string): void => {
    if (value.split("/").some((segment) => segment === "." || segment === "..")) {
        throwErrorCode(ERRORS.INVALID_FILE_NAME, `${ERRORS.INVALID_FILE_NAME}: ${label} must not contain "." or ".." path segments: "${value}"`);
    }
};

/**
 * Trim leading/trailing slashes; collapse internal repeats. Empty prefix → "".
 */
export const normalizePrefix = (raw: string): string => {
    if (!raw) {
        return "";
    }

    const normalized = raw
        .split("/")
        .filter((segment) => segment.length > 0)
        .join("/");

    assertNoRelativeSegments(normalized, "prefix");

    return normalized;
};

/**
 * Merge constructor defaults with per-call OperationOptions. Per-call wins for `timeout`/`retries`;
 * signals are combined via `AbortSignal.any` so either one aborts the operation. Keys explicitly
 * set to `undefined` on the per-call object are ignored (do not clobber a default), so callers can
 * pass partial options without thinking about whether defaults exist.
 */
export const mergeOperationOptions = (defaults: OperationOptions, perCall?: OperationOptions): OperationOptions | undefined => {
    if (!perCall && !defaults.signal && defaults.timeout === undefined && defaults.retries === undefined) {
        return undefined;
    }

    const merged: OperationOptions = { ...defaults };

    if (perCall) {
        if (perCall.signal !== undefined) {
            merged.signal = perCall.signal;
        }

        if (perCall.timeout !== undefined) {
            merged.timeout = perCall.timeout;
        }

        if (perCall.retries !== undefined) {
            merged.retries = perCall.retries;
        }
    }

    if (defaults.signal && perCall?.signal) {
        merged.signal = AbortSignal.any([defaults.signal, perCall.signal]);
    }

    return merged;
};

/**
 * Bounded-concurrency runner. Returns per-item settled results in input order.
 * Honors `signal` cancellation between dispatches and stops dispatching new work when
 * `stopOnError` is set and an item has rejected (already in-flight items still complete).
 */
export const runConcurrent = async <T, R>(
    items: T[],
    function_: (item: T, index: number) => Promise<R>,
    options: { concurrency: number; signal?: AbortSignal; stopOnError: boolean },
): Promise<PromiseSettledResult<R>[]> => {
    const results: PromiseSettledResult<R>[] = Array.from({ length: items.length });
    let cursor = 0;
    let stopped = false;

    const worker = async (): Promise<void> => {
        while (cursor < items.length) {
            if (stopped || options.signal?.aborted) {
                return;
            }

            const index = cursor;

            cursor += 1;

            try {
                const value = await function_(items[index] as T, index);

                results[index] = { status: "fulfilled", value };
            } catch (error: unknown) {
                results[index] = { reason: error, status: "rejected" };

                if (options.stopOnError) {
                    stopped = true;
                }
            }
        }
    };

    const width = Math.max(1, Math.min(options.concurrency, items.length));
    const workers = Array.from({ length: width }, () => worker());

    await Promise.all(workers);

    return results;
};

export const toBulkError = (key: string, reason: unknown): BulkError => {
    if (reason instanceof Error) {
        return { error: reason, key };
    }

    return { error: new Error(typeof reason === "string" ? reason : "Unknown error", { cause: reason }), key };
};

/**
 * `Throws` cannot escape — hook contract is fire-and-forget.
 */
export const safeInvoke = (callback: ((argument: unknown) => void) | undefined, value: unknown): void => {
    if (!callback) {
        return;
    }

    try {
        callback(value);
    } catch {
        // Hook contract: a throwing callback can never fail the operation it observes.
    }
};

/**
 * Decide whether a destination object still matches its source counterpart. Prefers strong signals
 * (size, then etag) and falls back to modification time; when nothing is comparable it treats the
 * pair as matching so a metadata-poor adapter doesn't force endless re-uploads.
 */
export const objectsMatch = (source: FileObject, destination: FileObject): boolean => {
    if (typeof source.size === "number" && typeof destination.size === "number" && source.size !== destination.size) {
        return false;
    }

    if (source.etag && destination.etag) {
        return source.etag === destination.etag;
    }

    if (typeof source.size === "number" && typeof destination.size === "number") {
        // Sizes match and there is no etag to contradict them.
        return true;
    }

    const sourceTime = source.lastModified === undefined ? undefined : Number(new Date(source.lastModified));
    const destinationTime = destination.lastModified === undefined ? undefined : Number(new Date(destination.lastModified));

    if (sourceTime !== undefined && destinationTime !== undefined && !Number.isNaN(sourceTime) && !Number.isNaN(destinationTime)) {
        // Re-upload only when the source is strictly newer.
        return sourceTime <= destinationTime;
    }

    return true;
};
