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

        const mockLogger = { info: vi.fn() };

        const cli = new Cli("MyCLI", { logger: mockLogger });

        cli.addCommand({
            description: "A simple hello world command",
            execute: async (toolbox) => {
                toolbox.logger.info("Hello, World!");
            },
            name: "hello",
        });

        await cli.run({ argv: ["hello"] });

        expect(mockLogger.info).toHaveBeenCalledWith("Hello, World!");
    });

    it("should set and retrieve command section", () => {
        const cli = new Cli("MyCLI");
        const section = { footer: "Footer", header: "Header" };
        cli.setCommandSection(section);
        expect(cli.getCommandSection()).toEqual(section);
    });

    // set and retrieve default command
    it("should set and retrieve default command", () => {
        const cli = new Cli("MyCLI");
        cli.setDefaultCommand("version");
        expect(cli.defaultCommand).toBe("version");
    });

    // add and execute an extension
    it("should add and execute an extension", async () => {
        const cli = new Cli("MyCLI");
        const mockExtension = { execute: vi.fn(), name: "mockExtension" };
        cli.addExtension(mockExtension);
        await cli.run();
        expect(mockExtension.execute).toHaveBeenCalledWith();
    });

    // initialize Cli without required options
    it("should throw error when initializing without required options", () => {
        expect(() => new Cli()).toThrow();
    });

    // add a command with duplicate name or alias
    it("should throw error when adding a command with duplicate name or alias", () => {
        const cli = new Cli("MyCLI");
        cli.addCommand({ execute: vi.fn(), name: "duplicate" });
        expect(() => cli.addCommand({ execute: vi.fn(), name: "duplicate" })).toThrow();
    });

    // run a command with missing required options
    it("should throw error when running a command with missing required options", async () => {
        const cli = new Cli("MyCLI");
        cli.addCommand({
            execute: vi.fn(),
            name: "test",
            options: [{ name: "requiredOption", required: true, type: String }],
        });
        await expect(cli.run({ argv: ["test"] })).rejects.toThrow();
    });

    // run a command with unknown options
    it("should throw error when running a command with unknown options", async () => {
        const cli = new Cli("MyCLI");
        cli.addCommand({ execute: vi.fn(), name: "test" });
        await expect(cli.run({ argv: ["test", "--unknownOption"] })).rejects.toThrow();
    });

    // handle conflicting command options
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
