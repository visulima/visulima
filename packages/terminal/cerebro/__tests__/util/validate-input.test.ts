import { describe, expect, it } from "vitest";

import CerebroError from "../../src/errors/cerebro-error";
import {
    validateCommandName,
    validateFunction,
    validateNonEmptyString,
    validateObject,
    validatePluginName,
    validateStringArray,
} from "../../src/util/general/validate-input";

describe("validate-input", () => {
    describe(validateNonEmptyString, () => {
        it("should return the string when valid", () => {
            expect.assertions(1);

            const result = validateNonEmptyString("test", "field");

            expect(result).toBe("test");
        });

        it("should trim whitespace", () => {
            expect.assertions(1);

            const result = validateNonEmptyString("  test  ", "field");

            expect(result).toBe("test");
        });

        it("should throw for empty string", () => {
            expect.assertions(2);

            expect(() => validateNonEmptyString("", "field")).toThrow(CerebroError);
            expect(() => validateNonEmptyString("", "field")).toThrow("field must be a non-empty string");
        });

        it("should throw for whitespace-only string", () => {
            expect.assertions(1);

            expect(() => validateNonEmptyString("   ", "field")).toThrow(CerebroError);
        });

        it("should throw for non-string values", () => {
            expect.assertions(3);

            expect(() => validateNonEmptyString(123, "field")).toThrow(CerebroError);
            expect(() => validateNonEmptyString(null, "field")).toThrow(CerebroError);
            expect(() => validateNonEmptyString(undefined as unknown as string, "field")).toThrow(CerebroError);
        });
    });

    describe(validateCommandName, () => {
        it("should accept valid command names", () => {
            expect.assertions(4);

            expect(validateCommandName("test")).toBe("test");
            expect(validateCommandName("test-command")).toBe("test-command");
            expect(validateCommandName("test_command")).toBe("test_command");
            expect(validateCommandName("Test123")).toBe("Test123");
        });

        it("should throw for invalid command names", () => {
            expect.assertions(4);

            expect(() => validateCommandName("-invalid")).toThrow(CerebroError);
            expect(() => validateCommandName("_invalid")).toThrow(CerebroError);
            expect(() => validateCommandName("invalid command")).toThrow(CerebroError);
            expect(() => validateCommandName("invalid@command")).toThrow(CerebroError);
        });

        it("should throw when the command name exceeds the maximum length", () => {
            expect.assertions(1);

            const tooLong = "a".repeat(101);

            expect(() => validateCommandName(tooLong)).toThrow("Command name is too long (maximum 100 characters)");
        });

        it("should throw for command names containing path-traversal or injection characters", () => {
            expect.assertions(6);

            expect(() => validateCommandName("foo..bar")).toThrow("contains invalid characters");
            expect(() => validateCommandName("foo/bar")).toThrow("contains invalid characters");
            expect(() => validateCommandName(String.raw`foo\bar`)).toThrow("contains invalid characters");
            expect(() => validateCommandName("foo;bar")).toThrow("contains invalid characters");
            expect(() => validateCommandName("foo|bar")).toThrow("contains invalid characters");
            expect(() => validateCommandName("foo&bar")).toThrow("contains invalid characters");
        });
    });

    describe(validatePluginName, () => {
        it("should accept valid plugin names", () => {
            expect.assertions(2);

            expect(validatePluginName("my-plugin")).toBe("my-plugin");
            expect(validatePluginName("Plugin_123")).toBe("Plugin_123");
        });

        it("should throw when the plugin name exceeds the maximum length", () => {
            expect.assertions(1);

            const tooLong = "p".repeat(101);

            expect(() => validatePluginName(tooLong)).toThrow("Plugin name is too long (maximum 100 characters)");
        });

        it("should throw for plugin names containing invalid characters", () => {
            expect.assertions(2);

            expect(() => validatePluginName("foo/bar")).toThrow("contains invalid characters");
            expect(() => validatePluginName("foo..bar")).toThrow("contains invalid characters");
        });

        it("should throw for plugin names that do not match the name pattern", () => {
            expect.assertions(2);

            expect(() => validatePluginName("-invalid")).toThrow("must start with a letter");
            expect(() => validatePluginName("123start")).toThrow("must start with a letter");
        });

        it("should throw for empty plugin names", () => {
            expect.assertions(1);

            expect(() => validatePluginName("")).toThrow("Plugin name must be a non-empty string");
        });
    });

    describe(validateFunction, () => {
        it("should return the function when valid", () => {
            expect.assertions(1);

            const handler = (): void => {};

            expect(validateFunction(handler, "handler")).toBe(handler);
        });

        it("should throw for non-function values", () => {
            expect.assertions(3);

            expect(() => validateFunction(123, "handler")).toThrow(CerebroError);
            expect(() => validateFunction(undefined, "handler")).toThrow("handler must be a function");
            expect(() => validateFunction({}, "handler")).toThrow(CerebroError);
        });
    });

    describe(validateObject, () => {
        it("should return the object when valid", () => {
            expect.assertions(1);

            const object = { test: "value" };
            const result = validateObject(object, "field");

            expect(result).toBe(object);
        });

        it("should throw for null", () => {
            expect.assertions(2);

            expect(() => validateObject(null, "field")).toThrow(CerebroError);
            expect(() => validateObject(null, "field")).toThrow("field must be an object");
        });

        it("should throw for undefined", () => {
            expect.assertions(1);

            expect(() => validateObject(undefined, "field")).toThrow(CerebroError);
        });

        it("should throw for non-objects", () => {
            expect.assertions(3);

            expect(() => validateObject("string", "field")).toThrow(CerebroError);
            expect(() => validateObject(123, "field")).toThrow(CerebroError);
            expect(() => validateObject(null, "field")).toThrow(CerebroError);
        });
    });

    describe(validateStringArray, () => {
        it("should return the array when valid", () => {
            expect.assertions(1);

            const array = ["test", "values"];
            const result = validateStringArray(array, "field");

            expect(result).toBe(array);
        });

        it("should throw for non-arrays", () => {
            expect.assertions(2);

            expect(() => validateStringArray("string", "field")).toThrow(CerebroError);
            expect(() => validateStringArray({}, "field")).toThrow(CerebroError);
        });

        it("should throw for arrays with non-strings", () => {
            expect.assertions(2);

            expect(() => validateStringArray(["string", 123], "field")).toThrow(CerebroError);
            expect(() => validateStringArray([null, undefined], "field")).toThrow(CerebroError);
        });
    });
});
