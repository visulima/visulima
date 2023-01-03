// eslint-disable-next-line import/no-extraneous-dependencies
import type { BlobItem } from "@azure/storage-blob";
// eslint-disable-next-line import/no-extraneous-dependencies
import { BlobServiceClient, ContainerClient, StorageSharedKeyCredential } from "@azure/storage-blob";
import normalize from "normalize-path";

import MetaStorage from "../meta-storage";
import { File } from "../utils/file";
import type { AzureMetaStorageOptions } from "./types";

class AzureMetaStorage<T extends File = File> extends MetaStorage<T> {
    private client: BlobServiceClient;

    private containerClient: ContainerClient;

    private readonly root: string;

    constructor(public config: AzureMetaStorageOptions) {
        super(config);

        const { client, ...metaConfig } = config;

        if (typeof client !== "undefined") {
            this.client = client;
        } else {
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
        }

        const containerName = metaConfig.containerName || process.env.AZURE_STORAGE_CONTAINER || undefined;

        // Container name is required
        if (!containerName) {
            throw new Error("Missing required parameter: Azure container name.");
        }

        this.containerClient = this.client.getContainerClient(metaConfig.containerName);

        this.root = config.root ? normalize(config.root).replace(/^\//, "") : "";
    }

    public async get(id: string): Promise<T> {
        const blobClient = this.containerClient.getBlobClient(this.getMetaPath(id));
        const buffer = await blobClient.downloadToBuffer();

        return JSON.parse(buffer.toString());
    }

    public async touch(id: string, file: T): Promise<T> {
        return this.save(id, file);
    }

    public async delete(id: string): Promise<void> {
        const blobClient = this.containerClient.getBlockBlobClient(this.getMetaPath(id));

        await blobClient.deleteIfExists();
    }

    public async save(id: string, file: T): Promise<T> {
        const blobClient = this.containerClient.getBlockBlobClient(this.getMetaPath(id));
        const buffer = Buffer.from(JSON.stringify(file));

        await blobClient.uploadData(buffer);

        return file;
    }

    public async list(): Promise<T[]> {
        const blobs: BlobItem[] = [];
        const iterator = this.containerClient.listBlobsFlat({
            prefix: this.prefix,
        });

        // eslint-disable-next-line no-restricted-syntax
        for await (const blob of iterator) {
            blobs.push(blob);
        }

        return blobs
            .filter((blob) => blob.name.endsWith(this.suffix))
            .map((blob) => {
                return {
                    id: this.getIdFromMetaName(blob.name),
                    createdAt: blob.properties.createdOn,
                };
            }) as T[];
    }

    /**
     * Returns metafile url
     * @param id - upload id
     */
    getMetaPath(id: string): string {
        return `${this.root}/${this.getMetaName(id)}`;
    }
}

export default AzureMetaStorage;
