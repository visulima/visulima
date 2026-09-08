/**
 * Regression tests for issue #864 §1 — `vis release ci release --generate`.
 *
 * Collapses the three-step commit-driven CI dance (`generate` → throwaway
 * `git commit` → `ci release`) into one command:
 *
 *   - the change file is derived in-process before the pending-file check,
 *   - the clean-tree guard tolerates exactly that file,
 *   - an unrelated dirty tree still fails.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { access, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const testFs = { access, mkdir, readdir, readFile, rm, stat, writeFile } as never;

const publishOptionsCaptured: { resume?: boolean; tag?: string }[] = [];
const applyCallCount = { value: 0 };

vi.mock(import("../../../src/release/core/orchestrator"), async (importOriginal) => {
    const actual = await importOriginal<typeof import("../../../src/release/core/orchestrator")>();

    return {
        ...actual,
        applyContext: vi.fn(async () => {
            applyCallCount.value += 1;

            return { changedFiles: [], deletedFiles: [], plan: { consumedChangeFiles: [], releases: [], warnings: [] } };
        }),
        publishContext: vi.fn(async (_ctx: unknown, options: { resume?: boolean; tag?: string } = {}) => {
            publishOptionsCaptured.push({ ...options });

            return { failed: [], published: [], skipped: [], tags: [], tagsPushed: false };
        }),
    };
});

// Only the push is stubbed — `listUncommittedPaths` / `getShortSha` must
// run for real, they are what this suite exercises.
vi.mock(import("../../../src/release/core/git"), async (importOriginal) => {
    const actual = await importOriginal<typeof import("../../../src/release/core/git")>();

    return { ...actual, pushBranch: vi.fn(async () => undefined) };
});

const git = (cwd: string, ...args: string[]): void => {
    execFileSync("git", args, { cwd, stdio: "pipe" });
};

const setupFixture = (): { cwd: string; rootSha: string } => {
    const cwd = mkdtempSync(join(tmpdir(), "vis-ci-generate-"));

    writeFileSync(
        join(cwd, "package.json"),
        `${JSON.stringify({ name: "fixture-root", packageManager: "pnpm@10.32.1", private: true, version: "0.0.0", workspaces: ["packages/*"] }, null, 4)}\n`,
    );
    writeFileSync(join(cwd, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n");
    // `loadVisConfig` writes `node_modules/.cache/vis/vis-config-cache.json`;
    // in a real repo that path is gitignored, so the fixture must be too or
    // the clean-tree guard would fire on the tool's own cache.
    writeFileSync(join(cwd, ".gitignore"), "node_modules\n");
    mkdirSync(join(cwd, "packages", "a", "src"), { recursive: true });
    writeFileSync(join(cwd, "packages", "a", "package.json"), `${JSON.stringify({ name: "@scope/a", version: "1.0.0" }, null, 4)}\n`);
    writeFileSync(join(cwd, "packages", "a", "src", "index.ts"), "export const a = 0;\n");
    mkdirSync(join(cwd, ".vis", "release"), { recursive: true });
    writeFileSync(join(cwd, ".vis", "release", ".gitkeep"), "");
    writeFileSync(
        join(cwd, "vis.config.cjs"),
        `module.exports = ${JSON.stringify({ release: { acknowledgeUnstable: true, channels: { alpha: { mode: "auto-publish", prerelease: "alpha", tag: "alpha" } }, defaultManaged: true } }, null, 4)};\n`,
    );

    git(cwd, "init", "-q", "--initial-branch", "alpha");
    git(cwd, "config", "user.email", "test@test");
    git(cwd, "config", "user.name", "Test");
    git(cwd, "config", "commit.gpgsign", "false");
    git(cwd, "add", ".");
    git(cwd, "commit", "-q", "-m", "chore: initial");

    const rootSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd, encoding: "utf8" }).trim();

    return { cwd, rootSha };
};

const commitFeature = (cwd: string, subject: string, marker: string): void => {
    writeFileSync(join(cwd, "packages", "a", "src", "index.ts"), `export const a = "${marker}";\n`);
    git(cwd, "add", ".");
    git(cwd, "commit", "-q", "-m", subject);
};

describe("vis release ci release --generate (#864)", () => {
    let cwd: string | undefined;

    beforeEach(() => {
        cwd = undefined;
        publishOptionsCaptured.length = 0;
        applyCallCount.value = 0;
        process.exitCode = undefined;
    });

    afterEach(async () => {
        if (cwd) {
            await rm(cwd, { force: true, recursive: true });
        }

        process.exitCode = undefined;
        vi.clearAllMocks();
    });

    it("without --generate an empty change dir is still 'nothing to release'", async () => {
        expect.hasAssertions();

        const fixture = setupFixture();

        cwd = fixture.cwd;
        commitFeature(cwd, "feat(a): add a thing", "one");

        const info: string[] = [];
        const { default: execute } = await import("../../../src/commands/release/ci/release/handler");

        await execute({
            fs: testFs,
            logger: { error: () => {}, info: (message: string) => info.push(message), warn: () => {} },
            options: { autoPublish: true, channel: "alpha" },
            workspaceRoot: cwd,
        });

        expect(info.join("\n")).toContain("No pending change files");
        expect(publishOptionsCaptured).toHaveLength(0);
    });

    it("derives the change file, tolerates it in the clean-tree guard, and publishes", async () => {
        expect.hasAssertions();

        const fixture = setupFixture();

        cwd = fixture.cwd;
        commitFeature(cwd, "feat(a): add a thing", "one");

        const info: string[] = [];
        const { default: execute } = await import("../../../src/commands/release/ci/release/handler");

        await execute({
            fs: testFs,
            logger: { error: () => {}, info: (message: string) => info.push(message), warn: () => {} },
            options: { autoPublish: true, channel: "alpha", generate: true, generateFrom: fixture.rootSha },
            workspaceRoot: cwd,
        });

        expect(info.join("\n")).toContain("Generated .vis/release/ci-");
        expect(process.exitCode ?? 0).toBe(0);
        expect(applyCallCount.value).toBe(1);
        expect(publishOptionsCaptured).toHaveLength(1);

        // The file is staged (never committed on its own) so `applyContext`
        // can later stage its deletion — `git add` refuses a path that was
        // never in the index.
        const staged = execFileSync("git", ["diff", "--cached", "--name-only"], { cwd, encoding: "utf8" });

        expect(staged).toContain(".vis/release/ci-");
    });

    it("still refuses an unrelated dirty tree when --generate is used", async () => {
        expect.hasAssertions();

        const fixture = setupFixture();

        cwd = fixture.cwd;
        commitFeature(cwd, "feat(a): add a thing", "one");
        writeFileSync(join(cwd, "unrelated-junk.txt"), "left over from a previous step\n");

        const warnings: string[] = [];
        const { default: execute } = await import("../../../src/commands/release/ci/release/handler");

        await execute({
            fs: testFs,
            logger: { error: () => {}, info: () => {}, warn: (message: string) => warnings.push(message), workspaceRoot: cwd } as never,
            options: { autoPublish: true, channel: "alpha", generate: true, generateFrom: fixture.rootSha },
            workspaceRoot: cwd,
        });

        expect(process.exitCode).toBe(1);
        expect(warnings.join("\n")).toContain("unrelated-junk.txt");
        expect(publishOptionsCaptured).toHaveLength(0);
    });

    /**
     * F1: with no `--generate-from`, `--generate` defaults to
     * `--since-last-release`. When no tag matches the configured
     * `releaseTagPattern` the old code fell back to the repository root
     * commit and published everything it found there. It must refuse.
     */
    it("refuses to publish off the whole history when no release tag matches", async () => {
        expect.hasAssertions();

        const fixture = setupFixture();

        cwd = fixture.cwd;
        // Tagged, but not with the `{name}@{version}` pattern vis expects
        // — so `git describe --match` finds nothing reachable from HEAD.
        commitFeature(cwd, "feat(a)!: a breaking change from the distant past", "old");
        git(cwd, "tag", "v1.2.3");
        commitFeature(cwd, "fix(a): the one genuinely unreleased commit", "new");

        const errors: string[] = [];
        const info: string[] = [];
        const { default: execute } = await import("../../../src/commands/release/ci/release/handler");

        await execute({
            fs: testFs,
            logger: { error: (message: string) => errors.push(message), info: (message: string) => info.push(message), warn: () => {} },
            options: { autoPublish: true, channel: "alpha", generate: true },
            workspaceRoot: cwd,
        });

        expect(process.exitCode).toBe(1);
        expect(errors.join("\n")).toContain("--allow-full-history");
        expect(publishOptionsCaptured).toHaveLength(0);
        expect(applyCallCount.value).toBe(0);
        expect(info.join("\n")).not.toContain("Generated .vis/release/ci-");
    });

    it("walks the whole history when --allow-full-history is passed", async () => {
        expect.hasAssertions();

        const fixture = setupFixture();

        cwd = fixture.cwd;
        commitFeature(cwd, "feat(a): the very first feature", "one");

        const info: string[] = [];
        const { default: execute } = await import("../../../src/commands/release/ci/release/handler");

        await execute({
            fs: testFs,
            logger: { error: () => {}, info: (message: string) => info.push(message), warn: () => {} },
            options: { allowFullHistory: true, autoPublish: true, channel: "alpha", generate: true },
            workspaceRoot: cwd,
        });

        expect(process.exitCode ?? 0).toBe(0);
        expect(info.join("\n")).toContain("Generated .vis/release/ci-");
        expect(publishOptionsCaptured).toHaveLength(1);
    });

    /**
     * F2: a change file left behind by an interrupted `--generate` run
     * used to wedge every later run — the next run generates
     * `ci-&lt;new sha>.md`, so the leftover `ci-&lt;old sha>.md` counted as
     * unexpected dirt and the clean-tree guard failed forever.
     */
    it("is not wedged by a change file left behind by an interrupted --generate run", async () => {
        expect.hasAssertions();

        const fixture = setupFixture();

        cwd = fixture.cwd;
        commitFeature(cwd, "feat(a): add a thing", "one");

        // Exactly what an aborted run leaves: written + staged, at a sha
        // that is no longer HEAD.
        await writeFile(join(cwd, ".vis", "release", "ci-deadbee.md"), "---\n\"@scope/a\": patch\n---\n\n- fix(a): from the interrupted run\n");
        git(cwd, "add", "--", ".vis/release/ci-deadbee.md");

        const info: string[] = [];
        const warnings: string[] = [];
        const { default: execute } = await import("../../../src/commands/release/ci/release/handler");

        await execute({
            fs: testFs,
            logger: { error: () => {}, info: (message: string) => info.push(message), warn: (message: string) => warnings.push(message) },
            options: { autoPublish: true, channel: "alpha", generate: true, generateFrom: fixture.rootSha },
            workspaceRoot: cwd,
        });

        expect(process.exitCode ?? 0).toBe(0);
        expect(warnings.join("\n")).toContain("ci-deadbee.md");
        expect(warnings.join("\n")).not.toContain("CI mode requires a clean tree");
        expect(publishOptionsCaptured).toHaveLength(1);
    });

    it("still refuses unrelated dirt that merely lives in the change dir", async () => {
        expect.hasAssertions();

        const fixture = setupFixture();

        cwd = fixture.cwd;
        commitFeature(cwd, "feat(a): add a thing", "one");
        // A hand-written change file is NOT the generated shape, so the
        // tolerance must not swallow it.
        await writeFile(join(cwd, ".vis", "release", "brave-otter.md"), "---\n\"@scope/a\": patch\n---\n\n- a human wrote this\n");

        const warnings: string[] = [];
        const { default: execute } = await import("../../../src/commands/release/ci/release/handler");

        await execute({
            fs: testFs,
            logger: { error: () => {}, info: () => {}, warn: (message: string) => warnings.push(message) },
            options: { autoPublish: true, channel: "alpha", generate: true, generateFrom: fixture.rootSha },
            workspaceRoot: cwd,
        });

        expect(process.exitCode).toBe(1);
        expect(warnings.join("\n")).toContain("brave-otter.md");
        expect(publishOptionsCaptured).toHaveLength(0);
    });

    it("derives nothing when the range holds only release commits", async () => {
        expect.hasAssertions();

        const fixture = setupFixture();

        cwd = fixture.cwd;
        commitFeature(cwd, String.raw`chore(release): @scope/a@1.0.0 [skip ci]\n\n## @scope/a [1.0.0](https://x) (2026-09-07)`, "rel");

        const info: string[] = [];
        const { default: execute } = await import("../../../src/commands/release/ci/release/handler");

        await execute({
            fs: testFs,
            logger: { error: () => {}, info: (message: string) => info.push(message), warn: () => {} },
            options: { autoPublish: true, channel: "alpha", generate: true, generateFrom: fixture.rootSha },
            workspaceRoot: cwd,
        });

        const joined = info.join("\n");

        expect(joined).toContain("derived no bumps");
        expect(joined).toContain("No pending change files");
        expect(publishOptionsCaptured).toHaveLength(0);
    });
});
