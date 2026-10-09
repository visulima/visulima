import type { BinaryLike, BinaryToTextEncoding } from "node:crypto";
import { createHash } from "node:crypto";
import { IncomingMessage } from "node:http";
import { connect, Socket } from "node:net";

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

/**
 * Sends a whole request over a raw socket before reading anything, then returns what the server
 * answered. A server that stops reading a refused body leaves the client stuck writing ("stalled")
 * until its keep-alive timeout cuts the connection, and a reset on that connection discards the
 * unread response on macOS and Windows.
 * @param port Server port on 127.0.0.1
 * @param head Request line and headers, ending in the blank line
 * @param body Request body, already framed
 *
 * The write callback only means the kernel took the bytes. Windows' auto-tuned send buffer takes
 * the whole body at once while the server is still draining it, so after writing this waits for
 * the response head (or the socket to close) rather than a fixed delay.
 * @returns The response bytes, prefixed by the socket error, "stalled" or "no response" if there was one
 */
export const sendThenRead = async (port: number, head: string, body: Buffer): Promise<string> =>
    new Promise((resolve) => {
        const socket = connect(port, "127.0.0.1");
        let data = "";
        let written = false;
        let settled = false;
        const finish = (result: string): void => {
            if (!settled) {
                settled = true;
                clearTimeout(timer);
                socket.destroy();
                resolve(result);
            }
        };
        let timer = setTimeout(() => {
            finish(`stalled: ${data}`);
        }, 2000);

        socket.pause();
        socket.on("data", (chunk: Buffer) => {
            data += chunk.toString();

            if (written && data.includes("\r\n\r\n")) {
                finish(data);
            }
        });
        socket.on("error", (error: NodeJS.ErrnoException) => {
            finish(`${error.code ?? error.message}: ${data}`);
        });
        socket.on("close", () => {
            finish(data);
        });
        socket.write(head);
        socket.write(body, () => {
            written = true;
            clearTimeout(timer);

            if (data.includes("\r\n\r\n")) {
                finish(data);

                return;
            }

            // Stall (2 s) + this stays under vitest's 5 s default test timeout.
            timer = setTimeout(() => {
                finish(`no response: ${data}`);
            }, 2500);
            socket.resume();
        });
    });
