import { describe, expect, it, vi } from "vitest";

import { Cerebro as Cli } from "../../src";

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

        // @ts-expect-error - Testing private method
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

    describe("runCommand", () => {
        it("should execute a command programmatically from within another command", async () => {
            expect.assertions(3);

            const buildExecute = vi.fn().mockResolvedValue("build-result");
            const deployExecute = vi.fn().mockImplementation(async ({ runtime }) => {
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
            const parentExecute = vi.fn().mockImplementation(async ({ runtime }) => {
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
            const parentExecute = vi.fn().mockImplementation(async ({ runtime }) => {
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
            const parentExecute = vi.fn().mockImplementation(async ({ runtime }) => {
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

            const parentExecute = vi.fn().mockImplementation(async ({ runtime }) => {
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

        it("should throw error when command has no execute function", async () => {
            expect.assertions(1);

            const parentExecute = vi.fn().mockImplementation(async ({ runtime }) => {
                await runtime.runCommand("invalid");
            });

            const cli = new Cli("MyCLI", { argv: ["parent"] });

            // Add a command without execute function
            cli.addCommand({
                // @ts-expect-error - Testing invalid command
                execute: undefined,
                name: "invalid",
            });

            cli.addCommand({
                execute: parentExecute,
                name: "parent",
            });

            await expect(cli.run({ shouldExitProcess: false })).rejects.toThrow("Command \"invalid\" has no function to execute");
        });

        it("should validate required options for called command", async () => {
            expect.assertions(1);

            const parentExecute = vi.fn().mockImplementation(async ({ runtime }) => {
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

            const parentExecute = vi.fn().mockImplementation(async ({ runtime }) => {
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
            const parentExecute = vi.fn().mockImplementation(async ({ runtime }) => {
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
            const parentExecute = vi.fn().mockImplementation(async ({ runtime }) => {
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
            const testExecute = vi.fn().mockImplementation(async ({ runtime }) => {
                await runtime.runCommand("build");
            });
            const deployExecute = vi.fn().mockImplementation(async ({ runtime }) => {
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
            await expect(buildExecute.mock.results[0]?.value).resolves.toBe("build-result");
        });
    });
});
