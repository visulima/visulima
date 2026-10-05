import type { IncomingMessage, ServerResponse } from "node:http";
import { createServer, request as httpRequest } from "node:http";
import type { AddressInfo } from "node:net";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import Rest from "../../../../src/handler/rest/rest";
import { MAX_BATCH_DELETE_BYTES } from "../../../../src/handler/rest/rest-base";
import MemoryStorage from "../../../../src/storage/memory/memory-storage";

/**
 * A client that is still sending a body the server already refused must read the 413, not a
 * broken connection: the handler stops buffering at the limit but drains the rest of the body.
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
            const head = Buffer.from(JSON.stringify(["x".repeat(MAX_BATCH_DELETE_BYTES)]));
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

    it("should answer 413 to a client that keeps sending, without breaking its connection", async () => {
        expect.assertions(1);

        await expect(sendSlowly()).resolves.toStrictEqual({ status: 413 });
    });
});
