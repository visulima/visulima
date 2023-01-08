// eslint-disable-next-line import/no-extraneous-dependencies
import type { BlobBeginCopyFromURLResponse, BlobDeleteIfExistsResponse, BlobItem } from "@azure/storage-blob";
// eslint-disable-next-line import/no-extraneous-dependencies
import { BlobServiceClient, ContainerClient, StorageSharedKeyCredential } from "@azure/storage-blob";
import type { IncomingMessage } from "node:http";
import normalize from "normalize-path";

import { ERRORS, throwErrorCode } from "../../utils";
import LocalMetaStorage from "../local/local-meta-storage";
import MetaStorage from "../meta-storage";
import BaseStorage from "../storage";
import type {
    FileInit, FilePart, FileQuery, FileReturn,
} from "../utils/file";
import { getFileStatus, hasContent, partMatch } from "../utils/file";
import AzureFile from "./azure-file";
import AzureMetaStorage from "./azure-meta-storage";
import type { AzureStorageOptions } from "./types";

class AzureStorage extends BaseStorage<AzureFile, FileReturn> {
    private client: BlobServiceClient;

    private readonly containerClient: ContainerClient;

    private readonly root: string;

    protected meta: MetaStorage<AzureFile>;

    // eslint-disable-next-line radar/cognitive-complexity
    constructor(public config: AzureStorageOptions) {
        super(config);

        // Container name is required
        if (!config.containerName) {
            throw new Error("Missing required parameter: Azure container name.");
        }

        // Connection is preferred.
        const connectionString = config.connectionString || process.env.AZURE_STORAGE_CONNECTION_STRING || undefined;

        if (connectionString) {
            this.client = BlobServiceClient.fromConnectionString(connectionString);
        } else {
            const accountKey: string | undefined = config.accountKey || process.env.AZURE_STORAGE_ACCOUNT_KEY || undefined;
            const accountName: string | undefined = config.accountName || process.env.AZURE_STORAGE_ACCOUNT || undefined;

            // Access key is required if no connection string is provided
            if (!config.accountKey) {
                throw new Error("Missing required parameter: Azure blob storage account key.");
            }

            // Account name is required if no connection string is provided
            if (!config.accountName) {
                throw new Error("Missing required parameter: Azure blob storage account name.");
            }

            const signedCredentials = new StorageSharedKeyCredential(accountName as string, accountKey as string);
            this.client = new BlobServiceClient(config.endpoint ?? `https://${accountName}.blob.core.windows.net`, signedCredentials);
        }

        this.containerClient = this.client.getContainerClient(config.containerName);

        this.root = config.root ? normalize(config.root).replace(/^\//, "") : "";

        if (config.metaStorage) {
            this.meta = config.metaStorage;
        } else {
            let metaConfig = { ...config, ...config.metaStorageConfig, logger: this.logger };

            const localMeta = "directory" in metaConfig;

            if (localMeta) {
                this.logger?.debug("Using local meta storage");

                this.meta = new LocalMetaStorage(metaConfig);
            } else {
                if (connectionString === metaConfig.connectionString) {
                    metaConfig = { ...metaConfig, client: this.client };
                }

                this.meta = new AzureMetaStorage<AzureFile>(metaConfig);
            }
        }

        this.accessCheck().catch((error) => {
            this.isReady = false;

            throw error;
        });
    }

    public async create(request: IncomingMessage, config: FileInit): Promise<AzureFile> {
        const file = new AzureFile(config);

        file.name = this.namingFunction(file, request);

        await this.validate(file);

        try {
            const existing = await this.getMeta(file.id);

            if (existing.bytesWritten >= 0) {
                return existing;
            }
        } catch {
            // ignore
        }

        const blobClient = this.containerClient.getBlockBlobClient(this.getFullPath(file.name));

        const response = await blobClient.uploadData(Buffer.from(""), {
            blobHTTPHeaders: {
                blobContentType: file.contentType,
            },
            metadata: {
                originalName: file.originalName,
                name: file.name,
                ...JSON.parse(JSON.stringify(file.metadata)),
            },
        });

        if (response.requestId === undefined) {
            // @TODO add better error message
            return throwErrorCode(ERRORS.FILE_ERROR, "azure create upload error");
        }

        file.requestId = response.requestId;
        // eslint-disable-next-line no-underscore-dangle
        file.uri = response._response.headers.get("location") as string;
        file.bytesWritten = 0;

        await this.saveMeta(file);

        file.status = "created";

        return file;
    }

    public async delete({ id }: FileQuery): Promise<AzureFile> {
        const file = await this.getMeta(id).catch(() => null);

        if (file) {
            file.status = "deleted";

            await Promise.all([this.deleteMeta(file.id), this.containerClient.getBlockBlobClient(this.getFullPath(file.name)).deleteIfExists()]);

            return { ...file };
        }

        return { id } as AzureFile;
    }

    public async move(name: string, destination: string): Promise<BlobDeleteIfExistsResponse> {
        const source = this.getFullPath(name);

        return this.copy(name, destination).then(() => this.containerClient.getBlockBlobClient(source).deleteIfExists());
    }

    public async write(part: FilePart | FileQuery): Promise<AzureFile> {
        const file = await this.getMeta(part.id);

        await this.checkIfExpired(file);

        if (file.status === "completed") {
            return file;
        }

        if (!partMatch(part, file)) {
            return throwErrorCode(ERRORS.FILE_CONFLICT);
        }

        await this.lock(part.id);

        try {
            if (hasContent(part)) {
                const blobClient = this.containerClient.getBlockBlobClient(this.getFullPath(file.name));

                const abortController = new AbortController();

                part.body.on("error", () => abortController.abort());

                const response = await blobClient.uploadStream(part.body, undefined, undefined, {
                    blobHTTPHeaders: {
                        blobContentType: file.contentType ?? "application/octet-stream",
                    },
                    metadata: file.metadata,
                    abortSignal: abortController.signal,
                });

                if (response.requestId === undefined) {
                    return throwErrorCode(ERRORS.FILE_ERROR, "azure write upload error");
                }

                file.requestId = response.requestId;
                file.bytesWritten += part.contentLength || 0;

                file.status = getFileStatus(file);

                if (file.status === "completed") {
                    // eslint-disable-next-line no-underscore-dangle
                    file.uri = response._response.headers.get("location") as string;

                    await this.deleteMeta(file.id);
                }
            }
        } finally {
            await this.unlock(part.id);
        }

        return file;
    }

    public async get({ id }: FileQuery): Promise<FileReturn> {
        const blobClient = this.containerClient.getBlockBlobClient(id);

        const response = await blobClient.getProperties();

        const {
            metadata, contentType, expiresOn, lastModified, contentLength, etag,
        } = response;

        return {
            id,
            name: metadata?.name || id,
            contentType: contentType as string,
            expiredAt: expiresOn,
            metadata: metadata as Record<string, string> || {},
            modifiedAt: lastModified,
            originalName: metadata?.originalName || "",
            size: contentLength as number,
            content: await blobClient.downloadToBuffer(),
            ETag: etag,
        };
    }

    public async copy(name: string, destination: string): Promise<BlobBeginCopyFromURLResponse> {
        const source = this.containerClient.getBlockBlobClient(this.getFullPath(name));
        const target = this.containerClient.getBlockBlobClient(this.getFullPath(destination));

        const poller = await target.beginCopyFromURL(source.url);
        return poller.pollUntilDone();
    }

    public async list(limit: number = 1000): Promise<AzureFile[]> {
        const files: AzureFile[] = [];

        // Declare truncated as a flag that the while loop is based on.
        let truncated = true;
        let token: string | undefined;

        while (truncated) {
            try {
                const iterator = this.containerClient.listBlobsFlat({
                    includeMetadata: true,
                    prefix: this.root,
                }).byPage({ maxPageSize: limit, continuationToken: token });

                // eslint-disable-next-line no-await-in-loop
                const next = await iterator.next();
                const response = next.value;

                if (response !== undefined && "segment" in response) {
                    response.segment.blobItems.forEach((blob: BlobItem) => {
                        if (!blob.deleted) {
                            files.push({
                                id: blob.name,
                                createdAt: blob.properties.createdOn,
                                modifiedAt: blob.properties.lastModified,
                            } as AzureFile);
                        }
                    });
                }

                truncated = response?.continuationToken !== undefined;

                if (truncated) {
                    token = response.continuationToken;
                }
            } catch (error) {
                truncated = false;

                throw error;
            }
        }

        return files;
    }

    /**
     * Prefixes the given filePath with the storage root location
     */
    private getFullPath(filePath: string): string {
        if (this.assetFolder !== undefined) {
            return `${this.assetFolder}/${filePath}`;
        }

        return filePath;
    }

    private async accessCheck(): Promise<any> {
        return this.containerClient.getProperties();
    }
}

export default AzureStorage;
