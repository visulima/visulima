import { homedir, tmpdir } from "node:os";
import { cwd, env, platform } from "node:process";

// eslint-disable-next-line import/no-extraneous-dependencies
import { ensureDir, ensureDirSync, findUp, findUpSync, isAccessible, isAccessibleSync, W_OK } from "@visulima/fs";
// eslint-disable-next-line import/no-extraneous-dependencies
import { NotFoundError } from "@visulima/fs/error";
// eslint-disable-next-line import/no-extraneous-dependencies
import { dirname, join, normalize, sep } from "@visulima/path";

/**
 * A function returned when the `thunk` option is enabled. It joins the given
 * path segments onto the resolved cache directory, so callers can build child
 * paths without re-joining the base directory every time.
 * @example
 * ```ts
 * const thunk = await findCacheDir("my-app", { thunk: true });
 *
 * thunk?.("manifest.json"); // node_modules/.cache/my-app/manifest.json
 * ```
 */
type CacheDirectoryThunk = (...paths: string[]) => string;

/**
 * The resolved value returned by the cache-dir functions: the directory string,
 * a {@link CacheDirectoryThunk} (when `thunk: true`), or `undefined`.
 */
type CacheDirectoryResult = CacheDirectoryThunk | string | undefined;

/**
 * Options accepted by {@link findCacheDir} and {@link findCacheDirSync}.
 */
type Options = {
    /**
     * Create the resolved directory before returning it.
     *
     * The async {@link findCacheDir} uses a non-blocking `ensureDir`; the sync
     * {@link findCacheDirSync} uses `ensureDirSync`.
     * @default false
     */
    create?: boolean;

    /**
     * The directory to start searching for the closest ancestor `package.json` from.
     *
     * Ignored when {@link Options.files} is provided (the common ancestor of the
     * files is used instead) or when the `CACHE_DIR` environment variable is set.
     * @default process.cwd()
     */
    cwd?: URL | string;

    /**
     * A set of files whose closest common ancestor directory is used as the
     * starting point for the `package.json` lookup instead of {@link Options.cwd}.
     *
     * Useful for monorepo tooling that wants the cache next to the workspace
     * package owning the processed files rather than next to `process.cwd()`.
     */
    files?: ReadonlyArray<URL | string>;

    /**
     * Throw a `NotFoundError` (from `@visulima/fs/error`) when no ancestor
     * `package.json` can be found, instead of returning `undefined`.
     *
     * Note: when {@link Options.useGlobalCacheFallback} is enabled the global
     * fallback is returned before this is consulted, so it never throws.
     * @default false
     */
    throwError?: boolean;

    /**
     * Return a {@link CacheDirectoryThunk} that joins arbitrary path segments onto
     * the resolved cache directory instead of returning the directory string itself.
     *
     * Mirrors `sindresorhus/find-cache-dir`'s `thunk` option. Returns `undefined`
     * when no cache directory could be resolved.
     * @default false
     */
    thunk?: boolean;

    /**
     * Fall back to the OS user cache directory (honouring `$XDG_CACHE_HOME` on
     * Linux) when no writable `node_modules` exists — e.g. read-only installs,
     * globally installed tools, or CI images.
     *
     * When enabled the function never returns `undefined` for a missing or
     * unwritable `node_modules`; it returns the OS user cache path instead.
     * @default false
     */
    useGlobalCacheFallback?: boolean;
};

/**
 * Async signature of {@link findCacheDir}, with a precise return type for the
 * `thunk` option.
 */
type FindCacheDirectory = {
    (name: string, options: Options & { thunk: true }): Promise<CacheDirectoryThunk | undefined>;
    (name: string, options?: Options): Promise<string | undefined>;
};

/**
 * Sync signature of {@link findCacheDirSync}, with a precise return type for the
 * `thunk` option.
 */
type FindCacheDirectorySync = {
    (name: string, options: Options & { thunk: true }): CacheDirectoryThunk | undefined;
    (name: string, options?: Options): string | undefined;
};

const toPath = (urlOrPath: URL | string): string => {
    if (urlOrPath instanceof URL) {
        return new URL(urlOrPath).pathname;
    }

    return urlOrPath;
};

/**
 * Resolve the OS-level user cache directory used by the `useGlobalCacheFallback`
 * option. Honours `$XDG_CACHE_HOME` on Linux and the conventional locations on
 * macOS/Windows, falling back to the OS temp dir when no home directory exists.
 */
