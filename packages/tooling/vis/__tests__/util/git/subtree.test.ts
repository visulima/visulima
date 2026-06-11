import { mkdirSync, writeFileSync as nodeWriteFileSync } from "node:fs";

import { join } from "@visulima/path";
import { afterEach, describe, expect, it } from "vitest";

import type { GitExec, GitRunner } from "../../../src/util/git/subtree";
import {
    assertCleanWorktree,
    assertGitRepo,
    countCommits,
    defaultGitRunner,
    initRepoFromBranch,
    isWorktreeClean,
    runGit,
    subtreeAdd,
    subtreeSplit,
} from "../../../src/util/git/subtree";
import { cleanupTemporaryDirectory, createTemporaryDirectory } from "../../test-helpers";

const ok = (stdout = ""): GitExec => { return { status: 0, stderr: "", stdout }; };

interface RecordingRunner {
    calls: { args: string[]; cwd: string }[];
    runner: GitRunner;
}

const makeRunner = (impl: (args: string[]) => GitExec): RecordingRunner => {
    const calls: { args: string[]; cwd: string }[] = [];

    return {
        calls,
        runner: (args, cwd) => {
            calls.push({ args, cwd });

            return impl(args);
        },
    };
};

describe(runGit, () => {
    it("returns trimmed stdout on success", () => {
        expect.assertions(2);

        const { calls, runner } = makeRunner(() => ok("  abc123\n"));

        expect(runGit(["rev-parse", "HEAD"], "/ws", runner)).toBe("abc123");
        expect(calls[0]).toStrictEqual({ args: ["rev-parse", "HEAD"], cwd: "/ws" });
    });

    it("throws with stderr detail on a non-zero exit", () => {
        expect.assertions(1);

        const { runner } = makeRunner(() => { return { status: 128, stderr: "fatal: not a tree", stdout: "" }; });

        expect(() => runGit(["show", "bad"], "/ws", runner)).toThrow(/exit 128[\s\S]*fatal: not a tree/u);
    });
});

describe(assertGitRepo, () => {
    it("passes inside a work tree", () => {
        expect.assertions(1);

        const { runner } = makeRunner(() => ok("true"));

        expect(() => { assertGitRepo("/ws", runner); }).not.toThrow();
    });

    it("throws outside a work tree", () => {
        expect.assertions(1);

        const { runner } = makeRunner(() => { return { status: 128, stderr: "", stdout: "" }; });

        expect(() => { assertGitRepo("/ws", runner); }).toThrow(/Not a git repository/u);
    });
});

describe(isWorktreeClean, () => {
    it("is clean when status --porcelain is empty", () => {
        expect.assertions(2);

        const { runner } = makeRunner(() => ok("\n"));

        expect(isWorktreeClean("/ws", runner)).toBe(true);
        expect(() => { assertCleanWorktree("/ws", runner); }).not.toThrow();
    });

    it("is dirty when status --porcelain reports changes", () => {
        expect.assertions(2);

        const { runner } = makeRunner(() => ok(" M file.ts"));

        expect(isWorktreeClean("/ws", runner)).toBe(false);
        expect(() => { assertCleanWorktree("/ws", runner); }).toThrow(/uncommitted changes/u);
    });
});

describe(subtreeSplit, () => {
    it("builds the split arg vector and returns the branch tip sha", () => {
        expect.assertions(3);

        const { calls, runner } = makeRunner((args) => (args[0] === "rev-parse" ? ok("deadbeef") : ok("")));

        const sha = subtreeSplit({ branch: "vis/split/foo", cwd: "/ws", prefix: "packages/foo", runner });

        expect(sha).toBe("deadbeef");
        expect(calls[0]?.args).toStrictEqual(["subtree", "split", "--prefix=packages/foo", "-b", "vis/split/foo"]);
        expect(calls[1]?.args).toStrictEqual(["rev-parse", "vis/split/foo"]);
    });

    it("inserts --annotate before the branch flag", () => {
        expect.assertions(1);

        const { calls, runner } = makeRunner((args) => (args[0] === "rev-parse" ? ok("sha") : ok("")));

        subtreeSplit({ annotate: "(foo) ", branch: "b", cwd: "/ws", prefix: "packages/foo", runner });

        expect(calls[0]?.args).toStrictEqual(["subtree", "split", "--prefix=packages/foo", "--annotate=(foo) ", "-b", "b"]);
    });
});

