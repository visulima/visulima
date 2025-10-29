import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Toolbox } from "../../src/@types/toolbox";
import completionCommand from "../../src/commands/completion-command";

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
        expect(completionCommand.name).toBe("completion");
        expect(completionCommand.description).toBe("Generate shell completion scripts");
        expect(completionCommand.options).toHaveLength(2);
        expect(completionCommand.options?.[0]?.name).toBe("shell");
        expect(completionCommand.options?.[1]?.name).toBe("runtime");
    });

    it("should display usage when no shell option is provided and detection fails", async () => {
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
        if (originalShell) {
            process.env.SHELL = originalShell;
        }

        if (originalStarship) {
            process.env.STARSHIP_SHELL = originalStarship;
        }
    });

    it("should use custom runtime when provided", async () => {
        mockToolbox.options = { shell: "zsh", runtime: "bun" };

        await completionCommand.execute?.(mockToolbox);

        // Should not throw any errors
        expect(mockToolbox.logger.error).not.toHaveBeenCalled();
    });

    it("should auto-detect runtime when not provided", async () => {
        mockToolbox.options = { shell: "zsh" };

        await completionCommand.execute?.(mockToolbox);

        // Should not throw any errors and should use auto-detected runtime
        expect(mockToolbox.logger.error).not.toHaveBeenCalled();
    });
});

