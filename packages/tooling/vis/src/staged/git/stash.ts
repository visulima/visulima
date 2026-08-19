import { randomBytes } from "node:crypto";

import { GetBackupStashError } from "../errors";
import { git, gitOut } from "./exec";

/**
 * Message prefix stored on the stash entry. A per-process suffix is appended at
 * creation time so concurrent `vis staged` invocations don't collide.
 *
 * `refs/stash` lives in the *common* git directory, so every linked worktree
 * pushes onto one shared stack. Concurrency here is not just two runs in one
 * checkout — it is any two checkouts of the same repository, which is why every
 * lookup below matches an entry by identity rather than by position.
 */
const STASH_MESSAGE_PREFIX = "vis_staged_automatic_backup";

const buildMessage = (): string => `${STASH_MESSAGE_PREFIX}-${process.pid}-${Date.now()}-${randomBytes(3).toString("hex")}`;

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
 * Resolves the stash commit sha for the entry carrying `message`, using the
 * `refs/stash` reflog so the match is on our own unique message rather than on
 * a stack position another checkout can shift.
 */
const findStashShaByMessage = async (cwd: string, message: string): Promise<string | null> => {
    const { exitCode, stdout } = await git(["reflog", "--format=%H %gs", "refs/stash"], { cwd, lenient: true });

    if (exitCode !== 0) {
        return null;
    }

    for (const line of stdout.split(/\r?\n/)) {
        const separator = line.indexOf(" ");

        if (separator !== -1 && line.slice(separator + 1).includes(message)) {
            return line.slice(0, separator);
        }
    }

    return null;
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

    // Resolve by our unique message, never `stash@{0}`: the stash stack is
    // shared with every linked worktree, so a concurrent `vis staged` there can
    // push between our own push and this lookup. Taking index 0 would then hand
    // back *their* stash, and the pop below would restore their working tree
    // into ours.
    return findStashShaByMessage(cwd, message);
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

/** Is the stash commit still in the object database? */
const isReachable = async (cwd: string, sha: string): Promise<boolean> => {
    const { exitCode } = await git(["rev-parse", "--verify", "--quiet", `${sha}^{commit}`], { cwd, lenient: true });

    return exitCode === 0;
};

/**
 * Resolves `sha` to its live `stash@{N}` reference and re-checks that the
 * reference still points at it.
 *
 * `drop` is the one operation git refuses to take a raw commit for, so it needs
 * a stack position — and positions shift whenever any checkout of this
 * repository pushes or drops a stash. Re-reading immediately before use keeps
 * us from deleting an entry that became someone else's between the two calls.
 */
const resolveDroppableRef = async (cwd: string, sha: string): Promise<string | null> => {
    const reference = await findStashRefBySha(cwd, sha);

    if (reference === null) {
        return null;
    }

    const { exitCode, stdout } = await git(["rev-parse", "--verify", "--quiet", reference], { cwd, lenient: true });

    return exitCode === 0 && stdout.trim() === sha ? reference : null;
};

/** Drops the stash entry that resolves to `sha`, if one is present. */
export const dropBackupStash = async (cwd: string, sha: string | null): Promise<void> => {
    if (sha === null) {
        return;
    }

    const reference = await resolveDroppableRef(cwd, sha);

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

    // `git stash apply` accepts a raw commit, so this restore needs no stack
    // position at all: it cannot pick up another checkout's stash, and it still
    // works if the entry was dropped while the commit is reachable.
    if (!(await isReachable(cwd, sha))) {
        throw new GetBackupStashError(`Backup stash ${sha} is no longer reachable — can't revert working tree.`);
    }

    await git(["reset", "--hard", "HEAD"], { cwd });
    await git(["stash", "apply", "--index", "--quiet", sha], { cwd });
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

    if (!(await isReachable(cwd, sha))) {
        return;
    }

    // `pop` is apply-then-drop, and only the drop half needs a stack position.
    // Splitting it means the restore is pinned to our own commit. Throws on a
    // conflicting apply exactly as `git stash pop` did, leaving the entry in
    // place for the user to resolve.
    await git(["stash", "apply", "--quiet", sha], { cwd });
    await dropBackupStash(cwd, sha);
};

export { STASH_MESSAGE_PREFIX };
