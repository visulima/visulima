import { describe, expect, it } from "vitest";

import getCleanClone from "../../src/utils/get-clean-clone";

const SAMPLE_REGEX = /abc/;

describe(getCleanClone, () => {
    it("returns a null-prototype object for a falsy input", () => {
        expect.assertions(2);

        const result = getCleanClone(undefined) as object;

        expect(result).not.toBeNull();
        expect(Object.getPrototypeOf(result)).toBeNull();
    });

    it("returns a plain object when the input is Object.prototype itself", () => {
        expect.assertions(2);

        const result = getCleanClone(Object.prototype) as object;

        expect(result).toStrictEqual({});
        expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    });

    it("instantiates native constructors directly", () => {
        expect.assertions(1);

        const result = getCleanClone(SAMPLE_REGEX) as object;

        expect(result).toBeInstanceOf(RegExp);
    });
});
