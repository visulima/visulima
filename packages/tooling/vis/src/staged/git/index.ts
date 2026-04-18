import { readFileSync, unlinkSync, writeFileSync } from "node:fs";

import { isAccessibleSync } from "@visulima/fs";
import { join, relative as relativePath } from "@visulima/path";

import { GitError, RestoreOriginalStateError } from "../errors";
import type { RunOptions } from "../types";
import { capturePatch, checkoutPaths, getFiles, getIntentToAddPaths, getPartiallyStagedFiles, getUntrackedFiles, removeFromIndex, updateIndexAgain } from "./diff";
import { assertGitVersion, getGitDirectory, getWorkTree, git, headTreeSha, isGitRepo, writeIndexTree } from "./exec";
import { applyBackupStash, createBackupStash, createHideAllStash, dropBackupStash, popHideAllStash } from "./stash";

interface MergeFile {
    readonly body: Buffer | null;
    readonly existed: boolean;
    readonly name: string;
}

/**
 * Encapsulates the full git side-effect sequence around task execution:
 * take a backup stash, hide unstaged deltas, run tasks, re-stage fixes,
 * reapply hidden deltas, and revert on failure. Mirrors lint-staged's
 * GitWorkflow state machine with equivalent flag behavior.
 */
export class GitWorkflow {
    public stagedFiles: string[] = [];

    public partiallyStaged: string[] = [];

    public workTree = "";

    public gitDir = "";

    /** Index tree sha captured at the end of `prepare()`, before tasks run. */
    public preTaskIndexTree = "";

    /** Index tree sha captured at the end of `applyModifications()`, after tasks' in-place edits are staged. */
    public postTaskIndexTree = "";

    /** HEAD tree sha captured in `prepare()` — used to detect empty-after-revert commits. */
    public headTree = "";

    /** Becomes true after a successful `revert()` so the caller can skip the unstaged-patch re-apply that would duplicate the restored deltas. */
    public revertApplied = false;

    /** Emitted by `prepare()` when we skip the backup stash but still have partially-staged files — the caller can surface this to the user. */
    public warnings: string[] = [];

    private readonly cwd: string;

    private readonly options: RunOptions;

    private patch: Buffer | null = null;

    private backupStashSha: string | null = null;

    private merge: MergeFile[] = [];

    private readonly shouldStash: boolean;

    private readonly shouldHidePartial: boolean;

    private readonly shouldHideUnstaged: boolean;

    private readonly shouldHideAll: boolean;

    /** Sha of the hide-all push stash (if `--hide-all` is set), tracked separately from the create+store backup. */
    private hideAllStashSha: string | null = null;

    /** Paths that were `git add -N`'d (intent-to-add) — removed from the index before stashing, restored after. */
    private intentToAddPaths: string[] = [];

    /** Untracked files observed at the end of `prepare()`. Diffed post-run to detect task-created files for `--autoStage`. */
    private preTaskUntracked: ReadonlySet<string> = new Set();

    public constructor(options: RunOptions) {
        this.cwd = options.cwd ?? process.cwd();
        this.options = options;
        this.shouldStash = options.stash !== false && options.diff === undefined;
        this.shouldHidePartial = options.hidePartiallyStaged !== false;
        this.shouldHideUnstaged = options.hideUnstaged === true;
        this.shouldHideAll = options.hideAll === true;
    }

