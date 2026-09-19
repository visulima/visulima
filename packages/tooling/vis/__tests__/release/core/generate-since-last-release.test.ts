/**
 * Regression tests for issue #864 §1 — `vis release generate
 * --since-last-release`.
 *
 * The range starts at the most recent `releaseTagPattern` tag reachable
 * from HEAD (workspace-wide, because `generate` emits one change file
 * for one range). When no such tag exists the run FAILS rather than
 * silently walking the whole repository history — that fallback is only
 * available behind `--allow-full-history`.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { access, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { RunGenerateResult } from "../../../src/release/core/generate/run";
import { runGenerate } from "../../../src/release/core/generate/run";
import { createShellRunner } from "../../../src/release/core/shell-runner";
import { resolveLastReleaseRef } from "../../../src/release/core/version-resolver";
import type { BumpLevel, VisReleaseConfig, WorkspacePackage } from "../../../src/release/types";

const testFs = { access, mkdir, readdir, readFile, rm, stat, writeFile } as never;

/**
 * Assert the run actually walked a range and flatten the discriminated
 * result for assertions.
 */
const walked = (result: RunGenerateResult): { bumps: ReadonlyMap<string, BumpLevel>; content: string | undefined; fromRef: string; ignoredCommits: number } => {
    if (result.status === "failed") {
        throw new Error(`generate failed: ${result.error}`);
    }

    return { ...result, content: "content" in result ? result.content : undefined };
};

const git = (cwd: string, ...args: string[]): void => {
    execFileSync("git", args, { cwd, stdio: "pipe" });
};

const makePackage = (cwd: string, name: string, directory: string): WorkspacePackage => {
    return {
        dir: join(cwd, "packages", directory),
        manifest: { name, version: "1.0.0" },
        manifestPath: join(cwd, "packages", directory, "package.json"),
        name,
        private: false,
        version: "1.0.0",
    };
};

/** Two-package fixture, no tags yet. */
const setupFixture = (): { cwd: string; packages: WorkspacePackage[]; rootSha: string } => {
    const cwd = mkdtempSync(join(tmpdir(), "vis-generate-since-"));

    for (const directory of ["a", "b"]) {
        mkdirSync(join(cwd, "packages", directory, "src"), { recursive: true });
        writeFileSync(join(cwd, "packages", directory, "package.json"), `${JSON.stringify({ name: `@scope/${directory}`, version: "1.0.0" }, null, 2)}\n`);
        writeFileSync(join(cwd, "packages", directory, "src", "index.ts"), "export const x = 0;\n");
    }

    writeFileSync(join(cwd, "package.json"), `${JSON.stringify({ name: "root", private: true, version: "0.0.0" }, null, 2)}\n`);

    git(cwd, "init", "-q", "--initial-branch", "main");
    git(cwd, "config", "user.email", "test@test");
    git(cwd, "config", "user.name", "Test");
    git(cwd, "config", "commit.gpgsign", "false");
    git(cwd, "add", ".");
    git(cwd, "commit", "-q", "-m", "chore: initial");

    const rootSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd, encoding: "utf8" }).trim();

    return { cwd, packages: [makePackage(cwd, "@scope/a", "a"), makePackage(cwd, "@scope/b", "b")], rootSha };
};

const commit = (cwd: string, directory: string, subject: string, marker: string): void => {
    writeFileSync(join(cwd, "packages", directory, "src", "index.ts"), `export const x = "${marker}";\n`);
    git(cwd, "add", ".");
    git(cwd, "commit", "-q", "-m", subject);
};

const generateSince = async (
    fixture: { cwd: string; packages: WorkspacePackage[] },
    config: VisReleaseConfig = {},
    allowFullHistory = false,
): Promise<RunGenerateResult> =>
    runGenerate({
        allowFullHistory,
        config,
        cwd: fixture.cwd,
        dryRun: true,
        fs: testFs,
        packages: fixture.packages,
        runner: createShellRunner(),
        sinceLastRelease: true,
    });

