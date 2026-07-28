import { statSync } from "node:fs";

import { findUp, findUpSync } from "@visulima/fs";
import { NotFoundError } from "@visulima/fs/error";
import { dirname } from "@visulima/path";

import type { Options as ReadTsConfigOptions } from "./read-tsconfig";
import { readTsConfig } from "./read-tsconfig";
import type { TsConfigJsonResolved } from "./types";
import { detectTypeScriptVersion } from "./utils/typescript-version";

const TsConfigFileCache = new Map<string, TsConfigResult>();

/**
 * Tracks the on-disk mtime each cached entry was computed for, per cache map.
 * Keyed by the cache map instance so a caller-owned cache keeps its own mtimes
 * without changing the public `Map&lt;string, TsConfigResult>` value shape.
 */
const cacheMtimes = new WeakMap<Map<string, TsConfigResult>, Map<string, number>>();

// eslint-disable-next-line import/exports-last -- Options is consumed by function signatures throughout this file; keep its declaration co-located with the types it composes
export type Options = {
    /**
     * Cache parsed configs across calls.
     * - `true` — use a process-wide shared cache.
     * - `Map` — use a caller-owned cache (useful for scoping / clearing).
     *
     * Cache keys embed the file's last-modified time, so editing a tsconfig
     * on disk transparently invalidates its cached entry.
     */
    cache?: Map<string, TsConfigResult> | boolean;

    /**
     * Name of the config file to search for. Defaults to `"tsconfig.json"`.
     *
     * The fallback to `jsconfig.json` only applies when this is left at the
     * default — supplying a custom name searches for that name only.
     */
    configFileName?: string;
} & ReadTsConfigOptions;

// eslint-disable-next-line import/exports-last -- TsConfigResult is referenced earlier (TsConfigFileCache, Options) and by function signatures; keep its declaration here
export type TsConfigResult = {
    config: TsConfigJsonResolved;
    path: string;
};

const DEFAULT_CONFIG_FILE_NAME = "tsconfig.json";

const getMtimeMs = (filePath: string): number => {
    try {
        return statSync(filePath).mtimeMs;
    } catch {
        // If the file disappeared between findUp and stat, fall back to 0; the
        // subsequent read will surface the real error.
        return 0;
    }
};

/**
 * Builds a stable cache key that does *not* embed the file's mtime — mtime
 * invalidation is tracked out-of-band in {@link cacheMtimes} so an edited config
 * overwrites its entry in place instead of leaking a new one on every save.
 *
 * For `typescriptVersion: 'auto'` the detected TypeScript version is resolved
 * into the key so upgrading the installed TypeScript (which leaves the tsconfig
 * mtime untouched) is not masked by a stale cache entry.
 */
const buildCacheKey = (filePath: string, options: Options): string => {
    let versionKey = String(options.typescriptVersion);

    if (options.typescriptVersion === "auto") {
        versionKey = `auto:${String(detectTypeScriptVersion(dirname(filePath)))}`;
    }

    return `${filePath}::${String(options.tscCompatible)}::${versionKey}`;
};

/**
 * Returns the cached entry when present *and* still matching the file's current
 * mtime; otherwise `undefined` so the caller recomputes and overwrites it.
 */
const readFromCache = (cache: Map<string, TsConfigResult>, cacheKey: string, filePath: string): TsConfigResult | undefined => {
    if (!cache.has(cacheKey)) {
        return undefined;
    }

    if (cacheMtimes.get(cache)?.get(cacheKey) === getMtimeMs(filePath)) {
        return cache.get(cacheKey);
    }

    return undefined;
};

/**
 * Stores (or overwrites in place) the entry and records the mtime it was
 * computed for, keeping the cache bounded regardless of how often the file
 * changes on disk.
 */
const writeToCache = (cache: Map<string, TsConfigResult>, cacheKey: string, filePath: string, output: TsConfigResult): void => {
    cache.set(cacheKey, output);

    let mtimes = cacheMtimes.get(cache);

    if (!mtimes) {
        mtimes = new Map<string, number>();
        cacheMtimes.set(cache, mtimes);
    }

    mtimes.set(cacheKey, getMtimeMs(filePath));
};

/**
 * An asynchronous function that retrieves the TSConfig by searching for the "tsconfig.json" first,
 * second attempt is to look for the "jsconfig.json" file from a given current working directory.
 *
 * Note: only the upward file search is asynchronous. Parsing (and the whole
 * `extends` chain) is performed synchronously via {@link readTsConfig}, so a
 * very deep `extends` chain will block the event loop during parse.
 * @param cwd Optional. The current working directory from which to search for the "tsconfig.json" file.
 * The type of `cwd` is `string`.
 * @returns A `Promise` that resolves to the TSConfig result object.
 * The return type of the function is `Promise&lt;TsConfigResult>`.
 * @throws An `Error` when the "tsconfig.json" file is not found.
 */
export const findTsConfig = async (cwd?: URL | string, options: Options = {}): Promise<TsConfigResult> => {
    const configFileName = options.configFileName ?? DEFAULT_CONFIG_FILE_NAME;
    const allowJsConfigFallback = options.configFileName === undefined;

    let filePath: string | undefined = await findUp(configFileName, {
        ...cwd && { cwd },
        type: "file",
    });

    if (!filePath && allowJsConfigFallback) {
        filePath = await findUp("jsconfig.json", {
            ...cwd && { cwd },
            type: "file",
        });
    }

    if (!filePath) {
        throw new NotFoundError(
            allowJsConfigFallback
                ? `No such file or directory, for '${configFileName}' or 'jsconfig.json' found.`
                : `No such file or directory, for '${configFileName}' found.`,
        );
    }

    const cache = options.cache && typeof options.cache !== "boolean" ? options.cache : TsConfigFileCache;
    const cacheKey = buildCacheKey(filePath, options);

    if (options.cache) {
        const cached = readFromCache(cache, cacheKey, filePath);

        if (cached) {
            return cached;
        }
    }

    const output = {
        config: readTsConfig(filePath, {
            tscCompatible: options.tscCompatible,
            typescriptVersion: options.typescriptVersion,
        }),
        path: filePath,
    };

    if (options.cache) {
        writeToCache(cache, cacheKey, filePath, output);
    }

    return output;
};

export const findTsConfigSync = (cwd?: URL | string, options: Options = {}): TsConfigResult => {
    const configFileName = options.configFileName ?? DEFAULT_CONFIG_FILE_NAME;
    const allowJsConfigFallback = options.configFileName === undefined;

    let filePath: string | undefined = findUpSync(configFileName, {
        ...cwd && { cwd },
        type: "file",
    });

    if (!filePath && allowJsConfigFallback) {
        filePath = findUpSync("jsconfig.json", {
            ...cwd && { cwd },
            type: "file",
        });
    }

    if (!filePath) {
        throw new NotFoundError(
            allowJsConfigFallback
                ? `No such file or directory, for '${configFileName}' or 'jsconfig.json' found.`
                : `No such file or directory, for '${configFileName}' found.`,
        );
    }

    const cache = options.cache && typeof options.cache !== "boolean" ? options.cache : TsConfigFileCache;
    const cacheKey = buildCacheKey(filePath, options);

    if (options.cache) {
        const cached = readFromCache(cache, cacheKey, filePath);

        if (cached) {
            return cached;
        }
    }

    const output = {
        config: readTsConfig(filePath, {
            tscCompatible: options.tscCompatible,
            typescriptVersion: options.typescriptVersion,
        }),
        path: filePath,
    };

    if (options.cache) {
        writeToCache(cache, cacheKey, filePath, output);
    }

    return output;
};
