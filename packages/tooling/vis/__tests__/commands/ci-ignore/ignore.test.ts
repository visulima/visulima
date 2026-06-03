import { execFileSync, execSync } from "node:child_process";
// `mkdtempSync` has no `@visulima/fs` equivalent (it's a node-specific API);
// writes and removals go through @visulima/fs.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";

import { removeSync, writeFileSync } from "@visulima/fs";
import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { IgnoreDecision } from "../../../src/commands/ci-ignore-helpers";
import {
    CI_BASE_SHA_ENV_VARS,
    commitHasForceDeployMessage,
    commitHasSkipMessage,
    decideBuild,
    decideSkip,
    exitCodeFor,
    FORCE_TOKENS,
    formatDecisionLine,
    isRefReachable,
    matchesPerProjectToken,
    readLastCommitMessage,
    resolveCiBaseSha,
    SKIP_TOKENS,
    validateGitRef,
} from "../../../src/commands/ci-ignore-helpers";

/**
 * Builds a temp directory with an initialised git repo and a seeded
 * commit so the git-backed helpers have something to read.
 */
const createTemporaryGitRepo = (): { cleanup: () => void; commit: (message: string) => string; root: string } => {
    const root = mkdtempSync(join(tmpdir(), "vis-ignore-test-"));

    execSync("git init -q", { cwd: root });
    execSync("git config user.email 'test@example.com'", { cwd: root });
    execSync("git config user.name 'Test'", { cwd: root });
    execSync("git config commit.gpgsign false", { cwd: root });

    // Monotonic counter keeps test filenames unique without relying on
    // Date.now() + Math.random() (which can collide inside a single ms).
    let fileSeq = 0;

    const commit = (message: string): string => {
        writeFileSync(join(root, `f-${fileSeq++}`), "x");
        execSync("git add -A", { cwd: root });
        execFileSync("git", ["commit", "-q", "-m", message], { cwd: root });

        return execSync("git rev-parse HEAD", { cwd: root }).toString().trim();
    };

    return {
        cleanup: () => {
            removeSync(root);
        },
        commit,
        root,
    };
};

describe(commitHasSkipMessage, () => {
    it.each(SKIP_TOKENS)("matches skip token %s regardless of project", (token) => {
        expect.assertions(1);
        expect(commitHasSkipMessage(`chore: bump deps ${token}`, "my-app")).toBe(true);
    });

    it("matches per-project vis skip token", () => {
        expect.assertions(2);
        expect(commitHasSkipMessage("chore: [vis skip my-app]", "my-app")).toBe(true);
        // Different project name should not match
        expect(commitHasSkipMessage("chore: [vis skip other-app]", "my-app")).toBe(false);
    });

    it("matches per-project legacy nx skip token for migration ergonomics", () => {
        expect.assertions(2);
        expect(commitHasSkipMessage("chore: [nx skip my-app]", "my-app")).toBe(true);
        expect(commitHasSkipMessage("chore: [nx skip other-app]", "my-app")).toBe(false);
    });

    it("returns false on empty or unrelated messages", () => {
        expect.assertions(3);
        expect(commitHasSkipMessage("", "my-app")).toBe(false);
        expect(commitHasSkipMessage("feat: add new feature", "my-app")).toBe(false);
        expect(commitHasSkipMessage("docs: update README", "my-app")).toBe(false);
    });
});

describe(commitHasForceDeployMessage, () => {
    it.each(FORCE_TOKENS)("matches force-deploy token %s regardless of project", (token) => {
        expect.assertions(1);
        expect(commitHasForceDeployMessage(`fix: urgent hotfix ${token}`, "my-app")).toBe(true);
    });

    it("matches per-project vis deploy token", () => {
        expect.assertions(2);
        expect(commitHasForceDeployMessage("fix: [vis deploy my-app]", "my-app")).toBe(true);
        expect(commitHasForceDeployMessage("fix: [vis deploy other-app]", "my-app")).toBe(false);
    });

    it("matches per-project legacy nx deploy token", () => {
        expect.assertions(2);
        expect(commitHasForceDeployMessage("fix: [nx deploy my-app]", "my-app")).toBe(true);
        expect(commitHasForceDeployMessage("fix: [nx deploy other-app]", "my-app")).toBe(false);
    });

    it("returns false when no force token is present", () => {
        expect.assertions(2);
        expect(commitHasForceDeployMessage("", "my-app")).toBe(false);
        expect(commitHasForceDeployMessage("feat: something", "my-app")).toBe(false);
    });
});

