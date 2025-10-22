import { describe, expect, expectTypeOf, it } from "vitest";

import captureRawStackTrace from "../../src/error/capture-raw-stack-trace";

describe(captureRawStackTrace, () => {
    it("should return stack trace when Error.captureStackTrace is available", () => {
        expect.assertions(1);

        const stackTrace = captureRawStackTrace();

        expect(stackTrace).toBeDefined();

        expectTypeOf(stackTrace).toBeString();
    });

    it("should return undefined when Error.captureStackTrace is not available", () => {
        expect.assertions(1);

        const originalCaptureStackTrace = Error.captureStackTrace;

        Error.captureStackTrace = undefined;

        const stackTrace = captureRawStackTrace();

        expect(stackTrace).toBeUndefined();

        Error.captureStackTrace = originalCaptureStackTrace;
    });

    it("should return stack trace in string format", () => {
        expect.assertions(0);

        const stackTrace = captureRawStackTrace();

        expectTypeOf(stackTrace).toBeString();
    });
});
