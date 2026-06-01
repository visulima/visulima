import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Toolbox } from "../../src";
import { Cerebro as Cli, VERBOSITY_DEBUG, VERBOSITY_QUIET, VERBOSITY_VERBOSE } from "../../src";

describe("cli", () => {
    it("should initialize Cli with default options", () => {
        expect.assertions(4);

        const cli = new Cli("MyCLI");

        expect(cli.getCliName()).toBe("MyCLI");
        expect(cli.getPackageVersion()).toBeUndefined();
        expect(cli.getPackageName()).toBeUndefined();
        // Help and version commands are lazy-loaded during run()
        expect(cli.getCommands().size).toBe(0);
    });

    it("should add a command and execute it successfully", async () => {
        expect.assertions(2);

        const mockedExecute = vi.fn().mockResolvedValue(undefined);

        const cli = new Cli("MyCLI", { argv: ["hello"] });

        cli.addCommand({
            description: "A simple hello world command",
            execute: mockedExecute,
            name: "hello",
        });

        await cli.run({ shouldExitProcess: false });

        expect(mockedExecute).toHaveBeenCalledTimes(1);

        expect(mockedExecute).toHaveBeenCalledWith(expect.any(Object));
    });

    it("should set and retrieve command section", () => {
        expect.assertions(1);

        const cli = new Cli("MyCLI");
        const section = { footer: "Footer", header: "Header" };

        cli.setCommandSection(section);

        expect(cli.getCommandSection()).toStrictEqual(section);
    });

    it("should set and retrieve default command", () => {
        expect.assertions(1);

        const cli = new Cli("MyCLI");

        cli.setDefaultCommand("version");

        expect(cli.defaultCommand).toBe("version");
    });

    it("should throw error when adding a command with duplicate name or alias", () => {
        expect.assertions(1);

        const cli = new Cli("MyCLI");

        cli.addCommand({ execute: vi.fn(), name: "duplicate" });

        expect(() => cli.addCommand({ execute: vi.fn(), name: "duplicate" })).toThrow("Command with path \"duplicate\" already exists");
    });

    it("should throw error when running a command with missing required options", async () => {
        expect.assertions(1);

        const cli = new Cli("MyCLI", { argv: ["test"] });

        cli.addCommand({
            execute: vi.fn(),
            name: "test",
            options: [{ name: "requiredOption", required: true, type: String }],
        });

        await expect(
            cli.run({
                shouldExitProcess: false,
            }),
        ).rejects.toThrow("Command \"test\" is missing required options: requiredOption");
    });

    it("should throw error when running a command with unknown options", async () => {
        expect.assertions(1);

        const cli = new Cli("MyCLI", { argv: ["test", "--unknownOption"] });

        cli.addCommand({ execute: vi.fn(), name: "test" });

        await expect(
            cli.run({
                shouldExitProcess: false,
            }),
        ).rejects.toThrow("Found unknown option \"--unknownOption\"");
    });

    it("should throw error when running a command with conflicting options", async () => {
        expect.assertions(1);

        const cli = new Cli("MyCLI", { argv: ["test", "--option1", "value1", "--option2", "value2"] });

        cli.addCommand({
            execute: vi.fn(),
            name: "test",
            options: [
                { conflicts: "option2", name: "option1", type: String },
                { name: "option2", type: String },
            ],
        });

        await expect(
            cli.run({
                shouldExitProcess: false,
            }),
        ).rejects.toThrow("Options \"option1\" and \"option2\" cannot be used together");
    });

    it("should not throw a error when running a command with one options that dont conflict", async () => {
        expect.assertions(2);

        const cli = new Cli("MyCLI", { argv: ["test", "--option1", "value1"] });

        const execute = vi.fn();

        cli.addCommand({
            execute,
            name: "test",
            options: [
                { conflicts: "option2", name: "option1", type: String },
                { conflicts: "option1", name: "option2", type: String },
            ],
        });

        await cli.run({
            shouldExitProcess: false,
        });

        expect(execute).toHaveBeenCalledTimes(1);

        expect(execute).toHaveBeenCalledWith(expect.any(Object));
    });

    it("should allow --no-clean flag and set clean to false in options", async () => {
        expect.assertions(3);

        const cli = new Cli("MyCLI", { argv: ["a", "--no-clean"] });

        const execute = vi.fn();

        cli.addCommand({
            execute,
            name: "a",
            options: [{ name: "no-clean", type: Boolean }],
        });

        await cli.run({
            shouldExitProcess: false,
        });

        expect(execute).toHaveBeenCalledTimes(1);

        const toolbox = execute.mock.calls[0][0] as Toolbox;

        expect(toolbox.options.clean).toBe(false);
        expect(toolbox.options.noClean).toBeUndefined();
    });

    it("should allow --clean flag and set clean to true in options", async () => {
        expect.assertions(2);

        const cli = new Cli("MyCLI", { argv: ["a", "--clean"] });

        const execute = vi.fn();

        cli.addCommand({
            execute,
            name: "a",
            options: [{ name: "no-clean", type: Boolean }],
        });

        await cli.run({
            shouldExitProcess: false,
        });

        expect(execute).toHaveBeenCalledTimes(1);

        const toolbox = execute.mock.calls[0][0] as Toolbox;

        expect(toolbox.options.clean).toBe(true);
    });

    it("should throw error when both --clean and --no-clean are provided", async () => {
        expect.assertions(1);

        const cli = new Cli("MyCLI", { argv: ["a", "--clean", "--no-clean"] });

        cli.addCommand({
            execute: vi.fn(),
            name: "a",
            options: [{ name: "no-clean", type: Boolean }],
        });

        await expect(
            cli.run({
                shouldExitProcess: false,
            }),
        ).rejects.toThrow("Options \"clean\" and \"no-clean\" cannot be used together");
    });

    describe("runCommand", () => {
        it("should execute a command programmatically from within another command", async () => {
            expect.assertions(3);

            const buildExecute = vi.fn().mockResolvedValue("build-result");
            const deployExecute = vi.fn().mockImplementation(async ({ runtime }: Toolbox) => {
                const result = await runtime.runCommand("build", { argv: ["--production"] });

                return result;
            });

            const cli = new Cli("MyCLI", { argv: ["deploy"] });

            cli.addCommand({
                description: "Build command",
                execute: buildExecute,
                name: "build",
                options: [{ name: "production", type: Boolean }],
            });

            cli.addCommand({
                description: "Deploy command",
                execute: deployExecute,
                name: "deploy",
            });

            await cli.run({ shouldExitProcess: false });

            expect(buildExecute).toHaveBeenCalledTimes(1);
            expect(deployExecute).toHaveBeenCalledTimes(1);
            expect(buildExecute).toHaveBeenCalledWith(
                expect.objectContaining({
                    options: expect.objectContaining({
                        production: true,
                    }),
                }),
            );
        });

        it("should pass arguments to the called command", async () => {
            expect.assertions(2);

            const testExecute = vi.fn();
            const parentExecute = vi.fn().mockImplementation(async ({ runtime }: Toolbox) => {
                await runtime.runCommand("test", { argv: ["arg1", "arg2"] });
            });

            const cli = new Cli("MyCLI", { argv: ["parent"] });

            cli.addCommand({
                argument: { name: "files", type: String },
                execute: testExecute,
                name: "test",
            });

            cli.addCommand({
                execute: parentExecute,
                name: "parent",
            });

            await cli.run({ shouldExitProcess: false });

            expect(testExecute).toHaveBeenCalledTimes(1);
            expect(testExecute).toHaveBeenCalledWith(
                expect.objectContaining({
                    argument: ["arg1", "arg2"],
                }),
            );
        });

        it("should merge extra options into command options", async () => {
            expect.assertions(2);

            const testExecute = vi.fn();
            const parentExecute = vi.fn().mockImplementation(async ({ runtime }: Toolbox) => {
                await runtime.runCommand("test", { argv: [], customOption: "custom-value" });
            });

            const cli = new Cli("MyCLI", { argv: ["parent"] });

            cli.addCommand({
                execute: testExecute,
                name: "test",
            });

            cli.addCommand({
                execute: parentExecute,
                name: "parent",
            });

            await cli.run({ shouldExitProcess: false });

            expect(testExecute).toHaveBeenCalledTimes(1);
            expect(testExecute).toHaveBeenCalledWith(
                expect.objectContaining({
                    options: expect.objectContaining({
                        customOption: "custom-value",
                    }),
                }),
            );
        });

        it("should return the result from the called command", async () => {
            expect.assertions(2);

            const testExecute = vi.fn().mockResolvedValue("test-result");
            let parentResult: unknown;
            const parentExecute = vi.fn().mockImplementation(async ({ runtime }: Toolbox) => {
                parentResult = await runtime.runCommand("test");

                return parentResult;
            });

            const cli = new Cli("MyCLI", { argv: ["parent"] });

            cli.addCommand({
                execute: testExecute,
                name: "test",
            });

            cli.addCommand({
                execute: parentExecute,
                name: "parent",
            });

            await cli.run({ shouldExitProcess: false });

            expect(parentExecute).toHaveBeenCalledTimes(1);
            expect(parentResult).toBe("test-result");
        });

        it("should throw CommandNotFoundError when command does not exist", async () => {
            expect.assertions(2);

            const parentExecute = vi.fn().mockImplementation(async ({ runtime }: Toolbox) => {
                await runtime.runCommand("nonexistent");
            });

            const cli = new Cli("MyCLI", { argv: ["parent"] });

            cli.addCommand({
                execute: parentExecute,
                name: "parent",
            });

            await expect(cli.run({ shouldExitProcess: false })).rejects.toThrow("Command \"nonexistent\" not found");

            expect(parentExecute).toHaveBeenCalledTimes(1);
        });

        it("should throw error when registering a command without execute or loader", () => {
            expect.assertions(1);

            const cli = new Cli("MyCLI");

            expect(() =>
                cli.addCommand({
                    // @ts-expect-error - Testing invalid command
                    execute: undefined,
                    name: "invalid",
                }),
            ).toThrow("Command \"invalid\" must define either \"execute\" or \"loader\"");
        });

        it("should validate required options for called command", async () => {
            expect.assertions(1);

            const parentExecute = vi.fn().mockImplementation(async ({ runtime }: Toolbox) => {
                await runtime.runCommand("test");
            });

            const cli = new Cli("MyCLI", { argv: ["parent"] });

            cli.addCommand({
                execute: vi.fn(),
                name: "test",
                options: [{ name: "requiredOption", required: true, type: String }],
            });

            cli.addCommand({
                execute: parentExecute,
                name: "parent",
            });

            await expect(cli.run({ shouldExitProcess: false })).rejects.toThrow("Command \"test\" is missing required options: requiredOption");
        });

        it("should validate conflicting options for called command", async () => {
            expect.assertions(1);

            const parentExecute = vi.fn().mockImplementation(async ({ runtime }: Toolbox) => {
                await runtime.runCommand("test", { argv: ["--option1", "value1", "--option2", "value2"] });
            });

            const cli = new Cli("MyCLI", { argv: ["parent"] });

            cli.addCommand({
                execute: vi.fn(),
                name: "test",
                options: [
                    { conflicts: "option2", name: "option1", type: String },
                    { name: "option2", type: String },
                ],
            });

            cli.addCommand({
                execute: parentExecute,
                name: "parent",
            });

            await expect(cli.run({ shouldExitProcess: false })).rejects.toThrow("Options \"option1\" and \"option2\" cannot be used together");
        });

        it("should execute plugin lifecycle hooks for called command", async () => {
            expect.assertions(4);

            const beforeCommandHook = vi.fn();
            const afterCommandHook = vi.fn();
            const testExecute = vi.fn().mockResolvedValue("test-result");
            const parentExecute = vi.fn().mockImplementation(async ({ runtime }: Toolbox) => {
                await runtime.runCommand("test");
            });

            const cli = new Cli("MyCLI", { argv: ["parent"] });

            cli.addPlugin({
                afterCommand: afterCommandHook,
                beforeCommand: beforeCommandHook,
                execute: vi.fn(),
                name: "test-plugin",
            });

            cli.addCommand({
                execute: testExecute,
                name: "test",
            });

            cli.addCommand({
                execute: parentExecute,
                name: "parent",
            });

            await cli.run({ shouldExitProcess: false });

            // Hooks should be called for both parent and test commands
            expect(beforeCommandHook).toHaveBeenCalledTimes(2);
            expect(afterCommandHook).toHaveBeenCalledTimes(2);
            expect(testExecute).toHaveBeenCalledTimes(1);
            expect(parentExecute).toHaveBeenCalledTimes(1);
        });

        it("should handle errors from called command and propagate them", async () => {
            expect.assertions(2);

            const testError = new Error("Test command failed");
            const testExecute = vi.fn().mockRejectedValue(testError);
            const parentExecute = vi.fn().mockImplementation(async ({ runtime }: Toolbox) => {
                await runtime.runCommand("test");
            });

            const cli = new Cli("MyCLI", { argv: ["parent"] });

            cli.addCommand({
                execute: testExecute,
                name: "test",
            });

            cli.addCommand({
                execute: parentExecute,
                name: "parent",
            });

            await expect(cli.run({ shouldExitProcess: false })).rejects.toThrow("Test command failed");

            expect(testExecute).toHaveBeenCalledTimes(1);
        });

        it("should support nested command calls", async () => {
            expect.assertions(4);

            const buildExecute = vi.fn().mockResolvedValue("build-result");
            const testExecute = vi.fn().mockImplementation(async ({ runtime }: Toolbox) => {
                await runtime.runCommand("build");
            });
            const deployExecute = vi.fn().mockImplementation(async ({ runtime }: Toolbox) => {
                await runtime.runCommand("test");
            });

            const cli = new Cli("MyCLI", { argv: ["deploy"] });

            cli.addCommand({
                execute: buildExecute,
                name: "build",
            });

            cli.addCommand({
                execute: testExecute,
                name: "test",
            });

            cli.addCommand({
                execute: deployExecute,
                name: "deploy",
            });

            await cli.run({ shouldExitProcess: false });

            expect(buildExecute).toHaveBeenCalledTimes(1);
            expect(testExecute).toHaveBeenCalledTimes(1);
            expect(deployExecute).toHaveBeenCalledTimes(1);
            await expect((buildExecute.mock.results[0] as { value: Promise<string> }).value).resolves.toBe("build-result");
        });
    });

    describe("environment variables", () => {
        const originalEnv = process.env;

        beforeEach(() => {
            process.env = { ...originalEnv };
        });

        it("should process environment variables and make them available in toolbox", async () => {
            expect.assertions(4);

            process.env.TEST_STRING_VAR = "test-string";
            process.env.TEST_NUMBER_VAR = "42";
            process.env.TEST_BOOL_VAR = "true";

            const execute = vi.fn().mockImplementation(({ env }: Toolbox) => {
                expect(env.testStringVar).toBe("test-string");
                expect(env.testNumberVar).toBe(42);
                expect(env.testBoolVar).toBe(true);
            });

            const cli = new Cli("MyCLI", { argv: ["test"] });

            cli.addCommand({
                env: [
                    {
                        name: "TEST_STRING_VAR",
                        type: String,
                    },
                    {
                        name: "TEST_NUMBER_VAR",
                        type: Number,
                    },
                    {
                        name: "TEST_BOOL_VAR",
                        type: Boolean,
                    },
                ],
                execute,
                name: "test",
            });

            await cli.run({ shouldExitProcess: false });

            expect(execute).toHaveBeenCalledTimes(1);
        });

        it("should use default values when environment variables are not set", async () => {
            expect.assertions(4);

            delete process.env.TEST_VAR;

            const execute = vi.fn().mockImplementation(({ env }: Toolbox) => {
                expect(env.testVar).toBe("default-value");
                expect(env.testNumber).toBe(100);
                expect(env.testBool).toBe(false);
            });

            const cli = new Cli("MyCLI", { argv: ["test"] });

            cli.addCommand({
                env: [
                    {
                        defaultValue: "default-value",
                        name: "TEST_VAR",
                        type: String,
                    },
                    {
                        defaultValue: 100,
                        name: "TEST_NUMBER",
                        type: Number,
                    },
                    {
                        defaultValue: false,
                        name: "TEST_BOOL",
                        type: Boolean,
                    },
                ],
                execute,
                name: "test",
            });

            await cli.run({ shouldExitProcess: false });

            expect(execute).toHaveBeenCalledTimes(1);
        });

        it("should prefer environment variable value over default value", async () => {
            expect.assertions(2);

            process.env.TEST_VAR = "env-value";

            const execute = vi.fn().mockImplementation(({ env }: Toolbox) => {
                expect(env.testVar).toBe("env-value");
            });

            const cli = new Cli("MyCLI", { argv: ["test"] });

            cli.addCommand({
                env: [
                    {
                        defaultValue: "default-value",
                        name: "TEST_VAR",
                        type: String,
                    },
                ],
                execute,
                name: "test",
            });

            await cli.run({ shouldExitProcess: false });

            expect(execute).toHaveBeenCalledTimes(1);
        });

        it("should convert environment variable names to camelCase", async () => {
            expect.assertions(3);

            process.env.TEST_ENV_VAR_NAME = "value1";
            process.env.ANOTHER_TEST_VAR = "value2";

            const execute = vi.fn().mockImplementation(({ env }: Toolbox) => {
                expect(env.testEnvVarName).toBe("value1");
                expect(env.anotherTestVar).toBe("value2");
            });

            const cli = new Cli("MyCLI", { argv: ["test"] });

            cli.addCommand({
                env: [
                    {
                        name: "TEST_ENV_VAR_NAME",
                        type: String,
                    },
                    {
                        name: "ANOTHER_TEST_VAR",
                        type: String,
                    },
                ],
                execute,
                name: "test",
            });

            await cli.run({ shouldExitProcess: false });

            expect(execute).toHaveBeenCalledTimes(1);
        });
    });

    describe("logger validation", () => {
        const getError = (function_: () => unknown): Error | undefined => {
            try {
                function_();

                return undefined;
            } catch (error) {
                return error as Error;
            }
        };

        it("should accept a valid logger object with all required methods", () => {
            expect.assertions(1);

            const validLogger = {
                debug: vi.fn(),
                error: vi.fn(),
                info: vi.fn(),
                log: vi.fn(),
                warn: vi.fn(),
            } as unknown as Console;

            expect(() => new Cli("MyCLI", { logger: validLogger })).not.toThrow();
        });

        it("should throw error when logger is missing debug method", () => {
            expect.assertions(2);

            const invalidLogger = {
                error: vi.fn(),
                info: vi.fn(),
                log: vi.fn(),
                warn: vi.fn(),
            } as unknown as Console;

            const createCli = () => new Cli("MyCLI", { logger: invalidLogger });
            const error = getError(createCli);

            expect(error?.message).toContain("Logger object is missing required methods: debug");
            expect((error as { code?: string } | undefined)?.code).toBe("INVALID_INPUT");
        });

        it("should throw error when logger is missing multiple methods", () => {
            expect.assertions(2);

            const invalidLogger = {
                debug: vi.fn(),
                error: vi.fn(),
                // Missing info, log, warn
            } as unknown as Console;

            const createCli = () => new Cli("MyCLI", { logger: invalidLogger });
            const error = getError(createCli);

            expect(error?.message).toContain("Logger object is missing required methods: info, log, warn");
            expect((error as { code?: string } | undefined)?.code).toBe("INVALID_INPUT");
        });

        it("should throw error when logger method is not a function", () => {
            expect.assertions(2);

            const invalidLogger = {
                debug: "not-a-function",
                error: vi.fn(),
                info: vi.fn(),
                log: vi.fn(),
                warn: vi.fn(),
            } as unknown as Console;

            const createCli = () => new Cli("MyCLI", { logger: invalidLogger });
            const error = getError(createCli);

            expect(error?.message).toContain("Logger object is missing required methods: debug");
            expect((error as { code?: string } | undefined)?.code).toBe("INVALID_INPUT");
        });

        it("should throw error when logger method is null", () => {
            expect.assertions(2);

            const invalidLogger = {
                debug: null,
                error: vi.fn(),
                info: vi.fn(),
                log: vi.fn(),
                warn: vi.fn(),
            } as unknown as Console;

            const createCli = () => new Cli("MyCLI", { logger: invalidLogger });
            const error = getError(createCli);

            expect(error?.message).toContain("Logger object is missing required methods: debug");
            expect((error as { code?: string } | undefined)?.code).toBe("INVALID_INPUT");
        });

        it("should throw error when logger method is undefined", () => {
            expect.assertions(2);

            const invalidLogger = {
                debug: undefined,
                error: vi.fn(),
                info: vi.fn(),
                log: vi.fn(),
                warn: vi.fn(),
            } as unknown as Console;

            const createCli = () => new Cli("MyCLI", { logger: invalidLogger });
            const error = getError(createCli);

            expect(error?.message).toContain("Logger object is missing required methods: debug");
            expect((error as { code?: string } | undefined)?.code).toBe("INVALID_INPUT");
        });

        it("should include missing methods in error context", () => {
            expect.assertions(2);

            const invalidLogger = {
                debug: vi.fn(),
                error: vi.fn(),
                // Missing info, log, warn
            } as unknown as Console;

            const createCli = () => new Cli("MyCLI", { logger: invalidLogger });
            const error = getError(createCli);

            expect(error).toHaveProperty("context");
            expect((error as { context?: { missingMethods?: string[] } } | undefined)?.context?.missingMethods).toStrictEqual(["info", "log", "warn"]);
        });

        it("should work with console object as logger", () => {
            expect.assertions(1);

            expect(() => new Cli("MyCLI", { logger: console })).not.toThrow();
        });
    });

    describe("options after positional arguments", () => {
        it("should parse options placed after the positional argument", async () => {
            expect.assertions(2);

            const execute = vi.fn();

            // Simulates: `cli run build --root=/tmp`
            const cli = new Cli("MyCLI", { argv: ["run", "build", "--root", "/tmp"] });

            cli.addCommand({
                argument: { name: "target", type: String },
                execute,
                name: "run",
                options: [{ name: "root", type: String }],
            });

            await cli.run({ shouldExitProcess: false });

            expect(execute).toHaveBeenCalledTimes(1);
            expect(execute).toHaveBeenCalledWith(
                expect.objectContaining({
                    argument: ["build"],
                    options: expect.objectContaining({
                        root: "/tmp",
                    }),
                }),
            );
        });

        it("should parse options with = notation after the positional argument", async () => {
            expect.assertions(2);

            const execute = vi.fn();

            // Simulates: `cli run build --root=/tmp`
            const cli = new Cli("MyCLI", { argv: ["run", "build", "--root=/tmp"] });

            cli.addCommand({
                argument: { name: "target", type: String },
                execute,
                name: "run",
                options: [{ name: "root", type: String }],
            });

            await cli.run({ shouldExitProcess: false });

            expect(execute).toHaveBeenCalledTimes(1);
            expect(execute).toHaveBeenCalledWith(
                expect.objectContaining({
                    argument: ["build"],
                    options: expect.objectContaining({
                        root: "/tmp",
                    }),
                }),
            );
        });

        it("should parse kebab-case options after positional argument with camelCase conversion", async () => {
            expect.assertions(2);

            const execute = vi.fn();

            // Simulates: `cli run build --cache-dir=/tmp --dry-run`
            const cli = new Cli("MyCLI", { argv: ["run", "build", "--cache-dir", "/tmp", "--dry-run"] });

            cli.addCommand({
                argument: { name: "target", type: String },
                execute,
                name: "run",
                options: [
                    { name: "cache-dir", type: String },
                    { name: "dry-run", type: Boolean },
                ],
            });

            await cli.run({ shouldExitProcess: false });

            expect(execute).toHaveBeenCalledTimes(1);
            expect(execute).toHaveBeenCalledWith(
                expect.objectContaining({
                    argument: ["build"],
                    options: expect.objectContaining({
                        cacheDir: "/tmp",
                        dryRun: true,
                    }),
                }),
            );
        });

        it("should parse options both before and after the positional argument", async () => {
            expect.assertions(2);

            const execute = vi.fn();

            // Simulates: `cli run --parallel=5 build --root=/tmp`
            const cli = new Cli("MyCLI", { argv: ["run", "--parallel", "5", "build", "--root", "/tmp"] });

            cli.addCommand({
                argument: { name: "target", type: String },
                execute,
                name: "run",
                options: [
                    { name: "root", type: String },
                    { name: "parallel", type: Number },
                ],
            });

            await cli.run({ shouldExitProcess: false });

            expect(execute).toHaveBeenCalledTimes(1);
            expect(execute).toHaveBeenCalledWith(
                expect.objectContaining({
                    argument: ["build"],
                    options: expect.objectContaining({
                        parallel: 5,
                        root: "/tmp",
                    }),
                }),
            );
        });

        it("should parse options with default values alongside post-positional options", async () => {
            expect.assertions(2);

            const execute = vi.fn();

            // Simulates: `cli run build --root=/tmp` (parallel has a defaultValue)
            const cli = new Cli("MyCLI", { argv: ["run", "build", "--root", "/tmp"] });

            cli.addCommand({
                argument: { name: "target", type: String },
                execute,
                name: "run",
                options: [
                    { name: "root", type: String },
                    { defaultValue: 3, name: "parallel", type: Number },
                    { defaultValue: false, name: "dry-run", type: Boolean },
                ],
            });

            await cli.run({ shouldExitProcess: false });

            expect(execute).toHaveBeenCalledTimes(1);
            expect(execute).toHaveBeenCalledWith(
                expect.objectContaining({
                    argument: ["build"],
                    options: expect.objectContaining({
                        dryRun: false,
                        parallel: 3,
                        root: "/tmp",
                    }),
                }),
            );
        });
    });

    describe("verbosity flags", () => {
        const originalLevel = process.env.CEREBRO_OUTPUT_LEVEL;

        afterEach(() => {
            if (originalLevel === undefined) {
                delete process.env.CEREBRO_OUTPUT_LEVEL;
            } else {
                process.env.CEREBRO_OUTPUT_LEVEL = originalLevel;
            }
        });

        it.each([
            ["--quiet", String(VERBOSITY_QUIET)],
            ["-q", String(VERBOSITY_QUIET)],
            ["--verbose", String(VERBOSITY_VERBOSE)],
            ["--debug", String(VERBOSITY_DEBUG)],
        ])("sets CEREBRO_OUTPUT_LEVEL from the %s flag", async (flag, expectedLevel) => {
            expect.assertions(2);

            const execute = vi.fn();
            const cli = new Cli("MyCLI", { argv: ["run", flag] });

            cli.addCommand({ execute, name: "run" });

            await cli.run({ shouldExitProcess: false });

            expect(execute).toHaveBeenCalledTimes(1);
            expect(process.env.CEREBRO_OUTPUT_LEVEL).toBe(expectedLevel);
        });
    });

    describe("constructor option validation", () => {
        it("throws when the CLI name is not a non-empty string", () => {
            expect.assertions(2);

            expect(() => new Cli("")).toThrow("CLI name must be a non-empty string");
            expect(() => new Cli("   ")).toThrow("CLI name must be a non-empty string");
        });

        it("throws when argv is provided but is not an array", () => {
            expect.assertions(1);

            expect(() => new Cli("MyCLI", { argv: "build" as unknown as string[] })).toThrow("CLI argv option must be an array of strings");
        });

        it("throws when cwd is provided but is not a string", () => {
            expect.assertions(1);

            expect(() => new Cli("MyCLI", { cwd: 123 as unknown as string })).toThrow("CLI cwd option must be a string");
        });

        it("throws when packageName is provided but is not a string", () => {
            expect.assertions(1);

            expect(() => new Cli("MyCLI", { packageName: 123 as unknown as string })).toThrow("CLI packageName option must be a string");
        });

        it("throws when packageVersion is provided but is not a string", () => {
            expect.assertions(1);

            expect(() => new Cli("MyCLI", { packageVersion: 1 as unknown as string })).toThrow("CLI packageVersion option must be a string");
        });

        it("throws when fs is provided but is not an object", () => {
            expect.assertions(1);

            expect(() => new Cli("MyCLI", { fs: "not-an-object" as unknown as never })).toThrow(
                "CLI fs option must be an object implementing the CerebroFs interface",
            );
        });

        it("throws when exit is provided but is not a function", () => {
            expect.assertions(1);

            expect(() => new Cli("MyCLI", { exit: "nope" as unknown as never })).toThrow("CLI exit option must be a function");
        });

        it("throws when env is provided but is not an object", () => {
            expect.assertions(1);

            expect(() => new Cli("MyCLI", { env: "nope" as unknown as never })).toThrow("CLI env option must be a record of string keys");
        });

        it("throws when stdin is provided but is not a string", () => {
            expect.assertions(1);

            expect(() => new Cli("MyCLI", { stdin: 5 as unknown as never })).toThrow("CLI stdin option must be a string");
        });

        it("accepts a valid env override and string stdin", () => {
            expect.assertions(1);

            expect(() => new Cli("MyCLI", { env: { FOO: "bar" }, stdin: "piped input" })).not.toThrow();
        });
    });

    describe("addCommand alias handling", () => {
        it("registers a command under a string alias", async () => {
            expect.assertions(1);

            const execute = vi.fn();
            const cli = new Cli("MyCLI", { argv: ["b"] });

            cli.addCommand({ alias: "b", execute, name: "build" });

            await cli.run({ shouldExitProcess: false });

            expect(execute).toHaveBeenCalledTimes(1);
        });

        it("registers a command under multiple array aliases", async () => {
            expect.assertions(1);

            const execute = vi.fn();
            const cli = new Cli("MyCLI", { argv: ["i"] });

            cli.addCommand({ alias: ["i", "inst"], execute, name: "install" });

            await cli.run({ shouldExitProcess: false });

            expect(execute).toHaveBeenCalledTimes(1);
        });

        it("throws when an alias conflicts with an existing command name", () => {
            expect.assertions(1);

            const cli = new Cli("MyCLI");

            cli.addCommand({ execute: vi.fn(), name: "build" });

            expect(() => cli.addCommand({ alias: "build", execute: vi.fn(), name: "compile" })).toThrow(
                "Command alias \"build\" conflicts with existing command",
            );
        });
    });
});
