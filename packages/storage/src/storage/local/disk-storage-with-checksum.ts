import { createWriteStream } from "node:fs";
import { truncate } from "node:fs/promises";
import { pipeline } from "node:stream";

// eslint-disable-next-line import/no-extraneous-dependencies
import { ensureFile, remove } from "@visulima/fs";

import { detectFileTypeFromStream } from "../../utils/detect-file-type";
import { ERRORS, throwErrorCode } from "../../utils/errors";
import { streamChecksum } from "../../utils/pipes/stream-checksum";
import StreamLength from "../../utils/pipes/stream-length";
import RangeHasher from "../../utils/range-hasher";
import type { DiskStorageWithChecksumOptions } from "../types";
import type { File, FilePart, FileQuery } from "../utils/file";
import { getFileStatus, hasContent, partMatch, updateSize } from "../utils/file";
import DiskStorage from "./disk-storage";

/**
 *  Additionally calculates checksum of the file/range
 */
class DiskStorageWithChecksum<TFile extends File = File> extends DiskStorage<TFile> {
    private hashes: RangeHasher;

    public constructor(config: DiskStorageWithChecksumOptions<TFile>) {
        super(config);

        this.hashes = new RangeHasher(config?.checksum === "sha1" ? "sha1" : "md5");
    }

    public override async delete({ id }: FileQuery): Promise<TFile> {
        try {
            const file = await this.getMeta(id);
            const path = this.getFilePath(file.name);

            this.hashes.delete(path);

            await remove(path);
            await this.deleteMeta(id);

            const deletedFile = { ...file, status: "deleted" } as TFile;

            await this.onDelete(deletedFile);

            return deletedFile;
        } catch (error) {
            this.logger?.error("[error]: Could not delete file: %O", error);

            const httpError = this.normalizeError(error instanceof Error ? error : new Error(String(error)));

            await this.onError(httpError);
        }

        return { id } as TFile;
    }

    public override async write(part: FilePart | FileQuery): Promise<TFile> {
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

        try {
            const startPosition = (part as FilePart).start || 0;

            await ensureFile(path);

            // Only reset bytesWritten to startPosition if it's the first write (bytesWritten is 0 or NaN)
            // This matches the behavior in disk-storage.ts
            if (file.bytesWritten === 0 || Number.isNaN(file.bytesWritten)) {
                file.bytesWritten = startPosition;
            }

            await this.hashes.init(path);

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
                        part.body = detectedStream;
                    } catch {
                        // If file type detection fails, continue with original stream
                        // This is not a critical error
                    }
                }

                const [bytesWritten, errorCode] = await this.lazyWrite({ ...part, ...file });

                if (errorCode) {
                    await truncate(path, file.bytesWritten);

                    return throwErrorCode(errorCode);
                }

                if (typeof bytesWritten !== "number") {
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
        } catch (error: unknown) {
            await this.hashes.updateFromFs(path, file.bytesWritten);
            const httpError = this.normalizeError(error instanceof Error ? error : new Error(String(error)));

            await this.onError(httpError);
            return throwErrorCode(ERRORS.FILE_ERROR, httpError.message);
        }
    }

    protected override lazyWrite(part: File & FilePart): Promise<[number, ERRORS?]> {
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
