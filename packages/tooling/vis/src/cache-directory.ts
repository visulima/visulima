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
