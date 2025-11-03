import { describe, expect, it } from "vitest";

import CerebroError from "../../src/errors/cerebro-error";
import { validateCommandName, validateNonEmptyString, validateObject, validateStringArray } from "../../src/util/general/validate-input";

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

            expect(() => validateNonEmptyString(123 as any, "field")).toThrow(CerebroError);
            expect(() => validateNonEmptyString(null as any, "field")).toThrow(CerebroError);
            expect(() => validateNonEmptyString(undefined as any, "field")).toThrow(CerebroError);
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
