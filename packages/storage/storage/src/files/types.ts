import type { BaseStorage } from "../storage/storage";
import type { OperationOptions } from "../storage/types";
import type { UploadControl } from "./upload-control";

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

/** Lifecycle state of an {@link UploadControl}. */
export type UploadControlState = "aborted" | "completed" | "idle" | "paused" | "uploading";

/**
 * Serializable snapshot of an {@link UploadControl}, returned by {@link UploadControl.serialize}
 * and accepted by {@link UploadControl.from}. Captures the key and bytes observed so a UI can
 * restore progress display across reloads. Note: byte-accurate *resume* of the transfer itself is
 * a protocol concern handled by the TUS / multipart handlers and `@visulima/storage-client`; a
 * rehydrated control restarts the body from the beginning.
 */
export interface UploadControlToken {
    key?: string;
    loaded: number;
    version: 1;
}

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

    /**
     * Pause / resume / abort handle for this upload. Pausing applies backpressure to the body
     * stream (effective for streaming bodies and streaming adapters; buffered adapters consume the
     * whole body at once and cannot be paused mid-flight); aborting cancels the operation via the
     * merged {@link OperationOptions.signal}. See {@link UploadControl}.
     */
    control?: UploadControl;
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
    /**
     * Collapse keys that share a path segment into S3-style common prefixes ("directories").
     * When set, {@link Files.list} returns a {@link ListDirectoryResult} (`{ files, prefixes }`)
     * instead of a flat array: keys with no further `delimiter` after the listing prefix come back
     * as `files`, and everything below a shared boundary is folded into a single `prefixes` entry.
     * Pass `"/"` for conventional folder semantics.
     */
    delimiter?: string;
    limit?: number;
    prefix?: string;
}

/**
 * Directory-style listing returned by {@link Files.list} when a `delimiter` is supplied.
 */
export interface ListDirectoryResult {
    /** Objects that live directly under the listing prefix (no further delimiter). */
    files: FileObject[];
    /** Common prefixes ("subdirectories") one delimiter level below the listing prefix. */
    prefixes: string[];
}

export interface ListAllOptions {
    /** Per-page size requested from the adapter. */
    limit?: number;
    prefix?: string;
}

/**
 * Capability snapshot for the adapter behind a {@link Files} instance, surfaced so callers can
 * branch (or fail fast) instead of discovering an unsupported operation mid-flight.
 */
export interface StorageCapabilities {
    /** The adapter honours an object `cacheControl` directive on write. */
    cacheControl: boolean;
    /** The adapter persists and returns user-supplied key/value metadata. */
    metadata: boolean;
    /** The adapter honours byte-range downloads (`download({ range })`). */
    range: boolean;
    /** This `Files` view rejects every mutating operation. */
    readonly: boolean;
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

    /**
     * When `true`, every mutating operation (`upload`, `delete`, `copy`, `move`, `signedUploadUrl`)
     * fails immediately with `FilesError { code: "ReadOnly" }` before the adapter is touched; reads
     * (`download`, `head`, `exists`, `list`, `listAll`, `url`) pass through. Derive a locked view of
     * an existing client with {@link Files.readonly} instead of threading the flag manually.
     * @default false
     */
    readonly?: boolean;
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
 * Per-key event reported to {@link SyncOptions.onProgress}.
 */
export interface SyncProgress {
    /** 1-based index of the current key in walk order. */
    done: number;
    error?: Error;
    key: string;
    status: "deleted" | "errored" | "skipped" | "unchanged" | "updated" | "uploaded";
}

export interface SyncOptions extends OperationOptions {
    /**
     * In-flight key operations.
     * @default 8
     */
    concurrency?: number;

    /**
     * Compute the plan without writing anything. The returned `uploaded`/`updated`/`deleted` lists
     * describe what *would* happen; the destination is left untouched.
     * @default false
     */
    dryRun?: boolean;

    /** Per-page size requested from the source adapter while walking. */
    limit?: number;

    /** Fire-and-forget progress reporter. Throws are swallowed. */
    onProgress?: (event: SyncProgress) => void;

    /** Restrict the sync to this prefix on both source and destination. */
    prefix?: string;

    /**
     * Delete destination keys that no longer exist on the source (mirror semantics). Pruning runs
     * after the copy pass so a failed upload never triggers a delete of its counterpart.
     * @default false
     */
    prune?: boolean;

    /**
     * When `true`, the first failing operation rejects {@link sync} instead of being collected in
     * `errors`. Pruning is skipped when a copy-phase error stops the run.
     * @default false
     */
    stopOnError?: boolean;

    /** Transform each source key into the destination key. Defaults to identity. */
    transformKey?: (key: string) => string;
}

export interface SyncResult {
    /** Destination keys removed because they were absent from the source (only when `prune`). */
    deleted: string[];
    errors?: BulkError[];
    /** Source keys whose destination copy already matched and was left untouched. */
    unchanged: string[];
    /** Source keys re-uploaded because the destination copy differed. */
    updated: string[];
    /** Source keys newly created at the destination. */
    uploaded: string[];
}
