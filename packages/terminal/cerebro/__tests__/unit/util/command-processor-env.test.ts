import type { CommandLineOptions } from "@visulima/command-line-args";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { POSITIONALS_KEY } from "../../../src/constants";
import type { Command as ICommand } from "../../../src/types/command";
import { prepareToolbox } from "../../../src/util/command-processing/command-processor";

// Mock process.env
const originalEnv = process.env;

describe("util/command-processor - environment variables", () => {
    beforeEach(() => {
        // Reset process.env before each test
        process.env = { ...originalEnv };
    });

    afterAll(() => {
        // Restore original process.env reference
        process.env = originalEnv;
    });

    it("should add env property to toolbox when command has env definitions", () => {
        expect.assertions(3);

        process.env.TEST_VAR = "test-value";

        const command: ICommand = {
            env: [
                {
                    name: "TEST_VAR",
                    type: String,
                },
            ],
            execute: () => {},
            name: "test",
        };

        const parsedArgs: CommandLineOptions = {
            _all: {},
            positionals: {
                [POSITIONALS_KEY]: [],
            },
        };

        const toolbox = prepareToolbox(command, parsedArgs, {}, {});

        expect(toolbox.env).toBeDefined();
        expect(toolbox.env.testVar).toBe("test-value");
        expect(toolbox.options).toBeDefined();
    });

    it("should transform environment variables according to type", () => {
        expect.assertions(3);

        process.env.STRING_VAR = "string-value";
        process.env.NUMBER_VAR = "42";
        process.env.BOOL_VAR = "true";

        const command: ICommand = {
            env: [
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
            ],
            execute: () => {},
            name: "test",
        };

        const parsedArgs: CommandLineOptions = {
            _all: {},
            positionals: {
                [POSITIONALS_KEY]: [],
            },
        };

        const toolbox = prepareToolbox(command, parsedArgs, {}, {});

        expect(toolbox.env.stringVar).toBe("string-value");
        expect(toolbox.env.numberVar).toBe(42);
        expect(toolbox.env.boolVar).toBe(true);
    });

    it("should use default values when environment variables are not set", () => {
        expect.assertions(3);

        delete process.env.TEST_VAR;

        const command: ICommand = {
            env: [
                {
                    defaultValue: "default-value",
                    name: "TEST_VAR",
                    type: String,
                },
                {
                    defaultValue: 100,
                    name: "NUMBER_VAR",
                    type: Number,
                },
                {
                    defaultValue: false,
                    name: "BOOL_VAR",
                    type: Boolean,
                },
            ],
            execute: () => {},
            name: "test",
        };

        const parsedArgs: CommandLineOptions = {
            _all: {},
            positionals: {
                [POSITIONALS_KEY]: [],
            },
        };

        const toolbox = prepareToolbox(command, parsedArgs, {}, {});

        expect(toolbox.env.testVar).toBe("default-value");
        expect(toolbox.env.numberVar).toBe(100);
        expect(toolbox.env.boolVar).toBe(false);
    });

    it("should return empty env object when command has no env definitions", () => {
        expect.assertions(1);

        const command: ICommand = {
            execute: () => {},
            name: "test",
        };

        const parsedArgs: CommandLineOptions = {
            _all: {},
            positionals: {
                [POSITIONALS_KEY]: [],
            },
        };

        const toolbox = prepareToolbox(command, parsedArgs, {}, {});

        expect(toolbox.env).toStrictEqual({});
    });

    it("should return empty env object when command has empty env array", () => {
        expect.assertions(1);

        const command: ICommand = {
            env: [],
            execute: () => {},
            name: "test",
        };

        const parsedArgs: CommandLineOptions = {
            _all: {},
            positionals: {
                [POSITIONALS_KEY]: [],
            },
        };

        const toolbox = prepareToolbox(command, parsedArgs, {}, {});

        expect(toolbox.env).toStrictEqual({});
    });

    it("should convert environment variable names to camelCase", () => {
        expect.assertions(3);

        process.env.TEST_ENV_VAR = "value1";
        process.env.ANOTHER_TEST_VAR = "value2";

        const command: ICommand = {
            env: [
                {
                    name: "TEST_ENV_VAR",
                    type: String,
                },
                {
                    name: "ANOTHER_TEST_VAR",
                    type: String,
                },
            ],
            execute: () => {},
            name: "test",
        };

        const parsedArgs: CommandLineOptions = {
            _all: {},
            positionals: {
                [POSITIONALS_KEY]: [],
            },
        };

        const toolbox = prepareToolbox(command, parsedArgs, {}, {});

        expect(toolbox.env.testEnvVar).toBe("value1");
        expect(toolbox.env.anotherTestVar).toBe("value2");
        expect(toolbox.env).not.toHaveProperty("TEST_ENV_VAR");
    });
});
