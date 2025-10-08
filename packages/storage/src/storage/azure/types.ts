import type { BlobServiceClient } from "@azure/storage-blob";

import type { LocalMetaStorageOptions } from "../local/local-meta-storage";
import type { BaseStorageOptions, MetaStorageOptions } from "../types";
import type AzureFile from "./azure-file";

interface ClientConfig {
    /**
     * Azure account key.
     */
    accountKey?: string;

    /**
     * Azure account name.
     */
    accountName?: string;

    /**
     * Azure container name.
     */
    containerName: string;

    /**
     * Azure endpoint.
     */
    endpoint?: string;

    /**
     * Azure root path.
     */
    root?: string;
}

interface ClientConfig {
    connectionString?: string;

    /**
     * Azure container name.
     */
    containerName: string;

    /**
     * Azure root path.
     */
    root?: string;
}

export interface AzureMetaStorageOptions extends ClientConfig, MetaStorageOptions {
    client?: BlobServiceClient;
}

export interface AzureStorageOptions extends BaseStorageOptions<AzureFile>, ClientConfig {
    /**
     * Configure metafiles storage
     * @example
     * ```ts
     * Using local metafiles
     * const storage = new AzureStorage({
     *   bucket: 'upload',
     *   metaStorageConfig: { directory: '/tmp/upload-metafiles' }
     * })
     * ```
     * Using a separate bucket for metafiles
     * ```ts
     * const storage = new AzureStorage({
     *   bucket: 'upload',
     *   metaStorageConfig: { bucket: 'upload-metafiles' }
     * })
     * ```
     */
    metaStorageConfig?: AzureMetaStorageOptions | LocalMetaStorageOptions;
}
