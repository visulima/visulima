import { randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { copyFile, open, rename, stat, truncate } from "node:fs/promises";
import type { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream";

import { ensureDir, ensureFile, move, readFile, remove, walk } from "@visulima/fs";
import { dirname, isAbsolute, join } from "@visulima/path";
import etag from "etag";

import { detectFileTypeFromStream } from "../../utils/detect-file-type";
// @ts-expect-error - UploadError is used for type checking in error handling
import type { UploadError } from "../../utils/errors";
import { ERRORS, isUploadError, throwErrorCode } from "../../utils/errors";
import { toHttpDate } from "../../utils/headers";
import { streamChecksum } from "../../utils/pipes/stream-checksum";
import StreamLength from "../../utils/pipes/stream-length";
import toMilliseconds from "../../utils/primitives/to-milliseconds";
import { retry } from "../../utils/retry";
import type { HttpError } from "../../utils/types";
import type MetaStorage from "../meta-storage";
import { isMetaNotFound } from "../meta-storage";
import { BaseStorage, defaultFilesystemFileNameValidation } from "../storage";
import type { ConditionalOptions, ConditionalSupport, CopyConditionalOptions, DiskStorageOptions, OperationOptions, StoredObject } from "../types";
import { assertCondition, hasCondition } from "../utils/etag";
import type { FileInit, FilePart, FileQuery } from "../utils/file";
import { File, getFileStatus, hasContent, partMatch, updateSize } from "../utils/file";
import type { FileReturn } from "../utils/file/types";
import LocalMetaStorage from "./local-meta-storage";

/**
 * Local disk-based storage implementation.
 * @template TFile The file type used by this storage backend.
 * @remarks
 * ## Error Handling
 * - Filesystem operations throw errors directly (no retry logic)
 * - File not found errors are thrown immediately
 * - Permission errors are propagated as-is
 *
 * ## Retry Behavior
 * - No automatic retries (filesystem operations are typically immediate)
 * - Errors are thrown directly for immediate feedback
 *
 * ## File Paths
 * - Files are stored in the configured directory
 * - Metadata files use the `.META` suffix by default
 * - File paths are resolved relative to the storage directory
 */
class DiskStorage<TFile extends File = File> extends BaseStorage<TFile> {
    public static override readonly name: string = "disk";

    public override checksumTypes: string[] = ["md5", "sha1"];

    public override readonly supportsRange: boolean = true;

    /**
     * Predicates are compared under the storage lock of the key, and a conditional upload lands
     * through an atomic rename. The lock is process-local: writers in another process are not
     * excluded.
     */
    public override readonly conditionalSupport: ConditionalSupport = { copy: true, create: true, delete: true, read: true, replace: true };

    public override get raw(): { directory: string } {
        return { directory: this.directory };
    }

    public directory: string;

    public meta: MetaStorage<TFile>;

    public constructor(config: DiskStorageOptions<TFile>) {
        // Override filename validation with filesystem-specific validation BEFORE super(),
        // so BaseStorage captures the stricter local-filesystem validator at construct-time.
        // Local filesystems have stricter character restrictions than cloud storage platforms.
        const resolvedConfig = {
            ...config,
            fileNameValidation: config.fileNameValidation ?? defaultFilesystemFileNameValidation,
        };

        super(resolvedConfig);

        this.directory = resolvedConfig.directory;

        if (resolvedConfig.metaStorage) {
            this.meta = resolvedConfig.metaStorage;
        } else {
            const metaConfig = { ...resolvedConfig, ...resolvedConfig.metaStorageConfig, logger: this.logger };

            this.meta = new LocalMetaStorage(metaConfig);
        }

        this.startAccessCheck(async () => this.accessCheck());
    }

    /**
     * Normalizes errors with disk storage context.
     * @param error The error to normalize.
     * @returns Normalized HTTP error.
     */
    public override normalizeError(error: Error): HttpError {
        return super.normalizeError(error);
    }

    /**
     * Creates a new file upload and saves its metadata.
     * @param fileInit File initialization configuration.
     * @returns Promise resolving to the created file object.
     * @throws {Error} If validation fails.
     * @remarks
     * Supports TTL (time-to-live) option in fileInit.
     * An upload already stored under the same id is replaced: its content is discarded and the
     * new upload starts empty.
     */
    public async create(fileInit: FileInit, options?: ConditionalOptions & OperationOptions): Promise<TFile> {
        return this.instrumentOperation("create", async () => {
            // Handle TTL option
            const processedConfig = { ...fileInit };

            if (fileInit.ttl) {
                const ttlMs = typeof fileInit.ttl === "string" ? toMilliseconds(fileInit.ttl) : fileInit.ttl;

                if (ttlMs !== undefined) {
                    processedConfig.expiredAt = Date.now() + ttlMs;
                }
            }

            // Validate size before constructing File (File constructor normalizes negative sizes to undefined)
            if (processedConfig.size !== undefined && Number(processedConfig.size) < 0) {
                throwErrorCode(ERRORS.REQUEST_ENTITY_TOO_LARGE, "Request entity too large");
            }

            const file = new File(processedConfig);

            file.name = this.namingFunction(file as TFile);

            // Only set default size if size is NaN (not if it's undefined for defer-length)
            if (file.size === undefined || Number.isNaN(file.size)) {
                // For defer-length, keep size as undefined
                // For other cases, set to maxUploadSize if NaN
                if (file.size === undefined) {
                    // Keep undefined for creation-defer-length extension
                } else {
                    file.size = this.maxUploadSize;
                }
            }

            await this.validate(file as TFile);

            DiskStorage.assertSafeId(file.id);

            // A conditional upload leaves the stored file and record alone: its write stores the body
            // next to the target and renames it into place once the predicate holds.
            if (hasCondition(options)) {
                assertCondition(await this.eTagOf(file.name), options);
                file.bytesWritten = 0;
                file.status = getFileStatus(file);
                this.parkConditional(file as TFile);
                await this.onCreate(file as TFile);

                return file as TFile;
            }

            const path = this.getFilePath(file.name);
            let previous: TFile | undefined;

            try {
                previous = await this.meta.get(file.id);
            } catch (error: unknown) {
                if (!isMetaNotFound(error)) {
                    throw error;
                }
            }

            try {
                // The content of a replaced upload (or an orphan without metadata) must not trail the new one.
                if (previous !== undefined && previous.name !== file.name) {
                    await remove(this.getFilePath(previous.name));
                }

                await ensureFile(path);
                await truncate(path, 0);
                file.bytesWritten = 0;
            } catch (error: unknown) {
                const httpError = this.normalizeError(error instanceof Error ? error : new Error(String(error)));

                await this.onError(httpError);
                throwErrorCode(ERRORS.FILE_ERROR, httpError.message as string);
            }

            file.status = getFileStatus(file);

            await this.saveMeta(file as TFile);

            await this.onCreate(file as TFile);

            return file as TFile;
        });
    }

    /**
     * Writes data to a file upload.
     * @param part File part containing data to write, file query, or full file object.
     * @returns Promise resolving to the updated file object.
     * @throws {Error} If file is expired (ERRORS.GONE), locked (ERRORS.FILE_LOCKED), or conflicts occur (ERRORS.FILE_CONFLICT).
     * @remarks
     * Supports chunked uploads with start position.
     * Automatically detects file type from stream on first chunk if contentType is not set.
     * Validates checksum algorithms if provided.
     * Uses file locking to prevent concurrent writes.
     * Updates file status to "completed" when all bytes are written.
     */
    public async write(part: FilePart | FileQuery | TFile, options?: ConditionalOptions & OperationOptions): Promise<TFile> {
        // Taken before locking: a lock that can't be acquired must not strand the parked record.
        const conditional = this.takeConditional(part.id, options);

        // Lock before reading the metadata, so the offset checked and extended is the one stored
        // after any earlier write finished.
        return this.instrumentOperation("write", async () =>
            this.withLock(part.id, async () => {
                if (conditional) {
                    return this.writeConditional(conditional, part, options);
                }

                let file: TFile;

                const isFullFile = "contentType" in part && "metadata" in part && !("body" in part) && !("start" in part);

                if (isFullFile) {
                    // part is a full file object (not a FilePart)
                    file = part;
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
                    return throwErrorCode(ERRORS.FILE_CONFLICT);
                }

                const path = this.getFilePath(file.name);

                try {
                    const startPosition = (part as FilePart).start || 0;

                    await ensureFile(path);

                    // Only reset bytesWritten to startPosition if it's the first write (bytesWritten is 0)
                    if (file.bytesWritten === 0) {
                        file.bytesWritten = startPosition;
                    }

                    if (hasContent(part)) {
                        if (this.isUnsupportedChecksum(part.checksumAlgorithm)) {
                            return throwErrorCode(ERRORS.UNSUPPORTED_CHECKSUM_ALGORITHM);
                        }

                        // Detect file type from stream if contentType is not set or is default
                        // Only detect on first write (when bytesWritten is 0 or NaN, and start is 0 or undefined)
                        // For chunked uploads, only detect on the first chunk (offset 0)
                        const isFirstChunk = part.start === 0 || part.start === undefined;

                        if (
                            isFirstChunk &&
                            (file.bytesWritten === 0 || Number.isNaN(file.bytesWritten)) &&
                            (!file.contentType || file.contentType === "application/octet-stream")
                        ) {
                            try {
                                const { fileType, stream: detectedStream } = await detectFileTypeFromStream(part.body);

                                // Update contentType if file type was detected
                                if (fileType?.mime) {
                                    file.contentType = fileType.mime;
                                }

                                // Use the stream from file type detection

                                part.body = detectedStream;
                            } catch {
                                // If file type detection fails, continue with original stream
                                // This is not a critical error
                            }
                        }

                        // Create lazyWritePart ensuring body stream and signal are preserved
                        const signalFromPart = (part as FilePart & { signal?: AbortSignal }).signal;
                        const lazyWritePart = { ...file, ...part, body: part.body, name: file.name, start: startPosition } as FilePart &
                            TFile & { signal?: AbortSignal };

                        // Explicitly preserve body stream reference and signal

                        if (signalFromPart) {
                            lazyWritePart.signal = signalFromPart;
                        }

                        const [bytesWritten, errorCode] = await this.lazyWrite(lazyWritePart);

                        if (errorCode) {
                            await truncate(path, file.bytesWritten);

                            return throwErrorCode(errorCode);
                        }

                        if (Number.isNaN(bytesWritten)) {
                            // An aborted keepPartial (checksum-less) write resolves with NaN and
                            // no error code. The pipeline did not complete, so the declared
                            // contentLength must not be credited (that plus Math.max(x, NaN) would
                            // persist NaN as the offset). Re-derive the real offset from disk.
                            const { size } = await stat(path);

                            file.bytesWritten = size;
                        } else {
                            // The bytes that actually landed: a body shorter than its Content-Length
                            // leaves the upload incomplete at its real offset.
                            file.bytesWritten = bytesWritten;
                        }

                        file.status = getFileStatus(file);
                        file.modifiedAt = new Date().toISOString();

                        await this.saveMeta(file);
                    } else {
                        await ensureFile(path);
                        file.bytesWritten = 0;
                    }

                    return file;
                } catch (error: unknown) {
                    // Preserve UploadError instances (they already have the correct error code)
                    if (isUploadError(error)) {
                        throw error;
                    }

                    const httpError = this.normalizeError(error instanceof Error ? error : new Error(String(error)));

                    await this.onError(httpError);

                    return throwErrorCode(ERRORS.FILE_ERROR, (typeof httpError.message === "string" ? httpError.message : String(error)) || String(error));
                }
            }),
        );
    }

    /**
     * Store the body of a conditional upload in a sibling file, then — still under the key's lock —
     * check the predicate and rename it over the target. A failed predicate leaves the target and
     * its record untouched.
     */
    private async writeConditional(file: TFile, part: FilePart | FileQuery | TFile, options: ConditionalOptions | undefined): Promise<TFile> {
        const target = file.name;
        const staged = { ...file, name: `${target}.${randomUUID()}.conditional` } as TFile;
        const stagedPath = this.getFilePath(staged.name);

        try {
            if (!hasContent(part)) {
                return throwErrorCode(ERRORS.BAD_REQUEST, "A conditional upload needs a body");
            }

            if (part.size !== undefined) {
                updateSize(staged, part.size);
            }

            await ensureFile(stagedPath);

            const [bytesWritten, errorCode] = await this.lazyWrite({ ...staged, ...part, body: part.body, name: staged.name, start: 0 });

            if (errorCode) {
                return throwErrorCode(errorCode);
            }

            staged.bytesWritten = bytesWritten;
            staged.status = getFileStatus(staged);

            if (staged.status !== "completed") {
                return throwErrorCode(ERRORS.FILE_CONFLICT, "A conditional upload has to be written in one request");
            }

            assertCondition(await this.eTagOf(target), options);
            await ensureDir(dirname(this.getFilePath(target)));
            await rename(stagedPath, this.getFilePath(target));
        } finally {
            await remove(stagedPath);
        }

        staged.name = target;
        staged.ETag = await this.eTagOf(target);
        staged.modifiedAt = new Date().toISOString();

        return this.saveMeta(staged);
    }

    /**
     * Strong ETag of the file stored under `name` (the one {@link DiskStorage.get} reports), or
     * `undefined` when there is none.
     */
    // Limitation: hashes the whole file per conditional check; persisting the ETag on write would avoid it.
    private async eTagOf(name: string): Promise<string | undefined> {
        try {
            return etag(await readFile(this.getFilePath(name), { buffer: true }));
        } catch (error: unknown) {
            if ((error as { code?: string }).code === "ENOENT") {
                return undefined;
            }

            throw error;
        }
    }

    protected override async currentETag(file: TFile): Promise<string | undefined> {
        return this.eTagOf(file.name);
    }

    /**
     * Gets an uploaded file by ID.
     * @param query File query containing the file ID to retrieve.
     * @param query.id File ID to retrieve.
     * @returns Promise resolving to the file data including content buffer.
     * @throws {Error} If the file cannot be found (ERRORS.FILE_NOT_FOUND) or has expired (ERRORS.GONE).
     * @remarks
     * Loads the entire file content into memory as a Buffer.
     * For large files, consider using getStream() instead.
     * Includes ETag (MD5 hash) for content verification.
     */
    public async get({ id }: FileQuery, options?: ConditionalOptions & OperationOptions & { range?: { end?: number; start: number } }): Promise<FileReturn> {
        if (options?.ifMatch !== undefined) {
            const { ifMatch, ...rest } = options;

            // The check and the read share the key's lock, so no conditional write lands in between.
            return this.withLockWhenFree(id, async () => {
                assertCondition(await this.currentETag(await this.getMeta(id)), { ifMatch });

                return this.get({ id }, rest);
            });
        }

        return this.instrumentOperation("get", async () => {
            const file = await this.checkIfExpired(await this.meta.get(id));
            const { bytesWritten, contentType, expiredAt, metadata, modifiedAt, name, originalName, size } = file;
            const filePath = this.getFilePath(name);
            const range = options?.range;

            const handleReadError = async (error: unknown): Promise<never> => {
                const errorWithCode = error as { code?: string; message?: string };

                if (errorWithCode.code === "ENOENT" || errorWithCode.code === "EPERM") {
                    const httpError = this.normalizeError(error instanceof Error ? error : new Error(errorWithCode.message || String(error)));

                    await this.onError(httpError);

                    return throwErrorCode(ERRORS.FILE_NOT_FOUND, (typeof httpError.message === "string" ? httpError.message : String(error)) || String(error));
                }

                const httpError = this.normalizeError(error instanceof Error ? error : new Error(String(error)));

                await this.onError(httpError);
                throw error;
            };

            // Ranged read: only the requested slice is allocated. A 1 KB range of a 5 GB upload
            // reads 1 KB instead of buffering the whole file just to `subarray` it afterwards.
            // The ETag is derived cheaply from stat (size + mtime) since hashing the full content
            // would defeat the point of streaming a small range.
            if (range) {
                let stats;

                try {
                    stats = await stat(filePath);
                } catch (error: unknown) {
                    return handleReadError(error);
                }

                const fileSize = stats.size;
                const start = Math.max(0, range.start);
                const end = range.end === undefined ? fileSize - 1 : Math.min(fileSize - 1, range.end);

                if (start > end || start >= fileSize) {
                    return throwErrorCode(ERRORS.BAD_REQUEST, `Invalid range ${start}-${range.end ?? ""}`);
                }

                const length = end - start + 1;
                const buffer = Buffer.allocUnsafe(length);
                let handle;

                try {
                    handle = await open(filePath, "r");

                    await handle.read(buffer, 0, length, start);
                } catch (error: unknown) {
                    return handleReadError(error);
                } finally {
                    await handle?.close();
                }

                // Weak, range-aware ETag: stat-based so it never re-reads the body. The range suffix
                // keeps slices of the same object distinguishable.
                const weakETag = `W/"${fileSize.toString(16)}-${Math.trunc(stats.mtimeMs).toString(16)}-${start}-${end}"`;

                return {
                    content: buffer,
                    contentType,
                    ETag: weakETag,
                    expiredAt,
                    id,
                    metadata,
                    modifiedAt,
                    name,
                    originalName,
                    size: length,
                };
            }

            let content: Buffer;

            try {
                content = await readFile(filePath, { buffer: true });
            } catch (error: unknown) {
                return handleReadError(error);
            }

            return {
                content,
                contentType,
                ETag: etag(content),
                expiredAt,
                id,
                metadata,
                modifiedAt,
                name,
                originalName,
                size: size || bytesWritten,
            };
        });
    }

    /**
     * Checks if a file exists by verifying both metadata and the actual filesystem file.
     * Returns true only if both the metadata and the file exist.
     * @param query File query containing the file ID to check.
     * @returns Promise resolving to true if both metadata and file exist, false otherwise.
     */
    public override async exists({ id }: FileQuery): Promise<boolean> {
        return this.instrumentOperation("exists", async () => {
            try {
                // First check if metadata exists
                const file = await this.getMeta(id);

                // Then verify the actual file exists on filesystem
                const filePath = this.getFilePath(file.name);

                await stat(filePath);

                return true;
            } catch (error: unknown) {
                // Check if it's a file not found error
                const errorWithCode = error as { code?: string };

                if (errorWithCode.code === "ENOENT") {
                    return false;
                }

                // For metadata errors, also return false
                return false;
            }
        });
    }

    /**
     * Gets an uploaded file as a readable stream for efficient large file handling.
     * @param query File query containing the file ID to stream.
     * @param query.id File ID to stream.
     * @returns Promise resolving to an object containing the stream, headers, and size.
     * @throws {UploadError} If the file cannot be found (ERRORS.FILE_NOT_FOUND) or has expired (ERRORS.GONE).
     * @remarks Creates a readable stream directly from the file system for efficient memory usage.
     */
    public override async getStream({ id }: FileQuery): Promise<{ headers?: Record<string, string>; size?: number; stream: Readable }> {
        return this.instrumentOperation("getStream", async () => {
            try {
                const file = await this.checkIfExpired(await this.meta.get(id));
                const { bytesWritten, contentType, expiredAt, modifiedAt, name, size } = file;

                // Create a readable stream directly from the file
                const stream = createReadStream(this.getFilePath(name));

                return {
                    headers: {
                        "Content-Length": String(size || bytesWritten),
                        "Content-Type": contentType,
                        ...(expiredAt && { "X-Upload-Expires": expiredAt.toString() }),
                        ...(modifiedAt && { "Last-Modified": toHttpDate(modifiedAt) }),
                        // Note: ETag requires reading the file content, so we don't include it for streaming
                        // Clients can use HEAD requests to get ETag if needed
                    },
                    size: size || bytesWritten,
                    stream,
                };
            } catch (error: unknown) {
                // Convert any filesystem error when reading metadata to FILE_NOT_FOUND
                const httpError = this.normalizeError(error instanceof Error ? error : new Error(String(error)));

                await this.onError(httpError);
                throw throwErrorCode(ERRORS.FILE_NOT_FOUND, (typeof httpError.message === "string" ? httpError.message : String(error)) || String(error));
            }
        });
    }

    protected override async statObject(id: string): Promise<StoredObject | undefined> {
        let stats: Awaited<ReturnType<typeof stat>>;

        try {
            stats = await stat(this.getFilePath(id));
        } catch (error: unknown) {
            if ((error as { code?: string }).code === "ENOENT") {
                return undefined;
            }

            throw error;
        }

        return stats.isFile() ? { size: stats.size } : undefined;
    }

    /**
     * Deletes an upload and its metadata.
     * @param query File query containing the file ID to delete.
     * @param query.id File ID to delete.
     * @returns Promise resolving to the deleted file object with status: "deleted".
     * @throws {UploadError} If the file metadata cannot be found.
     */
    public async delete({ id }: FileQuery, options?: ConditionalOptions & OperationOptions): Promise<TFile> {
        if (options?.ifMatch !== undefined) {
            const { ifMatch } = options;

            return this.withLockWhenFree(id, async () => {
                assertCondition(await this.currentETag(await this.getMeta(id)), { ifMatch });

                return this.delete({ id });
            });
        }

        return this.instrumentOperation("delete", async () => {
            const file = await this.getMeta(id);

            await remove(this.getFilePath(file.name));
            await this.deleteMeta(id);

            const deletedFile = { ...file, status: "deleted" } as TFile;

            await this.onDelete(deletedFile);

            return deletedFile;
        });
    }

    /**
     * Copies an upload file to a new location.
     * @param name Source file name/ID.
     * @param destination Destination file name/ID.
     * @returns Promise resolving to the copied file object.
     * @throws {UploadError} If the source file cannot be found.
     */
    public async copy(name: string, destination: string, options?: CopyConditionalOptions & OperationOptions): Promise<TFile> {
        const { ifMatch, ifNoneMatch, sourceIfMatch } = options ?? {};

        if (sourceIfMatch !== undefined || ifMatch !== undefined || ifNoneMatch !== undefined) {
            // Lock both keys, so neither changes between the checks and the copy.
            return this.withLockWhenFree(name, async () => {
                const check = async (): Promise<TFile> => {
                    assertCondition(await this.currentETag(await this.getMeta(name)), { ifMatch: sourceIfMatch });
                    assertCondition(await this.eTagOf(destination), { ifMatch, ifNoneMatch });

                    return this.copy(name, destination);
                };

                return name === destination ? check() : this.withLockWhenFree(destination, check);
            });
        }

        return this.instrumentOperation("copy", async () => {
            DiskStorage.assertSafeId(name);
            DiskStorage.assertSafeId(destination);

            const sourceFile = await this.getMeta(name);
            const destinationPath = this.getFilePath(destination);

            await ensureDir(dirname(destinationPath));
            await copyFile(this.getFilePath(sourceFile.name), destinationPath);

            return this.saveMeta({ ...sourceFile, id: destination, name: destination });
        });
    }

    /**
     * Moves an upload file to a new location.
     * @param name Source file name/ID.
     * @param destination Destination file name/ID.
     * @returns Promise resolving to the moved file object.
     * @throws {Error} If the source file cannot be found.
     */
    public async move(name: string, destination: string): Promise<TFile> {
        return this.instrumentOperation("move", async () => {
            DiskStorage.assertSafeId(name);
            DiskStorage.assertSafeId(destination);

            // Get source metadata first to get the actual file name
            const sourceFile = await this.getMeta(name);

            if (name === destination) {
                return sourceFile;
            }

            const source = this.getFilePath(sourceFile.name);
            const destinationPath = this.getFilePath(destination);

            await ensureDir(dirname(destinationPath));

            try {
                await move(source, destinationPath);
            } catch (error: unknown) {
                const errorWithCode = error as { code?: string };

                if (errorWithCode?.code === "EXDEV") {
                    await copyFile(source, destinationPath);
                    await remove(source);
                } else {
                    const httpError = this.normalizeError(error instanceof Error ? error : new Error(String(error)));

                    await this.onError(httpError);
                    throw error;
                }
            }

            const moved = await this.saveMeta({ ...sourceFile, id: destination, name: destination });

            await this.deleteMeta(name);

            return moved;
        });
    }

    /**
     * Retrieves a list of uploaded files.
     * @returns Promise resolving to an array of file metadata objects.
     * @remarks Walks the storage directory and returns all files, excluding metadata files.
     */
    public override async list(): Promise<TFile[]> {
        return this.instrumentOperation("list", async () => {
            const config = {
                followSymlinks: false,
                includeDirs: false,
                includeFiles: true,
                skip: ["*.META$"],
            };
            const uploads: TFile[] = [];

            const { directory } = this;
            // walk() yields native-separator paths (backslash on Windows); the storage
            // `directory` is whatever the caller passed in (often native too). Normalize
            // both to forward slashes so the relative id is `/a/b.txt` instead of the
            // full drive-rooted absolute path on Windows. Note: `@visulima/path`'s `sep`
            // is hardcoded to `/` cross-platform, so we replace `\\` directly here.
            const toPosix = (value: string): string => value.replaceAll("\\", "/");
            const normalizedDirectory = toPosix(directory);

            for await (const founding of walk(directory, config)) {
                const { suffix } = this.meta;
                const { path } = founding;

                if (!path.includes(suffix)) {
                    const { birthtime, ctime, mtime } = await stat(path);
                    const normalizedPath = toPosix(path);
                    const id = normalizedPath.startsWith(normalizedDirectory) ? normalizedPath.slice(normalizedDirectory.length) : normalizedPath;

                    uploads.push({ createdAt: birthtime || ctime, id, modifiedAt: mtime } as TFile);
                }
            }

            return uploads;
        });
    }

    /**
     * Returns the absolute on-disk path for the uploaded file, always rooted at
     * `this.directory`. Absolute inputs and `..` traversals are rejected.
     */
    protected getFilePath(filename: string): string {
        DiskStorage.assertSafeId(filename);

        if (isAbsolute(filename)) {
            // assertSafeId already rejects absolute paths, but keep the guard
            // here so the function remains correct if the check is ever loosened.
            throwErrorCode(ERRORS.INVALID_FILE_NAME, `Invalid file id: "${filename}"`);
        }

        return join(this.directory, filename);
    }

    /**
     * Streams the part body to disk at `part.start`.
     * @param part The part to write
     * @param transforms Extra transforms the body passes through before it lands on disk
     * @returns The offset after the write, or NaN with an error code when the write failed
     */
    protected lazyWrite(part: File & FilePart, transforms: Transform[] = []): Promise<[number, ERRORS?]> {
        return new Promise((resolve, reject) => {
            const destination = createWriteStream(this.getFilePath(part.name), { flags: "r+", start: part.start });
            const lengthChecker = new StreamLength(part.contentLength || (part.size as number) - part.start);
            const checksumChecker = streamChecksum(part.checksum as string, part.checksumAlgorithm as string);
            const keepPartial = !part.checksum;
            // Check for signal on part object
            const { signal } = part as FilePart & { signal?: AbortSignal };

            const cleanupStreams = (): void => {
                destination.close();
                lengthChecker.destroy();
                checksumChecker.destroy();
            };

            const failWithCode = (code?: ERRORS): void => {
                cleanupStreams();
                resolve([Number.NaN, code]);
            };

            lengthChecker.on("error", () => {
                failWithCode(ERRORS.FILE_CONFLICT);
            });
            checksumChecker.on("error", () => {
                failWithCode(ERRORS.CHECKSUM_MISMATCH);
            });

            part.body.on("aborted", () => {
                failWithCode(keepPartial ? undefined : ERRORS.REQUEST_ABORTED);
            });
            part.body.on("error", (error) => {
                cleanupStreams();
                reject(error);
            });

            // Check if signal is already aborted before starting pipeline
            if (signal?.aborted) {
                failWithCode(keepPartial ? undefined : ERRORS.REQUEST_ABORTED);

                return;
            }

            // Handle AbortController signal manually
            // Note: We handle signal manually instead of using pipeline options for better compatibility
            let onAbort: (() => void) | undefined;

            if (signal) {
                onAbort = () => {
                    cleanupStreams();
                    destination.destroy();
                    lengthChecker.destroy();
                    checksumChecker.destroy();
                    part.body.destroy();
                    resolve([Number.NaN, keepPartial ? undefined : ERRORS.REQUEST_ABORTED]);
                };

                signal.addEventListener("abort", onAbort, { once: true });
            }

            pipeline([part.body, lengthChecker, checksumChecker, ...transforms, destination], (error) => {
                if (signal && onAbort) {
                    signal.removeEventListener("abort", onAbort);
                }

                if (error) {
                    cleanupStreams();

                    // Check if error is due to abort signal
                    if (signal?.aborted) {
                        resolve([Number.NaN, keepPartial ? undefined : ERRORS.REQUEST_ABORTED]);

                        return;
                    }

                    // Convert other pipeline errors to error codes
                    resolve([Number.NaN, ERRORS.FILE_ERROR]);

                    return;
                }

                resolve([part.start + destination.bytesWritten]);
            });
        });
    }

    /**
     * Runs `function_` under the key's lock, waiting briefly while another request holds it: the
     * lock fails fast, and a conditional read or delete must not answer 423 for a concurrent one.
     * @param key Lock key
     * @param function_ Work to do under the lock
     * @returns What `function_` returns
     */
    private async withLockWhenFree<R>(key: string, function_: () => Promise<R>): Promise<R> {
        return retry(async () => this.withLock(key, function_), {
            initialDelay: 1,
            maxDelay: 50,
            maxRetries: 20,
            shouldRetry: (error) => isUploadError(error) && error.UploadErrorCode === ERRORS.FILE_LOCKED,
        });
    }

    private async accessCheck(): Promise<void> {
        await ensureDir(this.directory);
    }
}

export default DiskStorage;
