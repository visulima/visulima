import { describe, expect, it } from "vitest";

import type { OptionDefinition } from "../../../src/@types/command";
import mergeArguments from "../../../src/util/merge-arguments";

describe("util/merge-arguments", () => {
    it("should return single argument list it was the only one provided", () => {
        const singleArgumentList: OptionDefinition = { name: "test", required: true, type: String };

        const result = mergeArguments([singleArgumentList]);

        expect(result).toStrictEqual([{ name: "test", required: true, type: String }]);
    });

    it("should merge multiple argument lists without duplicates", () => {
        const firstArgumentList: OptionDefinition = { name: "test", required: true, type: String };
        const secondArgumentList: OptionDefinition = { name: "arg", required: false, type: Number };

        const result = mergeArguments([firstArgumentList, secondArgumentList]);

        expect(result).toStrictEqual([
            { name: "test", required: true, type: String },
            { name: "arg", required: false, type: Number },
        ]);
    });

    it("should merge multiple argument lists and overwrites duplicates", () => {
        const firstArgumentList: OptionDefinition = { name: "test", required: true, type: String };
        const secondArgumentList: OptionDefinition = { name: "test", required: false, type: Number };

        const result = mergeArguments([firstArgumentList, secondArgumentList]);

        expect(result).toStrictEqual([{ name: "test", required: false, type: Number }]);
    });
});