const globalCacheDirectory = (name: string): string => {
    const home = homedir();

    if (platform === "win32") {
        const base = env.LOCALAPPDATA ?? (home ? join(home, "AppData", "Local") : tmpdir());

        return join(base, name, "Cache");
    }

    if (platform === "darwin") {
        const base = home ? join(home, "Library", "Caches") : tmpdir();

        return join(base, name);
    }

    // Linux and other Unix-like platforms: follow the XDG Base Directory spec.
    const base = env.XDG_CACHE_HOME ?? (home ? join(home, ".cache") : tmpdir());

    return join(base, name);
};

/**
 * Compute the closest common ancestor directory of a set of files/directories.
 * Used to honour the `files` option.
 */
const commonAncestor = (paths: ReadonlyArray<URL | string>): string | undefined => {
    if (paths.length === 0) {
        return undefined;
    }

    const segmentLists = paths.map((value) => normalize(toPath(value)).split(sep));

    let shortestLength = Number.POSITIVE_INFINITY;

    for (const list of segmentLists) {
        if (list.length < shortestLength) {
            shortestLength = list.length;
        }
    }

    const result: string[] = [];

    for (let index = 0; index < shortestLength; index += 1) {
        const segment = (segmentLists[0] as string[])[index];

        if (segmentLists.every((list) => list[index] === segment)) {
            result.push(segment as string);
        } else {
            break;
        }
    }

    const ancestor = result.join(sep);

    return ancestor === "" ? sep : ancestor;
};

/**
 * Build the thunk/string return value for a resolved cache directory.
 */
// eslint-disable-next-line sonarjs/function-return-type
const finalize = (directory: string | undefined, thunk: boolean | undefined): CacheDirectoryResult => {
    if (directory === undefined) {
        return undefined;
    }

    if (thunk) {
        return (...paths: string[]): string => join(directory, ...paths);
    }

    return directory;
};

// eslint-disable-next-line sonarjs/function-return-type
const resolveStartDirectory = (options?: Options): URL | string => {
    if (options?.files && options.files.length > 0) {
        const ancestor = commonAncestor(options.files);

        if (ancestor !== undefined) {
            return ancestor;
        }
    }

    return options?.cwd ?? cwd();
};

const cacheDirectoryError = (start: URL | string): NotFoundError => new NotFoundError(`No package.json found searching upwards from '${toPath(start)}'.`);

/**
 * Returns true when `directory` exists on disk but is not writable. A
 * non-existent directory is considered writable (it can be created later).
 */
const existsButUnwritable = async (directory: string): Promise<boolean> => {
    const writable = await isAccessible(directory, W_OK);

    if (writable) {
        return false;
    }

    return isAccessible(directory);
};

const existsButUnwritableSync = (directory: string): boolean => !isAccessibleSync(directory, W_OK) && isAccessibleSync(directory);

/**
 * Returns true when any directory in the chain exists but is not writable,
 * short-circuiting on the first match.
 */
const anyExistsButUnwritable = async (directories: string[]): Promise<boolean> => {
    for (const directory of directories) {
        // eslint-disable-next-line no-await-in-loop
        if (await existsButUnwritable(directory)) {
            return true;
        }
    }

    return false;
};

// eslint-disable-next-line sonarjs/cognitive-complexity
const findCacheDirectory = async (name: string, options?: Options): Promise<CacheDirectoryResult> => {
    if (env.CACHE_DIR && !["0", "1", "false", "true"].includes(env.CACHE_DIR)) {
        const directory = join(env.CACHE_DIR, name);

        if (options?.create) {
            await ensureDir(directory);
        }

        return finalize(directory, options?.thunk);
    }

    const start = resolveStartDirectory(options);

    const rootDirectory = await findUp("package.json", {
        cwd: start,
        type: "file",
    });

    if (!rootDirectory) {
        if (options?.useGlobalCacheFallback) {
            const directory = globalCacheDirectory(name);

            if (options.create) {
                await ensureDir(directory);
            }

            return finalize(directory, options.thunk);
        }

        if (options?.throwError) {
            throw cacheDirectoryError(start);
        }

        return undefined;
    }

    const nodeModulesDirectory = join(dirname(rootDirectory), "node_modules");
    const cacheDirectory = join(nodeModulesDirectory, ".cache");
    const cacheNameDirectory = join(cacheDirectory, name);

    // Hot path: if the final target already exists and is writable, return it
    // immediately. This is the by-far common warm-cache case and avoids the
    // extra stat calls on the parent directories below. It also fixes the edge
    // case where a writable existing `<name>` dir was previously rejected
    // because a parent had lost the W_OK bit.
    if (await isAccessible(cacheNameDirectory, W_OK)) {
        if (options?.create) {
            await ensureDir(cacheNameDirectory);
        }

        return finalize(cacheNameDirectory, options?.thunk);
    }

    // If any existing segment in the chain is not writable, the cache cannot be
    // created/used — return undefined (or the global fallback when requested).
    const unwritable = await anyExistsButUnwritable([cacheNameDirectory, cacheDirectory, nodeModulesDirectory]);

    if (unwritable) {
        if (options?.useGlobalCacheFallback) {
            const directory = globalCacheDirectory(name);

            if (options.create) {
                await ensureDir(directory);
            }

            return finalize(directory, options.thunk);
        }

        return undefined;
    }

    if (options?.create) {
        await ensureDir(cacheNameDirectory);
    }

    return finalize(cacheNameDirectory, options?.thunk);
};

