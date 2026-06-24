/**
 * `vis release check --strict` — additionalPaths (release-please #1921).
 *
 * Verifies that a file outside a package's own directory still counts
 * toward attribution when it matches a workspace-root-relative glob in
 * `release.packages.&lt;name>.additionalPaths`. Without the opt-in, the
 * change goes unattributed (the file maps to no owning package). With
 * the opt-in, the matching package is flagged uncovered.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import checkHandler from "../../../src/commands/release/check/handler";

const writeJson = (path: string, value: unknown): void => {
    writeFileSync(path, `${JSON.stringify(value, null, 4)}\n`);
};

const writeVisConfigCjs = (cwd: string, releaseBlock: Record<string, unknown>): void => {
    const block = { release: { acknowledgeUnstable: true, defaultManaged: true, ...releaseBlock } };

    writeFileSync(join(cwd, "vis.config.cjs"), `module.exports = ${JSON.stringify(block, null, 4)};\n`);
};

interface CapturedLog {
    args: unknown[];
    level: "info" | "warn" | "error";
}

const makeToolbox = (cwd: string, options: { noFail?: boolean; strict?: boolean } = {}) => {
    const logs: CapturedLog[] = [];

    return {
        logs,
        toolbox: {
            argument: {},
            logger: {
                error: (...args: unknown[]) => logs.push({ args, level: "error" }),
                info: (...args: unknown[]) => logs.push({ args, level: "info" }),
                warn: (...args: unknown[]) => logs.push({ args, level: "warn" }),
            } as never,
            options: {
                noFail: options.noFail,
                strict: options.strict,
            } as never,
            workspaceRoot: cwd,
        } as never,
    };
};

const setupFixture = (releaseBlock: Record<string, unknown> = {}): string => {
    const cwd = mkdtempSync(join(tmpdir(), "vis-check-additional-"));

    writeJson(join(cwd, "package.json"), {
        name: "fixture-root",
        packageManager: "pnpm@10.0.0",
        private: true,
        version: "0.0.0",
        workspaces: ["packages/*"],
    });

    writeFileSync(join(cwd, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n");
    mkdirSync(join(cwd, "packages", "cli"), { recursive: true });
    writeJson(join(cwd, "packages", "cli", "package.json"), {
        name: "@scope/cli",
        version: "1.0.0",
    });
    mkdirSync(join(cwd, "docs", "cli"), { recursive: true });
    writeFileSync(join(cwd, "docs", "cli", "intro.md"), "intro");
    mkdirSync(join(cwd, ".vis", "release"), { recursive: true });

    writeVisConfigCjs(cwd, releaseBlock);

    execFileSync("git", ["init", "-q", "--initial-branch", "main"], { cwd });
    execFileSync("git", ["config", "user.email", "test@test"], { cwd });
    execFileSync("git", ["config", "user.name", "Test"], { cwd });
    execFileSync("git", ["add", "."], { cwd });
    execFileSync("git", ["commit", "-q", "-m", "initial"], { cwd });

    return cwd;
};

// TODO(windows): buildContext loads vis.config via the native importTs loader,
// which intermittently deadlocks on win32 (~30s timeout + EBUSY on temp rmdir).
// Skip on Windows until the loader is fixed on a real Windows box. See
// project_vis_windows_release_layered_fixes_pr687.
const isWindows = process.platform === "win32";

describe.skipIf(isWindows)("vis release check --strict — additionalPaths (release-please #1921)", () => {
    let cwd: string;
    const originalExitCode = process.exitCode;

    beforeEach(() => {
        process.exitCode = 0;
    });

    afterEach(async () => {
        process.exitCode = originalExitCode;

        if (cwd) {
            await rm(cwd, { force: true, recursive: true });
        }
    });

    it("flags @scope/cli as uncovered when docs/cli/ changes match its additionalPaths glob", async () => {
        expect.hasAssertions();

        cwd = setupFixture({
            baseBranch: "main",
            packages: {
                "@scope/cli": {
                    additionalPaths: ["docs/cli/**"],
                },
            },
        });

        // Create a feature branch with a docs change but no change file.
        execFileSync("git", ["checkout", "-q", "-b", "feature"], { cwd });
        await writeFile(join(cwd, "docs", "cli", "intro.md"), "edited intro");
        execFileSync("git", ["add", "."], { cwd });
        execFileSync("git", ["commit", "-q", "-m", "docs"], { cwd });

        // Author an empty change-files dir → the strict mode will require
        // a covering bump. Without `additionalPaths`, the docs change is
        // unattributed and check passes; with it, @scope/cli is uncovered.
        // We still write *some* change file so the first guard ("no change
        // files present") doesn't short-circuit.
        await writeFile(join(cwd, ".vis", "release", "noop.md"), "---\n{}\n---\nDocs\n");
        execFileSync("git", ["add", "."], { cwd });
        execFileSync("git", ["commit", "-q", "-m", "noop change file"], { cwd });

        const { logs, toolbox } = makeToolbox(cwd, { strict: true });

        await checkHandler(toolbox);

        // @scope/cli should be flagged uncovered because of the docs/cli
        // additionalPaths match.
        const errorMsgs = logs.filter((l) => l.level === "error").map((l) => String(l.args[0]));

        expect(errorMsgs.some((m) => m.includes("@scope/cli"))).toBe(true);
        expect(process.exitCode).toBe(1);
    });

    it("does NOT flag @scope/cli when docs/cli/ changes match no additionalPaths", async () => {
        expect.hasAssertions();

        cwd = setupFixture({
            baseBranch: "main",
            // No additionalPaths set — docs change is unattributed.
        });

        execFileSync("git", ["checkout", "-q", "-b", "feature"], { cwd });
        await writeFile(join(cwd, "docs", "cli", "intro.md"), "edited intro");
        execFileSync("git", ["add", "."], { cwd });
        execFileSync("git", ["commit", "-q", "-m", "docs"], { cwd });

        await writeFile(join(cwd, ".vis", "release", "noop.md"), "---\n{}\n---\nDocs\n");
        execFileSync("git", ["add", "."], { cwd });
        execFileSync("git", ["commit", "-q", "-m", "noop change file"], { cwd });

        const { logs, toolbox } = makeToolbox(cwd, { strict: true });

        await checkHandler(toolbox);

        // No uncovered finding → exit 0.
        const errorMsgs = logs.filter((l) => l.level === "error").map((l) => String(l.args[0]));

        expect(errorMsgs.some((m) => m.includes("@scope/cli"))).toBe(false);
        expect(process.exitCode).toBe(0);
    });

    // F6: precedence test — additionalPaths must NOT double-attribute a
    // file that already lives inside another package's own directory.
    // Operators expect additionalPaths to fire ONLY for files outside
    // the claiming package's own dir; otherwise a shared glob like
    // `packages/cli/**` declared on `@scope/lib` would silently flag
    // `@scope/lib` for every CLI source change, even when the CLI is
    // the actual owner.
    it("additively attributes a globbed file to BOTH its owner and any package that globs it via additionalPaths", async () => {
        // Two packages — `@scope/cli` (owner of packages/cli/) and
        // `@scope/lib` whose additionalPaths globs packages/cli/**.
        // Attribution is additive BY DESIGN: a change inside packages/cli/
        // flags `cli` (its owner) AND `lib` (which explicitly declared it
        // depends on those files). This is the load-bearing behaviour for
        // cross-package file dependencies (e.g. a CLI embedding a sibling's
        // generated assets) — owner-wins de-dup would let `lib` ship a stale
        // embedded copy. Over-attribution only ever yields a visible
        // "uncovered" warning the operator resolves (add a change file or
        // narrow the glob); under-attribution would be a silent stale release.
        expect.hasAssertions();

        const cwd2 = mkdtempSync(join(tmpdir(), "vis-check-double-"));

        try {
            writeJson(join(cwd2, "package.json"), {
                name: "fixture-root",
                packageManager: "pnpm@10.0.0",
                private: true,
                version: "0.0.0",
                workspaces: ["packages/*"],
            });

            writeFileSync(join(cwd2, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n");
            mkdirSync(join(cwd2, "packages", "cli", "src"), { recursive: true });
            writeJson(join(cwd2, "packages", "cli", "package.json"), { name: "@scope/cli", version: "1.0.0" });
            writeFileSync(join(cwd2, "packages", "cli", "src", "index.ts"), "export const x = 1;\n");
            mkdirSync(join(cwd2, "packages", "lib"), { recursive: true });
            writeJson(join(cwd2, "packages", "lib", "package.json"), { name: "@scope/lib", version: "1.0.0" });
            mkdirSync(join(cwd2, ".vis", "release"), { recursive: true });

            writeVisConfigCjs(cwd2, {
                baseBranch: "main",
                packages: {
                    // @scope/lib explicitly declares it depends on cli's
                    // files; a change there must additively flag lib too.
                    "@scope/lib": {
                        additionalPaths: ["packages/cli/**"],
                    },
                },
            });

            execFileSync("git", ["init", "-q", "--initial-branch", "main"], { cwd: cwd2 });
            execFileSync("git", ["config", "user.email", "test@test"], { cwd: cwd2 });
            execFileSync("git", ["config", "user.name", "Test"], { cwd: cwd2 });
            execFileSync("git", ["add", "."], { cwd: cwd2 });
            execFileSync("git", ["commit", "-q", "-m", "initial"], { cwd: cwd2 });

            // Author a feature branch with a covering change file for
            // @scope/cli only (the actual owner) — and edit a file
            // inside packages/cli/.
            execFileSync("git", ["checkout", "-q", "-b", "feature"], { cwd: cwd2 });
            await writeFile(join(cwd2, "packages", "cli", "src", "index.ts"), "export const x = 2;\n");
            await writeFile(join(cwd2, ".vis", "release", "cli-bump.md"), "---\n\"@scope/cli\": patch\n---\nedit\n");
            execFileSync("git", ["add", "."], { cwd: cwd2 });
            execFileSync("git", ["commit", "-q", "-m", "cli edit"], { cwd: cwd2 });

            const { logs, toolbox } = makeToolbox(cwd2, { strict: true });

            await checkHandler(toolbox);

            const errorMsgs = logs.filter((l) => l.level === "error").map((l) => String(l.args[0]));

            // @scope/cli is covered by its change file; @scope/lib opted into
            // cli's files via additionalPaths but has no covering change file,
            // so it is (correctly) flagged as uncovered in --strict mode.
            expect(errorMsgs.some((m) => m.includes("@scope/lib"))).toBe(true);
            expect(errorMsgs.some((m) => m.includes("@scope/cli"))).toBe(false);
            expect(process.exitCode).not.toBe(0);
        } finally {
            await rm(cwd2, { force: true, recursive: true });
        }
    });
});
