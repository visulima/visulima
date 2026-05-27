/**
 * PATH-enhancement helper that matches the behavior of `npm run`,
 * `pnpm run`, `yarn run`, and similar lifecycle wrappers: every
 * `node_modules/.bin` directory between the working directory and
 * the filesystem root is prepended to PATH so bare binary names
 * (e.g. `eslint`, `vitest`, `packem`) resolve when a `package.json`
 * script is executed outside the package manager.
 *
 * Without this, `vis run build` and friends would spawn a shell that
 * cannot find a workspace-local binary unless the caller happened
 * to have `node_modules/.bin` on PATH already (which is true for
 * `pnpm exec vis run` and false for a bare `vis run`).
 */

import { delimiter, dirname, isAbsolute, join, resolve } from "@visulima/path";

/** Hard cap on how many ancestor directories we will walk. Prevents
 * pathological symlink loops from spinning forever. 64 is well past
 * any realistic monorepo depth.
 */
const MAX_ANCESTOR_WALK = 64;

/**
 * Walks from `cwd` (resolved against `process.cwd()` when relative)
 * up to the filesystem root, returning every `<dir>/node_modules/.bin`
 * path encountered. Ordered nearest-first so the cwd-local `.bin`
 * shadows ancestor `.bin` directories, matching npm/pnpm semantics.
 *
 * The returned paths are not stat-checked — missing directories cost
 * nothing on the PATH and avoiding the syscalls keeps task startup
 * cheap (this runs once per spawned task).
 */
export const collectNodeModulesBinDirs = (cwd: string): string[] => {
    const start = isAbsolute(cwd) ? cwd : resolve(process.cwd(), cwd);
    const dirs: string[] = [];

    let current = start;
    let steps = 0;

    while (steps < MAX_ANCESTOR_WALK) {
        // `join` (rather than string-concat) collapses the double-separator
        // case when `current` is the filesystem root (`/` on POSIX, `C:\`
        // on Windows). Important on Windows where `\\foo` would otherwise
        // start a UNC path.
        dirs.push(join(current, "node_modules", ".bin"));

        const parent = dirname(current);

        if (parent === current) {
            break;
        }

        current = parent;
        steps += 1;
    }

    return dirs;
};

/**
 * Reads PATH from `env` (or `process.env` when `env` omits it),
 * honouring the case-insensitive `Path` alias Windows uses. Returns
 * the empty string when neither is set.
 */
const readPath = (env: NodeJS.ProcessEnv | Record<string, string | undefined> | undefined): string => {
    if (env) {
        const direct = env["PATH"];

        if (direct !== undefined) {
            return direct;
        }

        const windowsAlias = env["Path"];

        if (windowsAlias !== undefined) {
            return windowsAlias;
        }
    }

    return process.env["PATH"] ?? process.env["Path"] ?? "";
};

/**
 * Returns the enhanced PATH string for a child process spawned in
 * `cwd`. The caller's existing PATH (from `existingEnv` or
 * `process.env`) is preserved as the suffix so system binaries still
 * resolve; the workspace's `node_modules/.bin` chain is prepended.
 *
 * Use this when building the `env` you hand to `child_process.spawn`
 * / `exec` / `tinyexec` for commands that come from `package.json`
 * scripts or any other user-authored shell string.
 */
export const buildEnhancedPath = (cwd: string, existingEnv?: NodeJS.ProcessEnv | Record<string, string | undefined>): string => {
    const binDirs = collectNodeModulesBinDirs(cwd);
    const existing = readPath(existingEnv);

    if (binDirs.length === 0) {
        return existing;
    }

    const prefix = binDirs.join(delimiter);

    return existing.length > 0 ? `${prefix}${delimiter}${existing}` : prefix;
};

/**
 * Convenience helper that returns a shallow-cloned `env` with the
 * enhanced PATH applied. Leaves the original object untouched so it
 * remains safe to share across concurrent spawns. The Windows `Path`
 * alias is also rewritten when present to avoid mixed-case clashes
 * where two PATH-shaped keys would otherwise disagree.
 */
export const withEnhancedPath = <T extends NodeJS.ProcessEnv | Record<string, string | undefined>>(env: T, cwd: string): T => {
    const next = { ...env } as Record<string, string | undefined>;

    next["PATH"] = buildEnhancedPath(cwd, env);

    if ("Path" in next && next["Path"] !== undefined) {
        next["Path"] = next["PATH"];
    }

    return next as T;
};
