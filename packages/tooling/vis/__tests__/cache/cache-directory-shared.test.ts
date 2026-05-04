import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { resetWorktreeCache } from "@visulima/task-runner";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DEFAULT_CACHE_DIRECTORY_NAME, resolveSharedCacheDirectory } from "../../src/cache/cache-directory";

// When this test file runs inside a git pre-commit hook, git exports
// GIT_DIR / GIT_INDEX_FILE / GIT_WORK_TREE pointing at the hook-running
// repo. Those leak into vitest workers and confuse `git worktree add`
// inside the temp fixture repos. Strip them so child `git` calls operate
// on the fixture's own `.git`.
for (const key of Object.keys(process.env)) {
    if (key.startsWith("GIT_")) {
        delete process.env[key];
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

const initRepo = (cwd: string): void => {
    execFileSync("git", ["init", "--initial-branch=main"], { cwd, stdio: "ignore" });
    execFileSync("git", ["config", "user.email", "test@example.com"], { cwd, stdio: "ignore" });
    execFileSync("git", ["config", "user.name", "Test"], { cwd, stdio: "ignore" });
    writeFileSync(join(cwd, "README.md"), "# test\n");
    execFileSync("git", ["add", "README.md"], { cwd, stdio: "ignore" });
    execFileSync("git", ["commit", "-m", "init"], { cwd, stdio: "ignore" });
};

describe(resolveSharedCacheDirectory, () => {
    let scratch: string;
    const originalEnv = process.env["VIS_CACHE_DIRECTORY"];

    beforeEach(() => {
        scratch = mkdtempSync(join(realpathSync(tmpdir()), "vis-shared-"));
        delete process.env["VIS_CACHE_DIRECTORY"];
        resetWorktreeCache();
    });

    afterEach(() => {
        if (originalEnv === undefined) {
            delete process.env["VIS_CACHE_DIRECTORY"];
        } else {
            process.env["VIS_CACHE_DIRECTORY"] = originalEnv;
        }

        resetWorktreeCache();

        if (existsSync(scratch)) {
            rmSync(scratch, { force: true, recursive: true });
        }
    });

    it("returns the workspace-root cache for a non-git directory", () => {
        expect.assertions(1);

        const ws = realpathSync(scratch);

        expect(resolveSharedCacheDirectory(ws, undefined, undefined, true)).toBe(resolve(ws, DEFAULT_CACHE_DIRECTORY_NAME));
    });

    it("returns the workspace-root cache for a primary checkout", () => {
        expect.assertions(1);

        if (!hasGit) {
            return;
        }

        const ws = join(realpathSync(scratch), "main");

        mkdirSync(ws);
        initRepo(ws);

        expect(resolveSharedCacheDirectory(ws, undefined, undefined, true)).toBe(resolve(ws, DEFAULT_CACHE_DIRECTORY_NAME));
    });

    it("redirects a linked worktree to the main worktree's cache", () => {
        expect.assertions(2);

        if (!hasGit) {
            return;
        }

        const main = join(realpathSync(scratch), "main");

        mkdirSync(main);
        initRepo(main);

        const linked = join(realpathSync(scratch), "feat");

        execFileSync("git", ["worktree", "add", "-b", "feat", linked], { cwd: main, stdio: "ignore" });

        try {
            const fromLinked = resolveSharedCacheDirectory(linked, undefined, undefined, true);

            expect(fromLinked).toBe(resolve(main, DEFAULT_CACHE_DIRECTORY_NAME));

            // Sanity: from the main checkout, the same path is returned.
            expect(resolveSharedCacheDirectory(main, undefined, undefined, true)).toBe(fromLinked);
        } finally {
            execFileSync("git", ["worktree", "remove", "--force", linked], { cwd: main, stdio: "ignore" });
        }
    });

    it("uses the linked checkout's cache when sharedWorktreeCache is false", () => {
        expect.assertions(1);

        if (!hasGit) {
            return;
        }

        const main = join(realpathSync(scratch), "main");

        mkdirSync(main);
        initRepo(main);

        const linked = join(realpathSync(scratch), "feat");

        execFileSync("git", ["worktree", "add", "-b", "feat", linked], { cwd: main, stdio: "ignore" });

        try {
            expect(resolveSharedCacheDirectory(linked, undefined, undefined, false)).toBe(resolve(linked, DEFAULT_CACHE_DIRECTORY_NAME));
        } finally {
            execFileSync("git", ["worktree", "remove", "--force", linked], { cwd: main, stdio: "ignore" });
        }
    });

    it("prefers an explicit CLI override over both worktree-share and the env var", () => {
        expect.assertions(1);

        if (!hasGit) {
            return;
        }

        const main = join(realpathSync(scratch), "main");

        mkdirSync(main);
        initRepo(main);

        const linked = join(realpathSync(scratch), "feat");

        execFileSync("git", ["worktree", "add", "-b", "feat", linked], { cwd: main, stdio: "ignore" });

        try {
            process.env["VIS_CACHE_DIRECTORY"] = "/should-not-appear";

            const cli = resolve(scratch, "explicit-cli");

            expect(resolveSharedCacheDirectory(linked, cli, "/from-config", true)).toBe(cli);
        } finally {
            execFileSync("git", ["worktree", "remove", "--force", linked], { cwd: main, stdio: "ignore" });
        }
    });

    it("config value beats the env var", () => {
        expect.assertions(1);

        const ws = realpathSync(scratch);

        process.env["VIS_CACHE_DIRECTORY"] = "/should-not-appear";

        const config = resolve(scratch, "from-config");

        expect(resolveSharedCacheDirectory(ws, undefined, config, true)).toBe(config);
    });

    it("falls back to VIS_CACHE_DIRECTORY when neither CLI nor config is set", () => {
        expect.assertions(1);

        const ws = realpathSync(scratch);
        const env = resolve(scratch, "from-env");

        process.env["VIS_CACHE_DIRECTORY"] = env;

        expect(resolveSharedCacheDirectory(ws, undefined, undefined, true)).toBe(env);
    });

    it("skips worktree-share remapping when VIS_CACHE_DIRECTORY is set (explicit wins)", () => {
        expect.assertions(1);

        if (!hasGit) {
            return;
        }

        const main = join(realpathSync(scratch), "main");

        mkdirSync(main);
        initRepo(main);

        const linked = join(realpathSync(scratch), "feat");

        execFileSync("git", ["worktree", "add", "-b", "feat", linked], { cwd: main, stdio: "ignore" });

        try {
            const env = resolve(scratch, "from-env");

            process.env["VIS_CACHE_DIRECTORY"] = env;

            // Even though `linked` is a worktree, the explicit env path wins
            // — no remap to the main worktree's cache.
            expect(resolveSharedCacheDirectory(linked, undefined, undefined, true)).toBe(env);
        } finally {
            execFileSync("git", ["worktree", "remove", "--force", linked], { cwd: main, stdio: "ignore" });
        }
    });
});
