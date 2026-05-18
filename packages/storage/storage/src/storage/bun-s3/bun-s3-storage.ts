import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";

import type { UploadError } from "../../utils/errors";
import { wrapStorageError } from "../../utils/errors";
import type MetaStorage from "../meta-storage";
import { BaseStorage } from "../storage";
import type { FileInit, FilePart, FileQuery, FileReturn } from "../utils/file";
import { getFileStatus, hasContent, partMatch, updateSize } from "../utils/file";
import BunS3File from "./bun-s3-file";
import BunS3MetaStorage from "./bun-s3-meta-storage";
import type { BunS3ClientLike, BunS3StorageOptions } from "./types";

const toKey = (key: string): string => key.replace(/^\/+/u, "");

const collectStream = async (stream: AsyncIterable<Buffer | Uint8Array>): Promise<Buffer> => {
    const chunks: Buffer[] = [];

    for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
};

/**
 * Map a Bun S3 error into an `UploadError`. Bun throws `S3Error`
 * (`error.name === "S3Error"`) with a `code` property; credential/config
 * failures throw `ERR_S3_*` codes. Status is inferred from the code.
 */
const isNotFoundError = (error: unknown): boolean => {
    const code = (error as { code?: unknown } | null)?.code;

    return typeof code === "string" && /nosuchkey|notfound/iu.test(code);
};

const wrapBunS3Error = (error: unknown, operation: string): UploadError => {
    const code = (error as { code?: unknown } | null)?.code;
    const codeText = typeof code === "string" ? code : "";

    if (/nosuchkey|notfound/iu.test(codeText)) {
        return wrapStorageError(error, { adapter: "Bun S3", operation, status: 404 });
    }

    if (/accessdenied|forbidden|ERR_S3_INVALID_SIGNATURE|ERR_S3_MISSING_CREDENTIALS/iu.test(codeText)) {
        return wrapStorageError(error, { adapter: "Bun S3", operation, status: 403 });
    }

    return wrapStorageError(error, { adapter: "Bun S3", operation });
};

const resolveClient = (config: BunS3StorageOptions): BunS3ClientLike => {
    if (config.client) {
        return config.client;
    }

    const BunRuntime = (globalThis as { Bun?: { S3Client?: new (options: Record<string, unknown>) => BunS3ClientLike } }).Bun;

    if (!BunRuntime?.S3Client) {
        throw new Error(
            "BunS3Storage requires the Bun runtime (Bun.S3Client). Run this under Bun, or pass a pre-built `client` instance. For Node/edge runtimes use the `aws` or `aws-light` provider instead.",
        );
    }

    // Omitted fields fall back to Bun's own env resolution (S3_* then AWS_*).
    return new BunRuntime.S3Client({
        accessKeyId: config.accessKeyId,
        acl: config.acl,
        bucket: config.bucket,
        endpoint: config.endpoint,
        region: config.region,
        secretAccessKey: config.secretAccessKey,
        sessionToken: config.sessionToken,
        virtualHostedStyle: config.virtualHostedStyle,
    });
};

/**
 * Bun-native S3 storage backend, backed by `Bun.S3Client` instead of the AWS
 * SDK. Use this when you are already running on Bun and want to skip the AWS
 * SDK dependency.
 *
 * Limitations (inherent to `Bun.S3Client`, which exposes no low-level
 * multipart or server-side copy primitives):
 *
 * - No resumable / TUS multipart protocol. Each `write` uploads the supplied body in one shot (Bun handles large-object chunking internally). For resumable uploads use the `aws` or `aws-light` provider.
 * - `copy` / `move` are client-side read-then-write — Bun has no server-side `CopyObject`.
 * - `getUploadUrl` returns a presigned `PUT`; a `contentLength` cap cannot be enforced (Bun presign has no max-size policy) and is ignored.
 */
class BunS3Storage extends BaseStorage<BunS3File> {
    public static override readonly name: string = "bun-s3";

    protected meta: MetaStorage<BunS3File>;

    private readonly client: BunS3ClientLike;

