import { describe, expect,it } from "vitest";

import getType from "../../src/util/get-type";

describe("getType", () => {
    it.each([
        [undefined, "Undefined"],
        [null, "Null"],
        [true, "Boolean"],
        [5, "Number"],
        ["hello", "String"],
        [Symbol("hello"), "Symbol"],
        [() => {}, "Function"],
        [new Date(), "Date"],
        // eslint-disable-next-line unicorn/error-message
        [new Error(), "Error"],
        // eslint-disable-next-line unicorn/error-message
        [new TypeError(), "Error"],
        // eslint-disable-next-line unicorn/error-message
        [new EvalError(), "Error"],
    ])("should return the correct type %s", (value: any, type: string) => {
        const result = getType(value);

        expect(result).toBe(type);
    });
});
