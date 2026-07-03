import { Command } from "commander";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { baseInitCommand, exitMock } = vi.hoisted(() => {
    return {
        baseInitCommand: vi.fn<(configName: string) => void>(),
        exitMock: vi.fn<(code?: number) => never>(),
    };
});

vi.mock(import("../../../../src/cli/command/init-command"), () => {
    return {
        default: baseInitCommand,
    };
});

vi.mock(import("node:process"), async () => {
    return {
        ...await vi.importActual<typeof import("node:process")>("node:process"),
        exit: exitMock,
    };
});

// eslint-disable-next-line import/first
import initCommand from "../../../../src/cli/commander/command/init-command";

describe("commander init command", () => {
    beforeEach(() => {
        baseInitCommand.mockReset();
        exitMock.mockReset();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("registers a subcommand with the default name and description", () => {
        expect.assertions(2);

        const program = new Command();

        initCommand(program);

        const sub = program.commands.find((command) => command.name() === "init");

        expect(sub).toBeDefined();
        expect(sub?.description()).toBe("Inits a pre-configured @visulima/jsdoc-open-api config file.");
    });

    it("invokes the base init command with the configured config name", async () => {
        expect.assertions(2);

        const program = new Command();

        program.exitOverride();
        initCommand(program, "init", "An init command", "my.openapirc.js");

        await program.parseAsync(["init"], { from: "user" });

        expect(baseInitCommand).toHaveBeenCalledTimes(1);
        expect(baseInitCommand).toHaveBeenCalledWith("my.openapirc.js");
    });

    it("logs the error and exits with code 1 when the base command throws", async () => {
        expect.assertions(2);

        const failure = new Error("init failed");

        baseInitCommand.mockImplementation(() => {
            throw failure;
        });

        const consoleErrorMock = vi.spyOn(console, "error").mockImplementation(() => undefined);

        const program = new Command();

        program.exitOverride();
        initCommand(program);

        await program.parseAsync(["init"], { from: "user" });

        expect(consoleErrorMock).toHaveBeenCalledWith(failure);
        expect(exitMock).toHaveBeenCalledWith(1);
    });
});