    public constructor(config: BunS3StorageOptions) {
        super(config);

        this.client = resolveClient(config);
        this.meta = config.metaStorage ?? new BunS3MetaStorage(config.metaStorageConfig);
        this.isReady = true;
    }

    public override get raw(): BunS3ClientLike {
        return this.client;
    }

    public async create(config: FileInit): Promise<BunS3File> {
        return this.instrumentOperation("create", async () => {
            const file = new BunS3File(config);

            file.name = this.namingFunction(file);
            file.bunS3Key = toKey(file.name);

            await this.validate(file);

            try {
                const existing = await this.getMeta(file.id);

                if (existing.bytesWritten >= 0) {
                    return existing;
                }
            } catch {
                // new upload
            }

            file.bytesWritten = 0;
            file.status = getFileStatus(file);

            await this.saveMeta(file);
            await this.onCreate(file);

            return file;
        });
    }

    public async write(part: BunS3File | FilePart | FileQuery): Promise<BunS3File> {
        return this.instrumentOperation("write", async () => {
            let file: BunS3File;

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
                    const key = toKey(file.name || file.id);

                    try {
                        await this.client.write(key, buffer, { type: file.contentType });
                    } catch (error) {
                        throw wrapBunS3Error(error, "upload");
                    }

                    file.bytesWritten = buffer.length;
                    file.size = buffer.length;
                    file.bunS3Key = key;
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

    public async delete({ id }: FileQuery): Promise<BunS3File> {
        return this.instrumentOperation("delete", async () => {
            let file: BunS3File | undefined;

            try {
                file = await this.getMeta(id);
            } catch {
                // no metadata — delete by id as key
            }

            const key = file?.bunS3Key ?? toKey(file?.name ?? id);

            try {
                await this.client.delete(key);
            } catch (error) {
                // Idempotent delete: a missing key is treated as success so
                // removing an already-gone object does not throw.
                if (!isNotFoundError(error)) {
                    throw wrapBunS3Error(error, "delete");
                }
            }

            if (file) {
                file.status = "deleted";

                await this.deleteMeta(file.id);
                await this.onDelete(file);

                return file;
            }

            const synthetic = new BunS3File({ contentType: "application/octet-stream", metadata: {}, originalName: id });

            synthetic.id = id;
            synthetic.name = id;
            synthetic.bunS3Key = key;
            synthetic.status = "deleted";

            return synthetic;
        });
    }

    public async get({ id }: FileQuery): Promise<FileReturn> {
        return this.instrumentOperation("get", async () => {
            let stored: BunS3File | undefined;
            let key: string;

            try {
                stored = await this.checkIfExpired(await this.getMeta(id));
                key = stored.bunS3Key ?? toKey(stored.name ?? id);
            } catch {
                key = toKey(id);
            }

            const ref = this.client.file(key);

            let buffer: Buffer;
            let stat: Awaited<ReturnType<BunS3ClientLike["stat"]>> | undefined;

            try {
                // Only stat when metadata is absent — stored meta already
                // carries contentType/size/ETag, so the extra round-trip is
                // wasted when it exists.
                if (!stored) {
                    stat = await ref.stat();
                }

                buffer = Buffer.from(await ref.arrayBuffer());
            } catch (error) {
                throw wrapBunS3Error(error, "get");
            }

            return {
                content: buffer,
                contentType: stored?.contentType ?? stat?.type ?? "application/octet-stream",
                ETag: stored?.ETag ?? stat?.etag ?? undefined,
                expiredAt: stored?.expiredAt,
                id,
                metadata: stored?.metadata ?? {},
                modifiedAt: stored?.modifiedAt ?? stat?.lastModified?.toISOString(),
                name: stored?.name ?? key,
                originalName: stored?.originalName ?? key,
                size: stored?.size ?? stat?.size ?? buffer.length,
            };
        });
    }

    public override async getStream({ id }: FileQuery): Promise<{ headers?: Record<string, string>; size?: number; stream: Readable }> {
        return this.instrumentOperation("getStream", async () => {
            let stored: BunS3File | undefined;
            let key: string;

            try {
                stored = await this.checkIfExpired(await this.getMeta(id));
                key = stored.bunS3Key ?? toKey(stored.name ?? id);
            } catch {
                key = toKey(id);
            }

            const ref = this.client.file(key);

            let stat: Awaited<ReturnType<BunS3ClientLike["stat"]>>;
            let webStream: ReadableStream<Uint8Array>;

            try {
                stat = await ref.stat();
                webStream = ref.stream();
            } catch (error) {
                throw wrapBunS3Error(error, "getStream");
            }

            const size = stored?.size ?? stat.size;
            const contentType = stored?.contentType ?? stat.type ?? "application/octet-stream";
            const entityTag = stored?.ETag ?? stat.etag;
            const modifiedAt = stored?.modifiedAt ?? stat.lastModified?.toISOString();

            return {
                headers: {
                    "Content-Length": String(size ?? 0),
                    "Content-Type": contentType,
                    ...(entityTag && { ETag: entityTag }),
                    ...(modifiedAt && { "Last-Modified": String(modifiedAt) }),
                },
                size: typeof size === "number" ? size : undefined,
                stream: Readable.fromWeb(webStream as unknown as NodeReadableStream<Uint8Array>),
            };
        });
    }

    public async copy(name: string, destination: string): Promise<BunS3File> {
        return this.instrumentOperation("copy", async () => {
            const source = await this.get({ id: name });
            const key = toKey(destination);

            try {
                await this.client.write(key, source.content, { type: source.contentType });
            } catch (error) {
                throw wrapBunS3Error(error, "copy");
            }

            const file = new BunS3File({
                contentType: source.contentType,
                metadata: {},
                originalName: destination,
            });

            file.id = destination;
            file.name = destination;
            file.bunS3Key = key;
            file.size = typeof source.size === "string" ? Number(source.size) : (source.size ?? source.content.length);
            file.ETag = source.ETag;
            file.bunS3ETag = source.ETag;

            return file;
        });
    }

    public async move(name: string, destination: string): Promise<BunS3File> {
        return this.instrumentOperation("move", async () => {
            const file = await this.copy(name, destination);

            await this.delete({ id: name });

            return file;
        });
    }

    public override async list(limit = 1000): Promise<BunS3File[]> {
        return this.instrumentOperation(
            "list",
            async () => {
                let response: Awaited<ReturnType<BunS3ClientLike["list"]>>;

                try {
                    response = await this.client.list({ maxKeys: limit });
                } catch (error) {
                    throw wrapBunS3Error(error, "list");
                }

                return (response.contents ?? [])
                    .filter((entry): entry is typeof entry & { key: string } => Boolean(entry.key))
                    .slice(0, limit)
                    .map((entry) => {
                        const key = toKey(entry.key);
                        const file = new BunS3File({
                            contentType: "application/octet-stream",
                            metadata: {},
                            originalName: key,
                        });

                        file.id = key;
                        file.name = key;
                        file.bunS3Key = key;
                        file.size = entry.size;
                        file.ETag = entry.eTag ?? undefined;
                        file.bunS3ETag = entry.eTag ?? undefined;
                        file.modifiedAt = entry.lastModified ? new Date(entry.lastModified).toISOString() : undefined;

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
        return this.client.file(toKey(key)).presign({
            ...(options?.responseContentDisposition && { contentDisposition: options.responseContentDisposition }),
            ...(options?.expiresIn !== undefined && { expiresIn: options.expiresIn }),
            method: "GET",
            ...(options?.responseContentType && { type: options.responseContentType }),
        });
    }

    public override async getUploadUrl(key: string, options?: { contentLength?: number; contentType?: string; expiresIn?: number }): Promise<string> {
        // `contentLength` cannot be enforced — Bun presign has no max-size policy. Ignored by design.
        return this.client.presign(toKey(key), {
            ...(options?.expiresIn !== undefined && { expiresIn: options.expiresIn }),
            method: "PUT",
            ...(options?.contentType && { type: options.contentType }),
        });
    }

    private internalOnComplete = (file: BunS3File): Promise<void> => this.deleteMeta(file.id);
}

export default BunS3Storage;
