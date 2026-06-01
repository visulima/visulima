import { PassThrough, Readable } from "node:stream";

import { BaseStorage } from "../storage/storage";
import type { OperationOptions } from "../storage/types";
import type { File as StorageFile, FilePart } from "../storage/utils/file";
import type { RetryConfig } from "../utils/retry";

/**
 * Web-standard and Node-native body types accepted by {@link Files.upload}.
 */
export type FileBody = ArrayBuffer | ArrayBufferView | Blob | Buffer | NodeJS.ReadableStream | ReadableStream<Uint8Array> | string;

/**
 * Byte range for {@link Files.download}. Both bounds are 0-based and `end` is
 * **inclusive**, mirroring the HTTP `Range: bytes=start-end` header. Omit `end`
 * to read from `start` to EOF (e.g. resume an interrupted download).
 */
export interface DownloadRange {
    end?: number;
    start: number;
}

/**
 * Realtime upload progress report. `total` is omitted for streaming bodies of
 * unknown length. The optional `key` is set on the bulk array form so a single
 * callback can drive a multi-row UI.
 */
export interface UploadProgress {
    key?: string;
    loaded: number;
    total?: number;
}

export type UploadProgressCallback = (event: UploadProgress) => void;

/**
 * Multipart tuning for {@link Files.upload}. `true` enables multipart with
 * adapter defaults; an object lets the caller tune the per-part size and the
 * number of parts uploaded in parallel.
 */
export interface MultipartOptions {
    /** In-flight parts. Adapter-defined default. */
    concurrency?: number;
    /** Per-part size in bytes. Adapter-defined default. */
    partSize?: number;
}

export interface UploadOptions {
    contentType?: string;
    metadata?: Record<string, unknown>;

    /**
     * Enable multipart/chunked upload for large bodies. `true` uses the
     * adapter's defaults; pass an object to tune. Adapters that don't have a
     * multipart primitive ignore this option.
     */
    multipart?: MultipartOptions | boolean;

    /**
     * Realtime progress reporter. For buffered bodies a coarse start/done pair
     * is emitted. For streaming bodies each chunk is reported as it leaves the
     * facade. Adapters that report progress natively (`reportsUploadProgress`)
     * supersede this with byte-accurate events. A throwing callback can never
     * fail the upload — exceptions are swallowed.
     */
    onProgress?: UploadProgressCallback;

    /**
     * Explicit byte length. Required for {@link NodeJS.ReadableStream} and Web `ReadableStream`
     * inputs because their length is not derivable from the value itself; ignored otherwise.
     */
    size?: number;
    storageClass?: string;
}

export interface SignedReadUrlOptions {
    expiresIn?: number;
    responseContentDisposition?: string;
    responseContentType?: string;
}

export interface SignedUploadUrlOptions {
    contentLength?: number;
    contentType?: string;
    expiresIn?: number;
}

export interface ListOptions {
    limit?: number;
    prefix?: string;
}

export interface ListAllOptions {
    /** Per-page size requested from the adapter. */
    limit?: number;
    prefix?: string;
}

export interface DownloadOptions extends OperationOptions {
    /**
     * Fetch a contiguous byte slice instead of the whole object. Throws
     * `METHOD_NOT_ALLOWED` when the underlying adapter has `supportsRange =
     * false`, so the bandwidth saving is never silently lost client-side.
     */
    range?: DownloadRange;
}

/**
 * Provider-agnostic metadata-only view of an object.
 */
export interface FileObject {
    contentType: string;
    etag?: string;
    key: string;
    lastModified?: Date | number | string;
    metadata?: Record<string, unknown>;
    size?: number;
}

export interface DownloadResult extends FileObject {
    body: Buffer;
}

/**
 * Caller-facing event for {@link FilesOptions.hooks}. Mirrors what runs through
 * the facade (the public `key`/`keys` and the operation type) without leaking
 * adapter internals.
 */
export interface HookEvent {
    durationMs?: number;
    error?: Error;
    /** Source key for `copy`/`move`. */
    from?: string;
    key?: string;
    keys?: string[];
    /** Destination key for `copy`/`move`. */
    to?: string;
    type: HookActionType;
}

export type HookActionType =
    | "copy"
    | "delete"
    | "download"
    | "exists"
    | "head"
    | "list"
    | "listAll"
    | "move"
    | "signedUploadUrl"
    | "transfer"
    | "upload"
    | "url";

/**
 * Lifecycle hooks observed by the Files facade. Every hook is fire-and-forget —
 * called, not awaited — and exceptions are swallowed so a hook can never fail
 * the operation it observes.
 */
export interface FilesHooks {
    /** Called once per successful operation, with timing and result keys. */
    onAction?: (event: HookEvent) => void;
    /** Called once per failed operation, with the error attached. */
    onError?: (event: HookEvent & { error: Error }) => void;

    /**
     * Called when the underlying adapter retries an operation. Receives the
     * attempt number (1-based) and the error that triggered the retry.
     */
    onRetry?: (event: HookEvent & { attempt: number; error: Error }) => void;
}

export interface FilesOptions<TStorage extends BaseStorage = BaseStorage> {
    adapter: TStorage;

    /**
     * Default {@link OperationOptions} (`signal`, `timeout`, `retries`) merged into every call.
     * Per-call overrides win. The `signal` is combined with any per-call `signal` via
     * `AbortSignal.any`, so either one aborts the operation.
     */
    defaults?: OperationOptions;

    /**
     * Lifecycle hooks observed by every operation. Fire-and-forget — a throwing
     * hook is silently swallowed and never fails the call it observes.
     */
    hooks?: FilesHooks;

