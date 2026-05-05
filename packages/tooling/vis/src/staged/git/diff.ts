import { isAbsolute, join } from "@visulima/path";

import { getWorkTree, git } from "./exec";

const DEFAULT_DIFF_FILTER = "ACMR";

/** Cap on paths-per-invocation to keep the combined argv under most platforms' `ARG_MAX`. */
const PATH_BATCH_SIZE = 500;

/**
 * Lists paths staged as "intent to add" (`git add -N`). These entries crash
 * `git stash create` with `Entry 'path' not uptodate. Cannot merge.`
 * We detect them via `git diff-files --raw`, which emits an all-zero new sha
 * with status `A` for intent-to-add entries (regular worktree-vs-index diffs
 * show a real blob sha for unstaged edits).
 *
 * The caller temporarily unstages them before the backup stash runs, and
 * restores the intent-to-add state in cleanup. See lint-staged issue #990.
 */
export const getIntentToAddPaths = async (cwd: string): Promise<string[]> => {
    const { stdout } = await git(["diff-files", "--raw", "-z"], { cwd });
    const tokens = stdout.split("\u0000").filter((token) => token.length > 0);
    const paths: string[] = [];

    // `diff-files --raw -z` alternates between two record kinds:
    //   1. `:<srcMode> <dstMode> <srcSha> <dstSha> <status>` (status letter terminator)
    //   2. `<path>` (the file the previous record referred to)
    for (let i = 0; i < tokens.length; i += 1) {
        const header = tokens[i];

        if (!header?.startsWith(":")) {
            continue;
        }

        const parts = header.slice(1).split(" ");
        const dstSha = parts[3];
        const status = parts[4];
        const path = tokens[i + 1];

        i += 1;

        // Intent-to-add: status `A` and the destination blob sha is all zeros.
        if (status === "A" && dstSha !== undefined && /^0+$/.test(dstSha) && path !== undefined) {
            paths.push(path);
        }
    }

    return paths;
};

/**
 * Lists untracked, non-ignored files in the working tree. Used by
 * `--autoStage` to pick up files a task created during the run.
 */
export const getUntrackedFiles = async (cwd: string): Promise<string[]> => {
    const { stdout } = await git(["ls-files", "--others", "--exclude-standard", "-z"], { cwd });

    return stdout.split("\u0000").filter((path) => path.length > 0);
};

/** Removes the listed paths from the index (`git rm --cached`), leaving the on-disk content alone. */
export const removeFromIndex = async (paths: ReadonlyArray<string>, options: { readonly cwd: string }): Promise<void> => {
    if (paths.length === 0) {
        return;
    }

    const pathspec = `${paths.join("\u0000")}\u0000`;

    await git(["rm", "--cached", "--quiet", "--pathspec-from-file=-", "--pathspec-file-nul", "--"], { cwd: options.cwd, input: pathspec });
};

/**
 * Lists files captured by the current diff — by default, staged files
 * matching the `ACMR` filter. When `diff` is set the range overrides
 * `--staged` (matching lint-staged's `--diff` CLI flag).
 */
export const getFiles = async (options: {
    readonly cwd: string;
    readonly diff?: string;
    readonly diffFilter?: string;
    readonly workTree?: string;
}): Promise<string[]> => {
    const filter = options.diffFilter ?? DEFAULT_DIFF_FILTER;
    const args =
        options.diff === undefined
            ? ["diff", "--name-only", "-z", `--diff-filter=${filter}`, "--staged"]
            : ["diff", "--name-only", "-z", `--diff-filter=${filter}`, ...options.diff.split(/\s+/).filter(Boolean)];

    const { stdout } = await git(args, { cwd: options.cwd });
    // `-z` emits NUL-terminated paths without escaping — don't trim, just split and drop empties.
    const relativePaths = stdout.split("\u0000").filter((path) => path.length > 0);

    if (relativePaths.length === 0) {
        return [];
    }

    const worktree = options.workTree ?? (await getWorkTree(options.cwd));

    return relativePaths.map((p) => (isAbsolute(p) ? p : join(worktree, p)));
};

