import { mkdirSync, utimesSync, writeFileSync } from "node:fs";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Pin TTY mode so the helper takes the warn-and-continue path regardless of
// the host CI env. `is-in-ci` resolves once at import — without this mock,
// running the suite under GitHub Actions (where CI=true) would flip the
// helper into throw-mode and the test would assert the wrong path.
vi.mock("is-in-ci", () => ({ default: false }));

import runExecute from "../../../src/commands/run/handler";
import { cleanupTemporaryDirectory, createTemporaryDirectory } from "../../test-helpers";

const makeLogger = (): {
    calls: { args: unknown[]; level: "debug" | "error" | "info" | "warn" }[];
    logger: {
        debug: (...args: unknown[]) => void;
        error: (...args: unknown[]) => void;
        info: (...args: unknown[]) => void;
        warn: (...args: unknown[]) => void;
    };
} => {
    const calls: { args: unknown[]; level: "debug" | "error" | "info" | "warn" }[] = [];

    return {
        calls,
        logger: {
            debug: (...args) => { calls.push({ args, level: "debug" }); },
            error: (...args) => { calls.push({ args, level: "error" }); },
            info: (...args) => { calls.push({ args, level: "info" }); },
            warn: (...args) => { calls.push({ args, level: "warn" }); },
        },
    };
};

const writeStaleLockfile = (workspaceRoot: string): void => {
    // Marker first (older), lockfile after (fresher) → drift.
    const markerPath = join(workspaceRoot, "node_modules", ".modules.yaml");

    mkdirSync(join(workspaceRoot, "node_modules"), { recursive: true });
    writeFileSync(markerPath, "registry: x\n");

    const past = (Date.now() - 120_000) / 1000;

    utimesSync(markerPath, past, past);
    writeFileSync(join(workspaceRoot, "pnpm-lock.yaml"), "lockfileVersion: 9.0\n");
};

describe("vis run lockfile preflight wiring", () => {
    let workspaceRoot: string;
    let originalPath: string | undefined;

    beforeEach(() => {
        workspaceRoot = createTemporaryDirectory("vis-run-preflight-");
        originalPath = process.env["PATH"];

        const binDir = join(workspaceRoot, "bin");

        mkdirSync(binDir, { recursive: true });
        process.env["PATH"] = binDir;

        writeFileSync(join(workspaceRoot, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n");
        writeFileSync(join(workspaceRoot, "package.json"), JSON.stringify({ name: "root" }));

        const pkgDir = join(workspaceRoot, "packages", "lib");

        mkdirSync(pkgDir, { recursive: true });
        writeFileSync(join(pkgDir, "package.json"), JSON.stringify({ name: "@my/lib", scripts: { build: "echo hi" } }));
        writeFileSync(
            join(pkgDir, "project.json"),
            JSON.stringify({ targets: { build: { command: "echo hi", outputs: [] } } }),
        );
    });

    afterEach(() => {
        if (originalPath === undefined) {
            delete process.env["PATH"];
        } else {
            process.env["PATH"] = originalPath;
        }

        cleanupTemporaryDirectory(workspaceRoot);
    });

    it("warns and continues in TTY mode when the lockfile is newer than node_modules", async () => {
        expect.assertions(2);

        writeStaleLockfile(workspaceRoot);

        const { calls, logger } = makeLogger();

        await runExecute({
            argument: ["build"],
            logger,
            options: { cache: true, parallel: 1, skipToolchain: true },
            runtime: {} as never,
            visConfig: undefined,
            workspaceRoot,
        } as never);

        const warnings = calls.filter((c) => c.level === "warn" && typeof c.args[0] === "string" && (c.args[0] as string).startsWith("preflight:"));

        expect(warnings.length).toBeGreaterThanOrEqual(1);
        expect(warnings[0]!.args[0]).toContain("pnpm install");
    });

    it("skips the preflight when --no-preflight is set", async () => {
        expect.assertions(1);

        writeStaleLockfile(workspaceRoot);

        const { calls, logger } = makeLogger();

        await runExecute({
            argument: ["build"],
            logger,
            options: { cache: true, parallel: 1, preflight: false, skipToolchain: true },
            runtime: {} as never,
            visConfig: undefined,
            workspaceRoot,
        } as never);

        const preflightWarnings = calls.filter((c) => c.level === "warn" && typeof c.args[0] === "string" && (c.args[0] as string).startsWith("preflight:"));

        expect(preflightWarnings).toHaveLength(0);
    });
});
