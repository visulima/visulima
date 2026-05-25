import { Readable } from "node:stream";

import { BaseStorage } from "../storage/storage";
import type { File as StorageFile, FilePart } from "../storage/utils/file";
import type { OperationOptions } from "../storage/types";

/**
 * Web-standard and Node-native body types accepted by {@link Files.upload}.
 */
export type FileBody = ArrayBuffer | ArrayBufferView | Blob | Buffer | NodeJS.ReadableStream | ReadableStream<Uint8Array> | string;

export interface UploadOptions {
    contentType?: string;
    metadata?: Record<string, unknown>;

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

export interface FilesOptions<TStorage extends BaseStorage = BaseStorage> {
    adapter: TStorage;

    /**
     * Default {@link OperationOptions} (`signal`, `timeout`, `retries`) merged into every call.
     * Per-call overrides win. The `signal` is combined with any per-call `signal` via
     * `AbortSignal.any`, so either one aborts the operation.
     */
    defaults?: OperationOptions;

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
 * Provider-agnostic facade over a {@link BaseStorage} instance.
 *
 * Provides a small, consistent surface (`upload`, `download`, `head`, `exists`, `delete`, `copy`,
 * `list`, `url`, `signedUploadUrl`) and a `raw` escape hatch to the adapter's native client.
 *
 * Each operation accepts per-call `signal`, `timeout`, and `retries` via {@link OperationOptions};
 * defaults set on the constructor are merged in (per-call wins). Single-key methods also accept an
 * array of keys (or {@link BulkUploadItem}s for `upload`) to run a bounded-concurrency batch and
 * return a structured `{ ..., errors? }` result instead of throwing on partial failure.
 *
 * When constructed with a `prefix`, every key is resolved relative to the prefix and the prefix is
 * stripped back off the keys returned in results — application code works in its own namespace.
 * @example
 * ```ts
 * import { Files, S3Storage } from "@visulima/storage";
 *
 * const files = new Files({
 *   adapter: new S3Storage({ bucket: "uploads", region: "us-east-1" }),
 *   prefix: "users",
 *   defaults: { timeout: 30_000 },
 * });
 *
 * await files.upload("123/avatar.png", buffer, { contentType: "image/png" });
 * const head = await files.head("123/avatar.png"); // reads users/123/avatar.png
 * const url = await files.url("123/avatar.png", { expiresIn: 900 });
 *
 * const { uploaded, errors } = await files.upload([
 *   { key: "a.png", body: a, contentType: "image/png" },
 *   { key: "b.png", body: b },
 * ], { concurrency: 4 });
 * ```
 */
export class Files<TStorage extends BaseStorage = BaseStorage> {
    public readonly adapter: TStorage;

    private readonly defaults: OperationOptions;

    private readonly prefix: string;

