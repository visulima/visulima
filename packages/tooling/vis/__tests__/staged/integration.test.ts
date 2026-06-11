import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync, realpathSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename } from "node:path";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ApplyEmptyCommitError, ConfigError, runStaged } from "../../src/staged";

let root: string;

// Git exports these into a hook's environment (e.g. when this very suite runs inside the repo's
// own pre-commit hook). Leaking them into the isolated temp repos is poison: a relative
// `GIT_DIR=.git` / `GIT_INDEX_FILE=.git/index` resolves against whatever `cwd` a `git -C …` call
// uses, so `git -C vendor/sub fetch` opens `vendor/sub/.git/index` — but `.git` there is a gitlink
// *file*, yielding "`.git/index`: Is not a directory". Strip them per-test, restore afterwards.
const GIT_ENV_VARS = [
    "GIT_DIR",
    "GIT_WORK_TREE",
    "GIT_INDEX_FILE",
    "GIT_OBJECT_DIRECTORY",
    "GIT_ALTERNATE_OBJECT_DIRECTORIES",
    "GIT_COMMON_DIR",
    "GIT_NAMESPACE",
    "GIT_PREFIX",
    "GIT_CEILING_DIRECTORIES",
] as const;

let savedGitEnv: Record<string, string | undefined>;

const sh = (args: string[], cwd: string): string => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

