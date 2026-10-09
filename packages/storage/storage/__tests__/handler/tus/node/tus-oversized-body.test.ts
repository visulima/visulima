import type { IncomingMessage, ServerResponse } from "node:http";
import { Agent, createServer, request as httpRequest } from "node:http";
import type { AddressInfo, Socket } from "node:net";
import { connect } from "node:net";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { Tus, TUS_RESUMABLE } from "../../../../src/handler/tus/tus";
import MemoryStorage from "../../../../src/storage/memory/memory-storage";
import { MAX_DRAIN_BYTES } from "../../../../src/utils/http";
import { sendThenRead } from "../../../__helpers__/utils";

const UPLOAD_LENGTH = 1024;
// More than the socket buffers on both ends hold, so the client is still writing when the server answers.
const OVERSIZE = UPLOAD_LENGTH + MAX_DRAIN_BYTES - 256 * 1024;

const chunked = (body: Buffer): Buffer => Buffer.concat([Buffer.from(`${body.length.toString(16)}\r\n`), body, Buffer.from("\r\n0\r\n\r\n")]);

describe("http Tus with a body over the upload length", () => {
    let port: number;
    let close: () => Promise<void>;

    beforeAll(async () => {
        const tus = new Tus({ storage: new MemoryStorage() });
        const server = createServer((request: IncomingMessage, response: ServerResponse) => {
            void tus.handle(request, response);
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

    const createUpload = async (): Promise<string> =>
        new Promise((resolve, reject) => {
            const client = httpRequest(
                {
                    headers: { "Tus-Resumable": TUS_RESUMABLE, "Upload-Length": String(UPLOAD_LENGTH) },
                    host: "127.0.0.1",
                    method: "POST",
                    path: "/files",
                    port,
                },
                (response) => {
                    response.resume();
                    resolve(new URL(response.headers.location as string, "http://localhost").pathname);
                },
            );

            client.on("error", reject);
            client.end();
        });

    const patchHead = (path: string, framing: string): string =>
        `PATCH ${path} HTTP/1.1\r\nHost: localhost\r\nTus-Resumable: ${TUS_RESUMABLE}\r\nUpload-Offset: 0\r\nContent-Type: application/offset+octet-stream\r\n${framing}\r\n\r\n`;

    it("should keep the 413 readable for a PATCH whose Content-Length exceeds the upload", async () => {
        expect.assertions(1);

        const path = await createUpload();
        const received = await sendThenRead(port, patchHead(path, `Content-Length: ${String(OVERSIZE)}`), Buffer.alloc(OVERSIZE, 32));

        expect(received).toMatch(/^HTTP\/1\.1 413 /u);
    });

    it("should keep the 413 readable for a chunked PATCH that streams past the upload length", async () => {
        expect.assertions(1);

        const path = await createUpload();
        const received = await sendThenRead(port, patchHead(path, "Transfer-Encoding: chunked"), chunked(Buffer.alloc(OVERSIZE, 32)));

        expect(received).toMatch(/^HTTP\/1\.1 413 /u);
    });

    it("should keep the 413 readable for a creation-with-upload over its Upload-Length", async () => {
        expect.assertions(1);

        const head = `POST /files HTTP/1.1\r\nHost: localhost\r\nTus-Resumable: ${TUS_RESUMABLE}\r\nUpload-Length: ${String(UPLOAD_LENGTH)}\r\nContent-Type: application/offset+octet-stream\r\nContent-Length: ${String(OVERSIZE)}\r\n\r\n`;
        const received = await sendThenRead(port, head, Buffer.alloc(OVERSIZE, 32));

        expect(received).toMatch(/^HTTP\/1\.1 413 /u);
    });

    it("should cut off a chunked PATCH that keeps sending far past the drain cap", async () => {
        expect.assertions(2);

        const path = await createUpload();
        const total = 64 * 1024 * 1024;
        const startedAt = Date.now();
        // Bytes the kernel took from the client: the server stopped reading once it cut the connection.
        const sent = await new Promise<number>((resolve) => {
            const socket: Socket = connect(port, "127.0.0.1");
            const chunk = Buffer.alloc(64 * 1024, 32);
            const framed = Buffer.concat([Buffer.from(`${chunk.length.toString(16)}\r\n`), chunk, Buffer.from("\r\n")]);
            let written = 0;

            const pump = (): void => {
                while (written < total && !socket.destroyed) {
                    written += chunk.length;

                    if (!socket.write(framed)) {
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
            socket.write(patchHead(path, "Transfer-Encoding: chunked"), pump);
        });

        expect(Date.now() - startedAt).toBeLessThan(5000);
        // Allow for what the socket buffers on both ends hold.
        expect(sent).toBeLessThan(UPLOAD_LENGTH + MAX_DRAIN_BYTES + 16 * 1024 * 1024);
    });

    it("should serve the next request on the same kept-alive connection after a drained 413", async () => {
        expect.assertions(3);

        const path = await createUpload();
        const agent = new Agent({ keepAlive: true, maxSockets: 1 });
        const send = async (method: string, body?: Buffer): Promise<{ socket?: Socket; status?: number }> =>
            new Promise((resolve, reject) => {
                const headers: Record<string, string> = { "Tus-Resumable": TUS_RESUMABLE };

                if (body) {
                    // No Content-Length: Node frames the body as chunked, so the limit is hit while it streams.
                    Object.assign(headers, { "Content-Type": "application/offset+octet-stream", "Upload-Offset": "0" });
                }

                let socket: Socket | undefined;
                const client = httpRequest({ agent, headers, host: "127.0.0.1", method, path, port }, (response) => {
                    response.resume();
                    response.on("end", () => {
                        resolve({ socket, status: response.statusCode });
                    });
                });

                client.on("socket", (assigned: Socket) => {
                    socket = assigned;
                });
                client.on("error", reject);

                if (body) {
                    client.write(body);
                }

                client.end();
            });

        try {
            const first = await send("PATCH", Buffer.alloc(UPLOAD_LENGTH + 512 * 1024, 32));

            expect(first.status).toBe(413);

            const second = await send("HEAD");

            expect(second.socket).toBe(first.socket);
            expect(second.status).toBe(200);
        } finally {
            agent.destroy();
        }
    });
});
