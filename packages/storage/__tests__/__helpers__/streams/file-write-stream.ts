import { PassThrough } from "node:stream";

class FileWriteStream extends PassThrough {
    public get bytesWritten(): number {
        // @ts-ignore - PassThrough.readableLength is a valid property but not in type definitions
        return super.readableLength;
    }

    // eslint-disable-next-line class-methods-use-this
    public close(): void {}
}

export default FileWriteStream;
