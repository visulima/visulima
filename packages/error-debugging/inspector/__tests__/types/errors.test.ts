import { describe, expect, it } from "vitest";

import { inspect } from "../../src";

describe("errors", () => {
    it("returns `Error` for an empty Error", () => {
        expect.assertions(1);

        // eslint-disable-next-line unicorn/error-message
        expect(inspect(new Error())).toBe("Error");
    });

    it("also works with Error subclasses (TypeError)", () => {
        expect.assertions(1);

        // eslint-disable-next-line unicorn/error-message
        expect(inspect(new TypeError())).toBe("TypeError");
    });

    it("also works with Error subclasses (SyntaxError)", () => {
        expect.assertions(1);

        // eslint-disable-next-line unicorn/error-message
        expect(inspect(new SyntaxError())).toBe("SyntaxError");
    });

    it("also works with Error subclasses (ReferenceError)", () => {
        expect.assertions(1);

        // eslint-disable-next-line unicorn/error-message
        expect(inspect(new ReferenceError())).toBe("ReferenceError");
    });

    it("returns `Error{\"message\"}` for an Error(\"message\")", () => {
        expect.assertions(1);

        expect(inspect(new Error("message"))).toBe("Error: message");
    });

    describe("non-standard properties", () => {
        it("adds non standard properties to end of output", () => {
            expect.assertions(1);

            const error = new Error("message") as Error & { code: number };

            error.code = 404;

            expect(inspect(error)).toBe("Error: message { code: 404 }");
        });

        it("will properly inspect a non-string message property", () => {
            expect.assertions(1);

            const error = new Error("message") as Error & { message: { code: number } };

            // @ts-expect-error - testing non-standard property
            error.message = { code: 404 };

            expect(inspect(error)).toBe("Error { message: { code: 404 } }");
        });

        it("detects circular references", () => {
            expect.assertions(1);

            const error = new Error("message") as Error & { fluff: Error };

            error.fluff = error;

            expect(inspect(error)).toBe("Error: message { fluff: [Circular] }");
        });
    });

    describe("ignores built in properties", () => {
        it("does not add property to output", () => {
            expect.assertions(1);

            const error = new Error("message");

            error.cause = new Error("i caused you");

            expect(inspect(error)).toBe("Error: message { cause: Error: i caused you }");
        });
    });
});
