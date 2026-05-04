/* eslint-disable vitest/no-conditional-in-test -- conditionals are platform/feature gates (Linux git availability, POSIX symlink support) that skip the body cleanly when the environment cannot satisfy them */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getMainWorktreeRoot, isLinkedWorktree, resetWorktreeCache } from "../src/worktree";

// When this test file runs inside a git pre-commit hook, git exports
// GIT_DIR / GIT_INDEX_FILE / GIT_WORK_TREE pointing at the hook-running
// repo. Those leak into vitest workers and confuse `git worktree add`
// inside the temp fixture repos. Strip them so child `git` calls operate
// on the fixture's own `.git`.
for (const key of Object.keys(process.env)) {
    if (key.startsWith("GIT_")) {
        Reflect.deleteProperty(process.env, key);
    }
}

const hasGit = (() => {
    try {
        execFileSync("git", ["--version"], { stdio: "ignore" });

        return true;
    } catch {
        return false;
    }
})();

const setupGitIdentity = (cwd: string): void => {
    execFileSync("git", ["config", "user.email", "test@example.com"], { cwd, stdio: "ignore" });
    execFileSync("git", ["config", "user.name", "Test"], { cwd, stdio: "ignore" });
};

const initRepoWithCommit = (cwd: string): void => {
    execFileSync("git", ["init", "--initial-branch=main"], { cwd, stdio: "ignore" });
    setupGitIdentity(cwd);
    writeFileSync(join(cwd, "README.md"), "# test\n");
    execFileSync("git", ["add", "README.md"], { cwd, stdio: "ignore" });
    execFileSync("git", ["commit", "-m", "init"], { cwd, stdio: "ignore" });
};

describe(getMainWorktreeRoot, () => {
    let scratch: string;

    beforeEach(() => {
        scratch = mkdtempSync(join(realpathSync(tmpdir()), "tr-worktree-"));
        resetWorktreeCache();
    });

    afterEach(() => {
        resetWorktreeCache();

        if (existsSync(scratch)) {
            rmSync(scratch, { force: true, recursive: true });
        }
    });

    it("returns undefined for a primary checkout (`.git` is a directory)", () => {
        expect.assertions(2);

        if (!hasGit) {
            return;
        }

        const repo = join(scratch, "main");

        mkdirSync(repo);
        initRepoWithCommit(repo);

        expect(isLinkedWorktree(repo)).toBe(false);
        expect(getMainWorktreeRoot(repo)).toBeUndefined();
    });

    it("returns undefined when `.git` does not exist", () => {
        expect.assertions(2);

        const plain = join(scratch, "plain");

        mkdirSync(plain);

        expect(isLinkedWorktree(plain)).toBe(false);
        expect(getMainWorktreeRoot(plain)).toBeUndefined();
    });

    it("resolves a linked worktree to its main checkout", () => {
        expect.assertions(3);

        if (!hasGit) {
            return;
        }

        const main = `${realpathSync(scratch)}/main`;

        mkdirSync(main);
        initRepoWithCommit(main);

        const linked = `${realpathSync(scratch)}/feat`;

        execFileSync("git", ["worktree", "add", "-b", "feat", linked], { cwd: main, stdio: "ignore" });

        try {
            expect(isLinkedWorktree(linked)).toBe(true);
            expect(isLinkedWorktree(main)).toBe(false);
            expect(getMainWorktreeRoot(linked)).toBe(main);
        } finally {
            execFileSync("git", ["worktree", "remove", "--force", linked], { cwd: main, stdio: "ignore" });
        }
    });

    it("memoizes the result across calls", () => {
        expect.assertions(2);

        if (!hasGit) {
            return;
        }

        const main = `${realpathSync(scratch)}/main`;

        mkdirSync(main);
        initRepoWithCommit(main);

        const first = getMainWorktreeRoot(main);
        const second = getMainWorktreeRoot(main);

        expect(first).toBe(second);
        expect(first).toBeUndefined();
    });

    it("treats a `.git` symlink-to-directory like a primary checkout", () => {
        expect.assertions(1);

        if (!hasGit) {
            return;
        }

        // POSIX-only: skip cleanly on Windows where symlinks need privileges.
        if (process.platform === "win32") {
            return;
        }

        const realRepo = join(scratch, "real");

        mkdirSync(realRepo);
        initRepoWithCommit(realRepo);

        const linkRepo = join(scratch, "link");

        mkdirSync(linkRepo);
        symlinkSync(join(realRepo, ".git"), join(linkRepo, ".git"));

        // A symlinked .git pointing at a real .git directory should still be
        // treated as a primary checkout (no shared cache lookup needed).
        expect(getMainWorktreeRoot(linkRepo)).toBeUndefined();
    });

    it("resolves a `.git` symlinked to a real gitlink file like a regular linked worktree", () => {
        // Regression: previously the Rust binding used `fs::symlink_metadata`
        // (does NOT follow symlinks), so a symlinked `.git` pointing at a
        // real gitlink file was classified as "neither dir nor file" and
        // returned `undefined`, while `is_linked_worktree` (which follows
        // symlinks) reported `true`. The two probes must agree.
        expect.assertions(2);

        if (!hasGit) {
            return;
        }

        // POSIX-only: skip cleanly on Windows where symlinks need privileges.
        if (process.platform === "win32") {
            return;
        }

        const main = `${realpathSync(scratch)}/main`;

        mkdirSync(main);
        initRepoWithCommit(main);

        const real = `${realpathSync(scratch)}/symlink-target`;

        // Use a branch name unique to this test so concurrent test workers
        // operating on neighboring scratch dirs cannot collide on `feat`.
        execFileSync("git", ["worktree", "add", "-b", "symlink-feat", real], { cwd: main, stdio: "ignore" });

        const symlinked = `${realpathSync(scratch)}/symlink-link`;

        mkdirSync(symlinked);
        // Mirror everything except `.git`, which we replace with a symlink to
        // the real gitlink file. The git CLI happily follows the symlink and
        // resolves the worktree from the linked location.
        symlinkSync(join(real, ".git"), join(symlinked, ".git"));

        try {
            expect(isLinkedWorktree(symlinked)).toBe(true);
            // Both probes must agree: the symlinked `.git` IS a linked
            // worktree, and its main root is `main`.
            expect(getMainWorktreeRoot(symlinked)).toBe(main);
        } finally {
            execFileSync("git", ["worktree", "remove", "--force", real], { cwd: main, stdio: "ignore" });
        }
    });
});

describe(isLinkedWorktree, () => {
    let scratch: string;

    beforeEach(() => {
        scratch = mkdtempSync(join(realpathSync(tmpdir()), "tr-linked-"));
        resetWorktreeCache();
    });

    afterEach(() => {
        if (existsSync(scratch)) {
            rmSync(scratch, { force: true, recursive: true });
        }
    });

    it("returns true when `.git` is a regular file (gitlink)", () => {
        expect.assertions(1);

        const repo = join(scratch, "fake-linked");

        mkdirSync(repo);
        writeFileSync(join(repo, ".git"), "gitdir: /nonexistent/.git/worktrees/fake\n");

        expect(isLinkedWorktree(repo)).toBe(true);
    });

    it("returns false when `.git` is a directory", () => {
        expect.assertions(1);

        const repo = join(scratch, "fake-primary");

        mkdirSync(join(repo, ".git"), { recursive: true });

        expect(isLinkedWorktree(repo)).toBe(false);
    });

    it("returns false when `.git` is missing", () => {
        expect.assertions(1);

        const dir = join(scratch, "no-git");

        mkdirSync(dir);

        expect(isLinkedWorktree(dir)).toBe(false);
    });
});
