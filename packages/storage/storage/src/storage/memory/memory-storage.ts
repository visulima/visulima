import { Readable } from "node:stream";

import etag from "etag";

import { ERRORS, isUploadError, throwErrorCode } from "../../utils/errors";
import { toHttpDate } from "../../utils/headers";
import { retry } from "../../utils/retry";
import { isMetaNotFound } from "../meta-storage";
import type { MetaStorageOptions } from "../meta-storage-options";
import { BaseStorage } from "../storage";
import type { BaseStorageOptions, ConditionalOptions, ConditionalSupport, CopyConditionalOptions, OperationOptions, StoredObject } from "../types";
import { assertCondition, hasCondition } from "../utils/etag";
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

    protected override async statObject(id: string): Promise<StoredObject | undefined> {
        const entry = this.store.get(id);

        return entry && { contentType: entry.contentType, etag: entry.eTag, size: entry.bytes.length };
    }

    /** No checksum is verified against the written bytes, so none is advertised. */
    public override checksumTypes: string[] = [];

    public override readonly supportsRange: boolean = true;

    /** Every predicate is checked and applied in one synchronous step, so no other call interleaves. */
    public override readonly conditionalSupport: ConditionalSupport = { copy: true, create: true, delete: true, read: true, replace: true };

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

    public async create(fileInit: FileInit, options?: ConditionalOptions & OperationOptions): Promise<TFile> {
        return this.instrumentOperation("create", async () => {
            const file = new File(fileInit) as TFile;

            file.name = this.namingFunction(file);
            BaseStorage.assertSafeId(file.name);

            await this.validate(file);

            file.bytesWritten = 0;
            file.status = getFileStatus(file);

            // A conditional upload leaves the stored object and record alone until its write
            // commits; failing fast here only saves reading a body that cannot be stored.
            if (hasCondition(options)) {
                assertCondition(this.store.get(file.name)?.eTag, options);
                // Parked only once onCreate accepted it: a parked record nothing takes locks its key.
                await this.onCreate(file);
                this.parkConditional(file);

                return file;
            }

            // A create replaces whatever is stored under this id; its bytes must not trail the new upload.
            const previous = await this.meta.get(file.id).catch((error: unknown) => {
                if (isMetaNotFound(error)) {
                    return undefined;
                }

                throw error;
            });

            if (previous !== undefined) {
                this.store.delete(previous.name);
            }

            this.store.delete(file.name);

            await this.saveMeta(file);
            await this.onCreate(file);

            return file;
        });
    }

    public async write(part: FilePart | FileQuery, options?: ConditionalOptions & OperationOptions): Promise<TFile> {
        return this.instrumentOperation("write", async () => {
            const conditional = this.takeConditional(part.id, options);
            // Also fails before the body of an unknown upload is read.
            const file = conditional ?? (await this.getMeta(part.id));

            if (!hasContent(part)) {
                return file;
            }

            const chunks: Buffer[] = [];

            for await (const chunk of part.body) {
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

            // The read-modify-write of the bytes and metadata holds the per-id lock, like DiskStorage,
            // so concurrent writes to an id apply one after the other instead of saving stale copies.
            // The body is read before locking, so concurrent chunks only wait for each other's short
            // merge (the lock fails fast, hence the retry) instead of answering 423.
            return retry(async () => this.withLock(part.id, async () => this.storeBytes(part, incoming, conditional && { file: conditional, options })), {
                initialDelay: 1,
                maxDelay: 50,
                maxRetries: 20,
                shouldRetry: (error) => isUploadError(error) && error.UploadErrorCode === ERRORS.FILE_LOCKED,
            });
        });
    }

    public async get({ id }: FileQuery, options?: ConditionalOptions & OperationOptions & { range?: { end?: number; start: number } }): Promise<FileReturn> {
        return this.instrumentOperation("get", async () => {
            const file = await this.checkIfExpired(await this.meta.get(id));
            const entry = this.store.get(file.name);

            if (!entry) {
                return throwErrorCode(ERRORS.FILE_NOT_FOUND);
            }

            assertCondition(entry.eTag, { ifMatch: options?.ifMatch });

            let content = entry.bytes;
            const range = options?.range;

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
            const range = _options?.range;

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
                    "Last-Modified": toHttpDate(entry.modifiedAt),
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

    public async delete({ id }: FileQuery, options?: ConditionalOptions & OperationOptions): Promise<TFile> {
        return this.instrumentOperation("delete", async () => {
            const file = await this.getMeta(id);

            assertCondition(this.store.get(file.name)?.eTag, { ifMatch: options?.ifMatch });

            this.store.delete(file.name);
            await this.deleteMeta(id);

            const deleted = { ...file, status: "deleted" } as TFile;

            await this.onDelete(deleted);

            return deleted;
        });
    }

    public async copy(source: string, destination: string, options?: CopyConditionalOptions & OperationOptions): Promise<TFile> {
        return this.instrumentOperation("copy", async () => {
            BaseStorage.assertSafeId(source);
            BaseStorage.assertSafeId(destination);

            const sourceFile = await this.getMeta(source);
            const entry = this.store.get(sourceFile.name);

            if (!entry) {
                return throwErrorCode(ERRORS.FILE_NOT_FOUND);
            }

            assertCondition(entry.eTag, { ifMatch: options?.sourceIfMatch });
            assertCondition(this.store.get(destination)?.eTag, { ifMatch: options?.ifMatch, ifNoneMatch: options?.ifNoneMatch });

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

    /**
     * Writes `incoming` at `part.start` and saves the metadata; call with the id's lock held. A
     * `conditional` upload replaces the object wholesale once its predicate holds.
     */
    private async storeBytes(part: FilePart, incoming: Buffer, conditional?: { file: TFile; options: ConditionalOptions | undefined }): Promise<TFile> {
        const file = conditional?.file ?? (await this.getMeta(part.id));

        if (part.size !== undefined) {
            updateSize(file, part.size);
        }

        const { start } = part;
        const existing = this.store.get(file.name)?.bytes;
        // Rewriting a finished file from byte 0 (e.g. REST PUT) replaces it wholesale. Chunked
        // uploads are excluded: providers mark them completed as soon as the furthest byte lands,
        // so offset 0 can still be a missing chunk of an unfinished upload.
        const isOverwrite = conditional !== undefined || (start === 0 && file.status === "completed" && file.metadata?._chunkedUpload !== true);
        const base = isOverwrite || !existing ? Buffer.alloc(0) : existing;

        // Write at `start`, growing the buffer as needed and leaving bytes outside
        // `[start, start + incoming.length)` untouched, so out-of-order chunks don't clobber each other.
        const bytes = Buffer.alloc(Math.max(base.length, start + incoming.length));

        base.copy(bytes);
        incoming.copy(bytes, start);

        // An overwrite may be shorter than the file it replaces.
        if (isOverwrite) {
            updateSize(file, bytes.length);
        }

        const now = new Date().toISOString();
        const entry: MemoryEntry = {
            bytes,
            contentType: file.contentType,
            createdAt: this.store.get(file.name)?.createdAt ?? now,
            eTag: etag(bytes),
            metadata: { ...file.metadata },
            modifiedAt: now,
        };

        // Checked right before the store is updated, with no await in between.
        if (conditional) {
            assertCondition(this.store.get(file.name)?.eTag, conditional.options);
        }

        this.store.set(file.name, entry);

        file.bytesWritten = bytes.length;
        file.ETag = entry.eTag;
        file.modifiedAt = entry.modifiedAt;
        file.status = getFileStatus(file);

        // onComplete is the upload handlers' job (they call it once the upload is
        // completed); calling it here too made every handler upload fire it twice.
        await this.saveMeta(file);

        return file;
    }

    /** The stored entry is authoritative: a record may outlive its bytes. */
    protected override async currentETag(file: TFile): Promise<string | undefined> {
        return this.store.get(file.name)?.eTag;
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
