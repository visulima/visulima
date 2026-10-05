import { PassThrough } from "node:stream";

import { describe, expect, it } from "vitest";

import { Files } from "../../src/files";
import MemoryStorage from "../../src/storage/memory/memory-storage";
import type { FileInit } from "../../src/storage/utils/file";

/** An adapter whose `create` takes a while, as a network call does (S3, GCS, Azure). */
class SlowCreateStorage extends MemoryStorage {
    public override async create(config: FileInit): Promise<Awaited<ReturnType<MemoryStorage["create"]>>> {
        await new Promise((resolve) => setTimeout(resolve, 30));

        return super.create(config);
    }
}

describe("files.upload with a body that fails", () => {
    it("rejects with the body's error when it fails before the adapter reads it", async () => {
        expect.assertions(1);

        const files = new Files({ adapter: new MemoryStorage() });
        const body = new PassThrough();
        const upload = files.upload("early.txt", body, { size: 10 });

        body.destroy(new Error("socket hang up"));

        await expect(upload).rejects.toThrow("socket hang up");
    });

    it("rejects with the body's error when it fails while the adapter creates the file", async () => {
        expect.assertions(1);

        const files = new Files({ adapter: new SlowCreateStorage() });
        const body = new PassThrough();
        const upload = files.upload("slow.txt", body, { size: 10 });

        setTimeout(() => body.destroy(new Error("socket hang up")), 5);

        await expect(upload).rejects.toThrow("socket hang up");
    });

    // The progress stream used to be fed with pipe(), which doesn't pass the body's failure on: the
    // adapter waited forever and the error went unheard.
    it("rejects with the body's error when it fails mid-upload with onProgress", async () => {
        expect.assertions(1);

        const files = new Files({ adapter: new MemoryStorage() });
        const body = new PassThrough();
        const upload = files.upload("progress.txt", body, { onProgress: () => {}, size: 10 });

        body.write("01234");
        setTimeout(() => body.destroy(new Error("socket hang up")), 20);

        await expect(upload).rejects.toThrow("socket hang up");
    });
});
