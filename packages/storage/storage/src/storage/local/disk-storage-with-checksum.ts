import type { ERRORS } from "../../utils/errors";
import RangeHasher from "../../utils/range-hasher";
import type { DiskStorageWithChecksumOptions } from "../types";
import type { File, FilePart, FileQuery } from "../utils/file";
import DiskStorage from "./disk-storage";

/**
 * Additionally calculates checksum of the file/range.
 */
class DiskStorageWithChecksum<TFile extends File = File> extends DiskStorage<TFile> {
    private hashes: RangeHasher;

    public constructor(config: DiskStorageWithChecksumOptions<TFile>) {
        super(config);

        this.hashes = new RangeHasher(config?.checksum === "sha1" ? "sha1" : "md5");
    }

    public override async delete(query: FileQuery): Promise<TFile> {
        const deleted = await super.delete(query);

        this.hashes.delete(this.getFilePath(deleted.name));

        return deleted;
    }

    /**
     * Records the hash of the bytes stored so far with every save of an upload's metadata.
     */
    public override async saveMeta(file: TFile): Promise<TFile> {
        const path = this.getFilePath(file.name);

        if (file.bytesWritten > 0) {
            // Rebuilt from disk when no write left it cached (e.g. after an aborted write).
            await this.hashes.init(path);

            file.hash = { algorithm: this.hashes.algorithm, value: this.hashes.hex(path) };
        } else {
            // A fresh upload, possibly replacing an earlier one under the same name.
            this.hashes.delete(path);
        }

        if (file.status === "completed") {
            this.hashes.delete(path);
        }

        return super.saveMeta(file);
    }

    protected override async lazyWrite(part: File & FilePart): Promise<[number, ERRORS?]> {
        const path = this.getFilePath(part.name);

        await this.hashes.init(path);

        const digester = this.hashes.digester(path);
        const result = await super.lazyWrite(part, [digester]).catch((error: unknown) => {
            this.hashes.delete(path);

            throw error;
        });

        if (result[1] !== undefined || Number.isNaN(result[0])) {
            // The digester saw bytes that were truncated or only partly stored: rebuild from disk next time.
            this.hashes.delete(path);
        } else {
            this.hashes.set(path, digester.hash);
        }

        return result;
    }
}

export default DiskStorageWithChecksum;
