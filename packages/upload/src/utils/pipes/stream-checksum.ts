import type { BinaryToTextEncoding , Hash } from "node:crypto";
import { createHash } from "node:crypto";
import { PassThrough, Transform } from "node:stream";

export class StreamChecksum extends Transform {
    public length = 0;

    private digest = "";

    private hash: Hash;

    constructor(
        public readonly checksum: string,
        public readonly algorithm: string,
        private readonly encoding: BinaryToTextEncoding = "base64",
    ) {
        super();
        this.hash = createHash(algorithm);
    }

    // eslint-disable-next-line no-underscore-dangle
    _transform(chunk: Buffer, _encoding: string, done: () => void): void {
        this.push(chunk);
        this.hash.update(chunk);
        this.length += chunk.length;

        done();
    }

    // eslint-disable-next-line no-underscore-dangle
    _flush(callback: (error?: Error) => void): void {
        this.digest = this.hash.digest(this.encoding);

        if (this.checksum && this.checksum !== this.digest) {
            callback(new Error("Checksum mismatch"));
        } else {
            callback();
        }
    }
}

export function streamChecksum(checksum: string, algorithm: string, encoding: BinaryToTextEncoding = "base64"): PassThrough | StreamChecksum {
    return algorithm ? new StreamChecksum(checksum, algorithm, encoding) : new PassThrough();
}
