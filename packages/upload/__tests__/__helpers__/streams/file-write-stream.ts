import { PassThrough } from "node:stream";

class FileWriteStream extends PassThrough {
    get bytesWritten(): number {
        // @ts-ignore
        return super.readableLength;
    }

    // eslint-disable-next-line class-methods-use-this
    close(): void {}
}

export default FileWriteStream;
