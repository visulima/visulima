import type { LocalMetaStorageOptions } from "../local/local-meta-storage";
import type { BaseStorageOptions } from "../types";
import type NetlifyBlobFile from "./netlify-blob-file";

export interface NetlifyBlobStorageOptions extends BaseStorageOptions<NetlifyBlobFile> {
    /**
     * Configure metafiles storage
     * @example
     * Using local metafiles
     * ```ts
     * const storage = new NetlifyBlobStorage({
     *   storeName: 'uploads',
     *   metaStorageConfig: { directory: '/tmp/upload-metafiles' }
     * })
     * ```
     */
    metaStorageConfig?: LocalMetaStorageOptions;

    /**
     * Netlify site ID (optional, used for explicit store access)
     */
    siteID?: string;

    /**
     * Netlify Blob store name
     * @default 'default'
     */
    storeName?: string;

    /**
     * Netlify API token (optional, can use environment variable NETLIFY_TOKEN)
     */
    token?: string;
}
