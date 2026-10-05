import { describe, expect, it, vi } from "vitest";

import { executors } from "../../src/ai/internal/executors";
import { downloadFileInputSchema, MAX_DOWNLOAD_BYTES, searchFilesInputSchema } from "../../src/ai/internal/schemas";
import { Files } from "../../src/files";
import MemoryStorage from "../../src/storage/memory/memory-storage";

describe("downloadFile maxBytes cap", () => {
    it("schema accepts maxBytes up to MAX_DOWNLOAD_BYTES and rejects above it", () => {
        expect.assertions(2);

        expect(downloadFileInputSchema.safeParse({ key: "a.txt", maxBytes: MAX_DOWNLOAD_BYTES }).success).toBe(true);
        expect(downloadFileInputSchema.safeParse({ key: "a.txt", maxBytes: MAX_DOWNLOAD_BYTES + 1 }).success).toBe(false);
    });

    it("executor refuses a maxBytes override above the absolute ceiling before any transfer", async () => {
        expect.assertions(1);

        const files = new Files({ adapter: new MemoryStorage({}) });

        await expect(executors.downloadFile(files, { key: "a.txt", maxBytes: MAX_DOWNLOAD_BYTES + 1 })).rejects.toThrow(/exceeds the maximum/u);
    });

    describe("when head() reports no size", () => {
        class SizelessStorage extends MemoryStorage {
            public override async getMeta(...arguments_: Parameters<MemoryStorage["getMeta"]>): ReturnType<MemoryStorage["getMeta"]> {
                const { size: _size, ...rest } = await super.getMeta(...arguments_);

                return rest;
            }
        }

        it("reads only maxBytes + 1 via a ranged read before refusing", async () => {
            const adapter = new SizelessStorage({ initial: { "big.bin": "x".repeat(100) } });
            const get = vi.spyOn(adapter, "get");
            const files = new Files({ adapter });

            await expect(executors.downloadFile(files, { key: "big.bin", maxBytes: 10 })).rejects.toThrow(RangeError);
            expect(get).toHaveBeenCalledWith({ id: "big.bin" }, expect.objectContaining({ range: { end: 10, start: 0 } }));
        });

        it("streams with a byte cap when the adapter has no range support", async () => {
            const adapter = new SizelessStorage({ initial: { "big.bin": "x".repeat(100), "small.txt": "hello" } });

            Object.defineProperty(adapter, "supportsRange", { value: false });

            const get = vi.spyOn(adapter, "get");
            const files = new Files({ adapter });

            await expect(executors.downloadFile(files, { key: "big.bin", maxBytes: 10 })).rejects.toThrow(RangeError);
            await expect(executors.downloadFile(files, { key: "small.txt", maxBytes: 10 })).resolves.toMatchObject({ content: "hello", size: 5 });
            expect(get).not.toHaveBeenCalled();
        });
    });
});

describe("searchFiles input", () => {
    it("should not let a model pick regex matching", () => {
        expect.assertions(2);

        // A model-chosen regex could backtrack catastrophically; Files.search keeps it for callers.
        expect(searchFilesInputSchema.safeParse({ match: "regex", pattern: "^(a|aa)*$" }).success).toBe(false);
        expect(searchFilesInputSchema.safeParse({ match: "glob", pattern: "reports/**/*.csv" }).success).toBe(true);
    });
});
