import { PassThrough } from "node:stream";

class FileWriteStream extends PassThrough {
    public get bytesWritten(): number {
        // @ts-ignore
        return super.readableLength;
    }

    // eslint-disable-next-line class-methods-use-this
    public close(): void {}
}

export default FileWriteStream;
