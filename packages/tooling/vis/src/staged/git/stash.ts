import { GetBackupStashError } from "../errors";
import { git, gitOut } from "./exec";

/** Message prefix stored on the stash entry. A per-process suffix is appended at creation time so concurrent `vis staged` invocations don't collide. */
const STASH_MESSAGE_PREFIX = "vis_staged_automatic_backup";

const buildMessage = (): string => `${STASH_MESSAGE_PREFIX}-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * Creates and stores a hidden backup stash. Uses `git stash create +
 * store` instead of `git stash push` so the working tree and index are
 * left untouched — pushing would mutate the worktree, which breaks
 * concurrent editors and file watchers.
 *
 * Returns the stash commit sha, or `null` when there is nothing to
 * stash (e.g. a fresh repo with only an initial commit).
 */
export const createBackupStash = async (cwd: string): Promise<string | null> => {
    const sha = await gitOut(["stash", "create"], { cwd });

    if (sha.length === 0) {
        return null;
    }

    await git(["stash", "store", "-m", buildMessage(), sha], { cwd });

    return sha;
};

/**
 * Stashes every unstaged change and untracked file on top of the index,
 * leaving only staged content in the working tree. Unlike
 * {@link createBackupStash}, this uses `git stash push --include-untracked`
 * because `git stash create` cannot capture untracked files.
 *
 * Returns the stash commit sha so the caller can drop or apply it later.
 */
export const createHideAllStash = async (cwd: string): Promise<string | null> => {
    const message = buildMessage();
    const { exitCode, stdout } = await git(["stash", "push", "--keep-index", "--include-untracked", "--quiet", "-m", message], { cwd, lenient: true });

    if (exitCode !== 0) {
        return null;
    }

    const note = stdout.trim();
    // A "No local changes to save" message means nothing was stashed — signal that to the caller.

    if (note.length > 0 && /no local changes/i.test(note)) {
        return null;
    }

    // Resolve the sha for the stash we just pushed so downstream code can operate by sha like the normal backup path.
    return gitOut(["rev-parse", "stash@{0}"], { cwd });
};

/**
 * Resolves a stash commit sha to the live `stash@{N}` reference.
 * Uses the reflog for `refs/stash` rather than `git stash list` so
 * matching is exact (sha equality) and robust against concurrent
 * pushes/drops shifting entry indices.
 */
const findStashRefBySha = async (cwd: string, sha: string): Promise<string | null> => {
    const { exitCode, stdout } = await git(["reflog", "--format=%H %gd", "refs/stash"], { cwd, lenient: true });

    if (exitCode !== 0) {
        return null;
    }

    for (const line of stdout.split(/\r?\n/)) {
        const [entrySha, ref] = line.split(/\s+/, 2);

        if (entrySha === sha && ref !== undefined) {
            return ref;
        }
    }

    return null;
};

/** Drops the stash entry that resolves to `sha`, if one is present. */
export const dropBackupStash = async (cwd: string, sha: string | null): Promise<void> => {
    if (sha === null) {
        return;
    }

    const reference = await findStashRefBySha(cwd, sha);

    if (reference === null) {
        return;
    }

    await git(["stash", "drop", "--quiet", reference], { cwd });
};

/**
 * Restores the working tree and index from the backup stash. Used by
 * the revert path when tasks failed and we need to leave the repo in
 * its pre-task state.
 */
export const applyBackupStash = async (cwd: string, sha: string | null): Promise<void> => {
    if (sha === null) {
        throw new GetBackupStashError("Backup stash was not found — can't revert working tree.");
    }

    const reference = await findStashRefBySha(cwd, sha);

    if (reference === null) {
        throw new GetBackupStashError(`Backup stash ${sha} is no longer reachable — can't revert working tree.`);
    }

    await git(["reset", "--hard", "HEAD"], { cwd });
    await git(["stash", "apply", "--index", "--quiet", reference], { cwd });
};

/**
 * Pops the hide-all stash back onto the working tree — restoring
 * previously-hidden unstaged edits and untracked files. The index is
 * left untouched so task-driven edits that we already re-staged
 * survive the restore.
 */
export const popHideAllStash = async (cwd: string, sha: string | null): Promise<void> => {
    if (sha === null) {
        return;
    }

    const reference = await findStashRefBySha(cwd, sha);

    if (reference === null) {
        return;
    }

    await git(["stash", "pop", "--quiet", reference], { cwd });
};

export { STASH_MESSAGE_PREFIX };
