import { describe, expect, expectTypeOf, it, vi } from "vitest";

import writeConsoleLogBasedOnLevel from "../../../src/utils/write-console-log";

describe(writeConsoleLogBasedOnLevel, () => {
    it("should return a function that logs to console based on the provided log level", () => {
        expect.assertions(1);

        const consoleMock = vi.spyOn(console, "log").mockImplementation(() => undefined);

        const logFunction = writeConsoleLogBasedOnLevel("debug");

        expectTypeOf(logFunction).toBeFunction();

        logFunction("test message");

        expect(consoleMock).toHaveBeenCalledExactlyOnceWith("test message");

        consoleMock.mockReset();
    });

    it("should return console.error when level is \"error\"", () => {
        expect.assertions(1);

        const logFunction = writeConsoleLogBasedOnLevel("error");

        // eslint-disable-next-line no-console
        expect(logFunction).toBe(console.error);
    });

    it("should return console.warn when level is \"warn\"", () => {
        expect.assertions(1);

        const logFunction = writeConsoleLogBasedOnLevel("warn");

        // eslint-disable-next-line no-console
        expect(logFunction).toBe(console.warn);
    });

    it("should return console.log when level is not a valid ExtendedRfc5424LogLevels type", () => {
        expect.assertions(1);

        const logFunction = writeConsoleLogBasedOnLevel("invalid");

        // eslint-disable-next-line no-console
        expect(logFunction).toBe(console.log);
    });

    it("should return console.log when level is a string but not a LiteralUnion type", () => {
        expect.assertions(1);

        const logFunction = writeConsoleLogBasedOnLevel("string");

        // eslint-disable-next-line no-console
        expect(logFunction).toBe(console.log);
    });

    it("should return console.log when level is a number or boolean", () => {
        expect.assertions(2);

        // @ts-expect-error Testing invalid input
        const logFunction = writeConsoleLogBasedOnLevel(123);

        // eslint-disable-next-line no-console
        expect(logFunction).toBe(console.log);

        // @ts-expect-error Testing invalid input
        const logFunction2 = writeConsoleLogBasedOnLevel(true);

        // eslint-disable-next-line no-console
        expect(logFunction2).toBe(console.log);
    });
});
