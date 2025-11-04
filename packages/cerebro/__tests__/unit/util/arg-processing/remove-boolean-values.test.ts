import { describe, expect, it } from "vitest";

import type { OptionDefinition } from "../../../../src/types/command";
import removeBooleanValues from "../../../../src/util/arg-processing/remove-boolean-values";

describe("remove-boolean-values", () => {
    it("should remove boolean flag when followed by boolean value", () => {
        expect.assertions(1);

        const options: OptionDefinition[] = [{ alias: "v", name: "verbose", type: Boolean }];
        // The function removes the flag (not the value) when value follows
        const args = ["--verbose", "true", "file.txt"];

        const result = removeBooleanValues(args, options);

        expect(result).toStrictEqual(["file.txt"]);
    });

    it("should remove boolean flag alias when followed by boolean value", () => {
        expect.assertions(1);

        const options: OptionDefinition[] = [{ alias: "v", name: "verbose", type: Boolean }];
        // The function removes the flag (not the value) when value follows
        const args = ["-v", "true", "file.txt"];

        const result = removeBooleanValues(args, options);

        expect(result).toStrictEqual(["file.txt"]);
    });

    it("should remove boolean flag when followed by 1", () => {
        expect.assertions(1);

        const options: OptionDefinition[] = [{ name: "verbose", type: Boolean }];
        const args = ["--verbose", "1", "file.txt"];

        const result = removeBooleanValues(args, options);

        expect(result).toStrictEqual(["file.txt"]);
    });

    it("should remove boolean flag when followed by false", () => {
        expect.assertions(1);

        const options: OptionDefinition[] = [{ name: "verbose", type: Boolean }];
        const args = ["--verbose", "false", "file.txt"];

        const result = removeBooleanValues(args, options);

        expect(result).toStrictEqual(["file.txt"]);
    });

    it("should remove boolean flag when followed by 0", () => {
        expect.assertions(1);

        const options: OptionDefinition[] = [{ name: "verbose", type: Boolean }];
        const args = ["--verbose", "0", "file.txt"];

        const result = removeBooleanValues(args, options);

        expect(result).toStrictEqual(["file.txt"]);
    });

    it("should not remove non-boolean values", () => {
        expect.assertions(1);

        const options: OptionDefinition[] = [{ name: "output", type: String }];
        const args = ["--output", "dist", "file.txt"];

        const result = removeBooleanValues(args, options);

        expect(result).toStrictEqual(["--output", "dist", "file.txt"]);
    });

    it("should remove boolean option with equals assignment", () => {
        expect.assertions(1);

        const options: OptionDefinition[] = [{ name: "verbose", type: Boolean }];
        // Equals assignment format removes the flag entirely
        const args = ["--verbose=true", "file.txt"];

        const result = removeBooleanValues(args, options);

        expect(result).toStrictEqual(["file.txt"]);
    });

    it("should handle empty arguments", () => {
        expect.assertions(1);

        const options: OptionDefinition[] = [{ name: "verbose", type: Boolean }];
        const args: string[] = [];

        const result = removeBooleanValues(args, options);

        expect(result).toStrictEqual([]);
    });

    it("should handle multiple boolean options", () => {
        expect.assertions(1);

        const options: OptionDefinition[] = [
            { name: "verbose", type: Boolean },
            { name: "debug", type: Boolean },
        ];
        // Both flags are removed when followed by boolean values
        const args = ["--verbose", "true", "--debug", "false", "file.txt"];

        const result = removeBooleanValues(args, options);

        expect(result).toStrictEqual(["file.txt"]);
    });
});
