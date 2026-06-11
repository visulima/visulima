import type { Readable } from "node:stream";
import { PassThrough } from "node:stream";

import { BaseStorage } from "../storage/storage";
import type { OperationOptions } from "../storage/types";
import type { FilePart } from "../storage/utils/file";
import { ERRORS, throwErrorCode } from "../utils/errors";
import type { RetryConfig } from "../utils/retry";
import {
    assertNoRelativeSegments,
    DEFAULT_BULK_CONCURRENCY,
    mergeOperationOptions,
    normalizeBody,
    normalizePrefix,
    runConcurrent,
    safeInvoke,
    toBulkError,
    toFileObject,
} from "./internal";
import type {
    BulkDeleteResult,
    BulkDownloadOptions,
    BulkDownloadResult,
    BulkError,
    BulkExistsResult,
    BulkHeadResult,
    BulkMoveItem,
    BulkMoveResult,
    BulkOptions,
    BulkUploadItem,
    BulkUploadOptions,
    BulkUploadResult,
    DownloadOptions,
    DownloadRange,
    DownloadResult,
    FileBody,
    FileObject,
    FilesHooks,
    FilesOptions,
    HookActionType,
    HookEvent,
    ListAllOptions,
    ListDirectoryResult,
    ListOptions,
    MultipartOptions,
    SignedReadUrlOptions,
    SignedUploadUrlOptions,
    StorageCapabilities,
    UploadOptions,
    UploadProgress,
    UploadProgressCallback,
} from "./types";

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

    private readonly readonlyMode: boolean;

    public constructor(options: FilesOptions<TStorage>) {
        this.adapter = options.adapter;
        this.defaults = options.defaults ?? {};
        this.hooks = options.hooks ?? {};
        this.prefix = normalizePrefix(options.prefix ?? "");
        this.readonlyMode = options.readonly ?? false;
    }

    /**
     * Adapter capability + mode snapshot. Read before relying on an optional operation
     * (`range` downloads, custom `metadata`, `cacheControl`) so callers can branch instead of
     * hitting a `MethodNotAllowed` mid-flight. `readonly` reflects this view, not the adapter.
     */
    public get capabilities(): StorageCapabilities {
        return {
            cacheControl: this.adapter.supportsCacheControl,
            metadata: this.adapter.supportsMetadata,
            range: this.adapter.supportsRange,
            readonly: this.readonlyMode,
        };
    }

    /**
     * Derive a read-only view sharing this instance's adapter, prefix, defaults, and hooks. Every
     * mutating call on the returned client fails with `FilesError { code: "ReadOnly" }` before the
     * adapter is touched. Cheaper and safer than handing a writable client to code that should only
     * read.
     * @example
     * ```ts
     * const ro = files.readonly();
     * await ro.download("a.txt"); // ok
     * await ro.delete("a.txt");   // throws ReadOnly
     * ```
     */
    public readonly(): Files<TStorage> {
        return new Files<TStorage>({
            adapter: this.adapter,
            defaults: this.defaults,
            hooks: this.hooks,
            prefix: this.prefix,
            readonly: true,
        });
    }

    /** Fail closed before any adapter mutation when this view is read-only. */
    private assertWritable(): void {
        if (this.readonlyMode) {
            throwErrorCode(ERRORS.READ_ONLY, "This Files instance is read-only");
        }
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
        const normalized = key.replace(/^\/+/u, "");

        assertNoRelativeSegments(normalized, "key");

        if (!this.prefix) {
            return key;
        }

        return `${this.prefix}/${normalized}`;
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
        this.assertWritable();

        if (options?.metadata && Object.keys(options.metadata).length > 0 && !this.adapter.supportsMetadata) {
            throwErrorCode(ERRORS.METHOD_NOT_ALLOWED, `Adapter ${this.adapter.constructor.name} does not persist custom metadata`);
        }

        const control = options?.control;

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

            // Fold the control's abort signal into the operation so abort() cancels the adapter call,
            // and bind the body stream so pause()/resume() can drive its backpressure.
            const perCall: (OperationOptions & UploadOptions) | undefined = control
                ? { ...options, signal: options?.signal ? AbortSignal.any([options.signal, control.signal]) : control.signal }
                : options;

            const operationOptions = this.mergeOptions(perCall, { key, type: "upload" });
            const multipart = options?.multipart;

            control?._bind(stream, key);

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
            // Wrap the body in a PassThrough that emits per-chunk byte counts when the caller wants
            // progress (or a control is attached, which tracks bytes for serialize()) and the adapter
            // doesn't report its own. For buffered bodies of known length, also emit a coarse
            // start/done pair so a single callback can drive any UI without sniffing chunk deltas.
            const reportsNatively = this.adapter.reportsUploadProgress;
            const callback = options?.onProgress;
            const wantsProgress = !!callback || !!control;
            let progressStream: Readable = stream;

            if (wantsProgress && !reportsNatively) {
                let loaded = 0;
                const passthrough = new PassThrough();

                // Emit the synthetic `loaded: 0` start event **before** attaching the data listener so
                // callers always see the ordering start → chunk[1] → chunk[2] → ... — even if a stream
                // happens to emit synchronously the moment we pipe.
                if (size !== undefined && callback) {
                    safeInvoke(callback as (argument: unknown) => void, { loaded: 0, total: size });
                }

                stream.on("data", (chunk: Buffer | Uint8Array | string) => {
                    const chunkSize = typeof chunk === "string" ? Buffer.byteLength(chunk) : chunk.byteLength;

                    loaded += chunkSize;
                    control?._progress(loaded);

                    if (callback) {
                        safeInvoke(callback as (argument: unknown) => void, { loaded, total: size });
                    }
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
                ...(reportsNatively && callback && { onProgress: callback }),
            };

            const written = await this.adapter.write(part, operationOptions);

            control?._complete();

            const result = toFileObject(written, resolved);
            const stripped = this.stripPrefix(result.key);

            if (stripped !== null) {
                result.key = stripped;
            }

            return result;
        });
    }

    private async uploadMany(items: BulkUploadItem[], bulkOptions: BulkUploadOptions | undefined): Promise<BulkUploadResult> {
        this.assertWritable();

        const { concurrency = DEFAULT_BULK_CONCURRENCY, multipart, onProgress, stopOnError = false, ...rest } = bulkOptions ?? {};

        const settled = await runConcurrent(
            items,
            async ({ body, key, ...uploadOptions }) => {
                const perItemProgress =
                    uploadOptions.onProgress ??
                    (onProgress
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
        this.assertWritable();

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
                try {
                    const resolved = this.resolveKey(key);

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
        this.assertWritable();

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
        this.assertWritable();

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
     * Pass `delimiter` for directory-style listing: keys are collapsed into S3-style common
     * prefixes and the call returns `{ files, prefixes }` instead of a flat array (see
     * {@link ListDirectoryResult}). Objects with no further delimiter after the listing prefix come
     * back as `files`; everything below a shared boundary folds into a single `prefixes` entry.
     *
     * **Caveat with constructor prefix**: `limit` is applied by the underlying adapter *before*
     * the path-boundary filter runs, so the returned array may contain fewer than `limit` items
     * even when more in-namespace objects exist. Use {@link Files.listAll} when you need every
     * in-namespace object.
     */
    public async list(options?: Omit<ListOptions, "delimiter"> & OperationOptions): Promise<FileObject[]>;

    public async list(options: ListOptions & OperationOptions & { delimiter: string }): Promise<ListDirectoryResult>;

    public async list(options: ListOptions & OperationOptions = {}): Promise<FileObject[] | ListDirectoryResult> {
        return this.withHooks("list", {}, async () => {
            const { delimiter, limit, prefix: callerPrefix, ...operationOptions } = options;

            // Native pushdown: when the adapter can collapse common prefixes server-side, let it —
            // far cheaper than fetching every key and folding them in the facade. Otherwise fall
            // through to the synthesis path below.
            if (delimiter !== undefined && this.adapter.supportsDelimiter) {
                return this.listDirectoryNative(delimiter, callerPrefix, limit, operationOptions);
            }

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

            const scoped = callerPrefix ? mapped.filter((file) => file.key.startsWith(callerPrefix)) : mapped;

            if (delimiter === undefined) {
                return scoped;
            }

            // Directory-style listing: split each in-scope key on the first delimiter after the
            // listing prefix. No further delimiter → a direct child file; otherwise fold into a
            // common prefix (deduped, returned in sort order).
            const base = callerPrefix ?? "";
            const directFiles: FileObject[] = [];
            const prefixSet = new Set<string>();

            for (const object of scoped) {
                const remainder = object.key.slice(base.length);
                const index = remainder.indexOf(delimiter);

                if (index === -1) {
                    directFiles.push(object);
                } else {
                    prefixSet.add(base + remainder.slice(0, index + delimiter.length));
                }
            }

            return { files: directFiles, prefixes: [...prefixSet].toSorted() };
        });
    }

    /**
     * Native directory listing: push the `delimiter` down to an adapter that collapses common
     * prefixes server-side ({@link BaseStorage.supportsDelimiter}). Resolves the listing prefix
     * against the constructor prefix, then strips it back off the returned keys and prefixes so the
     * result matches the facade-synthesized shape.
     */
    private async listDirectoryNative(
        delimiter: string,
        callerPrefix: string | undefined,
        limit: number | undefined,
        operationOptions: OperationOptions,
    ): Promise<ListDirectoryResult> {
        const storagePrefix = [this.prefix, callerPrefix].filter(Boolean).join("/");

        const { files, prefixes } = await this.adapter.listDirectory({
            delimiter,
            ...(limit !== undefined && { limit }),
            ...(storagePrefix && { prefix: storagePrefix }),
            ...this.mergeOptions(operationOptions, { type: "list" }),
        });

        const mappedFiles: FileObject[] = [];

        for (const file of files) {
            const object = toFileObject(file);
            const stripped = this.stripPrefix(object.key);

            if (stripped === null) {
                continue;
            }

            object.key = stripped;
            mappedFiles.push(object);
        }

        const mappedPrefixes: string[] = [];

        for (const raw of prefixes) {
            const stripped = this.stripPrefix(raw);

            if (stripped !== null) {
                mappedPrefixes.push(stripped);
            }
        }

        return { files: mappedFiles, prefixes: mappedPrefixes.toSorted() };
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
        this.assertWritable();

        return this.withHooks("signedUploadUrl", { key }, async () => {
            const resolved = this.resolveKey(key);

            BaseStorage.assertSafeId(resolved);

            return this.adapter.getUploadUrl(resolved, { ...this.mergeOptions(options, { key, type: "signedUploadUrl" }), ...options });
        });
    }
}

export default Files;
