import { describe, expect, it } from "vitest";

import { createPailError, PailError } from "../../src/error";

describe("pailError", () => {
    describe("constructor", () => {
        it("should create an error with a string message", () => {
            expect.assertions(5);

            const error = new PailError("Something went wrong");

            expect(error.message).toBe("Something went wrong");
            expect(error.name).toBe("PailError");
            expect(error.status).toBe(500);
            expect(error.why).toBeUndefined();
            expect(error.fix).toBeUndefined();
        });

        it("should create an error with full options", () => {
            expect.assertions(6);

            const error = new PailError({
                fix: "Retry with a different payment method",
                link: "https://docs.example.com/payments",
                message: "Payment failed",
                status: 402,
                why: "Card was declined",
            });

            expect(error.message).toBe("Payment failed");
            expect(error.status).toBe(402);
            expect(error.why).toBe("Card was declined");
            expect(error.fix).toBe("Retry with a different payment method");
            expect(error.link).toBe("https://docs.example.com/payments");
            expect(error.name).toBe("PailError");
        });

        it("should support a cause", () => {
            expect.assertions(2);

            const cause = new Error("Original error");
            const error = new PailError({
                cause,
                message: "Wrapper error",
            });

            expect(error.message).toBe("Wrapper error");
            expect(error.cause).toBe(cause);
        });

        it.each([
            { description: "empty string", value: "" },
            { description: "zero", value: 0 },
            { description: "false", value: false },
            { description: "null", value: null },
        ])("should preserve falsy cause: $description", ({ value }) => {
            expect.assertions(1);

            const error = new PailError({
                cause: value,
                message: "test",
            });

            expect(error.cause).toBe(value);
        });

        it("should not set cause when cause is undefined", () => {
            expect.assertions(1);

            const error = new PailError({
                cause: undefined,
                message: "test",
            });

            expect(error.cause).toBeUndefined();
        });

        it("should default status to 500", () => {
            expect.assertions(1);

            const error = new PailError({ message: "Server error" });

            expect(error.status).toBe(500);
        });

        it("should be an instance of Error", () => {
            expect.assertions(2);

            const error = new PailError("test");

            expect(error).toBeInstanceOf(Error);
            expect(error).toBeInstanceOf(PailError);
        });

        it("should have a stack trace", () => {
            expect.assertions(1);

            const error = new PailError("test");

            expect(error.stack).toBeDefined();
        });
    });

    describe("toJSON", () => {
        it("should serialize basic fields", () => {
            expect.assertions(1);

            const error = new PailError({ message: "test", status: 404 });
            const json = error.toJSON();

            expect(json).toStrictEqual(
                expect.objectContaining({
                    message: "test",
                    name: "PailError",
                    status: 404,
                }),
            );
        });

        it("should include why, fix, link when set", () => {
            expect.assertions(4);

            const error = new PailError({
                fix: "do this",
                link: "https://example.com",
                message: "test",
                why: "because",
            });
            const json = error.toJSON();

            expect(json.why).toBe("because");
            expect(json.fix).toBe("do this");
            expect(json.link).toBe("https://example.com");
            expect(json.stack).toBeDefined();
        });

        it("should include cause when set", () => {
            expect.assertions(1);

            const cause = new Error("root cause");
            const error = new PailError({ cause, message: "test" });
            const json = error.toJSON();

            expect(json.cause).toStrictEqual(
                expect.objectContaining({
                    message: "root cause",
                    name: "Error",
                }),
            );
        });

        it("should handle non-Error cause", () => {
            expect.assertions(1);

            const error = new PailError({ cause: "string cause", message: "test" });
            const json = error.toJSON();

            expect(json.cause).toBe("string cause");
        });

        it.each([
            { description: "empty string", value: "" },
            { description: "zero", value: 0 },
            { description: "false", value: false },
            { description: "null", value: null },
        ])("should include falsy cause in JSON: $description", ({ value }) => {
            expect.assertions(1);

            const error = new PailError({ cause: value, message: "test" });
            const json = error.toJSON();

            expect(json.cause).toBe(value);
        });

        it("should omit undefined optional fields", () => {
            expect.assertions(3);

            const error = new PailError("simple error");
            const json = error.toJSON();

            expect(json.why).toBeUndefined();
            expect(json.fix).toBeUndefined();
            expect(json.link).toBeUndefined();
        });

        it("should omit the stack when the error has no stack", () => {
            expect.assertions(2);

            const error = new PailError("no stack error");

            error.stack = undefined;

            const json = error.toJSON();

            expect(json.stack).toBeUndefined();
            expect(json.message).toBe("no stack error");
        });
    });

    describe("toString", () => {
        it("should format basic error", () => {
            expect.assertions(1);

            const error = new PailError({ message: "test", status: 400 });

            expect(error.toString()).toBe("PailError [400]: test");
        });

        it("should include why, fix, link, and cause", () => {
            expect.assertions(1);

            const error = new PailError({
                cause: new Error("root"),
                fix: "fix it",
                link: "https://example.com",
                message: "test",
                status: 500,
                why: "because",
            });
            const result = error.toString();

            expect(result).toBe("PailError [500]: test\n  Why: because\n  Fix: fix it\n  Link: https://example.com\n  Cause: root");
        });

        it("should handle non-Error cause in toString", () => {
            expect.assertions(1);

            const error = new PailError({ cause: "string cause", message: "test" });

            expect(error.toString()).toContain("Cause: string cause");
        });

        it.each([
            { description: "zero", expected: "Cause: 0", value: 0 },
            { description: "false", expected: "Cause: false", value: false },
            { description: "empty string", expected: "Cause: ", value: "" },
            { description: "null", expected: "Cause: null", value: null },
        ])("should include falsy cause in toString: $description", ({ expected, value }) => {
            expect.assertions(1);

            const error = new PailError({ cause: value, message: "test" });

            expect(error.toString()).toContain(expected);
        });
    });

    describe(createPailError, () => {
        it("should create a PailError from a string", () => {
            expect.assertions(2);

            const error = createPailError("quick error");

            expect(error).toBeInstanceOf(PailError);
            expect(error.message).toBe("quick error");
        });

        it("should create a PailError from options", () => {
            expect.assertions(3);

            const error = createPailError({
                message: "detailed error",
                status: 401,
                why: "unauthorized",
            });

            expect(error).toBeInstanceOf(PailError);
            expect(error.status).toBe(401);
            expect(error.why).toBe("unauthorized");
        });
    });
});
