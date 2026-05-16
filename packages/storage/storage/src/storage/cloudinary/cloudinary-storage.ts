import { v2 as cloudinary } from "cloudinary";

import { ERRORS, throwErrorCode } from "../../utils/errors";
import type MetaStorage from "../meta-storage";
import { BaseStorage } from "../storage";
import type { FileInit, FilePart, FileQuery, FileReturn } from "../utils/file";
import { getFileStatus, hasContent, partMatch, updateSize } from "../utils/file";
import CloudinaryFile from "./cloudinary-file";
import CloudinaryMetaStorage from "./cloudinary-meta-storage";
import type { CloudinaryStorageOptions } from "./types";

type ResourceType = "image" | "raw" | "video";

type DeliveryType = "authenticated" | "private" | "upload";

interface CloudinaryUploadResult {
    public_id?: string;
    secure_url?: string;
    url?: string;
    version?: number;
}

interface CloudinaryResource {
    bytes?: number;
    created_at?: string;
    format?: string;
    public_id: string;
    resource_type?: string;
    version?: number;
}

const collectStream = async (stream: AsyncIterable<Buffer | Uint8Array>): Promise<Buffer> => {
    const chunks: Buffer[] = [];

    for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
};

/**
 * Parse a `CLOUDINARY_URL` connection string of the form
 * `cloudinary://&lt;apiKey>:&lt;apiSecret>@&lt;cloudName>`.
 */
const parseCloudinaryUrl = (url: string | undefined): { apiKey?: string; apiSecret?: string; cloudName?: string } => {
    if (!url) {
        return {};
    }

    const match = url.match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);

    if (!match) {
        return {};
    }

    return { apiKey: match[1], apiSecret: match[2], cloudName: match[3] };
};

/**
 * Cloudinary Storage backend.
 *
 * Single-shot uploads only — the adapter buffers the part stream and uploads
 * it in one request via `upload_stream`. Cloudinary has no simple presigned
 * `PUT` endpoint, so `getUploadUrl` is not implemented (the base default
 * throws `METHOD_NOT_ALLOWED`).
 * @example
 * ```ts
 * import { CloudinaryStorage } from "@visulima/storage/provider/cloudinary";
 *
 * const storage = new CloudinaryStorage({
 *   cloudName: process.env.CLOUDINARY_CLOUD_NAME,
 *   apiKey: process.env.CLOUDINARY_API_KEY,
 *   apiSecret: process.env.CLOUDINARY_API_SECRET,
 * });
 * ```
 */
class CloudinaryStorage extends BaseStorage<CloudinaryFile> {
    public static override readonly name: string = "cloudinary";

    public override checksumTypes: string[] = [];

    protected meta: MetaStorage<CloudinaryFile>;

    private readonly client: typeof cloudinary;

    private readonly defaultUrlExpiresIn: number;

    private readonly deliveryType: DeliveryType;

    private readonly resourceType: ResourceType;

    private readonly secure: boolean;

    public constructor(config: CloudinaryStorageOptions) {
        super(config);

        this.resourceType = config.resourceType ?? "raw";
        this.deliveryType = config.type ?? "upload";
        this.secure = config.secure ?? true;
        this.defaultUrlExpiresIn = config.defaultUrlExpiresIn ?? 3600;

        if (config.client) {
            this.client = config.client;
        } else {
            const fromUrl = parseCloudinaryUrl(process.env.CLOUDINARY_URL);

            const cloudName = config.cloudName ?? process.env.CLOUDINARY_CLOUD_NAME ?? fromUrl.cloudName;
            const apiKey = config.apiKey ?? process.env.CLOUDINARY_API_KEY ?? fromUrl.apiKey;
            const apiSecret = config.apiSecret ?? process.env.CLOUDINARY_API_SECRET ?? fromUrl.apiSecret;

            if (!cloudName) {
                throw new Error("Cloudinary storage: `cloudName` is required (or set CLOUDINARY_CLOUD_NAME / CLOUDINARY_URL).");
            }

            cloudinary.config({
                api_key: apiKey,
                api_secret: apiSecret,
                cloud_name: cloudName,
                secure: this.secure,
            });

            this.client = cloudinary;
        }

        this.meta = config.metaStorage ?? new CloudinaryMetaStorage(config.metaStorageConfig);

        this.isReady = true;
    }

    public override get raw(): typeof cloudinary {
        return this.client;
    }

