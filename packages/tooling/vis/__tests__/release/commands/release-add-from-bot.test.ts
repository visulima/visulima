/**
 * `vis release add --from-bot-pr` (changesets #647).
 *
 * The handler inspects the active PR via `gh pr view --json title,body,
 * author` and synthesises a change file from the bot's PR title.
 * Coverage matrix:
 *
 *   1. Dependabot-style title  → patch-bump for the affected workspace
 *      package(s).
 *   2. Renovate-style title    → same, even when the title omits the
 *      `from &lt;X>` version.
 *   3. Unrecognised title      → graceful exit (no change file, exit 0).
 *   4. No PR can be located    → hard error (exit 1).
 *
 * The title-parsing predicate (`parseBotPrTitle`) is exported so we can
 * unit-test it directly without touching gh — the integration test that
 * exercises the file-write end of the handler stubs `gh` by injecting a
 * CommandRunner through the handler's `__setBotPrRunnerForTests` seam.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import addFromBotHandler, { __setBotPrRunnerForTests, parseBotPrTitle } from "../../../src/commands/release/add/handler";

interface RunResult { exitCode: number; stderr: string; stdout: string }

const writeJson = (path: string, value: unknown): void => {
    writeFileSync(path, `${JSON.stringify(value, null, 4)}\n`);
};

const writeVisConfigCjs = (cwd: string): void => {
    const block = { release: { acknowledgeUnstable: true, defaultManaged: true } };

    writeFileSync(join(cwd, "vis.config.cjs"), `module.exports = ${JSON.stringify(block, null, 4)};\n`);
};

/**
 * Minimal fixture: one workspace package `@scope/a` that depends on
 * `lodash` (so a Dependabot/Renovate PR for lodash should generate a
 * patch bump for \@scope/a). Initialised as a git repo so buildContext
 * doesn't complain about a detached state.
 */
const setupFixture = (deps?: Record<string, string>): string => {
    const resolvedDeps = deps ?? { lodash: "^4.17.21" };
    const cwd = mkdtempSync(join(tmpdir(), "vis-add-from-bot-"));

    writeJson(join(cwd, "package.json"), {
        name: "fixture-root",
        packageManager: "pnpm@10.0.0",
        private: true,
        version: "0.0.0",
        workspaces: ["packages/*"],
    });

    writeFileSync(join(cwd, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n");
    mkdirSync(join(cwd, "packages", "a"), { recursive: true });
    writeJson(join(cwd, "packages", "a", "package.json"), {
        dependencies: resolvedDeps,
        name: "@scope/a",
        version: "1.0.0",
    });
    mkdirSync(join(cwd, ".vis", "release"), { recursive: true });

    writeVisConfigCjs(cwd);

    execFileSync("git", ["init", "-q", "--initial-branch", "main"], { cwd });
    execFileSync("git", ["config", "user.email", "test@test"], { cwd });
    execFileSync("git", ["config", "user.name", "Test"], { cwd });
    execFileSync("git", ["add", "."], { cwd });
    execFileSync("git", ["commit", "-q", "-m", "initial"], { cwd });

    return cwd;
};

interface CapturedLog {
    args: unknown[];
    level: "info" | "warn" | "error";
}

const makeToolbox = (cwd: string, options: { "from-bot-pr"?: boolean; message?: string } = {}) => {
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
                // cerebro camelCases option names before handing them to the
                // handler, so the fake toolbox must mirror that (the handler
                // reads `options.fromBotPr`, not the kebab form).
                fromBotPr: options["from-bot-pr"],
                message: options.message,
            } as never,
            workspaceRoot: cwd,
        } as never,
    };
};

// ── parseBotPrTitle ─────────────────────────────────────────────────

describe(parseBotPrTitle, () => {
    it("parses Dependabot 'build(deps): bump <pkg> from X to Y'", () => {
        const parsed = parseBotPrTitle("build(deps): bump lodash from 4.17.20 to 4.17.21");

        expect(parsed).toEqual({
            dep: "lodash",
            fromVersion: "4.17.20",
            toVersion: "4.17.21",
        });
    });

    it("parses bare Dependabot 'Bump <pkg> from X to Y'", () => {
        const parsed = parseBotPrTitle("Bump axios from 1.4.0 to 1.5.0");

        expect(parsed?.dep).toBe("axios");
        expect(parsed?.toVersion).toBe("1.5.0");
    });

    it("parses Dependabot with 'in /path' suffix", () => {
        const parsed = parseBotPrTitle("chore(deps): bump @types/node from 20.10.0 to 20.11.0 in /examples");

        expect(parsed).toEqual({
            dep: "@types/node",
            fromVersion: "20.10.0",
            toVersion: "20.11.0",
        });
    });

    it("parses Renovate 'Update dependency <pkg> to <version>'", () => {
        const parsed = parseBotPrTitle("Update dependency lodash to v4.17.21");

        expect(parsed?.dep).toBe("lodash");
        expect(parsed?.toVersion).toBe("v4.17.21");
        expect(parsed?.fromVersion).toBe("");
    });

    it("parses Renovate with conventional-commit prefix", () => {
        const parsed = parseBotPrTitle("chore(deps): update dependency typescript to 5.4.0");

        expect(parsed?.dep).toBe("typescript");
        expect(parsed?.toVersion).toBe("5.4.0");
    });

    it("parses Renovate title with trailing suffix tag", () => {
        // Renovate occasionally appends "[skip-ci]" / "[security]" / scope
        // tags / emoji to the title; the dep + target version must still be
        // extracted cleanly. Regression test for F8.
        const skipCi = parseBotPrTitle("Update module foo to 1.2.3 [skip-ci]");

        expect(skipCi?.dep).toBe("foo");
        expect(skipCi?.toVersion).toBe("1.2.3");

        const withPrefix = parseBotPrTitle("chore(deps): update dependency lodash to 4.18.0 [security]");

        expect(withPrefix?.dep).toBe("lodash");
        expect(withPrefix?.toVersion).toBe("4.18.0");
    });

    it("returns undefined for an unrecognised title", () => {
        expect(parseBotPrTitle("feat: add tab completion")).toBeUndefined();
        expect(parseBotPrTitle("Merge pull request #123 from foo/bar")).toBeUndefined();
        expect(parseBotPrTitle("")).toBeUndefined();
    });
});

