// eslint-disable-next-line import/no-extraneous-dependencies
import { GoogleAuthOptions } from "google-auth-library";

import type { LocalMetaStorageOptions } from "../local/local-meta-storage";
import type { BaseStorageOptions, MetaStorageOptions } from "../types";
import GCSFile from "./gcs-file";

export interface ClientError extends Error {
    code: string;
    response?: Record<string, any>;
    config: Record<string, any>;
}

export interface GCStorageOptions extends BaseStorageOptions<GCSFile>, GoogleAuthOptions {
    /**
     * Google Cloud Storage bucket
     */
    bucket?: string;
    /**
     * Force compatible client upload directly to GCS
     */
    clientDirectUpload?: boolean;
    /**
     * Configure metafiles storage
     * @example
     * ```ts
     * Using local metafiles
     * const storage = new GCStorage({
     *   bucket: 'uploads',
     *   metaStorageConfig: { directory: '/tmp/upload-metafiles' }
     * })
     * ```
     * Using a separate bucket for metafiles
     * ```ts
     * const storage = new GCStorage({
     *   bucket: 'uploads',
     *   metaStorageConfig: { bucket: 'upload-metafiles' }
     * })
     * ```
     */
    metaStorageConfig?: LocalMetaStorageOptions | GCSMetaStorageOptions;
}

export interface GCSMetaStorageOptions extends GoogleAuthOptions, MetaStorageOptions {
    bucket?: string;
}
