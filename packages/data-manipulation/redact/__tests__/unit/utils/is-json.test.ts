import { describe, expect, it } from "vitest";

import isJson from "../../../src/utils/is-json";

describe(isJson, () => {
    it.each([5, "5", "true", "null", "{}", "{\"foo\": \"bar\"}", "[1, 2, 3]", "{\"foo\": \"bar\", \"baz\": \"qux\"}"])("should return true for valid JSON", (value) => {
        expect.assertions(1);

        expect(isJson(value)).toBe(true);
    });

    // eslint-disable-next-line no-void
    it.each(["NaN", "[", "{", "]", "}", "[{", "]}", "{[", "}]", void 0, Number.NaN, function noop() {}, [], {}, "{a\":5}"])(
        "should return false for invalid JSON %s",
        (value) => {
            expect.assertions(1);

            expect(isJson(value)).toBe(false);
        },
    );
});
