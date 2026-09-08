/**
 * Regression tests for issue #864 §2 — `vis release generate` must not
 * transcribe machine release commits into the change file.
 *
 * Covers:
 *   - the built-in `chore(release):` / `[skip ci]` heuristic,
 *   - `release.ignoreCommitPattern` extending (not replacing) it,
 *   - `release.ignoreReleaseCommits: false` as the explicit opt-out,
 *   - subject trimming for multi-semantic-release's literal `\n\n`
 *     changelog-header suffix.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { access, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
    buildIgnoreCommitMatchers,
    DEFAULT_RELEASE_COMMIT_PATTERNS,
    isIgnoredCommit,
    normalizeCommitSubject,
} from "../../../src/release/core/generate/conventional-commits";
import type { RunGenerateResult } from "../../../src/release/core/generate/run";
import { runGenerate } from "../../../src/release/core/generate/run";
import { createShellRunner } from "../../../src/release/core/shell-runner";
import type { BumpLevel, VisReleaseConfig, WorkspacePackage } from "../../../src/release/types";

const testFs = { access, mkdir, readdir, readFile, rm, stat, writeFile } as never;

/**
 * Assert the run actually walked a range and flatten the discriminated
 * result for assertions. `content` is undefined for a `no-changes`
 * outcome, which is exactly what the old shape reported.
 */
const walked = (
    result: RunGenerateResult,
): { bumps: ReadonlyMap<string, BumpLevel>; content: string | undefined; fromRef: string; ignoredCommits: number; status: RunGenerateResult["status"] } => {
    if (result.status === "failed") {
        throw new Error(`generate failed: ${result.error}`);
    }

    return { ...result, content: "content" in result ? result.content : undefined };
};

const git = (cwd: string, ...args: string[]): void => {
    execFileSync("git", args, { cwd, stdio: "pipe" });
};

/**
 * A one-package fixture repo. Every commit touches `packages/a/src/index.ts`
 * so the path heuristic alone would attribute it to `@scope/a` — which is
 * exactly the trap: a release commit that touches the package's
 * `package.json` / `CHANGELOG.md` would otherwise bump it forever.
 */
const setupFixture = (): { cwd: string; packages: WorkspacePackage[]; rootSha: string } => {
    const cwd = mkdtempSync(join(tmpdir(), "vis-generate-ignore-"));

    mkdirSync(join(cwd, "packages", "a", "src"), { recursive: true });
    writeFileSync(join(cwd, "package.json"), `${JSON.stringify({ name: "root", private: true, version: "0.0.0" }, null, 2)}\n`);
    writeFileSync(join(cwd, "packages", "a", "package.json"), `${JSON.stringify({ name: "@scope/a", version: "1.0.0" }, null, 2)}\n`);
    writeFileSync(join(cwd, "packages", "a", "src", "index.ts"), "export const a = 1;\n");

    git(cwd, "init", "-q", "--initial-branch", "main");
    git(cwd, "config", "user.email", "test@test");
    git(cwd, "config", "user.name", "Test");
    git(cwd, "config", "commit.gpgsign", "false");
    git(cwd, "add", ".");
    git(cwd, "commit", "-q", "-m", "chore: initial");

    const packages: WorkspacePackage[] = [
        {
            dir: join(cwd, "packages", "a"),
            manifest: { name: "@scope/a", version: "1.0.0" },
            manifestPath: join(cwd, "packages", "a", "package.json"),
            name: "@scope/a",
            private: false,
            version: "1.0.0",
        },
    ];

    const rootSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd, encoding: "utf8" }).trim();

    return { cwd, packages, rootSha };
};

const commitTouchingPackage = (cwd: string, subject: string, marker: string): void => {
    writeFileSync(join(cwd, "packages", "a", "src", "index.ts"), `export const a = "${marker}";\n`);
    git(cwd, "add", ".");
    git(cwd, "commit", "-q", "-m", subject);
};

const generate = async (fixture: { cwd: string; packages: WorkspacePackage[]; rootSha: string }, config: VisReleaseConfig = {}) =>
    runGenerate({
        config,
        cwd: fixture.cwd,
        dryRun: true,
        from: fixture.rootSha,
        fs: testFs,
        packages: fixture.packages,
        runner: createShellRunner(),
    });

