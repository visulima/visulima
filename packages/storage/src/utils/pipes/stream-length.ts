import { Transform } from "node:stream";

/**
 * Transform that tracks the number of bytes passing through and enforces an
 * optional upper limit. Emits an error if the limit is exceeded.
 */

class StreamLength extends Transform {
    public length = 0;

    public constructor(public readonly limit: number = Number.POSITIVE_INFINITY) {
        super();
    }

    // eslint-disable-next-line no-underscore-dangle
    public override _transform(chunk: Buffer, _encoding: string, callback: (error?: Error) => void): void {
        const expected = this.length + chunk.length;

        if (this.limit >= expected) {
            this.push(chunk);
            this.length = expected;

            callback();
        } else {
            callback(new Error("Stream length limit exceeded"));
        }
    }
}

export default StreamLength;