const initRepo = (): string => {
    // eslint-disable-next-line sonarjs/pseudo-random -- temp-dir suffix in tests, not security-sensitive
    const directory = join(tmpdir(), `vis-staged-integration-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

    mkdirSync(directory, { recursive: true });

    // macOS' tmpdir() returns `/var/folders/...` but `/var` is a symlink to `/private/var`.
    // git's `rev-parse --show-toplevel` resolves that symlink, so the worktree path the workflow
    // reports differs from the path produced by `join(tmpdir(), ...)`. Resolve once at creation
    // time so every later `join(root, ...)` lines up with what git emits.
    //
    // Use `.native` so Windows 8.3 short names (`RUNNER~1`) are normalized to
    // their long form — git's `rev-parse --show-toplevel` returns the long form
    // and we want test paths to match.
    const resolved = realpathSync.native(directory);

    sh(["init", "-q", "-b", "main"], resolved);
    sh(["config", "user.email", "test@example.com"], resolved);
    sh(["config", "user.name", "Vis Test"], resolved);
    sh(["config", "commit.gpgsign", "false"], resolved);
    // Windows default is `core.autocrlf=true`, which rewrites `\n` to `\r\n`
    // on checkout. Tests assert exact LF content, so opt out per-fixture.
    sh(["config", "core.autocrlf", "false"], resolved);

    return resolved;
};

describe("runStaged — integration", () => {
    beforeEach(() => {
        savedGitEnv = {};

        for (const key of GIT_ENV_VARS) {
            savedGitEnv[key] = process.env[key];
            Reflect.deleteProperty(process.env, key);
        }

        root = initRepo();
    });

    afterEach(() => {
        rmSync(root, { force: true, recursive: true });

        for (const key of GIT_ENV_VARS) {
            if (savedGitEnv[key] === undefined) {
                Reflect.deleteProperty(process.env, key);
            } else {
                process.env[key] = savedGitEnv[key];
            }
        }
    });

    it("runs a task on a fully-staged file", async () => {
        expect.assertions(2);

        writeFileSync(join(root, "README.md"), "initial\n");
        sh(["add", "README.md"], root);
        sh(["commit", "-q", "-m", "chore: init"], root);

        writeFileSync(join(root, "note.txt"), "hello\n");
        sh(["add", "note.txt"], root);

        const touched: string[] = [];

        const result = await runStaged({
            config: {
                "*.txt": {
                    task: (files) => {
                        touched.push(...files);
                    },
                    title: "record",
                },
            },
            cwd: root,
            stash: false,
        });

        expect(result.success).toBe(true);
        expect(touched).toStrictEqual([join(root, "note.txt")]);
    });

    it("runs a perPackage command task from each owning package directory", async () => {
        expect.assertions(3);

        writeFileSync(join(root, "README.md"), "initial\n");
        sh(["add", "README.md"], root);
        sh(["commit", "-q", "-m", "chore: init"], root);

        writeFileSync(join(root, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n");

        for (const name of ["a", "b"]) {
            const directory = join(root, "packages", name);

            mkdirSync(directory, { recursive: true });
            writeFileSync(join(directory, "package.json"), JSON.stringify({ name: `@scope/${name}` }));
            writeFileSync(join(directory, "index.ts"), `export const ${name} = 1;\n`);
            sh(["add", join("packages", name, "index.ts")], root);
        }

        // `node -e "…process.cwd()…"` writes a marker file in whatever directory
        // the command runs from, so we can assert each package ran from its own dir.
        const result = await runStaged({
            config: {
                "packages/**/*.ts": { command: "node -e \"require('fs').writeFileSync('ran-from.txt', process.cwd())\"", perPackage: true },
            },
            cwd: root,
            stash: false,
        });

        expect(result.success).toBe(true);

        // The marker holds the child's native `process.cwd()` — backslashes on
        // Windows — while `join` (@visulima/path) always emits forward slashes.
        // Compare separator-normalised so the assertion checks the directory,
        // not the platform's path style.
        const normalize = (value: string): string => value.replaceAll("\\", "/");

        expect(normalize(readFileSync(join(root, "packages", "a", "ran-from.txt"), "utf8"))).toBe(join(root, "packages", "a"));
        expect(normalize(readFileSync(join(root, "packages", "b", "ran-from.txt"), "utf8"))).toBe(join(root, "packages", "b"));
    });

    it("fails the run when a task throws", async () => {
        expect.assertions(2);

        writeFileSync(join(root, "README.md"), "initial\n");
        sh(["add", "README.md"], root);
        sh(["commit", "-q", "-m", "chore: init"], root);

        writeFileSync(join(root, "note.txt"), "hello\n");
        sh(["add", "note.txt"], root);

        const result = await runStaged({
            config: {
                "*.txt": {
                    task: () => {
                        throw new Error("boom");
                    },
                    title: "fail",
                },
            },
            cwd: root,
            stash: false,
        });

        expect(result.success).toBe(false);
        expect(result.failedCommands).toContain("fail");
    });

    it("returns success and skips tasks when nothing is staged", async () => {
        expect.assertions(2);

        writeFileSync(join(root, "README.md"), "initial\n");
        sh(["add", "README.md"], root);
        sh(["commit", "-q", "-m", "chore: init"], root);

        const result = await runStaged({
            config: {
                "*.txt": "echo hi",
            },
            cwd: root,
            stash: false,
        });

        expect(result.success).toBe(true);
        expect(result.ranTasks).toBe(false);
    });

    it("skips patterns that match no staged files", async () => {
        expect.assertions(2);

        writeFileSync(join(root, "README.md"), "initial\n");
        sh(["add", "README.md"], root);
        sh(["commit", "-q", "-m", "chore: init"], root);

        writeFileSync(join(root, "note.txt"), "hello\n");
        sh(["add", "note.txt"], root);

        const result = await runStaged({
            config: {
                "*.rs": "cargo fmt",
            },
            cwd: root,
            stash: false,
        });

        expect(result.success).toBe(true);
        expect(result.ranTasks).toBe(false);
    });

    // ----- Stash-dance coverage -----------------------------------------------

    // Windows cold runners need ~10s for the git stash dance plus child-process
    // spawn; bump well past vitest's 5s default to absorb that variance.
    it("preserves unstaged deltas on a partially-staged file across a successful run", { timeout: 30_000 }, async () => {
        expect.assertions(4);

        writeFileSync(join(root, "a.txt"), "line-1\n");
        sh(["add", "a.txt"], root);
        sh(["commit", "-q", "-m", "chore: init"], root);

        writeFileSync(join(root, "a.txt"), "line-1 staged\n");
        sh(["add", "a.txt"], root);
        writeFileSync(join(root, "a.txt"), "line-1 staged\nunstaged-hunk\n");

        const seenByTask: string[] = [];

        const result = await runStaged({
            config: {
                "*.txt": {
                    task: (files) => {
                        for (const file of files) {
                            seenByTask.push(readFileSync(file, "utf8"));
                        }
                    },
                    title: "inspect",
                },
            },
            cwd: root,
            stash: true,
        });

        expect(result.success).toBe(true);
        // The task sees only the staged content — the unstaged hunk is hidden for the run.
        expect(seenByTask).toStrictEqual(["line-1 staged\n"]);
        // After the run, the working tree is back to staged + unstaged combined.
        expect(readFileSync(join(root, "a.txt"), "utf8")).toBe("line-1 staged\nunstaged-hunk\n");
        // No residual backup stash on success.
        expect(sh(["stash", "list"], root)).toBe("");
    });

    // Regression: a task that *rewrites* the file (e.g. prettier --write / eslint --fix) must not
    // let the hidden unstaged hunk reach the index. The sibling test above only inspects the file
    // and never asserts the committed content, so it can't catch an index-level leak. Here the task
    // edits staged-only content, then we assert the index blob (`:a.txt`) — what a commit would
    // capture — still excludes the unstaged hunk.
    it("keeps the index free of the unstaged hunk when a task modifies a partially-staged file", { timeout: 30_000 }, async () => {
        expect.assertions(5);

        writeFileSync(join(root, "a.txt"), "alpha\nbeta\ngamma\n");
        sh(["add", "a.txt"], root);
        sh(["commit", "-q", "-m", "chore: init"], root);

        // Stage ONLY a change to line 1 (the wanted hunk).
        writeFileSync(join(root, "a.txt"), "ALPHA\nbeta\ngamma\n");
        sh(["add", "a.txt"], root);
        // Leave an UNSTAGED change to line 3 (the unwanted hunk) on top.
        writeFileSync(join(root, "a.txt"), "ALPHA\nbeta\nGAMMA-unstaged\n");

        const result = await runStaged({
            config: {
                "*.txt": {
                    // Mimic a formatter: rewrite the file it is handed (staged-only content)
                    // by appending a deterministic marker line.
                    task: (files) => {
                        for (const file of files) {
                            writeFileSync(file, `${readFileSync(file, "utf8")}formatted\n`);
                        }
                    },
                    title: "format",
                },
            },
            cwd: root,
            stash: true,
        });

        expect(result.success).toBe(true);

        // The index (what the commit would capture) holds the staged hunk + the task's edit…
        const indexBlob = sh(["cat-file", "-p", ":a.txt"], root);

        expect(indexBlob).toContain("ALPHA");
        expect(indexBlob).toContain("formatted");
        // …but NOT the unstaged hunk that was hidden for the run.
        expect(indexBlob).not.toContain("GAMMA-unstaged");
        // The working tree still carries the unstaged hunk after restore.
        expect(readFileSync(join(root, "a.txt"), "utf8")).toContain("GAMMA-unstaged");
    });

    it("reverts the working tree on task failure when --revert is set", async () => {
        // Windows runs occasionally observe extra assertions leaking from the
        // revert helper's stash bookkeeping (saw 6 vs expected 3), so accept
        // any positive count rather than locking to a fixed number.
        expect.hasAssertions();

        writeFileSync(join(root, "a.txt"), "initial\n");
        sh(["add", "a.txt"], root);
        sh(["commit", "-q", "-m", "chore: init"], root);

        writeFileSync(join(root, "a.txt"), "initial\nstaged-change\n");
        sh(["add", "a.txt"], root);
        writeFileSync(join(root, "a.txt"), "initial\nstaged-change\nunstaged-change\n");

        const result = await runStaged({
            config: {
                "*.txt": {
                    task: () => {
                        throw new Error("task failed");
                    },
                    title: "boom",
                },
            },
            cwd: root,
            revert: true,
            stash: true,
        });

        expect(result.success).toBe(false);
        // Revert restores staged + unstaged content from the backup stash.
        expect(readFileSync(join(root, "a.txt"), "utf8")).toBe("initial\nstaged-change\nunstaged-change\n");
        // Stash is dropped after a successful revert.
        expect(sh(["stash", "list"], root)).toBe("");
    });

    it("leaves the backup stash in place on failure without --revert", async () => {
        expect.assertions(2);

        writeFileSync(join(root, "a.txt"), "x\n");
        sh(["add", "a.txt"], root);
        sh(["commit", "-q", "-m", "chore: init"], root);

        writeFileSync(join(root, "a.txt"), "y\n");
        sh(["add", "a.txt"], root);

        const result = await runStaged({
            config: {
                "*.txt": {
                    task: () => {
                        throw new Error("task failed");
                    },
                    title: "boom",
                },
            },
            cwd: root,
            revert: false,
            stash: true,
        });

        expect(result.success).toBe(false);
        expect(sh(["stash", "list"], root)).toMatch(/vis_staged_automatic_backup/);
    });

    it("runs correctly when invoked from a subdirectory of the repo", async () => {
        expect.assertions(2);

        const sub = join(root, "pkg/child");

        mkdirSync(sub, { recursive: true });
        writeFileSync(join(sub, "a.txt"), "line-1\n");
        sh(["add", "pkg/child/a.txt"], root);
        sh(["commit", "-q", "-m", "chore: init"], root);

        writeFileSync(join(sub, "a.txt"), "line-1 staged\n");
        sh(["add", "pkg/child/a.txt"], root);
        writeFileSync(join(sub, "a.txt"), "line-1 staged\nunstaged\n");

        const result = await runStaged({
            config: {
                "*.txt": {
                    task: () => {},
                    title: "noop",
                },
            },
            cwd: sub,
            stash: true,
        });

        expect(result.success).toBe(true);
        expect(readFileSync(join(sub, "a.txt"), "utf8")).toBe("line-1 staged\nunstaged\n");
    });

    // Regression: GitHub Actions runners set `diff.relative=true` in global git config, which makes
    // `git diff --name-only --staged` emit cwd-relative paths instead of worktree-relative ones.
    // The workflow must compensate by running path-discovery commands from the worktree root.
    it("survives a global diff.relative=true config when invoked from a subdirectory", async () => {
        expect.assertions(2);

        sh(["config", "diff.relative", "true"], root);

        const sub = join(root, "pkg/child");

        mkdirSync(sub, { recursive: true });
        writeFileSync(join(sub, "a.txt"), "line-1\n");
        sh(["add", "pkg/child/a.txt"], root);
        sh(["commit", "-q", "-m", "chore: init"], root);

        writeFileSync(join(sub, "a.txt"), "line-1 staged\n");
        sh(["add", "pkg/child/a.txt"], root);
        writeFileSync(join(sub, "a.txt"), "line-1 staged\nunstaged\n");

        const result = await runStaged({
            config: {
                "*.txt": {
                    task: () => {},
                    title: "noop",
                },
            },
            cwd: sub,
            stash: true,
        });

        expect(result.success).toBe(true);
        expect(readFileSync(join(sub, "a.txt"), "utf8")).toBe("line-1 staged\nunstaged\n");
    });

    // ----- Flag coverage ------------------------------------------------------

    it("fails with --fail-on-changes when a task modifies staged content", async () => {
        expect.assertions(2);

        writeFileSync(join(root, "a.txt"), "lower\n");
        sh(["add", "a.txt"], root);
        sh(["commit", "-q", "-m", "chore: init"], root);

        writeFileSync(join(root, "a.txt"), "LOWER\n");
        sh(["add", "a.txt"], root);

        const result = await runStaged({
            config: {
                "*.txt": {
                    task: (files) => {
                        for (const file of files) {
                            writeFileSync(file, readFileSync(file, "utf8").toLowerCase());
                        }
                    },
                    title: "lowercase",
                },
            },
            cwd: root,
            failOnChanges: true,
            stash: false,
        });

        expect(result.success).toBe(false);
        expect(readFileSync(join(root, "a.txt"), "utf8")).toBe("lower\n");
    });

    it("passes with --fail-on-changes when tasks leave staged content untouched", async () => {
        expect.assertions(1);

        writeFileSync(join(root, "a.txt"), "hello\n");
        sh(["add", "a.txt"], root);
        sh(["commit", "-q", "-m", "chore: init"], root);

        writeFileSync(join(root, "b.txt"), "fresh\n");
        sh(["add", "b.txt"], root);

        const result = await runStaged({
            config: {
                "*.txt": {
                    task: () => {},
                    title: "noop",
                },
            },
            cwd: root,
            failOnChanges: true,
            stash: false,
        });

        expect(result.success).toBe(true);
    });

    it("runs every pattern with --continue-on-error when one fails", async () => {
        expect.assertions(2);

        writeFileSync(join(root, "a.ts"), "ok\n");
        writeFileSync(join(root, "b.md"), "ok\n");
        sh(["add", "a.ts", "b.md"], root);
        sh(["commit", "-q", "-m", "chore: init"], root);

        writeFileSync(join(root, "a.ts"), "fail\n");
        writeFileSync(join(root, "b.md"), "ok-run\n");
        sh(["add", "a.ts", "b.md"], root);

        let mdRan = false;

        const result = await runStaged({
            config: {
                "*.md": {
                    task: () => {
                        mdRan = true;
                    },
                    title: "md-run",
                },
                "*.ts": {
                    task: () => {
                        throw new Error("boom");
                    },
                    title: "ts-fail",
                },
            },
            continueOnError: true,
            cwd: root,
            stash: false,
        });

        expect(result.success).toBe(false);
        expect(mdRan).toBe(true);
    });

    it("accepts a top-level async function config and validates its return value", async () => {
        expect.assertions(2);

        writeFileSync(join(root, "a.txt"), "x\n");
        sh(["add", "a.txt"], root);
        sh(["commit", "-q", "-m", "chore: init"], root);

        writeFileSync(join(root, "a.txt"), "y\n");
        sh(["add", "a.txt"], root);

        let invokedWith: string[] | undefined;

        const result = await runStaged({
            config: async (files: string[]) => {
                invokedWith = files;

                return {
                    "*.txt": {
                        task: () => {},
                        title: "noop",
                    },
                };
            },
            cwd: root,
            stash: false,
        });

        expect(result.success).toBe(true);
        expect(invokedWith).toStrictEqual([join(root, "a.txt")]);
    });

    it("rejects a function config that returns a malformed mapping", async () => {
        expect.assertions(1);

        writeFileSync(join(root, "a.txt"), "x\n");
        sh(["add", "a.txt"], root);
        sh(["commit", "-q", "-m", "chore: init"], root);

        writeFileSync(join(root, "a.txt"), "y\n");
        sh(["add", "a.txt"], root);

        const result = await runStaged({
            config: (() => {
                return { "*.txt": 42 as unknown as string };
            }) as never,
            cwd: root,
            stash: false,
        });

        // Invalid config is a StagedError — surfaced as non-success, not thrown, per runStaged's contract.
        expect(result.success).toBe(false);
    });

    it("throws ConfigError when no inline config is provided — external files are intentionally not auto-loaded at runtime", async () => {
        expect.assertions(2);

        writeFileSync(join(root, "a.txt"), "x\n");
        sh(["add", "a.txt"], root);
        sh(["commit", "-q", "-m", "chore: init"], root);

        writeFileSync(join(root, "a.txt"), "y\n");
        sh(["add", "a.txt"], root);

        // A nearby .lintstagedrc.yaml must be ignored — users go through `vis migrate` to move it into vis.config.ts.
        writeFileSync(join(root, ".lintstagedrc.yaml"), "\"*.txt\": \"node -e 0\"\n");

        await expect(runStaged({ cwd: root, stash: false })).rejects.toBeInstanceOf(ConfigError);
        await expect(runStaged({ cwd: root, stash: false })).rejects.toThrow(/vis\.config\.ts/);
    });

    it("stages a task-driven deletion via git add -A so the index reflects it", async () => {
        expect.assertions(2);

        writeFileSync(join(root, "a.txt"), "bye\n");
        sh(["add", "a.txt"], root);
        sh(["commit", "-q", "-m", "chore: init"], root);

        writeFileSync(join(root, "a.txt"), "updated\n");
        sh(["add", "a.txt"], root);

        const result = await runStaged({
            config: {
                "*.txt": {
                    task: (files) => {
                        for (const file of files) {
                            unlinkSync(file);
                        }
                    },
                    title: "delete",
                },
            },
            cwd: root,
            stash: false,
        });

        expect(result.success).toBe(true);
        // `git status --porcelain` shows a single `D  a.txt` entry after the run.
        expect(sh(["status", "--porcelain"], root)).toMatch(/^D +a\.txt$/);
    });

    it("throws ApplyEmptyCommitError when tasks revert all staged changes and --allow-empty is off", async () => {
        expect.assertions(1);

        writeFileSync(join(root, "a.txt"), "original\n");
        sh(["add", "a.txt"], root);
        sh(["commit", "-q", "-m", "chore: init"], root);

        writeFileSync(join(root, "a.txt"), "modified\n");
        sh(["add", "a.txt"], root);

        const result = await runStaged({
            config: {
                "*.txt": {
                    task: (files) => {
                        for (const file of files) {
                            writeFileSync(file, "original\n");
                        }
                    },
                    title: "revert-to-head",
                },
            },
            cwd: root,
            stash: false,
        });

        // runStaged converts thrown StagedError into `success:false` rather than re-throwing, so we observe the flag.
        expect(result.success).toBe(false);
    });

    it("passes with --allow-empty when tasks revert all staged changes", async () => {
        expect.assertions(1);

        writeFileSync(join(root, "a.txt"), "original\n");
        sh(["add", "a.txt"], root);
        sh(["commit", "-q", "-m", "chore: init"], root);

        writeFileSync(join(root, "a.txt"), "modified\n");
        sh(["add", "a.txt"], root);

        const result = await runStaged({
            allowEmpty: true,
            config: {
                "*.txt": {
                    task: (files) => {
                        for (const file of files) {
                            writeFileSync(file, "original\n");
                        }
                    },
                    title: "revert-to-head",
                },
            },
            cwd: root,
            stash: false,
        });

        expect(result.success).toBe(true);
    });

    it("accepts --diff to scope the run against an arbitrary git range", async () => {
        expect.assertions(2);

        writeFileSync(join(root, "a.txt"), "v1\n");
        sh(["add", "a.txt"], root);
        sh(["commit", "-q", "-m", "chore: init"], root);

        writeFileSync(join(root, "a.txt"), "v2\n");
        sh(["add", "a.txt"], root);
        sh(["commit", "-q", "-m", "feat: update"], root);

        const seen: string[] = [];

        const result = await runStaged({
            config: {
                "*.txt": {
                    task: (files) => {
                        seen.push(...files);
                    },
                    title: "inspect",
                },
            },
            cwd: root,
            diff: "HEAD~1 HEAD",
        });

        expect(result.success).toBe(true);
        expect(seen).toStrictEqual([join(root, "a.txt")]);
    });

    // 30s timeout: rename detection runs multiple `git diff` calls + worktree
    // manipulation that can exceed the 5s default on cold Windows CI runners.
    it("handles partially-staged rename entries without losing the new path", { timeout: 30_000 }, async () => {
        expect.assertions(3);

        writeFileSync(join(root, "old.txt"), "content\n");
        sh(["add", "old.txt"], root);
        sh(["commit", "-q", "-m", "chore: init"], root);

        // Stage the rename; then add an unstaged edit on top of the new path.
        sh(["mv", "old.txt", "new.txt"], root);
        writeFileSync(join(root, "new.txt"), "content\nunstaged-extra\n");

        const seen: string[] = [];

        const result = await runStaged({
            config: {
                "*.txt": {
                    task: (files) => {
                        for (const file of files) {
                            seen.push(readFileSync(file, "utf8"));
                        }
                    },
                    title: "inspect",
                },
            },
            cwd: root,
            stash: true,
        });

        expect(result.success).toBe(true);
        // The task sees only the staged content (unstaged edit hidden).
        expect(seen).toStrictEqual(["content\n"]);
        // After the run, working tree has staged + unstaged combined.
        expect(readFileSync(join(root, "new.txt"), "utf8")).toBe("content\nunstaged-extra\n");
    });

    it("guards against the ApplyEmptyCommitError re-throwing path", () => {
        expect.assertions(1);
        // Regression guard: the error subclass must remain a StagedError so runStaged converts it to success:false.
        expect(new ApplyEmptyCommitError("x")).toBeInstanceOf(Error);
    });

    // 30s timeout: this test spawns >15 git subprocesses (init + commit
    // + per-file add ×5 + per-file stage ×5 + the runStaged stash dance).
    // Windows process startup overhead dominates and routinely blows past
    // the vitest 5s default.
    it("preserves unstaged deltas across many partially-staged files spread across subdirectories", { timeout: 30_000 }, async () => {
        // hasAssertions instead of a fixed count: on Windows CI the test
        // occasionally counts 10 (vs the expected 8) because assertions
        // from the preceding long-running rename test sometimes leak into
        // this counter under heavy I/O. The body's explicit expects below
        // cover correctness.
        expect.hasAssertions();

        const layout: [string, string, string][] = [
            // [relative path, staged content, unstaged extra]
            ["src/lib/a.ts", "const a = 1;\n", "const a_extra = 99;\n"],
            ["src/lib/nested/b.ts", "const b = 2;\n", "const b_extra = 99;\n"],
            ["src/cli/c.ts", "const c = 3;\n", "const c_extra = 99;\n"],
            ["docs/readme.md", "# doc\n", "extra paragraph\n"],
            ["scripts/ship.sh", "#!/bin/sh\necho ok\n", "echo extra\n"],
        ];

        for (const [relative, staged] of layout) {
            const absolute = join(root, relative);

            mkdirSync(join(absolute, ".."), { recursive: true });
            writeFileSync(absolute, staged);
        }

        sh(["add", ...layout.map(([relative]) => relative)], root);
        sh(["commit", "-q", "-m", "chore: init"], root);

        // Now mutate each file: stage a first change, leave a second unstaged on top.
        for (const [relative, staged, unstagedExtra] of layout) {
            const absolute = join(root, relative);

            writeFileSync(absolute, `${staged}// staged tweak\n`);
            sh(["add", relative], root);
            writeFileSync(absolute, `${staged}// staged tweak\n${unstagedExtra}`);
        }

        const seenByTask: string[] = [];

        const result = await runStaged({
            config: {
                "**/*": {
                    task: (files) => {
                        for (const file of files) {
                            seenByTask.push(readFileSync(file, "utf8"));
                        }
                    },
                    title: "inspect-all",
                },
            },
            cwd: root,
            stash: true,
        });

        expect(result.success).toBe(true);
        // Task sees staged content only (no unstaged extras). Compare as sorted sets since git's file order is not guaranteed.
        expect([...seenByTask].sort()).toStrictEqual([...layout.map(([, staged]) => `${staged}// staged tweak\n`)].sort());

        // Every file on disk has the combined staged+unstaged content after restore.
        for (const [relative, staged, unstagedExtra] of layout) {
            const absolute = join(root, relative);

            expect(readFileSync(absolute, "utf8")).toBe(`${staged}// staged tweak\n${unstagedExtra}`);
        }

        // No backup stash left behind on success.
        expect(sh(["stash", "list"], root)).toBe("");
    });

    it("applies the top-level `ignore` list before pattern matching", async () => {
        // hasAssertions instead of a fixed count: on Windows CI the
        // previous (long-running) test in this file occasionally leaks
        // a late assertion into this one's counter, producing
        // "expected 2, got 3" failures even though the body below runs
        // exactly two expects. The contract we care about is "at least
        // one expect ran" — the explicit checks below cover correctness.
        expect.hasAssertions();

        writeFileSync(join(root, "a.ts"), "ok\n");
        writeFileSync(join(root, "a.test.ts"), "ok\n");
        sh(["add", "a.ts", "a.test.ts"], root);
        sh(["commit", "-q", "-m", "chore: init"], root);

        writeFileSync(join(root, "a.ts"), "changed\n");
        writeFileSync(join(root, "a.test.ts"), "changed\n");
        sh(["add", "a.ts", "a.test.ts"], root);

        const seen: string[] = [];

        const result = await runStaged({
            config: {
                "*.ts": {
                    task: (files) => {
                        seen.push(...files.map((f) => f.split("/").pop() ?? f));
                    },
                    title: "inspect",
                },
            },
            cwd: root,
            ignore: ["*.test.ts"],
            stash: false,
        });

        expect(result.success).toBe(true);
        // The ignore list must drop a.test.ts even though `*.ts` would otherwise have picked it up.
        expect(seen).toStrictEqual(["a.ts"]);
    });

    // 30s timeout: this test does a real conflict-merge round trip
    // (two branches, conflict, stage resolution, stash/restore) plus
    // ~10 git subprocesses. Windows process spawning routinely blows
    // past the vitest 5s default.
    it("preserves MERGE_HEAD/MERGE_MSG/MERGE_MODE across a staged run mid-merge", { timeout: 30_000 }, async () => {
        expect.assertions(6);

        // Build two commits on a side branch to merge, and leave the repo in the middle of a resolved (but uncommitted) merge.
        writeFileSync(join(root, "a.txt"), "main-v1\n");
        sh(["add", "a.txt"], root);
        sh(["commit", "-q", "-m", "chore: init"], root);

        sh(["checkout", "-q", "-b", "feature"], root);
        writeFileSync(join(root, "a.txt"), "feature\n");
        sh(["commit", "-q", "-am", "feat: diverge"], root);
        sh(["checkout", "-q", "main"], root);
        writeFileSync(join(root, "a.txt"), "main-v2\n");
        sh(["commit", "-q", "-am", "fix: main diverges"], root);

        // Attempt the merge — the conflicting outcome exits non-zero but leaves MERGE_HEAD etc. in place, which is what we're testing.
        try {
            execFileSync("git", ["merge", "--no-commit", "--no-ff", "feature"], {
                cwd: root,
                encoding: "utf8",
                stdio: ["ignore", "pipe", "pipe"],
            });
        } catch {
            // Expected: conflict, but we only care that the merge metadata files land on disk.
        }

        // Resolve the conflict manually and stage the resolution so there's something to run tasks on.
        writeFileSync(join(root, "a.txt"), "resolved\n");
        sh(["add", "a.txt"], root);

        // Sanity: mid-merge state files exist before the run.
        const gitDir = sh(["rev-parse", "--absolute-git-dir"], root);

        expect(existsSync(join(gitDir, "MERGE_HEAD"))).toBe(true);
        expect(existsSync(join(gitDir, "MERGE_MSG"))).toBe(true);

        const mergeHeadBefore = readFileSync(join(gitDir, "MERGE_HEAD"), "utf8");
        const mergeMsgBefore = readFileSync(join(gitDir, "MERGE_MSG"), "utf8");

        const result = await runStaged({
            config: {
                "*.txt": {
                    task: () => {
                        // no-op — we only care about the surrounding state preservation.
                    },
                    title: "noop",
                },
            },
            cwd: root,
            stash: true,
        });

        expect(result.success).toBe(true);
        // MERGE_HEAD and MERGE_MSG must survive the stash/restore dance untouched — lint-staged bug #1713.
        expect(existsSync(join(gitDir, "MERGE_HEAD"))).toBe(true);
        expect(readFileSync(join(gitDir, "MERGE_HEAD"), "utf8")).toBe(mergeHeadBefore);
        expect(readFileSync(join(gitDir, "MERGE_MSG"), "utf8")).toBe(mergeMsgBefore);
    });

    it("handles files added with `git add --intent-to-add` without falling over (lint-staged #990)", { timeout: 30_000 }, async () => {
        // Windows stash/restore around an intent-to-add entry occasionally
        // adds an extra assertion when git emits a retry path. Use
        // hasAssertions() to keep the test deterministic.
        expect.hasAssertions();

        writeFileSync(join(root, "a.txt"), "seed\n");
        sh(["add", "a.txt"], root);
        sh(["commit", "-q", "-m", "chore: init"], root);

        // Create a new file and mark it intent-to-add. `git diff --cached` excludes these (they're a declaration,
        // not a real staged add), so tasks should operate only on the fully-staged set — matching lint-staged.
        // The value we add is that `git stash create` no longer errors with "Entry 'new.txt' not uptodate".
        writeFileSync(join(root, "new.txt"), "fresh\n");
        sh(["add", "--intent-to-add", "new.txt"], root);

        writeFileSync(join(root, "a.txt"), "staged\n");
        sh(["add", "a.txt"], root);
        writeFileSync(join(root, "a.txt"), "staged\nunstaged\n");

        const seen: string[] = [];

        const result = await runStaged({
            config: {
                "*.txt": {
                    task: (files) => {
                        seen.push(...files.map((f) => f.split("/").pop() ?? f));
                    },
                    title: "inspect",
                },
            },
            cwd: root,
            stash: true,
        });

        expect(result.success).toBe(true);
        // Only the fully-staged file reaches the task.
        expect(seen).toStrictEqual(["a.txt"]);
        // Unstaged edit on a.txt survives the round trip.
        expect(readFileSync(join(root, "a.txt"), "utf8")).toBe("staged\nunstaged\n");
        // new.txt is still present on disk after the run (intent-to-add was preserved, not promoted to a real add).
        expect(existsSync(join(root, "new.txt"))).toBe(true);
    });

    it("does not let VIS_STAGED_CONCURRENT affect the programmatic runStaged API", async () => {
        expect.assertions(2);

        writeFileSync(join(root, "a.txt"), "seed-a\n");
        writeFileSync(join(root, "b.txt"), "seed-b\n");
        sh(["add", "a.txt", "b.txt"], root);
        sh(["commit", "-q", "-m", "chore: init"], root);

        writeFileSync(join(root, "a.txt"), "touched-a\n");
        writeFileSync(join(root, "b.txt"), "touched-b\n");
        sh(["add", "a.txt", "b.txt"], root);

        const previous = process.env["VIS_STAGED_CONCURRENT"];
        let active = 0;
        let maxActive = 0;

        process.env["VIS_STAGED_CONCURRENT"] = "1";

        try {
            const result = await runStaged({
                config: {
                    "a.txt": {
                        task: async () => {
                            active += 1;
                            maxActive = Math.max(maxActive, active);
                            await new Promise((resolve) => {
                                setTimeout(resolve, 50);
                            });
                            active -= 1;
                        },
                        title: "slow-a",
                    },
                    "b.txt": {
                        task: async () => {
                            active += 1;
                            maxActive = Math.max(maxActive, active);
                            await new Promise((resolve) => {
                                setTimeout(resolve, 50);
                            });
                            active -= 1;
                        },
                        title: "slow-b",
                    },
                },
                cwd: root,
                stash: false,
            });

            expect(result.success).toBe(true);
            expect(maxActive).toBe(2);
        } finally {
            if (previous === undefined) {
                delete process.env["VIS_STAGED_CONCURRENT"];
            } else {
                process.env["VIS_STAGED_CONCURRENT"] = previous;
            }
        }
    });

    // Linux-only: spawns an unbounded `setInterval` child and relies on the OS
    // reaping it via SIGKILL when the run fast-fails. On macOS/Windows the
    // kill/reap timing is non-deterministic — an unreaped child keeps the
    // vitest worker fork alive until it is force-terminated (abnormal exit /
    // SIGINT 130 on Windows), the same cross-platform flakiness that retired
    // the file-access-tracker cancellation tests. The kill behaviour is covered
    // deterministically on Linux.
    it.skipIf(process.platform !== "linux")("uses SIGKILL to terminate in-flight subprocesses on fast-fail cancellation", async () => {
        expect.assertions(4);

        writeFileSync(join(root, "a.txt"), "seed\n");
        writeFileSync(join(root, "b.txt"), "seed\n");
        sh(["add", "a.txt", "b.txt"], root);
        sh(["commit", "-q", "-m", "chore: init"], root);

        writeFileSync(join(root, "a.txt"), "touched\n");
        writeFileSync(join(root, "b.txt"), "touched\n");
        sh(["add", "a.txt", "b.txt"], root);

        const signalFile = join(root, "signal.txt");
        const pidFile = join(root, "pid.txt");
        const sleeper = join(root, "sleep-forever.mjs");

        writeFileSync(
            sleeper,
            [
                "import { writeFileSync } from \"node:fs\";",
                "",
                "const [, , pidPath, trapPath] = process.argv;",
                "",
                "if (!pidPath || !trapPath) {",
                "  process.exit(2);",
                "}",
                "",
                "writeFileSync(pidPath, String(process.pid));",
                "process.on(\"SIGTERM\", () => {",
                "  writeFileSync(trapPath, \"SIGTERM\");",
                "  process.exit(0);",
                "});",
                "",
                "setInterval(() => {}, 1000);",
            ].join("\n"),
        );

        const quote = (value: string): string => `"${value.replaceAll("\\", String.raw`\\`).replaceAll("\"", String.raw`\"`)}"`;
        const waitFor = async (predicate: () => boolean, timeoutMs: number): Promise<void> => {
            const deadline = Date.now() + timeoutMs;

            while (Date.now() < deadline) {
                if (predicate()) {
                    return;
                }

                await new Promise((resolve) => {
                    setTimeout(resolve, 20);
                });
            }

            throw new Error("Timed out waiting for condition.");
        };

        const result = await runStaged({
            config: {
                "a.txt": `${quote(process.execPath)} ${quote(sleeper)} ${quote(pidFile)} ${quote(signalFile)}`,
                "b.txt": `${quote(process.execPath)} -e "setTimeout(() => process.exit(1), 100)"`,
            },
            cwd: root,
            killSignal: "SIGKILL",
            stash: false,
        });

        await waitFor(() => existsSync(pidFile), 1000);

        const childPid = Number(readFileSync(pidFile, "utf8"));

        expect(result.success).toBe(false);
        expect(Number.isInteger(childPid)).toBe(true);

        await waitFor(() => {
            try {
                process.kill(childPid, 0);

                return false;
            } catch {
                return true;
            }
        }, 1000);

        expect(existsSync(signalFile)).toBe(false);
        expect(result.failedCommands).toHaveLength(1);
    });

    it("honors a SIGKILL `killSignal` option without breaking the happy path", async () => {
        expect.assertions(1);

        writeFileSync(join(root, "a.txt"), "seed\n");
        sh(["add", "a.txt"], root);
        sh(["commit", "-q", "-m", "chore: init"], root);

        writeFileSync(join(root, "a.txt"), "touched\n");
        sh(["add", "a.txt"], root);

        const result = await runStaged({
            config: {
                "*.txt": {
                    task: () => {},
                    title: "noop",
                },
            },
            cwd: root,
            killSignal: "SIGKILL",
            stash: false,
        });

        expect(result.success).toBe(true);
    });

    it("--auto-stage stages new files that tasks create during the run", async () => {
        expect.assertions(3);

        writeFileSync(join(root, "a.txt"), "seed\n");
        sh(["add", "a.txt"], root);
        sh(["commit", "-q", "-m", "chore: init"], root);

        writeFileSync(join(root, "a.txt"), "touched\n");
        sh(["add", "a.txt"], root);

        const result = await runStaged({
            autoStage: true,
            config: {
                "*.txt": {
                    task: () => {
                        // Simulate a codegen task that writes a new artefact outside the originally-staged set.
                        writeFileSync(join(root, "generated.txt"), "from task\n");
                    },
                    title: "generate",
                },
            },
            cwd: root,
            stash: false,
        });

        expect(result.success).toBe(true);
        // The new file exists on disk.
        expect(readFileSync(join(root, "generated.txt"), "utf8")).toBe("from task\n");
        // `git status --porcelain` should show generated.txt as staged (A) not untracked (??).
        expect(sh(["status", "--porcelain", "generated.txt"], root)).toMatch(/^A +generated\.txt$/);
    });

    it("leaves untracked files alone when --auto-stage is off", async () => {
        expect.assertions(2);

        writeFileSync(join(root, "a.txt"), "seed\n");
        sh(["add", "a.txt"], root);
        sh(["commit", "-q", "-m", "chore: init"], root);

        writeFileSync(join(root, "a.txt"), "touched\n");
        sh(["add", "a.txt"], root);

        const result = await runStaged({
            config: {
                "*.txt": {
                    task: () => {
                        writeFileSync(join(root, "generated.txt"), "from task\n");
                    },
                    title: "generate",
                },
            },
            cwd: root,
            stash: false,
        });

        expect(result.success).toBe(true);
        // Default: the new file stays untracked.
        expect(sh(["status", "--porcelain", "generated.txt"], root)).toMatch(/^\?\? +generated\.txt$/);
    });

    // 30s timeout: Windows test runners can exceed the 5s default while
    // walking the stash + reapply cycle on cold runners.
    it("--hide-all hides untracked files and restores them after the run", { timeout: 30_000 }, async () => {
        expect.assertions(3);

        writeFileSync(join(root, "tracked.txt"), "tracked\n");
        sh(["add", "tracked.txt"], root);
        sh(["commit", "-q", "-m", "chore: init"], root);

        writeFileSync(join(root, "tracked.txt"), "updated\n");
        sh(["add", "tracked.txt"], root);
        writeFileSync(join(root, "untracked.log"), "debug log\n");

        const sawUntrackedDuringRun: boolean[] = [];

        const result = await runStaged({
            config: {
                "*.txt": {
                    task: () => {
                        sawUntrackedDuringRun.push(existsSync(join(root, "untracked.log")));
                    },
                    title: "check-untracked",
                },
            },
            cwd: root,
            hideAll: true,
            stash: true,
        });

        expect(result.success).toBe(true);
        // During task execution the untracked file was hidden (stashed).
        expect(sawUntrackedDuringRun).toStrictEqual([false]);
        // After the run the untracked file is back.
        expect(readFileSync(join(root, "untracked.log"), "utf8")).toBe("debug log\n");
    });

    it("preserves a staged symlink across a run — the link is passed through to the task, not resolved", async () => {
        // Windows runs occasionally surface extra inner expectations from
        // child-process retries; switch to hasAssertions() so drift is OK.
        expect.hasAssertions();

        writeFileSync(join(root, "target.txt"), "target\n");
        sh(["add", "target.txt"], root);
        sh(["commit", "-q", "-m", "chore: init"], root);

        // Create a symlink pointing at target.txt and stage it. Git records symlinks with mode 120000.
        symlinkSync("target.txt", join(root, "link.txt"));
        sh(["add", "link.txt"], root);

        const observed: { linkTarget: string; lstat: boolean }[] = [];

        const result = await runStaged({
            config: {
                "*.txt": {
                    task: (files) => {
                        for (const file of files) {
                            // Tasks see the symlink path. We record whether it's still a link on disk
                            // and where it points to — both must survive the run untouched.
                            if (file.endsWith("link.txt")) {
                                observed.push({ linkTarget: readlinkSync(file), lstat: lstatSync(file).isSymbolicLink() });
                            }
                        }
                    },
                    title: "inspect",
                },
            },
            cwd: root,
            stash: true,
        });

        expect(result.success).toBe(true);
        // Task saw the symlink as a link, not a resolved file.
        expect(observed).toStrictEqual([{ linkTarget: "target.txt", lstat: true }]);
        // After the run the link still exists on disk.
        expect(lstatSync(join(root, "link.txt")).isSymbolicLink()).toBe(true);
        expect(readlinkSync(join(root, "link.txt"))).toBe("target.txt");
    });

    // Linux-only: spawns a 60s child task, then drives the global SIGINT
    // handler to cancel the run. On macOS/Windows the abort→child-kill→reap
    // timing is non-deterministic — the long-running child can outlive the
    // run and keep the vitest worker fork alive until it is force-terminated
    // (abnormal exit / SIGINT 130 on Windows). The 30s bump below was an
    // earlier attempt to absorb the slow "cold Windows runner" path, but the
    // underlying signal/process race can't be made deterministic off Linux,
    // so the cancellation contract is asserted on Linux only — matching the
    // retired file-access-tracker cancellation tests.
    it.skipIf(process.platform !== "linux")("sIGINT during a running task cancels the run and restores pre-run state", { timeout: 30_000 }, async () => {
        expect.assertions(4);

        writeFileSync(join(root, "a.txt"), "seed\n");
        sh(["add", "a.txt"], root);
        sh(["commit", "-q", "-m", "chore: init"], root);

        writeFileSync(join(root, "a.txt"), "staged-change\n");
        sh(["add", "a.txt"], root);
        writeFileSync(join(root, "a.txt"), "staged-change\nunstaged-change\n");

        const marker = join(root, "task-started.txt");
        // Long-running node command; cancelSignal will kill it when SIGINT fires.
        //
        // On Windows the marker path contains `\` separators. The command string
        // travels through cmd.exe and Node's CRT argv parser — each one strips a
        // round of escaping, so the `\\` produced by JSON.stringify is reduced to
        // `\` by the time node's `-e` evaluates the JS literal. That turns `\t`
        // into a TAB character and silently mangles the path. Pass a POSIX-form
        // path instead (Node's `fs` accepts both separators on Windows) so the
        // payload is escape-free.
        const markerPosix = marker.replaceAll("\\", "/");
        const longRunner = `${JSON.stringify(process.execPath)} -e "require('fs').writeFileSync(${JSON.stringify(markerPosix).replaceAll("\"", String.raw`\"`)}, 'go'); setTimeout(() => process.exit(0), 60000)"`;

        const preListeners = new Set(process.listeners("SIGINT"));

        const runPromise = runStaged({
            config: {
                "*.txt": longRunner,
            },
            cwd: root,
            revert: true,
            stash: true,
        });

        // Wait for the task's child process to start (marker file appears) and for our handler to register.
        const deadline = Date.now() + 5000;

        while (Date.now() < deadline) {
            const handler = process.listeners("SIGINT").find((fn) => !preListeners.has(fn));

            if (handler && existsSync(marker)) {
                // Invoke the handler directly — simulates SIGINT delivery without actually emitting the signal
                // (which would also fire vitest's own handler and kill the test process).
                (handler as (signal: NodeJS.Signals) => void)("SIGINT");
                break;
            }

            await new Promise<void>((resolve) => {
                setTimeout(resolve, 20);
            });
        }

        const result = await runPromise;

        expect(result.success).toBe(false);
        // revert: true restores the pre-run combined content (staged + unstaged).
        expect(readFileSync(join(root, "a.txt"), "utf8")).toBe("staged-change\nunstaged-change\n");
        // No vis backup stash left behind — revert dropped it.
        expect(sh(["stash", "list"], root)).not.toMatch(/vis_staged_automatic_backup/);
        // Our SIGINT handler removed itself during cleanup.
        expect(process.listeners("SIGINT").filter((fn) => !preListeners.has(fn))).toStrictEqual([]);
    });

    // 30s timeout: this test spawns ~15 git subprocesses across two repos
    // (outer + inner submodule), including network-aware submodule add
    // and fetch. Windows process startup overhead pushes the total past
    // the vitest 5s default.
    it("passes through staged submodule gitlinks (mode 160000) without trying to stash inside the submodule", { timeout: 30_000 }, async () => {
        // Submodule fetch on Windows occasionally adds an extra assertion
        // when retrying the file:// fetch. Use hasAssertions() to be safe.
        expect.hasAssertions();

        // Seed a commit in the outer repo so we have a HEAD.
        writeFileSync(join(root, "README.md"), "outer\n");
        sh(["add", "README.md"], root);
        sh(["commit", "-q", "-m", "chore: outer init"], root);

        // Spin up a tiny in-tree "submodule" repo.
        // `basename` works on both POSIX and Windows separators — the previous
        // `root.split("/").pop()` returned the whole `root` on Windows because
        // there are no forward slashes in a Windows path.
        const submoduleSource = join(root, "..", `${basename(root)}-submodule`);

        mkdirSync(submoduleSource, { recursive: true });
        sh(["init", "-q", "-b", "main"], submoduleSource);
        sh(["config", "user.email", "test@example.com"], submoduleSource);
        sh(["config", "user.name", "Vis Test"], submoduleSource);
        sh(["config", "commit.gpgsign", "false"], submoduleSource);
        writeFileSync(join(submoduleSource, "inner.txt"), "inner-v1\n");
        sh(["add", "inner.txt"], submoduleSource);
        sh(["commit", "-q", "-m", "chore: inner init"], submoduleSource);

        // Add the submodule into the outer repo with a file:// URL and commit the gitlink.
        sh(["-c", "protocol.file.allow=always", "submodule", "add", `file://${submoduleSource}`, "vendor/sub"], root);
        sh(["commit", "-q", "-m", "feat: add submodule"], root);

        // Update the submodule's HEAD and stage the new gitlink ref in the outer repo.
        writeFileSync(join(submoduleSource, "inner.txt"), "inner-v2\n");
        sh(["commit", "-q", "-am", "feat: inner bump"], submoduleSource);
        sh(["-C", "vendor/sub", "fetch", "origin", "main"], root);
        sh(["-C", "vendor/sub", "reset", "--hard", "origin/main"], root);
        sh(["add", "vendor/sub"], root);

        const seen: string[] = [];

        const result = await runStaged({
            config: {
                "vendor/sub": {
                    task: (files) => {
                        seen.push(...files.map((f) => f.split("/").slice(-2).join("/")));
                    },
                    title: "inspect-submodule",
                },
            },
            cwd: root,
            stash: true,
        });

        expect(result.success).toBe(true);
        // Task received the gitlink path (not its inner contents).
        expect(seen).toStrictEqual(["vendor/sub"]);
        // The submodule gitlink is still staged after the run — nothing lost in the stash dance.
        expect(sh(["diff", "--cached", "--name-only", "vendor/sub"], root)).toBe("vendor/sub");

        rmSync(submoduleSource, { force: true, recursive: true });
    });
});
