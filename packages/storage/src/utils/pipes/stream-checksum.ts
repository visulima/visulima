import type { BinaryToTextEncoding, Hash } from "node:crypto";
import { createHash } from "node:crypto";
import { PassThrough, Transform } from "node:stream";

/**
 * Transform stream that validates checksums as data passes through.
 * Calculates hash of streaming data and validates against expected checksum.
 */
export class StreamChecksum extends Transform {
    public length = 0;

    private digest = "";

    private hash: Hash;

    /**
     * Gets the calculated digest value after the stream has finished processing.
     * @returns The digest value in the configured encoding, or empty string if not yet calculated
     */
    public get calculatedDigest(): string {
        return this.digest;
    }

    /**
     * Creates a new StreamChecksum transform stream.
     * @param checksum Expected checksum value to validate against
     * @param algorithm Hash algorithm to use (e.g., 'md5', 'sha256')
     * @param encoding Encoding for the checksum comparison (defaults to 'base64')
     */
    public constructor(
        public readonly checksum: string,
        public readonly algorithm: string,
        private readonly encoding: BinaryToTextEncoding = "base64",
    ) {
        super();
        this.hash = createHash(algorithm);
    }

    /**
     * Transform method that updates the hash with incoming data.
     * @param chunk Buffer chunk to process
     * @param _encoding Unused encoding parameter
     * @param done Callback to signal completion
     */
    // eslint-disable-next-line no-underscore-dangle
    public override _transform(chunk: Buffer, _encoding: string, done: () => void): void {
        this.push(chunk);
        this.hash.update(chunk);
        this.length += chunk.length;

        done();
    }

    /**
     * Finalization method that validates the checksum.
     * @param callback Callback called with error if checksum validation fails
     */
    // eslint-disable-next-line no-underscore-dangle
    public override _flush(callback: (error?: Error) => void): void {
        this.digest = this.hash.digest(this.encoding);

        if (this.checksum && this.checksum !== this.digest) {
            callback(new Error("Checksum mismatch"));
        } else {
            callback();
        }
    }
}

/**
 * Factory function that returns either a StreamChecksum transform or a PassThrough stream.
 * Returns PassThrough when no algorithm is provided.
 * @param checksum Expected checksum value
 * @param algorithm Hash algorithm (if empty, returns PassThrough)
 * @param encoding Encoding for checksum comparison
 * @returns StreamChecksum instance or PassThrough stream
 */
export const streamChecksum = (checksum: string, algorithm: string, encoding: BinaryToTextEncoding = "base64"): PassThrough | StreamChecksum => {
    return algorithm ? new StreamChecksum(checksum, algorithm, encoding) : new PassThrough();
};
