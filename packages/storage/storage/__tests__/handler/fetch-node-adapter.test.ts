import type { Server } from "node:http";
import { Agent, request as httpRequest } from "node:http";
import type { AddressInfo, Socket } from "node:net";

import { createAdaptorServer } from "@hono/node-server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import Multipart from "../../src/handler/multipart/multipart-fetch";
import { MAX_BATCH_DELETE_BYTES } from "../../src/handler/rest/rest-base";
import Rest from "../../src/handler/rest/rest-fetch";
import { Tus, TUS_RESUMABLE } from "../../src/handler/tus/tus-fetch";
import MemoryStorage from "../../src/storage/memory/memory-storage";
import { MAX_DRAIN_BYTES } from "../../src/utils/http";
import { sendThenRead } from "../__helpers__/utils";

const MAX_FILE_SIZE = 1024;
const UPLOAD_LENGTH = 1024;
// Over the limit by more than the socket buffers hold, so the client is still writing when the server answers.
const OVERAGE = MAX_DRAIN_BYTES - 256 * 1024;

const chunked = (body: Buffer): Buffer => Buffer.concat([Buffer.from(`${body.length.toString(16)}\r\n`), body, Buffer.from("\r\n0\r\n\r\n")]);

/**
 * The fetch handlers on a Node adapter only see a Web API request. `@hono/node-server`'s body stream
 * ignores a cancel, so a body the handler stops reading stalls the connection until the adapter
 * closes it, losing the 413 to the reset: the handler has to read the rest itself.
 */
describe("fetch handlers on @hono/node-server with a refused body", () => {
    const storage = new MemoryStorage();
    const handlers: Record<string, { fetch: (request: Request) => Promise<Response> }> = {
        multipart: new Multipart({ maxFileSize: MAX_FILE_SIZE, storage }),
        rest: new Rest({ storage }),
        tus: new Tus({ storage }),
    };
    let port: number;
    let server: Server;

    beforeAll(async () => {
        server = createAdaptorServer({
            fetch: async (request: Request) => handlers[new URL(request.url).pathname.split("/")[1] as string]!.fetch(request),
        }) as Server;

        await new Promise<void>((resolve) => {
            server.listen(0, "127.0.0.1", resolve);
        });
        port = (server.address() as AddressInfo).port;
    });

    afterAll(async () => {
        server.closeAllConnections();
        await new Promise<void>((resolve) => {
            server.close(() => {
                resolve();
            });
        });
    });

    it("should keep the 413 readable for a batch delete over its limit", async () => {
        expect.assertions(1);

        const head = "DELETE /rest HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/json\r\nTransfer-Encoding: chunked\r\n\r\n";

        await expect(sendThenRead(port, head, chunked(Buffer.alloc(MAX_BATCH_DELETE_BYTES + OVERAGE, 32)))).resolves.toMatch(/^HTTP\/1\.1 413 /u);
    });

    it("should keep the 413 readable for a multipart upload over maxFileSize", async () => {
        expect.assertions(1);

        const body = Buffer.concat([
            Buffer.from('--b\r\nContent-Disposition: form-data; name="file"; filename="a.bin"\r\nContent-Type: application/octet-stream\r\n\r\n'),
            Buffer.alloc(MAX_FILE_SIZE + OVERAGE, 32),
            Buffer.from("\r\n--b--\r\n"),
        ]);
        const head = `POST /multipart HTTP/1.1\r\nHost: localhost\r\nContent-Type: multipart/form-data; boundary=b\r\nContent-Length: ${String(body.length)}\r\n\r\n`;

        await expect(sendThenRead(port, head, body)).resolves.toMatch(/^HTTP\/1\.1 413 /u);
    });

    it("should keep the 413 readable for a chunked TUS PATCH past the upload length", async () => {
        expect.assertions(1);

        const created = await fetch(`http://127.0.0.1:${String(port)}/tus`, {
            headers: { "Tus-Resumable": TUS_RESUMABLE, "Upload-Length": String(UPLOAD_LENGTH) },
            method: "POST",
        });
        const path = new URL(created.headers.get("location") as string).pathname;
        const head = `PATCH ${path} HTTP/1.1\r\nHost: localhost\r\nTus-Resumable: ${TUS_RESUMABLE}\r\nUpload-Offset: 0\r\nContent-Type: application/offset+octet-stream\r\nTransfer-Encoding: chunked\r\n\r\n`;

        await expect(sendThenRead(port, head, chunked(Buffer.alloc(UPLOAD_LENGTH + OVERAGE, 32)))).resolves.toMatch(/^HTTP\/1\.1 413 /u);
    });

    it("should serve the next request on the same kept-alive connection after a drained 413", async () => {
        expect.assertions(3);

        const agent = new Agent({ keepAlive: true, maxSockets: 1 });
        const send = async (method: string, body?: Buffer): Promise<{ socket?: Socket; status?: number }> =>
            new Promise((resolve, reject) => {
                let socket: Socket | undefined;
                const client = httpRequest(
                    {
                        agent,
                        headers: body ? { "Content-Type": "application/json", "Transfer-Encoding": "chunked" } : {},
                        host: "127.0.0.1",
                        method,
                        path: "/rest/missing",
                        port,
                    },
                    (response) => {
                        response.resume();
                        response.on("end", () => {
                            resolve({ socket, status: response.statusCode });
                        });
                    },
                );

                client.on("socket", (assigned: Socket) => {
                    socket = assigned;
                });
                client.on("error", reject);

                // No Content-Length, so the limit is hit while the body streams.
                if (body) {
                    client.write(body);
                }

                client.end();
            });

        try {
            const first = await send("DELETE", Buffer.alloc(MAX_BATCH_DELETE_BYTES + 512 * 1024, 32));

            expect(first.status).toBe(413);

            const second = await send("GET");

            expect(second.socket).toBe(first.socket);
            expect(second.status).toBe(404);
        } finally {
            agent.destroy();
        }
    });
});
