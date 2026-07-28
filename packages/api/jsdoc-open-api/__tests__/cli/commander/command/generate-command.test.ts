import { Command } from "commander";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { baseGenerateCommand, exitMock, watchMock } = vi.hoisted(() => {
    return {
        baseGenerateCommand: vi.fn<(configName: string, paths: string[], options: Record<string, unknown>) => Promise<void>>(),
        exitMock: vi.fn<(code?: number) => never>(),
        watchMock: vi.fn(),
    };
});

vi.mock(import("../../../../src/cli/command/generate-command"), () => {
    return {
        default: baseGenerateCommand,
    };
});

vi.mock(import("node:fs"), async () => {
    return {
        ...await vi.importActual<typeof import("node:fs")>("node:fs"),
        watch: watchMock,
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
        watchMock.mockReset();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    it("registers a subcommand with the expected name, description and options", () => {
        expect.assertions(3);

        const program = new Command();

        generateCommand(program);

        const sub = program.commands.find((command) => command.name() === "generate");

        expect(sub).toBeDefined();
        expect(sub?.description()).toBe("Generates OpenAPI (Swagger) documentation from JSDoc's");
        expect(sub?.options.map((option) => option.long)).toStrictEqual([
            "--config",
            "--definition",
            "--output",
            "--watch",
            "--verbose",
            "--very-verbose",
        ]);
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

    it("runs an initial generation and logs (not throws) its rejection in watch mode", async () => {
        expect.assertions(3);

        const failure = new Error("initial run failed");

        baseGenerateCommand.mockRejectedValueOnce(failure);
        watchMock.mockReturnValue({ close: vi.fn() });

        const consoleErrorMock = vi.spyOn(console, "error").mockImplementation(() => undefined);

        vi.spyOn(console, "log").mockImplementation(() => undefined);

        const program = new Command();

        program.exitOverride();
        generateCommand(program);

        await program.parseAsync(["generate", "src", "--watch"], { from: "user" });

        expect(baseGenerateCommand).toHaveBeenCalledTimes(1);
        expect(consoleErrorMock).toHaveBeenCalledWith(failure);
        expect(watchMock).toHaveBeenCalledTimes(1);
    });

    it("reruns generation, debounced, when a watched path emits a change", async () => {
        expect.assertions(2);

        vi.useFakeTimers();
        baseGenerateCommand.mockResolvedValue();

        let listener: ((event: string, filename: string) => void) | undefined;

        watchMock.mockImplementation((_path: string, _options: unknown, callback: (event: string, filename: string) => void) => {
            listener = callback;

            return { close: vi.fn() };
        });

        vi.spyOn(console, "log").mockImplementation(() => undefined);

        const program = new Command();

        program.exitOverride();
        generateCommand(program);

        await program.parseAsync(["generate", "src", "--watch"], { from: "user" });

        expect(baseGenerateCommand).toHaveBeenCalledTimes(1);

        // A burst of events must collapse into a single rerun.
        listener?.("change", "a.ts");
        listener?.("change", "b.ts");

        await vi.advanceTimersByTimeAsync(300);

        expect(baseGenerateCommand).toHaveBeenCalledTimes(2);
    });

    it("ignores change events for the generated output file", async () => {
        expect.assertions(2);

        vi.useFakeTimers();
        baseGenerateCommand.mockResolvedValue();

        let listener: ((event: string, filename: string) => void) | undefined;

        watchMock.mockImplementation((_path: string, _options: unknown, callback: (event: string, filename: string) => void) => {
            listener = callback;

            return { close: vi.fn() };
        });

        vi.spyOn(console, "log").mockImplementation(() => undefined);

        const program = new Command();

        program.exitOverride();
        generateCommand(program);

        // Watch "." with the default output "swagger.json" living inside it.
        await program.parseAsync(["generate", ".", "--watch"], { from: "user" });

        expect(baseGenerateCommand).toHaveBeenCalledTimes(1);

        listener?.("change", "swagger.json");

        await vi.advanceTimersByTimeAsync(300);

        expect(baseGenerateCommand).toHaveBeenCalledTimes(1);
    });

    it("closes watchers and exits 0 on SIGINT", async () => {
        expect.assertions(2);

        baseGenerateCommand.mockResolvedValue();

        const close = vi.fn();

        watchMock.mockReturnValue({ close });

        let sigintHandler: (() => void) | undefined;

        vi.spyOn(process, "once").mockImplementation((event: string | symbol, handler: (...args: any[]) => void) => {
            if (event === "SIGINT") {
                sigintHandler = handler;
            }

            return process;
        });

        vi.spyOn(console, "log").mockImplementation(() => undefined);

        const program = new Command();

        program.exitOverride();
        generateCommand(program);

        await program.parseAsync(["generate", "src", "--watch"], { from: "user" });

        sigintHandler?.();

        expect(close).toHaveBeenCalledTimes(1);
        expect(exitMock).toHaveBeenCalledWith(0);
    });

    it("logs the error and exits 1 when starting watch mode throws", async () => {
        expect.assertions(2);

        const failure = new Error("watch target missing");

        watchMock.mockImplementation(() => {
            throw failure;
        });

        baseGenerateCommand.mockResolvedValue();

        const consoleErrorMock = vi.spyOn(console, "error").mockImplementation(() => undefined);

        vi.spyOn(console, "log").mockImplementation(() => undefined);

        const program = new Command();

        program.exitOverride();
        generateCommand(program);

        await program.parseAsync(["generate", "missing", "--watch"], { from: "user" });

        expect(consoleErrorMock).toHaveBeenCalledWith(failure);
        expect(exitMock).toHaveBeenCalledWith(1);
    });
});
