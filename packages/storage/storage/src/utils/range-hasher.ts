import type { Hash } from "node:crypto";
import { createReadStream } from "node:fs";

import { LRUCache as Cache } from "lru-cache";

import RangeChecksum from "./range-checksum";
import type { RangeChecksum as IRangeChecksum, RangeHasher as IRangeHasher } from "./types";

/**
 * LRU cache-based range hasher for incremental file integrity verification.
 * Manages multiple file hash calculations with automatic cleanup and persistence.
 */
class RangeHasher extends Cache<string, Hash, number> {
    /**
     * Creates a new RangeHasher instance.
     * @param algorithm Hash algorithm to use (default: 'sha1')
     * @param options LRU cache configuration options
     */
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

    /**
     * Returns the hex-encoded digest for a previously initialized path.
     * @param path File path identifier
     * @returns Hex-encoded hash digest, or empty string if not found
     */
    public hex(path: string): string {
        return this.get(path)?.copy().digest("hex") || "";
    }

    /**
     * Returns the base64-encoded digest for a previously initialized path.
     * @param path File path identifier
     * @returns Base64-encoded hash digest, or empty string if not found
     */
    public base64(path: string): string {
        return this.get(path)?.copy().digest("base64") || "";
    }

    /**
     * Initializes or continues a hasher for a file from the specified offset.
     * Returns cached hash if available, otherwise calculates from filesystem.
     * @param path File path to hash
     * @param start Starting offset in bytes (default: 0)
     * @returns Promise resolving to the hash instance
     */
    public async init(path: string, start = 0): Promise<Hash> {
        return this.get(path)?.copy() || this.updateFromFs(path, start);
    }

    /**
     * Creates a transform stream that updates the rolling hash for a file path.
     * Useful for incremental hashing during streaming operations.
     * @param path File path identifier for hash tracking
     * @returns RangeChecksum transform stream instance
     */
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
