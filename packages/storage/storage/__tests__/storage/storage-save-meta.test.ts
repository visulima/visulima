import { describe, expect, it } from "vitest";

import MemoryStorage from "../../src/storage/memory/memory-storage";
import type { UploadFile } from "../../src/storage/utils/file";

const chunked = (overrides: Partial<UploadFile> = {}): UploadFile => {
    return {
        bytesWritten: 0,
        contentType: "application/octet-stream",
        id: "chunked-id",
        metadata: { _chunkedUpload: true, _chunks: [], _totalSize: 30 },
        name: "chunked-id",
        originalName: "chunked.bin",
        size: 30,
        status: "created",
        ...overrides,
    };
};

describe("baseStorage saveMeta for chunked uploads (#902)", () => {
    it("should keep chunks and progress a stale save is missing", async () => {
        expect.assertions(2);

        const storage = new MemoryStorage();

        await storage.saveMeta(
            chunked({ bytesWritten: 30, metadata: { _chunkedUpload: true, _chunks: [{ checksum: "abc", length: 10, offset: 20 }], _totalSize: 30 } }),
        );
        // A provider write that read the record before the save above.
        await storage.saveMeta(chunked({ bytesWritten: 10, metadata: { _chunkedUpload: true, _chunks: [{ length: 10, offset: 0 }], _totalSize: 30 } }));

        const stored = await storage.getMeta("chunked-id");

        expect(stored.bytesWritten).toBe(30);
        expect(stored.metadata._chunks).toStrictEqual([
            { length: 10, offset: 0 },
            { checksum: "abc", length: 10, offset: 20 },
        ]);
    });

    it("should not lose a chunk when saves of the same record run concurrently", async () => {
        expect.assertions(1);

        const storage = new MemoryStorage();

        await storage.saveMeta(chunked());
        await Promise.all(
            [0, 10, 20].map(async (offset) =>
                storage.saveMeta(chunked({ bytesWritten: offset + 10, metadata: { _chunkedUpload: true, _chunks: [{ length: 10, offset }], _totalSize: 30 } })),
            ),
        );

        const stored = await storage.getMeta("chunked-id");

        expect((stored.metadata._chunks as { offset: number }[]).map((chunk) => chunk.offset).toSorted()).toStrictEqual([0, 10, 20]);
    });

    it("should let a fresh record replace the stored progress", async () => {
        expect.assertions(2);

        const storage = new MemoryStorage();

        await storage.saveMeta(chunked({ bytesWritten: 10, metadata: { _chunkedUpload: true, _chunks: [{ length: 10, offset: 0 }], _totalSize: 30 } }));
        await storage.saveMeta(chunked());

        const stored = await storage.getMeta("chunked-id");

        expect(stored.bytesWritten).toBe(0);
        expect(stored.metadata._chunks).toStrictEqual([]);
    });
});

describe("baseStorage options", () => {
    it("should keep a default when an option is explicitly undefined", async () => {
        expect.assertions(2);

        const storage = new MemoryStorage({ filename: undefined, maxUploadSize: undefined });

        expect(storage.config.filename?.({ id: "abc" } as UploadFile)).toBe("abc");
        expect(storage.maxUploadSize).toBeGreaterThan(0);
    });
});
