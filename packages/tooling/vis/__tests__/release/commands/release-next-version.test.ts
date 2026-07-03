/**
 * `vis release next-version` — read-only printer for the computed next
 * version of each package in the plan (semantic-release #753, #1647).
 *
 * The handler builds a release context, projects the plan to
 * `{ from, to }` pairs, and prints either a pretty list or a JSON map.
 * We drive it via the same tmp-workspace fixture pattern used by
 * `release-pre.test.ts`.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import nextVersionHandler from "../../../src/commands/release/next-version/handler";
import { buildContext } from "../../../src/release/core/orchestrator";
import { RELEASE_SUITE_TIMEOUT, removeTemporaryDirectoryWithRetry, restorePristineStdout } from "../../test-helpers";

// These tests shell out to real git/pnpm and transpile the release/core graph;
// the 30s global default is too tight on Windows CI. See RELEASE_SUITE_TIMEOUT.
vi.setConfig({ hookTimeout: RELEASE_SUITE_TIMEOUT, testTimeout: RELEASE_SUITE_TIMEOUT });

const writeJson = (path: string, value: unknown): void => {
    writeFileSync(path, `${JSON.stringify(value, null, 4)}\n`);
};

/**
 * Build a tmp workspace with two packages and a single change file
 * that bumps both. The change-file format is the simple `bumps` shape;
 * any change in the release-plan path would surface here.
 */
const setupFixture = (changeFile?: string): string => {
    const cwd = mkdtempSync(join(tmpdir(), "vis-next-version-"));

    writeJson(join(cwd, "package.json"), {
        name: "fixture-root",
        private: true,
        version: "0.0.0",
        workspaces: ["packages/*"],
    });

    writeFileSync(join(cwd, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n");

    mkdirSync(join(cwd, "packages", "a"), { recursive: true });
    writeJson(join(cwd, "packages", "a", "package.json"), { name: "@scope/a", version: "1.0.0" });

    mkdirSync(join(cwd, "packages", "b"), { recursive: true });
    writeJson(join(cwd, "packages", "b", "package.json"), { name: "@scope/b", version: "2.5.0" });

    mkdirSync(join(cwd, ".vis", "release"), { recursive: true });

    // Packages are opt-in (managed) — mirror the monorepo's root config so the
    // discovered workspace packages actually enter the release plan.
    writeFileSync(join(cwd, "vis.config.cjs"), `module.exports = ${JSON.stringify({ release: { defaultManaged: true } }, null, 4)};\n`);

    if (changeFile !== undefined) {
        writeFileSync(join(cwd, ".vis", "release", "auto.md"), changeFile);
    }

    execFileSync("git", ["init", "-q", "--initial-branch", "main"], { cwd });
    execFileSync("git", ["config", "user.email", "test@test"], { cwd });
    execFileSync("git", ["config", "user.name", "Test"], { cwd });
    execFileSync("git", ["add", "."], { cwd });
    execFileSync("git", ["commit", "-q", "-m", "initial"], { cwd });

    return cwd;
};

const captureStdout = async (run: () => Promise<void>): Promise<string> => {
    const original = process.stdout.write.bind(process.stdout);
    const chunks: string[] = [];

    process.stdout.write = (chunk: string | Uint8Array) => {
        chunks.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));

        return true;
    };

    try {
        await run();
    } finally {
        process.stdout.write = original;
    }

    return chunks.join("");
};

const callHandler = async (cwd: string, options: Record<string, unknown>): Promise<string> => {
    const logger = {
        error: () => {},
        info: () => {},
        warn: () => {},
    };

    return captureStdout(async () => {
        await nextVersionHandler({ logger, options, workspaceRoot: cwd });
    });
};

const SIMPLE_CHANGE = "---\n\"@scope/a\": minor\n\"@scope/b\": patch\n---\n\nTwo bumps.\n";

