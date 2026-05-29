import { describe, expect, it } from "vitest";

import recursiveOmit from "../../src/utils/recursive-omit";

type AnyRecord = Record<string, unknown>;

describe("recursive-omit", () => {
    it("returns the value unchanged when the input is not a plain object", () => {
        expect.assertions(1);

        const value = [1, 2, 3] as unknown as AnyRecord;

        expect(recursiveOmit(value, ["0"])).toBe(value);
    });
});