    public async create(config: FileInit): Promise<CloudinaryFile> {
        return this.instrumentOperation("create", async () => {
            const file = new CloudinaryFile(config);

            file.name = this.namingFunction(file);
            file.path = file.name;

            await this.validate(file);

            try {
                const existing = await this.getMeta(file.id);

                if (existing.bytesWritten >= 0) {
                    return existing;
                }
            } catch {
                // ignore — new upload
            }

            file.bytesWritten = 0;
            file.status = getFileStatus(file);

            await this.saveMeta(file);
            await this.onCreate(file);

            return file;
        });
    }

    public async write(part: CloudinaryFile | FilePart | FileQuery): Promise<CloudinaryFile> {
        return this.instrumentOperation("write", async () => {
            let file: CloudinaryFile;

            if ("contentType" in part && "metadata" in part && !("body" in part) && !("start" in part)) {
                file = part;
            } else {
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

            const lockToken = await this.lock(part.id);

            try {
                if (hasContent(part)) {
                    if (this.isUnsupportedChecksum(part.checksumAlgorithm)) {
                        throw new Error("Unsupported checksum algorithm");
                    }

                    const buffer = await collectStream(part.body);
                    const key = file.path ?? file.name;

                    const result = await new Promise<CloudinaryUploadResult>((resolve, reject) => {
                        const stream = this.client.uploader.upload_stream(
                            {
                                overwrite: true,
                                public_id: key,
                                resource_type: this.resourceType,
                                type: this.deliveryType,
                            },
                            (error: { message?: string } | undefined, uploaded: CloudinaryUploadResult | undefined) => {
                                if (error || !uploaded) {
                                    reject(error instanceof Error ? error : new Error(error?.message ?? "Cloudinary: upload failed"));

                                    return;
                                }

                                resolve(uploaded);
                            },
                        );

                        stream.end(buffer);
                    });

                    file.bytesWritten = buffer.length;
                    file.size = buffer.length;
                    file.path = result.public_id ?? key;
                    file.publicUrl = result.secure_url ?? result.url;
                    file.ETag = result.version === undefined ? undefined : String(result.version);
                }

                file.status = getFileStatus(file);

                if (file.status === "completed") {
                    await this.internalOnComplete(file);
                }

                await this.saveMeta(file);

                return file;
            } finally {
                await this.unlock(part.id, lockToken);
            }
        });
    }

    public async delete({ id }: FileQuery): Promise<CloudinaryFile> {
        return this.instrumentOperation("delete", async () => {
            let file: CloudinaryFile | undefined;

            try {
                file = await this.getMeta(id);
            } catch {
                // No metadata — fall back to direct delete by id.
            }

            const key = file?.path ?? file?.name ?? id;

            await this.client.uploader.destroy(key, {
                invalidate: true,
                resource_type: this.resourceType,
                type: this.deliveryType,
            });

            if (file) {
                file.status = "deleted";

                await this.deleteMeta(file.id);
                await this.onDelete(file);

                return file;
            }

            return Object.assign(new CloudinaryFile({ contentType: "application/octet-stream", metadata: {}, originalName: id }), {
                id,
                name: id,
                path: key,
                status: "deleted" as const,
            });
        });
    }

    public override async exists({ id }: FileQuery): Promise<boolean> {
        return this.instrumentOperation("exists", async () => {
            let key = id;

            try {
                const meta = await this.getMeta(id);

                key = meta.path ?? id;
            } catch {
                // direct key lookup
            }

            try {
                await this.client.api.resource(key, {
                    resource_type: this.resourceType,
                    type: this.deliveryType,
                });

                return true;
            } catch {
                return false;
            }
        });
    }

    public async get({ id }: FileQuery): Promise<FileReturn> {
        return this.instrumentOperation("get", async () => {
            let key = id;
            let stored: CloudinaryFile | undefined;

            try {
                stored = await this.checkIfExpired(await this.getMeta(id));
                key = stored.path ?? stored.name ?? id;
            } catch {
                // No metadata — treat `id` as a Cloudinary public id.
            }

            const resource = await this.client.api.resource(key, {
                resource_type: this.resourceType,
                type: this.deliveryType,
            });

            const response = await fetch(
                this.client.url(key, {
                    resource_type: this.resourceType,
                    secure: this.secure,
                    type: this.deliveryType,
                }),
            );

            if (!response.ok) {
                throw new Error(`Cloudinary: object not found at "${key}"`);
            }

            const content = Buffer.from(await response.arrayBuffer());

            return {
                content,
                contentType:
                    stored?.contentType ??
                    (resource.resource_type && resource.format ? `${resource.resource_type}/${resource.format}` : undefined) ??
                    "application/octet-stream",
                ETag: stored?.ETag ?? (resource.version === undefined ? undefined : String(resource.version)),
                expiredAt: stored?.expiredAt,
                id,
                metadata: stored?.metadata ?? {},
                modifiedAt: stored?.modifiedAt,
                name: stored?.name ?? key,
                originalName: stored?.originalName ?? key,
                size: stored?.size ?? (typeof resource.bytes === "number" ? resource.bytes : content.length),
            };
        });
    }

    public async copy(name: string, destination: string): Promise<CloudinaryFile> {
        return this.instrumentOperation("copy", async () => {
            const meta = await this.getMetaSafe(name);
            const source = meta?.path ?? name;

            const sourceUrl = this.client.url(source, {
                resource_type: this.resourceType,
                secure: this.secure,
                type: this.deliveryType,
            });

            await this.client.uploader.upload(sourceUrl, {
                overwrite: true,
                public_id: destination,
                resource_type: this.resourceType,
                type: this.deliveryType,
            });

            const file = new CloudinaryFile({
                contentType: "application/octet-stream",
                metadata: {},
                originalName: destination,
            });

            file.id = destination;
            file.name = destination;
            file.path = destination;

            return file;
        });
    }

    public async move(name: string, destination: string): Promise<CloudinaryFile> {
        return this.instrumentOperation("move", async () => {
            const meta = await this.getMetaSafe(name);
            const source = meta?.path ?? name;

            await this.client.uploader.rename(source, destination, {
                resource_type: this.resourceType,
            });

            const file = new CloudinaryFile({
                contentType: "application/octet-stream",
                metadata: {},
                originalName: destination,
            });

            file.id = destination;
            file.name = destination;
            file.path = destination;

            try {
                await this.deleteMeta(name);
            } catch {
                // ignore
            }

            return file;
        });
    }

    public override async list(limit = 1000): Promise<CloudinaryFile[]> {
        return this.instrumentOperation(
            "list",
            async () => {
                const { resources } = await this.client.api.resources({
                    max_results: limit,
                    resource_type: this.resourceType,
                    type: this.deliveryType,
                });

                return ((resources ?? []) as CloudinaryResource[]).map((entry) => {
                    const file = new CloudinaryFile({
                        contentType: entry.resource_type && entry.format ? `${entry.resource_type}/${entry.format}` : "application/octet-stream",
                        metadata: {},
                        originalName: entry.public_id,
                    });

                    file.id = entry.public_id;
                    file.name = entry.public_id;
                    file.path = entry.public_id;
                    file.size = typeof entry.bytes === "number" ? entry.bytes : undefined;
                    file.createdAt = entry.created_at ?? undefined;
                    file.ETag = entry.version === undefined ? undefined : String(entry.version);

                    return file;
                });
            },
            { limit },
        );
    }

    public override async getReadUrl(
        key: string,
        options?: { expiresIn?: number; responseContentDisposition?: string; responseContentType?: string },
    ): Promise<string> {
        if (this.deliveryType === "upload") {
            return this.client.url(key, {
                resource_type: this.resourceType,
                secure: this.secure,
                type: this.deliveryType,
            });
        }

        const expiresIn = options?.expiresIn ?? this.defaultUrlExpiresIn;
        const dotIndex = key.lastIndexOf(".");
        const format = dotIndex > 0 ? key.slice(dotIndex + 1) : "";

        try {
            return this.client.utils.private_download_url(key, format, {
                expires_at: Math.floor(Date.now() / 1000) + expiresIn,
                resource_type: this.resourceType,
                type: this.deliveryType,
            });
        } catch (error: unknown) {
            return throwErrorCode(ERRORS.METHOD_NOT_ALLOWED, error instanceof Error ? error.message : "Cloudinary: private_download_url failed");
        }
    }

    private async getMetaSafe(id: string): Promise<CloudinaryFile | undefined> {
        try {
            return await this.getMeta(id);
        } catch {
            return undefined;
        }
    }

    private internalOnComplete = (file: CloudinaryFile): Promise<void> => this.deleteMeta(file.id);
}

export default CloudinaryStorage;
