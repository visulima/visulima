import { StorageClient } from "@supabase/storage-js";

import { ERRORS, throwErrorCode } from "../../utils/errors";
import type MetaStorage from "../meta-storage";
import { BaseStorage } from "../storage";
import type { FileInit, FilePart, FileQuery, FileReturn } from "../utils/file";
import { getFileStatus, hasContent, partMatch, updateSize } from "../utils/file";
import SupabaseFile from "./supabase-file";
import SupabaseMetaStorage from "./supabase-meta-storage";
import type { SupabaseStorageOptions } from "./types";

const MAX_SIGNED_URL_SECONDS = 60 * 60 * 24 * 7;

/**
 * Translate a `responseContentDisposition` header value into Supabase's
 * `download` option for `createSignedUrl`. RFC 6266 disposition-type is
 * case-insensitive; `attachment-style` and similar prefixes do not match.
 *
 * - `attachment; filename="report.pdf"` → `"report.pdf"` (the filename round-trips)
 * - `attachment` (no filename) → `true` (browser saves with the bucket key as name)
 * - `inline` / anything else / undefined → `undefined` (render in browser)
 */
// eslint-disable-next-line sonarjs/function-return-type -- mirrors Supabase's `download: boolean | string | undefined` shape
const parseDownloadOption = (disposition: string | undefined): boolean | string | undefined => {
    if (!disposition || !/^attachment(\s*;|\s*$)/i.test(disposition.trim())) {
        return undefined;
    }

    const match = disposition.match(/filename\*?=(?:UTF-8'')?(?:"([^"]+)"|([^;]+))/i);
    const captured = match?.[1] ?? match?.[2];

    if (!captured) {
        return true;
    }

    try {
        return decodeURIComponent(captured.trim());
    } catch {
        return captured.trim();
    }
};

const collectStream = async (stream: AsyncIterable<Uint8Array | Buffer>): Promise<Buffer> => {
    const chunks: Buffer[] = [];

    for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
};

/**
 * Supabase Storage backend.
 *
 * Single-shot uploads only — Supabase Storage exposes a TUS endpoint but
 * the JS SDK's `upload()` is HTTP `POST` with the full body. This adapter
 * buffers the part stream and uploads in one request. Use `signedUploadUrl`
 * for direct-from-client large transfers.
 * @example
 * ```ts
 * import { SupabaseStorage } from "@visulima/storage/provider/supabase";
 *
 * const storage = new SupabaseStorage({
 *   url: process.env.SUPABASE_URL,
 *   serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
 *   bucket: "avatars",
 * });
 * ```
 */
class SupabaseStorage extends BaseStorage<SupabaseFile> {
    public static override readonly name: string = "supabase";

    public override checksumTypes: string[] = [];

    protected meta: MetaStorage<SupabaseFile>;

    private readonly bucket: string;

    private readonly defaultUrlExpiresIn: number;

    private readonly storageClient: StorageClient;

    public constructor(config: SupabaseStorageOptions) {
        super(config);

        this.bucket = config.bucket;
        this.defaultUrlExpiresIn = Math.min(config.defaultUrlExpiresIn ?? 3600, MAX_SIGNED_URL_SECONDS);

        if (config.client) {
            this.storageClient = config.client;
        } else {
            const url = config.url ?? process.env.SUPABASE_URL;
            const key = config.serviceKey ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_KEY;

            if (!url) {
                throw new Error("Supabase storage: `url` is required (or set SUPABASE_URL).");
            }

            if (!key) {
                throw new Error("Supabase storage: `serviceKey` is required (or set SUPABASE_SERVICE_ROLE_KEY / SUPABASE_KEY).");
            }

            const storageUrl = url.replace(/\/+$/, "") + (url.endsWith("/storage/v1") ? "" : "/storage/v1");

            this.storageClient = new StorageClient(
                storageUrl,
                {
                    Authorization: `Bearer ${key}`,
                    apikey: key,
                },
                config.fetch,
            );
        }

        this.meta = config.metaStorage ?? new SupabaseMetaStorage(config.metaStorageConfig);

        this.isReady = true;
    }

    public override get raw(): StorageClient {
        return this.storageClient;
    }

