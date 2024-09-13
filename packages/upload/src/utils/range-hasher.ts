import type { Hash } from "node:crypto";
import { createReadStream } from "node:fs";

import { LRUCache as Cache } from "lru-cache";

import RangeChecksum from "./range-checksum";
import type { RangeChecksum as IRangeChecksum } from "./types.d";

class RangeHasher extends Cache<string, Hash> {
    public constructor(
        public algorithm: "md5" | "sha1" = "sha1",
        options?: Cache.Options<string, Hash>,
    ) {
        super({
            ttl: 1000,
            ...options,
        });
    }

    hex(path: string): string {
        return this.get(path)?.copy().digest("hex") || "";
    }

    base64(path: string): string {
        return this.get(path)?.copy().digest("base64") || "";
    }

    async init(path: string, start = 0): Promise<Hash> {
        return this.get(path)?.copy() || this.updateFromFs(path, start);
    }

    digester(path: string): IRangeChecksum {
        return new RangeChecksum(this, path);
    }

    // eslint-disable-next-line default-param-last
    public async updateFromFs(path: string, start = 0, initial?: Hash): Promise<Hash> {
        const hash = await this.fromFs(path, start, initial);

        this.set(path, hash);

        return hash;
    }

    // eslint-disable-next-line default-param-last
    private fromFs(path: string, start = 0, initial?: Hash): Promise<Hash> {
        // eslint-disable-next-line compat/compat
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
