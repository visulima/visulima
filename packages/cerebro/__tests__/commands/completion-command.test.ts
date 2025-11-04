import { beforeEach, describe, expect, it, vi } from "vitest";

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

        await completionCommand.execute?.(mockToolbox);

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

        await completionCommand.execute?.(mockToolbox);

        // Should not throw any errors
        expect(mockToolbox.logger.error).not.toHaveBeenCalled();
    });

    it("should auto-detect runtime when not provided", async () => {
        expect.assertions(1);

        mockToolbox.options = { shell: "zsh" };

        await completionCommand.execute?.(mockToolbox);

        // Should not throw any errors and should use auto-detected runtime
        expect(mockToolbox.logger.error).not.toHaveBeenCalled();
    });

    it("should throw CompletionError for invalid shell", async () => {
        expect.assertions(3);

        mockToolbox.options = { shell: "invalid-shell" };

        await expect(completionCommand.execute?.(mockToolbox)).rejects.toThrow();

        // Verify error was logged with custom error handling (combined message)
        expect(mockToolbox.logger.error).toHaveBeenCalledWith(expect.stringContaining("Invalid shell type"));
        expect(mockToolbox.logger.error).toHaveBeenCalledWith(expect.stringContaining("Troubleshooting"));
    });

    it("should throw CompletionError for invalid runtime", async () => {
        expect.assertions(3);

        mockToolbox.options = { runtime: "invalid-runtime", shell: "zsh" };

        await expect(completionCommand.execute?.(mockToolbox)).rejects.toThrow();

        // Verify error was logged with custom error handling (combined message)
        expect(mockToolbox.logger.error).toHaveBeenCalledWith(expect.stringContaining("Invalid runtime"));
        expect(mockToolbox.logger.error).toHaveBeenCalledWith(expect.stringContaining("Troubleshooting"));
    });
});
