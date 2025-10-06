import type { RetryConfig } from "gaxios";
import type { GoogleAuth, GoogleAuthOptions } from "google-auth-library";

import type { LocalMetaStorageOptions } from "../local/local-meta-storage";
import type { BaseStorageOptions, MetaStorageOptions } from "../types";
import type GCSFile from "./gcs-file";

interface StorageSettings {
    projectId: string;

    retryOptions?: RetryConfig;

    storageAPI?: string;

    uploadAPI?: string;

    // Controls whether or not to use authentication when using a custom endpoint.
    useAuthWithCustomEndpoint?: boolean;

    userProject?: string;
}

export interface ClientError extends Error {
    code: string;
    config: Record<string, any>;
    response?: Record<string, any>;
}

export interface GCStorageOptions extends BaseStorageOptions<GCSFile>, Omit<GoogleAuthOptions, "authClient" | "projectId">, StorageSettings {
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
     *   bucket: 'upload',
     *   metaStorageConfig: { directory: '/tmp/upload-metafiles' }
     * })
     * ```
     * Using a separate bucket for metafiles
     * ```ts
     * const storage = new GCStorage({
     *   bucket: 'upload',
     *   metaStorageConfig: { bucket: 'upload-metafiles' }
     * })
     * ```
     */
    metaStorageConfig?: GCSMetaStorageOptions | LocalMetaStorageOptions;
}

export interface GCSMetaStorageOptions extends MetaStorageOptions, Omit<GoogleAuthOptions, "authClient" | "projectId">, StorageSettings {
    /**
     * @internal
     */
    authClient?: GoogleAuth;

    bucket?: string;
}
