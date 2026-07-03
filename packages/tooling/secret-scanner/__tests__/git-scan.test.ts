import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { scanGitHistory } from "../src/git-scan";
import { scanString } from "../src/index";

// A real (fake) GitHub PAT — `ghp_` + 36 base62 chars — matches the bundled
// `github-pat` rule. Defined once so commit content and assertions agree.
const SECRET = "ghp_aB3dE4fG5hI6jK7lM8nO9pQ0rS1tU2vW3xY4";

let repo: string;

// Strip inherited git-control env vars (set when this suite runs inside a git
// hook, e.g. pre-commit) so the fixture is built in `repo` and not the
// surrounding repository. Mirrors the scrubbing scanGitHistory does internally.
const GIT_REPO_ENV_KEYS = new Set(["GIT_COMMON_DIR", "GIT_DIR", "GIT_INDEX_FILE", "GIT_NAMESPACE", "GIT_OBJECT_DIRECTORY", "GIT_WORK_TREE"]);
const hermeticGitEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !GIT_REPO_ENV_KEYS.has(key)));

const git = (...arguments_: string[]): void => {
    execFileSync("git", arguments_, { cwd: repo, env: hermeticGitEnv, stdio: "ignore" });
};

// Warm the Rust regex JIT once so the first scan doesn't time out.
beforeAll(async () => {
    await scanString("warmup", "warmup.txt");

    repo = mkdtempSync(join(tmpdir(), "secret-scanner-git-"));

    git("init", "-q");
    git("config", "user.email", "test@example.com");
    git("config", "user.name", "Test User");
    git("config", "commit.gpgsign", "false");

    // Commit 1: introduce a clean file.
    writeFileSync(join(repo, "app.ts"), "export const port = 3000;\n");
    git("add", "app.ts");
    git("commit", "-q", "-m", "feat: add app");

    // Commit 2: introduce a secret in a NEW file.
    writeFileSync(join(repo, "config.env"), `GITHUB_TOKEN="${SECRET}"\n`);
    git("add", "config.env");
    git("commit", "-q", "-m", "chore: add config");

    // Commit 3: REMOVE the secret file entirely. A working-tree scan would
    // now find nothing; the history scan must still surface commit 2.
    rmSync(join(repo, "config.env"));
    git("add", "-A");
    git("commit", "-q", "-m", "chore: drop config");
}, 120_000);

afterAll(() => {
    rmSync(repo, { force: true, recursive: true });
});

describe(scanGitHistory, () => {
    it("finds a secret that was committed then deleted", async () => {
        expect.assertions(4);

        const findings = await scanGitHistory({ cwd: repo });
        const tokenFindings = findings.filter((f) => f.secret === SECRET || f.match.includes(SECRET));

        expect(tokenFindings.length).toBeGreaterThan(0);

        const hit = tokenFindings[0]!;

        expect(hit.file).toBe("config.env");
        expect(hit.commit.message).toBe("chore: add config");
        expect(hit.commit.authorEmail).toBe("test@example.com");
    });

    it("annotates every finding with full commit metadata", async () => {
        expect.assertions(3);

        const findings = await scanGitHistory({ cwd: repo });

        expect(findings.length).toBeGreaterThan(0);
        expect(findings.every((f) => /^[0-9a-f]{40}$/.test(f.commit.sha))).toBe(true);
        // ISO-8601 date from `%aI`.
        expect(findings.every((f) => /^\d{4}-\d{2}-\d{2}T/.test(f.commit.date))).toBe(true);
    });

    it("honours maxCommits to bound the walk", async () => {
        expect.assertions(1);

        // Only the most-recent commit (the deletion) is walked; the secret was
        // introduced earlier, so it must not appear.
        const findings = await scanGitHistory({ cwd: repo, maxCommits: 1 });

        expect(findings.some((f) => f.secret === SECRET)).toBe(false);
    });

    it("scans a bounded range via since/until", async () => {
        expect.assertions(1);

        // HEAD~2..HEAD covers commits 2 and 3, so the secret introduced in
        // commit 2 is in range.
        const findings = await scanGitHistory({ cwd: repo, since: "HEAD~2", until: "HEAD" });

        expect(findings.some((f) => f.match.includes(SECRET))).toBe(true);
    });

    it("respects the redact option per blob", async () => {
        expect.assertions(1);

        const findings = await scanGitHistory({ cwd: repo, redact: true });
        const tokenFindings = findings.filter((f) => f.ruleId.includes("github") || f.match.includes("ghp_"));

        // Redacted findings carry no raw secret.
        expect(tokenFindings.every((f) => f.secret.includes("*") || !f.secret.includes(SECRET))).toBe(true);
    });

    it("rejects a range that looks like a git flag", async () => {
        expect.assertions(1);

        await expect(scanGitHistory({ cwd: repo, range: "--output=/tmp/evil" })).rejects.toThrow(/looks like a flag/);
    });
});
