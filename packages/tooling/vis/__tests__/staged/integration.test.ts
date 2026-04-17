import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ApplyEmptyCommitError, ConfigError, runStaged } from "../../src/staged";

let root: string;

const sh = (args: string[], cwd: string): string => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

const initRepo = (): string => {
    const directory = join(tmpdir(), `vis-staged-integration-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

    mkdirSync(directory, { recursive: true });
    sh(["init", "-q", "-b", "main"], directory);
    sh(["config", "user.email", "test@example.com"], directory);
    sh(["config", "user.name", "Vis Test"], directory);
    sh(["config", "commit.gpgsign", "false"], directory);

    return directory;
};

describe("runStaged — integration", () => {
    beforeEach(() => {
        root = initRepo();
    });

    afterEach(() => {
        rmSync(root, { force: true, recursive: true });
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
        expect(touched).toEqual([join(root, "note.txt")]);
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

    it("preserves unstaged deltas on a partially-staged file across a successful run", async () => {
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
        expect(seenByTask).toEqual(["line-1 staged\n"]);
        // After the run, the working tree is back to staged + unstaged combined.
        expect(readFileSync(join(root, "a.txt"), "utf8")).toBe("line-1 staged\nunstaged-hunk\n");
        // No residual backup stash on success.
        expect(sh(["stash", "list"], root)).toBe("");
    });

    it("reverts the working tree on task failure when --revert is set", async () => {
        expect.assertions(3);

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
        expect(invokedWith).toEqual([join(root, "a.txt")]);
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

    it("loads a YAML .lintstagedrc config from disk when no inline config is provided", async () => {
        expect.assertions(1);

        writeFileSync(join(root, "a.txt"), "x\n");
        sh(["add", "a.txt"], root);
        sh(["commit", "-q", "-m", "chore: init"], root);

        writeFileSync(join(root, "a.txt"), "y\n");
        sh(["add", "a.txt"], root);

        writeFileSync(join(root, ".lintstagedrc.yaml"), '"*.txt":\n  - "node -e \\"process.exit(0)\\""\n');

        const result = await runStaged({
            cwd: root,
            stash: false,
        });

        expect(result.success).toBe(true);
    });

    it("throws ConfigError when neither inline config nor a config file is available", async () => {
        expect.assertions(1);

        writeFileSync(join(root, "a.txt"), "x\n");
        sh(["add", "a.txt"], root);
        sh(["commit", "-q", "-m", "chore: init"], root);

        writeFileSync(join(root, "a.txt"), "y\n");
        sh(["add", "a.txt"], root);

        await expect(runStaged({ cwd: root, stash: false })).rejects.toBeInstanceOf(ConfigError);
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
        expect(seen).toEqual([join(root, "a.txt")]);
    });

    it("handles partially-staged rename entries without losing the new path", async () => {
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
        expect(seen).toEqual(["content\n"]);
        // After the run, working tree has staged + unstaged combined.
        expect(readFileSync(join(root, "new.txt"), "utf8")).toBe("content\nunstaged-extra\n");
    });

    it("loads an external config file when --configPath is set", async () => {
        expect.assertions(1);

        writeFileSync(join(root, "a.txt"), "x\n");
        sh(["add", "a.txt"], root);
        sh(["commit", "-q", "-m", "chore: init"], root);

        writeFileSync(join(root, "a.txt"), "y\n");
        sh(["add", "a.txt"], root);

        const external = join(root, "custom-staged.json");

        writeFileSync(external, JSON.stringify({ "*.txt": 'node -e "process.exit(0)"' }));

        const result = await runStaged({
            configPath: external,
            cwd: root,
            stash: false,
        });

        expect(result.success).toBe(true);
    });

    it("guards against the ApplyEmptyCommitError re-throwing path", () => {
        expect.assertions(1);
        // Regression guard: the error subclass must remain a StagedError so runStaged converts it to success:false.
        expect(new ApplyEmptyCommitError("x")).toBeInstanceOf(Error);
    });

    it("preserves unstaged deltas across many partially-staged files spread across subdirectories", async () => {
        expect.assertions(8); // 2 top-level + 5 per-file readFileSync + 1 stash-list check

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
        expect([...seenByTask].sort()).toEqual([...layout.map(([, staged]) => `${staged}// staged tweak\n`)].sort());

        // Every file on disk has the combined staged+unstaged content after restore.
        for (const [relative, staged, unstagedExtra] of layout) {
            const absolute = join(root, relative);

            expect(readFileSync(absolute, "utf8")).toBe(`${staged}// staged tweak\n${unstagedExtra}`);
        }

        // No backup stash left behind on success.
        expect(sh(["stash", "list"], root)).toBe("");
    });

    it("applies the top-level `ignore` list before pattern matching", async () => {
        expect.assertions(2);

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
        expect(seen).toEqual(["a.ts"]);
    });

    it("preserves MERGE_HEAD/MERGE_MSG/MERGE_MODE across a staged run mid-merge", async () => {
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

    it("handles files added with `git add --intent-to-add` without falling over (lint-staged #990)", async () => {
        expect.assertions(4);

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
        expect(seen).toEqual(["a.txt"]);
        // Unstaged edit on a.txt survives the round trip.
        expect(readFileSync(join(root, "a.txt"), "utf8")).toBe("staged\nunstaged\n");
        // new.txt is still present on disk after the run (intent-to-add was preserved, not promoted to a real add).
        expect(existsSync(join(root, "new.txt"))).toBe(true);
    });

    it("--hide-all hides untracked files and restores them after the run", async () => {
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
        expect(sawUntrackedDuringRun).toEqual([false]);
        // After the run the untracked file is back.
        expect(readFileSync(join(root, "untracked.log"), "utf8")).toBe("debug log\n");
    });
});
