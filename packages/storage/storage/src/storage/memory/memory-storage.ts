import { Readable } from "node:stream";

import etag from "etag";

import { ERRORS, throwErrorCode } from "../../utils/errors";
import type { MetaStorageOptions } from "../meta-storage-options";
import { BaseStorage } from "../storage";
import type { BaseStorageOptions, OperationOptions } from "../types";
import type { FileInit, FilePart, FileQuery } from "../utils/file";
import { File, getFileStatus, hasContent, updateSize } from "../utils/file";
import type { FileReturn } from "../utils/file/types";
import MemoryMetaStorage from "./memory-meta-storage";

/**
 * Public options for {@link MemoryStorage}. The `initial` record lets tests seed the
 * store with a few key→bytes pairs; pass `metaStorage` to share metadata with another
 * `Files` instance (rarely needed — the memory adapter is meant to be ephemeral).
 */
export interface MemoryStorageOptions<T extends File = File> extends BaseStorageOptions<T> {
    /** Pre-populate the store with these key → bytes entries. */
    initial?: Record<string, Buffer | Uint8Array | string>;
    metaStorageConfig?: MetaStorageOptions;
}

/**
 * Stored entry in the backing {@link Map}. `bytes` is the raw payload; `meta` is a
 * lightweight per-key metadata snapshot so {@link MemoryStorage.list} and
 * `head` can answer without dragging the file class around.
 */
interface MemoryEntry {
    bytes: Buffer;
    contentType: string;
    createdAt: string;
    eTag: string;
    metadata: Record<string, unknown>;
    modifiedAt: string;
}

/**
 * In-memory storage adapter backed by a {@link Map}.
 *
 * Implements the full {@link BaseStorage} surface without touching disk or any
 * external service — useful for tests, ephemeral environments, and as a
 * reference implementation. `raw` returns the backing map so tests can inspect
 * or reset state directly:
 *
 * ```ts
 * const storage = new MemoryStorage({ initial: { "users/1.json": '{"id":1}' } });
 * storage.raw.clear();
 * ```
 *
 * Metadata is shallow-cloned on both write and read so callers never share a
 * mutable object with the store.
 */
class MemoryStorage<TFile extends File = File> extends BaseStorage<TFile> {
    public static override readonly name: string = "memory";

    public override checksumTypes: string[] = ["md5"];

    public override readonly supportsRange: boolean = true;

    public meta: MemoryMetaStorage<TFile>;

    private readonly store: Map<string, MemoryEntry>;

    public constructor(config: MemoryStorageOptions<TFile> = {}) {
        super(config);

        this.store = new Map<string, MemoryEntry>();
        this.meta =
            (config.metaStorage as MemoryMetaStorage<TFile> | undefined) ?? new MemoryMetaStorage<TFile>({ ...config.metaStorageConfig, logger: this.logger });

        if (config.initial) {
            for (const [key, value] of Object.entries(config.initial)) {
                BaseStorage.assertSafeId(key);

                const bytes = typeof value === "string" ? Buffer.from(value) : Buffer.from(value);
                const now = new Date().toISOString();
                const entityTag = etag(bytes);

                this.store.set(key, {
                    bytes,
                    contentType: "application/octet-stream",
                    createdAt: now,
                    eTag: entityTag,
                    metadata: {},
                    modifiedAt: now,
                });

                // Map.set inside MemoryMetaStorage.save is synchronous; the returned promise
                // resolves on the next microtask, but the meta entry is already in place. The
                // `.catch(() => {})` exists to silence Node's unhandled-rejection warning if a
                // future subclass's `save` rejects — failures here would only affect lookups for
                // pre-seeded keys, which is acceptable in tests.
                const seed = new File({
                    contentType: "application/octet-stream",
                    id: key,
                    metadata: { name: key, size: bytes.length },
                    originalName: key,
                    size: bytes.length,
                }) as TFile;

                seed.name = key;
                seed.bytesWritten = bytes.length;
                seed.ETag = entityTag;
                seed.createdAt = now;
                seed.modifiedAt = now;
                seed.status = getFileStatus(seed);

                this.meta.save(key, seed).catch(() => {
                    /* fire-and-forget — see comment above */
                });
            }
        }
    }

    public override get raw(): Map<string, MemoryEntry> {
        return this.store;
    }

    public async create(fileInit: FileInit, _options?: OperationOptions): Promise<TFile> {
        return this.instrumentOperation("create", async () => {
            const file = new File(fileInit) as TFile;

            file.name = this.namingFunction(file);
            BaseStorage.assertSafeId(file.name);

            await this.validate(file);

            file.bytesWritten = 0;
            file.status = getFileStatus(file);

            await this.saveMeta(file);
            await this.onCreate(file);

            return file;
        });
    }