    public async prepare(): Promise<void> {
        if (!(await isGitRepo(this.cwd))) {
            throw new GitError(`Not a git repository: ${this.cwd}`);
        }

        await assertGitVersion(this.cwd);

        this.workTree = await getWorkTree(this.cwd);
        this.gitDir = await getGitDirectory(this.cwd);

        this.stagedFiles = await getFiles({ cwd: this.cwd, diff: this.options.diff, diffFilter: this.options.diffFilter, workTree: this.workTree });
        this.partiallyStaged = this.stagedFiles.length === 0 ? [] : await getPartiallyStagedFiles(this.cwd);

        this.snapshotMergeState();

        // Intent-to-add entries crash `git stash create` with "Entry '...' not uptodate. Cannot merge." — lint-staged issue #990.
        // Remove them from the index before stashing; applyModifications re-marks them with `--intent-to-add`
        // afterwards so the user's "declared but not yet committed" state is preserved.
        this.intentToAddPaths = await getIntentToAddPaths(this.workTree);

        if (this.intentToAddPaths.length > 0) {
            await removeFromIndex(this.intentToAddPaths, { cwd: this.workTree });
        }

        if (this.shouldStash) {
            this.backupStashSha = await createBackupStash(this.workTree);
        } else if (this.partiallyStaged.length > 0) {
            // Without a backup stash, a failed re-apply of the captured patch leaves the user with no recovery route.
            this.warnings.push(
                "Running with --no-stash on partially-staged files — unstaged deltas will be captured to a patch, "
                + "but if re-applying the patch fails after tasks run the changes cannot be recovered.",
            );
        }

        if (this.shouldHideAll) {
            // --hide-all captures untracked + unstaged via `git stash push --include-untracked`; popped in cleanup.
            this.hideAllStashSha = await createHideAllStash(this.workTree);
        } else {
            await this.hideUnstagedChanges();
        }

        // Snapshot trees AFTER hiding unstaged changes so the baseline is the content tasks will actually see.
        this.preTaskIndexTree = this.stagedFiles.length === 0 ? "" : await writeIndexTree(this.workTree);
        this.postTaskIndexTree = this.preTaskIndexTree;
        this.headTree = await headTreeSha(this.workTree);

        // Snapshot the untracked set so `applyModifications({ autoStage: true })` can diff before/after
        // and stage only the files that tasks created during this run.
        this.preTaskUntracked = new Set(await getUntrackedFiles(this.workTree));
    }

    /**
     * Refreshes the index against the working tree, so task edits
     * (including deletions of already-tracked files) are re-staged.
     * Uses `git update-index --again` for parity with lint-staged v17,
     * which behaves correctly when the original commit used a pathspec.
     */
    public async applyModifications({ autoStage = false }: { readonly autoStage?: boolean } = {}): Promise<void> {
        if (this.stagedFiles.length === 0) {
            return;
        }

        const worktreeRelative = this.stagedFiles.map((path) => relativePath(this.workTree, path));

        await updateIndexAgain(worktreeRelative, { cwd: this.workTree });

        // --autoStage: diff untracked set vs pre-run and stage anything new.
        // Only files that didn't exist as untracked before the run count — pre-existing untracked files stay untouched.
        if (autoStage) {
            const postUntracked = await getUntrackedFiles(this.workTree);
            const newFiles = postUntracked.filter((path) => !this.preTaskUntracked.has(path));

            if (newFiles.length > 0) {
                const pathspec = `${newFiles.join("\u0000")}\u0000`;

                await git(
                    ["add", "--pathspec-from-file=-", "--pathspec-file-nul", "--"],
                    { cwd: this.workTree, input: pathspec },
                );
            }
        }

        // Intent-to-add paths were removed from the index in prepare() so the backup stash could serialise.
        // Re-mark them with `--intent-to-add` to preserve the user's original declaration — promoting them to a
        // real staged add would commit content the user hadn't yet approved for commit.
        if (this.intentToAddPaths.length > 0) {
            try {
                await git(["add", "--intent-to-add", "--", ...this.intentToAddPaths], { cwd: this.workTree });
            } catch {
                // Best effort — if a task deleted the file, the re-mark has no target and can be skipped.
            }
        }

        this.postTaskIndexTree = await writeIndexTree(this.workTree);
    }

    /** True when tasks modified at least one staged file's content (index tree changed). */
    public indexTreeChanged(): boolean {
        return this.preTaskIndexTree.length > 0 && this.postTaskIndexTree.length > 0 && this.preTaskIndexTree !== this.postTaskIndexTree;
    }

    /** True when the post-task index tree matches HEAD — i.e. tasks reverted every staged change. */
    public postTaskIndexMatchesHead(): boolean {
        return this.postTaskIndexTree.length > 0 && this.headTree.length > 0 && this.postTaskIndexTree === this.headTree;
    }

    /**
     * Re-applies the hidden unstaged patch. Falls back to 3-way on conflict.
     * Skips silently when `revert()` already restored the working tree from the backup stash,
     * since the stash already carries those deltas and re-applying would duplicate them.
     * When `--hide-all` is active this is also a no-op — the `popHideAllStash()` call in
     * `cleanup()` handles restore for that mode.
     */
    public async restoreUnstagedChanges(): Promise<void> {
        if (this.revertApplied || this.patch === null || this.shouldHideAll) {
            return;
        }

        const applyArguments: ReadonlyArray<string> = ["apply", "--whitespace=nowarn", "--recount", "--unidiff-zero"];

        let firstError: string | undefined;

        try {
            await git(applyArguments, { cwd: this.workTree, input: this.patch });

            return;
        } catch (error) {
            firstError = error instanceof GitError ? error.stderr : String(error);
        }

        try {
            await git([...applyArguments, "--3way"], { cwd: this.workTree, input: this.patch });
        } catch (error) {
            const detail = error instanceof GitError && error.stderr ? error.stderr : String(error);

            throw new RestoreOriginalStateError(
                "Failed to re-apply unstaged changes after running tasks. Original changes remain in the backup stash — recover with `git stash list` and `git stash apply`.\n"
                + `First attempt: ${firstError ?? "(no stderr)"}\nSecond attempt: ${detail}`,
                { cause: error as Error },
            );
        }
    }

