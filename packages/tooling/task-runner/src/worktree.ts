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
 * Detection prefers the Rust napi binding (memoized in-process) and
 * falls back to a pure-Node implementation with the same semantics when
 * the native addon is unavailable (development without `pnpm build:native`,
 * unsupported platform, etc.).
 */

import { execFileSync } from "node:child_process";
import { realpathSync, statSync } from "node:fs";

import { dirname, isAbsolute, resolve } from "@visulima/path";

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

const fallbackCache = new Map<string, string | undefined>();

const canonicalize = (path: string): string => {
    try {
        return realpathSync(path);
    } catch {
        return path;
    }
};

const fallbackIsLinkedWorktree = (workspaceRoot: string): boolean => {
    try {
        const stat = statSync(resolve(workspaceRoot, ".git"));

        return stat.isFile();
    } catch {
        return false;
    }
};

const fallbackGetMainWorktreeRoot = (workspaceRoot: string): string | undefined => {
    const canonicalRoot = canonicalize(workspaceRoot);

    if (fallbackCache.has(canonicalRoot)) {
        return fallbackCache.get(canonicalRoot);
    }

    let result: string | undefined;

    try {
        if (fallbackIsLinkedWorktree(canonicalRoot)) {
            const stdout = execFileSync("git", ["rev-parse", "--git-common-dir"], {
                cwd: canonicalRoot,
                encoding: "utf8",
                stdio: ["ignore", "pipe", "ignore"],
            }).trim();

            if (stdout.length > 0) {
                const commonDir = isAbsolute(stdout) ? stdout : resolve(canonicalRoot, stdout);
                const mainRoot = canonicalize(dirname(commonDir));

                result = mainRoot === canonicalRoot ? undefined : mainRoot;
            }
        } else {
            result = undefined;
        }
    } catch {
        result = undefined;
    }

    fallbackCache.set(canonicalRoot, result);

    return result;
};

/**
 * Returns the absolute path to the *main* git worktree root when
 * `workspaceRoot` is a linked worktree, or `undefined` for primary
 * checkouts and non-git directories.
 *
 * Result is memoized for the lifetime of the process — worktree topology
 * does not change at runtime, so the second call is a hash lookup.
 *
 * Detection logic:
 * 1. If `{workspaceRoot}/.git` is a *directory*, this is a primary checkout
 *    (or vanilla repo). Returns `undefined`.
 * 2. If `{workspaceRoot}/.git` is a *file* (gitlink), resolves to the parent
 *    of `git rev-parse --git-common-dir` — that is the main worktree root.
 * 3. On any error (missing git binary, shallow CI checkout, etc.), returns
 *    `undefined` so the caller falls back to the workspace-local cache.
 * @param workspaceRoot Absolute path to the candidate workspace root.
 * @returns The main worktree root, or `undefined` if not a linked worktree.
 */
export const getMainWorktreeRoot = (workspaceRoot: string): string | undefined => {
    const native = getNativeBindings();

    if (native) {
        const result = native.getMainWorktreeRoot(workspaceRoot);

        return typeof result === "string" && result.length > 0 ? result : undefined;
    }

    return fallbackGetMainWorktreeRoot(workspaceRoot);
};

/**
 * Returns `true` when `{workspaceRoot}/.git` is a regular file (the gitlink
 * pointer used by `git worktree add`), `false` otherwise. Cheap pre-flight
 * before invoking `git rev-parse`.
 * @param workspaceRoot Absolute path to the candidate workspace root.
 */
export const isLinkedWorktree = (workspaceRoot: string): boolean => {
    const native = getNativeBindings();

    if (native) {
        return native.isLinkedWorktree(workspaceRoot);
    }

    return fallbackIsLinkedWorktree(workspaceRoot);
};

/**
 * Clears the in-process detection cache. Tests must call this between
 * scenarios because the cache key is the canonicalized workspace path —
 * recreating a fixture at the same path would otherwise leak stale results.
 */
export const resetWorktreeCache = (): void => {
    fallbackCache.clear();

    const native = getNativeBindings();

    if (native) {
        native.resetWorktreeCache();
    }
};
