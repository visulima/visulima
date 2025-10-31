import { createReadStream, createWriteStream } from "node:fs";
import { copyFile, mkdir, rename, stat, truncate, unlink } from "node:fs/promises";
import type { IncomingMessage } from "node:http";
import type { Readable } from "node:stream";
import { pipeline } from "node:stream";

// eslint-disable-next-line import/no-extraneous-dependencies
import { ensureFile, readFile, remove, walk } from "@visulima/fs";
// eslint-disable-next-line import/no-extraneous-dependencies
import { join } from "@visulima/path";
// eslint-disable-next-line import/no-extraneous-dependencies
import etag from "etag";

import { ERRORS, throwErrorCode } from "../../utils/errors";
import { streamChecksum } from "../../utils/pipes/stream-checksum";
import StreamLength from "../../utils/pipes/stream-length";
import toMilliseconds from "../../utils/primitives/to-milliseconds";
import type { HttpError } from "../../utils/types";
import type MetaStorage from "../meta-storage";
import BaseStorage from "../storage";
import type { DiskStorageOptions } from "../types";
import type { FileInit, FilePart, FileQuery } from "../utils/file";
import { File, getFileStatus, hasContent, partMatch, updateSize } from "../utils/file";
import type { FileReturn } from "../utils/file/types";
import LocalMetaStorage from "./local-meta-storage";

/**
 * Local Disk Storage
 */
class DiskStorage<TFile extends File = File> extends BaseStorage<TFile, FileReturn> {
    public static override readonly name = "disk";

    public override checksumTypes = ["md5", "sha1"];

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

        this.isReady = false;
        this.accessCheck()
            .then(() => {
                this.isReady = true;
            })
            .catch((error) => {
                this.logger?.error("Storage access check failed: %O", error);
            });
    }

    public override normalizeError(error: Error): HttpError {
        return super.normalizeError(error);
    }

    public async create(request: IncomingMessage, fileInit: FileInit): Promise<TFile> {
        // Handle TTL option
        const processedConfig = { ...fileInit };

        if (fileInit.ttl) {
            const ttlMs = typeof fileInit.ttl === "string" ? toMilliseconds(fileInit.ttl) : fileInit.ttl;

            if (ttlMs !== null) {
                processedConfig.expiredAt = Date.now() + ttlMs;
            }
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

        file.name = this.namingFunction(file as TFile, request);
        file.size = Number.isNaN(file.size) ? this.maxUploadSize : file.size;

        await this.validate(file as TFile);

        const path = this.getFilePath(file.name);

        try {
            await ensureFile(path);
            file.bytesWritten = 0;
        } catch (error: any) {
            throwErrorCode(ERRORS.FILE_ERROR, error.message);
        }

        file.status = getFileStatus(file);

        await this.saveMeta(file as TFile);

        return file as TFile;
    }

    public async write(part: FilePart | FileQuery | TFile): Promise<TFile> {
        let file: TFile;

        if ("contentType" in part && "metadata" in part && !("body" in part) && !("start" in part)) {
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
            file.bytesWritten = startPosition;

            if (hasContent(part)) {
                if (this.isUnsupportedChecksum(part.checksumAlgorithm)) {
                    return throwErrorCode(ERRORS.UNSUPPORTED_CHECKSUM_ALGORITHM);
                }

                const [bytesWritten, errorCode] = await this.lazyWrite({ ...part, ...file });

                if (errorCode) {
                    await truncate(path, file.bytesWritten);

                    return throwErrorCode(errorCode);
                }

                file.bytesWritten = bytesWritten;
                file.status = getFileStatus(file);

                await this.saveMeta(file);
            } else {
                await ensureFile(path);
                file.bytesWritten = 0;
            }

            return file;
        } catch (error: any) {
            return throwErrorCode(ERRORS.FILE_ERROR, error.message);
        } finally {
            await this.unlock(path);
        }
    }

    /**
     * Get uploaded file.
     * @param id
     */
    public async get({ id }: FileQuery): Promise<FileReturn> {
        const file = await this.checkIfExpired(await this.meta.get(id));
        const { bytesWritten, contentType, expiredAt, metadata, modifiedAt, name, originalName, size } = file;

        let content: Buffer;

        try {
            content = (await readFile(this.getFilePath(name), { buffer: true })) as Buffer;
        } catch (error: any) {
            if (error.code === "ENOENT") {
                return throwErrorCode(ERRORS.FILE_NOT_FOUND, error.message);
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
    }

    public override async getStream({ id }: FileQuery): Promise<{ headers?: Record<string, string>; size?: number; stream: Readable }> {
        const file = await this.checkIfExpired(await this.meta.get(id));
        const { bytesWritten, contentType, expiredAt, modifiedAt, name, size } = file;

        try {
            // Create a readable stream directly from the file
            const stream = createReadStream(this.getFilePath(name));

            return {
                headers: {
                    "Content-Length": String(size || bytesWritten),
                    "Content-Type": contentType,
                    ...expiredAt && { "X-Upload-Expires": expiredAt.toString() },
                    ...modifiedAt && { "Last-Modified": modifiedAt.toString() },
                    // Note: ETag requires reading the file content, so we don't include it for streaming
                    // Clients can use HEAD requests to get ETag if needed
                },
                size: size || bytesWritten,
                stream,
            };
        } catch (error: any) {
            if (error.code === "ENOENT") {
                throw throwErrorCode(ERRORS.FILE_NOT_FOUND, error.message);
            }

            throw error;
        }
    }

    public async delete({ id }: FileQuery): Promise<TFile> {
        try {
            const file = await this.getMeta(id);

            await remove(this.getFilePath(file.name));
            await this.deleteMeta(id);

            return { ...file, status: "deleted" };
        } catch (error: any) {
            this.logger?.error("[error]: Could not delete file: %O", error);
        }

        return { id } as TFile;
    }

    public async copy(name: string, destination: string): Promise<void> {
        await copyFile(this.getFilePath(name), destination);
    }

    public async move(name: string, destination: string): Promise<void> {
        const source = this.getFilePath(name);

        try {
            await rename(source, destination);
        } catch (error: any) {
            if (error?.code === "EXDEV") {
                await this.copy(source, destination);
                await unlink(source);
            }
        }
    }

    public override async list(): Promise<TFile[]> {
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
    }

    /**
     * Returns path for the uploaded file
     */
    protected getFilePath(filename: string): string {
        return join(this.directory, filename);
    }

    protected lazyWrite(part: File & FilePart): Promise<[number, ERRORS?]> {
        return new Promise((resolve, reject) => {
            const destination = createWriteStream(this.getFilePath(part.name), { flags: "r+", start: part.start });
            const lengthChecker = new StreamLength(part.contentLength || (part.size as number) - part.start);
            const checksumChecker = streamChecksum(part.checksum as string, part.checksumAlgorithm as string);
            const keepPartial = !part.checksum;

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

            pipeline(part.body, lengthChecker, checksumChecker, destination, (error) => {
                if (error) {
                    cleanupStreams();

                    return reject(error);
                }

                return resolve([part.start + destination.bytesWritten]);
            });
        });
    }

    private async accessCheck(): Promise<void> {
        await mkdir(this.directory, { recursive: true });
    }
}

export default DiskStorage;