    public constructor(options: FilesOptions<TStorage>) {
        this.adapter = options.adapter;
        this.defaults = options.defaults ?? {};
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

    /** Strip the constructor prefix off a key returned by the adapter. Returns `null` when the key
     * is outside the prefix or is the bare prefix itself (used to filter `list()` results on a path
     * boundary and drop any synthetic directory entry the adapter may emit). */
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

    private mergeOptions(perCall?: OperationOptions): OperationOptions | undefined {
        return mergeOperationOptions(this.defaults, perCall);
    }

    /**
     * Upload a single object, or — when passed an array of {@link BulkUploadItem}s — bulk-upload
     * many in one call with bounded concurrency.
     */
    public upload(key: string, body: FileBody, options?: OperationOptions & UploadOptions): Promise<FileObject>;

    public upload(items: BulkUploadItem[], options?: BulkOptions): Promise<BulkUploadResult>;

    public async upload(
        keyOrItems: BulkUploadItem[] | string,
        bodyOrOptions?: BulkOptions | FileBody,
        maybeOptions?: OperationOptions & UploadOptions,
    ): Promise<BulkUploadResult | FileObject> {
        if (Array.isArray(keyOrItems)) {
            return this.uploadMany(keyOrItems, bodyOrOptions as BulkOptions | undefined);
        }

        return this.uploadOne(keyOrItems, bodyOrOptions as FileBody, maybeOptions);
    }

    private async uploadOne(key: string, body: FileBody, options: (OperationOptions & UploadOptions) | undefined): Promise<FileObject> {
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

        const operationOptions = this.mergeOptions(options);

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

        const part: FilePart = {
            body: stream,
            contentLength: size,
            id: file.id,
            start: 0,
        };

        const written = await this.adapter.write(part, operationOptions);
        const result = toFileObject(written, resolved);
        const stripped = this.stripPrefix(result.key);

        if (stripped !== null) {
            result.key = stripped;
        }

        return result;
    }

    private async uploadMany(items: BulkUploadItem[], bulkOptions: BulkOptions | undefined): Promise<BulkUploadResult> {
        const { concurrency = DEFAULT_BULK_CONCURRENCY, stopOnError = false, ...rest } = bulkOptions ?? {};

        const settled = await runConcurrent(
            items,
            async ({ body, key, ...uploadOptions }) => this.uploadOne(key, body, { ...rest, ...uploadOptions }),
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
    public download(key: string, options?: OperationOptions): Promise<DownloadResult>;

    public download(keys: string[], options?: BulkOptions): Promise<BulkDownloadResult>;

    public async download(keyOrKeys: string[] | string, options?: BulkOptions | OperationOptions): Promise<BulkDownloadResult | DownloadResult> {
        if (Array.isArray(keyOrKeys)) {
            return this.downloadMany(keyOrKeys, options as BulkOptions | undefined);
        }

        return this.downloadOne(keyOrKeys, options);
    }

    private async downloadOne(key: string, options: OperationOptions | undefined): Promise<DownloadResult> {
        const resolved = this.resolveKey(key);

        BaseStorage.assertSafeId(resolved);

        const file = await this.adapter.get({ id: resolved }, this.mergeOptions(options));

        return {
            body: file.content,
            contentType: file.contentType ?? "application/octet-stream",
            etag: file.ETag,
            key,
            lastModified: file.modifiedAt,
            metadata: file.metadata,
            size: typeof file.size === "number" ? file.size : undefined,
        };
    }

    private async downloadMany(keys: string[], bulkOptions: BulkOptions | undefined): Promise<BulkDownloadResult> {
        const { concurrency = DEFAULT_BULK_CONCURRENCY, stopOnError = false, ...rest } = bulkOptions ?? {};

        const settled = await runConcurrent(keys, async (key) => this.downloadOne(key, rest), {
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
            return this.headMany(keyOrKeys, options as BulkOptions | undefined);
        }

        return this.headOne(keyOrKeys, options);
    }

    private async headOne(key: string, options: OperationOptions | undefined): Promise<FileObject> {
        const resolved = this.resolveKey(key);

        BaseStorage.assertSafeId(resolved);

        const file = await this.adapter.getMeta(resolved, this.mergeOptions(options));
        const result = toFileObject(file, resolved);

        result.key = key;

        return result;
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
            return this.existsMany(keyOrKeys, options as BulkOptions | undefined);
        }

        return this.existsOne(keyOrKeys, options);
    }

    private async existsOne(key: string, options: OperationOptions | undefined): Promise<boolean> {
        const resolved = this.resolveKey(key);

        BaseStorage.assertSafeId(resolved);

        return this.adapter.exists({ id: resolved }, this.mergeOptions(options));
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
            return this.deleteMany(keyOrKeys, options as BulkOptions | undefined);
        }

        await this.deleteOne(keyOrKeys, options);

        return undefined;
    }

    private async deleteOne(key: string, options: OperationOptions | undefined): Promise<void> {
        const resolved = this.resolveKey(key);

        BaseStorage.assertSafeId(resolved);

        await this.adapter.delete({ id: resolved }, this.mergeOptions(options));
    }

    private async deleteMany(keys: string[], bulkOptions: BulkOptions | undefined): Promise<BulkDeleteResult> {
        const { concurrency = DEFAULT_BULK_CONCURRENCY, stopOnError = false, ...rest } = bulkOptions ?? {};
        const operationOptions = this.mergeOptions(rest);

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

            const response = resolvedIds.length > 0
                ? await this.adapter.deleteBatch(resolvedIds, operationOptions)
                : { failed: [], successful: [] };
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
        const resolvedSource = this.resolveKey(source);
        const resolvedDestination = this.resolveKey(destination);

        BaseStorage.assertSafeId(resolvedSource);
        BaseStorage.assertSafeId(resolvedDestination);

        const file = await this.adapter.copy(resolvedSource, resolvedDestination, {
            ...this.mergeOptions(options),
            storageClass: options?.storageClass,
        });
        const result = toFileObject(file, resolvedDestination);

        result.key = destination;

        return result;
    }

    /**
     * List objects in the bucket. Returned keys have any constructor prefix stripped off, and
     * keys outside the prefix namespace (e.g. `users-archive/` when prefix is `users`) are filtered
     * out. The optional `prefix` filter is interpreted *relative to the constructor prefix*.
     *
     * **Caveat with constructor prefix**: `limit` is applied by the underlying adapter *before*
     * the path-boundary filter runs, so the returned array may contain fewer than `limit` items
     * even when more in-namespace objects exist. Page through with adapter-specific APIs when you
     * need an exact in-namespace count.
     */
    public async list(options: ListOptions & OperationOptions = {}): Promise<FileObject[]> {
        const { limit, prefix: callerPrefix, ...operationOptions } = options;
        const files = await this.adapter.list(limit ?? 1000, this.mergeOptions(operationOptions));

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
    }

    public async url(key: string, options?: OperationOptions & SignedReadUrlOptions): Promise<string> {
        const resolved = this.resolveKey(key);

        BaseStorage.assertSafeId(resolved);

        return this.adapter.getReadUrl(resolved, { ...this.mergeOptions(options), ...options });
    }

    public async signedUploadUrl(key: string, options?: OperationOptions & SignedUploadUrlOptions): Promise<string> {
        const resolved = this.resolveKey(key);

        BaseStorage.assertSafeId(resolved);

        return this.adapter.getUploadUrl(resolved, { ...this.mergeOptions(options), ...options });
    }
}

export default Files;
