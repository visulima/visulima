import tab from "@bomb.sh/tab";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import completionCommand from "../../src/commands/completion-command";
import type { Toolbox } from "../../src/types/toolbox";

describe("completion-command", () => {
    let mockToolbox: Toolbox;

    beforeEach(() => {
        mockToolbox = {
            logger: {
                error: vi.fn(),
                info: vi.fn(),
                log: vi.fn(),
                warn: vi.fn(),
            },
            options: {},
            runtime: {
                getCliName: vi.fn(() => "test-cli"),
                getCommands: vi.fn(() => new Map()),
            },
        } as unknown as Toolbox;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("should have correct command metadata", () => {
        expect.assertions(5);

        expect(completionCommand.name).toBe("completion");
        expect(completionCommand.description).toBe("Generate shell completion scripts");
        expect(completionCommand.options).toHaveLength(2);
        expect(completionCommand.options?.[0]?.name).toBe("shell");
        expect(completionCommand.options?.[1]?.name).toBe("runtime");
    });

    it("should display usage when no shell option is provided and detection fails", async () => {
        expect.assertions(3);

        mockToolbox.options = {};

        // Clear SHELL environment variable to simulate detection failure
        const originalShell = process.env.SHELL;
        const originalStarship = process.env.STARSHIP_SHELL;

        delete process.env.SHELL;
        delete process.env.STARSHIP_SHELL;

        await completionCommand.execute(mockToolbox);

        expect(mockToolbox.logger.error).toHaveBeenCalledWith("Could not detect current shell");
        expect(mockToolbox.logger.info).toHaveBeenCalledWith(expect.stringContaining("Usage:"));
        expect(mockToolbox.logger.info).toHaveBeenCalledWith(expect.stringContaining("--runtime"));

        // Restore SHELL
        // eslint-disable-next-line vitest/no-conditional-in-test
        if (originalShell) {
            process.env.SHELL = originalShell;
        }

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (originalStarship) {
            process.env.STARSHIP_SHELL = originalStarship;
        }
    });

    it("should use custom runtime when provided", async () => {
        expect.assertions(1);

        mockToolbox.options = { runtime: "bun", shell: "zsh" };

        await completionCommand.execute(mockToolbox);

        // Should not throw any errors
        expect(mockToolbox.logger.error).not.toHaveBeenCalled();
    });

    it("should auto-detect runtime when not provided", async () => {
        expect.assertions(1);

        mockToolbox.options = { shell: "zsh" };

        await completionCommand.execute(mockToolbox);

        // Should not throw any errors and should use auto-detected runtime
        expect(mockToolbox.logger.error).not.toHaveBeenCalled();
    });

    it("should throw CompletionError for invalid shell", async () => {
        expect.assertions(3);

        mockToolbox.options = { shell: "invalid-shell" };

        await expect(completionCommand.execute(mockToolbox)).rejects.toThrow("Invalid shell type");

        // Verify error was logged with custom error handling (combined message)
        expect(mockToolbox.logger.error).toHaveBeenCalledWith(expect.stringContaining("Invalid shell type"));
        expect(mockToolbox.logger.error).toHaveBeenCalledWith(expect.stringContaining("Troubleshooting"));
    });

    it("should throw CompletionError for invalid runtime", async () => {
        expect.assertions(3);

        mockToolbox.options = { runtime: "invalid-runtime", shell: "zsh" };

        await expect(completionCommand.execute(mockToolbox)).rejects.toThrow("Invalid runtime");

        // Verify error was logged with custom error handling (combined message)
        expect(mockToolbox.logger.error).toHaveBeenCalledWith(expect.stringContaining("Invalid runtime"));
        expect(mockToolbox.logger.error).toHaveBeenCalledWith(expect.stringContaining("Troubleshooting"));
    });

    describe("shell detection from toolbox env", () => {
        it.each([
            ["zsh", { shell: "/usr/bin/zsh" }],
            ["bash", { shell: "/bin/bash" }],
            ["fish", { shell: "/usr/local/bin/fish" }],
        ])("detects %s from the SHELL env var", async (_label, env) => {
            expect.assertions(1);

            mockToolbox.options = {};
            mockToolbox.env = env;

            await completionCommand.execute(mockToolbox);

            expect(mockToolbox.logger.error).not.toHaveBeenCalled();
        });

        it("prefers starshipShell over shell", async () => {
            expect.assertions(1);

            mockToolbox.options = {};
            mockToolbox.env = { shell: "/bin/bash", starshipShell: "zsh" };

            await completionCommand.execute(mockToolbox);

            expect(mockToolbox.logger.error).not.toHaveBeenCalled();
        });

        it("detects powershell from PSModulePath", async () => {
            expect.assertions(1);

            mockToolbox.options = {};
            mockToolbox.env = { psModulePath: "C:/Modules" };

            await completionCommand.execute(mockToolbox);

            expect(mockToolbox.logger.error).not.toHaveBeenCalled();
        });

        it("detects powershell from a PROMPT containing PS", async () => {
            expect.assertions(1);

            mockToolbox.options = {};
            mockToolbox.env = { prompt: String.raw`PS C:\>` };

            await completionCommand.execute(mockToolbox);

            expect(mockToolbox.logger.error).not.toHaveBeenCalled();
        });

        it("falls back to bash when ComSpec points to cmd.exe", async () => {
            expect.assertions(1);

            mockToolbox.options = {};
            mockToolbox.env = { comSpec: "C:/Windows/System32/cmd.exe" };

            await completionCommand.execute(mockToolbox);

            expect(mockToolbox.logger.error).not.toHaveBeenCalled();
        });

        it("shows usage when env contains no recognizable shell hint", async () => {
            expect.assertions(2);

            mockToolbox.options = {};
            mockToolbox.env = { shell: "/usr/bin/elvish" };

            await completionCommand.execute(mockToolbox);

            expect(mockToolbox.logger.error).toHaveBeenCalledWith("Could not detect current shell");
            expect(mockToolbox.logger.info).toHaveBeenCalledWith(expect.stringContaining("Usage:"));
        });
    });

    it("registers visible commands and their options with the tab system", async () => {
        expect.assertions(2);

        const optionSpy = vi.fn();
        const commandSpy = vi.fn(() => {
            return { option: optionSpy };
        });

        vi.spyOn(tab, "command").mockImplementation(commandSpy as never);
        vi.spyOn(tab, "setup").mockImplementation(() => {});

        const commands = new Map([["b", { description: "Build it", name: "build" }], ["build", {
            description: "Build it",
            name: "build",
            options: [
                { alias: "w", description: "Watch mode", name: "watch", type: Boolean },
                { description: "Hidden flag", hidden: true, name: "secret", type: Boolean },
                { description: "No name", name: "", type: Boolean },
            ],
        }], ["internal", { description: "Internal", hidden: true, name: "internal" }]]);

        // Alias entry: key differs from command.name, should be skipped.
        // Hidden command, should be skipped.

        (mockToolbox.runtime.getCommands as ReturnType<typeof vi.fn>).mockReturnValue(commands);
        mockToolbox.options = { shell: "zsh" };

        await completionCommand.execute(mockToolbox);

        // Only the "build" command is registered (alias + hidden are skipped).
        expect(commandSpy).toHaveBeenCalledTimes(1);
        // Visible "watch" option registers its name and its alias; "secret" (hidden)
        // and the unnamed option are skipped.
        expect(optionSpy).toHaveBeenCalledTimes(2);
    });

    it("logs a generic troubleshooting message when setup throws a non-CompletionError", async () => {
        expect.assertions(2);

        vi.spyOn(tab, "setup").mockImplementation(() => {
            throw new Error("tab exploded");
        });

        mockToolbox.options = { shell: "zsh" };

        await completionCommand.execute(mockToolbox);

        expect(mockToolbox.logger.error).toHaveBeenCalledWith(expect.stringContaining("Failed to generate completion script"));
        expect(mockToolbox.logger.error).toHaveBeenCalledWith(expect.stringContaining("tab exploded"));
    });
});
