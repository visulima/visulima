import type { BlobGetPropertiesResponse, BlobItem, BlobServiceClient, ContainerClient, Metadata } from "@azure/storage-blob";

import { ERRORS, throwErrorCode } from "../../utils/errors";
import MetaStorage from "../meta-storage";
import type { File } from "../utils/file";
import { parseMetadata, stringifyMetadata } from "../utils/file/metadata";
import { createAzureClient } from "./azure-client";
import type { AzureMetaStorageOptions } from "./types";

/** Blob metadata key holding the whole upload record as URI-encoded JSON. */
const FILE_KEY = "file";

// Legacy sidecars stored every File field as its own metadata entry; these lists only exist to
// read those back and must cover the camelCase / numeric fields of `File` (see `../utils/file/file.ts`).
const CAMEL_CASE_FIELDS = ["bytesWritten", "contentType", "createdAt", "expiredAt", "modifiedAt", "originalName", "requestId"] as const;

const NUMERIC_FIELDS = ["bytesWritten", "expiredAt", "size"] as const;

class AzureMetaStorage<T extends File = File> extends MetaStorage<T> {
    private client: BlobServiceClient;

    private containerClient: ContainerClient;

    public constructor(public config: AzureMetaStorageOptions) {
        super(config);

        const { client, ...metaConfig } = config;

        this.client = client === undefined ? createAzureClient(metaConfig).client : client;

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

        const { metadata } = propertyData;
        const file = (
            typeof metadata[FILE_KEY] === "string" ? JSON.parse(decodeURIComponent(metadata[FILE_KEY])) : AzureMetaStorage.restoreFields(metadata)
        ) as T;

        // User metadata is base64 encoded to avoid errors for non-ASCII characters
        // so we need to decode it separately
        if (file.metadata && typeof file.metadata === "string") {
            file.metadata = parseMetadata(file.metadata);
        }

        return file;
    }

    /**
     * Reads a legacy sidecar that stored each File field as its own metadata entry.
     * Blob metadata comes back as strings, and (behind Node's HTTP stack) with lower-cased names.
     * Restore the camelCase names of the File fields and the numbers the upload flow compares
     * against — a string `bytesWritten` would never equal the numeric offset of a PATCH.
     */
    private static restoreFields(metadata: Metadata): Record<string, unknown> {
        const file: Record<string, unknown> = { ...metadata };

        for (const key of CAMEL_CASE_FIELDS) {
            const lower = key.toLowerCase();

            if (file[key] === undefined && file[lower] !== undefined) {
                file[key] = file[lower];
                Reflect.deleteProperty(file, lower);
            }
        }

        for (const key of NUMERIC_FIELDS) {
            const value = file[key];

            if (typeof value === "string" && /^\d+$/.test(value)) {
                file[key] = Number(value);
            }
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

        // One JSON value keeps names and types intact; per-field metadata loses both (see restoreFields).
        const metadata: Metadata = { [FILE_KEY]: encodeURIComponent(JSON.stringify(transformedMetadata)) };
        const appendBlobClient = this.containerClient.getAppendBlobClient(this.getMetaName(id));

        // Set Blob Metadata 404s on a missing blob, so the first save has to create the sidecar.
        const { succeeded } = await appendBlobClient.createIfNotExists({ metadata });

        if (!succeeded) {
            await appendBlobClient.setMetadata(metadata, {});
        }

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
