import type { BinaryLike, BinaryToTextEncoding } from "node:crypto";
import { createHash } from "node:crypto";
import { IncomingMessage } from "node:http";
import { Socket } from "node:net";

export const hash = (buf: BinaryLike, algorithm = "sha1", encoding: BinaryToTextEncoding = "base64"): string =>
    // eslint-disable-next-line sonarjs/hashing
    createHash(algorithm).update(buf).digest(encoding);

export const waitForStorageReady = async (storage: { isReady: boolean } | { storage: { isReady: boolean } }, timeoutMs = 5000): Promise<void> => {
    const startTime = Date.now();
    const storageObject = "isReady" in storage ? storage : storage.storage;

    return new Promise((resolve, reject) => {
        const checkReady = () => {
            if (storageObject.isReady) {
                resolve();
            } else if (Date.now() - startTime > timeoutMs) {
                reject(new Error("Storage readiness timeout"));
            } else {
                setTimeout(checkReady, 10);
            }
        };

        checkReady();
    });
};

export const createRequest = (options: { body: string; encoding?: BufferEncoding }): IncomingMessage => {
    const { body, encoding = "utf8" } = options;

    const request = new IncomingMessage(new Socket());

    request.headers = {
        "content-length": String(Buffer.byteLength(body, encoding)),
        "content-type": `text/plain; charset=${encoding}`,
    };

    const buffer = Buffer.from(body, encoding);

    process.nextTick(() => {
        request.emit("data", buffer);
        request.emit("end");
    });

    return request;
};