describe(resolveCiBaseSha, () => {
    it("returns undefined when no CI env var is set", () => {
        expect.assertions(1);
        expect(resolveCiBaseSha({})).toBeUndefined();
    });

    it("returns Netlify CACHED_COMMIT_REF first", () => {
        expect.assertions(1);

        const env: NodeJS.ProcessEnv = {
            CACHED_COMMIT_REF: "netlify-sha",
            VERCEL_GIT_PREVIOUS_SHA: "vercel-sha",
        };

        expect(resolveCiBaseSha(env)).toBe("netlify-sha");
    });

    it("falls back to Vercel when Netlify is absent", () => {
        expect.assertions(1);
        expect(resolveCiBaseSha({ VERCEL_GIT_PREVIOUS_SHA: "vercel-sha" })).toBe("vercel-sha");
    });

    it("falls back to GitHub Actions GITHUB_BASE_REF", () => {
        expect.assertions(1);
        expect(resolveCiBaseSha({ GITHUB_BASE_REF: "main" })).toBe("main");
    });

    it("falls back to GitLab CI_COMMIT_BEFORE_SHA", () => {
        expect.assertions(1);
        expect(resolveCiBaseSha({ CI_COMMIT_BEFORE_SHA: "gitlab-sha" })).toBe("gitlab-sha");
    });

    it("ignores empty-string env vars and continues the priority chain", () => {
        expect.assertions(1);

        const env: NodeJS.ProcessEnv = {
            CACHED_COMMIT_REF: "",
            GITHUB_BASE_REF: "main",
            VERCEL_GIT_PREVIOUS_SHA: "   ",
        };

        expect(resolveCiBaseSha(env)).toBe("main");
    });

    it("trims whitespace from the resolved value", () => {
        expect.assertions(1);
        expect(resolveCiBaseSha({ CACHED_COMMIT_REF: "  abc123  " })).toBe("abc123");
    });

    it("has Cloudflare Pages / Render absent from the priority list by design", () => {
        expect.assertions(2);
        // Cloudflare Pages and Render have no custom-command hook, so we
        // intentionally don't detect their env vars — shipping them would
        // only create the illusion of support. This test locks that in.
        expect(CI_BASE_SHA_ENV_VARS).not.toContain("CF_PAGES_COMMIT_SHA");
        expect(CI_BASE_SHA_ENV_VARS).not.toContain("RENDER_GIT_COMMIT");
    });
});

describe(validateGitRef, () => {
    it("accepts common git ref shapes", () => {
        expect.assertions(6);
        expect(() => {
            validateGitRef("HEAD");
        }).not.toThrow();
        expect(() => {
            validateGitRef("HEAD~1");
        }).not.toThrow();
        expect(() => {
            validateGitRef("HEAD^");
        }).not.toThrow();
        expect(() => {
            validateGitRef("main");
        }).not.toThrow();
        expect(() => {
            validateGitRef("origin/main");
        }).not.toThrow();
        expect(() => {
            validateGitRef("abc123def456");
        }).not.toThrow();
    });

    it("rejects refs containing shell metacharacters", () => {
        expect.assertions(5);
        expect(() => {
            validateGitRef("main; rm -rf /");
        }).toThrow(/Invalid git ref/);
        expect(() => {
            validateGitRef("main && evil");
        }).toThrow(/Invalid git ref/);
        expect(() => {
            validateGitRef("main | cat");
        }).toThrow(/Invalid git ref/);
        expect(() => {
            validateGitRef("$(whoami)");
        }).toThrow(/Invalid git ref/);
        expect(() => {
            validateGitRef("`whoami`");
        }).toThrow(/Invalid git ref/);
    });

    it("rejects refs starting with a dash (prevents git flag injection)", () => {
        expect.assertions(4);
        // A leading dash makes `${ref}^{commit}` look like a `git` option
        // to `git rev-parse --verify`, bypassing the positional argument path.
        expect(() => {
            validateGitRef("--help");
        }).toThrow(/Invalid git ref/);
        expect(() => {
            validateGitRef("-rf");
        }).toThrow(/Invalid git ref/);
        expect(() => {
            validateGitRef("--base=main");
        }).toThrow(/Invalid git ref/);
        expect(() => {
            validateGitRef("-");
        }).toThrow(/Invalid git ref/);
    });

    it("still accepts dashes in the middle of refs", () => {
        expect.assertions(2);
        expect(() => {
            validateGitRef("feature-branch");
        }).not.toThrow();
        expect(() => {
            validateGitRef("release-v1.2.3");
        }).not.toThrow();
    });
});

describe(exitCodeFor, () => {
    const decisionBuild: IgnoreDecision = { action: "build", message: "", project: "p", reason: "project-affected" };
    const decisionSkip: IgnoreDecision = { action: "skip", message: "", project: "p", reason: "project-not-affected" };

    it("defaults to inverted semantics (Vercel/Netlify contract)", () => {
        expect.assertions(2);
        expect(exitCodeFor(decisionSkip, false)).toBe(0);
        expect(exitCodeFor(decisionBuild, false)).toBe(1);
    });

    it("with --exit-zero-on-build, build exits 0 but skip still exits 0", () => {
        expect.assertions(2);
        expect(exitCodeFor(decisionSkip, true)).toBe(0);
        expect(exitCodeFor(decisionBuild, true)).toBe(0);
    });
});

