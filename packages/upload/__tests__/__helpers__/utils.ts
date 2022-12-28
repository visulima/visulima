import { BinaryLike, BinaryToTextEncoding, createHash } from "node:crypto";
import { IncomingMessage } from "node:http";
import { Socket } from "node:net";
// eslint-disable-next-line import/no-extraneous-dependencies
import rimraf from "rimraf";

export function cleanup(directory: string): Promise<any> {
    // eslint-disable-next-line compat/compat
    return new Promise((resolve) => {
        rimraf(directory, resolve);
    });
}

// eslint-disable-next-line max-len
export const hash = (buf: BinaryLike, algorithm = "sha1", encoding: BinaryToTextEncoding = "base64"): string => createHash(algorithm).update(buf).digest(encoding);

export function deepClone<T>(object: T): T {
    return JSON.parse(JSON.stringify(object)) as T;
}

export function createRequest(options: { body: string; encoding?: BufferEncoding }): IncomingMessage {
    const { body, encoding = "utf8" } = options;

    const request = new IncomingMessage(new Socket());

    request.headers = {
        "content-length": String(Buffer.byteLength(body, encoding)),
        "content-type": `text/${encoding}; charset=${encoding}`,
    };

    const chunks = [...body];

    chunks.forEach((chunk) => {
        process.nextTick(() => request.emit("data", chunk));
    });

    process.nextTick(() => request.emit("end"));

    return request;
}
