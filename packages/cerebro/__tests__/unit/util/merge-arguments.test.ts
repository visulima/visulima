import { describe, it, expect } from "vitest";

import type { OptionDefinition } from "../../../src/@types/command";
import mergeArguments from "../../../src/util/merge-arguments";

describe("util/merge-arguments", () => {
    it("should return single argument list it was the only one provided", () => {
        const singleArgumentList: OptionDefinition = { name: "test", type: String, required: true };

        const result = mergeArguments([singleArgumentList]);

        expect(result).toEqual([{ name: "test", type: String, required: true }]);
    });

    it("should merge multiple argument lists without duplicates", () => {
        const firstArgumentList: OptionDefinition = { name: "test", type: String, required: true };
        const secondArgumentList: OptionDefinition = { name: "arg", type: Number, required: false };

        const result = mergeArguments([firstArgumentList, secondArgumentList]);

        expect(result).toEqual([
            { name: "test", type: String, required: true },
            { name: "arg", type: Number, required: false },
        ]);
    });

    it("should merge multiple argument lists and overwrites duplicates", () => {
        const firstArgumentList: OptionDefinition = { name: "test", type: String, required: true };
        const secondArgumentList: OptionDefinition = { name: "test", type: Number, required: false };

        const result = mergeArguments([firstArgumentList, secondArgumentList]);

        expect(result).toEqual([{ name: "test", type: Number, required: false }]);
    });
});
