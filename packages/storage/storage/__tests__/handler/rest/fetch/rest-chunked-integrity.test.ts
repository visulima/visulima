import { Buffer } from "node:buffer";

import { describe, expect, it } from "vitest";

import RestFetch from "../../../../src/handler/rest/rest-fetch";
import MemoryStorage from "../../../../src/storage/memory/memory-storage";
import type { FilePart, FileQuery } from "../../../../src/storage/utils/file";

const basePath = "http://localhost/files";

const initUpload = async (rest: RestFetch<never>, totalSize: number): Promise<string> => {
    const response = await rest.fetch(
        new Request(basePath, {
            headers: { "content-type": "application/octet-stream", "x-chunked-upload": "true", "x-total-size": String(totalSize) },
            method: "POST",
        }),
    );

    return response.headers.get("x-upload-id") as string;
};

const patch = async (rest: RestFetch<never>, id: string, offset: number, byte: number, length = 5): Promise<Response> =>
    rest.fetch(
        new Request(`${basePath}/${id}`, {
            body: new Uint8Array(length).fill(byte),
            headers: { "content-length": String(length), "content-type": "application/octet-stream", "x-chunk-offset": String(offset) },
            method: "PATCH",
        }),
    );

describe("fetch RestFetch chunked uploads", () => {
    it("should store out-of-order chunks at their offsets (#893)", async () => {
        expect.assertions(4);

        const storage = new MemoryStorage({ path: "/files" });
        const rest = new RestFetch({ storage }) as RestFetch<never>;
        const id = await initUpload(rest, 10);

        const first = await patch(rest, id, 5, 66);

        expect(first.status).toBe(202);

        const second = await patch(rest, id, 0, 65);

        expect(second.status).toBe(200);
        expect(second.headers.get("x-upload-complete")).toBe("true");

        const file = await storage.get({ id });

        expect(Buffer.from(file.content).toString("latin1")).toBe("AAAAABBBBB");
    });

    it("should not record a chunk the provider refused (#892)", async () => {
        expect.assertions(6);

        const storage = new MemoryStorage({ path: "/files" });
        const write = storage.write.bind(storage);
        let refused = false;

        storage.write = async (part: FilePart | FileQuery) => {
            if ((part as FilePart).start === 5 && !refused) {
                refused = true;

                const error = new Error("simulated provider refusal") as Error & { statusCode: number };

                error.statusCode = 409;

                throw error;
            }

            return write(part);
        };

        const rest = new RestFetch({ storage }) as RestFetch<never>;
        const id = await initUpload(rest, 10);

        const refusedResponse = await patch(rest, id, 5, 66);

        expect(refusedResponse.ok).toBe(false);

        const second = await patch(rest, id, 0, 65);

        expect(second.status).toBe(202);
        expect(second.headers.get("x-upload-complete")).toBe("false");
        expect(second.headers.get("x-upload-offset")).toBe("5");

        const head = await rest.fetch(new Request(`${basePath}/${id}`, { method: "HEAD" }));

        expect(head.headers.get("x-upload-complete")).toBe("false");

        const retry = await patch(rest, id, 5, 66);

        expect(retry.headers.get("x-upload-complete")).toBe("true");
    });
});
