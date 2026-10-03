import { Buffer } from "node:buffer";

import { describe, expect, it } from "vitest";

import RestFetch from "../../../../src/handler/rest/rest-fetch";
import MemoryMetaStorage from "../../../../src/storage/memory/memory-meta-storage";
import MemoryStorage from "../../../../src/storage/memory/memory-storage";
import type { File } from "../../../../src/storage/utils/file";

/**
 * Storages sharing one backing store stand in for server processes: they share no in-process lock
 * or save queue, so only the metadata store's conditional saves keep the chunk records (#902).
 */
const createProcesses = (count: number): { handlers: RestFetch[]; storages: MemoryStorage[] } => {
    const metaStore = new Map<string, File>();
    const storages = Array.from({ length: count }, () => new MemoryStorage({ metaStorage: new MemoryMetaStorage({ store: metaStore }), path: "/files" }));
    const [first] = storages as [MemoryStorage];

    // Share the byte store too (private, test-only).
    for (const storage of storages) {
        Object.defineProperty(storage, "store", { value: (first as unknown as { store: unknown }).store });
    }

    return { handlers: storages.map((storage) => new RestFetch({ storage })), storages };
};

const upload = async (handlers: RestFetch[], bytes: Uint8Array, chunkSize: number): Promise<{ id: string; responses: Response[] }> => {
    const basePath = "http://localhost/files/";
    const createResponse = await handlers[0].fetch(
        new Request(basePath, {
            headers: { "content-type": "application/octet-stream", "x-chunked-upload": "true", "x-total-size": String(bytes.byteLength) },
            method: "POST",
        }),
    );
    const id = createResponse.headers.get("x-upload-id") as string;
    const responses = await Promise.all(
        Array.from({ length: bytes.byteLength / chunkSize }, async (_, index) => {
            const offset = index * chunkSize;

            return handlers[index % handlers.length].fetch(
                new Request(`${basePath}${id}`, {
                    body: bytes.slice(offset, offset + chunkSize),
                    headers: { "content-length": String(chunkSize), "content-type": "application/octet-stream", "x-chunk-offset": String(offset) },
                    method: "PATCH",
                }),
            );
        }),
    );

    return { id, responses };
};

describe("fetch RestFetch chunked uploads across processes (#902)", () => {
    const chunkSize = 1000;
    const bytes = new Uint8Array(chunkSize * 12).map((_, index) => index % 251);

    it("should complete an upload whose chunks are PATCHed through different processes", async () => {
        expect.assertions(5);

        const { handlers, storages } = createProcesses(4);
        const { id, responses } = await upload(handlers, bytes, chunkSize);

        expect(responses.map((response) => response.status).filter((status) => status !== 202)).toStrictEqual([200]);
        expect(responses.filter((response) => response.headers.get("x-upload-complete") === "true")).toHaveLength(1);

        const meta = await (storages[3] as MemoryStorage).getMeta(id);

        expect(meta.metadata._chunks).toHaveLength(12);
        expect(meta.status).toBe("completed");

        const file = await (storages[0] as MemoryStorage).get({ id });

        expect(Buffer.from(file.content).equals(Buffer.from(bytes))).toBe(true);
    });
});
