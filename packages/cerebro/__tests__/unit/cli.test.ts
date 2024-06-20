import { describe, expect, it, vi } from "vitest";

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
        const cli = new Cli("MyCLI");
        const section = { footer: "Footer", header: "Header" };
        cli.setCommandSection(section);
        expect(cli.getCommandSection()).toEqual(section);
    });

    it("should set and retrieve default command", () => {
        const cli = new Cli("MyCLI");

        cli.setDefaultCommand("version");

        expect(cli.defaultCommand).toBe("version");
    });

    it("should throw error when adding a command with duplicate name or alias", () => {
        const cli = new Cli("MyCLI");
        cli.addCommand({ execute: vi.fn(), name: "duplicate" });
        expect(() => cli.addCommand({ execute: vi.fn(), name: "duplicate" })).toThrow();
    });

    it("should throw error when running a command with missing required options", async () => {
        const cli = new Cli("MyCLI");
        cli.addCommand({
            execute: vi.fn(),
            name: "test",
            options: [{ name: "requiredOption", required: true, type: String }],
        });
        await expect(cli.run({ argv: ["test"] })).rejects.toThrow();
    });

    it("should throw error when running a command with unknown options", async () => {
        const cli = new Cli("MyCLI");
        cli.addCommand({ execute: vi.fn(), name: "test" });
        await expect(cli.run({ argv: ["test", "--unknownOption"] })).rejects.toThrow();
    });

    it("should throw error when running a command with conflicting options", async () => {
        const cli = new Cli("MyCLI");

        cli.addCommand({
            execute: vi.fn(),
            name: "test",
            options: [
                { conflicts: "option2", name: "option1", type: String },
                { name: "option2", type: String },
            ],
        });

        await expect(cli.run({ argv: ["test", "--option1", "value1", "--option2", "value2"] })).rejects.toThrow();
    });
});
