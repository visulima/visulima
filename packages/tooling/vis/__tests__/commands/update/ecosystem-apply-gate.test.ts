import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { shouldApplyEcosystem } from "../../../src/commands/update/handler";

// `is-in-ci` exports a boolean default. We back it with a mutable holder so
// individual tests can flip the CI state — `import isInCi from "is-in-ci"` is a
// live binding, so reading it re-evaluates the getter each time.
const ciState = vi.hoisted(() => {
    return { value: false };
});

vi.mock(import("is-in-ci"), () => {
    return {
        get default() {
            return ciState.value;
        },
    };
});

interface UpdatePathResult {
    readonly applied: boolean;
    readonly canceled: boolean;
    readonly jsonEmitted: boolean;
}

const catalogResult = (overrides: Partial<UpdatePathResult> = {}): UpdatePathResult => {
    return {
        applied: false,
        canceled: false,
        jsonEmitted: false,
        ...overrides,
    };
};

describe(shouldApplyEcosystem, () => {
    let originalTTY: boolean | undefined;
    let originalExitCode: number | string | undefined;

    beforeEach(() => {
        originalTTY = process.stdout.isTTY;
        originalExitCode = process.exitCode;
        // Default to an interactive-capable TTY; individual tests override.
        process.stdout.isTTY = true;
        process.exitCode = undefined;
    });

    afterEach(() => {
        if (originalTTY === undefined) {
            delete (process.stdout as { isTTY?: boolean }).isTTY;
        } else {
            process.stdout.isTTY = originalTTY;
        }

        process.exitCode = originalExitCode;
        ciState.value = false;
    });

    it("applies when --yes is passed", () => {
        expect.assertions(1);

        expect(shouldApplyEcosystem({ yes: true }, catalogResult())).toBe(true);
    });

    it("applies when --interactive is passed in a TTY", () => {
        expect.assertions(1);

        expect(shouldApplyEcosystem({ interactive: true }, catalogResult())).toBe(true);
    });

    it("does NOT apply --interactive when stdout is not a TTY", () => {
        expect.assertions(1);

        process.stdout.isTTY = false;

        expect(shouldApplyEcosystem({ interactive: true }, catalogResult())).toBe(false);
    });

    it("does NOT apply --interactive when running in CI (even on a TTY)", () => {
        expect.assertions(1);

        // CI runners can report a TTY, so the interactive picker must still be
        // refused — there is no human to drive it.
        ciState.value = true;

        expect(shouldApplyEcosystem({ interactive: true }, catalogResult())).toBe(false);
    });

    it("does NOT auto-apply just because the catalog/npm path applied (the piggyback path is gone)", () => {
        expect.assertions(1);

        // Plain `vis update` in a TTY that bumped npm deps must still leave
        // ecosystem references in preview-only mode.
        expect(shouldApplyEcosystem({}, catalogResult({ applied: true }))).toBe(false);
    });

    it("does NOT apply on plain invocation with no opt-in flags", () => {
        expect.assertions(1);

        expect(shouldApplyEcosystem({}, catalogResult())).toBe(false);
    });

    it("refuses on --dry-run even with --yes", () => {
        expect.assertions(1);

        expect(shouldApplyEcosystem({ dryRun: true, yes: true }, catalogResult())).toBe(false);
    });

    it("refuses when a prior stage set a non-zero exit code", () => {
        expect.assertions(1);

        process.exitCode = 1;

        expect(shouldApplyEcosystem({ yes: true }, catalogResult())).toBe(false);
    });

    it("refuses when the catalog TUI was canceled", () => {
        expect.assertions(1);

        expect(shouldApplyEcosystem({ yes: true }, catalogResult({ canceled: true }))).toBe(false);
    });
});
