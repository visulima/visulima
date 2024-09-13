import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream";

import { ensureFile, ERRORS, RangeHasher, removeFile, streamChecksum, StreamLength, throwErrorCode } from "../../utils";
import { fsp } from "../../utils/fs";
import type { DiskStorageWithChecksumOptions } from "../types.d";
import type { File,FilePart, FileQuery } from "../utils/file";
import { getFileStatus, hasContent, partMatch, updateSize } from "../utils/file";
import DiskStorage from "./disk-storage";

/**
 *  Additionally calculates checksum of the file/range
 */
class DiskStorageWithChecksum<TFile extends File = File> extends DiskStorage<TFile> {
    private hashes: RangeHasher;

    constructor(config: DiskStorageWithChecksumOptions<TFile>) {
        super(config);

        this.hashes = new RangeHasher(config?.checksum === "sha1" ? "sha1" : "md5");
    }

    public async delete({ id }: FileQuery): Promise<TFile> {
        try {
            const file = await this.getMeta(id);
            const path = this.getFilePath(file.name);

            this.hashes.delete(path);

            await removeFile(path);
            await this.deleteMeta(id);

            return { ...file, status: "deleted" };

        } catch (error) {
            this.logger?.error("[error]: Could not delete file: %O", error);
        }

        return { id } as TFile;
    }

    async write(part: FilePart | FileQuery): Promise<TFile> {
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

        try {
            file.bytesWritten = (part as FilePart).start || (await ensureFile(path));

            await this.hashes.init(path);

            if (hasContent(part)) {
                if (this.isUnsupportedChecksum(part.checksumAlgorithm)) {
                    return throwErrorCode(ERRORS.UNSUPPORTED_CHECKSUM_ALGORITHM);
                }

                const [bytesWritten, errorCode] = await this.lazyWrite({ ...part, ...file });

                if (errorCode) {
                    await fsp.truncate(path, file.bytesWritten);

                    return throwErrorCode(errorCode);
                }

                if (!bytesWritten) {
                    await this.hashes.updateFromFs(path, file.bytesWritten);
                }

                file.bytesWritten = bytesWritten;
            }

            file.status = getFileStatus(file);
            file.hash = {
                algorithm: this.hashes.algorithm,
                value: this.hashes.hex(path),
            };

            if (file.status === "completed") {
                this.hashes.delete(path);
            }

            await this.saveMeta(file);

            return file;
        } catch (error: any) {
            await this.hashes.updateFromFs(path, file.bytesWritten);

            return throwErrorCode(ERRORS.FILE_ERROR, error.message);
        }
    }

    protected lazyWrite(part: File & FilePart): Promise<[number, ERRORS?]> {
        // eslint-disable-next-line compat/compat
        return new Promise((resolve, reject) => {
            const path = this.getFilePath(part.name);
            const destination = createWriteStream(path, { flags: "r+", start: part.start });
            const lengthChecker = new StreamLength(part.contentLength || Number(part.size) - part.start);
            const checksumChecker = streamChecksum(part.checksum as string, part.checksumAlgorithm as string);
            const digester = this.hashes.digester(path);
            const keepPartial = !part.checksum;
            const failWithCode = (code?: ERRORS): void => {
                digester.reset();
                destination.close();

                resolve([Number.NaN, code]);
            };

            lengthChecker.on("error", () => failWithCode(ERRORS.FILE_CONFLICT));
            checksumChecker.on("error", () => failWithCode(ERRORS.CHECKSUM_MISMATCH));

            part.body.on("aborted", () => failWithCode(keepPartial ? undefined : ERRORS.REQUEST_ABORTED));

            pipeline(part.body, lengthChecker, checksumChecker, digester, destination, (error) => {
                if (error) {
                    digester.reset();

                    return reject(error);
                }

                return resolve([part.start + destination.bytesWritten]);
            });
        });
    }
}

export default DiskStorageWithChecksum;
