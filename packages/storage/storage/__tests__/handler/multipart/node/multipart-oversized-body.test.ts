import type { IncomingMessage, ServerResponse } from "node:http";
import { Agent, createServer, request as httpRequest } from "node:http";
import type { AddressInfo, Socket } from "node:net";
import { connect } from "node:net";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import Multipart from "../../../../src/handler/multipart/multipart";
import MemoryStorage from "../../../../src/storage/memory/memory-storage";
import { MAX_DRAIN_BYTES } from "../../../../src/utils/http";
import { sendThenRead } from "../../../__helpers__/utils";

const MAX_FILE_SIZE = 1024;
const BOUNDARY = "drain-boundary";

/**
 * A client that is still sending a file the parser already refused must read the 413, not a broken
 * connection: closing the connection while the body is in flight makes the kernel reset it, which on
 * macOS and Windows discards the unread 413.
 */
describe("http Multipart with a file over its size limit", () => {
    let port: number;
    let close: () => Promise<void>;

    beforeAll(async () => {
        const multipart = new Multipart({ maxFileSize: MAX_FILE_SIZE, storage: new MemoryStorage() });
        const server = createServer((request: IncomingMessage, response: ServerResponse) => {
            void multipart.handle(request, response);
        });

        await new Promise<void>((resolve) => {
            server.listen(0, "127.0.0.1", resolve);
        });
        port = (server.address() as AddressInfo).port;
        close = async () =>
            new Promise((resolve) => {
                server.closeAllConnections();
                server.close(() => {
                    resolve();
                });
            });
    });

    afterAll(async () => {
        await close();
    });

    const partHead = Buffer.from(
        `--${BOUNDARY}\r\nContent-Disposition: form-data; name="file"; filename="big.bin"\r\nContent-Type: application/octet-stream\r\n\r\n`,
    );
    const partTail = Buffer.from(`\r\n--${BOUNDARY}--\r\n`);
    const body = (fileSize: number): Buffer => Buffer.concat([partHead, Buffer.alloc(fileSize, 32), partTail]);
    const requestHead = (length: number): string =>
        `POST /files HTTP/1.1\r\nHost: localhost\r\nContent-Type: multipart/form-data; boundary=${BOUNDARY}\r\nContent-Length: ${String(length)}\r\n\r\n`;

    it("should keep the 413 readable for a client that reads it only after sending its whole body", async () => {
        expect.assertions(1);

        // More than the socket buffers hold, so the client is still writing when the server answers.
        const payload = body(MAX_FILE_SIZE + MAX_DRAIN_BYTES - 256 * 1024);
        const received = await sendThenRead(port, requestHead(payload.length), payload);

        expect(received).toMatch(/^HTTP\/1\.1 413 /u);
    });

    it("should cut off a client that keeps sending far past the drain cap", async () => {
        expect.assertions(2);

        const total = partHead.length + 64 * 1024 * 1024;
        const startedAt = Date.now();
        // Bytes the kernel took from the client: the server stopped reading once it cut the connection.
        const sent = await new Promise<number>((resolve) => {
            const socket: Socket = connect(port, "127.0.0.1");
            const chunk = Buffer.alloc(64 * 1024, 32);
            let written = 0;

            const pump = (): void => {
                while (written < total && !socket.destroyed) {
                    written += chunk.length;

                    if (!socket.write(chunk)) {
                        socket.once("drain", pump);

                        return;
                    }
                }
            };

            socket.on("error", () => {
                // ECONNRESET / EPIPE once the server cuts the connection
            });
            socket.on("close", () => {
                resolve(written);
            });
            socket.write(requestHead(total));
            socket.write(partHead, pump);
        });

        expect(Date.now() - startedAt).toBeLessThan(5000);
        // Allow for what the socket buffers on both ends hold.
        expect(sent).toBeLessThan(partHead.length + MAX_DRAIN_BYTES + 16 * 1024 * 1024);
    });

    it("should serve the next request on the same kept-alive connection after a drained 413", async () => {
        expect.assertions(3);

        const agent = new Agent({ keepAlive: true, maxSockets: 1 });
        const send = async (method: string, payload?: Buffer): Promise<{ socket?: Socket; status?: number }> =>
            new Promise((resolve, reject) => {
                const headers = payload ? { "Content-Length": String(payload.length), "Content-Type": `multipart/form-data; boundary=${BOUNDARY}` } : {};
                let socket: Socket | undefined;
                const client = httpRequest({ agent, headers, host: "127.0.0.1", method, path: "/files", port }, (response) => {
                    response.resume();
                    response.on("end", () => {
                        resolve({ socket, status: response.statusCode });
                    });
                });

                client.on("socket", (assigned: Socket) => {
                    socket = assigned;
                });
                client.on("error", reject);
                client.end(payload);
            });

        try {
            const first = await send("POST", body(MAX_FILE_SIZE + 512 * 1024));

            expect(first.status).toBe(413);

            const second = await send("GET");

            expect(second.socket).toBe(first.socket);
            expect(second.status).toBe(404);
        } finally {
            agent.destroy();
        }
    });
});
