import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { Cache } from "@visulima/task-runner";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resolveSharedCacheDirectory } from "../src/cache/cache-directory";
import { resetWorktreeCache } from "../src/git/git-worktree";

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

describe("cache sharing across git worktrees", () => {
    let scratch: string;

    beforeEach(() => {
        scratch = mkdtempSync(join(realpathSync(tmpdir()), "vis-cache-share-"));
        resetWorktreeCache();
    });

    afterEach(() => {
        resetWorktreeCache();

        if (existsSync(scratch)) {
            rmSync(scratch, { force: true, recursive: true });
        }
    });

    it("entries written from a linked worktree are readable from the main checkout", async () => {
        expect.assertions(3);

        if (!hasGit) {
            return;
        }

        const main = join(realpathSync(scratch), "main");

        mkdirSync(main);
        initRepo(main);

        const linked = join(realpathSync(scratch), "feat");

        execFileSync("git", ["worktree", "add", "-b", "feat", linked], { cwd: main, stdio: "ignore" });

        try {
            const linkedCacheDir = resolveSharedCacheDirectory(linked, undefined, undefined, true);
            const mainCacheDir = resolveSharedCacheDirectory(main, undefined, undefined, true);

            expect(linkedCacheDir).toBe(mainCacheDir);

            const writer = new Cache({ cacheDirectory: linkedCacheDir, workspaceRoot: linked });

            await writer.put("hash-shared-1", "shared output", [], 0);

            const reader = new Cache({ cacheDirectory: mainCacheDir, workspaceRoot: main });
            const result = await reader.get("hash-shared-1");

            expect(result).toBeDefined();
            expect(result?.terminalOutput).toBe("shared output");
        } finally {
            execFileSync("git", ["worktree", "remove", "--force", linked], { cwd: main, stdio: "ignore" });
        }
    });

    it("opting out via sharedWorktreeCache=false isolates each worktree's cache", async () => {
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
            const linkedCacheDir = resolveSharedCacheDirectory(linked, undefined, undefined, false);
            const mainCacheDir = resolveSharedCacheDirectory(main, undefined, undefined, false);

            expect(linkedCacheDir).not.toBe(mainCacheDir);

            const writer = new Cache({ cacheDirectory: linkedCacheDir, workspaceRoot: linked });

            await writer.put("hash-isolated", "linked-only", [], 0);

            const reader = new Cache({ cacheDirectory: mainCacheDir, workspaceRoot: main });
            const result = await reader.get("hash-isolated");

            expect(result).toBeUndefined();
        } finally {
            execFileSync("git", ["worktree", "remove", "--force", linked], { cwd: main, stdio: "ignore" });
        }
    });

    it("survives 6 sibling worktrees writing to the shared cache concurrently", async () => {
        // 1 collision + 6 hash-N existence checks
        expect.assertions(7);

        if (!hasGit) {
            return;
        }

        const main = join(realpathSync(scratch), "main");

        mkdirSync(main);
        initRepo(main);

        const worktrees: string[] = [];

        try {
            const writers: Promise<void>[] = [];

            for (let i = 0; i < 6; i += 1) {
                const linked = join(realpathSync(scratch), `feat-${String(i)}`);

                execFileSync("git", ["worktree", "add", "-b", `feat-${String(i)}`, linked], { cwd: main, stdio: "ignore" });
                worktrees.push(linked);

                const cacheDir = resolveSharedCacheDirectory(linked, undefined, undefined, true);
                const cache = new Cache({ cacheDirectory: cacheDir, workspaceRoot: linked });

                // Each worktree races to write its own hash + a shared hash
                // ("collision-hash") that all 6 try to put at the same time.
                writers.push(cache.put(`hash-${String(i)}`, `out-${String(i)}`, [], 0));
                writers.push(cache.put("collision-hash", `winner-${String(i)}`, [], 0));
            }

            await Promise.all(writers);

            const sharedRoot = resolveSharedCacheDirectory(main, undefined, undefined, true);

            // All 6 distinct hashes plus the colliding hash should be present
            // in the single shared cache directory. Partial-write directories
            // (`.tmp-*`) are tolerated by the atomic-rename strategy and may
            // be cleaned up later by `cache prune`.
            const entries = readdirSync(sharedRoot).filter((name) => !name.startsWith(".tmp-"));

            expect(entries).toContain("collision-hash");

            for (let i = 0; i < 6; i += 1) {
                expect(entries).toContain(`hash-${String(i)}`);
            }
        } finally {
            for (const linked of worktrees) {
                try {
                    execFileSync("git", ["worktree", "remove", "--force", linked], { cwd: main, stdio: "ignore" });
                } catch {
                    // Best-effort cleanup
                }
            }
        }
    }, 30_000);

    it("primary checkout resolves to its own cache regardless of share toggle", () => {
        expect.assertions(2);

        if (!hasGit) {
            return;
        }

        const ws = join(realpathSync(scratch), "main");

        mkdirSync(ws);
        initRepo(ws);

        const expected = resolve(ws, ".task-runner-cache");

        expect(resolveSharedCacheDirectory(ws, undefined, undefined, true)).toBe(expected);
        expect(resolveSharedCacheDirectory(ws, undefined, undefined, false)).toBe(expected);
    });
});
