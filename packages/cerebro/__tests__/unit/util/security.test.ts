import { describe, expect, it } from "vitest";

import { RateLimiter, sanitizeArgument, sanitizeArguments, validateSafePath } from "../../../src/util/security";

describe("security", () => {
    describe(sanitizeArgument, () => {
        it("should return trimmed string for valid argument", () => {
            expect.assertions(1);

            const result = sanitizeArgument("  test  ");

            expect(result).toBe("test");
        });

        it("should throw TypeError for non-string input", () => {
            expect.assertions(2);

            expect(() => sanitizeArgument(null as unknown as string)).toThrow(TypeError);
            expect(() => sanitizeArgument(123 as unknown as string)).toThrow(TypeError);
        });

        it("should throw Error for argument exceeding max length", () => {
            expect.assertions(2);

            const longArgument = "a".repeat(10_001);

            expect(() => sanitizeArgument(longArgument)).toThrow(Error);
            expect(() => sanitizeArgument(longArgument)).toThrow("Argument is too long");
        });

        it("should throw Error for argument containing newline", () => {
            expect.assertions(2);

            expect(() => sanitizeArgument("test\ninjection")).toThrow(Error);
            expect(() => sanitizeArgument("test\ninjection")).toThrow("dangerous character");
        });

        it("should throw Error for argument containing carriage return", () => {
            expect.assertions(1);

            expect(() => sanitizeArgument("test\rinjection")).toThrow(Error);
        });

        it("should throw Error for argument containing tab", () => {
            expect.assertions(1);

            expect(() => sanitizeArgument("test\tinjection")).toThrow(Error);
        });

        it("should throw Error for argument containing dollar sign", () => {
            expect.assertions(1);

            expect(() => sanitizeArgument("test$injection")).toThrow(Error);
        });

        it("should throw Error for argument containing backtick", () => {
            expect.assertions(1);

            expect(() => sanitizeArgument("test`injection")).toThrow(Error);
        });

        it("should throw Error for argument containing semicolon", () => {
            expect.assertions(1);

            expect(() => sanitizeArgument("test;injection")).toThrow(Error);
        });

        it("should accept valid characters", () => {
            expect.assertions(1);

            const result = sanitizeArgument("valid-argument_123");

            expect(result).toBe("valid-argument_123");
        });
    });

    describe(sanitizeArguments, () => {
        it("should sanitize array of valid arguments", () => {
            expect.assertions(1);

            const result = sanitizeArguments(["  arg1  ", "arg2", "  arg3  "]);

            expect(result).toStrictEqual(["arg1", "arg2", "arg3"]);
        });

        it("should throw TypeError for non-array input", () => {
            expect.assertions(2);

            expect(() => sanitizeArguments(null as unknown as ReadonlyArray<string>)).toThrow(TypeError);
            expect(() => sanitizeArguments("not-array" as unknown as ReadonlyArray<string>)).toThrow(TypeError);
        });

        it("should throw Error for too many arguments", () => {
            expect.assertions(2);

            const manyArgs = Array.from({ length: 101 }, (_, i) => `arg${i}`);

            expect(() => sanitizeArguments(manyArgs)).toThrow(Error);
            expect(() => sanitizeArguments(manyArgs)).toThrow("Too many arguments");
        });

        it("should throw Error when any argument contains dangerous character", () => {
            expect.assertions(1);

            expect(() => sanitizeArguments(["valid", "test\ninjection", "also-valid"])).toThrow(Error);
        });

        it("should handle empty array", () => {
            expect.assertions(1);

            const result = sanitizeArguments([]);

            expect(result).toStrictEqual([]);
        });
    });

    describe(validateSafePath, () => {
        it("should return trimmed path for valid relative path", () => {
            expect.assertions(1);

            const result = validateSafePath("  path/to/file  ");

            expect(result).toBe("path/to/file");
        });

        it("should throw TypeError for non-string input", () => {
            expect.assertions(2);

            expect(() => validateSafePath(null as unknown as string)).toThrow(TypeError);
            expect(() => validateSafePath(123 as unknown as string)).toThrow(TypeError);
        });

        it("should throw Error for path containing directory traversal", () => {
            expect.assertions(2);

            expect(() => validateSafePath("../etc/passwd")).toThrow(Error);
            expect(() => validateSafePath("../etc/passwd")).toThrow("directory traversal");
        });

        it("should throw Error for path containing ..", () => {
            expect.assertions(1);

            expect(() => validateSafePath("path/../file")).toThrow(Error);
        });

        it("should throw Error for path containing ..\\", () => {
            expect.assertions(1);

            expect(() => validateSafePath(String.raw`path\..\file`)).toThrow(Error);
        });

        it("should throw Error for absolute Unix path", () => {
            expect.assertions(2);

            expect(() => validateSafePath("/etc/passwd")).toThrow(Error);
            expect(() => validateSafePath("/etc/passwd")).toThrow("Absolute paths are not allowed");
        });

        it("should throw Error for absolute Windows path", () => {
            expect.assertions(1);

            expect(() => validateSafePath(String.raw`C:\Windows\System32`)).toThrow(Error);
        });

        it("should throw Error for path exceeding max length", () => {
            expect.assertions(2);

            const longPath = "a".repeat(1001);

            expect(() => validateSafePath(longPath)).toThrow(Error);
            expect(() => validateSafePath(longPath)).toThrow("Path is too long");
        });

        it("should accept valid relative paths", () => {
            expect.assertions(2);

            expect(validateSafePath("path/to/file")).toBe("path/to/file");
            expect(validateSafePath("subdirectory/file.txt")).toBe("subdirectory/file.txt");
        });
    });

    describe(RateLimiter, () => {
        it("should allow requests within limit", () => {
            expect.assertions(5);

            const limiter = new RateLimiter(5, 1000);

            expect(limiter.checkLimit("key1")).toBe(true);
            expect(limiter.checkLimit("key1")).toBe(true);
            expect(limiter.checkLimit("key1")).toBe(true);
            expect(limiter.checkLimit("key1")).toBe(true);
            expect(limiter.checkLimit("key1")).toBe(true);
        });

        it("should block requests exceeding limit", () => {
            expect.assertions(2);

            const limiter = new RateLimiter(3, 1000);

            limiter.checkLimit("key1");
            limiter.checkLimit("key1");
            limiter.checkLimit("key1");

            expect(limiter.checkLimit("key1")).toBe(false);
            expect(limiter.checkLimit("key1")).toBe(false);
        });

        it("should track different keys independently", () => {
            expect.assertions(2);

            const limiter = new RateLimiter(2, 1000);

            limiter.checkLimit("key1");
            limiter.checkLimit("key1");

            expect(limiter.checkLimit("key1")).toBe(false);
            expect(limiter.checkLimit("key2")).toBe(true);
        });

        it("should reset after time window", async () => {
            expect.assertions(3);

            const limiter = new RateLimiter(2, 100);

            limiter.checkLimit("key1");
            limiter.checkLimit("key1");

            expect(limiter.checkLimit("key1")).toBe(false);

            await new Promise((resolve) => {
                setTimeout(resolve, 150);
            });

            expect(limiter.checkLimit("key1")).toBe(true);
            expect(limiter.checkLimit("key1")).toBe(true);
        });

        it("should allow reset of specific key", () => {
            expect.assertions(3);

            const limiter = new RateLimiter(2, 1000);

            limiter.checkLimit("key1");
            limiter.checkLimit("key1");

            expect(limiter.checkLimit("key1")).toBe(false);

            limiter.reset("key1");

            expect(limiter.checkLimit("key1")).toBe(true);
            expect(limiter.checkLimit("key1")).toBe(true);
        });

        it("should throw Error for invalid maxAttempts", () => {
            expect.assertions(2);

            expect(() => new RateLimiter(0, 1000)).toThrow(Error);
            expect(() => new RateLimiter(-1, 1000)).toThrow(Error);
        });

        it("should throw Error for invalid windowMs", () => {
            expect.assertions(2);

            expect(() => new RateLimiter(5, 0)).toThrow(Error);
            expect(() => new RateLimiter(5, -1)).toThrow(Error);
        });

        it("should use default values when not provided", () => {
            expect.assertions(6);

            const limiter = new RateLimiter();

            // Default maxAttempts is 5
            for (let i = 0; i < 5; i++) {
                expect(limiter.checkLimit("key1")).toBe(true);
            }

            expect(limiter.checkLimit("key1")).toBe(false);
        });

        it("should cleanup expired entries", async () => {
            expect.assertions(2);

            const limiter = new RateLimiter(2, 50);

            limiter.checkLimit("key1");
            limiter.checkLimit("key2");

            await new Promise((resolve) => {
                setTimeout(resolve, 100);
            });

            // New check should trigger cleanup and allow new entries
            expect(limiter.checkLimit("key3")).toBe(true);
            expect(limiter.checkLimit("key3")).toBe(true);
        });
    });
});
