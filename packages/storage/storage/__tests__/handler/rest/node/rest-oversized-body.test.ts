import type { IncomingMessage, ServerResponse } from "node:http";
import { Agent, createServer, request as httpRequest } from "node:http";
import type { AddressInfo, Socket } from "node:net";
import { connect } from "node:net";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import Rest from "../../../../src/handler/rest/rest";
import { MAX_BATCH_DELETE_BYTES } from "../../../../src/handler/rest/rest-base";
import MemoryStorage from "../../../../src/storage/memory/memory-storage";
import { MAX_DRAIN_BYTES } from "../../../../src/utils/http";
import { sendThenRead } from "../../../__helpers__/utils";

/**
 * A client that is still sending a body the server already refused must read the 413, not a
 * broken connection: the handler stops buffering at the limit but drains the rest of the body, up to
 * a cap. Closing the connection while the body is still in flight makes the kernel reset it, which
 * on macOS and Windows discards the unread 413.
 */
describe("http Rest with a batch-delete body over its limit", () => {
    let port: number;
    let close: () => Promise<void>;

    beforeAll(async () => {
        const rest = new Rest({ storage: new MemoryStorage({ path: "/files" }) });
        const server = createServer((request: IncomingMessage, response: ServerResponse) => {
            void rest.handle(request, response);
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

    /**
     * Sends the body over the limit at once, then keeps writing after the server has answered, and
     * reports what the client saw once its request closed: the status, and any error on the socket.
     */
    const sendSlowly = async (): Promise<{ error?: string; status?: number }> =>
        new Promise((resolve) => {
            const seen: { error?: string; status?: number } = {};
            // More than the socket buffers hold, so the client is still writing when the server answers.
            const tail = Buffer.alloc(512 * 1024, 32);
            // Node sends no body framing for a DELETE unless told the length.
            const headers = { "Content-Length": String(head.length + tail.length), "Content-Type": "application/json" };
            const client = httpRequest({ headers, host: "127.0.0.1", method: "DELETE", path: "/files/x", port }, (response) => {
                seen.status = response.statusCode;
                response.resume();
            });

            client.on("error", (error: NodeJS.ErrnoException) => {
                seen.error = error.code ?? error.message;
            });
            client.on("close", () => {
                resolve(seen);
            });
            client.write(head);
            setTimeout(() => {
                client.end(tail);
            }, 100);
        });

    const head = Buffer.from(JSON.stringify(["x".repeat(MAX_BATCH_DELETE_BYTES)]));
    const requestHead = (length: number): string =>
        `DELETE /files/x HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/json\r\nContent-Length: ${String(length)}\r\n\r\n`;

    it("should answer 413 to a client that keeps sending, without breaking its connection", async () => {
        expect.assertions(1);

        await expect(sendSlowly()).resolves.toStrictEqual({ status: 413 });
    });

    it("should keep the 413 readable for a client that reads it only after sending the rest of its body", async () => {
        expect.assertions(1);

        const tail = Buffer.alloc(512 * 1024, 32);
        const received = await new Promise<string>((resolve) => {
            const socket = connect(port, "127.0.0.1");
            let data = "";

            // Don't read: a reset arriving now would discard the 413 still waiting in the receive buffer.
            socket.pause();
            socket.on("data", (chunk: Buffer) => {
                data += chunk.toString();
            });
            socket.on("error", (error: NodeJS.ErrnoException) => {
                resolve(`${error.code ?? error.message}: ${data}`);
            });
            socket.write(requestHead(head.length + tail.length));
            socket.write(head);
            setTimeout(() => {
                socket.write(tail);
                setTimeout(() => {
                    socket.resume();
                    setTimeout(() => {
                        socket.destroy();
                        resolve(data);
                    }, 200);
                }, 300);
            }, 300);
        });

        expect(received).toMatch(/^HTTP\/1\.1 413 /u);
    });

    it("should cut off a client that keeps sending far past the drain cap", async () => {
        expect.assertions(2);

        const total = head.length + 64 * 1024 * 1024;
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
            socket.write(head, pump);
        });

        expect(Date.now() - startedAt).toBeLessThan(5000);
        // Allow for what the socket buffers on both ends hold.
        expect(sent).toBeLessThan(head.length + MAX_DRAIN_BYTES + 16 * 1024 * 1024);
    });

    it("should serve the next request on the same kept-alive connection after a drained 413", async () => {
        expect.assertions(3);

        const agent = new Agent({ keepAlive: true, maxSockets: 1 });
        const send = async (method: string, body?: Buffer): Promise<{ socket?: Socket; status?: number }> =>
            new Promise((resolve, reject) => {
                const headers = body ? { "Content-Length": String(body.length), "Content-Type": "application/json" } : {};
                let socket: Socket | undefined;
                const client = httpRequest({ agent, headers, host: "127.0.0.1", method, path: "/files/x", port }, (response) => {
                    response.resume();
                    response.on("end", () => {
                        resolve({ socket, status: response.statusCode });
                    });
                });

                client.on("socket", (assigned: Socket) => {
                    socket = assigned;
                });
                client.on("error", reject);
                client.end(body);
            });

        try {
            const first = await send("DELETE", Buffer.concat([head, Buffer.alloc(512 * 1024, 32)]));

            expect(first.status).toBe(413);

            const second = await send("GET");

            expect(second.socket).toBe(first.socket);
            expect(second.status).toBe(404);
        } finally {
            agent.destroy();
        }
    });
});

/**
 * A request refused before its body is read is left to Node, which discards the whole body however
 * large it is: cutting the connection at the drain cap would lose the 413 to the reset.
 */
describe("http Rest with an upload refused before its body is read", () => {
    const MAX_UPLOAD_SIZE = 1024;
    let port: number;
    let close: () => Promise<void>;

    beforeAll(async () => {
        const rest = new Rest({ storage: new MemoryStorage({ maxUploadSize: MAX_UPLOAD_SIZE, path: "/files" }) });
        const server = createServer((request: IncomingMessage, response: ServerResponse) => {
            void rest.handle(request, response);
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

    it("should keep the 413 readable for a body past the drain cap", async () => {
        expect.assertions(1);

        const size = MAX_UPLOAD_SIZE + MAX_DRAIN_BYTES + 1024 * 1024;
        const head = `POST /files HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/octet-stream\r\nContent-Length: ${String(size)}\r\n\r\n`;

        await expect(sendThenRead(port, head, Buffer.alloc(size, 32))).resolves.toMatch(/^HTTP\/1\.1 413 /u);
    });
});
