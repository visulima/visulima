import { describe, expect, it, vi } from "vitest";

import { VisulimaError } from "../../../src";
import { renderError } from "../../../src/error/render/error";

const hoisted = vi.hoisted(() => {
    return {
        existsSync: vi.fn().mockReturnValue(true),
    };
});

vi.mock(import("node:fs"), async () => {
    const original = await vi.importActual("node:fs");

    return {
        ...original,
        existsSync: hoisted.existsSync,
    };
});

describe(renderError, () => {
    it("should render error message with default options", () => {
        expect.assertions(1);

        const error = new Error("This is an example error message");
        const errorOutput = renderError(error);

        expect(errorOutput).toContain("Error: This is an example error message");
    });

    it("should render error message with custom color options", () => {
        expect.assertions(1);

        const error = new Error("This is an example error message");
        const options = {
            color: {
                fileLine: (value: string) => `\u001B[35m${value}\u001B[39m`,
                hint: (value: string) => `\u001B[33m${value}\u001B[39m`,
                method: (value: string) => `\u001B[36m${value}\u001B[39m`,
                title: (value: string) => `\u001B[31m${value}\u001B[39m`,
            },
        };
        const errorOutput = renderError(error, options);

        expect(errorOutput).toContain("\u001B[31mError: This is an example error message\u001B[39m");
    });

    it("should render error message with short file paths", () => {
        expect.assertions(1);

        const error = new Error("This is an example error message");
        const options = { displayShortPath: true };
        const errorOutput = renderError(error, options);

        expect(errorOutput).toContain("at ");
    });

    it("should render error message with limited stack frames", () => {
        expect.assertions(1);

        const error = new Error("This is an example error message");

        const errorOutput = renderError(error, { framesMaxLimit: 1, hideErrorCodeView: true });
        const stackFrames = (errorOutput.match(/at <unknown> /g) as RegExpMatchArray).length;

        expect(stackFrames).toBeLessThanOrEqual(2);
    });

    it("should render error message with hidden error title", () => {
        expect.assertions(1);

        const error = new Error("This is an example error message");
        const options = { hideErrorTitle: true };
        const errorOutput = renderError(error, options);

        expect(errorOutput).not.toContain("Error:");
    });

    it("should render error message when stack trace is empty", () => {
        expect.assertions(1);

        const error = new Error("This is an example error message");

        vi.spyOn(error, "stack", "get").mockReturnValue("");

        const errorOutput = renderError(error);

        expect(errorOutput).toContain("Error: This is an example error message");
    });

    it("should render error message when file does not exist", () => {
        expect.assertions(1);

        const error = new Error("This is an example error message");

        hoisted.existsSync.mockReturnValue(false);

        const errorOutput = renderError(error);

        expect(errorOutput).toContain("Error: This is an example error message");
    });

    it("should render error message when error has no hint", () => {
        expect.assertions(1);

        const visulimaError = new VisulimaError({ hint: undefined, message: "This is an example error message", name: "Error" });
        const errorOutput = renderError(visulimaError, {
            hideErrorCodeView: true,
        });

        expect(errorOutput).not.toContain("Hint:");
    });

    it("should render error message when error has no cause", () => {
        expect.assertions(1);

        const visulimaError = new VisulimaError({ cause: undefined, message: "This is an example error message", name: "Error" });
        const errorOutput = renderError(visulimaError, {
            hideErrorCodeView: true,
        });

        expect(errorOutput).not.toContain("Caused by:");
    });

    it("should render error without code view", () => {
        expect.assertions(1);

        const error = new Error("This is an example error message");
        const errorOutput = renderError(error, {
            hideErrorCodeView: true,
        });

        expect(errorOutput).not.toContain("const errorOutput = renderError(error,");
    });

    it("should render error without cause code view", () => {
        expect.assertions(1);

        const error = new Error("This is an example error message", {
            cause: new Error("This is an example cause error message"),
        });
        const errorOutput = renderError(error, {
            hideErrorCauseCodeView: true,
        });

        const found = (errorOutput.match(/This is an example cause error message/g) as RegExpMatchArray).length;

        // Its twice because of the code view
        expect(found).toBeLessThanOrEqual(2);
    });

    it.skipIf(!globalThis.AggregateError)("should render error messages for multiple errors in AggregateError", () => {
        expect.assertions(3);

        const error1 = new Error("Error 1");
        const error2 = new Error("Error 2");
        // eslint-disable-next-line unicorn/error-message
        const aggregateError = new AggregateError([error1, error2]);

        const errorsOutput = renderError(aggregateError);

        expect(errorsOutput).toContain("Errors:");
        expect(errorsOutput).toContain("Error 1");
        expect(errorsOutput).toContain("Error 2");
    });

    it.skipIf(!globalThis.AggregateError)("should handle nested errors within AggregateError", () => {
        expect.assertions(1);

        // eslint-disable-next-line unicorn/error-message
        const nestedError = new AggregateError([new Error("Nested Error")]);
        // eslint-disable-next-line unicorn/error-message
        const errorsOutput = renderError(new AggregateError([nestedError]), {
            displayShortPath: true,
            framesMaxLimit: 1,
            hideErrorCauseCodeView: true,
            hideErrorCodeView: true,
            hideErrorErrorsCodeView: true,
        });

        expect(errorsOutput).toMatchSnapshot();
    });

    it("should handle nested cause errors", () => {
        expect.assertions(1);

        const errorsOutput = renderError(
            new Error("This is an error message", {
                cause: new Error("This is the cause of the error", {
                    cause: new Error("This is the cause of the cause of the error"),
                }),
            }),
            {
                displayShortPath: true,
                framesMaxLimit: 1,
                hideErrorCauseCodeView: true,
                hideErrorCodeView: true,
                hideErrorErrorsCodeView: true,
            },
        );

        expect(errorsOutput).toMatchSnapshot();
    });

    it("should respect base prefix option", () => {
        expect.assertions(1);

        const errorsOutput = renderError(
            new Error("This is an error message", {
                cause: new Error("This is the cause of the error", {
                    cause: new Error("This is the cause of the cause of the error"),
                }),
            }),
            {
                displayShortPath: true,
                framesMaxLimit: 1,
                hideErrorCauseCodeView: true,
                hideErrorCodeView: true,
                hideErrorErrorsCodeView: true,
                prefix: "prefix",
            },
        );

        expect(errorsOutput).toMatchSnapshot();
    });
});
