import { describe, expect, it, vi } from "vitest";

import MemoryMetaStorage from "../../src/storage/memory/memory-meta-storage";
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

        await storage.saveMeta(chunked());
        await storage.saveMeta(
            chunked({ bytesWritten: 30, metadata: { _chunkedUpload: true, _chunks: [{ checksum: "abc", length: 10, offset: 20 }], _totalSize: 30 } }),
        );
        // A provider write that read the record before the save above.
        await storage.saveMeta(chunked({ bytesWritten: 10, metadata: { _chunkedUpload: true, _chunks: [{ length: 10, offset: 0 }], _totalSize: 30 } }));

        const stored = await storage.getMeta("chunked-id");

        expect(stored.bytesWritten).toBe(30);
        expect(stored.metadata._chunks).toStrictEqual([
            { length: 10, offset: 0 },
            { length: 10, offset: 20 },
        ]);
    });

    it("should fail a save whose stored record can't be read instead of overwriting it", async () => {
        expect.assertions(2);

        const storage = new MemoryStorage();

        await storage.saveMeta(chunked());
        await storage.saveMeta(chunked({ bytesWritten: 10, metadata: { _chunkedUpload: true, _chunks: [{ length: 10, offset: 0 }], _totalSize: 30 } }));

        vi.spyOn(storage.meta, "get").mockRejectedValueOnce(new Error("ECONNRESET"));

        await expect(
            storage.saveMeta(chunked({ bytesWritten: 20, metadata: { _chunkedUpload: true, _chunks: [{ length: 10, offset: 10 }], _totalSize: 30 } })),
        ).rejects.toThrow("ECONNRESET");

        const stored = await storage.getMeta("chunked-id");

        expect(stored.metadata._chunks).toStrictEqual([{ length: 10, offset: 0 }]);
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

        // All three chunks, merged into one range.
        expect(stored.metadata._chunks).toStrictEqual([{ length: 30, offset: 0 }]);
    });

    it("should let a fresh record replace the stored progress", async () => {
        expect.assertions(2);

        const storage = new MemoryStorage();

        await storage.saveMeta(chunked());
        await storage.saveMeta(chunked({ bytesWritten: 10, metadata: { _chunkedUpload: true, _chunks: [{ length: 10, offset: 0 }], _totalSize: 30 } }));
        await storage.saveMeta(chunked());

        const stored = await storage.getMeta("chunked-id");

        expect(stored.bytesWritten).toBe(0);
        expect(stored.metadata._chunks).toStrictEqual([]);
    });
});

describe("baseStorage saveMeta conditional saves", () => {
    it("should not read the stored record when the save carries the version it was read at", async () => {
        expect.assertions(2);

        const storage = new MemoryStorage();

        await storage.saveMeta(chunked());

        const file = await storage.getMeta("chunked-id");
        const get = vi.spyOn(storage.meta, "get");

        file.bytesWritten = 10;
        file.metadata = { ...file.metadata, _chunks: [{ length: 10, offset: 0 }] };

        await storage.saveMeta(file);

        expect(get).not.toHaveBeenCalled();

        const stored = await storage.getMeta("chunked-id");

        expect(stored.bytesWritten).toBe(10);
    });

    it("should merge and retry when another process saved in between", async () => {
        expect.assertions(3);

        const storage = new MemoryStorage();

        await storage.saveMeta(chunked());

        const stale = await storage.getMeta("chunked-id");
        const other = await storage.getMeta("chunked-id");

        other.bytesWritten = 30;
        other.metadata = { ...other.metadata, _chunks: [{ length: 10, offset: 20 }] };
        await storage.saveMeta(other);

        const saveIfVersion = vi.spyOn(storage.meta, "saveIfVersion");

        stale.bytesWritten = 10;
        stale.metadata = { ...stale.metadata, _chunks: [{ length: 10, offset: 0 }] };
        await storage.saveMeta(stale);

        const stored = await storage.getMeta("chunked-id");

        expect(saveIfVersion).toHaveBeenCalledTimes(2);
        expect(stored.bytesWritten).toBe(30);
        expect(stored.metadata._chunks).toStrictEqual([
            { length: 10, offset: 0 },
            { length: 10, offset: 20 },
        ]);
    });

    it("should not drop a chunk recorded after the caller of update read the record", async () => {
        expect.assertions(1);

        const storage = new MemoryStorage();

        await storage.saveMeta(chunked());

        // The caller read the record, then another process recorded a chunk.
        const stale = await storage.getMeta("chunked-id");
        const other = await storage.getMeta("chunked-id");

        other.metadata = { ...other.metadata, _chunks: [{ length: 10, offset: 20 }] };
        await storage.saveMeta(other);

        await storage.update({ id: "chunked-id" }, { metadata: { ...stale.metadata, _chunks: [{ length: 10, offset: 0 }] } });

        const stored = await storage.getMeta("chunked-id");

        expect(stored.metadata._chunks).toStrictEqual([
            { length: 10, offset: 0 },
            { length: 10, offset: 20 },
        ]);
    });

    it("should merge within the process for a metadata store without conditional saves", async () => {
        expect.assertions(1);

        const metaStorage = new MemoryMetaStorage();

        Object.defineProperty(metaStorage, "supportsConditionalSave", { value: false });

        const storage = new MemoryStorage({ metaStorage });

        await storage.saveMeta(chunked());
        await storage.saveMeta(chunked({ bytesWritten: 30, metadata: { _chunkedUpload: true, _chunks: [{ length: 10, offset: 20 }], _totalSize: 30 } }));
        await storage.saveMeta(chunked({ bytesWritten: 10, metadata: { _chunkedUpload: true, _chunks: [{ length: 10, offset: 0 }], _totalSize: 30 } }));

        const stored = await storage.getMeta("chunked-id");

        expect(stored.metadata._chunks).toHaveLength(2);
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
