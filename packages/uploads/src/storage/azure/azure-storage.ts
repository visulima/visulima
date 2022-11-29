// eslint-disable-next-line import/no-extraneous-dependencies
import type {
    BlobBeginCopyFromURLResponse, BlobDeleteIfExistsResponse,
} from "@azure/storage-blob";
// eslint-disable-next-line import/no-extraneous-dependencies
import {
    BlobServiceClient,
    ContainerClient,
    StorageSharedKeyCredential,
} from "@azure/storage-blob";
// eslint-disable-next-line import/no-extraneous-dependencies
import { AbortController } from "abort-controller";
import type { IncomingMessage } from "node:http";
import normalize from "normalize-path";

import { ERRORS, throwErrorCode } from "../../utils";
import LocalMetaStorage from "../local/local-meta-storage";
import MetaStorage from "../meta-storage";
import BaseStorage from "../storage";
import type { FileInit, FilePart, FileQuery } from "../utils/file";
import { getFileStatus, hasContent, partMatch } from "../utils/file";
import AzureFile from "./azure-file";
import AzureMetaStorage from "./azure-meta-storage";
import type { AzureStorageOptions } from "./types";

class AzureStorage extends BaseStorage<AzureFile> {
    private readonly signedCredentials: StorageSharedKeyCredential;

    private client: BlobServiceClient;

    private containerClient: ContainerClient;

    private readonly root: string;

    protected meta: MetaStorage<AzureFile>;

    constructor(public config: AzureStorageOptions) {
        super(config);

        this.signedCredentials = new StorageSharedKeyCredential(config.accountName, config.accountKey);
        this.client = new BlobServiceClient(config.endpoint ?? `https://${config.accountName}.blob.core.windows.net`, this.signedCredentials);
        this.containerClient = this.client.getContainerClient(config.containerName);
        this.root = config.root ? normalize(config.root).replace(/^\//, "") : "";

        if (config.metaStorage) {
            this.meta = config.metaStorage;
        } else {
            const metaConfig = { ...config, ...config.metaStorageConfig, logger: this.logger };

            // eslint-disable-next-line max-len
            this.meta = "directory" in metaConfig ? new LocalMetaStorage<AzureFile>(metaConfig) : new AzureMetaStorage<AzureFile>(metaConfig);
        }
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
            metadata: file.metadata,
        });

        if (response.requestId === undefined) {
            return throwErrorCode(ERRORS.FILE_ERROR, "azure create upload error");
        }

        file.requestId = response.requestId;
        // eslint-disable-next-line no-underscore-dangle
        file.uri = response._response.headers.get("location") as string;

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
                }
            }
        } finally {
            await this.unlock(part.id);
        }

        return file;
    }

    public async copy(name: string, destination: string): Promise<BlobBeginCopyFromURLResponse> {
        const source = this.containerClient.getBlockBlobClient(this.getFullPath(name));
        const target = this.containerClient.getBlockBlobClient(this.getFullPath(destination));

        const poller = await target.beginCopyFromURL(source.url);
        return poller.pollUntilDone();
    }

    protected getBinary(file: AzureFile): Promise<Buffer> {
        const blobClient = this.containerClient.getBlockBlobClient(file.name);

        return blobClient.downloadToBuffer();
    }

    /**
     * Prefixes the given filePath with the storage root location
     */
    private getFullPath(filePath: string): string {
        return normalize(`${this.root}/${filePath}`);
    }
}

export default AzureStorage;
