import { describe, expect, it } from "vitest";

import copyFile from "../../src/handler/copy-file";
import { deepClone } from "../../src/index";

describe(copyFile, () => {
    it("preserves name, lastModified, type and bytes", async () => {
        expect.assertions(6);

        const original = new File(["hello world"], "greeting.txt", { lastModified: 1_700_000_000_000, type: "text/plain" });
        const copy = copyFile(original);

        expect(copy).toBeInstanceOf(File);
        expect(copy).not.toBe(original);
        expect(copy.name).toBe("greeting.txt");
        expect(copy.lastModified).toBe(1_700_000_000_000);
        expect(copy.type).toBe("text/plain");
        await expect(copy.text()).resolves.toBe("hello world");
    });
});

describe("deepClone with File input", () => {
    it("routes File instances through copyFile instead of degrading to a Blob", async () => {
        expect.assertions(5);

        const original = new File(["deep"], "data.bin", { lastModified: 42, type: "application/octet-stream" });
        const cloned = deepClone(original);

        expect(cloned).toBeInstanceOf(File);
        expect(cloned).not.toBe(original);
        expect(cloned.name).toBe("data.bin");
        expect(cloned.lastModified).toBe(42);
        await expect(cloned.text()).resolves.toBe("deep");
    });

    it("clones nested File values inside objects", () => {
        expect.assertions(2);

        const original = { upload: new File(["x"], "x.txt") };
        const cloned = deepClone(original);

        expect(cloned.upload).toBeInstanceOf(File);
        expect(cloned.upload.name).toBe("x.txt");
    });
});
