import { describe, expect, it } from "vitest";

import RestFetch from "../../../../src/handler/rest/rest-fetch";
import MemoryStorage from "../../../../src/storage/memory/memory-storage";

const endpoint = "https://app.local/upload";
const total = 30;
const bytes = new Uint8Array(total).map((_, index) => index);

/** An adapter that only appends and keeps the upload's metadata after completion. */
class SequentialMemoryStorage extends MemoryStorage {
    public override readonly sequentialWrites: boolean = true;
}

const patch = async (rest: RestFetch, location: string, offset: number, body: Uint8Array): Promise<Response> =>
    rest.fetch(
        new Request(location, {
            body,
            headers: { "content-length": String(body.byteLength), "content-type": "application/octet-stream", "x-chunk-offset": String(offset) },
            method: "PATCH",
        }),
    );

describe("fetch RestFetch chunked uploads completed over an append-only adapter", () => {
    it("should record the completing chunk so X-Received-Chunks agrees with X-Upload-Complete", async () => {
        expect.assertions(5);

        const rest = new RestFetch({ storage: new SequentialMemoryStorage() });
        const created = await rest.fetch(
            new Request(endpoint, {
                headers: { "content-type": "application/octet-stream", "x-chunked-upload": "true", "x-total-size": String(total) },
                method: "POST",
            }),
        );
        const location = new URL(created.headers.get("location") as string, endpoint).href;
        // The three chunks, merged into one range.
        const allChunks = [{ length: total, offset: 0 }];

        await patch(rest, location, 0, bytes.slice(0, 10));
        await patch(rest, location, 10, bytes.slice(10, 20));

        const last = await patch(rest, location, 20, bytes.slice(20));

        expect(last.status).toBe(200);
        expect(JSON.parse(last.headers.get("x-received-chunks") as string)).toStrictEqual(allChunks);

        const head = await rest.fetch(new Request(location, { method: "HEAD" }));

        expect(head.headers.get("x-upload-complete")).toBe("true");
        expect(head.headers.get("x-upload-offset")).toBe(String(total));
        expect(JSON.parse(head.headers.get("x-received-chunks") as string)).toStrictEqual(allChunks);
    });
});