describe(subtreeAdd, () => {
    it("builds a minimal add arg vector", () => {
        expect.assertions(1);

        const { calls, runner } = makeRunner(() => ok(""));

        subtreeAdd({ cwd: "/ws", prefix: "packages/foo", ref: "HEAD", repo: "../foo", runner });

        expect(calls[0]?.args).toStrictEqual(["subtree", "add", "--prefix=packages/foo", "../foo", "HEAD"]);
    });

    it("adds --squash and -m before the positional repo/ref", () => {
        expect.assertions(1);

        const { calls, runner } = makeRunner(() => ok(""));

        subtreeAdd({ cwd: "/ws", message: "import foo", prefix: "packages/foo", ref: "v1", repo: "../foo", runner, squash: true });

        expect(calls[0]?.args).toStrictEqual(["subtree", "add", "--prefix=packages/foo", "--squash", "-m", "import foo", "../foo", "v1"]);
    });
});

// --- Real-git integration (git is a hard prerequisite of these commands) ---

const gitInit = (repo: string): void => {
    runGit(["init", "-b", "main"], repo);
    runGit(["config", "user.email", "test@example.com"], repo);
    runGit(["config", "user.name", "Test"], repo);
    runGit(["config", "commit.gpgsign", "false"], repo);
};

const writeFile = (repo: string, relativePath: string, content: string): void => {
    const absolute = join(repo, relativePath);

    mkdirSync(join(absolute, ".."), { recursive: true });
    nodeWriteFileSync(absolute, content);
};

describe("subtree split (real git)", () => {
    const created: string[] = [];

    afterEach(() => {
        for (const directory of created.splice(0)) {
            cleanupTemporaryDirectory(directory);
        }
    });

    it("extracts a subtree into a standalone repo with only its history", () => {
        expect.assertions(4);

        const source = createTemporaryDirectory("vis-split-src-");
        const output = createTemporaryDirectory("vis-split-out-");

        created.push(source, output);

        gitInit(source);

        writeFile(source, "packages/foo/index.js", "export const foo = 1;\n");
        writeFile(source, "packages/bar/index.js", "export const bar = 2;\n");
        runGit(["add", "."], source);
        runGit(["commit", "-m", "init foo and bar"], source);

        writeFile(source, "packages/foo/extra.js", "export const extra = 3;\n");
        runGit(["add", "."], source);
        runGit(["commit", "-m", "add foo extra"], source);

        const tip = subtreeSplit({ branch: "vis/split/foo", cwd: source, prefix: "packages/foo" });

        expect(tip).toMatch(/^[\da-f]{7,40}$/u);

        initRepoFromBranch({ branch: "main", source, sourceBranch: "vis/split/foo", target: output });

        // foo's files are at the root of the new repo, bar is absent.
        expect(isWorktreeClean(output)).toBe(true);

        const tracked = runGit(["ls-files"], output).split("\n").sort();

        expect(tracked).toStrictEqual(["extra.js", "index.js"]);
        expect(countCommits("main", output)).toBe(2);
    });
});

describe(defaultGitRunner, () => {
    it("reports a non-zero status instead of throwing for a failed git command", () => {
        expect.assertions(1);

        const repo = createTemporaryDirectory("vis-runner-");

        try {
            // Not a git repo yet → rev-parse fails with a non-zero status.
            const result = defaultGitRunner(["rev-parse", "--is-inside-work-tree"], repo);

            expect(result.status).not.toBe(0);
        } finally {
            cleanupTemporaryDirectory(repo);
        }
    });
});
