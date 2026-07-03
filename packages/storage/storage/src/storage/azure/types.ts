import type { TokenCredential } from "@azure/core-auth";
import type { BlobServiceClient } from "@azure/storage-blob";

import type { LocalMetaStorageOptions } from "../local/local-meta-storage";
import type { BaseStorageOptions, MetaStorageOptions } from "../types";

interface ClientConfig {
    /**
     * Azure account key. Resolved from `AZURE_STORAGE_ACCOUNT_KEY` when omitted.
     */
    accountKey?: string;

    /**
     * Azure account name. Resolved from `AZURE_STORAGE_ACCOUNT` when omitted.
     */
    accountName?: string;

    /**
     * Azure container name.
     */
    containerName: string;

    /**
     * Microsoft Entra credential for Azure AD / Managed Identity workloads
     * (e.g. `DefaultAzureCredential` from `@azure/identity`). When supplied
     * without a shared key, SDK operations use token auth and signed URLs are
     * minted via User Delegation SAS.
     *
     * The principal must be allowed to access blob data and to call
     * `Microsoft.Storage/storageAccounts/blobServices/generateUserDelegationKey/action`
     * (for example via Storage Blob Data Contributor + Storage Blob Delegator).
     */
    credential?: TokenCredential;

    /**
     * Azure endpoint.
     */
    endpoint?: string;

    /**
     * Azure root path.
     */
    root?: string;

    /**
     * Pre-issued SAS token (with or without a leading `?`). Resolved from
     * `AZURE_STORAGE_SAS_TOKEN` when omitted. SAS-token adapters can use their
     * configured access but cannot mint fresh signed URLs.
     */
    sasToken?: string;

    /**
     * Controls whether a `credential`-backed adapter mints User Delegation SAS
     * URLs. Defaults to `true` when `credential` is supplied; set `false` for
     * token-authenticated SDK operations without signed-URL support.
     */
    useUserDelegationSas?: boolean;
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

export interface AzureStorageOptions extends BaseStorageOptions, ClientConfig {
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
