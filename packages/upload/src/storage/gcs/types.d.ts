// eslint-disable-next-line import/no-extraneous-dependencies
import { RetryConfig } from "gaxios";
// eslint-disable-next-line import/no-extraneous-dependencies
import type { GoogleAuthOptions } from "google-auth-library";
// eslint-disable-next-line import/no-extraneous-dependencies
import { GoogleAuth } from "google-auth-library";

import type { LocalMetaStorageOptions } from "../local/local-meta-storage";
import type { BaseStorageOptions, MetaStorageOptions } from "../types";
import GCSFile from "./gcs-file";

interface StorageSettings {
    storageAPI?: string;

    uploadAPI?: string;

    projectId: string;

    retryOptions?: RetryConfig;

    // Controls whether or not to use authentication when using a custom endpoint.
    useAuthWithCustomEndpoint?: boolean;

    userProject?: string;
}

export interface ClientError extends Error {
    code: string;
    response?: Record<string, any>;
    config: Record<string, any>;
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
    metaStorageConfig?: LocalMetaStorageOptions | GCSMetaStorageOptions;
}

export interface GCSMetaStorageOptions extends Omit<GoogleAuthOptions, "authClient" | "projectId">, MetaStorageOptions, StorageSettings {
    bucket?: string;

    /**
     * @internal - used for internal client inheritance, if same client is used for meta and file storage
     */
    authClient?: GoogleAuth
}
