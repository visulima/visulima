import { describe, expect, it } from "vitest";

import copyArrayBuffer from "../../src/handler/copy-array-buffer";

describe(copyArrayBuffer, () => {
    it("clones a plain ArrayBuffer with identical bytes", () => {
        expect.assertions(3);

        const original = new ArrayBuffer(8);
        const view = new Uint8Array(original);

        view.set([1, 2, 3, 4, 5, 6, 7, 8]);

        const cloned = copyArrayBuffer(original);

        expect(cloned).toBeInstanceOf(ArrayBuffer);
        expect(cloned).not.toBe(original);
        expect([...new Uint8Array(cloned as ArrayBuffer)]).toStrictEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    });

    it("clones a Uint8Array via the typed-array constructor lookup", () => {
        expect.assertions(3);

        const original = new Uint8Array([10, 20, 30, 40]);
        const cloned = copyArrayBuffer(original);

        expect(cloned).toBeInstanceOf(Uint8Array);
        expect(cloned).not.toBe(original);
        expect([...cloned]).toStrictEqual([10, 20, 30, 40]);
    });

    it("clones a Float64Array via the typed-array constructor lookup", () => {
        expect.assertions(2);

        const original = new Float64Array([1.5, 2.25, 3.125]);
        const cloned = copyArrayBuffer(original);

        expect(cloned).toBeInstanceOf(Float64Array);
        expect([...cloned]).toStrictEqual([1.5, 2.25, 3.125]);
    });

    it("clones a Buffer via the Buffer.from handler", () => {
        expect.assertions(2);

        const original = Buffer.from("hello");
        const cloned = copyArrayBuffer(original);

        expect(cloned).toBeInstanceOf(Buffer);
        expect(cloned.toString()).toBe("hello");
    });

    it("clones a BigInt64Array via the typed-array constructor lookup", () => {
        expect.assertions(2);

        const original = new BigInt64Array([1n, 2n, 3n]);
        const cloned = copyArrayBuffer(original);

        expect(cloned).toBeInstanceOf(BigInt64Array);
        expect([...cloned]).toStrictEqual([1n, 2n, 3n]);
    });
});
