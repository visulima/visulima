import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildMigrationHandoffPrompt, maybeOfferAiHandoff } from "../../../src/commands/migrate/ai-handoff";
import { createMigrationReport } from "../../../src/commands/migrate/types";
import { createMockLogger } from "../../test-helpers";

const { confirmMock, resolveProviderMock, runInteractiveHandoffMock } = vi.hoisted(() => {
    return {
        confirmMock: vi.fn<() => Promise<boolean>>(),
        resolveProviderMock: vi.fn(),
        runInteractiveHandoffMock: vi.fn<() => Promise<string>>(),
    };
});

vi.mock(import("../../../src/commands/migrate/prompt"), () => {
    return { confirm: confirmMock };
});

vi.mock(import("../../../src/ai/provider-resolver"), () => {
    return { resolveProvider: resolveProviderMock };
});

vi.mock(import("../../../src/ai/ai-runner"), () => {
    return { runInteractiveHandoff: runInteractiveHandoffMock };
});

const FAKE_PROVIDER = { available: true, name: "claude", path: "/usr/local/bin/claude" };

const reportWithSteps = () => {
    const report = createMigrationReport();

    report.manualSteps.push("Convert .lintstagedrc.js to staged config in vis.config.ts");
    report.warnings.push("secretlint JS config — review manually");

    return report;
};

describe("migrate ai-handoff", () => {
    let originalIsTty: boolean | undefined;

    beforeEach(() => {
        confirmMock.mockReset();
        resolveProviderMock.mockReset();
        runInteractiveHandoffMock.mockReset();
        runInteractiveHandoffMock.mockResolvedValue("done");

        originalIsTty = process.stdin.isTTY;
    });

    afterEach(() => {
        Object.defineProperty(process.stdin, "isTTY", { configurable: true, value: originalIsTty });
    });

    const setTty = (value: boolean): void => {
        Object.defineProperty(process.stdin, "isTTY", { configurable: true, value });
    };

    it("builds a prompt that lists the manual steps and warnings", () => {
        expect.assertions(3);

        const prompt = buildMigrationHandoffPrompt(reportWithSteps(), "/repo");

        expect(prompt).toContain("/repo");
        expect(prompt).toContain("Convert .lintstagedrc.js to staged config");
        expect(prompt).toContain("secretlint JS config");
    });

    it("runs the provider with file-editing enabled after the user confirms", async () => {
        expect.assertions(4);

        setTty(true);
        resolveProviderMock.mockReturnValue(FAKE_PROVIDER);
        confirmMock.mockResolvedValue(true);

        await maybeOfferAiHandoff("/repo", reportWithSteps(), { ai: true }, createMockLogger());

        expect(runInteractiveHandoffMock).toHaveBeenCalledTimes(1);

        const [provider, prompt, options] = runInteractiveHandoffMock.mock.calls[0] as [typeof FAKE_PROVIDER, string, { cwd?: string }];

        expect(provider.name).toBe("claude");
        expect(options.cwd).toBe("/repo");
        expect(prompt).toContain("Convert .lintstagedrc.js to staged config");
    });

    it("prints the prompt instead of running when the user declines", async () => {
        expect.assertions(2);

        setTty(true);
        resolveProviderMock.mockReturnValue(FAKE_PROVIDER);
        confirmMock.mockResolvedValue(false);

        const logger = createMockLogger();

        await maybeOfferAiHandoff("/repo", reportWithSteps(), { ai: true }, logger);

        expect(runInteractiveHandoffMock).not.toHaveBeenCalled();
        expect(logger.infoMessages.join("\n")).toContain("paste the following");
    });

    it("logs a hint and does not prompt when no AI CLI is detected", async () => {
        expect.assertions(2);

        setTty(true);
        resolveProviderMock.mockReturnValue(undefined);

        const logger = createMockLogger();

        await maybeOfferAiHandoff("/repo", reportWithSteps(), { ai: true }, logger);

        expect(confirmMock).not.toHaveBeenCalled();
        expect(logger.infoMessages.join("\n")).toContain("install a supported AI CLI");
    });

    it("never runs in a non-TTY context (CI-safe)", async () => {
        expect.assertions(2);

        setTty(false);
        resolveProviderMock.mockReturnValue(FAKE_PROVIDER);
        confirmMock.mockResolvedValue(true);

        await maybeOfferAiHandoff("/repo", reportWithSteps(), { ai: true }, createMockLogger());

        expect(resolveProviderMock).not.toHaveBeenCalled();
        expect(runInteractiveHandoffMock).not.toHaveBeenCalled();
    });

    it("skips when suppressed with --no-ai, on dry-run, or when there is nothing left to do", async () => {
        expect.assertions(3);

        setTty(true);
        resolveProviderMock.mockReturnValue(FAKE_PROVIDER);

        await maybeOfferAiHandoff("/repo", reportWithSteps(), { ai: false }, createMockLogger());
        await maybeOfferAiHandoff("/repo", reportWithSteps(), { ai: true, dryRun: true }, createMockLogger());
        await maybeOfferAiHandoff("/repo", createMigrationReport(), { ai: true }, createMockLogger());

        expect(confirmMock).not.toHaveBeenCalled();
        expect(resolveProviderMock).not.toHaveBeenCalled();
        expect(runInteractiveHandoffMock).not.toHaveBeenCalled();
    });
});
