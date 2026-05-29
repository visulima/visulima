import { Command } from "commander";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { baseGenerateCommand, exitMock } = vi.hoisted(() => {
    return {
        baseGenerateCommand: vi.fn<(configName: string, paths: string[], options: Record<string, unknown>) => Promise<void>>(),
        exitMock: vi.fn<(code?: number) => never>(),
    };
});

vi.mock(import("../../../../src/cli/command/generate-command"), () => {
    return {
        default: baseGenerateCommand,
    };
});

vi.mock(import("node:process"), async () => {
    return {
        ...await vi.importActual<typeof import("node:process")>("node:process"),
        exit: exitMock,
    };
});

// eslint-disable-next-line import/first
import generateCommand from "../../../../src/cli/commander/command/generate-command";

describe("commander generate command", () => {
    beforeEach(() => {
        baseGenerateCommand.mockReset();
        exitMock.mockReset();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("registers a subcommand with the expected name, description and options", () => {
        expect.assertions(3);

        const program = new Command();

        generateCommand(program);

        const sub = program.commands.find((command) => command.name() === "generate");

        expect(sub).toBeDefined();
        expect(sub?.description()).toBe("Generates OpenAPI (Swagger) documentation from JSDoc's");
        expect(sub?.options.map((option) => option.long)).toStrictEqual(["--config", "--output", "--verbose", "--very-verbose"]);
    });

    it("forwards parsed paths and options to the base generate command", async () => {
        expect.assertions(2);

        baseGenerateCommand.mockResolvedValue();

        const program = new Command();

        program.exitOverride();
        generateCommand(program);

        await program.parseAsync(["generate", "src", "docs", "--output", "out.json", "--verbose"], { from: "user" });

        expect(baseGenerateCommand).toHaveBeenCalledTimes(1);
        expect(baseGenerateCommand).toHaveBeenCalledWith(
            ".openapirc.js",
            ["src", "docs"],
            expect.objectContaining({ output: "out.json", verbose: true }),
        );
    });

    it("logs the error and exits with code 1 when the base command rejects", async () => {
        expect.assertions(2);

        const failure = new Error("generation failed");

        baseGenerateCommand.mockRejectedValue(failure);

        const consoleErrorMock = vi.spyOn(console, "error").mockImplementation(() => undefined);

        const program = new Command();

        program.exitOverride();
        generateCommand(program);

        await program.parseAsync(["generate"], { from: "user" });

        expect(consoleErrorMock).toHaveBeenCalledWith(failure);
        expect(exitMock).toHaveBeenCalledWith(1);
    });

    it("honours a custom command name and config name", () => {
        expect.assertions(1);

        const program = new Command();

        generateCommand(program, "build-docs", "custom.openapirc.js");

        expect(program.commands.some((command) => command.name() === "build-docs")).toBe(true);
    });
});
