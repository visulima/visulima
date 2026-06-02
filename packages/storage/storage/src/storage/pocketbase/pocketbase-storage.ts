import PocketBase, { ClientResponseError } from "pocketbase";

import { ERRORS, throwErrorCode } from "../../utils/errors";
import type MetaStorage from "../meta-storage";
import { BaseStorage } from "../storage";
import type { OperationOptions } from "../types";
import type { FileInit, FilePart, FileQuery, FileReturn } from "../utils/file";
import { getFileStatus, hasContent, partMatch, updateSize } from "../utils/file";
import PocketBaseFile from "./pocketbase-file";
import PocketBaseMetaStorage from "./pocketbase-meta-storage";
import type { PocketBaseClientLike, PocketBaseRecord, PocketBaseStorageOptions } from "./types";

const collectStream = async (stream: AsyncIterable<Uint8Array | Buffer>): Promise<Buffer> => {
    const chunks: Buffer[] = [];

    for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
};

const isNotFound = (error: unknown): boolean => {
    if (error instanceof ClientResponseError) {
        return (error as { status?: number }).status === 404;
    }

    return Boolean(error) && typeof error === "object" && (error as { status?: number }).status === 404;
};

const fileUrl = (client: PocketBaseClientLike, record: PocketBaseRecord, filename: string, options?: { token?: string }): string => {
    const resolver = client.files.getURL ?? client.files.getUrl;

    if (!resolver) {
        return throwErrorCode(ERRORS.METHOD_NOT_ALLOWED, "PocketBase: client has no files.getURL()");
    }

    return resolver(record, filename, options);
};

/**
 * PocketBase storage backend.
 *
 * PocketBase is record-based: a collection where each record holds exactly
 * one file. This adapter maps the object store onto such a collection,
 * keying records by a text field (`keyField`) and storing bytes in a file
 * field (`fileField`). Uploads are single-shot — the part stream is buffered
 * and sent as one multipart request.
 * @example
 * ```ts
 * import { PocketBaseStorage } from "@visulima/storage/provider/pocketbase";
 *
 * const storage = new PocketBaseStorage({
 *   url: process.env.POCKETBASE_URL,
 *   adminEmail: process.env.POCKETBASE_ADMIN_EMAIL,
 *   adminPassword: process.env.POCKETBASE_ADMIN_PASSWORD,
 *   collection: "uploads",
 * });
 * ```
 * @remarks
 * - ⚠️ Per-operation `signal`/`timeout` are best-effort: the underlying SDK does not support request cancellation, so an in-flight call may complete server-side even after abort. `retries` is honored.
 */
class PocketBaseStorage extends BaseStorage<PocketBaseFile> {
    public static override readonly name: string = "pocketbase";

    public override checksumTypes: string[] = [];

    protected meta: MetaStorage<PocketBaseFile>;

    private readonly client: PocketBaseClientLike;

    private readonly collectionName: string;

    private readonly defaultUrlExpiresIn: number;

    private readonly fileField: string;

    private readonly keyField: string;

    private readonly publicBaseUrl?: string;

    private ensureAuth: () => Promise<void>;

    public constructor(config: PocketBaseStorageOptions) {
        super(config);

        if (!config.collection) {
            throw new Error("PocketBase storage: `collection` is required.");
        }

        this.collectionName = config.collection;
        this.keyField = config.keyField ?? "key";
        this.fileField = config.fileField ?? "file";
        this.publicBaseUrl = config.publicBaseUrl;
        this.defaultUrlExpiresIn = config.defaultUrlExpiresIn ?? 3600;

        if (config.client) {
            this.client = config.client;
            this.ensureAuth = async () => {
                // Caller-supplied client manages its own auth.
            };
        } else {
            const url = config.url ?? process.env.POCKETBASE_URL;

            if (!url) {
                throw new Error("PocketBase storage: `url` is required (or set POCKETBASE_URL).");
            }

            const client = new PocketBase(url) as unknown as PocketBaseClientLike;

            this.client = client;

            const authToken = config.authToken ?? process.env.POCKETBASE_AUTH_TOKEN;
            const adminEmail = config.adminEmail ?? process.env.POCKETBASE_ADMIN_EMAIL;
            const adminPassword = config.adminPassword ?? process.env.POCKETBASE_ADMIN_PASSWORD;

            if (authToken) {
                client.authStore.save(authToken, null);

                this.ensureAuth = async () => {
                    // Token-based auth — nothing to refresh.
                };
            } else if (adminEmail && adminPassword) {
                this.ensureAuth = async () => {
                    if (client.authStore.isValid) {
                        return;
                    }

                    await client.collection("_superusers").authWithPassword(adminEmail, adminPassword);
                };
            } else {
                this.ensureAuth = async () => {
                    // No credentials — rely on collection-level public access rules.
                };
            }
        }

        this.meta = config.metaStorage ?? new PocketBaseMetaStorage(config.metaStorageConfig);

        this.isReady = true;
    }

