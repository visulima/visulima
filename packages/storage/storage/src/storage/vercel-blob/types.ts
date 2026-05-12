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
     * Vercel Blob read-write token
     */
    token?: string;
}
