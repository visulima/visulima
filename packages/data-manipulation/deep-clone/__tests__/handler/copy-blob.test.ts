import { describe, expect, it } from "vitest";

import copyBlob from "../../src/handler/copy-blob";
import { deepClone } from "../../src/index";

describe(copyBlob, () => {
    it("creates a fresh Blob with the same bytes and content-type", async () => {
        expect.assertions(4);

        const original = new Blob(["hello world"], { type: "text/plain" });
        const copy = copyBlob(original);

        expect(copy).toBeInstanceOf(Blob);
        expect(copy).not.toBe(original);
        expect(copy.type).toBe("text/plain");
        await expect(copy.text()).resolves.toBe("hello world");
    });

    it("preserves size when slicing the whole blob", () => {
        expect.assertions(1);

        const original = new Blob([new Uint8Array([1, 2, 3, 4, 5])], { type: "application/octet-stream" });
        const copy = copyBlob(original);

        expect(copy.size).toBe(original.size);
    });
});

describe("deepClone with Blob input", () => {
    it("routes Blob instances through copyBlob", async () => {
        expect.assertions(3);

        const original = new Blob(["deep-clone"], { type: "text/markdown" });
        const cloned = deepClone(original);

        expect(cloned).toBeInstanceOf(Blob);
        expect(cloned).not.toBe(original);
        await expect(cloned.text()).resolves.toBe("deep-clone");
    });

    it("clones nested Blob values inside objects", async () => {
        expect.assertions(3);

        const original = { payload: new Blob(["x"], { type: "text/plain" }) };
        const cloned = deepClone(original);

        expect(cloned.payload).toBeInstanceOf(Blob);
        expect(cloned.payload).not.toBe(original.payload);
        await expect(cloned.payload.text()).resolves.toBe("x");
    });
});