describe("generate --since-last-release (#864)", () => {
    let cwd: string | undefined;

    afterEach(async () => {
        if (cwd) {
            await rm(cwd, { force: true, recursive: true });
            cwd = undefined;
        }
    });

    it("starts the range at the most recent release tag reachable from HEAD", async () => {
        expect.hasAssertions();

        const fixture = setupFixture();

        cwd = fixture.cwd;

        commit(cwd, "a", "feat(a): shipped in the last wave", "one");
        git(cwd, "tag", "@scope/a@1.1.0");
        commit(cwd, "a", "fix(a): landed after the wave", "two");

        const result = walked(await generateSince(fixture));

        expect(result.fromRef).toBe("@scope/a@1.1.0");
        expect(result.content).toContain("- fix(a): landed after the wave");
        expect(result.content).not.toContain("shipped in the last wave");
        expect(result.bumps.get("@scope/a")).toBe("patch");
    });

    it("picks the newest tag across the whole workspace, not per-package", async () => {
        expect.hasAssertions();

        const fixture = setupFixture();

        cwd = fixture.cwd;

        commit(cwd, "a", "feat(a): a wave", "a1");
        git(cwd, "tag", "@scope/a@1.1.0");
        commit(cwd, "b", "feat(b): b wave", "b1");
        git(cwd, "tag", "@scope/b@2.0.0");
        commit(cwd, "a", "fix(a): after both waves", "a2");

        const resolved = await resolveLastReleaseRef({ cwd, packages: fixture.packages, runner: createShellRunner() });

        expect(resolved.tag).toBe("@scope/b@2.0.0");

        const result = walked(await generateSince(fixture));

        expect(result.fromRef).toBe("@scope/b@2.0.0");
        expect([...result.bumps.keys()]).toStrictEqual(["@scope/a"]);
    });

    it("offers the repository root commit as a candidate, flagged as such, when no release tag exists", async () => {
        expect.hasAssertions();

        const fixture = setupFixture();

        cwd = fixture.cwd;

        commit(cwd, "a", "feat(a): the very first feature", "one");

        const resolved = await resolveLastReleaseRef({ cwd, packages: fixture.packages, runner: createShellRunner() });

        expect(resolved.kind).toBe("root-commit");
        expect(resolved.ref).toBe(fixture.rootSha);
        expect(resolved.tag).toBeUndefined();
        expect(resolved.reason).toContain("root commit");
    });

    it("refuses to walk the entire history when no release tag matches", async () => {
        expect.hasAssertions();

        const fixture = setupFixture();

        cwd = fixture.cwd;

        commit(cwd, "a", "feat(a): the very first feature", "one");

        const result = await generateSince(fixture);

        expect(result.status).toBe("failed");
        expect(result.status === "failed" && result.error).toContain("--allow-full-history");
        // The destructive part is not "it warned", it is "it walked".
        expect(result).not.toHaveProperty("bumps");
    });

    it("refuses when the repo's tags do not match the configured releaseTagPattern", async () => {
        expect.hasAssertions();

        const fixture = setupFixture();

        cwd = fixture.cwd;

        // Real-world shape from the audit: the repo is tagged `v1.2.3`
        // while `releaseTagPattern` is the default `{name}@{version}`.
        // Nothing matches the glob, so the old code walked everything and
        // `--auto-publish` shipped the lot.
        commit(cwd, "a", "feat(a): released long ago", "one");
        git(cwd, "tag", "v1.2.3");
        commit(cwd, "b", "feat(b)!: breaking, released long ago", "b1");
        commit(cwd, "a", "fix(a): the only unreleased commit", "two");

        const result = await generateSince(fixture);

        expect(result.status).toBe("failed");
        expect(result).not.toHaveProperty("bumps");
    });

    it("walks the whole history only when --allow-full-history is passed", async () => {
        expect.hasAssertions();

        const fixture = setupFixture();

        cwd = fixture.cwd;

        commit(cwd, "a", "feat(a): the very first feature", "one");

        const result = await generateSince(fixture, {}, true);
        const walkedResult = walked(result);

        expect(walkedResult.fromRef).toBe(fixture.rootSha);
        expect(walkedResult.content).toContain("- feat(a): the very first feature");
        // Opting in is still worth a warning in the CI tail.
        expect(result.warnings.join("\n")).toContain("--allow-full-history");
    });

    it("honours a custom releaseTagPattern", async () => {
        expect.hasAssertions();

        const fixture = setupFixture();

        cwd = fixture.cwd;

        commit(cwd, "a", "feat(a): released", "one");
        git(cwd, "tag", "v1.1.0");
        commit(cwd, "a", "fix(a): unreleased", "two");

        const result = walked(await generateSince(fixture, { releaseTagPattern: "v{version}" }));

        expect(result.fromRef).toBe("v1.1.0");
        expect(result.content).toContain("- fix(a): unreleased");
        expect(result.content).not.toContain("feat(a): released");
    });

    it("ignores tags that match the glob but do not parse as a version", async () => {
        expect.hasAssertions();

        const fixture = setupFixture();

        cwd = fixture.cwd;

        commit(cwd, "a", "feat(a): the very first feature", "one");
        // The `--match` glob for `{name}@{version}` degrades to
        // `@scope/a@*`, which this tag satisfies — the strict matcher
        // must still reject it.
        git(cwd, "tag", "@scope/a@nightly");

        const resolved = await resolveLastReleaseRef({ cwd, packages: fixture.packages, runner: createShellRunner() });

        expect(resolved.kind).toBe("root-commit");
        expect(resolved.tag).toBeUndefined();
        expect(resolved.ref).toBe(fixture.rootSha);
    });

    it("skips release commits inside the since-last-release range", async () => {
        expect.hasAssertions();

        const fixture = setupFixture();

        cwd = fixture.cwd;

        commit(cwd, "a", "feat(a): released", "one");
        git(cwd, "tag", "@scope/a@1.1.0");
        commit(cwd, "a", String.raw`chore(release): @scope/a@1.1.0 [skip ci]\n\n## @scope/a [1.1.0](https://x) (2026-09-07)`, "rel");

        const result = walked(await generateSince(fixture));

        expect(result.fromRef).toBe("@scope/a@1.1.0");
        expect(result.ignoredCommits).toBe(1);
        expect([...result.bumps.keys()]).toStrictEqual([]);
    });
});
