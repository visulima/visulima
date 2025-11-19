import { PassThrough } from "node:stream";

import type FileWriteStream from "./file-write-stream";

/* eslint-disable no-underscore-dangle */
class RequestReadStream extends PassThrough {
    public __delay = 0; // Make synchronous for testing to avoid timeouts

    public __mockdata = "12345";

    public __mockSend(data?: Buffer | string): void {
        // Use the PassThrough write method instead of emitting events directly
        this.write(data ?? this.__mockdata);
        this.end();
    }

    public __mockAbort(data?: Buffer | string): void {
        // Use the PassThrough write method and emit abort
        this.write(data ?? this.__mockdata);
        this.emit("aborted");
        this.end();
    }

    public __mockPipeError(destination: FileWriteStream, data?: Buffer | string): void {
        // Use the PassThrough write method and emit error on destination
        this.write(data ?? this.__mockdata);
        destination.emit("error", new Error("Broken pipe"));
    }
}
/* eslint-enable no-underscore-dangle */
export default RequestReadStream;
