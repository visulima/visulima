import { describe, expect, it } from "vitest";

import recursiveOmit from "../../src/utils/recursive-omit";

type AnyRecord = Record<string, unknown>;

describe("recursive-omit", () => {
    it("returns a copy of the value unchanged when nothing matches", () => {
        expect.assertions(1);

        const value = { a: 1, b: 2 } as AnyRecord;

        expect(recursiveOmit(value, [])).toStrictEqual(value);
    });

    it("returns primitives unchanged", () => {
        expect.assertions(1);

        expect(recursiveOmit(42 as unknown as AnyRecord, [["a"]])).toBe(42);
    });

    it("traverses arrays and removes matching indexed paths", () => {
        expect.assertions(1);

        const value = { list: [{ keep: 1, secret: 2 }] } as AnyRecord;

        expect(recursiveOmit(value, [["list", "0", "secret"]])).toStrictEqual({ list: [{ keep: 1 }] });
    });
});
