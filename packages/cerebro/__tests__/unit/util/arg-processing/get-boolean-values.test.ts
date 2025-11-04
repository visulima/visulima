import { describe, expect, it } from "vitest";

import type { OptionDefinition } from "../../../../src/types/command";
import getBooleanValues from "../../../../src/util/arg-processing/get-boolean-values";

describe("get-boolean-values", () => {
    it("should extract boolean value true from argument", () => {
        expect.assertions(1);

        const options: OptionDefinition[] = [{ alias: "v", name: "verbose", type: Boolean }];
        const args = ["--verbose", "true"];

        const result = getBooleanValues(args, options);

        expect(result.verbose).toBe(true);
    });

    it("should extract boolean value false from argument", () => {
        expect.assertions(1);

        const options: OptionDefinition[] = [{ name: "verbose", type: Boolean }];
        const args = ["--verbose", "false"];

        const result = getBooleanValues(args, options);

        expect(result.verbose).toBe(false);
    });

    it("should extract boolean value 1 as true", () => {
        expect.assertions(1);

        const options: OptionDefinition[] = [{ name: "verbose", type: Boolean }];
        const args = ["--verbose", "1"];

        const result = getBooleanValues(args, options);

        expect(result.verbose).toBe(true);
    });

    it("should extract boolean value 0 as false", () => {
        expect.assertions(1);

        const options: OptionDefinition[] = [{ name: "verbose", type: Boolean }];
        const args = ["--verbose", "0"];

        const result = getBooleanValues(args, options);

        expect(result.verbose).toBe(false);
    });

    it("should extract boolean value from equals assignment", () => {
        expect.assertions(1);

        const options: OptionDefinition[] = [{ name: "verbose", type: Boolean }];
        const args = ["--verbose=true"];

        const result = getBooleanValues(args, options);

        expect(result.verbose).toBe(true);
    });

    it("should extract boolean value from equals assignment with false", () => {
        expect.assertions(1);

        const options: OptionDefinition[] = [{ name: "verbose", type: Boolean }];
        const args = ["--verbose=false"];

        const result = getBooleanValues(args, options);

        expect(result.verbose).toBe(false);
    });

    it("should handle multiple boolean options", () => {
        expect.assertions(2);

        const options: OptionDefinition[] = [
            { name: "verbose", type: Boolean },
            { name: "debug", type: Boolean },
        ];
        const args = ["--verbose", "true", "--debug", "false"];

        const result = getBooleanValues(args, options);

        expect(result.verbose).toBe(true);
        expect(result.debug).toBe(false);
    });

    it("should not extract values for non-boolean options", () => {
        expect.assertions(1);

        const options: OptionDefinition[] = [{ name: "output", type: String }];
        const args = ["--output", "dist"];

        const result = getBooleanValues(args, options);

        expect(result.output).toBeUndefined();
    });

    it("should handle empty arguments", () => {
        expect.assertions(1);

        const options: OptionDefinition[] = [{ name: "verbose", type: Boolean }];
        const args: string[] = [];

        const result = getBooleanValues(args, options);

        expect(result).toStrictEqual({});
    });

    it("should extract value when it follows boolean option", () => {
        expect.assertions(1);

        const options: OptionDefinition[] = [
            { name: "verbose", type: Boolean },
            { name: "output", type: String },
        ];
        const args = ["--verbose", "true", "file.txt"];

        const result = getBooleanValues(args, options);

        expect(result.verbose).toBe(true);
    });
});
