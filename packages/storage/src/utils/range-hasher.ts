import type { Hash } from "node:crypto";
import { createReadStream } from "node:fs";

import { LRUCache as Cache } from "lru-cache";

import RangeChecksum from "./range-checksum";
import type { RangeChecksum as IRangeChecksum, RangeHasher as IRangeHasher } from "./types";

/** LRU-backed cache for incremental file hashing utilities. */
class RangeHasher extends Cache<string, Hash, number> {
    public constructor(
        public algorithm: "md5" | "sha1" = "sha1",
        options?: Cache.Options<string, Hash, number>,
    ) {
        super({
            ttl: 1000,
            ttlAutopurge: true,
            ...options,
        });
    }

    /** Return hex digest for a previously initialized path. */
    public hex(path: string): string {
        return this.get(path)?.copy().digest("hex") || "";
    }

    /** Return base64 digest for a previously initialized path. */
    public base64(path: string): string {
        return this.get(path)?.copy().digest("base64") || "";
    }

    /**
     * Initialize or continue a hasher for a file from an offset.
     */
    public async init(path: string, start = 0): Promise<Hash> {
        return this.get(path)?.copy() || this.updateFromFs(path, start);
    }

    /** Create a Transform that updates the rolling hash for a path. */
    public digester(path: string): IRangeChecksum {
        return new RangeChecksum(this as IRangeHasher, path);
    }

    public async updateFromFs(path: string, start = 0, initial?: Hash): Promise<Hash> {
        const hash = await this.fromFs(path, start, initial);

        this.set(path, hash);

        return hash;
    }

    private fromFs(path: string, start = 0, initial?: Hash): Promise<Hash> {
        return new Promise((resolve, reject) => {
            const digester = this.digester(path);

            if (initial !== undefined) {
                digester.hash = initial;
            }

            createReadStream(path, { start })
                .on("error", reject)
                .on("end", () => resolve(digester.hash))
                .pipe(digester)
                .resume();
        });
    }
}

export default RangeHasher;
