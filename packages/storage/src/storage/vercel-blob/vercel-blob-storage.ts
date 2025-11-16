import type { IncomingMessage } from "node:http";
import type { Readable } from "node:stream";

import { copy, del, list, put } from "@vercel/blob";

import toMilliseconds from "../../utils/primitives/to-milliseconds";
import LocalMetaStorage from "../local/local-meta-storage";
import type MetaStorage from "../meta-storage";
import BaseStorage from "../storage";
import type { FileInit, FilePart, FileQuery, FileReturn } from "../utils/file";
import { getFileStatus, hasContent, partMatch, updateSize } from "../utils/file";
import type { VercelBlobStorageOptions } from "./types";
import VercelBlobFile from "./vercel-blob-file";

/**
 * Vercel Blob storage based backend.
 * @example
 * ```ts
 * const storage = new VercelBlobStorage({
 *   token: process.env.BLOB_READ_WRITE_TOKEN,
 *   metaStorageConfig: { directory: '/tmp/upload-metafiles' }
 * });
 * ```
 */
class VercelBlobStorage extends BaseStorage<VercelBlobFile, FileReturn> {
    public static override readonly name: string = "vercel-blob";

    public override checksumTypes: string[] = ["md5"];

    protected meta: MetaStorage<VercelBlobFile>;

    private readonly token: string;

    private readonly multipart: boolean | number;

    public constructor(config: VercelBlobStorageOptions) {
        super(config);

        this.token = config.token || process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL_BLOB_TOKEN || "";

        if (!this.token) {
            throw new Error("Vercel Blob token is required. Set BLOB_READ_WRITE_TOKEN or VERCEL_BLOB_TOKEN environment variable, or provide token in config.");
        }

        this.multipart = config.multipart ?? false;

        const { metaStorage, metaStorageConfig } = config;

        this.meta = metaStorage || new LocalMetaStorage<VercelBlobFile>(metaStorageConfig);

        this.isReady = true;
    }

    public async create(request: IncomingMessage, config: FileInit): Promise<VercelBlobFile> {
        // Handle TTL option
        const processedConfig = { ...config };

        if (config.ttl) {
            const ttlMs = typeof config.ttl === "string" ? toMilliseconds(config.ttl) : config.ttl;

            processedConfig.expiredAt = ttlMs === undefined ? undefined : Date.now() + ttlMs;
        }

        const file = new VercelBlobFile(processedConfig);

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

        // For Vercel Blob, we don't create an empty blob initially
        // We create the file metadata and upload when write() is called
        file.bytesWritten = 0;
        file.status = getFileStatus(file);

        await this.saveMeta(file);

        return file;
    }

    public async write(part: FilePart | FileQuery | VercelBlobFile): Promise<VercelBlobFile> {
        let file: VercelBlobFile;

        if ("contentType" in part && "metadata" in part && !("body" in part) && !("start" in part)) {
            // part is a full file object (not a FilePart)
            file = part as VercelBlobFile;
        } else {
            // part is FilePart or FileQuery
            file = await this.getMeta(part.id);

            await this.checkIfExpired(file);
        }

        if (file.status === "completed") {
            return file;
        }

        if (part.size !== undefined) {
            updateSize(file, part.size);
        }

        if (!partMatch(part, file)) {
            throw new Error("File part does not match");
        }

        await this.lock(part.id);

        try {
            if (hasContent(part)) {
                if (this.isUnsupportedChecksum(part.checksumAlgorithm)) {
                    throw new Error("Unsupported checksum algorithm");
                }

                // Convert stream to buffer for Vercel Blob
                const chunks: Buffer[] = [];
                const stream = part.body as Readable;

                for await (const chunk of stream) {
                    chunks.push(Buffer.from(chunk));
                }

                const buffer = Buffer.concat(chunks);
                const blob = new Blob([buffer], { type: file.contentType });

                // Upload to Vercel Blob
                const result = await put(file.name, blob, {
                    access: "public",
                    multipart: this.shouldUseMultipart(file),
                });

                file.url = result.url;
                file.pathname = result.pathname;
                file.downloadUrl = result.downloadUrl;
                file.bytesWritten = buffer.length;
            }

            file.status = getFileStatus(file);

            if (file.status === "completed") {
                await this.internalOnComplete(file);
            }

            await this.saveMeta(file);

            return file;
        } finally {
            await this.unlock(part.id);
        }
    }

    public async delete({ id }: FileQuery): Promise<VercelBlobFile> {
        const file = await this.getMeta(id).catch(() => undefined);

        if (file?.url) {
            file.status = "deleted";

            try {
                await del(file.url, { token: this.token });
            } catch (error) {
                this.logger?.error("Failed to delete blob from Vercel Blob:", error);
            }

            await this.deleteMeta(file.id);

            return { ...file };
        }

        return { id } as VercelBlobFile;
    }

    public async get({ id }: FileQuery): Promise<FileReturn> {
        const file = await this.checkIfExpired(await this.getMeta(id));

        if (!file.url || file.url.length === 0) {
            throw new Error("File URL not found");
        }

        // For Vercel Blob, we need to fetch the content
        // In a real implementation, you might want to use the blob URL directly
        // and let the client download it, but for compatibility with the interface,
        // we'll fetch the content
        const response = await fetch(file.url);
        const content = Buffer.from(await response.arrayBuffer());

        return {
            content,
            contentType: file.contentType,
            ETag: file.ETag,
            expiredAt: file.expiredAt,
            id,
            metadata: file.metadata,
            modifiedAt: file.modifiedAt,
            name: file.name,
            originalName: file.originalName,
            size: file.size || content.length,
        };
    }

    public async copy(name: string, destination: string): Promise<any> {
        const sourceFile = await this.getMeta(name);

        if (!sourceFile.url) {
            throw new Error("Source file URL not found");
        }

        // Use Vercel Blob's copy function
        const result = await copy(sourceFile.url, destination, {
            access: "public",
        });

        return result;
    }

    public async move(name: string, destination: string): Promise<unknown> {
        const result = await this.copy(name, destination);

        await this.delete({ id: name });

        return result;
    }

    public override async list(limit = 1000): Promise<VercelBlobFile[]> {
        const result = await list({ limit });

        return result.blobs.map((blob) => {
            const file = new VercelBlobFile({
                contentType: "application/octet-stream", // Default content type
                metadata: {},
                originalName: blob.pathname,
            });

            file.createdAt = blob.uploadedAt?.toISOString();
            file.id = blob.pathname;
            file.modifiedAt = blob.uploadedAt?.toISOString();
            file.name = blob.pathname;
            file.pathname = blob.pathname;
            file.size = blob.size;
            file.url = blob.url;
            file.downloadUrl = blob.downloadUrl;

            return file;
        });
    }

    private internalOnComplete = (file: VercelBlobFile): Promise<any> => this.deleteMeta(file.id);

    /**
     * Determine if multipart upload should be used for the given file
     */
    private shouldUseMultipart(file: VercelBlobFile): boolean {
        if (typeof this.multipart === "boolean") {
            return this.multipart;
        }

        if (typeof this.multipart === "number" && file.size !== undefined) {
            return file.size >= this.multipart;
        }

        return false;
    }
}

export default VercelBlobStorage;
