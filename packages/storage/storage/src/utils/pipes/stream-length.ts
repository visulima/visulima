import { Transform } from "node:stream";

const STREAM_LENGTH_LIMIT = "ERR_STREAM_LENGTH_LIMIT";

/**
 * Whether an error is StreamLength's own "body is longer than the limit" error.
 * @param error Stream error
 * @returns `true` for the limit error
 */
export const isStreamLengthError = (error: unknown): boolean => (error as { code?: string } | null)?.code === STREAM_LENGTH_LIMIT;

/**
 * Transform stream that tracks byte length and enforces size limits.
 * Counts total bytes passing through and optionally enforces a maximum limit.
 */
class StreamLength extends Transform {
    public length = 0;

    /**
     * Creates a new StreamLength transform stream.
     * @param limit Maximum number of bytes allowed (defaults to infinity)
     */
    public constructor(public readonly limit: number = Number.POSITIVE_INFINITY) {
        super();
    }

    /**
     * Transform method that counts bytes and enforces size limits.
     * @param chunk Buffer chunk to process
     * @param _encoding Unused encoding parameter
     * @param callback Callback called with error if limit exceeded
     */

    public override _transform(chunk: Buffer, _encoding: string, callback: (error?: Error) => void): void {
        const expected = this.length + chunk.length;

        if (this.limit >= expected) {
            this.push(chunk);
            this.length = expected;

            callback();
        } else {
            callback(Object.assign(new Error("Stream length limit exceeded"), { code: STREAM_LENGTH_LIMIT }));
        }
    }
}

export default StreamLength;
