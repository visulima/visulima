import { describe, expect, it } from "vitest";

import { executors } from "../../src/ai/internal/executors";
import { downloadFileInputSchema, MAX_DOWNLOAD_BYTES } from "../../src/ai/internal/schemas";
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
});
