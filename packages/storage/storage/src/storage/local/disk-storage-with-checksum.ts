import { stat } from "node:fs/promises";

import type { ERRORS } from "../../utils/errors";
import RangeHasher from "../../utils/range-hasher";
import type { ConditionalOptions, DiskStorageWithChecksumOptions, OperationOptions } from "../types";
import type { File, FilePart, FileQuery } from "../utils/file";
import DiskStorage from "./disk-storage";

/**
 * Additionally calculates checksum of the file/range. `checksum: false` turns that off, leaving a
 * plain {@link DiskStorage}.
 */
class DiskStorageWithChecksum<TFile extends File = File> extends DiskStorage<TFile> {
    private readonly hashes?: RangeHasher;

    public constructor(config: DiskStorageWithChecksumOptions<TFile>) {
        super(config);

        if (config?.checksum !== false) {
            this.hashes = new RangeHasher(config?.checksum === "sha1" ? "sha1" : "md5");
        }
    }

    public override async delete(query: FileQuery, options?: ConditionalOptions & OperationOptions): Promise<TFile> {
        const deleted = await super.delete(query, options);

        this.hashes?.delete(this.getFilePath(deleted.name));

        return deleted;
    }

    /**
     * Records the hash of the bytes stored so far with every save of an upload's metadata.
     */
    public override async saveMeta(file: TFile): Promise<TFile> {
        const { hashes } = this;

        if (hashes === undefined) {
            return super.saveMeta(file);
        }

        const path = this.getFilePath(file.name);

        if (file.bytesWritten > 0) {
            // Rebuilt from disk when no write left it cached (e.g. after an aborted write).
            await hashes.init(path);

            file.hash = { algorithm: hashes.algorithm, value: hashes.hex(path) };
        } else {
            // A fresh upload, possibly replacing an earlier one under the same name.
            hashes.delete(path);
        }

        if (file.status === "completed") {
            hashes.delete(path);
        }

        return super.saveMeta(file);
    }

    protected override async lazyWrite(part: File & FilePart): Promise<[number, ERRORS?]> {
        const { hashes } = this;

        if (hashes === undefined) {
            return super.lazyWrite(part);
        }

        const path = this.getFilePath(part.name);

        // The running hash covers the file from its first byte, so only a write appending at its end
        // can extend it. Any other one (an out-of-order or re-sent chunk) is hashed from disk on the next save.
        const { size } = await stat(path);

        if (part.start !== size) {
            hashes.delete(path);

            return super.lazyWrite(part);
        }

        await hashes.init(path);

        const digester = hashes.digester(path);
        let digested = 0;

        digester.on("data", (chunk: Buffer) => {
            digested += chunk.length;
        });

        const result = await super.lazyWrite(part, [digester]).catch((error: unknown) => {
            hashes.delete(path);

            throw error;
        });

        if (result[1] !== undefined || result[0] !== part.start + digested) {
            // The digester saw bytes that were truncated or only partly stored: rebuild from disk next time.
            hashes.delete(path);
        } else {
            hashes.set(path, digester.hash);
        }

        return result;
    }
}

export default DiskStorageWithChecksum;
