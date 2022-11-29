// eslint-disable-next-line import/no-extraneous-dependencies
import type { BlobItem } from "@azure/storage-blob";
// eslint-disable-next-line import/no-extraneous-dependencies
import { BlobServiceClient, ContainerClient, StorageSharedKeyCredential } from "@azure/storage-blob";
import normalize from "normalize-path";

import MetaStorage from "../meta-storage";
import { File } from "../utils/file";
import type { AzureMetaStorageOptions } from "./types";

class AzureMetaStorage<T extends File = File> extends MetaStorage<T> {
    private readonly signedCredentials: StorageSharedKeyCredential;

    private client: BlobServiceClient;

    private containerClient: ContainerClient;

    private readonly root: string;

    constructor(public config: AzureMetaStorageOptions) {
        super(config);

        this.signedCredentials = new StorageSharedKeyCredential(config.accountName, config.accountKey);
        this.client = new BlobServiceClient(config.endpoint ?? `https://${config.accountName}.blob.core.windows.net`, this.signedCredentials);
        this.containerClient = this.client.getContainerClient(config.containerName);
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
            prefix: this.root,
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
