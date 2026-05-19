import type { TokenCredential } from "@azure/core-auth";
import type { BlobClient, BlobGenerateSasUrlOptions, UserDelegationKey } from "@azure/storage-blob";
import { BlobSASPermissions, BlobServiceClient, SASProtocol, StorageSharedKeyCredential } from "@azure/storage-blob";

/**
 * SAS-signing capability resolved alongside the client.
 *
 * - `sharedKey`: the client was built with a shared-key credential, so `BlobClient.generateSasUrl()` can mint service SAS URLs directly.
 * - `userDelegation`: the client is token-authenticated; signed URLs are minted via a (cached) User Delegation Key.
 *
 * SAS-token-only and anonymous adapters resolve no signer — they can use their configured access but cannot mint fresh signed URLs.
 */
export type AzureSasSigner =
    | {
          cachedKey?: { expiresOn: Date; key: UserDelegationKey };
          client: BlobServiceClient;
          kind: "userDelegation";
          pendingKey?: { expiresOn: Date; promise: Promise<UserDelegationKey> };
      }
    | { kind: "sharedKey" };

export interface AzureClientConfig {
    accountKey?: string;
    accountName?: string;
    connectionString?: string;
    credential?: TokenCredential;
    endpoint?: string;
    sasToken?: string;
    useUserDelegationSas?: boolean;
}

export interface AzureClientBundle {
    /** True only for genuine anonymous access (no credential supplied); public containers serve unsigned read URLs. */
    anonymous?: boolean;
    client: BlobServiceClient;
    /** Resolved pre-issued SAS token (leading `?` stripped) when in SAS-token mode. */
    sasToken?: string;
    signer?: AzureSasSigner;
}

/** Appends a SAS token to a blob URL, picking the right query-string separator. */
export const appendSasToken = (url: string, sasToken: string): string => {
    const token = sasToken.startsWith("?") ? sasToken.slice(1) : sasToken;

    return url.includes("?") ? `${url}&${token}` : `${url}?${token}`;
};

const USER_DELEGATION_KEY_SLACK_MS = 5 * 60 * 1000;

const parseConnectionString = (connectionString: string): Record<string, string> => {
    const parsed: Record<string, string> = {};

    for (const segment of connectionString.split(";")) {
        const index = segment.indexOf("=");

        if (index > 0) {
            parsed[segment.slice(0, index).trim()] = segment.slice(index + 1).trim();
        }
    }

    return parsed;
};

const resolveEndpoint = (endpoint: string | undefined, accountName: string | undefined): string | undefined => {
    if (endpoint) {
        return endpoint;
    }

    return accountName ? `https://${accountName}.blob.core.windows.net` : undefined;
};

/**
 * Builds a {@link BlobServiceClient} and resolves its SAS-signing capability.
 *
 * Auth precedence (first match wins): connection string, then account key,
 * then Microsoft Entra `credential`, then a pre-issued SAS token, then
 * anonymous (public-container) access. Account key / name / SAS token / endpoint
 * fall back to the standard `AZURE_STORAGE_*` environment variables.
 */