    public async write(part: FilePart | FileQuery, _options?: OperationOptions): Promise<TFile> {
        return this.instrumentOperation("write", async () => {
            const file = await this.getMeta((part).id);

            if (!hasContent(part)) {
                return file;
            }

            const { body, start } = part;
            const chunks: Buffer[] = [];

            for await (const chunk of body) {
                if (Buffer.isBuffer(chunk)) {
                    chunks.push(chunk);
                } else if (typeof chunk === "string") {
                    chunks.push(Buffer.from(chunk));
                } else if (ArrayBuffer.isView(chunk)) {
                    chunks.push(Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength));
                } else {
                    chunks.push(Buffer.from(chunk as ArrayBuffer));
                }
            }

            const incoming = Buffer.concat(chunks);
            const existing = this.store.get(file.name)?.bytes;
            const bytes: Buffer = start === 0 || !existing ? incoming : Buffer.concat([existing.subarray(0, start), incoming]);

            const now = new Date().toISOString();
            const entry: MemoryEntry = {
                bytes,
                contentType: file.contentType,
                createdAt: this.store.get(file.name)?.createdAt ?? now,
                eTag: etag(bytes),
                metadata: { ...file.metadata },
                modifiedAt: now,
            };

            this.store.set(file.name, entry);

            file.bytesWritten = bytes.length;
            file.ETag = entry.eTag;
            file.modifiedAt = entry.modifiedAt;
            updateSize(file, bytes.length);
            file.status = getFileStatus(file);

            await this.saveMeta(file);

            if (file.status === "completed") {
                await this.onComplete(file, {});
            }

            return file;
        });
    }

    public async get({ id }: FileQuery, _options?: OperationOptions & { range?: { end?: number; start: number } }): Promise<FileReturn> {
        return this.instrumentOperation("get", async () => {
            const file = await this.checkIfExpired(await this.meta.get(id));
            const entry = this.store.get(file.name);

            if (!entry) {
                return throwErrorCode(ERRORS.FILE_NOT_FOUND);
            }

            let content = entry.bytes;
            const range = (_options)?.range;

            if (range) {
                const start = Math.max(0, range.start);
                const end = range.end === undefined ? entry.bytes.length - 1 : Math.min(entry.bytes.length - 1, range.end);

                if (start > end || start >= entry.bytes.length) {
                    return throwErrorCode(ERRORS.BAD_REQUEST, `Invalid range ${start}-${range.end ?? ""}`);
                }

                content = entry.bytes.subarray(start, end + 1);
            }

            return {
                content,
                contentType: entry.contentType,
                ETag: entry.eTag,
                expiredAt: file.expiredAt,
                id,
                metadata: { ...entry.metadata },
                modifiedAt: entry.modifiedAt,
                name: file.name,
                originalName: file.originalName,
                size: content.length,
            };
        });
    }

    public override async getStream(
        { id }: FileQuery,
        _options?: OperationOptions & { range?: { end?: number; start: number } },
    ): Promise<{ headers?: Record<string, string>; size?: number; stream: Readable }> {
        return this.instrumentOperation("getStream", async () => {
            const file = await this.checkIfExpired(await this.meta.get(id));
            const entry = this.store.get(file.name);

            if (!entry) {
                return throwErrorCode(ERRORS.FILE_NOT_FOUND);
            }

            let content = entry.bytes;
            const range = (_options)?.range;

            if (range) {
                const start = Math.max(0, range.start);
                const end = range.end === undefined ? entry.bytes.length - 1 : Math.min(entry.bytes.length - 1, range.end);

                content = entry.bytes.subarray(start, end + 1);
            }

            return {
                headers: {
                    "Content-Length": String(content.length),
                    "Content-Type": entry.contentType,
                    ETag: entry.eTag,
                    "Last-Modified": entry.modifiedAt,
                },
                size: content.length,
                stream: Readable.from(content),
            };
        });
    }

    public override async exists({ id }: FileQuery): Promise<boolean> {
        return this.instrumentOperation("exists", async () => {
            try {
                const file = await this.meta.get(id);

                return this.store.has(file.name);
            } catch {
                return false;
            }
        });
    }

    public async delete({ id }: FileQuery): Promise<TFile> {
        return this.instrumentOperation("delete", async () => {
            const file = await this.getMeta(id);

            this.store.delete(file.name);
            await this.deleteMeta(id);

            const deleted = { ...file, status: "deleted" } as TFile;

            await this.onDelete(deleted);

            return deleted;
        });
    }

    public async copy(source: string, destination: string): Promise<TFile> {
        return this.instrumentOperation("copy", async () => {
            BaseStorage.assertSafeId(source);
            BaseStorage.assertSafeId(destination);

            const sourceFile = await this.getMeta(source);
            const entry = this.store.get(sourceFile.name);

            if (!entry) {
                return throwErrorCode(ERRORS.FILE_NOT_FOUND);
            }

            const now = new Date().toISOString();

            this.store.set(destination, {
                ...entry,
                bytes: Buffer.from(entry.bytes),
                metadata: { ...entry.metadata },
                modifiedAt: now,
            });

            const copied = { ...sourceFile, ETag: entry.eTag, id: destination, modifiedAt: now, name: destination } as TFile;

            await this.saveMeta(copied);

            return copied;
        });
    }

    public async move(source: string, destination: string): Promise<TFile> {
        return this.instrumentOperation("move", async () => {
            if (source === destination) {
                return this.getMeta(source);
            }

            const moved = await this.copy(source, destination);

            await this.delete({ id: source });

            return moved;
        });
    }

    public override async list(): Promise<TFile[]> {
        return this.instrumentOperation("list", async () => {
            const items: TFile[] = [];

            for (const [key, entry] of this.store) {
                items.push({
                    contentType: entry.contentType,
                    createdAt: entry.createdAt,
                    ETag: entry.eTag,
                    id: key,
                    metadata: { ...entry.metadata },
                    modifiedAt: entry.modifiedAt,
                    name: key,
                    size: entry.bytes.length,
                } as unknown as TFile);
            }

            return items;
        });
    }

    // eslint-disable-next-line class-methods-use-this -- memory URLs are derived solely from the key; no instance state is needed.
    public override async getReadUrl(key: string): Promise<string> {
        BaseStorage.assertSafeId(key);

        return `memory://${key}`;
    }

    // eslint-disable-next-line class-methods-use-this -- memory URLs are derived solely from the key; no instance state is needed.
    public override async getUploadUrl(key: string): Promise<string> {
        BaseStorage.assertSafeId(key);

        return `memory://${key}`;
    }
}

export default MemoryStorage;
