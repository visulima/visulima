import { describe, expect, it } from "vitest";

import type { OptionDefinition } from "../../../../src/types/command";
import isBoolean from "../../../../src/util/arg-processing/option-is-boolean";

describe("option-is-boolean", () => {
    it("should return true for Boolean type option", () => {
        expect.assertions(1);

        const option: OptionDefinition = { name: "verbose", type: Boolean };

        expect(isBoolean(option)).toBe(true);
    });

    it("should return false for String type option", () => {
        expect.assertions(1);

        const option: OptionDefinition = { name: "output", type: String };

        expect(isBoolean(option)).toBe(false);
    });

    it("should return false for Number type option", () => {
        expect.assertions(1);

        const option: OptionDefinition = { name: "port", type: Number };

        expect(isBoolean(option)).toBe(false);
    });

    it("should return false for option without type", () => {
        expect.assertions(1);

        const option: OptionDefinition = { name: "test" };

        expect(isBoolean(option)).toBe(false);
    });

    it("should return false for option with undefined type", () => {
        expect.assertions(1);

        const option: OptionDefinition = { name: "test", type: undefined };

        expect(isBoolean(option)).toBe(false);
    });
});
