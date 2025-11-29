import type { BlobGetPropertiesResponse, BlobItem, ContainerClient, Metadata } from "@azure/storage-blob";
import { BlobServiceClient, StorageSharedKeyCredential } from "@azure/storage-blob";

import { ERRORS, throwErrorCode } from "../../utils/errors";
import MetaStorage from "../meta-storage";
import type { File } from "../utils/file";
import { parseMetadata, stringifyMetadata } from "../utils/file/metadata";
import type { AzureMetaStorageOptions } from "./types";

class AzureMetaStorage<T extends File = File> extends MetaStorage<T> {
    private client: BlobServiceClient;

    private containerClient: ContainerClient;

    public constructor(public config: AzureMetaStorageOptions) {
        super(config);

        const { client, ...metaConfig } = config;

        if (client === undefined) {
            const connectionString = metaConfig.connectionString || process.env.AZURE_STORAGE_CONNECTION_STRING || undefined;

            if (connectionString) {
                this.client = BlobServiceClient.fromConnectionString(connectionString);
            } else {
                const accountKey: string | undefined = metaConfig.accountKey || process.env.AZURE_STORAGE_ACCOUNT_KEY || undefined;
                const accountName: string | undefined = metaConfig.accountName || process.env.AZURE_STORAGE_ACCOUNT || undefined;

                // Access key is required if no connection string is provided
                if (!metaConfig.accountKey) {
                    throw new Error("Missing required parameter: Azure blob storage account key.");
                }

                // Account name is required if no connection string is provided
                if (!metaConfig.accountName) {
                    throw new Error("Missing required parameter: Azure blob storage account name.");
                }

                const signedCredentials = new StorageSharedKeyCredential(accountName as string, accountKey as string);

                this.client = new BlobServiceClient(config.endpoint ?? `https://${accountName}.blob.core.windows.net`, signedCredentials);
            }
        } else {
            this.client = client;
        }

        const containerName = metaConfig.containerName || process.env.AZURE_STORAGE_CONTAINER || undefined;

        // Container name is required
        if (!containerName) {
            throw new Error("Missing required parameter: Azure container name.");
        }

        this.containerClient = this.client.getContainerClient(metaConfig.containerName);
    }

    public override async get(id: string): Promise<T> {
        const appendBlobClient = this.containerClient.getAppendBlobClient(this.getMetaName(id));

        let propertyData: BlobGetPropertiesResponse;

        try {
            propertyData = await appendBlobClient.getProperties();
        } catch {
            throw throwErrorCode(ERRORS.UNKNOWN_ERROR);
        }

        if (!propertyData.metadata) {
            throw throwErrorCode(ERRORS.FILE_NOT_FOUND);
        }

        const file = propertyData.metadata as unknown as T;

        // Metadata is base64 encoded to avoid errors for non-ASCII characters
        // so we need to decode it separately
        if (file.metadata && typeof file.metadata === "string") {
            file.metadata = parseMetadata(file.metadata as string);
        }

        return file;
    }

    public override async touch(id: string, file: T): Promise<T> {
        return this.save(id, file);
    }

    public override async delete(id: string): Promise<void> {
        const blobClient = this.containerClient.getBlockBlobClient(this.getMetaName(id));

        await blobClient.deleteIfExists();
    }

    public override async save(id: string, file: T): Promise<T> {
        const transformedMetadata = { ...file } as unknown as Omit<T, "metadata"> & { metadata?: string };

        if (transformedMetadata.metadata) {
            transformedMetadata.metadata = stringifyMetadata(file.metadata);
        }

        const appendBlobClient = this.containerClient.getAppendBlobClient(this.getMetaName(id));

        await appendBlobClient.setMetadata(transformedMetadata as unknown as Metadata, {});

        return file;
    }

    public async list(): Promise<T[]> {
        const blobs: BlobItem[] = [];
        const iterator = this.containerClient.listBlobsFlat({
            prefix: this.prefix,
        });

        for await (const blob of iterator) {
            blobs.push(blob);
        }

        return blobs
            .filter((blob) => blob.name.endsWith(this.suffix))
            .map((blob) => {
                return {
                    createdAt: blob.properties.createdOn,
                    id: this.getIdFromMetaName(blob.name),
                };
            }) as T[];
    }
}

export default AzureMetaStorage;