export const createAzureClient = (config: AzureClientConfig): AzureClientBundle => {
    const connectionString = config.connectionString || process.env.AZURE_STORAGE_CONNECTION_STRING || undefined;

    if (connectionString) {
        const client = BlobServiceClient.fromConnectionString(connectionString);
        const parsed = parseConnectionString(connectionString);

        // `generateSasUrl()` only works when the SDK attached a shared-key
        // credential — i.e. the connection string carried an AccountKey.
        if (parsed.AccountKey) {
            return { client, signer: { kind: "sharedKey" } };
        }

        return { client };
    }

    const accountKey = config.accountKey || process.env.AZURE_STORAGE_ACCOUNT_KEY || undefined;
    const accountName = config.accountName || process.env.AZURE_STORAGE_ACCOUNT || undefined;
    const endpoint = resolveEndpoint(config.endpoint, accountName);

    if (accountKey) {
        if (!accountName) {
            throw new Error("Missing required parameter: Azure blob storage account name.");
        }

        const signedCredentials = new StorageSharedKeyCredential(accountName, accountKey);

        return {
            client: new BlobServiceClient(endpoint as string, signedCredentials),
            signer: { kind: "sharedKey" },
        };
    }

    if (config.credential) {
        if (!endpoint) {
            throw new Error("Missing required parameter: Azure blob storage account name or endpoint.");
        }

        const client = new BlobServiceClient(endpoint, config.credential);

        if (config.useUserDelegationSas === false) {
            return { client };
        }

        return { client, signer: { client, kind: "userDelegation" } };
    }

    const sasToken = config.sasToken || process.env.AZURE_STORAGE_SAS_TOKEN || undefined;

    if (sasToken) {
        if (!endpoint) {
            throw new Error("Missing required parameter: Azure blob storage account name or endpoint.");
        }

        const separator = sasToken.startsWith("?") ? "" : "?";

        // No signer: a pre-issued SAS token cannot mint fresh SAS URLs, but it
        // can still be appended to blob URLs for read/upload access.
        return { client: new BlobServiceClient(`${endpoint}${separator}${sasToken}`), sasToken };
    }

    if (!endpoint) {
        throw new Error(
            "Missing required Azure credentials: provide a connectionString, accountKey + accountName, a credential, a sasToken, or an accountName/endpoint for anonymous access.",
        );
    }

    // Anonymous mode — only succeeds against public containers.
    return { anonymous: true, client: new BlobServiceClient(endpoint) };
};

const resolveUserDelegationKey = async (
    signer: Extract<AzureSasSigner, { kind: "userDelegation" }>,
    startsOn: Date,
    sasExpiresOn: Date,
): Promise<UserDelegationKey> => {
    if (signer.cachedKey && signer.cachedKey.expiresOn.getTime() > sasExpiresOn.getTime()) {
        return signer.cachedKey.key;
    }

    // Reuse an in-flight fetch when it will still outlive this SAS, so
    // concurrent URL requests share a single getUserDelegationKey call.
    if (signer.pendingKey && signer.pendingKey.expiresOn.getTime() > sasExpiresOn.getTime()) {
        return signer.pendingKey.promise;
    }

    // The delegation key must outlive the SAS it signs; mint it with extra
    // slack so SAS URLs requested within that window reuse the cached key.
    const keyExpiresOn = new Date(sasExpiresOn.getTime() + USER_DELEGATION_KEY_SLACK_MS);
    const promise = signer.client.getUserDelegationKey(startsOn, keyExpiresOn);
    const pending = { expiresOn: keyExpiresOn, promise };

    signer.pendingKey = pending;

    try {
        const key = await promise;

        signer.cachedKey = { expiresOn: keyExpiresOn, key };

        return key;
    } finally {
        if (signer.pendingKey === pending) {
            signer.pendingKey = undefined;
        }
    }
};

export interface AzureSasUrlParameters {
    contentDisposition?: string;
    contentType?: string;
    expiresIn: number;
    permissions: string;
}

/**
 * Mints a SAS URL for a blob using the resolved {@link AzureSasSigner}.
 * Shared-key signers delegate to the SDK; token-credential signers mint a
 * User Delegation SAS, reusing a cached delegation key where possible.
 */
export const buildAzureSasUrl = async (blobClient: BlobClient, signer: AzureSasSigner, parameters: AzureSasUrlParameters): Promise<string> => {
    const startsOn = new Date(Date.now() - 60_000);
    const expiresOn = new Date(Date.now() + parameters.expiresIn * 1000);
    const options: BlobGenerateSasUrlOptions = {
        expiresOn,
        permissions: BlobSASPermissions.parse(parameters.permissions),
        protocol: SASProtocol.Https,
        startsOn,
        ...(parameters.contentDisposition && { contentDisposition: parameters.contentDisposition }),
        ...(parameters.contentType && { contentType: parameters.contentType }),
    };

    if (signer.kind === "sharedKey") {
        return blobClient.generateSasUrl(options);
    }

    const userDelegationKey = await resolveUserDelegationKey(signer, startsOn, expiresOn);

    return blobClient.generateUserDelegationSasUrl(options, userDelegationKey);
};
