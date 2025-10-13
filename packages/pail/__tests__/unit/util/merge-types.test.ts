import { describe, expect, it } from "vitest";

import type { DefaultLoggerTypes, LoggerTypesConfig } from "../../../src/types";
import mergeTypes from "../../../src/utils/merge-types";

describe(mergeTypes, () => {
    it("should merge two types correctly when given standard and custom types", () => {
        expect.assertions(1);

        const standard: Partial<DefaultLoggerTypes> = {
            error: {
                badge: "ERROR",
                color: "red",
                label: "Error",
                logLevel: "error",
            },
            info: {
                badge: "INFO",
                color: "blue",
                label: "Info",
                logLevel: "informational",
            },
        };

        const custom: LoggerTypesConfig<string> = {
            warning: {
                badge: "WARNING",
                color: "yellow",
                label: "Warning",
                logLevel: "warning",
            },
        };

        const result = mergeTypes(standard as DefaultLoggerTypes, custom);

        expect(result).toStrictEqual({
            error: {
                badge: "ERROR",
                color: "red",
                label: "Error",
                logLevel: "error",
            },
            info: {
                badge: "INFO",
                color: "blue",
                label: "Info",
                logLevel: "informational",
            },
            warning: {
                badge: "WARNING",
                color: "yellow",
                label: "Warning",
                logLevel: "warning",
            },
        });
    });

    it("should handle empty strings as type names when given standard and custom types", () => {
        expect.assertions(1);

        // Arrange
        const standard: Partial<DefaultLoggerTypes> = {
            error: {
                badge: "ERROR",
                color: "red",
                label: "Error",
                logLevel: "error",
            },
            info: {
                badge: "INFO",
                color: "blue",
                label: "Info",
                logLevel: "informational",
            },
        };

        const custom: LoggerTypesConfig<string> = {
            "": {
                badge: "",
                color: "red",
                label: "",
                logLevel: "error",
            },
        };

        const result = mergeTypes(standard as DefaultLoggerTypes, custom);

        expect(result).toStrictEqual({
            "": {
                badge: "",
                color: "red",
                label: "",
                logLevel: "error",
            },
            error: {
                badge: "ERROR",
                color: "red",
                label: "Error",
                logLevel: "error",
            },
            info: {
                badge: "INFO",
                color: "blue",
                label: "Info",
                logLevel: "informational",
            },
        });
    });

    it("should handle empty badge strings when given standard and custom types", () => {
        expect.assertions(1);

        const standard: Partial<DefaultLoggerTypes> = {
            error: {
                badge: "ERROR",
                color: "red",
                label: "Error",
                logLevel: "error",
            },
            info: {
                badge: "INFO",
                color: "blue",
                label: "Info",
                logLevel: "informational",
            },
        };

        const custom: LoggerTypesConfig<string> = {
            warning: {
                badge: "",
                color: "yellow",
                label: "Warning",
                logLevel: "warning",
            },
        };

        const result = mergeTypes(standard as DefaultLoggerTypes, custom);

        expect(result).toStrictEqual({
            error: {
                badge: "ERROR",
                color: "red",
                label: "Error",
                logLevel: "error",
            },
            info: {
                badge: "INFO",
                color: "blue",
                label: "Info",
                logLevel: "informational",
            },
            warning: {
                badge: "",
                color: "yellow",
                label: "Warning",
                logLevel: "warning",
            },
        });
    });
});
