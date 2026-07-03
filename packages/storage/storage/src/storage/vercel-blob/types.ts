import type { LocalMetaStorageOptions } from "../local/local-meta-storage";
import type { BaseStorageOptions } from "../types";

export interface VercelBlobStorageOptions extends BaseStorageOptions {
    /**
     * Visibility for uploaded blobs. Vercel Blob currently exposes only
     * `"public"` in its SDK, but this option is here so callers can pass
     * through any future value without forking. Defaults to `"public"`.
     */
    access?: "public";

    /**
     * Configure metafiles storage
     * @example
     * Using local metafiles
     * ```ts
     * const storage = new VercelBlobStorage({
     *   token: process.env.BLOB_READ_WRITE_TOKEN,
     *   metaStorageConfig: { directory: '/tmp/upload-metafiles' }
     * })
     * ```
     */
    metaStorageConfig?: LocalMetaStorageOptions;

    /**
     * Enable multipart uploads for large files
     * Can be a boolean to always use multipart, or a number (in bytes) as threshold
     * @default false
     * @example
     * // Always use multipart uploads
     * multipart: true
     * // Use multipart for files larger than 100MB
     * multipart: 100 * 1024 * 1024
     */
    multipart?: boolean | number;

    /**
     * Vercel OIDC token (`VERCEL_OIDC_TOKEN`). Short-lived, auto-rotated, and the
     * recommended auth path for projects running on Vercel. Must be paired with
     * {@link VercelBlobStorageOptions.storeId} (or `BLOB_STORE_ID` env). Provide
     * explicitly for runtimes that don't expose `process.env` (e.g. Vite).
     * @see https://vercel.com/docs/vercel-blob/using-blob-sdk#oidc-tokens-recommended
     */
    oidcToken?: string;

    /**
     * Vercel Blob store ID (`BLOB_STORE_ID`). Accepted in either `store_{id}`
     * or `{id}` form — the `store_` prefix is stripped automatically. Required
     * when authenticating via {@link VercelBlobStorageOptions.oidcToken}.
     */
    storeId?: string;

    /**
     * Vercel Blob read-write token (`BLOB_READ_WRITE_TOKEN`). Long-lived; prefer
     * {@link VercelBlobStorageOptions.oidcToken} on Vercel. Always wins over OIDC
     * when both are supplied.
     */
    token?: string;
}
