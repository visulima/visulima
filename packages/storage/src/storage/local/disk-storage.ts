import { createReadStream, createWriteStream } from "node:fs";
import { copyFile, stat, truncate } from "node:fs/promises";
import type { Readable } from "node:stream";
import { pipeline } from "node:stream";

// eslint-disable-next-line import/no-extraneous-dependencies
import { ensureDir, ensureFile, move, readFile, remove, walk } from "@visulima/fs";
// eslint-disable-next-line import/no-extraneous-dependencies
import { isAbsolute, join } from "@visulima/path";
// eslint-disable-next-line import/no-extraneous-dependencies
import etag from "etag";

import { detectFileTypeFromStream } from "../../utils/detect-file-type";
import { ERRORS, throwErrorCode } from "../../utils/errors";
import { streamChecksum } from "../../utils/pipes/stream-checksum";
import StreamLength from "../../utils/pipes/stream-length";
import toMilliseconds from "../../utils/primitives/to-milliseconds";
import type { HttpError } from "../../utils/types";
import type MetaStorage from "../meta-storage";
import { BaseStorage, defaultFilesystemFileNameValidation } from "../storage";
import type { DiskStorageOptions } from "../types";
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
class DiskStorage<TFile extends File = File> extends BaseStorage<TFile, FileReturn> {
    public static override readonly name: string = "disk";

    public override checksumTypes: string[] = ["md5", "sha1"];

    public directory: string;

    public meta: MetaStorage<TFile>;

