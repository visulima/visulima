import type { IncomingMessage } from "node:http";
import type { Readable } from "node:stream";

import { getStore } from "@netlify/blobs";

import toMilliseconds from "../../utils/primitives/to-milliseconds";
import LocalMetaStorage from "../local/local-meta-storage";
import type MetaStorage from "../meta-storage";
import BaseStorage from "../storage";
import type { FileInit, FilePart, FileQuery, FileReturn } from "../utils/file";
import { getFileStatus, hasContent, partMatch, updateSize } from "../utils/file";
import NetlifyBlobFile from "./netlify-blob-file";
import type { NetlifyBlobStorageOptions } from "./types";

/**
 * Netlify Blob storage based backend.
 * @example
 * ```ts
 * const storage = new NetlifyBlobStorage({
 *   storeName: 'uploads',
 *   metaStorageConfig: { directory: '/tmp/upload-metafiles' }
 * });
 * ```
 */
class NetlifyBlobStorage extends BaseStorage<NetlifyBlobFile, FileReturn> {
    public static override readonly name: string = "netlify-blob";

    public override checksumTypes: string[] = ["md5"];

    protected meta: MetaStorage<NetlifyBlobFile>;

    private readonly storeName: string;

    private readonly siteID?: string;

    private readonly token?: string;

    private store: ReturnType<typeof getStore>;

    public constructor(config: NetlifyBlobStorageOptions) {
        super(config);

        this.storeName = config.storeName || "default";
        this.siteID = config.siteID || process.env.NETLIFY_SITE_ID;
        this.token = config.token || process.env.NETLIFY_TOKEN;

        // Initialize Netlify Blob store
        this.store = getStore({
            name: this.storeName,
            ...this.siteID && { siteID: this.siteID },
            ...this.token && { token: this.token },
        });

        const { metaStorage, metaStorageConfig } = config;

        this.meta = metaStorage || new LocalMetaStorage<NetlifyBlobFile>(metaStorageConfig);

        this.isReady = true;
    }

    public async create(request: IncomingMessage, config: FileInit): Promise<NetlifyBlobFile> {
        // Handle TTL option
        const processedConfig = { ...config };

        if (config.ttl) {
            const ttlMs = typeof config.ttl === "string" ? toMilliseconds(config.ttl) : config.ttl;

            processedConfig.expiredAt = ttlMs === null ? undefined : Date.now() + ttlMs;
        }

        const file = new NetlifyBlobFile(processedConfig);

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

        // For Netlify Blob, we don't create an empty blob initially
        // We create the file metadata and upload when write() is called
        file.bytesWritten = 0;
        file.status = getFileStatus(file);

        await this.saveMeta(file);

        return file;
    }

