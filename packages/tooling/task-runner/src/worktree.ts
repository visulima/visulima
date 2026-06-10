/**
 * Git-worktree detection helpers used by cache-directory resolvers.
 *
 * `git worktree add` creates a sibling checkout that shares the main
 * repository's object database. The linked worktree's `.git` is a *file*
 * (a "gitlink" pointer like `gitdir: /path/to/main/.git/worktrees/feat-x`)
 * rather than a directory. Resolving every linked worktree back to its
 * main checkout lets parallel agents share a single cache directory at
 * the main worktree root instead of rebuilding N times.
 *
 * Detection is performed by the Rust napi binding (memoized in-process).
 * The binding is required, so a build without it hard-fails at load
 * (see {@link loadNativeBindings}) rather than silently degrading here.
 */

import { loadNativeBindings } from "./native-binding";

interface WorktreeBindings {
    getMainWorktreeRoot: (workspaceRoot: string) => string | undefined | null;
    isLinkedWorktree: (workspaceRoot: string) => boolean;
    resetWorktreeCache: () => void;
}

let nativeWorktreeBindings: WorktreeBindings | undefined;
let nativeProbed = false;

const getNativeBindings = (): WorktreeBindings | undefined => {
    if (nativeProbed) {
        return nativeWorktreeBindings;
    }

    nativeProbed = true;

    const bindings = loadNativeBindings();

    if (bindings && typeof bindings.getMainWorktreeRoot === "function" && typeof bindings.isLinkedWorktree === "function") {
        nativeWorktreeBindings = {
            getMainWorktreeRoot: bindings.getMainWorktreeRoot,
            isLinkedWorktree: bindings.isLinkedWorktree,
            resetWorktreeCache: typeof bindings.resetWorktreeCache === "function" ? bindings.resetWorktreeCache : () => {},
        };
    }

    return nativeWorktreeBindings;
};

/**
 * Returns the absolute path to the *main* git worktree root when
 * `workspaceRoot` is a linked worktree, or `undefined` for primary
 * checkouts and non-git directories.
 *
 * Result is memoized (in Rust) for the lifetime of the process — worktree
 * topology does not change at runtime, so the second call is a lookup.
 * @param workspaceRoot Absolute path to the candidate workspace root.
 * @returns The main worktree root, or `undefined` if not a linked worktree.
 */
export const getMainWorktreeRoot = (workspaceRoot: string): string | undefined => {
    const result = getNativeBindings()?.getMainWorktreeRoot(workspaceRoot);

    return typeof result === "string" && result.length > 0 ? result : undefined;
};

/**
 * Returns `true` when `{workspaceRoot}/.git` is a regular file (the gitlink
 * pointer used by `git worktree add`), `false` otherwise.
 * @param workspaceRoot Absolute path to the candidate workspace root.
 */
export const isLinkedWorktree = (workspaceRoot: string): boolean => getNativeBindings()?.isLinkedWorktree(workspaceRoot) ?? false;

/**
 * Clears the in-process detection cache. Tests must call this between
 * scenarios because the cache key is the canonicalized workspace path —
 * recreating a fixture at the same path would otherwise leak stale results.
 */
export const resetWorktreeCache = (): void => {
    getNativeBindings()?.resetWorktreeCache();
};
