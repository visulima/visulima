import { describe, expect, it } from "vitest";

import type { OptionDefinition } from "../../../../src/types/command";
import mapOptionTypeLabel from "../../../../src/util/arg-processing/map-option-type-label";

describe("map-option-type-label", () => {
    it("should return boolean option unchanged", () => {
        expect.assertions(1);

        const option: OptionDefinition = { name: "verbose", type: Boolean };

        const result = mapOptionTypeLabel(option);

        expect(result).toBe(option);
    });

    it("should add typeLabel for String option", () => {
        expect.assertions(1);

        const option: OptionDefinition = { name: "output", type: String };

        const result = mapOptionTypeLabel(option);

        expect(result.typeLabel).toBe("{underline string}");
    });

    it("should add typeLabel for Number option", () => {
        expect.assertions(1);

        const option: OptionDefinition = { name: "port", type: Number };

        const result = mapOptionTypeLabel(option);

        expect(result.typeLabel).toBe("{underline number}");
    });

    it("should add typeLabel with [] for multiple option", () => {
        expect.assertions(1);

        const option: OptionDefinition = { multiple: true, name: "files", type: String };

        const result = mapOptionTypeLabel(option);

        expect(result.typeLabel).toBe("{underline string[]}");
    });

    it("should add typeLabel with [] for lazyMultiple option", () => {
        expect.assertions(1);

        const option: OptionDefinition = { lazyMultiple: true, name: "files", type: String };

        const result = mapOptionTypeLabel(option);

        expect(result.typeLabel).toBe("{underline string[]}");
    });

    it("should add (D) suffix for defaultOption", () => {
        expect.assertions(1);

        const option: OptionDefinition = { defaultOption: true, name: "output", type: String };

        const result = mapOptionTypeLabel(option);

        expect(result.typeLabel).toBe("{underline string} (D)");
    });

    it("should add (R) suffix for required option", () => {
        expect.assertions(1);

        const option: OptionDefinition = { name: "input", required: true, type: String };

        const result = mapOptionTypeLabel(option);

        expect(result.typeLabel).toBe("{underline string} (R)");
    });

    it("should add both (D) and (R) suffixes", () => {
        expect.assertions(1);

        const option: OptionDefinition = { defaultOption: true, name: "output", required: true, type: String };

        const result = mapOptionTypeLabel(option);

        expect(result.typeLabel).toBe("{underline string} (D) (R)");
    });

    it("should use existing typeLabel if provided", () => {
        expect.assertions(1);

        const option: OptionDefinition = { name: "output", type: String, typeLabel: "custom label" };

        const result = mapOptionTypeLabel(option);

        expect(result.typeLabel).toBe("custom label");
    });

    it("should default to string for option without type", () => {
        expect.assertions(1);

        const option: OptionDefinition = { name: "test" };

        const result = mapOptionTypeLabel(option);

        expect(result.typeLabel).toBe("{underline string}");
    });
});
