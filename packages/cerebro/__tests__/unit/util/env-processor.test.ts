import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EnvDefinition } from "../../../src/types/command";
import processEnvVariables from "../../../src/util/env-processor";

// Mock process.env
const originalEnv = process.env;

describe("util/env-processor", () => {
    beforeEach(() => {
        // Reset process.env before each test
        process.env = { ...originalEnv };
    });

    it("should return empty object when env definitions are undefined", () => {
        expect.assertions(1);

        const result = processEnvVariables(undefined);

        expect(result).toStrictEqual({});
    });

    it("should return empty object when env definitions array is empty", () => {
        expect.assertions(1);

        const result = processEnvVariables([]);

        expect(result).toStrictEqual({});
    });

    it("should process string environment variables without type", () => {
        expect.assertions(1);

        process.env.TEST_STRING_VAR = "test-value";

        const envDefinitions: EnvDefinition<string>[] = [
            {
                name: "TEST_STRING_VAR",
            },
        ];

        const result = processEnvVariables(envDefinitions);

        expect(result).toStrictEqual({
            testStringVar: "test-value",
        });
    });

    it("should process string environment variables with String type", () => {
        expect.assertions(1);

        process.env.TEST_STRING_VAR = "test-value";

        const envDefinitions: EnvDefinition<string>[] = [
            {
                name: "TEST_STRING_VAR",
                type: String,
            },
        ];

        const result = processEnvVariables(envDefinitions);

        expect(result).toStrictEqual({
            testStringVar: "test-value",
        });
    });

    it("should process number environment variables with Number type", () => {
        expect.assertions(1);

        process.env.TEST_NUMBER_VAR = "42";

        const envDefinitions: EnvDefinition<number>[] = [
            {
                name: "TEST_NUMBER_VAR",
                type: Number,
            },
        ];

        const result = processEnvVariables(envDefinitions);

        expect(result).toStrictEqual({
            testNumberVar: 42,
        });
    });

    it("should process boolean environment variables with Boolean type - true values", () => {
        expect.assertions(4);

        const trueValues = ["true", "1", "yes", "on"];

        for (const value of trueValues) {
            process.env.TEST_BOOL_VAR = value;

            const envDefinitions: EnvDefinition<boolean>[] = [
                {
                    name: "TEST_BOOL_VAR",
                    type: Boolean,
                },
            ];

            const result = processEnvVariables(envDefinitions);

            expect(result.testBoolVar).toBe(true);
        }
    });

    it("should process boolean environment variables with Boolean type - false values", () => {
        expect.assertions(5);

        const falseValues = ["false", "0", "no", "off", "anything-else"];

        for (const value of falseValues) {
            process.env.TEST_BOOL_VAR = value;

            const envDefinitions: EnvDefinition<boolean>[] = [
                {
                    name: "TEST_BOOL_VAR",
                    type: Boolean,
                },
            ];

            const result = processEnvVariables(envDefinitions);

            expect(result.testBoolVar).toBe(false);
        }
    });

    it("should process boolean environment variables with Boolean type - case insensitive", () => {
        expect.assertions(3);

        const caseVariants = ["TRUE", "True", "TrUe"];

        for (const value of caseVariants) {
            process.env.TEST_BOOL_VAR = value;

            const envDefinitions: EnvDefinition<boolean>[] = [
                {
                    name: "TEST_BOOL_VAR",
                    type: Boolean,
                },
            ];

            const result = processEnvVariables(envDefinitions);

            expect(result.testBoolVar).toBe(true);
        }
    });

    it("should use default value when environment variable is not set", () => {
        expect.assertions(1);

        delete process.env.TEST_VAR;

        const envDefinitions: EnvDefinition<string>[] = [
            {
                defaultValue: "default-value",
                name: "TEST_VAR",
                type: String,
            },
        ];

        const result = processEnvVariables(envDefinitions);

        expect(result).toStrictEqual({
            testVar: "default-value",
        });
    });

    it("should use default value when environment variable is undefined after transformation", () => {
        expect.assertions(1);

        delete process.env.TEST_NUMBER_VAR;

        const envDefinitions: EnvDefinition<number>[] = [
            {
                defaultValue: 100,
                name: "TEST_NUMBER_VAR",
                type: Number,
            },
        ];

        const result = processEnvVariables(envDefinitions);

        expect(result).toStrictEqual({
            testNumberVar: 100,
        });
    });

    it("should use default value for boolean when environment variable is not set", () => {
        expect.assertions(1);

        delete process.env.TEST_BOOL_VAR;

        const envDefinitions: EnvDefinition<boolean>[] = [
            {
                defaultValue: true,
                name: "TEST_BOOL_VAR",
                type: Boolean,
            },
        ];

        const result = processEnvVariables(envDefinitions);

        expect(result).toStrictEqual({
            testBoolVar: true,
        });
    });

    it("should prefer environment variable value over default value", () => {
        expect.assertions(1);

        process.env.TEST_VAR = "env-value";

        const envDefinitions: EnvDefinition<string>[] = [
            {
                defaultValue: "default-value",
                name: "TEST_VAR",
                type: String,
            },
        ];

        const result = processEnvVariables(envDefinitions);

        expect(result).toStrictEqual({
            testVar: "env-value",
        });
    });

    it("should convert environment variable names to camelCase", () => {
        expect.assertions(1);

        process.env.TEST_ENV_VAR_NAME = "value1";
        process.env.ANOTHER_TEST_VAR = "value2";
        process.env.SINGLE = "value3";

        const envDefinitions: EnvDefinition<string>[] = [
            {
                name: "TEST_ENV_VAR_NAME",
            },
            {
                name: "ANOTHER_TEST_VAR",
            },
            {
                name: "SINGLE",
            },
        ];

        const result = processEnvVariables(envDefinitions);

        expect(result).toStrictEqual({
            anotherTestVar: "value2",
            single: "value3",
            testEnvVarName: "value1",
        });
    });

    it("should process multiple environment variables", () => {
        expect.assertions(1);

        process.env.STRING_VAR = "string-value";
        process.env.NUMBER_VAR = "42";
        process.env.BOOL_VAR = "true";

        const envDefinitions: (EnvDefinition<string> | EnvDefinition<number> | EnvDefinition<boolean>)[] = [
            {
                name: "STRING_VAR",
                type: String,
            },
            {
                name: "NUMBER_VAR",
                type: Number,
            },
            {
                name: "BOOL_VAR",
                type: Boolean,
            },
        ];

        const result = processEnvVariables(envDefinitions);

        expect(result).toStrictEqual({
            boolVar: true,
            numberVar: 42,
            stringVar: "string-value",
        });
    });

    it("should handle custom transform function", () => {
        expect.assertions(1);

        process.env.CUSTOM_VAR = "custom-value";

        const customTransform = (value: string | undefined): string => value?.toUpperCase() ?? "";

        const envDefinitions: EnvDefinition<string>[] = [
            {
                name: "CUSTOM_VAR",
                type: customTransform,
            },
        ];

        const result = processEnvVariables(envDefinitions);

        expect(result).toStrictEqual({
            customVar: "CUSTOM-VALUE",
        });
    });

    it("should handle hidden environment variables", () => {
        expect.assertions(1);

        process.env.VISIBLE_VAR = "visible";
        process.env.HIDDEN_VAR = "hidden";

        const envDefinitions: EnvDefinition<string>[] = [
            {
                name: "VISIBLE_VAR",
            },
            {
                hidden: true,
                name: "HIDDEN_VAR",
            },
        ];

        const result = processEnvVariables(envDefinitions);

        // Hidden flag doesn't affect processing, only display
        expect(result).toStrictEqual({
            hiddenVar: "hidden",
            visibleVar: "visible",
        });
    });
});
