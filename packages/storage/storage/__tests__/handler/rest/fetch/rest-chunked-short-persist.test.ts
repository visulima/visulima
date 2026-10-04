import { Buffer } from "node:buffer";
import { Readable } from "node:stream";

import { describe, expect, it } from "vitest";

import RestFetch from "../../../../src/handler/rest/rest-fetch";
import MemoryStorage from "../../../../src/storage/memory/memory-storage";
import type { FilePart, FileQuery, UploadFile } from "../../../../src/storage/utils/file";

const endpoint = "https://app.local/upload";
const total = 1000;
const bytes = new Uint8Array(total).map((_, index) => index % 251);

/**
 * An adapter that only appends and, like a GCS resumable upload answering 308 with a shorter
 * Range, persists just the first 600 bytes of the first request.
 */
class ShortPersistStorage extends MemoryStorage {
    public override readonly sequentialWrites: boolean = true;

    private shortened = false;

    public override async write(part: FilePart | FileQuery): Promise<UploadFile> {
        if (this.shortened || !("body" in part) || part.body === undefined) {
            return super.write(part);
        }

        this.shortened = true;

        const received: Buffer[] = [];

        for await (const chunk of part.body as AsyncIterable<Uint8Array>) {
            received.push(Buffer.from(chunk));
        }

        const kept = Buffer.concat(received).subarray(0, 600);

        return super.write({ ...part, body: Readable.from([kept]), contentLength: kept.byteLength });
    }
}

const patch = async (rest: RestFetch, location: string, offset: number, body: Uint8Array): Promise<Response> =>
    rest.fetch(
        new Request(location, {
            body,
            headers: { "content-length": String(body.byteLength), "content-type": "application/octet-stream", "x-chunk-offset": String(offset) },
            method: "PATCH",
        }),
    );

describe("fetch RestFetch chunked uploads over an adapter that persists less than it was sent", () => {
    it("should record only the confirmed bytes and resume from them", async () => {
        expect.assertions(5);

        const rest = new RestFetch({ storage: new ShortPersistStorage() });
        const created = await rest.fetch(
            new Request(endpoint, {
                headers: { "content-type": "application/octet-stream", "x-chunked-upload": "true", "x-total-size": String(total) },
                method: "POST",
            }),
        );
        const location = new URL(created.headers.get("location") as string, endpoint).href;

        const first = await patch(rest, location, 0, bytes);

        expect(first.status).toBe(202);
        expect(first.headers.get("x-upload-offset")).toBe("600");
        expect(JSON.parse(first.headers.get("x-received-chunks") as string)).toStrictEqual([{ length: 600, offset: 0 }]);

        const head = await rest.fetch(new Request(location, { method: "HEAD" }));
        const offset = Number(head.headers.get("x-upload-offset"));
        const resumed = await patch(rest, location, offset, bytes.slice(offset));

        expect(offset).toBe(600);
        expect(resumed.status).toBe(200);
    });
});
