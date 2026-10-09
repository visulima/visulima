/* eslint-disable max-classes-per-file -- one failing storage per way an adapter consumes a body */
import { mkdtemp, rm } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { Agent, createServer, request as httpRequest } from "node:http";
import type { AddressInfo, Socket } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Transform, Writable } from "node:stream";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import Rest from "../../src/handler/rest/rest";
import { Tus, TUS_RESUMABLE } from "../../src/handler/tus/tus";
import DiskStorage from "../../src/storage/local/disk-storage";
import MemoryStorage from "../../src/storage/memory/memory-storage";
import type { File, FilePart, FileQuery, UploadFile } from "../../src/storage/utils/file";
import type { ERRORS } from "../../src/utils/errors";
import { MAX_DRAIN_BYTES } from "../../src/utils/http";
import { sendThenRead } from "../__helpers__/utils";

const FAIL_AFTER = 64 * 1024;
// More than the socket buffers on both ends hold, so the client is still writing when the write fails.
const BODY_SIZE = MAX_DRAIN_BYTES - 256 * 1024;

const failure = (): Error => new Error("storage failed mid-write");

/** DiskStorage whose file write fails part-way, like a full disk: pipeline() destroys the body. */
class FailingDiskStorage extends DiskStorage {
    protected override lazyWrite(part: File & FilePart, transforms: Transform[] = []): Promise<[number, ERRORS?]> {
        let seen = 0;
        const failing = new Transform({
            transform(chunk: Buffer, _encoding, callback) {
                seen += chunk.length;
                callback(seen > FAIL_AFTER ? failure() : undefined, chunk);
            },
        });

        return super.lazyWrite(part, [...transforms, failing]);
    }
}

/** MemoryStorage whose write gives up part-way through a for-await, which destroys the body. */
class IteratingStorage extends MemoryStorage {
    public override async write(part: FilePart | FileQuery): Promise<UploadFile> {
        if (!("body" in part) || !part.body) {
            return super.write(part);
        }

        let seen = 0;

        for await (const chunk of part.body) {
            seen += (chunk as Buffer).length;

            if (seen > FAIL_AFTER) {
                throw failure();
            }
        }

        return super.write(part);
    }
}

/** MemoryStorage whose write pipes the body into a sink that fails part-way: pipe() leaves the body paused. */
class PipingStorage extends MemoryStorage {
    public override async write(part: FilePart | FileQuery): Promise<UploadFile> {
        if (!("body" in part) || !part.body) {
            return super.write(part);
        }

        let seen = 0;

        await new Promise<void>((resolve, reject) => {
            const sink = new Writable({
                write(chunk: Buffer, _encoding, callback) {
                    seen += chunk.length;
                    callback(seen > FAIL_AFTER ? failure() : undefined);
                },
            });

            sink.on("error", reject);
            sink.on("finish", resolve);
            part.body.pipe(sink);
        });

        return super.write(part);
    }
}

const request = async (
    port: number,
    method: string,
    path: string,
    headers: Record<string, string>,
): Promise<{ headers: IncomingMessage["headers"]; status?: number }> =>
    new Promise((resolve, reject) => {
        const client = httpRequest({ headers, host: "127.0.0.1", method, path, port }, (response) => {
            response.resume();
            response.on("end", () => {
                resolve({ headers: response.headers, status: response.statusCode });
            });
        });

        client.on("error", reject);
        client.end();
    });

/** Sends a request over the agent and reports the socket it went over and the status. */
const send = async (agent: Agent, port: number, method: string, path: string, payload?: Buffer): Promise<{ socket?: Socket; status?: number }> =>
    new Promise((resolve, reject) => {
        let socket: Socket | undefined;
        const headers = payload ? { "Content-Length": String(payload.length), "Content-Type": "application/octet-stream" } : {};
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
        client.end(payload);
    });

const backends: [string, (directory: string) => MemoryStorage | DiskStorage][] = [
    ["disk (pipeline)", (directory) => new FailingDiskStorage({ directory })],
    ["for-await", () => new IteratingStorage()],
    ["pipe", () => new PipingStorage()],
];

describe.each(backends)("node handlers with a %s storage write failing mid-body", (_name, createStorage) => {
    let port: number;
    let directory: string;
    let close: () => Promise<void>;

    beforeAll(async () => {
        directory = await mkdtemp(join(tmpdir(), "storage-write-failure-"));

        const storage = createStorage(directory);
        const rest = new Rest({ storage });
        const tus = new Tus({ storage });
        const server = createServer((incoming: IncomingMessage, response: ServerResponse) => {
            void (incoming.url?.startsWith("/tus") ? tus : rest).handle(incoming, response);
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
        await rm(directory, { force: true, recursive: true });
    });

    const body = Buffer.alloc(BODY_SIZE, 32);

    it("should answer a REST PUT with the error response", async () => {
        expect.assertions(1);

        const head = `PUT /files/put-${String(Date.now())} HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/octet-stream\r\nContent-Length: ${String(BODY_SIZE)}\r\n\r\n`;

        await expect(sendThenRead(port, head, body)).resolves.toMatch(/^HTTP\/1\.1 5\d\d /u);
    });

    it("should answer a REST PATCH with the error response", async () => {
        expect.assertions(1);

        const created = await request(port, "POST", "/files", {
            "Content-Length": "0",
            "X-Chunked-Upload": "true",
            "X-Total-Size": String(BODY_SIZE),
        });
        const id = String(created.headers["x-upload-id"]);
        const head = `PATCH /files/${id} HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/octet-stream\r\nX-Chunk-Offset: 0\r\nContent-Length: ${String(BODY_SIZE)}\r\n\r\n`;

        await expect(sendThenRead(port, head, body)).resolves.toMatch(/^HTTP\/1\.1 5\d\d /u);
    });

    it("should answer a TUS PATCH with a Content-Length with the error response", async () => {
        expect.assertions(1);

        const created = await request(port, "POST", "/tus", { "Tus-Resumable": TUS_RESUMABLE, "Upload-Length": String(BODY_SIZE) });
        const path = new URL(String(created.headers.location), "http://localhost").pathname;
        const head = `PATCH ${path} HTTP/1.1\r\nHost: localhost\r\nTus-Resumable: ${TUS_RESUMABLE}\r\nUpload-Offset: 0\r\nContent-Type: application/offset+octet-stream\r\nContent-Length: ${String(BODY_SIZE)}\r\n\r\n`;

        await expect(sendThenRead(port, head, body)).resolves.toMatch(/^HTTP\/1\.1 5\d\d /u);
    });

    it("should serve the next request on the same kept-alive connection after the error", async () => {
        expect.assertions(3);

        const agent = new Agent({ keepAlive: true, maxSockets: 1 });

        try {
            const first = await send(agent, port, "PUT", `/files/reuse-${String(Date.now())}`, Buffer.alloc(FAIL_AFTER + 512 * 1024, 32));

            expect(first.status).toBe(500);

            const second = await send(agent, port, "GET", "/files/missing");

            expect(second.socket).toBe(first.socket);
            expect(second.status).toBe(404);
        } finally {
            agent.destroy();
        }
    });
});
