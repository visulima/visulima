import { describe, expect, it, vi } from "vitest";

// eslint-disable-next-line import/no-named-as-default
import Cli from "../../src";

describe("cli", () => {
    it("should initialize Cli with default options", () => {
        expect.assertions(4);

        const cli = new Cli("MyCLI");

        expect(cli.getCliName()).toBe("MyCLI");
        expect(cli.getPackageVersion()).toBeUndefined();
        expect(cli.getPackageName()).toBeUndefined();
        expect(cli.getCommands().size).toBe(4); // help and version commands
    });

    it("should add a command and execute it successfully", async () => {
        expect.assertions(1);

        const mockedExecute = vi.fn().mockResolvedValue(undefined);

        const cli = new Cli("MyCLI", { argv: ["hello"] });

        cli.addCommand({
            description: "A simple hello world command",
            execute: mockedExecute,
            name: "hello",
        });

        await cli.run({ shouldExitProcess: false });

        expect(mockedExecute).toHaveBeenCalledOnce();
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

        expect(() => cli.addCommand({ execute: vi.fn(), name: "duplicate" })).toThrow(
            'Ignored command with name "duplicate", it was found in the command list.',
        );
    });

    it("should throw error when running a command with missing required options", async () => {
        expect.assertions(1);

        const cli = new Cli("MyCLI", { argv: ["test"] });

        cli.addCommand({
            execute: vi.fn(),
            name: "test",
            options: [{ name: "requiredOption", required: true, type: String }],
        });

        await expect(() => cli.run()).rejects.toThrow('You called the command "test" without the required options: requiredOption');
    });

    it("should throw error when running a command with unknown options", async () => {
        expect.assertions(1);

        const cli = new Cli("MyCLI", { argv: ["test", "--unknownOption"] });

        cli.addCommand({ execute: vi.fn(), name: "test" });

        await expect(cli.run()).rejects.toThrow('Found unknown option "--unknownOption"');
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

        await expect(cli.run()).rejects.toThrow('You called the command "test" with conflicting options: option1 and option2');
    });
});
