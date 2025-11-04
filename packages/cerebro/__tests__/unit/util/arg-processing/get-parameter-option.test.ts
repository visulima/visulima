import { describe, expect, it } from "vitest";

import type { OptionDefinition } from "../../../../src/types/command";
import getParameterOption from "../../../../src/util/arg-processing/get-parameter-option";

describe("get-parameter-option", () => {
    it("should extract option name from short flag", () => {
        expect.assertions(3);

        const options: OptionDefinition[] = [{ alias: "v", name: "verbose", type: Boolean }];
        const result = getParameterOption("-v", options);

        expect(result.argName).toBe("verbose");
        expect(result.option).toBeDefined();
        expect(result.argValue).toBeUndefined();
    });

    it("should extract option name from long flag", () => {
        expect.assertions(3);

        const options: OptionDefinition[] = [{ name: "verbose", type: Boolean }];
        const result = getParameterOption("--verbose", options);

        expect(result.argName).toBe("verbose");
        expect(result.option).toBeDefined();
        expect(result.argValue).toBeUndefined();
    });

    it("should extract option with value", () => {
        expect.assertions(3);

        const options: OptionDefinition[] = [{ alias: "o", name: "output", type: String }];
        const result = getParameterOption("--output=dist", options);

        expect(result.argName).toBe("output");
        expect(result.option).toBeDefined();
        expect(result.argValue).toBe("dist");
    });

    it("should extract option with value from short flag", () => {
        expect.assertions(3);

        const options: OptionDefinition[] = [{ alias: "o", name: "output", type: String }];
        const result = getParameterOption("-o=dist", options);

        expect(result.argName).toBe("output");
        expect(result.option).toBeDefined();
        expect(result.argValue).toBe("dist");
    });

    it("should return empty object for unknown option", () => {
        expect.assertions(3);

        const options: OptionDefinition[] = [{ name: "verbose", type: Boolean }];
        const result = getParameterOption("--unknown", options);

        expect(result.argName).toBeUndefined();
        expect(result.option).toBeUndefined();
        expect(result.argValue).toBeUndefined();
    });

    it("should return empty object for non-option argument", () => {
        expect.assertions(3);

        const options: OptionDefinition[] = [{ name: "verbose", type: Boolean }];
        const result = getParameterOption("filename", options);

        expect(result.argName).toBeUndefined();
        expect(result.option).toBeUndefined();
        expect(result.argValue).toBeUndefined();
    });

    it("should match alias over name when both exist", () => {
        expect.assertions(1);

        const options: OptionDefinition[] = [{ alias: "v", name: "verbose", type: Boolean }];
        const result = getParameterOption("-v", options);

        expect(result.argName).toBe("verbose");
    });
});
