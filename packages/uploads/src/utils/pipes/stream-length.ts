import { Transform } from "node:stream";

class StreamLength extends Transform {
    public length: number = 0;

    constructor(readonly limit: number = Number.POSITIVE_INFINITY) {
        super();
    }

    // eslint-disable-next-line no-underscore-dangle
    _transform(chunk: Buffer, _encoding: string, callback: (error?: Error) => void): void {
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