/**
 * Captures the unstaged delta for a list of paths as a git patch. The
 * resulting buffer can be re-applied with `git apply` after tasks run.
 * Returns `null` when there are no unstaged changes for any of the paths.
 *
 * Splits `paths` into batches to stay under `ARG_MAX` on large staged
 * sets. Patch fragments from each batch concatenate cleanly because
 * every fragment starts with its own `diff --git` header.
 *
 * Appends a trailing newline when git's stdout doesn't end in one —
 * `git apply` rejects patches without a final newline as "corrupt patch
 * at line N" even with `--recount --unidiff-zero`.
 */
export const capturePatch = async (paths: ReadonlyArray<string>, options: { readonly cwd: string }): Promise<Buffer | null> => {
    if (paths.length === 0) {
        return null;
    }

    const fragments: string[] = [];

    for (let start = 0; start < paths.length; start += PATH_BATCH_SIZE) {
        const batch = paths.slice(start, start + PATH_BATCH_SIZE);
        const { stdout } = await git(
            [
                "diff",
                "--binary",
                "--unified=0",
                "--no-color",
                "--no-ext-diff",
                "--src-prefix=a/",
                "--dst-prefix=b/",
                "--patch",
                "--submodule=short",
                "--",
                ...batch,
            ],
            { cwd: options.cwd },
        );

        if (stdout.length > 0) {
            fragments.push(stdout);
        }
    }

    if (fragments.length === 0) {
        return null;
    }

    const combined = fragments.join("");
    const normalized = combined.endsWith("\n") ? combined : `${combined}\n`;

    return Buffer.from(normalized, "utf8");
};

/**
 * Returns the worktree-relative paths that have both staged and unstaged modifications.
 *
 * `git status --porcelain=v1 -z` uses NUL record separators and splits rename/copy entries
 * across two records: the status+new-path record, then a second record holding the old path.
 * We walk the records, consuming the trailing old-path record for R/C statuses so they
 * don't leak into the next iteration as a malformed status line.
 */
export const getPartiallyStagedFiles = async (cwd: string): Promise<string[]> => {
    const { stdout } = await git(["status", "--porcelain=v1", "-z"], { cwd });
    const records = stdout.split("\u0000");
    const partial: string[] = [];

    for (let i = 0; i < records.length; i += 1) {
        const record = records[i];

        if (record === undefined || record.length < 4) {
            continue;
        }

        const indexState = record.charAt(0);
        const worktreeState = record.charAt(1);
        const path = record.slice(3);

        // Renames and copies use two records: current record holds "<X><Y> <new>", next record holds "<old>".
        const consumesNextRecord = indexState === "R" || indexState === "C" || worktreeState === "R" || worktreeState === "C";

        if (indexState !== " " && indexState !== "?" && worktreeState !== " " && worktreeState !== "?") {
            partial.push(path);
        }

        if (consumesNextRecord) {
            i += 1;
        }
    }

    return partial;
};

/**
 * Restores working-tree content for the given paths from the index.
 * Uses `--pathspec-from-file` with NUL-separated stdin so huge lists
 * don't blow past `ARG_MAX`.
 */
export const checkoutPaths = async (paths: ReadonlyArray<string>, options: { readonly cwd: string }): Promise<void> => {
    if (paths.length === 0) {
        return;
    }

    const pathspec = `${paths.join("\u0000")}\u0000`;

    await git(["checkout", "--force", "--pathspec-from-file=-", "--pathspec-file-nul", "--"], { cwd: options.cwd, input: pathspec });
};

/**
 * Refreshes the index against the working tree. Runs `git update-index --again`
 * first (lint-staged v17 behaviour — improves compatibility when the original
 * commit used a pathspec instead of an explicit `git add`), then falls back
 * to `git add -u` against the originally-staged paths to handle deletions
 * that `update-index --again` can't express.
 */
export const updateIndexAgain = async (paths: ReadonlyArray<string>, options: { readonly cwd: string }): Promise<void> => {
    // --again errors when a tracked path no longer exists on disk; lenient mode lets the deletion fall through to `git add -u` below.
    await git(["update-index", "--again"], { cwd: options.cwd, lenient: true });

    if (paths.length === 0) {
        return;
    }

    const pathspec = `${paths.join("\u0000")}\u0000`;

    await git(["add", "-u", "--pathspec-from-file=-", "--pathspec-file-nul", "--"], { cwd: options.cwd, input: pathspec });
};

export { DEFAULT_DIFF_FILTER };
