import type { BinaryToTextEncoding, Hash } from "node:crypto";
import { createHash } from "node:crypto";
import { Transform } from "node:stream";

import type { RangeChecksum as IRangeChecksum, RangeHasher as IRangeHasher } from "./types";

class RangeChecksum extends Transform implements IRangeChecksum {
    public hash: Hash;

    private readonly hashCopy: Hash;

    private hashes: IRangeHasher;

    public constructor(
        hashes: IRangeHasher,
        public readonly path: string,
    ) {
        super();

        this.hashes = hashes;
        this.hash = this.hashes.get(path) || createHash(this.hashes.algorithm);
        this.hashCopy = this.hash.copy();
    }

    public reset(): void {
        this.hashes.set(this.path, this.hashCopy);
    }

    public digest(encoding: BinaryToTextEncoding = "hex"): string {
        return this.hash.copy().digest(encoding);
    }

    // eslint-disable-next-line no-underscore-dangle
    public override _transform(chunk: Buffer, _encoding: string, done: () => void): void {
        this.push(chunk);
        this.hash.update(chunk);

        done();
    }

    // eslint-disable-next-line class-methods-use-this,no-underscore-dangle
    public override _flush(callback: (error?: Error) => void): void {
        callback();
    }
}

export default RangeChecksum;