describe(matchesPerProjectToken, () => {
    it("matches vis prefix for the given verb and project", () => {
        expect.assertions(2);
        expect(matchesPerProjectToken("chore: [vis skip my-app]", "skip", "my-app")).toBe(true);
        expect(matchesPerProjectToken("fix: [vis deploy my-app]", "deploy", "my-app")).toBe(true);
    });

    it("matches legacy nx prefix for backward compatibility", () => {
        expect.assertions(2);
        expect(matchesPerProjectToken("chore: [nx skip my-app]", "skip", "my-app")).toBe(true);
        expect(matchesPerProjectToken("fix: [nx deploy my-app]", "deploy", "my-app")).toBe(true);
    });

    it("rejects a different project name", () => {
        expect.assertions(1);
        expect(matchesPerProjectToken("chore: [vis skip other]", "skip", "my-app")).toBe(false);
    });

    it("rejects the wrong verb", () => {
        expect.assertions(1);
        // A force-deploy token should not be treated as a skip token.
        expect(matchesPerProjectToken("chore: [vis deploy my-app]", "skip", "my-app")).toBe(false);
    });
});

describe("decision factories", () => {
    it("decideBuild returns a build decision with the given fields", () => {
        expect.assertions(1);

        const decision = decideBuild("my-app", "project-affected", "hello");

        expect(decision).toStrictEqual({
            action: "build",
            message: "hello",
            project: "my-app",
            reason: "project-affected",
        });
    });

    it("decideSkip merges extra base/head/affectedProjects", () => {
        expect.assertions(1);

        const decision = decideSkip("my-app", "project-not-affected", "nope", {
            affectedProjects: ["other"],
            base: "HEAD~1",
            head: "HEAD",
        });

        expect(decision).toStrictEqual({
            action: "skip",
            affectedProjects: ["other"],
            base: "HEAD~1",
            head: "HEAD",
            message: "nope",
            project: "my-app",
            reason: "project-not-affected",
        });
    });

    it("decideBuild accepts extras without clobbering the action", () => {
        expect.assertions(2);

        const decision = decideBuild("my-app", "project-affected", "go", {
            affectedProjects: ["my-app"],
            base: "main",
        });

        expect(decision.action).toBe("build");
        expect(decision.affectedProjects).toStrictEqual(["my-app"]);
    });
});

describe(formatDecisionLine, () => {
    it("prepends stop emoji for skip actions", () => {
        expect.assertions(1);

        const decision: IgnoreDecision = {
            action: "skip",
            message: "nothing changed",
            project: "my-app",
            reason: "no-changes",
        };

        expect(formatDecisionLine(decision)).toBe("\u{1F6D1} nothing changed");
    });

    it("prepends check mark for build actions", () => {
        expect.assertions(1);

        const decision: IgnoreDecision = {
            action: "build",
            message: "project affected",
            project: "my-app",
            reason: "project-affected",
        };

        expect(formatDecisionLine(decision)).toBe("\u2705 project affected");
    });
});

describe(readLastCommitMessage, () => {
    let repo: ReturnType<typeof createTemporaryGitRepo>;

    beforeEach(() => {
        repo = createTemporaryGitRepo();
    });

    afterEach(() => {
        repo.cleanup();
    });

    it("returns the full subject of the latest commit", async () => {
        expect.assertions(1);

        repo.commit("feat: test commit");

        const message = await readLastCommitMessage(repo.root);

        expect(message.trim()).toBe("feat: test commit");
    });

    it("returns empty string on failure (no git repo)", async () => {
        expect.assertions(1);

        const outsideRepo = mkdtempSync(join(tmpdir(), "vis-ignore-no-git-"));

        try {
            const message = await readLastCommitMessage(outsideRepo);

            expect(message).toBe("");
        } finally {
            removeSync(outsideRepo);
        }
    });

    it("preserves multi-line commit bodies (so per-project tokens in footers work)", async () => {
        expect.assertions(2);

        repo.commit("feat: do thing\n\nDetails\n\n[vis skip my-app]");

        const message = await readLastCommitMessage(repo.root);

        expect(message).toContain("do thing");
        expect(commitHasSkipMessage(message, "my-app")).toBe(true);
    });
});

describe(isRefReachable, () => {
    let repo: ReturnType<typeof createTemporaryGitRepo>;

    beforeEach(() => {
        repo = createTemporaryGitRepo();
    });

    afterEach(() => {
        repo.cleanup();
    });

    it("returns true for HEAD when a commit exists", async () => {
        expect.assertions(1);

        repo.commit("first");

        await expect(isRefReachable(repo.root, "HEAD")).resolves.toBe(true);
    });

    it("returns true for an existing SHA", async () => {
        expect.assertions(1);

        const sha = repo.commit("first");

        await expect(isRefReachable(repo.root, sha)).resolves.toBe(true);
    });

    it("returns false for an unknown SHA", async () => {
        expect.assertions(1);

        repo.commit("first");

        await expect(isRefReachable(repo.root, "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef")).resolves.toBe(false);
    });

    it("returns false for HEAD~1 when there's only one commit (shallow-clone simulation)", async () => {
        expect.assertions(1);

        repo.commit("only commit");

        await expect(isRefReachable(repo.root, "HEAD~1")).resolves.toBe(false);
    });
});
