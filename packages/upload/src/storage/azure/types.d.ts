import { LocalMetaStorageOptions } from "../local/local-meta-storage";
import type { BaseStorageOptions, MetaStorageOptions } from "../types";
import AzureFile from "./azure-file";
import { BlobServiceClient } from "@azure/storage-blob";

interface ClientConfig {
    /**
     * Azure account name.
     */
    accountName?: string;

    /**
     * Azure account key.
     */
    accountKey?: string;

    /**
     * Azure endpoint.
     */
    endpoint?: string;

    /**
     * Azure container name.
     */
    containerName: string;

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

export interface AzureMetaStorageOptions extends MetaStorageOptions, ClientConfig {
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
    metaStorageConfig?: LocalMetaStorageOptions | AzureMetaStorageOptions;
}