    /** Restores index + working tree from the backup stash and drops it. */
    public async revert(): Promise<void> {
        if (this.backupStashSha === null) {
            return;
        }

        try {
            await applyBackupStash(this.workTree, this.backupStashSha);
        } catch (error) {
            throw new RestoreOriginalStateError("Revert failed while restoring the backup stash. Use `git stash list` to recover manually.", {
                cause: error as Error,
            });
        }

        await dropBackupStash(this.workTree, this.backupStashSha);

        // Restore the intent-to-add markers we removed in prepare() — on a revert we want the
        // pre-run state exactly, including the declarative "planned to add" index entries.
        if (this.intentToAddPaths.length > 0) {
            try {
                await git(["add", "--intent-to-add", "--", ...this.intentToAddPaths], { cwd: this.workTree });
            } catch {
                // Best effort — if the file was also deleted between prepare and revert, there's nothing sensible to mark.
            }
        }

        this.revertApplied = true;
    }

    /**
     * On success, drops the backup stash and pops the hide-all stash (if any).
     * On failure without --revert, leaves the backup stash in place so the
     * user can recover manually.
     */
    public async cleanup(success: boolean): Promise<void> {
        this.restoreMergeState();

        // Always try to restore the hide-all stash, even on failure — the untracked files belong to the user, not to us.
        if (this.hideAllStashSha !== null) {
            try {
                await popHideAllStash(this.workTree, this.hideAllStashSha);
            } catch {
                // Pop conflicts are possible when tasks added files that collide with restored untracked ones.
                // Leave the stash in place so the user can reconcile by hand.
            }
        }

        if (success && this.backupStashSha !== null && !this.revertApplied) {
            await dropBackupStash(this.workTree, this.backupStashSha);
        }
    }

    /**
     * Returns a user-facing hint that points at the backup stash when
     * tasks failed and we kept it around (no --revert).
     */
    public recoveryHint(): string | null {
        if (this.backupStashSha === null) {
            return null;
        }

        return `Backup stash is preserved (sha ${this.backupStashSha.slice(0, 7)}) — restore with: git stash apply --index ${this.backupStashSha}`;
    }

    private async hideUnstagedChanges(): Promise<void> {
        // `stagedFiles` holds absolute paths; `partiallyStaged` holds worktree-relative paths from `git status`.
        // Match by normalized relative path to avoid basename collisions that would incorrectly flag siblings in other directories.
        const stagedRelative = new Set(this.stagedFiles.map((path) => relativePath(this.workTree, path)));

        const candidatesRelative = this.shouldHideUnstaged
            ? [...stagedRelative]
            : this.shouldHidePartial
                ? this.partiallyStaged.filter((path) => stagedRelative.has(path))
                : [];

        if (candidatesRelative.length === 0) {
            return;
        }

        // capturePatch and checkoutPaths need `cwd = workTree` for worktree-relative paths to resolve correctly.
        this.patch = await capturePatch(candidatesRelative, { cwd: this.workTree });

        if (this.patch === null) {
            return;
        }

        await checkoutPaths(candidatesRelative, { cwd: this.workTree });
    }

    private snapshotMergeState(): void {
        if (this.gitDir.length === 0) {
            return;
        }

        this.merge = (["MERGE_HEAD", "MERGE_MODE", "MERGE_MSG"] as const).map((name) => {
            const target = join(this.gitDir, name);

            if (isAccessibleSync(target)) {
                return { body: readFileSync(target), existed: true, name };
            }

            return { body: null, existed: false, name };
        });
    }

    private restoreMergeState(): void {
        if (this.gitDir.length === 0 || this.merge.length === 0) {
            return;
        }

        for (const entry of this.merge) {
            const target = join(this.gitDir, entry.name);

            try {
                if (entry.existed && entry.body !== null) {
                    writeFileSync(target, entry.body);
                } else if (isAccessibleSync(target)) {
                    // File didn't exist pre-run but does now — remove to restore the original state.
                    unlinkSync(target);
                }
            } catch {
                // Best effort — merge state is non-critical on cleanup.
            }
        }
    }
}