    /**
     * Namespace every key under this prefix. Reads, writes, copies, listings, URLs, and signed
     * uploads all resolve keys as `${prefix}/${key}`; returned keys (including from `list()`) have
     * the prefix stripped back off. Leading/trailing slashes are normalized so `"/users/"` and
     * `"users"` behave identically.
     *
     * `list()` scopes results on a path boundary, so `prefix: "users"` never matches the sibling
     * `users-archive/`.
     */
    prefix?: string;
}

/**
 * One item in a bulk upload call.
 */
export interface BulkUploadItem extends UploadOptions {
    body: FileBody;
    key: string;
}

/**
 * Per-call options shared by every bulk method (`upload`, `download`, `head`, `exists`, `delete`).
 */
export interface BulkOptions extends OperationOptions {
    /**
     * Maximum number of in-flight operations.
     * @default 8
     */
    concurrency?: number;

    /**
     * When `true`, stop dispatching new operations as soon as one fails. The already-issued
     * operations still complete. Defaults to `false`: every key is attempted and per-key failures
     * are collected in `errors`.
     * @default false
     */
    stopOnError?: boolean;
}

export interface BulkDownloadOptions extends BulkOptions {
    range?: DownloadRange;
}

export interface BulkUploadOptions extends BulkOptions {
    multipart?: MultipartOptions | boolean;
    onProgress?: UploadProgressCallback;
}

export interface BulkError {
    error: Error;
    key: string;
}

export interface BulkUploadResult {
    errors?: BulkError[];
    uploaded: FileObject[];
}

export interface BulkDownloadResult {
    downloaded: DownloadResult[];
    errors?: BulkError[];
}

export interface BulkHeadResult {
    errors?: BulkError[];
    files: FileObject[];
}

export interface BulkExistsResult {
    errors?: BulkError[];
    existing: string[];
    missing: string[];
}

export interface BulkDeleteResult {
    deleted: string[];
    errors?: BulkError[];
}

export interface BulkMoveItem {
    from: string;
    to: string;
}

export interface BulkMoveResult {
    errors?: BulkError[];
    moved: FileObject[];
}