    public async write(part: FilePart | FileQuery | NetlifyBlobFile): Promise<NetlifyBlobFile> {
        let file: NetlifyBlobFile;

        if ("contentType" in part && "metadata" in part && !("body" in part) && !("start" in part)) {
            // part is a full file object (not a FilePart)
            file = part as NetlifyBlobFile;
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

                // Convert stream to buffer for Netlify Blob
                const chunks: Buffer[] = [];
                const stream = part.body as Readable;

                for await (const chunk of stream) {
                    chunks.push(Buffer.from(chunk));
                }

                const buffer = Buffer.concat(chunks);

                // Upload to Netlify Blob
                await this.store.set(file.name, buffer, {
                    metadata: {
                        contentType: file.contentType,
                        ...file.metadata,
                    },
                });

                // Generate URL - Netlify Blob URLs are based on the store and key
                file.pathname = file.name;
                file.url = this.getBlobUrl(file.name);
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

    public async delete({ id }: FileQuery): Promise<NetlifyBlobFile> {
        const file = await this.getMeta(id).catch(() => null);

        if (file?.pathname) {
            file.status = "deleted";

            try {
                await this.store.delete(file.pathname);
            } catch (error) {
                this.logger?.error("Failed to delete blob from Netlify Blob:", error);
            }

            await this.deleteMeta(file.id);

            return { ...file };
        }

        return { id } as NetlifyBlobFile;
    }

    public async get({ id }: FileQuery): Promise<FileReturn> {
        const file = await this.checkIfExpired(await this.getMeta(id));

        if (!file.pathname || file.pathname.length === 0) {
            throw new Error("File pathname not found");
        }

        // Fetch the blob from Netlify Blob
        // Note: Netlify Blobs returns Blob or null
        const blob = await this.store.get(file.pathname, { type: "blob" });

        if (!blob) {
            throw new Error("File not found in Netlify Blob");
        }

        const arrayBuffer = await blob.arrayBuffer();
        const content = Buffer.from(arrayBuffer);

        // Get metadata - Netlify Blobs stores metadata separately
        // We'll use the file metadata from our meta storage as primary source
        let blobMetadata: { contentType?: string; metadata?: Record<string, any> } | null = null;

        try {
            // Try to get metadata if the API supports it
            // If not supported, we'll fall back to file metadata
            blobMetadata = await (this.store as any).getMetadata?.(file.pathname) || null;
        } catch {
            // Metadata retrieval not supported or failed, use file metadata
        }

        return {
            content,
            contentType: blobMetadata?.contentType || file.contentType,
            ETag: file.ETag,
            expiredAt: file.expiredAt,
            id,
            metadata: {
                ...file.metadata,
                ...blobMetadata?.metadata,
            },
            modifiedAt: file.modifiedAt,
            name: file.name,
            originalName: file.originalName,
            size: file.size || content.length,
        };
    }

    public async copy(name: string, destination: string): Promise<any> {
        const sourceFile = await this.getMeta(name);

        if (!sourceFile.pathname) {
            throw new Error("Source file pathname not found");
        }

        // Get the source blob
        const sourceBlob = await this.store.get(sourceFile.pathname, { type: "blob" });

        if (!sourceBlob) {
            throw new Error("Source file not found in Netlify Blob");
        }

        // Get source metadata if available
        let sourceMetadata: { contentType?: string; metadata?: Record<string, any> } | null = null;

        try {
            sourceMetadata = await (this.store as any).getMetadata?.(sourceFile.pathname) || null;
        } catch {
            // Metadata retrieval not supported, use file metadata
        }

        // Copy by setting the destination with source content
        const arrayBuffer = await sourceBlob.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        await this.store.set(destination, buffer, {
            metadata: sourceMetadata || {
                contentType: sourceFile.contentType,
                ...sourceFile.metadata,
            },
        });

        return {
            pathname: destination,
            url: this.getBlobUrl(destination),
        };
    }

    public async move(name: string, destination: string): Promise<unknown> {
        const result = await this.copy(name, destination);

        await this.delete({ id: name });

        return result;
    }

    public override async list(limit = 1000): Promise<NetlifyBlobFile[]> {
        const listResult = await this.store.list({
            limit,
        });

        const files: NetlifyBlobFile[] = [];

        for await (const blob of listResult.blobs) {
            // Try to get metadata if available
            let metadata: { contentType?: string; metadata?: Record<string, any> } | null = null;

            try {
                metadata = await (this.store as any).getMetadata?.(blob.key) || null;
            } catch {
                // Metadata retrieval not supported
            }

            const file = new NetlifyBlobFile({
                contentType: metadata?.contentType || "application/octet-stream",
                metadata: metadata?.metadata || {},
                originalName: blob.key,
            });

            file.createdAt = blob.createdAt?.toISOString();
            file.id = blob.key;
            file.modifiedAt = blob.updatedAt?.toISOString();
            file.name = blob.key;
            file.pathname = blob.key;
            file.size = blob.size;
            file.url = this.getBlobUrl(blob.key);

            files.push(file);
        }

        return files;
    }

    private internalOnComplete = (file: NetlifyBlobFile): Promise<any> => this.deleteMeta(file.id);

    /**
     * Generate a URL for a blob in Netlify Blob store
     * Note: Netlify Blob doesn't provide direct public URLs like Vercel Blob
     * In production, you would typically serve these through Netlify Functions or Edge Functions
     */
    private getBlobUrl(pathname: string): string {
        // In a real implementation, you might want to return a URL that goes through
        // a Netlify Function or Edge Function to serve the blob
        // For now, we'll return a placeholder that indicates the blob path
        return `/api/blobs/${this.storeName}/${pathname}`;
    }
}

export default NetlifyBlobStorage;