describe("generate — machine release-commit filtering (#864)", () => {
    let cwd: string | undefined;

    afterEach(async () => {
        if (cwd) {
            await rm(cwd, { force: true, recursive: true });
            cwd = undefined;
        }
    });

    describe(normalizeCommitSubject, () => {
        it(String.raw`cuts the multi-semantic-release literal \n\n changelog header off the subject`, () => {
            expect.hasAssertions();

            const subject = String.raw`chore(release): @scope/a@1.0.0-alpha.44 [skip ci]\n\n## @scope/a [1.0.0-alpha.44](https://x/compare) (2026-09-07)`;

            expect(normalizeCommitSubject(subject)).toBe("chore(release): @scope/a@1.0.0-alpha.44 [skip ci]");
        });

        it("cuts at a real newline too and leaves a plain subject untouched", () => {
            expect.hasAssertions();

            expect(normalizeCommitSubject("feat: a thing\n\nbody text")).toBe("feat: a thing");
            expect(normalizeCommitSubject("feat: a thing")).toBe("feat: a thing");
        });

        it(String.raw`keeps a subject that merely mentions a literal \n escape`, () => {
            expect.hasAssertions();

            // Only a doubled escape introducing a markdown heading is the
            // multi-semantic-release join; prose about escapes must survive.
            expect(normalizeCommitSubject(String.raw`fix(parser): handle \n in template literals`)).toBe(
                String.raw`fix(parser): handle \n in template literals`,
            );
            expect(normalizeCommitSubject(String.raw`docs: explain \n\n as a paragraph break`)).toBe(String.raw`docs: explain \n\n as a paragraph break`);
        });
    });

    describe(buildIgnoreCommitMatchers, () => {
        it("matches every machine release-commit shape by default", () => {
            expect.hasAssertions();

            const matchers = buildIgnoreCommitMatchers();

            expect(isIgnoredCommit("chore(release): @scope/a@1.0.0-alpha.44 [skip ci]", matchers)).toBe(true);
            expect(isIgnoredCommit("chore(release): version packages", matchers)).toBe(true);
            expect(isIgnoredCommit("chore(main): release 1.2.3", matchers)).toBe(true);
            expect(isIgnoredCommit("chore: release v1.2.3", matchers)).toBe(true);
            expect(isIgnoredCommit("release(alpha): version packages [skip ci]", matchers)).toBe(true);
        });

        it("does not treat a bare [skip ci] marker as a release commit", () => {
            expect.hasAssertions();

            const matchers = buildIgnoreCommitMatchers();

            // `[skip ci]` means "don't run CI", not "don't release" — swallowing
            // these would silently drop a real patch bump.
            expect(isIgnoredCommit("fix(api): correct the retry budget [skip ci]", matchers)).toBe(false);
            expect(isIgnoredCommit("docs: tweak readme [ci skip]", matchers)).toBe(false);
        });

        it("lets a repo opt back into the blunt [skip ci] rule via config", () => {
            expect.hasAssertions();

            const matchers = buildIgnoreCommitMatchers({ ignoreCommitPattern: String.raw`\[skip ci\]` });

            expect(isIgnoredCommit("fix(api): correct the retry budget [skip ci]", matchers)).toBe(true);
            expect(isIgnoredCommit("fix(api): correct the retry budget", matchers)).toBe(false);
        });

        it("leaves human commits alone", () => {
            expect.hasAssertions();

            const matchers = buildIgnoreCommitMatchers();

            expect(isIgnoredCommit("fix(client,react): encode SSR payloads", matchers)).toBe(false);
            expect(isIgnoredCommit("feat: add a release dashboard", matchers)).toBe(false);
            expect(isIgnoredCommit("chore(deps): bump vitest", matchers)).toBe(false);
        });

        it("extends the built-ins with user patterns rather than replacing them", () => {
            expect.hasAssertions();

            const matchers = buildIgnoreCommitMatchers({ ignoreCommitPattern: "^wip:" });

            expect(matchers).toHaveLength(DEFAULT_RELEASE_COMMIT_PATTERNS.length + 1);
            expect(isIgnoredCommit("wip: half a feature", matchers)).toBe(true);
            expect(isIgnoredCommit("chore(release): version packages", matchers)).toBe(true);
        });

        it("drops the built-ins only on the explicit opt-out", () => {
            expect.hasAssertions();

            const matchers = buildIgnoreCommitMatchers({ ignoreCommitPattern: ["^wip:"], ignoreReleaseCommits: false });

            expect(matchers).toHaveLength(1);
            expect(isIgnoredCommit("chore(release): version packages", matchers)).toBe(false);
            expect(isIgnoredCommit("wip: half a feature", matchers)).toBe(true);
        });

        it("skips an invalid user pattern with a warning instead of throwing", () => {
            expect.hasAssertions();

            const seen: string[] = [];
            const matchers = buildIgnoreCommitMatchers({ ignoreCommitPattern: "([unclosed", onInvalidPattern: (source) => seen.push(source) });

            expect(seen).toStrictEqual(["([unclosed"]);
            expect(matchers).toHaveLength(DEFAULT_RELEASE_COMMIT_PATTERNS.length);
        });
    });

    it("does not bump a package whose only commits in the range are its own release commits", async () => {
        expect.hasAssertions();

        const fixture = setupFixture();

        cwd = fixture.cwd;

        commitTouchingPackage(
            cwd,
            String.raw`chore(release): @scope/a@1.0.0-alpha.44 [skip ci]\n\n## @scope/a [1.0.0-alpha.44](https://x/compare) (2026-09-07)`,
            "rel44",
        );
        commitTouchingPackage(
            cwd,
            String.raw`chore(release): @scope/a@1.0.0-alpha.43 [skip ci]\n\n## @scope/a [1.0.0-alpha.43](https://x/compare) (2026-09-06)`,
            "rel43",
        );

        const result = walked(await generate(fixture));

        expect(result.ignoredCommits).toBe(2);
        expect([...result.bumps.keys()]).toStrictEqual([]);
        expect(result.content).toBeUndefined();
    });

    it("keeps the human commit and drops the release commits that surround it", async () => {
        expect.hasAssertions();

        const fixture = setupFixture();

        cwd = fixture.cwd;

        commitTouchingPackage(cwd, "fix(a): encode SSR payloads", "human");
        commitTouchingPackage(
            cwd,
            String.raw`chore(release): @scope/a@1.0.0-alpha.44 [skip ci]\n\n## @scope/a [1.0.0-alpha.44](https://x) (2026-09-07)`,
            "rel44",
        );

        const result = walked(await generate(fixture));

        expect(result.ignoredCommits).toBe(1);
        expect(result.bumps.get("@scope/a")).toBe("patch");
        expect(result.content).toContain("- fix(a): encode SSR payloads");
        expect(result.content).not.toContain("chore(release)");
        expect(result.content).not.toContain(String.raw`\n\n`);
        expect(result.content).not.toContain("## @scope/a");
    });

    it("honours release.ignoreCommitPattern on top of the built-ins", async () => {
        expect.hasAssertions();

        const fixture = setupFixture();

        cwd = fixture.cwd;

        commitTouchingPackage(cwd, "fix(a): a real fix", "human");
        commitTouchingPackage(cwd, "chore(deps): bump the lockfile", "deps");

        const result = walked(await generate(fixture, { ignoreCommitPattern: String.raw`^chore\(deps\):` }));

        expect(result.ignoredCommits).toBe(1);
        expect(result.content).toContain("- fix(a): a real fix");
        expect(result.content).not.toContain("chore(deps)");
    });

    it("reproduces the old verbatim behaviour when ignoreReleaseCommits is false", async () => {
        expect.hasAssertions();

        const fixture = setupFixture();

        cwd = fixture.cwd;

        commitTouchingPackage(
            cwd,
            String.raw`chore(release): @scope/a@1.0.0-alpha.44 [skip ci]\n\n## @scope/a [1.0.0-alpha.44](https://x) (2026-09-07)`,
            "rel44",
        );

        const result = walked(await generate(fixture, { ignoreReleaseCommits: false }));

        expect(result.ignoredCommits).toBe(0);
        expect(result.bumps.get("@scope/a")).toBe("patch");
        // Subject trimming is unconditional — the changelog header never
        // lands in the change file even with the heuristic disabled.
        expect(result.content).toContain("- chore(release): @scope/a@1.0.0-alpha.44 [skip ci]");
        expect(result.content).not.toContain("## @scope/a [1.0.0-alpha.44]");
    });
});