describe("vis release next-version", () => {
    let cwd: string | undefined;

    // Warm the `release/core` lazy-`import()` graph once so the first real test
    // isn't charged the (Windows-amplified) cold transpile cost on top of its
    // own subprocess spawns. The scratch context is discarded.
    beforeAll(async () => {
        const scratch = setupFixture(SIMPLE_CHANGE);

        try {
            await buildContext({ cwd: scratch, skipRegistryLookup: true });
        } catch {
            // Warm-up only — a failure here is not a test failure; the real
            // tests below assert behaviour. We just wanted the graph loaded.
        } finally {
            await removeTemporaryDirectoryWithRetry(scratch);
        }
    }, RELEASE_SUITE_TIMEOUT);

    beforeEach(() => {
        cwd = undefined;
    });

    afterEach(async () => {
        // Reset stdout first: a timed-out test never reaches its own restore, so
        // its patch would otherwise leak into the next test's capture.
        restorePristineStdout();

        if (cwd) {
            await removeTemporaryDirectoryWithRetry(cwd);
        }
    });

    it("prints `<name> <old> -> <new>` for every package in the plan", async () => {
        expect.hasAssertions();

        cwd = setupFixture(SIMPLE_CHANGE);

        const stdout = await callHandler(cwd, {});

        expect(stdout).toContain("@scope/a 1.0.0 -> 1.1.0");
        expect(stdout).toContain("@scope/b 2.5.0 -> 2.5.1");
    });

    it("filters to a single package when --package is set", async () => {
        expect.hasAssertions();

        cwd = setupFixture(SIMPLE_CHANGE);

        const stdout = await callHandler(cwd, { package: "@scope/a" });

        expect(stdout).toContain("@scope/a 1.0.0 -> 1.1.0");
        expect(stdout).not.toContain("@scope/b");
    });

    it("emits a `{ name: { from, to } }` map with --json", async () => {
        expect.hasAssertions();

        cwd = setupFixture(SIMPLE_CHANGE);

        const stdout = await callHandler(cwd, { json: true });
        const parsed = JSON.parse(stdout);

        expect(parsed).toStrictEqual({
            "@scope/a": { from: "1.0.0", to: "1.1.0" },
            "@scope/b": { from: "2.5.0", to: "2.5.1" },
        });
    });

    it("exits 0 with no output when the plan is empty", async () => {
        // No change file in the fixture → plan is empty.
        expect.hasAssertions();

        cwd = setupFixture();

        const stdout = await callHandler(cwd, {});

        expect(stdout).toBe("");
        // Pretty mode: emits nothing. JSON mode would emit `{}` — that's
        // exercised below.
        expect(process.exitCode === 0 || process.exitCode === undefined).toBe(true);
    });

    it("emits `{}` with --json on an empty plan", async () => {
        expect.hasAssertions();

        cwd = setupFixture();

        const stdout = await callHandler(cwd, { json: true });

        expect(stdout.trim()).toBe("{}");
    });

    // F11: --package filter-miss must exit non-zero so CI scripts can
    // distinguish "no bump needed" from "wrong / missing package name".
    it("exits non-zero with an explanatory error when --package matches nothing in the plan (unknown name)", async () => {
        expect.hasAssertions();

        cwd = setupFixture(SIMPLE_CHANGE);

        const originalExitCode = process.exitCode;
        const logs: { args: unknown[]; level: string }[] = [];
        const logger = {
            error: (...args: unknown[]) => logs.push({ args, level: "error" }),
            info: () => {},
            warn: () => {},
        };

        process.exitCode = 0;

        try {
            await captureStdout(async () => {
                await nextVersionHandler({
                    logger,
                    options: { package: "@scope/does-not-exist" },
                    workspaceRoot: cwd,
                });
            });

            expect(process.exitCode).toBe(1);

            const message = logs.find((l) => l.level === "error")?.args[0];

            expect(String(message)).toMatch(/--package filter matched no releases/);
            expect(String(message)).toMatch(/not in this workspace/);
        } finally {
            process.exitCode = originalExitCode;
        }
    });

    it("exits non-zero when --package names a workspace package with no pending change", async () => {
        // Change file only bumps @scope/a; @scope/b is in the workspace
        // but has no pending release.
        expect.hasAssertions();

        const changeOnlyA = "---\n\"@scope/a\": minor\n---\n\nOnly a.\n";

        cwd = setupFixture(changeOnlyA);

        const originalExitCode = process.exitCode;
        const logs: { args: unknown[]; level: string }[] = [];
        const logger = {
            error: (...args: unknown[]) => logs.push({ args, level: "error" }),
            info: () => {},
            warn: () => {},
        };

        process.exitCode = 0;

        try {
            await captureStdout(async () => {
                await nextVersionHandler({
                    logger,
                    options: { package: "@scope/b" },
                    workspaceRoot: cwd,
                });
            });

            expect(process.exitCode).toBe(1);

            const message = logs.find((l) => l.level === "error")?.args[0];

            expect(String(message)).toMatch(/no pending release/);
        } finally {
            process.exitCode = originalExitCode;
        }
    });

    // F21: --first-release should flow through buildContext so a
    // greenfield-mode preview works on workspaces with no tags yet.
    it("accepts --first-release without crashing on a greenfield workspace", async () => {
        expect.hasAssertions();

        cwd = setupFixture(SIMPLE_CHANGE);

        // The fixture has no release tags — exercising firstRelease=true
        // should produce the same plan as the default path. We're mainly
        // asserting that the flag is wired through and doesn't blow up.
        const stdout = await callHandler(cwd, { firstRelease: true });

        expect(stdout).toContain("@scope/a 1.0.0 -> 1.1.0");
        expect(stdout).toContain("@scope/b 2.5.0 -> 2.5.1");
    });
});
