import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createHideAllStash, dropBackupStash, popHideAllStash } from "../../src/staged/git/stash";

// Git exports these into a hook's environment, so they leak in when this suite
// runs from the repo's own pre-commit hook and point every temp-repo command at
// the outer checkout. Strip them per-test.
const GIT_ENV_VARS = [
    "GIT_DIR",
    "GIT_WORK_TREE",
    "GIT_INDEX_FILE",
    "GIT_OBJECT_DIRECTORY",
    "GIT_ALTERNATE_OBJECT_DIRECTORIES",
    "GIT_COMMON_DIR",
    "GIT_NAMESPACE",
    "GIT_PREFIX",
] as const;

const git = (arguments_: string[], cwd: string): string => execFileSync("git", arguments_, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

const stashEntries = (cwd: string): string[] => git(["stash", "list"], cwd).split("\n").filter(Boolean);

describe("staged stash", () => {
    let savedGitEnvironment: Record<string, string | undefined>;
    let root: string;
    let worktreeParent: string;

    /** Adds a linked worktree. It shares `refs/stash` through the common git directory. */
    const addWorktree = (name: string): string => {
        const path = join(worktreeParent, name);

        mkdirSync(worktreeParent, { recursive: true });
        git(["worktree", "add", "-q", path, "-b", name], root);

        return path;
    };

    beforeEach(() => {
        savedGitEnvironment = Object.fromEntries(GIT_ENV_VARS.map((name) => [name, process.env[name]]));

        for (const name of GIT_ENV_VARS) {
            Reflect.deleteProperty(process.env, name);
        }

        root = mkdtempSync(join(tmpdir(), "vis-stash-"));
        worktreeParent = mkdtempSync(join(tmpdir(), "vis-stash-wt-"));

        git(["init", "-q"], root);
        git(["config", "user.email", "vis@example.com"], root);
        git(["config", "user.name", "vis"], root);
        git(["config", "commit.gpgsign", "false"], root);
        writeFileSync(join(root, "tracked.txt"), "base\n");
        git(["add", "-A"], root);
        git(["commit", "-q", "-m", "init"], root);
    });

    afterEach(() => {
        for (const [name, value] of Object.entries(savedGitEnvironment)) {
            if (value === undefined) {
                Reflect.deleteProperty(process.env, name);
            } else {
                process.env[name] = value;
            }
        }

        rmSync(root, { force: true, recursive: true });
        rmSync(worktreeParent, { force: true, recursive: true });
    });

    describe(createHideAllStash, () => {
        it("should return null instead of a foreign stash when there is nothing to stash", async () => {
            expect.assertions(3);

            // `git stash push --quiet` on a clean tree exits 0 and prints
            // nothing, so the "No local changes" guard never fires. Reading
            // `stash@{0}` then hands back whatever entry is on top — here one
            // pushed from a linked worktree, which shares the stash stack.
            // Popping that later restores someone else's work into this
            // checkout and drops their entry.
            const worktree = addWorktree("other");

            writeFileSync(join(worktree, "tracked.txt"), "their work\n");
            git(["stash", "push", "-q", "-m", "their-stash"], worktree);

            const theirSha = git(["rev-parse", "stash@{0}"], root);

            await expect(createHideAllStash(root)).resolves.toBeNull();

            expect(stashEntries(root)).toHaveLength(1);
            expect(git(["rev-parse", "stash@{0}"], root)).toBe(theirSha);
        });

        it("should resolve its own entry when another checkout pushes on top", async () => {
            expect.assertions(4);

            writeFileSync(join(root, "tracked.txt"), "our work\n");

            const ourSha = await createHideAllStash(root);

            expect(ourSha).not.toBeNull();

            const worktree = addWorktree("other");

            writeFileSync(join(worktree, "tracked.txt"), "their work\n");
            git(["stash", "push", "-q", "-m", "their-stash"], worktree);

            // Ours is no longer `stash@{0}`.
            expect(git(["rev-parse", "stash@{0}"], root)).not.toBe(ourSha);

            await popHideAllStash(root, ourSha);

            expect(readFileSync(join(root, "tracked.txt"), "utf8")).toBe("our work\n");
            expect(git(["stash", "list"], root)).toContain("their-stash");
        });
    });

    describe(dropBackupStash, () => {
        it("should drop only its own entry when the stack shifted underneath it", async () => {
            expect.assertions(3);

            writeFileSync(join(root, "tracked.txt"), "our work\n");

            const ourSha = await createHideAllStash(root);
            const worktree = addWorktree("other");

            writeFileSync(join(worktree, "tracked.txt"), "their work\n");
            git(["stash", "push", "-q", "-m", "their-stash"], worktree);

            const theirSha = git(["rev-parse", "stash@{0}"], root);

            await dropBackupStash(root, ourSha);

            expect(stashEntries(root)).toHaveLength(1);
            expect(git(["rev-parse", "stash@{0}"], root)).toBe(theirSha);
            expect(git(["stash", "list"], root)).toContain("their-stash");
        });
    });
});
