import { Readable } from "node:stream";

import { describe, expect, it } from "vitest";

import { Files } from "../../src/files";
import MemoryStorage from "../../src/storage/memory/memory-storage";
import { ERRORS } from "../../src/utils/errors";

const write = (storage: MemoryStorage, text: string) => async (stagingId: string) =>
    storage.write({ body: Readable.from([Buffer.from(text)]), contentLength: text.length, id: stagingId, start: 0 });

const upload = async (storage: MemoryStorage, text: string): Promise<string> => {
    const file = await storage.create({ contentType: "text/plain", metadata: {}, size: text.length });

    await write(storage, text)(file.id);

    return file.id;
};

describe("replaceUpload", () => {
    it("should keep the staged replacement when putting it in place fails", async () => {
        expect.assertions(2);

        const storage = new MemoryStorage();
        const id = await upload(storage, "old");

        // The provider fails while the replacement is put in place, after the old file is gone.
        const failing = Object.assign(storage, {
            commitReplacement: async () => {
                await storage.delete({ id });

                throw new Error("provider failed mid-swap");
            },
        });

        await expect(failing.replaceUpload(id, { contentType: "text/plain", metadata: {}, size: 3 }, write(storage, "new"))).rejects.toThrow(
            "provider failed mid-swap",
        );

        // The only complete copy left survives as the staging upload.
        const staged = [...(await storage.list())].filter(({ id: key }) => key.endsWith(".replace"));

        expect(staged).toHaveLength(1);
    });

    it("should refuse a filename option that doesn't depend on the id", async () => {
        expect.assertions(2);

        const storage = new MemoryStorage({ filename: (file) => file.originalName });
        const created = await storage.create({ contentType: "text/plain", metadata: {}, originalName: "report.txt", size: 3 });

        await write(storage, "old")(created.id);

        await expect(
            storage.replaceUpload(created.id, { contentType: "text/plain", metadata: {}, originalName: "report.txt", size: 3 }, write(storage, "new")),
        ).rejects.toThrow(expect.objectContaining({ UploadErrorCode: ERRORS.FILE_CONFLICT }));
        await expect(storage.get({ id: created.id }).then(({ content }) => content.toString())).resolves.toBe("old");
    });
});

describe("conditional uploads with a throwing onCreate hook", () => {
    it("should not leave the key locked", async () => {
        expect.assertions(2);

        let fail = true;
        const storage = new MemoryStorage({
            onCreate: () => {
                if (fail) {
                    fail = false;

                    throw new Error("hook failed");
                }
            },
        });
        const files = new Files({ adapter: storage });

        await expect(files.upload("a.txt", "one", { ifNoneMatch: "*" })).rejects.toThrow("hook failed");
        // The next conditional upload of the key works instead of answering FILE_LOCKED.
        await expect(files.upload("a.txt", "two", { ifNoneMatch: "*" })).resolves.toBeDefined();
    });
});