// eslint-disable-next-line sonarjs/cognitive-complexity
const findCacheDirectorySync = (name: string, options?: Options): CacheDirectoryResult => {
    if (env.CACHE_DIR && !["0", "1", "false", "true"].includes(env.CACHE_DIR)) {
        const directory = join(env.CACHE_DIR, name);

        if (options?.create) {
            ensureDirSync(directory);
        }

        return finalize(directory, options?.thunk);
    }

    const start = resolveStartDirectory(options);

    const rootDirectory = findUpSync("package.json", {
        cwd: start,
        type: "file",
    });

    if (!rootDirectory) {
        if (options?.useGlobalCacheFallback) {
            const directory = globalCacheDirectory(name);

            if (options.create) {
                ensureDirSync(directory);
            }

            return finalize(directory, options.thunk);
        }

        if (options?.throwError) {
            throw cacheDirectoryError(start);
        }

        return undefined;
    }

    const nodeModulesDirectory = join(dirname(rootDirectory), "node_modules");
    const cacheDirectory = join(nodeModulesDirectory, ".cache");
    const cacheNameDirectory = join(cacheDirectory, name);

    // Hot path: see the async implementation for rationale.
    if (isAccessibleSync(cacheNameDirectory, W_OK)) {
        if (options?.create) {
            ensureDirSync(cacheNameDirectory);
        }

        return finalize(cacheNameDirectory, options?.thunk);
    }

    const unwritable = existsButUnwritableSync(cacheNameDirectory) || existsButUnwritableSync(cacheDirectory) || existsButUnwritableSync(nodeModulesDirectory);

    if (unwritable) {
        if (options?.useGlobalCacheFallback) {
            const directory = globalCacheDirectory(name);

            if (options.create) {
                ensureDirSync(directory);
            }

            return finalize(directory, options.thunk);
        }

        return undefined;
    }

    if (options?.create) {
        ensureDirSync(cacheNameDirectory);
    }

    return finalize(cacheNameDirectory, options?.thunk);
};

/**
 * Find a writable cache directory for a named tool, mirroring the conventional
 * `node_modules/.cache` layout (a `name` subdirectory is appended).
 *
 * Lookup order:
 *
 * 1. If `process.env.CACHE_DIR` is set (and not `"0"`/`"1"`/`"false"`/`"true"`),
 * use `${CACHE_DIR}` joined with the name.
 * 2. Otherwise walk up from {@link Options.cwd} (or the common ancestor of
 * {@link Options.files}) to the closest `package.json`, then resolve the
 * conventional cache directory next to it.
 * 3. If the cache directory exists and is writable it is returned. If any
 * existing segment in the chain is not writable, `undefined` is returned
 * (unless {@link Options.useGlobalCacheFallback} is set).
 *
 * The `name` argument must not contain path separators — it is joined as a
 * single segment.
 * @param name The cache directory name. Should match your `package.json` name.
 * @param options See {@link Options}.
 * @returns The resolved cache directory, a {@link CacheDirectoryThunk} when
 * `thunk: true`, or `undefined` when no writable directory could be resolved.
 * @example
 * ```ts
 * const cacheDir = await findCacheDir("my-app");
 * ```
 */
// eslint-disable-next-line unicorn/prevent-abbreviations
const findCacheDir: FindCacheDirectory = findCacheDirectory as FindCacheDirectory;

/**
 * Synchronous variant of {@link findCacheDir}. See {@link findCacheDir} for the
 * lookup order and option semantics. With `create: true` it runs `ensureDirSync`.
 * @param name The cache directory name. Should match your `package.json` name.
 * @param options See {@link Options}.
 * @returns The resolved cache directory, a {@link CacheDirectoryThunk} when
 * `thunk: true`, or `undefined` when no writable directory could be resolved.
 */
// eslint-disable-next-line unicorn/prevent-abbreviations
const findCacheDirSync: FindCacheDirectorySync = findCacheDirectorySync as FindCacheDirectorySync;

export type { CacheDirectoryThunk, Options as FindCacheDirectoryOptions, Options };
export { findCacheDir, findCacheDirSync };
