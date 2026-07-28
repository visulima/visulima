import { describe, expect, it } from "vitest";

import recursivePick from "../../src/utils/recursive-pick";

type AnyRecord = Record<string, unknown>;

describe("recursive-pick", () => {
    it("returns primitives unchanged", () => {
        expect.assertions(1);

        expect(recursivePick(42 as unknown as AnyRecord, [["a"]])).toBe(42);
    });

    it("picks nothing when no picked keys are provided", () => {
        expect.assertions(1);

        const input: AnyRecord = { nested: { keep: 1 }, top: 2 };

        expect(recursivePick(input, [])).toStrictEqual({});
    });

    it("traverses arrays and keeps only matching indexed paths", () => {
        expect.assertions(1);

        const input: AnyRecord = { list: [{ keep: 1, secret: 2 }] };

        expect(recursivePick(input, [["list", "0", "keep"]])).toStrictEqual({ list: [{ keep: 1 }] });
    });
});
