/**
 * Shared, framework-agnostic types for the storage client.
 *
 * These live in `core/` (not in a framework folder) so the root `.` export is
 * not coupled to any single framework binding. Each framework folder re-exports
 * the relevant subset for backwards compatibility.
 */

/**
 * Upload method type for the `useUpload` / `createUpload` helpers.
 */
export type UploadMethod = "auto" | "chunked-rest" | "multipart" | "tus";

/**
 * File metadata returned from the server (matches OpenAPI FileMeta schema)
 */
export interface FileMeta {
    /** Bytes written to storage */
    bytesWritten?: number;
    /** Content type of the uploaded file */
    contentType?: string;
    /** File creation timestamp */
    createdAt?: string;
    /** Unique identifier for the uploaded file */
    id: string;
    /** Additional metadata associated with the file */
    metadata?: Record<string, unknown>;
    /** Storage name of the file */
    name?: string;
    /** Original filename of the uploaded file */
    originalName?: string;
    /** Size of the uploaded file in bytes */
    size?: number;
    /** Upload status: 'completed', 'part', 'deleted', or 'created' */
    status?: "completed" | "part" | "deleted" | "created";
}

/**
 * Result returned after a successful file upload.
 * Extends FileMeta with additional client-side fields.
 */
export interface UploadResult extends FileMeta {
    /** Original filename of the uploaded file (alias for originalName) */
    filename?: string;
    /** Current upload offset in bytes (TUS only) */
    offset?: number;
    /** URL to access the uploaded file */
    url?: string;
}

/**
 * Upload item state (used by the internal multipart uploader).
 */
export interface UploadItem {
    /** Upload progress percentage (0-100) */
    completed: number;
    /** Error message if upload failed */
    error?: string;
    /** The file being uploaded */
    file: File;
    /** Unique item ID */
    id: string;
    /** Bytes uploaded so far */
    loaded: number;
    /** Total file size in bytes */
    size: number;
    /** Upload status */
    status: "pending" | "uploading" | "completed" | "error" | "aborted";
    /** Upload response data */
    uploadResponse?: {
        data?: unknown;
        response?: string;
    };
    /** File URL after upload */
    url?: string;
}

/**
 * A function (sync or async) that resolves additional HTTP headers to attach to
 * every upload / file-management request. Returning `Authorization` lets you
 * attach a session token or JWT to all requests issued by an adapter.
 * @example
 * ```ts
 * createTusAdapter({
 *     endpoint,
 *     headers: () => ({ Authorization: `Bearer ${getToken()}` }),
 * });
 * ```
 */
export type HeadersResolver = Record<string, string> | (() => Promise<Record<string, string>> | Record<string, string>);

/**
 * The outgoing request a {@link OnBeforeRequest} hook is allowed to inspect
 * before it is sent. `headers` are the already-merged headers (adapter
 * `headers` resolver plus any protocol-required headers) so the hook can sign
 * or augment based on what is about to be sent.
 */
export interface RequestContext {
    /** Headers already resolved for this request (protocol + adapter `headers`). */
    headers: Record<string, string>;
    /** HTTP method of the outgoing request (e.g. `POST`, `PATCH`, `HEAD`). */
    method: string;
    /** Fully-qualified URL of the outgoing request. */
    url: string;
}

/**
 * A per-request hook (sync or async) that returns extra HTTP headers to attach,
 * given the outgoing {@link RequestContext}. Unlike the adapter-level
 * `headers` resolver — which is request-agnostic — this hook receives the
 * request `url`, `method`, and the already-resolved `headers`, so it can sign a
 * request or mint a fresh token per call.
 *
 * Returned headers are merged over the adapter `headers`, but protocol-required
 * headers (e.g. TUS `Tus-Resumable` / `Upload-Offset`) always win to preserve
 * protocol correctness.
 * @example
 * ```ts
 * createTusAdapter({
 *     endpoint,
 *     onBeforeRequest: ({ method, url }) => ({
 *         Authorization: `Bearer ${signRequest(method, url)}`,
 *     }),
 * });
 * ```
 */
export type OnBeforeRequest = (context: RequestContext) => Promise<Record<string, string>> | Record<string, string>;

/**
 * Client-side upload restrictions, modelled on Uppy's `restrictions` block.
 * Validated before any network request so consumers get friendly errors instead
 * of server-side 413s.
 */
export interface UploadRestrictions {
    /** Allowed MIME types or extensions (e.g. `["image/*", ".pdf"]`). */
    allowedFileTypes?: string[];
    /** Maximum size of a single file, in bytes. */
    maxFileSize?: number;
    /** Maximum number of files accepted in one batch. */
    maxNumberOfFiles?: number;
    /** Minimum size of a single file, in bytes. */
    minFileSize?: number;
}
