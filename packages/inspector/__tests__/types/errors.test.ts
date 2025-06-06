import { describe, expect, it } from "vitest";

import { inspect } from "../../src";

describe("inspect with Errors", () => {
    it("should return just the error name for an empty Error object", () => {
        expect.assertions(1);

        // eslint-disable-next-line unicorn/error-message
        expect(inspect(new Error())).toBe("Error");
    });

    it("should correctly inspect various Error subclasses", () => {
        expect.assertions(3);

        // eslint-disable-next-line unicorn/error-message
        expect(inspect(new TypeError())).toBe("TypeError");
        // eslint-disable-next-line unicorn/error-message
        expect(inspect(new SyntaxError())).toBe("SyntaxError");
        // eslint-disable-next-line unicorn/error-message
        expect(inspect(new ReferenceError())).toBe("ReferenceError");
    });

    it("should include the message for an Error with a message", () => {
        expect.assertions(1);

        expect(inspect(new Error("message"))).toBe("Error: message");
    });

    describe("with non-standard properties", () => {
        it("should append non-standard properties to the output", () => {
            expect.assertions(1);

            const error = new Error("message") as Error & { code: number };

            error.code = 404;

            expect(inspect(error)).toBe("Error: message { code: 404 }");
        });

        it("should correctly inspect a non-string message property", () => {
            expect.assertions(1);

            const error = new Error("message") as Error & { message: { code: number } };

            // @ts-expect-error - testing non-standard property
            error.message = { code: 404 };

            expect(inspect(error)).toBe("Error { message: { code: 404 } }");
        });

        it("should detect and handle circular references", () => {
            expect.assertions(1);

            const error = new Error("message") as Error & { fluff: Error };

            error.fluff = error;

            expect(inspect(error)).toBe("Error: message { fluff: [Circular] }");
        });
    });

    describe("with built-in properties", () => {
        it("should correctly inspect the 'cause' property", () => {
            expect.assertions(1);

            const error = new Error("message");

            error.cause = new Error("i caused you");

            expect(inspect(error)).toBe("Error: message { cause: Error: i caused you }");
        });
    });
});
