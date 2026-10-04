import { Buffer } from "node:buffer";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";

import { afterEach, describe, expect, it } from "vitest";

import RestFetch from "../../../../src/handler/rest/rest-fetch";
import { waitForStorage } from "../../../../src/handler/utils/storage-utils";
import DiskStorage from "../../../../src/storage/local/disk-storage";
import MemoryStorage from "../../../../src/storage/memory/memory-storage";
import type { FilePart, FileQuery, UploadFile } from "../../../../src/storage/utils/file";

const endpoint = "https://app.local/upload";
const total = 1000;
const bytes = new Uint8Array(total).map((_, index) => index % 251);

/** MemoryStorage, except a write whose body fails part-way keeps the bytes that arrived. */
class KeepPartialStorage extends MemoryStorage {
    public override async write(part: FilePart | FileQuery): Promise<UploadFile> {
        if (!("body" in part) || part.body === undefined) {
            return super.write(part);
        }

        const received: Buffer[] = [];
        let failure: unknown;

        try {
            for await (const chunk of part.body as AsyncIterable<Uint8Array>) {
                received.push(Buffer.from(chunk));
            }
        } catch (error) {
            failure = error;
        }

        const kept = Buffer.concat(received);
        const file = await super.write({ ...part, body: Readable.from([kept]), contentLength: kept.byteLength });

        if (failure !== undefined) {
            throw failure;
        }

        return file;
    }
}

/** A request body that delivers `first` and then fails, like a client dropping the connection. */
const brokenBody = (first: Uint8Array): ReadableStream<Uint8Array> => {
    let delivered = false;

    return new ReadableStream({
        async pull(controller) {
            if (delivered) {
                await new Promise((resolve) => {
                    setTimeout(resolve, 20);
                });
                controller.error(new Error("connection reset"));
            } else {
                delivered = true;
                controller.enqueue(first);
            }
        },
    });
};

const create = async (rest: RestFetch): Promise<string> => {
    const created = await rest.fetch(
        new Request(endpoint, {
            headers: { "content-type": "application/octet-stream", "x-chunked-upload": "true", "x-total-size": String(total) },
            method: "POST",
        }),
    );

    return new URL(created.headers.get("location") as string, endpoint).href;
};

const patch = async (rest: RestFetch, location: string, offset: number, body: BodyInit, length: number): Promise<Response> =>
    rest.fetch(
        new Request(location, {
            body,
            duplex: "half",
            headers: { "content-length": String(length), "content-type": "application/octet-stream", "x-chunk-offset": String(offset) },
            method: "PATCH",
        } as RequestInit),
    );

const resumeFromHead = async (rest: RestFetch, location: string): Promise<{ offset: number; response: Response }> => {
    const head = await rest.fetch(new Request(location, { method: "HEAD" }));
    const offset = Number(head.headers.get("x-upload-offset"));
    const response = await patch(rest, location, offset, bytes.slice(offset), total - offset);

    return { offset, response };
};

describe("fetch RestFetch chunked uploads with an interrupted chunk (#909)", () => {
    it("should resume an adapter that writes at any offset from the recorded chunks", async () => {
        expect.assertions(4);

        const storage = new KeepPartialStorage();
        const rest = new RestFetch({ storage });
        const location = await create(rest);

        const interrupted = await patch(rest, location, 0, brokenBody(bytes.slice(0, 400)), total);

        expect(interrupted.ok).toBe(false);

        const { offset, response } = await resumeFromHead(rest, location);

        // The partial bytes were never recorded, so the client resends the whole chunk.
        expect(offset).toBe(0);
        expect(response.status).toBe(200);
        expect(response.headers.get("x-upload-complete")).toBe("true");
    });

    it("should complete an adapter that only appends from its stored prefix", async () => {
        expect.assertions(5);

        const storage = new KeepPartialStorage();

        // An adapter that only appends, like a multipart provider.
        Object.defineProperty(storage, "sequentialWrites", { value: true });

        const rest = new RestFetch({ storage });
        const location = await create(rest);

        await patch(rest, location, 0, brokenBody(bytes.slice(0, 400)), total);

        const { offset, response } = await resumeFromHead(rest, location);

        expect(offset).toBe(400);
        expect(response.status).toBe(200);
        expect(response.headers.get("x-upload-complete")).toBe("true");

        const head = await rest.fetch(new Request(location, { method: "HEAD" }));

        expect(head.headers.get("x-upload-complete")).toBe("true");
        expect(head.headers.get("x-upload-offset")).toBe(String(total));
    });
});

describe("diskStorage with a client dropping the connection (#910)", () => {
    let directory: string | undefined;

    afterEach(async () => {
        if (directory) {
            await rm(directory, { force: true, recursive: true });
        }
    });

    it("should fail the request instead of crashing the process", async () => {
        expect.assertions(2);

        directory = await mkdtemp(join(tmpdir(), "disk-drop-"));

        const storage = new DiskStorage({ directory });
        const rest = new RestFetch({ storage });

        await waitForStorage(storage);

        const location = await create(rest);
        // Fails within the file-type detection window of the first chunk.
        let delivered = false;
        const body = new ReadableStream<Uint8Array>({
            pull(controller) {
                if (delivered) {
                    controller.error(new Error("connection reset"));
                } else {
                    delivered = true;
                    controller.enqueue(new Uint8Array(400));
                }
            },
        });

        const response = await patch(rest, location, 0, body, total);

        expect(response.ok).toBe(false);

        // The server keeps serving.
        const head = await rest.fetch(new Request(location, { method: "HEAD" }));

        expect(head.status).toBe(200);
    });
});
