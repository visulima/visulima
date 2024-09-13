import { createWriteStream } from "node:fs";
import type { IncomingMessage } from "node:http";
import { join } from "node:path";
import { pipeline } from "node:stream";

import { walk } from "@visulima/readdir";
import etag from "etag";

import type { HttpError } from "../../utils";
import { ensureFile, ERRORS, fsp, removeFile, streamChecksum, StreamLength, throwErrorCode } from "../../utils";
import type MetaStorage from "../meta-storage";
import BaseStorage from "../storage";
import type { DiskStorageOptions } from "../types.d";
import type { FileInit, FilePart, FileQuery } from "../utils/file";
import { File, getFileStatus, hasContent, partMatch, updateSize } from "../utils/file";
import type { FileReturn } from "../utils/file/types";
import LocalMetaStorage from "./local-meta-storage";

/**
 * Local Disk Storage
 */
class DiskStorage<TFile extends File = File> extends BaseStorage<TFile, FileReturn> {
    checksumTypes = ["md5", "sha1"];

    directory: string;

    meta: MetaStorage<TFile>;

    constructor(public config: DiskStorageOptions<TFile>) {
        super(config);

        this.directory = config.directory;

        if (config.metaStorage) {
            this.meta = config.metaStorage;
        } else {
            const metaConfig = { ...config, ...config.metaStorageConfig, logger: this.logger };

            this.meta = new LocalMetaStorage(metaConfig);
        }

        this.accessCheck().catch((error) => {
            this.isReady = false;
            this.logger?.error("[error]: Could not write to directory: %O", error);
        });
    }

    public normalizeError(error: Error): HttpError {
        return super.normalizeError(error);
    }

    public async create(request: IncomingMessage, fileInit: FileInit): Promise<TFile> {
        const file = new File(fileInit);

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
            file.bytesWritten = await ensureFile(path);
        } catch (error: any) {
            throwErrorCode(ERRORS.FILE_ERROR, error.message);
        }

        file.status = getFileStatus(file);

        await this.saveMeta(file as TFile);

        return file as TFile;
    }

    public async write(part: FilePart | FileQuery): Promise<TFile> {
        const file = await this.getMeta(part.id);

        await this.checkIfExpired(file);

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
            file.bytesWritten = (part as FilePart).start || (await ensureFile(path));

            if (hasContent(part)) {
                if (this.isUnsupportedChecksum(part.checksumAlgorithm)) {
                    return throwErrorCode(ERRORS.UNSUPPORTED_CHECKSUM_ALGORITHM);
                }

                const [bytesWritten, errorCode] = await this.lazyWrite({ ...part, ...file });

                if (errorCode) {
                    await fsp.truncate(path, file.bytesWritten);

                    return throwErrorCode(errorCode);
                }

                file.bytesWritten = bytesWritten;
                file.status = getFileStatus(file);

                await this.saveMeta(file);
            } else {
                file.bytesWritten = await ensureFile(path);
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
     *
     * @param {FileQuery} id
     */
    public async get({ id }: FileQuery): Promise<FileReturn> {
        const file = await this.checkIfExpired(await this.meta.get(id));
        const { bytesWritten, contentType, expiredAt, metadata, modifiedAt, name, originalName, size } = file;
        const content = await fsp.readFile(this.getFilePath(name));

        return {
            ETag: etag(content),
            content,
            contentType,
            expiredAt,
            id,
            metadata,
            modifiedAt,
            name,
            originalName,
            size: size || bytesWritten,
        };
    }

    public async delete({ id }: FileQuery): Promise<TFile> {
        try {
            const file = await this.getMeta(id);

            await removeFile(this.getFilePath(file.name));
            await this.deleteMeta(id);

            return { ...file, status: "deleted" };
        } catch (error) {
            this.logger?.error("[error]: Could not delete file: %O", error);
        }

        return { id } as TFile;
    }

    public async copy(name: string, destination: string): Promise<void> {
        await fsp.copyFile(this.getFilePath(name), destination);
    }

    public async move(name: string, destination: string): Promise<void> {
        const source = this.getFilePath(name);

        try {
            await fsp.rename(source, destination);
        } catch (error: any) {
            if (error?.code === "EXDEV") {
                await this.copy(source, destination);
                await fsp.unlink(source);
            }
        }
    }

    public async list(): Promise<TFile[]> {
        const config = {
            followSymlinks: false,
            includeDirs: false,
            includeFiles: true,
        };
        const uploads: TFile[] = [];

        const { directory } = this;

        // eslint-disable-next-line no-restricted-syntax
        for await (const founding of walk(directory, config)) {

            const { suffix } = this.meta;
            const { path } = founding;

            if (!path.includes(suffix)) {
                const { birthtime, ctime, mtime } = await fsp.stat(path);

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
        // eslint-disable-next-line compat/compat
        return new Promise((resolve, reject) => {
            const destination = createWriteStream(this.getFilePath(part.name), { flags: "r+", start: part.start });
            const lengthChecker = new StreamLength(part.contentLength || (part.size as number) - part.start);
            const checksumChecker = streamChecksum(part.checksum as string, part.checksumAlgorithm as string);
            const keepPartial = !part.checksum;
            const failWithCode = (code?: ERRORS): void => {
                destination.close();
                resolve([Number.NaN, code]);
            };

            lengthChecker.on("error", () => failWithCode(ERRORS.FILE_CONFLICT));
            checksumChecker.on("error", () => failWithCode(ERRORS.CHECKSUM_MISMATCH));

            part.body.on("aborted", () => failWithCode(keepPartial ? undefined : ERRORS.REQUEST_ABORTED));

            pipeline(part.body, lengthChecker, checksumChecker, destination, (error) => {
                if (error) {
                    return reject(error);
                }

                return resolve([part.start + destination.bytesWritten]);
            });
        });
    }

    private async accessCheck(): Promise<void> {
        await fsp.mkdir(this.directory, { recursive: true });
    }
}

export default DiskStorage;
