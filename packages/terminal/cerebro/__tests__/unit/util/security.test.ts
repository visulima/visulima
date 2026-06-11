import { describe, expect, it } from "vitest";

import { DEFAULT_MAX_ARGS, sanitizeArgument, sanitizeArguments } from "../../../src/util/security";

describe("security", () => {
    describe(sanitizeArgument, () => {
        it("should return the argument unchanged by default (no trimming)", () => {
            expect.assertions(1);

            const result = sanitizeArgument("  test  ");

            expect(result).toBe("  test  ");
        });

        it("should trim when the trim option is enabled", () => {
            expect.assertions(1);

            const result = sanitizeArgument("  test  ", { trim: true });

            expect(result).toBe("test");
        });

        it("should throw TypeError for non-string input", () => {
            expect.assertions(2);

            expect(() => sanitizeArgument(null as unknown as string)).toThrow(TypeError);
            expect(() => sanitizeArgument(123 as unknown as string)).toThrow(TypeError);
        });

        it("should not throw for ordinary long arguments under the generous default cap", () => {
            expect.assertions(1);

            const longArgument = "a".repeat(10_001);

            expect(() => sanitizeArgument(longArgument)).not.toThrow();
        });

        it("should throw Error for argument exceeding a configured max length", () => {
            expect.assertions(2);

            const longArgument = "a".repeat(11);

            expect(() => sanitizeArgument(longArgument, { maxArgumentLength: 10 })).toThrow(Error);
            expect(() => sanitizeArgument(longArgument, { maxArgumentLength: 10 })).toThrow("Argument is too long");
        });

        it("should allow disabling the length cap with Infinity", () => {
            expect.assertions(1);

            const longArgument = "a".repeat(2_000_000);

            expect(() => sanitizeArgument(longArgument, { maxArgumentLength: Number.POSITIVE_INFINITY })).not.toThrow();
        });

        it("should not reject dangerous characters by default", () => {
            expect.assertions(1);

            expect(() => sanitizeArgument("test;injection")).not.toThrow();
        });

        it("should reject dangerous characters when opted in (boolean shorthand)", () => {
            expect.assertions(2);

            expect(() => sanitizeArgument("test\ninjection", true)).toThrow(Error);
            expect(() => sanitizeArgument("test\ninjection", true)).toThrow("dangerous character");
        });

        it("should reject dangerous characters when opted in (options object)", () => {
            expect.assertions(1);

            expect(() => sanitizeArgument("test`injection", { checkDangerousChars: true })).toThrow(Error);
        });

        it("should accept valid characters", () => {
            expect.assertions(1);

            const result = sanitizeArgument("valid-argument_123");

            expect(result).toBe("valid-argument_123");
        });
    });

    describe(sanitizeArguments, () => {
        it("should preserve arguments verbatim by default", () => {
            expect.assertions(1);

            const result = sanitizeArguments(["  arg1  ", "arg2", "  arg3  "]);

            expect(result).toStrictEqual(["  arg1  ", "arg2", "  arg3  "]);
        });

        it("should throw TypeError for non-array input", () => {
            expect.assertions(2);

            expect(() => sanitizeArguments(null as unknown as ReadonlyArray<string>)).toThrow(TypeError);
            expect(() => sanitizeArguments("not-array" as unknown as ReadonlyArray<string>)).toThrow(TypeError);
        });

        it("should not throw for a few hundred arguments (glob expansion)", () => {
            expect.assertions(1);

            const manyArgs = Array.from({ length: 500 }, (_, index) => `arg${String(index)}`);

            expect(() => sanitizeArguments(manyArgs)).not.toThrow();
        });

        it("should throw Error when exceeding a configured argument count", () => {
            expect.assertions(2);

            const manyArgs = Array.from({ length: 6 }, (_, index) => `arg${String(index)}`);

            expect(() => sanitizeArguments(manyArgs, { maxArguments: 5 })).toThrow(Error);
            expect(() => sanitizeArguments(manyArgs, { maxArguments: 5 })).toThrow("Too many arguments");
        });

        it("should expose a generous default argument cap", () => {
            expect.assertions(1);

            expect(DEFAULT_MAX_ARGS).toBeGreaterThanOrEqual(10_000);
        });

        it("should propagate the dangerous-char check when opted in", () => {
            expect.assertions(1);

            expect(() => sanitizeArguments(["valid", "test\ninjection", "also-valid"], true)).toThrow(Error);
        });

        it("should handle empty array", () => {
            expect.assertions(1);

            const result = sanitizeArguments([]);

            expect(result).toStrictEqual([]);
        });
    });
});