    public constructor(config: DiskStorageOptions<TFile>) {
        super(config);

        this.directory = config.directory;

        if (config.metaStorage) {
            this.meta = config.metaStorage;
        } else {
            const metaConfig = { ...config, ...config.metaStorageConfig, logger: this.logger };

            this.meta = new LocalMetaStorage(metaConfig);
        }

        // Override filename validation with filesystem-specific validation
        // Local filesystems have stricter character restrictions than cloud storage platforms
        if (!config.fileNameValidation) {
            // eslint-disable-next-line no-param-reassign
            config.fileNameValidation = defaultFilesystemFileNameValidation;
        }

        this.isReady = false;
        this.accessCheck()
            .then(() => {
                this.isReady = true;
            })
            .catch((error) => {
                this.logger?.error("Storage access check failed: %O", error);
            });
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
     * @throws {Error} If validation fails or file already exists and is completed.
     * @remarks
     * Supports TTL (time-to-live) option in fileInit.
     * Creates the file on disk if it doesn't exist.
     * Returns existing file if it's already completed.
     */
    public async create(fileInit: FileInit): Promise<TFile> {
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

            try {
                const existing = await this.getMeta(file.id);

                if (existing.status === "completed") {
                    return existing;
                }
            } catch {
                // ignore
            }

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

            const path = this.getFilePath(file.name);

            try {
                await ensureFile(path);
                file.bytesWritten = 0;
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : String(error);

                throwErrorCode(ERRORS.FILE_ERROR, message);
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
    public async write(part: FilePart | FileQuery | TFile): Promise<TFile> {
        // eslint-disable-next-line sonarjs/cognitive-complexity
        return this.instrumentOperation("write", async () => {
            let file: TFile;

            const isFullFile = "contentType" in part && "metadata" in part && !("body" in part) && !("start" in part);

            if (isFullFile) {
                // part is a full file object (not a FilePart)
                file = part as TFile;
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

            await this.lock(path);

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
                    const isFirstChunk = (part as FilePart).start === 0 || (part as FilePart).start === undefined;

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
                            // eslint-disable-next-line no-param-reassign
                            part.body = detectedStream;
                        } catch {
                            // If file type detection fails, continue with original stream
                            // This is not a critical error
                        }
                    }

                    // Create lazyWritePart ensuring body stream and signal are preserved
                    const signalFromPart = (part as FilePart & { signal?: AbortSignal }).signal;
                    const lazyWritePart: FilePart & { signal?: AbortSignal } = { ...file, ...part, body: part.body };

                    // Explicitly preserve body stream reference and signal

                    if (signalFromPart) {
                        lazyWritePart.signal = signalFromPart;
                    }

                    const [bytesWritten, errorCode] = await this.lazyWrite(lazyWritePart);

                    if (errorCode) {
                        await truncate(path, file.bytesWritten);

                        return throwErrorCode(errorCode);
                    }

                    // Update bytesWritten to the expected position after writing
                    const expectedBytesWritten = startPosition + (part.contentLength || 0);

                    file.bytesWritten = Math.max(file.bytesWritten || 0, expectedBytesWritten);
                    // Also update with the actual bytes written from lazyWrite
                    file.bytesWritten = Math.max(file.bytesWritten || 0, bytesWritten);
                    const previousStatus = file.status;

                    file.status = getFileStatus(file);

                    await this.saveMeta(file);

                    // Call onComplete hook when file status becomes "completed"
                    // Note: onComplete in storage layer doesn't have request/response context
                    // It's only called from handlers with full context
                    if (file.status === "completed" && previousStatus !== "completed") {
                        try {
                            await this.runSecurityChecks(file, path);
                        } catch (error) {
                            await remove(path);
                            await this.deleteMeta(file.id);
                            throw error;
                        }

                        // Storage-level onComplete is a no-op since it doesn't have response context
                        // The actual onComplete is called from handlers with response object
                    }
                } else {
                    await ensureFile(path);
                    file.bytesWritten = 0;
                }

                return file;
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : String(error);

                return throwErrorCode(ERRORS.FILE_ERROR, message);
            } finally {
                await this.unlock(path);
            }
        });
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
    public async get({ id }: FileQuery): Promise<FileReturn> {
        return this.instrumentOperation("get", async () => {
            const file = await this.checkIfExpired(await this.meta.get(id));
            const { bytesWritten, contentType, expiredAt, metadata, modifiedAt, name, originalName, size } = file;

            let content: Buffer;

            try {
                content = (await readFile(this.getFilePath(name), { buffer: true })) as Buffer;
            } catch (error: unknown) {
                const errorWithCode = error as { code?: string; message?: string };

                if (errorWithCode.code === "ENOENT" || errorWithCode.code === "EPERM") {
                    const message = error instanceof Error ? error.message : errorWithCode.message || String(error);

                    return throwErrorCode(ERRORS.FILE_NOT_FOUND, message);
                }

                throw error;
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
                        ...(modifiedAt && { "Last-Modified": modifiedAt.toString() }),
                        // Note: ETag requires reading the file content, so we don't include it for streaming
                        // Clients can use HEAD requests to get ETag if needed
                    },
                    size: size || bytesWritten,
                    stream,
                };
            } catch (error: unknown) {
                // Convert any filesystem error when reading metadata to FILE_NOT_FOUND
                const message = error instanceof Error ? error.message : String(error);

                throw throwErrorCode(ERRORS.FILE_NOT_FOUND, message);
            }
        });
    }

    /**
     * Deletes an upload and its metadata.
     * @param query File query containing the file ID to delete.
     * @param query.id File ID to delete.
     * @returns Promise resolving to the deleted file object with status: "deleted".
     * @throws {UploadError} If the file metadata cannot be found.
     */
    public async delete({ id }: FileQuery): Promise<TFile> {
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
    public async copy(name: string, destination: string): Promise<TFile> {
        return this.instrumentOperation("copy", async () => {
            const sourceFile = await this.getMeta(name);

            await copyFile(this.getFilePath(sourceFile.name), this.getFilePath(destination));

            // Return source file metadata with destination name
            return { ...sourceFile, name: destination } as TFile;
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
            // Get source metadata first to get the actual file name
            const sourceFile = await this.getMeta(name);
            const source = this.getFilePath(sourceFile.name);
            const destinationPath = this.getFilePath(destination);

            try {
                await move(source, destinationPath);
            } catch (error: unknown) {
                const errorWithCode = error as { code?: string };

                if (errorWithCode?.code === "EXDEV") {
                    await copyFile(source, destinationPath);
                    await remove(source);
                } else {
                    throw error;
                }
            }

            // Return moved file with destination name and correct ID
            return { ...sourceFile, id: sourceFile.id, name: destination } as TFile;
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

            for await (const founding of walk(directory, config)) {
                const { suffix } = this.meta;
                const { path } = founding;

                if (!path.includes(suffix)) {
                    const { birthtime, ctime, mtime } = await stat(path);

                    uploads.push({ createdAt: birthtime || ctime, id: path.replace(directory, ""), modifiedAt: mtime } as TFile);
                }
            }

            return uploads;
        });
    }

    /**
     * Returns path for the uploaded file
     * If filename is already an absolute path, returns it as-is.
     * Otherwise, joins it with the storage directory.
     */
    protected getFilePath(filename: string): string {
        if (isAbsolute(filename)) {
            return filename;
        }

        return join(this.directory, filename);
    }

    protected lazyWrite(part: File & FilePart): Promise<[number, ERRORS?]> {
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

            lengthChecker.on("error", () => failWithCode(ERRORS.FILE_CONFLICT));
            checksumChecker.on("error", () => failWithCode(ERRORS.CHECKSUM_MISMATCH));

            part.body.on("aborted", () => failWithCode(keepPartial ? undefined : ERRORS.REQUEST_ABORTED));
            part.body.on("error", (error) => {
                cleanupStreams();
                reject(error);
            });

            // Check if signal is already aborted before starting pipeline
            if (signal?.aborted) {
                return failWithCode(keepPartial ? undefined : ERRORS.REQUEST_ABORTED);
            }

            // Handle AbortController signal manually
            // Note: We handle signal manually instead of using pipeline options for better compatibility
            if (signal) {
                signal.addEventListener("abort", () => {
                    cleanupStreams();
                    destination.destroy();
                    lengthChecker.destroy();
                    checksumChecker.destroy();
                    part.body.destroy();
                    resolve([Number.NaN, keepPartial ? undefined : ERRORS.REQUEST_ABORTED]);
                });
            }

            pipeline(part.body, lengthChecker, checksumChecker, destination, (error) => {
                if (error) {
                    cleanupStreams();

                    // Check if error is due to abort signal
                    if (signal && signal.aborted) {
                        return resolve([Number.NaN, keepPartial ? undefined : ERRORS.REQUEST_ABORTED]);
                    }

                    // Convert other pipeline errors to error codes
                    return resolve([Number.NaN, ERRORS.FILE_ERROR]);
                }

                return resolve([part.start + destination.bytesWritten]);
            });
        });
    }

    private async accessCheck(): Promise<void> {
        await ensureDir(this.directory);
    }
}

export default DiskStorage;
