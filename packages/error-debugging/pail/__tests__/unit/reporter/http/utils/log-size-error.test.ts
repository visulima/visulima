import { describe, expect, it } from "vitest";

import LogSizeError from "../../../../../src/reporter/http/utils/log-size-error";

describe(LogSizeError, () => {
    it("should create error with message and properties", () => {
        expect.assertions(5);

        const logData = { data: { key: "value" }, logLevel: "info", message: "test" };
        const error = new LogSizeError("Log entry exceeds maximum size", logData, 2000, 1000);

        expect(error.message).toBe("Log entry exceeds maximum size");
        expect(error.name).toBe("LogSizeError");
        expect(error.logData).toStrictEqual(logData);
        expect(error.actualSize).toBe(2000);
        expect(error.maxSize).toBe(1000);
    });

    it("should be an instance of Error", () => {
        expect.assertions(2);

        const logData = { logLevel: "info", message: "test" };
        const error = new LogSizeError("Test error", logData, 1000, 500);

        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(LogSizeError);
    });

    it("should preserve all error properties", () => {
        expect.assertions(3);

        const logData = { data: { large: "x".repeat(1000) }, logLevel: "error", message: "large message" };
        const error = new LogSizeError("Log too large", logData, 2_000_000, 1_000_000);

        expect(error.logData).toStrictEqual(logData);
        expect(error.actualSize).toBe(2_000_000);
        expect(error.maxSize).toBe(1_000_000);
    });
});