    public override get raw(): PocketBaseClientLike {
        return this.client;
    }

    public async create(config: FileInit, _options?: OperationOptions): Promise<PocketBaseFile> {
        return this.instrumentOperation("create", async () => {
            const file = new PocketBaseFile(config);

            file.name = this.namingFunction(file);
            file.bucket = this.collectionName;
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

    public async write(part: FilePart | FileQuery | PocketBaseFile, options?: OperationOptions): Promise<PocketBaseFile> {
        return this.instrumentOperation("write", async () => {
            let file: PocketBaseFile;

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

                    await this.putRecord(key, buffer, file.contentType, options);

                    file.bytesWritten = buffer.length;
                    file.size = buffer.length;
                    file.path = key;
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

    public async delete({ id }: FileQuery, options?: OperationOptions): Promise<PocketBaseFile> {
        return this.instrumentOperation("delete", async () => {
            let file: PocketBaseFile | undefined;

            try {
                file = await this.getMeta(id);
            } catch {
                // No metadata — fall back to direct delete by key.
            }

            const key = file?.path ?? file?.name ?? id;

            await this.ensureAuth();

            try {
                const record = await this.findRecord(key, options);

                await this.runOperation(options, () => this.client.collection(this.collectionName).delete(record.id));
            } catch (error: unknown) {
                if (!isNotFound(error)) {
                    throw error;
                }
            }

            if (file) {
                file.status = "deleted";

                await this.deleteMeta(file.id);
                await this.onDelete(file);

                return file;
            }

            return Object.assign(new PocketBaseFile({ contentType: "application/octet-stream", metadata: {}, originalName: id }), {
                bucket: this.collectionName,
                id,
                name: id,
                path: key,
                status: "deleted" as const,
            });
        });
    }

    public override async exists({ id }: FileQuery, options?: OperationOptions): Promise<boolean> {
        return this.instrumentOperation("exists", async () => {
            let key = id;

            try {
                const meta = await this.getMeta(id);

                key = meta.path ?? id;
            } catch {
                // direct key lookup
            }

            await this.ensureAuth();

            try {
                await this.findRecord(key, options);

                return true;
            } catch (error: unknown) {
                if (isNotFound(error)) {
                    return false;
                }

                throw error;
            }
        });
    }

    public async get({ id }: FileQuery, options?: OperationOptions): Promise<FileReturn> {
        return this.instrumentOperation("get", async () => {
            let key = id;
            let stored: PocketBaseFile | undefined;

            try {
                stored = await this.checkIfExpired(await this.getMeta(id));
                key = stored.path ?? stored.name ?? id;
            } catch {
                // No metadata — treat `id` as a logical key.
            }

            await this.ensureAuth();

            const record = await this.findRecord(key, options);
            const filename = String(record[this.fileField] ?? "");
            const url = fileUrl(this.client, record, filename);
            const response = await this.runOperation(options, () => fetch(url));

            if (!response.ok) {
                return throwErrorCode(ERRORS.FILE_NOT_FOUND, `PocketBase: object not found at "${key}"`);
            }

            const content = Buffer.from(await response.arrayBuffer());

            return {
                content,
                contentType: stored?.contentType ?? response.headers.get("content-type") ?? "application/octet-stream",
                ETag: stored?.ETag,
                expiredAt: stored?.expiredAt,
                id,
                metadata: stored?.metadata ?? {},
                modifiedAt: stored?.modifiedAt,
                name: stored?.name ?? key,
                originalName: stored?.originalName ?? key,
                size: stored?.size ?? content.length,
            };
        });
    }

    public async copy(name: string, destination: string, options?: OperationOptions & { storageClass?: string }): Promise<PocketBaseFile> {
        return this.instrumentOperation("copy", async () => {
            const meta = await this.getMetaSafe(name);
            const source = meta?.path ?? name;

            await this.ensureAuth();

            const record = await this.findRecord(source, options);
            const filename = String(record[this.fileField] ?? "");
            const url = fileUrl(this.client, record, filename);
            const response = await this.runOperation(options, () => fetch(url));

            if (!response.ok) {
                return throwErrorCode(ERRORS.FILE_NOT_FOUND, `PocketBase: object not found at "${source}"`);
            }

            const buffer = Buffer.from(await response.arrayBuffer());
            const contentType = response.headers.get("content-type") ?? "application/octet-stream";

            await this.putRecord(destination, buffer, contentType, options);

            const file = new PocketBaseFile({
                contentType,
                metadata: {},
                originalName: destination,
            });

            file.id = destination;
            file.name = destination;
            file.path = destination;
            file.bucket = this.collectionName;
            file.size = buffer.length;

            return file;
        });
    }

    public async move(name: string, destination: string, options?: OperationOptions): Promise<PocketBaseFile> {
        return this.instrumentOperation("move", async () => {
            const file = await this.copy(name, destination, options);
            const meta = await this.getMetaSafe(name);
            const source = meta?.path ?? name;

            await this.ensureAuth();

            try {
                const record = await this.findRecord(source, options);

                await this.runOperation(options, () => this.client.collection(this.collectionName).delete(record.id));
            } catch (error: unknown) {
                if (!isNotFound(error)) {
                    throw error;
                }
            }

            try {
                await this.deleteMeta(name);
            } catch {
                // ignore
            }

            return file;
        });
    }

    public override async list(limit = 1000, options?: OperationOptions): Promise<PocketBaseFile[]> {
        return this.instrumentOperation(
            "list",
            async () => {
                await this.ensureAuth();

                const { items } = await this.runOperation(options, () => this.client.collection(this.collectionName).getList(1, limit));

                return (items ?? []).map((record) => {
                    const key = String(record[this.keyField] ?? record.id);
                    const filename = String(record[this.fileField] ?? "");

                    const file = new PocketBaseFile({
                        contentType: "application/octet-stream",
                        metadata: {},
                        originalName: key,
                    });

                    file.id = key;
                    file.name = key;
                    file.path = key;
                    file.bucket = this.collectionName;
                    file.ETag = filename || undefined;
                    file.createdAt = typeof record.created === "string" ? record.created : undefined;
                    file.modifiedAt = typeof record.updated === "string" ? record.updated : undefined;

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
        if (this.publicBaseUrl) {
            return `${this.publicBaseUrl.replace(/\/+$/, "")}/${key}`;
        }

        await this.ensureAuth();

        let lookupKey = key;
        const meta = await this.getMetaSafe(key);

        if (meta?.path) {
            lookupKey = meta.path;
        }

        const record = await this.findRecord(lookupKey);
        const filename = String(record[this.fileField] ?? "");

        // PocketBase file tokens are short-lived; request a fresh one per call.
        // `defaultUrlExpiresIn`/`expiresIn` is advisory only — the server
        // controls token lifetime.
        void (options?.expiresIn ?? this.defaultUrlExpiresIn);

        const token = await this.client.files.getToken();

        return fileUrl(this.client, record, filename, { token });
    }

    private async findRecord(key: string, options?: OperationOptions): Promise<PocketBaseRecord> {
        const filter = this.client.filter(`${this.keyField} = {:k}`, { k: key });

        return this.runOperation(options, () => this.client.collection(this.collectionName).getFirstListItem(filter));
    }

    private async putRecord(key: string, buffer: Buffer, contentType: string, options?: OperationOptions): Promise<void> {
        await this.ensureAuth();

        const form = new FormData();

        form.append(this.keyField, key);
        form.append(this.fileField, new Blob([new Uint8Array(buffer)], { type: contentType }), key);

        try {
            const record = await this.findRecord(key, options);

            await this.runOperation(options, () => this.client.collection(this.collectionName).update(record.id, form));
        } catch (error: unknown) {
            if (!isNotFound(error)) {
                throw error;
            }

            await this.runOperation(options, () => this.client.collection(this.collectionName).create(form));
        }
    }

    private async getMetaSafe(id: string): Promise<PocketBaseFile | undefined> {
        try {
            return await this.getMeta(id);
        } catch {
            return undefined;
        }
    }

    private internalOnComplete = (file: PocketBaseFile): Promise<void> => this.deleteMeta(file.id);
}

export default PocketBaseStorage;