    public async create(config: FileInit): Promise<SupabaseFile> {
        return this.instrumentOperation("create", async () => {
            const file = new SupabaseFile(config);

            file.name = this.namingFunction(file);
            file.bucket = this.bucket;
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

    public async write(part: FilePart | FileQuery | SupabaseFile): Promise<SupabaseFile> {
        return this.instrumentOperation("write", async () => {
            let file: SupabaseFile;

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
                    const path = file.path ?? file.name;

                    const { data, error } = await this.storageClient.from(this.bucket).upload(path, buffer, {
                        contentType: file.contentType,
                        upsert: true,
                    });

                    if (error) {
                        throw error;
                    }

                    file.bytesWritten = buffer.length;
                    file.size = buffer.length;
                    file.path = data?.path ?? path;
                    file.ETag = data?.id;
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

    public async delete({ id }: FileQuery): Promise<SupabaseFile> {
        return this.instrumentOperation("delete", async () => {
            let file: SupabaseFile | undefined;

            try {
                file = await this.getMeta(id);
            } catch {
                // No metadata — fall back to direct delete by id.
            }

            const path = file?.path ?? file?.name ?? id;

            const { error } = await this.storageClient.from(this.bucket).remove([path]);

            // Supabase returns no error for missing files; surface upstream errors only.
            if (error && error.message && !/not.*found/i.test(error.message)) {
                throw error;
            }

            if (file) {
                file.status = "deleted";

                await this.deleteMeta(file.id);
                await this.onDelete(file);

                return file;
            }

            return Object.assign(new SupabaseFile({ contentType: "application/octet-stream", metadata: {}, originalName: id }), {
                bucket: this.bucket,
                id,
                name: id,
                path,
                status: "deleted" as const,
            });
        });
    }

    public override async exists({ id }: FileQuery): Promise<boolean> {
        return this.instrumentOperation("exists", async () => {
            let path = id;

            try {
                path = (await this.getMeta(id)).path ?? id;
            } catch {
                // direct path lookup
            }

            const { data, error } = await this.storageClient.from(this.bucket).exists(path);

            if (error) {
                return false;
            }

            return Boolean(data);
        });
    }

    public async get({ id }: FileQuery): Promise<FileReturn> {
        return this.instrumentOperation("get", async () => {
            let path = id;
            let stored: SupabaseFile | undefined;

            try {
                stored = await this.checkIfExpired(await this.getMeta(id));
                path = stored.path ?? stored.name ?? id;
            } catch {
                // No metadata — treat `id` as a bucket-relative path.
            }

            const { data, error } = await this.storageClient.from(this.bucket).download(path);

            if (error || !data) {
                throw error ?? new Error(`Supabase: object not found at "${path}"`);
            }

            const content = Buffer.from(await data.arrayBuffer());

            return {
                content,
                contentType: stored?.contentType ?? data.type ?? "application/octet-stream",
                ETag: stored?.ETag,
                expiredAt: stored?.expiredAt,
                id,
                metadata: stored?.metadata ?? {},
                modifiedAt: stored?.modifiedAt,
                name: stored?.name ?? path,
                originalName: stored?.originalName ?? path,
                size: stored?.size ?? content.length,
            };
        });
    }

    public async copy(name: string, destination: string): Promise<SupabaseFile> {
        return this.instrumentOperation("copy", async () => {
            const source = (await this.getMetaSafe(name))?.path ?? name;
            const target = destination;

            const { error } = await this.storageClient.from(this.bucket).copy(source, target);

            if (error) {
                throw error;
            }

            const file = new SupabaseFile({
                contentType: "application/octet-stream",
                metadata: {},
                originalName: destination,
            });

            file.id = destination;
            file.name = destination;
            file.path = target;
            file.bucket = this.bucket;

            return file;
        });
    }

    public async move(name: string, destination: string): Promise<SupabaseFile> {
        return this.instrumentOperation("move", async () => {
            const source = (await this.getMetaSafe(name))?.path ?? name;

            const { error } = await this.storageClient.from(this.bucket).move(source, destination);

            if (error) {
                throw error;
            }

            const file = new SupabaseFile({
                contentType: "application/octet-stream",
                metadata: {},
                originalName: destination,
            });

            file.id = destination;
            file.name = destination;
            file.path = destination;
            file.bucket = this.bucket;

            try {
                await this.deleteMeta(name);
            } catch {
                // ignore
            }

            return file;
        });
    }

    public override async list(limit = 1000): Promise<SupabaseFile[]> {
        return this.instrumentOperation(
            "list",
            async () => {
                const { data, error } = await this.storageClient.from(this.bucket).list("", {
                    limit,
                });

                if (error) {
                    throw error;
                }

                return (data ?? []).map((entry) => {
                    const file = new SupabaseFile({
                        contentType: entry.metadata?.mimetype ?? "application/octet-stream",
                        metadata: entry.metadata ?? {},
                        originalName: entry.name,
                    });

                    file.id = entry.name;
                    file.name = entry.name;
                    file.path = entry.name;
                    file.bucket = this.bucket;
                    file.size = typeof entry.metadata?.size === "number" ? entry.metadata.size : undefined;
                    file.createdAt = entry.created_at ?? undefined;
                    file.modifiedAt = entry.updated_at ?? undefined;
                    file.ETag = entry.metadata?.eTag ?? entry.id ?? undefined;

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
        const expiresIn = Math.min(options?.expiresIn ?? this.defaultUrlExpiresIn, MAX_SIGNED_URL_SECONDS);

        const { data, error } = await this.storageClient.from(this.bucket).createSignedUrl(key, expiresIn, {
            download: parseDownloadOption(options?.responseContentDisposition),
        });

        if (error || !data) {
            return throwErrorCode(ERRORS.METHOD_NOT_ALLOWED, error?.message ?? "Supabase: createSignedUrl failed");
        }

        return data.signedUrl;
    }

    public override async getUploadUrl(key: string, _options?: { contentLength?: number; contentType?: string; expiresIn?: number }): Promise<string> {
        const { data, error } = await this.storageClient.from(this.bucket).createSignedUploadUrl(key);

        if (error || !data) {
            return throwErrorCode(ERRORS.METHOD_NOT_ALLOWED, error?.message ?? "Supabase: createSignedUploadUrl failed");
        }

        return data.signedUrl;
    }

    private async getMetaSafe(id: string): Promise<SupabaseFile | undefined> {
        try {
            return await this.getMeta(id);
        } catch {
            return undefined;
        }
    }

    private internalOnComplete = (file: SupabaseFile): Promise<void> => this.deleteMeta(file.id);
}

export default SupabaseStorage;
