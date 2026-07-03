import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { requireBlanketUpdateConfirmation } from "../../../src/commands/update/handler";

vi.mock(import("is-in-ci"), () => {
    return { default: false };
});

type LoggerCall = [string, ...unknown[]];

const makeLogger = (): { calls: LoggerCall[]; logger: Console } => {
    const calls: LoggerCall[] = [];

    return {
        calls,
        logger: {
            debug: (...args: unknown[]) => calls.push(["debug", ...args]),
            error: (...args: unknown[]) => calls.push(["error", ...args]),
            info: (...args: unknown[]) => calls.push(["info", ...args]),
            warn: (...args: unknown[]) => calls.push(["warn", ...args]),
        } as unknown as Console,
    };
};

describe(requireBlanketUpdateConfirmation, () => {
    let originalTTY: boolean | undefined;
    let originalExitCode: number | string | undefined;

    beforeEach(() => {
        originalTTY = process.stdout.isTTY;
        originalExitCode = process.exitCode;
    });

    afterEach(() => {
        if (originalTTY === undefined) {
            delete (process.stdout as { isTTY?: boolean }).isTTY;
        } else {
            process.stdout.isTTY = originalTTY;
        }

        process.exitCode = originalExitCode;
    });

    it("passes through when explicit package args are present (even with --latest)", async () => {
        expect.assertions(2);

        const { calls, logger } = makeLogger();
        const proceed = await requireBlanketUpdateConfirmation({ latest: true }, true, logger);

        expect(proceed).toBe(true);
        // No logs should be emitted on the fast path.
        expect(calls).toHaveLength(0);
    });

    it("passes through when neither --latest nor --target=latest is set", async () => {
        expect.assertions(1);

        const { logger } = makeLogger();
        // No package args, no latest → ordinary semver-range update, no gate.
        const proceed = await requireBlanketUpdateConfirmation({}, false, logger);

        expect(proceed).toBe(true);
    });

    it("passes through on --dry-run without prompting", async () => {
        expect.assertions(2);

        const { calls, logger } = makeLogger();
        const proceed = await requireBlanketUpdateConfirmation({ dryRun: true, latest: true }, false, logger);

        expect(proceed).toBe(true);
        expect(calls).toHaveLength(0);
    });

    it("passes through on --yes without prompting", async () => {
        expect.assertions(2);

        const { calls, logger } = makeLogger();
        const proceed = await requireBlanketUpdateConfirmation({ latest: true, yes: true }, false, logger);

        expect(proceed).toBe(true);
        expect(calls).toHaveLength(0);
    });

    it("passes through on --interactive (TUI has its own selection step)", async () => {
        expect.assertions(2);

        const { calls, logger } = makeLogger();
        const proceed = await requireBlanketUpdateConfirmation({ interactive: true, latest: true }, false, logger);

        expect(proceed).toBe(true);
        expect(calls).toHaveLength(0);
    });

    it("refuses with exit 1 in a non-TTY context when --latest blanket update is requested", async () => {
        expect.assertions(3);

        // Force non-TTY: simulates CI / piped invocation.
        process.stdout.isTTY = false;

        const { calls, logger } = makeLogger();
        const proceed = await requireBlanketUpdateConfirmation({ latest: true }, false, logger);

        expect(proceed).toBe(false);
        expect(process.exitCode).toBe(1);
        // Two error lines: refusal + remediation hint.
        expect(calls.filter((c) => c[0] === "error").length).toBeGreaterThanOrEqual(1);
    });

    it("also gates --target=latest (semantic equivalent of --latest)", async () => {
        expect.assertions(2);

        process.stdout.isTTY = false;

        const { logger } = makeLogger();
        const proceed = await requireBlanketUpdateConfirmation({ target: "latest" }, false, logger);

        expect(proceed).toBe(false);
        expect(process.exitCode).toBe(1);
    });

    it("does NOT gate --target=minor / --target=patch (constrained updates)", async () => {
        expect.assertions(2);

        process.stdout.isTTY = false;

        const { logger } = makeLogger();

        await expect(requireBlanketUpdateConfirmation({ target: "minor" }, false, logger)).resolves.toBe(true);
        await expect(requireBlanketUpdateConfirmation({ target: "patch" }, false, logger)).resolves.toBe(true);
    });
});
