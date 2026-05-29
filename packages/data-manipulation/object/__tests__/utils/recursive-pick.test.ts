import { describe, expect, it } from "vitest";

import recursivePick from "../../src/utils/recursive-pick";

type AnyRecord = Record<string, unknown>;

describe("recursive-pick", () => {
    it("returns the value unchanged when the input is not a plain object", () => {
        expect.assertions(1);

        const value = [1, 2, 3] as unknown as AnyRecord;

        expect(recursivePick(value, ["0"])).toBe(value);
    });

    it("keeps every property recursively when no picked keys are provided", () => {
        expect.assertions(1);

        const input: AnyRecord = { nested: { keep: 1 }, top: 2 };

        expect(recursivePick(input, [])).toStrictEqual({ nested: { keep: 1 }, top: 2 });
    });
});
