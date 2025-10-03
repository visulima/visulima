import { PassThrough } from "node:stream";

import type FileWriteStream from "./file-write-stream";

/* eslint-disable no-underscore-dangle */
class RequestReadStream extends PassThrough {
    __delay = 100;

    __mockdata = "12345";

    __mockSend(data?: any): void {
        setTimeout(() => {
            this.emit("data", data ?? this.__mockdata);
            this.emit("end");
        }, this.__delay);
    }

    __mockAbort(data?: any): void {
        setTimeout(() => {
            this.emit("data", data ?? this.__mockdata);
            this.emit("aborted");
            this.emit("end");
        }, this.__delay);
    }

    __mockPipeError(destination: FileWriteStream, data?: any): void {
        setTimeout(() => {
            this.emit("data", data ?? this.__mockdata);
            destination.emit("error", new Error("Broken pipe"));
        }, this.__delay);
    }
}
/* eslint-enable no-underscore-dangle */
export default RequestReadStream;