// ── Handler integration ────────────────────────────────────────────

// TODO(windows): buildContext loads vis.config via the native importTs loader,
// which intermittently deadlocks on win32 (~30s timeout + EBUSY on temp rmdir).
// Skip the buildContext-driven suite there until the loader is fixed on a real
// Windows box. See project_vis_windows_release_layered_fixes_pr687.
const isWindows = process.platform === "win32";

describe.skipIf(isWindows)("vis release add --from-bot-pr (handler integration)", () => {
    let cwd: string;
    const originalExitCode = process.exitCode;
    const originalEnv = { ...process.env };

    // `gh` is stubbed by injecting a CommandRunner via the handler's test seam
    // (no module mocking — the handler reaches the real runner through a
    // dynamic import, which made vi.doMock order-sensitive). Each test sets
    // `ghRun` to the behaviour it needs.
    let ghRun: (cmd: string, args: ReadonlyArray<string>) => Promise<RunResult>;

    const ghPrView = (response: { author: string; body?: string; title: string }) =>
        async (cmd: string, args: ReadonlyArray<string>): Promise<RunResult> => {
            if (cmd === "gh" && args[0] === "pr" && args[1] === "view") {
                return {
                    exitCode: 0,
                    stderr: "",
                    stdout: JSON.stringify({ author: { login: response.author }, body: response.body ?? "", title: response.title }),
                };
            }

            return { exitCode: 0, stderr: "", stdout: "" };
        };

    beforeEach(() => {
        cwd = setupFixture();
        process.exitCode = 0;
        process.env.PR_NUMBER = "42";
        ghRun = async () => { return { exitCode: 0, stderr: "", stdout: "" }; };
        __setBotPrRunnerForTests({ run: (cmd, args) => ghRun(cmd, args) });
    });

    afterEach(async () => {
        process.exitCode = originalExitCode;
        process.env = originalEnv;
        __setBotPrRunnerForTests(undefined);
        await rm(cwd, { force: true, recursive: true });
    });

    it("authors a patch-bump change file from a Dependabot PR title", async () => {
        ghRun = ghPrView({ author: "dependabot[bot]", title: "build(deps): bump lodash from 4.17.20 to 4.17.21" });

        const { toolbox } = makeToolbox(cwd, { "from-bot-pr": true });

        await addFromBotHandler(toolbox);

        // Verify a change file was written. The slug is randomised so we
        // glob the changes dir.
        const files = readdirSync(join(cwd, ".vis", "release")).filter((f) => f.endsWith(".md"));

        expect(files).toHaveLength(1);

        const content = readFileSync(join(cwd, ".vis", "release", files[0]!), "utf8");

        expect(content).toMatch(/"?@scope\/a"?:\s*patch/);
        expect(content).toMatch(/Updated lodash from 4\.17\.20 to 4\.17\.21/);
    });

    it("authors a patch-bump change file from a Renovate PR title", async () => {
        ghRun = ghPrView({ author: "renovate[bot]", title: "Update dependency lodash to v4.18.0" });

        const { toolbox } = makeToolbox(cwd, { "from-bot-pr": true });

        await addFromBotHandler(toolbox);

        const files = readdirSync(join(cwd, ".vis", "release")).filter((f) => f.endsWith(".md"));

        expect(files).toHaveLength(1);

        const content = readFileSync(join(cwd, ".vis", "release", files[0]!), "utf8");

        expect(content).toMatch(/"?@scope\/a"?:\s*patch/);
        expect(content).toMatch(/Updated lodash to v4\.18\.0/);
    });

    it("exits gracefully when the PR title is not a bot pattern (no change file written)", async () => {
        ghRun = ghPrView({ author: "human-user", title: "feat: add a new awesome feature" });

        const { logs, toolbox } = makeToolbox(cwd, { "from-bot-pr": true });

        await addFromBotHandler(toolbox);

        // Graceful exit: exit code stays 0 and no change file is created.
        expect(process.exitCode).toBe(0);

        const files = readdirSync(join(cwd, ".vis", "release")).filter((f) => f.endsWith(".md"));

        expect(files).toHaveLength(0);
        // An info-level message must explain why nothing happened.
        expect(logs.some((l) => l.level === "info" && String(l.args[0]).includes("not a recognised"))).toBe(true);
    });

    it("exits 1 when no PR can be located (gh returns non-zero, no env signal)", async () => {
        // Drop the PR_NUMBER env so the fallback path through `gh pr view`
        // is exercised. The injected runner returns exit code 1 to simulate
        // "gh not authenticated / no PR for this branch".
        delete process.env.PR_NUMBER;
        delete process.env.GITHUB_REF;

        ghRun = async () => { return { exitCode: 1, stderr: "no PR", stdout: "" }; };

        const { logs, toolbox } = makeToolbox(cwd, { "from-bot-pr": true });

        await addFromBotHandler(toolbox);

        expect(process.exitCode).toBe(1);
        expect(logs.some((l) => l.level === "error" && String(l.args[0]).includes("No PR found"))).toBe(true);
    });
});
