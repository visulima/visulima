import { execFileSync } from "node:child_process";

import { isAbsolute, relative, resolve } from "@visulima/path";
import { DEFAULT_CACHE_DIRECTORY_NAME } from "@visulima/task-runner";

/**
 * Shared helpers for resolving the task runner's cache directory.
 *
 * Used by `vis run` (to configure the runner) and `vis cache` (to manage the
 * cache from the outside) so both commands agree on:
 *
 * - the resolution order: `--cache-dir` flag > vis.config.ts
 *   `taskRunnerOptions.cacheDirectory` > `{workspaceRoot}/.task-runner-cache`
 * - relative-path normalization against `workspaceRoot`
 * - containment checks (used to decide whether a destructive operation is
 *   safe to perform without confirmation)
 */

/**
 * Resolves the cache directory from CLI options and vis.config.ts.
 *
 * All paths returned from this helper are absolute — relative values are
 * resolved against `workspaceRoot` so they refer to the same directory no
 * matter what `process.cwd()` happens to be when the command runs.
 *
 * Precedence: `optionsCacheDir` > `configCacheDir` > `{workspaceRoot}/{@link DEFAULT_CACHE_DIRECTORY_NAME}`.
 * @param workspaceRoot Absolute path to the workspace root directory.
 * @param optionsCacheDir CLI `--cache-dir` value (may be relative or absolute). Takes highest priority.
 * @param configCacheDir `taskRunnerOptions.cacheDirectory` from vis.config.ts (may be relative or absolute).
 * @returns The resolved absolute path to the cache directory.
 */
const resolveCacheDirectory = (workspaceRoot: string, optionsCacheDir: string | undefined, configCacheDir: string | undefined): string => {
    const normalize = (value: string): string => (isAbsolute(value) ? value : resolve(workspaceRoot, value));

    if (optionsCacheDir && optionsCacheDir.length > 0) {
        return normalize(optionsCacheDir);
    }

    if (configCacheDir && configCacheDir.length > 0) {
        return normalize(configCacheDir);
    }

    return resolve(workspaceRoot, DEFAULT_CACHE_DIRECTORY_NAME);
};

const BRANCH_SLUG_RE = /[^\w.-]+/g;
const LEADING_TRAILING_DASH_RE = /^-+|-+$/g;

/**
 * Converts an arbitrary branch name into a filesystem-safe segment.
 * Strips characters outside `[A-Za-z0-9_.-]`, collapses runs of
 * disallowed characters into a single `-`, and trims leading/trailing
 * dashes. Truncated to 64 chars so deep-nested branch names (`user/long/feat`)
 * stay bounded.
 */
export const sanitizeBranchSegment = (branch: string): string => {
    const slug = branch.trim().replaceAll(BRANCH_SLUG_RE, "-").replaceAll(LEADING_TRAILING_DASH_RE, "");

    return slug.slice(0, 64);
};

/**
 * Detects the current git branch by shelling out to `git rev-parse`.
 * Returns `undefined` on detached HEAD, non-git workspaces, or when
 * git is unavailable — callers fall back to the unscoped cache.
 */
export const detectGitBranch = (cwd: string): string | undefined => {
    try {
        const branch = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
            cwd,
            encoding: "utf8",
            stdio: ["ignore", "pipe", "ignore"],
        }).trim();

        if (!branch || branch === "HEAD") {
            return undefined;
        }

        return branch;
    } catch {
        return undefined;
    }
};

/**
 * Appends a branch-specific subdirectory to `cacheDirectory` when
 * `enabled` is true and a branch can be detected. Keeps `main` and
 * feature branches from thrashing each other's caches — different
 * generated artefacts (schemas, `.d.ts` snapshots) cause oscillating
 * invalidations when the same hash resolves to different contents.
 *
 * When `enabled === false` or the branch can't be detected, returns
 * `cacheDirectory` unchanged. On detached HEAD or CI checkouts where
 * `git rev-parse` resolves `HEAD`, the original path is used — this
 * matches the behaviour of a non-git clone.
 * @param cacheDirectory Resolved base cache directory.
 * @param workspaceRoot Absolute path used to probe the branch.
 * @param enabled When undefined, branch scoping is off. Set to `true`
 * (or omit to keep current behaviour) to enable.
 */
export const applyBranchScope = (cacheDirectory: string, workspaceRoot: string, enabled: boolean | undefined): string => {
    if (enabled !== true) {
        return cacheDirectory;
    }

    const branch = detectGitBranch(workspaceRoot);

    if (!branch) {
        return cacheDirectory;
    }

    const slug = sanitizeBranchSegment(branch);

    if (slug.length === 0) {
        return cacheDirectory;
    }

    return resolve(cacheDirectory, "branches", slug);
};

/**
 * Returns `true` when `cacheDirectory` sits inside `workspaceRoot`. Uses
 * `relative()` instead of `startsWith()` so paths with a common string
 * prefix but different parents (e.g. `/work` vs `/workspace`) are correctly
 * distinguished.
 *
 * Callers use this to decide whether a `rm -rf` on the cache directory is
 * safe without an extra confirmation prompt.
 * @param cacheDirectory Absolute path to the cache directory.
 * @param workspaceRoot Absolute path to the workspace root directory.
 * @returns `true` when `cacheDirectory` is a proper descendant of `workspaceRoot`; `false` otherwise
 * (including when the two paths are identical).
 */
const isCacheDirectoryInsideWorkspace = (cacheDirectory: string, workspaceRoot: string): boolean => {
    const rel = relative(workspaceRoot, cacheDirectory);

    if (rel.length === 0) {
        // Same path — technically "inside" but probably a misconfiguration.
        // Treat as not-inside so the caller pauses to confirm.
        return false;
    }

    // Check for parent traversal: `relative()` emits leading `..` segments
    // when `cacheDirectory` is above `workspaceRoot`. We only reject the exact
    // `".."` component or `"../"` prefix — NOT any name that *starts* with
    // `".."` (e.g. a directory literally named `"..foo"` is fine).
    // `@visulima/path` always uses `"/"` as separator.
    return !(rel === ".." || rel.startsWith("../")) && !isAbsolute(rel);
};

export { isCacheDirectoryInsideWorkspace, resolveCacheDirectory };

export { DEFAULT_CACHE_DIRECTORY_NAME } from "@visulima/task-runner";
