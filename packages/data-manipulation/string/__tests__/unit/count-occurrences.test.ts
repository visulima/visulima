/* eslint-disable e18e/prefer-static-regex */
import { describe, expect, it } from "vitest";

import { countOccurrences } from "../../src/count-occurrences";

describe("countOccurrences function", () => {
    it("should coerce value to string", () => {
        expect.assertions(1);

        // @ts-expect-error: incorrect value.
        expect(countOccurrences(true, "t")).toBe(1);
    });

    it("should throw when substring is invalid", () => {
        expect.assertions(1);

        expect(() => {
            // @ts-expect-error: incorrect value.
            countOccurrences("test", 0);
        }).toThrow(/Expected character/);
    });

    it("should return 0 for empty source string", () => {
        expect.assertions(1);

        expect(countOccurrences("", "f")).toBe(0);
    });

    it("should throw when substring is empty", () => {
        expect.assertions(1);

        expect(() => {
            countOccurrences("test", "");
        }).toThrow(/Expected non-empty substring/);
    });

    it("should count single character occurrences", () => {
        expect.assertions(1);

        expect(countOccurrences("foo", "o")).toBe(2);
    });

    it("should count multiple occurrences", () => {
        expect.assertions(1);

        expect(countOccurrences("fo fooo fo", "o")).toBe(5);
    });

    it("should count all occurrences when substring repeats", () => {
        expect.assertions(1);

        expect(countOccurrences("ooo", "o")).toBe(3);
    });

    it("should handle Unicode characters", () => {
        expect.assertions(1);

        expect(countOccurrences("a🤔b🤔c", "🤔")).toBe(2);
    });
});
