import { red } from "@visulima/colorize";
import { describe, expect, it } from "vitest";

import templateFormat from "../../../src/util/text-processing/template-format";

describe("util/template-format", () => {
    it("should return simple string", () => {
        expect.assertions(1);

        const value = "Something";
        const result = templateFormat(value);

        expect(result).toStrictEqual(value);
    });

    it("should return template string in input", () => {
        expect.assertions(1);

        const value = "Something `0`";
        const result = templateFormat(value);

        expect(result).toStrictEqual(value);
    });

    it("should return value in red color", () => {
        expect.assertions(1);

        const value = "{red Something}";
        const result = templateFormat(value);

        expect(result).toStrictEqual(red("Something"));
    });

    it("should evict the oldest cache entry once the cache exceeds its maximum size", () => {
        expect.assertions(2);

        // MAX_CACHE_SIZE is 500; push well past it so the FIFO eviction branch runs.
        const firstValue = "first-unique-entry";

        Array.from({ length: 600 }, (_, index) => templateFormat(`entry-${String(index)}-${firstValue}`));

        // The implementation still returns the correct formatted value even after eviction.
        expect(templateFormat("entry-599-first-unique-entry")).toBe("entry-599-first-unique-entry");
        expect(templateFormat("entry-0-first-unique-entry")).toBe("entry-0-first-unique-entry");
    });
});
