import { describe, expect, it } from "vitest";

import type { OptionDefinition } from "../../../src/types/command";
import mergeArguments from "../../../src/util/data-processing/merge-arguments";

describe("util/merge-arguments", () => {
    it("should return single argument list it was the only one provided", () => {
        expect.assertions(1);

        const singleArgumentList: OptionDefinition<string> = { name: "test", required: true, type: String };

        const result = mergeArguments([singleArgumentList]);

        expect(result).toStrictEqual([{ name: "test", required: true, type: String }]);
    });

    it("should merge multiple argument lists without duplicates", () => {
        expect.assertions(1);

        const firstArgumentList: OptionDefinition<string> = { name: "test", required: true, type: String };
        const secondArgumentList: OptionDefinition<number> = { name: "arg", required: false, type: Number };

        const result = mergeArguments([firstArgumentList, secondArgumentList]);

        expect(result).toStrictEqual([
            { name: "test", required: true, type: String },
            { name: "arg", required: false, type: Number },
        ]);
    });

    it("should merge multiple argument lists and overwrites duplicates", () => {
        expect.assertions(1);

        const firstArgumentList: OptionDefinition<string> = { name: "test", required: true, type: String };
        const secondArgumentList: OptionDefinition<number> = { name: "test", required: false, type: Number };

        const result = mergeArguments([firstArgumentList, secondArgumentList]);

        expect(result).toStrictEqual([{ name: "test", required: false, type: Number }]);
    });
});