const DEFAULT_BULK_CONCURRENCY = 8;

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
const normalizeBody = async (body: FileBody, sizeHint?: number): Promise<{ size?: number; stream: Readable }> => {
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

const toFileObject = (file: StorageFile, fallbackKey?: string): FileObject => {
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
 * Trim leading/trailing slashes; collapse internal repeats. Empty prefix → "".
 */
const normalizePrefix = (raw: string): string => {
    if (!raw) {
        return "";
    }

    return raw
        .split("/")
        .filter((segment) => segment.length > 0)
        .join("/");
};

/**
 * Merge constructor defaults with per-call OperationOptions. Per-call wins for `timeout`/`retries`;
 * signals are combined via `AbortSignal.any` so either one aborts the operation. Keys explicitly
 * set to `undefined` on the per-call object are ignored (do not clobber a default), so callers can
 * pass partial options without thinking about whether defaults exist.
 */
const mergeOperationOptions = (defaults: OperationOptions, perCall?: OperationOptions): OperationOptions | undefined => {
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
const runConcurrent = async <T, R>(
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

const toBulkError = (key: string, reason: unknown): BulkError => {
    if (reason instanceof Error) {
        return { error: reason, key };
    }

    return { error: new Error(typeof reason === "string" ? reason : "Unknown error", { cause: reason }), key };
};

/**
 * `Throws` cannot escape — hook contract is fire-and-forget.
 */
const safeInvoke = (callback: ((argument: unknown) => void) | undefined, value: unknown): void => {
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
 * Provider-agnostic facade over a {@link BaseStorage} instance.
 *
 * Provides a small, consistent surface (`upload`, `download`, `head`, `exists`, `delete`, `copy`,
 * `move`, `list`, `listAll`, `url`, `signedUploadUrl`) and a `raw` escape hatch to the adapter's native
 * client. A separate {@link transfer} top-level export streams every object from one Files instance
 * to another for cross-provider migration.
 *
 * Each operation accepts per-call `signal`, `timeout`, and `retries` via {@link OperationOptions};
 * defaults set on the constructor are merged in (per-call wins). Single-key methods also accept an
 * array of keys (or {@link BulkUploadItem}s for `upload`) to run a bounded-concurrency batch and
 * return a structured `{ ..., errors? }` result instead of throwing on partial failure.
 *
 * When constructed with a `prefix`, every key is resolved relative to the prefix and the prefix is
 * stripped back off the keys returned in results — application code works in its own namespace.
 *
 * Pass `hooks: { onAction, onError, onRetry }` to observe activity. Hooks are fire-and-forget and
 * never fail the operation they observe.
 * @example
 * ```ts
 * import { Files, S3Storage } from "@visulima/storage";
 *
 * const files = new Files({
 *   adapter: new S3Storage({ bucket: "uploads", region: "us-east-1" }),
 *   prefix: "users",
 *   defaults: { timeout: 30_000 },
 *   hooks: { onAction: (event) => console.log(event.type, event.key) },
 * });
 *
 * await files.upload("123/avatar.png", buffer, { contentType: "image/png" });
 * const head = await files.head("123/avatar.png");
 * for await (const file of files.listAll({ prefix: "123/" })) {
 *   console.log(file.key, file.size);
 * }
 * ```
 */
export class Files<TStorage extends BaseStorage = BaseStorage> {
    public readonly adapter: TStorage;

    private readonly defaults: OperationOptions;

    private readonly hooks: FilesHooks;

    private readonly prefix: string;

    public constructor(options: FilesOptions<TStorage>) {
        this.adapter = options.adapter;
        this.defaults = options.defaults ?? {};
        this.hooks = options.hooks ?? {};
        this.prefix = normalizePrefix(options.prefix ?? "");
    }

    /**
     * Escape hatch to the adapter's native client (S3Client, BlobServiceClient, ...).
     * Typed via the `TStorage` parameter, so pinning the adapter type at construction yields a
     * typed view of the native client. Returns `undefined` when the adapter has no native client
     * (e.g. DiskStorage).
     */
    public get raw(): TStorage["raw"] {
        return this.adapter.raw;
    }

    /** Resolve a caller-supplied key into the underlying storage key. */
    private resolveKey(key: string): string {
        return this.prefix ? `${this.prefix}/${key}` : key;
    }

    /**
     * Strip the constructor prefix off a key returned by the adapter. Returns `null` when the key
     * is outside the prefix or is the bare prefix itself (used to filter `list()` results on a path
     * boundary and drop any synthetic directory entry the adapter may emit).
     */
    private stripPrefix(rawKey: string): string | null {
        const key = rawKey.startsWith("/") ? rawKey.slice(1) : rawKey;

        if (!this.prefix) {
            return key;
        }

        const boundary = `${this.prefix}/`;

        if (key.startsWith(boundary)) {
            return key.slice(boundary.length);
        }

        return null;
    }

    /**
     * Merge constructor defaults with per-call options. When `hooks.onRetry` is configured,
     * fold a wrapped `onRetry` into the per-call retry config so the hook fires with
     * facade-level context (type, key, from/to) for each retry attempt the adapter performs.
     */
    private mergeOptions(
        perCall?: OperationOptions,
        hookContext?: Omit<HookEvent, "durationMs" | "error" | "type"> & { type: HookActionType },
    ): OperationOptions | undefined {
        const merged = mergeOperationOptions(this.defaults, perCall);

        if (!hookContext || !this.hooks.onRetry) {
            return merged;
        }

        const existing = merged?.retries;
        const retries: RetryConfig = typeof existing === "number" ? { maxRetries: existing } : { ...existing };
        const userOnRetry = retries.onRetry;
        const hookOnRetry = this.hooks.onRetry;

        retries.onRetry = (attempt: number, error: unknown): void => {
            if (userOnRetry) {
                try {
                    userOnRetry(attempt, error);
                } catch {
                    // user-provided onRetry is also fire-and-forget
                }
            }

            try {
                const message = typeof error === "string" ? error : "Unknown error";
                const normalized = error instanceof Error ? error : new Error(message, { cause: error });

                hookOnRetry({ ...hookContext, attempt, error: normalized });
            } catch {
                // hook contract: fire-and-forget
            }
        };

        return { ...merged, retries };
    }

    private emitAction(type: HookActionType, partial: Omit<HookEvent, "type">): void {
        if (!this.hooks.onAction) {
            return;
        }

        try {
            this.hooks.onAction({ type, ...partial });
        } catch {
            // fire-and-forget
        }
    }

    private emitError(type: HookActionType, partial: Omit<HookEvent, "error" | "type">, error: Error): void {
        if (!this.hooks.onError) {
            return;
        }

        try {
            this.hooks.onError({ error, type, ...partial });
        } catch {
            // fire-and-forget
        }
    }

    private async withHooks<R>(type: HookActionType, partial: Omit<HookEvent, "durationMs" | "error" | "type">, run: () => Promise<R>): Promise<R> {
        const started = Date.now();

        try {
            const result = await run();

            this.emitAction(type, { ...partial, durationMs: Date.now() - started });

            return result;
        } catch (error: unknown) {
            const message = typeof error === "string" ? error : "Unknown error";
            const normalized = error instanceof Error ? error : new Error(message, { cause: error });

            this.emitError(type, { ...partial, durationMs: Date.now() - started }, normalized);

            throw normalized;
        }
    }

    /**
     * Upload a single object, or — when passed an array of {@link BulkUploadItem}s — bulk-upload
     * many in one call with bounded concurrency.
     */
    public upload(key: string, body: FileBody, options?: OperationOptions & UploadOptions): Promise<FileObject>;

    public upload(items: BulkUploadItem[], options?: BulkUploadOptions): Promise<BulkUploadResult>;

    public async upload(
        keyOrItems: BulkUploadItem[] | string,
        bodyOrOptions?: BulkUploadOptions | FileBody,
        maybeOptions?: OperationOptions & UploadOptions,
    ): Promise<BulkUploadResult | FileObject> {
        if (Array.isArray(keyOrItems)) {
            return this.uploadMany(keyOrItems, bodyOrOptions as BulkUploadOptions | undefined);
        }

        return this.uploadOne(keyOrItems, bodyOrOptions as FileBody, maybeOptions);
    }

    private async uploadOne(key: string, body: FileBody, options: (OperationOptions & UploadOptions) | undefined): Promise<FileObject> {
        return this.withHooks("upload", { key }, async () => {
            const resolved = this.resolveKey(key);

            BaseStorage.assertSafeId(resolved);

            const { size: normalizedSize, stream } = await normalizeBody(body, options?.size);
            const size = options?.size ?? normalizedSize;

            const userMetadata = options?.metadata ?? {};
            const metadata = {
                ...userMetadata,
                name: resolved,
                ...(options?.contentType ? { type: options.contentType } : {}),
                ...(size === undefined ? {} : { size }),
            };

            const operationOptions = this.mergeOptions(options, { key, type: "upload" });
            const multipart = options?.multipart;

            const file = await this.adapter.create(
                {
                    contentType: options?.contentType,
                    id: resolved,
                    metadata,
                    originalName: resolved,
                    size,
                    storageClass: options?.storageClass,
                },
                operationOptions,
            );

            // If the caller wants progress and the adapter doesn't report its own, wrap the body
            // in a PassThrough that emits per-chunk byte counts. For buffered bodies whose total
            // length is known up-front, also emit a coarse start/done pair so a single callback
            // can drive any UI without sniffing for chunk-level deltas.
            const reportsNatively = this.adapter.reportsUploadProgress;
            const wantsProgress = !!options?.onProgress;
            let progressStream: Readable = stream;

            if (wantsProgress && !reportsNatively) {
                const callback = options?.onProgress as UploadProgressCallback;
                let loaded = 0;
                const passthrough = new PassThrough();

                // Emit the synthetic `loaded: 0` start event **before** attaching the data listener so
                // callers always see the ordering start → chunk[1] → chunk[2] → ... — even if a stream
                // happens to emit synchronously the moment we pipe.
                if (size !== undefined) {
                    safeInvoke(callback as (argument: unknown) => void, { loaded: 0, total: size });
                }

                stream.on("data", (chunk: Buffer | Uint8Array | string) => {
                    const chunkSize = typeof chunk === "string" ? Buffer.byteLength(chunk) : (chunk).byteLength;

                    loaded += chunkSize;
                    safeInvoke(callback as (argument: unknown) => void, { loaded, total: size });
                });

                stream.pipe(passthrough);
                progressStream = passthrough;
            }

            const part: FilePart & { multipart?: MultipartOptions | boolean; onProgress?: UploadProgressCallback } = {
                body: progressStream,
                contentLength: size,
                id: file.id,
                start: 0,
                ...(multipart !== undefined && { multipart }),
                ...(reportsNatively && wantsProgress && { onProgress: options?.onProgress }),
            };

            const written = await this.adapter.write(part, operationOptions);
            const result = toFileObject(written, resolved);
            const stripped = this.stripPrefix(result.key);

            if (stripped !== null) {
                result.key = stripped;
            }

            return result;
        });
    }

    private async uploadMany(items: BulkUploadItem[], bulkOptions: BulkUploadOptions | undefined): Promise<BulkUploadResult> {
        const { concurrency = DEFAULT_BULK_CONCURRENCY, multipart, onProgress, stopOnError = false, ...rest } = bulkOptions ?? {};

        const settled = await runConcurrent(
            items,
            async ({ body, key, ...uploadOptions }) => {
                const perItemProgress
                    = uploadOptions.onProgress
                    ?? (onProgress
                        ? (event: UploadProgress) => {
                            onProgress({ ...event, key });
                        }
                        : undefined);

                return this.uploadOne(key, body, {
                    ...rest,
                    multipart,
                    ...uploadOptions,
                    ...(perItemProgress && { onProgress: perItemProgress }),
                });
            },
            { concurrency, signal: rest.signal, stopOnError },
        );

        const uploaded: FileObject[] = [];
        const errors: BulkError[] = [];

        for (const [index, result] of settled.entries()) {
            const item = items[index] as BulkUploadItem;

            if (!result) {
                errors.push(toBulkError(item.key, new Error("Operation skipped (stopOnError)")));

                continue;
            }

            if (result.status === "fulfilled") {
                uploaded.push(result.value);
            } else {
                errors.push(toBulkError(item.key, result.reason));
            }
        }

        return errors.length > 0 ? { errors, uploaded } : { uploaded };
    }

    /**
     * Download a single object, or — when passed an array of keys — bulk-download many in one
     * call with bounded concurrency.
     */
    public download(key: string, options?: DownloadOptions): Promise<DownloadResult>;

    public download(keys: string[], options?: BulkDownloadOptions): Promise<BulkDownloadResult>;

    public async download(keyOrKeys: string[] | string, options?: BulkDownloadOptions | DownloadOptions): Promise<BulkDownloadResult | DownloadResult> {
        if (Array.isArray(keyOrKeys)) {
            return this.downloadMany(keyOrKeys, options);
        }

        return this.downloadOne(keyOrKeys, options);
    }

    private assertRangeSupported(range: DownloadRange | undefined): void {
        if (!range) {
            return;
        }

        if (!Number.isFinite(range.start) || range.start < 0) {
            throw new TypeError(`Invalid range.start: ${String(range.start)}`);
        }

        if (range.end !== undefined && (!Number.isFinite(range.end) || range.end < range.start)) {
            throw new TypeError(`Invalid range.end: ${String(range.end)}`);
        }

        if (!this.adapter.supportsRange) {
            throw new Error(`Adapter ${this.adapter.constructor.name} does not support range downloads`);
        }
    }

    private async downloadOne(key: string, options: DownloadOptions | undefined): Promise<DownloadResult> {
        return this.withHooks("download", { key }, async () => {
            const resolved = this.resolveKey(key);

            BaseStorage.assertSafeId(resolved);
            this.assertRangeSupported(options?.range);

            const merged = this.mergeOptions(options, { key, type: "download" }) ?? {};
            const adapterOptions = options?.range ? { ...merged, range: options.range } : merged;

            const file = await this.adapter.get({ id: resolved }, adapterOptions);

            return {
                body: file.content,
                contentType: file.contentType ?? "application/octet-stream",
                etag: file.ETag,
                key,
                lastModified: file.modifiedAt,
                metadata: file.metadata,
                size: typeof file.size === "number" ? file.size : undefined,
            };
        });
    }

    private async downloadMany(keys: string[], bulkOptions: BulkDownloadOptions | undefined): Promise<BulkDownloadResult> {
        const { concurrency = DEFAULT_BULK_CONCURRENCY, range, stopOnError = false, ...rest } = bulkOptions ?? {};

        const settled = await runConcurrent(keys, async (key) => this.downloadOne(key, range ? { ...rest, range } : rest), {
            concurrency,
            signal: rest.signal,
            stopOnError,
        });

        const downloaded: DownloadResult[] = [];
        const errors: BulkError[] = [];

        for (const [index, result] of settled.entries()) {
            const key = keys[index] as string;

            if (!result) {
                errors.push(toBulkError(key, new Error("Operation skipped (stopOnError)")));

                continue;
            }

            if (result.status === "fulfilled") {
                downloaded.push(result.value);
            } else {
                errors.push(toBulkError(key, result.reason));
            }
        }

        return errors.length > 0 ? { downloaded, errors } : { downloaded };
    }

    /**
     * Fetch metadata for a single object, or — when passed an array of keys — bulk-head many in
     * one call with bounded concurrency.
     */
    public head(key: string, options?: OperationOptions): Promise<FileObject>;

    public head(keys: string[], options?: BulkOptions): Promise<BulkHeadResult>;

    public async head(keyOrKeys: string[] | string, options?: BulkOptions | OperationOptions): Promise<BulkHeadResult | FileObject> {
        if (Array.isArray(keyOrKeys)) {
            return this.headMany(keyOrKeys, options);
        }

        return this.headOne(keyOrKeys, options);
    }

    private async headOne(key: string, options: OperationOptions | undefined): Promise<FileObject> {
        return this.withHooks("head", { key }, async () => {
            const resolved = this.resolveKey(key);

            BaseStorage.assertSafeId(resolved);

            const file = await this.adapter.getMeta(resolved, this.mergeOptions(options, { key, type: "head" }));
            const result = toFileObject(file, resolved);

            result.key = key;

            return result;
        });
    }

    private async headMany(keys: string[], bulkOptions: BulkOptions | undefined): Promise<BulkHeadResult> {
        const { concurrency = DEFAULT_BULK_CONCURRENCY, stopOnError = false, ...rest } = bulkOptions ?? {};

        const settled = await runConcurrent(keys, async (key) => this.headOne(key, rest), {
            concurrency,
            signal: rest.signal,
            stopOnError,
        });

        const files: FileObject[] = [];
        const errors: BulkError[] = [];

        for (const [index, result] of settled.entries()) {
            const key = keys[index] as string;

            if (!result) {
                errors.push(toBulkError(key, new Error("Operation skipped (stopOnError)")));

                continue;
            }

            if (result.status === "fulfilled") {
                files.push(result.value);
            } else {
                errors.push(toBulkError(key, result.reason));
            }
        }

        return errors.length > 0 ? { errors, files } : { files };
    }

    /**
     * Resolves to `true`/`false` for a single key, or — when passed an array — splits the keys
     * into `existing` and `missing` arrays. Hard errors (auth, transport) are reported in
     * `errors`. Never throws for a missing object.
     */
    public exists(key: string, options?: OperationOptions): Promise<boolean>;

    public exists(keys: string[], options?: BulkOptions): Promise<BulkExistsResult>;

    public async exists(keyOrKeys: string[] | string, options?: BulkOptions | OperationOptions): Promise<BulkExistsResult | boolean> {
        if (Array.isArray(keyOrKeys)) {
            return this.existsMany(keyOrKeys, options);
        }

        return this.existsOne(keyOrKeys, options);
    }

    private async existsOne(key: string, options: OperationOptions | undefined): Promise<boolean> {
        return this.withHooks("exists", { key }, async () => {
            const resolved = this.resolveKey(key);

            BaseStorage.assertSafeId(resolved);

            return this.adapter.exists({ id: resolved }, this.mergeOptions(options, { key, type: "exists" }));
        });
    }

    private async existsMany(keys: string[], bulkOptions: BulkOptions | undefined): Promise<BulkExistsResult> {
        const { concurrency = DEFAULT_BULK_CONCURRENCY, stopOnError = false, ...rest } = bulkOptions ?? {};

        const settled = await runConcurrent(keys, async (key) => this.existsOne(key, rest), {
            concurrency,
            signal: rest.signal,
            stopOnError,
        });

        const existing: string[] = [];
        const missing: string[] = [];
        const errors: BulkError[] = [];

        for (const [index, result] of settled.entries()) {
            const key = keys[index] as string;

            if (!result) {
                errors.push(toBulkError(key, new Error("Operation skipped (stopOnError)")));

                continue;
            }

            if (result.status === "fulfilled") {
                if (result.value) {
                    existing.push(key);
                } else {
                    missing.push(key);
                }
            } else {
                errors.push(toBulkError(key, result.reason));
            }
        }

        return errors.length > 0 ? { errors, existing, missing } : { existing, missing };
    }

    /**
     * Delete a single object (resolves to `void`, throws on failure), or — when passed an array
     * of keys — delete many in one call. Adapters with a native bulk-delete primitive (S3's
     * `DeleteObjects`, Supabase's `remove`, UploadThing's `deleteFiles`) use it via
     * {@link BaseStorage.deleteBatch}; otherwise the keys are fanned out with bounded concurrency.
     */
    public delete(key: string, options?: OperationOptions): Promise<void>;

    public delete(keys: string[], options?: BulkOptions): Promise<BulkDeleteResult>;

    public async delete(keyOrKeys: string[] | string, options?: BulkOptions | OperationOptions): Promise<BulkDeleteResult | void> {
        if (Array.isArray(keyOrKeys)) {
            return this.deleteMany(keyOrKeys, options);
        }

        await this.deleteOne(keyOrKeys, options);

        return undefined;
    }

    private async deleteOne(key: string, options: OperationOptions | undefined): Promise<void> {
        await this.withHooks("delete", { key }, async () => {
            const resolved = this.resolveKey(key);

            BaseStorage.assertSafeId(resolved);

            await this.adapter.delete({ id: resolved }, this.mergeOptions(options, { key, type: "delete" }));
        });
    }

    private async deleteMany(keys: string[], bulkOptions: BulkOptions | undefined): Promise<BulkDeleteResult> {
        const { concurrency = DEFAULT_BULK_CONCURRENCY, stopOnError = false, ...rest } = bulkOptions ?? {};
        const operationOptions = this.mergeOptions(rest, { keys, type: "delete" });

        // Prefer the adapter's native bulk primitive when present and the caller hasn't asked for
        // stop-on-first-error semantics (deleteBatch always attempts every key).
        if (!stopOnError && typeof this.adapter.deleteBatch === "function") {
            const validKeys: string[] = [];
            const resolvedIds: string[] = [];
            const earlyErrors: BulkError[] = [];

            for (const key of keys) {
                const resolved = this.resolveKey(key);

                try {
                    BaseStorage.assertSafeId(resolved);
                    validKeys.push(key);
                    resolvedIds.push(resolved);
                } catch (error: unknown) {
                    earlyErrors.push(toBulkError(key, error));
                }
            }

            return this.withHooks("delete", { keys: validKeys }, async () => {
                const response = resolvedIds.length > 0 ? await this.adapter.deleteBatch(resolvedIds, operationOptions) : { failed: [], successful: [] };
                const idIndex = new Map(resolvedIds.map((id, index) => [id, index]));

                const deleted: string[] = response.successful.map((file) => {
                    const stripped = this.stripPrefix(file.id);

                    return stripped ?? file.id;
                });
                const errors: BulkError[] = [
                    ...earlyErrors,
                    ...response.failed.map(({ error, id }) => {
                        const index = idIndex.get(id);
                        const callerKey = index === undefined ? id : (validKeys[index] as string);

                        return toBulkError(callerKey, new Error(error));
                    }),
                ];

                return errors.length > 0 ? { deleted, errors } : { deleted };
            });
        }

        const settled = await runConcurrent(keys, async (key) => this.deleteOne(key, rest), {
            concurrency,
            signal: rest.signal,
            stopOnError,
        });

        const deleted: string[] = [];
        const errors: BulkError[] = [];

        for (const [index, result] of settled.entries()) {
            const key = keys[index] as string;

            if (!result) {
                errors.push(toBulkError(key, new Error("Operation skipped (stopOnError)")));

                continue;
            }

            if (result.status === "fulfilled") {
                deleted.push(key);
            } else {
                errors.push(toBulkError(key, result.reason));
            }
        }

        return errors.length > 0 ? { deleted, errors } : { deleted };
    }

    /**
     * Copy `source` to `destination` (both resolved under any constructor prefix). Returns the
     * destination object's metadata with the caller-facing (un-prefixed) key.
     */
    public async copy(source: string, destination: string, options?: OperationOptions & { storageClass?: string }): Promise<FileObject> {
        return this.withHooks("copy", { from: source, to: destination }, async () => {
            const resolvedSource = this.resolveKey(source);
            const resolvedDestination = this.resolveKey(destination);

            BaseStorage.assertSafeId(resolvedSource);
            BaseStorage.assertSafeId(resolvedDestination);

            const file = await this.adapter.copy(resolvedSource, resolvedDestination, {
                ...this.mergeOptions(options, { from: source, to: destination, type: "copy" }),
                storageClass: options?.storageClass,
            });
            const result = toFileObject(file, resolvedDestination);

            result.key = destination;

            return result;
        });
    }

    /**
     * Rename `source` to `destination`. Uses the adapter's native rename where one exists
     * (DiskStorage atomic move, Cloudinary server-side rename) and falls back to
     * `copy` + `delete` otherwise. Moving a key onto itself is a no-op. Also accepts an array of
     * `{ from, to }` items for bounded-concurrency bulk moves; per-item failures land in `errors`.
     */
    public move(from: string, to: string, options?: OperationOptions & { storageClass?: string }): Promise<FileObject>;

    public move(items: BulkMoveItem[], options?: BulkOptions): Promise<BulkMoveResult>;

    public async move(
        fromOrItems: BulkMoveItem[] | string,
        toOrOptions?: BulkOptions | string,
        maybeOptions?: OperationOptions & { storageClass?: string },
    ): Promise<BulkMoveResult | FileObject> {
        if (Array.isArray(fromOrItems)) {
            return this.moveMany(fromOrItems, toOrOptions as BulkOptions | undefined);
        }

        return this.moveOne(fromOrItems, toOrOptions as string, maybeOptions);
    }

    private async moveOne(from: string, to: string, options: (OperationOptions & { storageClass?: string }) | undefined): Promise<FileObject> {
        return this.withHooks("move", { from, to }, async () => {
            const resolvedFrom = this.resolveKey(from);

            BaseStorage.assertSafeId(resolvedFrom);

            // No-op when source and destination match: read meta directly so we don't emit a
            // second `head` hook event for what the caller invoked as a `move`.
            if (from === to) {
                const file = await this.adapter.getMeta(resolvedFrom, this.mergeOptions(options, { from, to, type: "move" }));
                const result = toFileObject(file, resolvedFrom);

                result.key = from;

                return result;
            }

            const resolvedTo = this.resolveKey(to);

            BaseStorage.assertSafeId(resolvedTo);

            const adapterOptions: OperationOptions & { storageClass?: string } = {
                ...this.mergeOptions(options, { from, to, type: "move" }),
                ...(options?.storageClass !== undefined && { storageClass: options.storageClass }),
            };
            const file = await this.adapter.move(resolvedFrom, resolvedTo, adapterOptions);
            const result = toFileObject(file, resolvedTo);

            result.key = to;

            return result;
        });
    }

    private async moveMany(items: BulkMoveItem[], bulkOptions: BulkOptions | undefined): Promise<BulkMoveResult> {
        const { concurrency = DEFAULT_BULK_CONCURRENCY, stopOnError = false, ...rest } = bulkOptions ?? {};

        const settled = await runConcurrent(items, async ({ from, to }) => this.moveOne(from, to, rest), {
            concurrency,
            signal: rest.signal,
            stopOnError,
        });

        const moved: FileObject[] = [];
        const errors: BulkError[] = [];

        for (const [index, result] of settled.entries()) {
            const item = items[index] as BulkMoveItem;

            if (!result) {
                errors.push(toBulkError(item.from, new Error("Operation skipped (stopOnError)")));

                continue;
            }

            if (result.status === "fulfilled") {
                moved.push(result.value);
            } else {
                errors.push(toBulkError(item.from, result.reason));
            }
        }

        return errors.length > 0 ? { errors, moved } : { moved };
    }

    /**
     * List objects in the bucket. Returned keys have any constructor prefix stripped off, and
     * keys outside the prefix namespace (e.g. `users-archive/` when prefix is `users`) are filtered
     * out. The optional `prefix` filter is interpreted *relative to the constructor prefix*.
     *
     * **Caveat with constructor prefix**: `limit` is applied by the underlying adapter *before*
     * the path-boundary filter runs, so the returned array may contain fewer than `limit` items
     * even when more in-namespace objects exist. Use {@link Files.listAll} when you need every
     * in-namespace object.
     */
    public async list(options: ListOptions & OperationOptions = {}): Promise<FileObject[]> {
        return this.withHooks("list", {}, async () => {
            const { limit, prefix: callerPrefix, ...operationOptions } = options;
            const files = await this.adapter.list(limit ?? 1000, this.mergeOptions(operationOptions, { type: "list" }));

            const mapped: FileObject[] = [];

            for (const file of files) {
                const object = toFileObject(file);
                const stripped = this.stripPrefix(object.key);

                // Outside our prefix namespace (e.g. `users-archive/` when prefix is `users`).
                if (stripped === null) {
                    continue;
                }

                object.key = stripped;
                mapped.push(object);
            }

            if (callerPrefix) {
                return mapped.filter((file) => file.key.startsWith(callerPrefix));
            }

            return mapped;
        });
    }

    /**
     * Walk every object in the bucket. Yields one {@link FileObject} at a time as an async
     * iterable; pages internally so callers don't have to thread a cursor. Returned keys have any
     * constructor prefix stripped off and out-of-namespace keys are filtered out, just like
     * {@link Files.list}.
     *
     * Most adapters return all objects in a single `list()` call (the default `limit` is 1000),
     * so this is effectively `list` + iteration for them. Adapters that paginate natively can
     * override `list` to honour the per-page `limit` and `listAll` will keep pulling pages until
     * the page is short.
     * @example
     * ```ts
     * for await (const file of files.listAll({ prefix: "avatars/" })) {
     *   console.log(file.key, file.size);
     * }
     * ```
     */
    public async *listAll(options: ListAllOptions & OperationOptions = {}): AsyncGenerator<FileObject, void, void> {
        const { limit, prefix: callerPrefix, ...operationOptions } = options;
        const pageSize = Math.max(1, limit ?? 1000);
        const started = Date.now();
        const seen = new Set<string>();

        let errored: Error | undefined;

        try {
            // Most adapters answer with everything in a single call; a few paginate. We can't rely
            // on `page.length < pageSize` to terminate — the abstract list() contract doesn't
            // require honoring the limit, and several adapters (memory, disk) ignore it entirely.
            // Terminate when an iteration yields zero *new* keys instead. Per-key dedup also guards
            // against adapters that hand back the same set on each call.

            while (true) {
                const page = await this.adapter.list(pageSize, this.mergeOptions(operationOptions, { type: "listAll" }));
                let yielded = 0;

                for (const file of page) {
                    const object = toFileObject(file);
                    const stripped = this.stripPrefix(object.key);

                    if (stripped === null) {
                        continue;
                    }

                    object.key = stripped;

                    if (callerPrefix && !object.key.startsWith(callerPrefix)) {
                        continue;
                    }

                    if (seen.has(object.key)) {
                        continue;
                    }

                    seen.add(object.key);
                    yielded += 1;
                    yield object;
                }

                // Exit once a page contributes no new keys: either the adapter is single-shot
                // (`list` returns the whole set every call) or pagination is exhausted.
                if (yielded === 0 || page.length < pageSize) {
                    break;
                }
            }
        } catch (error: unknown) {
            const message = typeof error === "string" ? error : "Unknown error";

            errored = error instanceof Error ? error : new Error(message, { cause: error });

            throw errored;
        } finally {
            // Emit a single terminal hook event whether the walk completed, threw, or was abandoned
            // by an early `break` in the consumer's `for await` loop.
            const durationMs = Date.now() - started;

            if (errored) {
                this.emitError("listAll", { durationMs }, errored);
            } else {
                this.emitAction("listAll", { durationMs });
            }
        }
    }

    public async url(key: string, options?: OperationOptions & SignedReadUrlOptions): Promise<string> {
        return this.withHooks("url", { key }, async () => {
            const resolved = this.resolveKey(key);

            BaseStorage.assertSafeId(resolved);

            return this.adapter.getReadUrl(resolved, { ...this.mergeOptions(options, { key, type: "url" }), ...options });
        });
    }

    public async signedUploadUrl(key: string, options?: OperationOptions & SignedUploadUrlOptions): Promise<string> {
        return this.withHooks("signedUploadUrl", { key }, async () => {
            const resolved = this.resolveKey(key);

            BaseStorage.assertSafeId(resolved);

            return this.adapter.getUploadUrl(resolved, { ...this.mergeOptions(options, { key, type: "signedUploadUrl" }), ...options });
        });
    }
}

/**
 * Per-key event reported to {@link TransferOptions.onProgress}.
 */
export interface TransferProgress {
    /** 1-based index of the current key in walk order. */
    done: number;
    error?: Error;
    key: string;
    status: "errored" | "skipped" | "transferred";
}

export interface TransferOptions extends OperationOptions {
    /**
     * In-flight key transfers.
     * @default 8
     */
    concurrency?: number;

    /** Per-page size requested from the source adapter while walking. */
    limit?: number;

    /** Fire-and-forget progress reporter. Throws are swallowed. */
    onProgress?: (event: TransferProgress) => void;

    /**
     * When `false`, skip keys that already exist at the destination. When `true`, always upload.
     * @default false
     */
    overwrite?: boolean;

    /** Restrict the walk to this prefix on the source. */
    prefix?: string;

    /**
     * When `true`, the first failing transfer rejects {@link transfer} instead of being
     * collected in `errors`.
     * @default false
     */
    stopOnError?: boolean;

    /** Transform each source key into the destination key. Defaults to identity. */
    transformKey?: (key: string) => string;
}

export interface TransferResult {
    errors?: BulkError[];
    skipped: string[];
    transferred: string[];
}

/**
 * Streams every object from `source` to `destination` for cross-provider migration.
 * Built entirely on the public {@link Files} surface — no adapter implements anything new.
 *
 * Each object is downloaded and re-uploaded with bounded concurrency. By default missing
 * destination keys are uploaded and existing keys are skipped — pass `overwrite: true` to force
 * re-upload. Body, content type, and user metadata travel; `etag`/`lastModified` are
 * destination-assigned.
 *
 * Like the other bulk methods, `transfer` doesn't throw on partial failure: results come back as
 * `{ transferred, skipped, errors? }`.
 * @example
 * ```ts
 * const from = new Files({ adapter: new S3Storage({ bucket: "old", ... }) });
 * const to = new Files({ adapter: new GCSStorage({ bucket: "new", ... }) });
 *
 * const { transferred, skipped, errors } = await transfer(from, to, {
 *   prefix: "uploads/",
 *   onProgress: ({ done, key, status }) => console.log(done, key, status),
 * });
 * ```
 */
export const transfer = async (source: Files, destination: Files, options: TransferOptions = {}): Promise<TransferResult> => {
    const { concurrency = DEFAULT_BULK_CONCURRENCY, limit, onProgress, overwrite = false, prefix, signal, stopOnError = false, transformKey } = options;

    const transferred: string[] = [];
    const skipped: string[] = [];
    const errors: BulkError[] = [];

    let stopped = false;
    let done = 0;

    const emit = (event: TransferProgress): void => {
        if (!onProgress) {
            return;
        }

        try {
            onProgress(event);
        } catch {
            // fire-and-forget
        }
    };

    const walk = source.listAll({ ...(prefix !== undefined && { prefix }), ...(limit !== undefined && { limit }) });

    const transferOne = async (sourceKey: string): Promise<void> => {
        if (stopped || signal?.aborted) {
            return;
        }

        const destinationKey = transformKey ? transformKey(sourceKey) : sourceKey;

        try {
            if (!overwrite) {
                const exists = await destination.exists(destinationKey, { signal });

                if (exists) {
                    skipped.push(sourceKey);
                    done += 1;
                    emit({ done, key: sourceKey, status: "skipped" });

                    return;
                }
            }

            const downloaded = await source.download(sourceKey, { signal });

            await destination.upload(destinationKey, downloaded.body, {
                ...(downloaded.contentType && { contentType: downloaded.contentType }),
                ...(downloaded.metadata && { metadata: downloaded.metadata }),
                signal,
            });

            transferred.push(sourceKey);
            done += 1;
            emit({ done, key: sourceKey, status: "transferred" });
        } catch (error: unknown) {
            const bulk = toBulkError(sourceKey, error);

            errors.push(bulk);
            done += 1;
            emit({ done, error: bulk.error, key: sourceKey, status: "errored" });

            if (stopOnError) {
                stopped = true;

                throw bulk.error;
            }
        }
    };

    if (stopOnError) {
        // Sequential when stop-on-error so failure semantics are deterministic.
        try {
            for await (const file of walk) {
                if (stopped || signal?.aborted) {
                    break;
                }

                try {
                    await transferOne(file.key);
                } catch {
                    break;
                }
            }
        } finally {
            // Make sure the underlying listAll generator's `finally` runs (and emits its hook) even
            // if we broke out early. AsyncIterators don't auto-`return()` from a `for await` that
            // exits via `break`/`throw` when the iterator is held in a variable.
            await walk.return?.();
        }

        return errors.length > 0 ? { errors, skipped, transferred } : { skipped, transferred };
    }

    // Streaming worker pool: N workers pull the next key from the shared async iterator. Avoids
    // buffering every key from a large bucket in memory before any transfer begins.
    const width = Math.max(1, concurrency);

    const worker = async (): Promise<void> => {
        while (!stopped && !signal?.aborted) {
            // Sequential pull from a shared iterator — workers race on `next()`, the runtime
            // serializes them so each key is handed out exactly once.
            const next = await walk.next();

            if (next.done) {
                return;
            }

            await transferOne(next.value.key);
        }
    };

    try {
        await Promise.all(Array.from({ length: width }, () => worker()));
    } finally {
        await walk.return?.();
    }

    return errors.length > 0 ? { errors, skipped, transferred } : { skipped, transferred };
};

export default Files;
