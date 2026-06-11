import { statSync } from "node:fs";

import { findUp, findUpSync } from "@visulima/fs";
import { NotFoundError } from "@visulima/fs/error";

import type { Options as ReadTsConfigOptions } from "./read-tsconfig";
import { readTsConfig } from "./read-tsconfig";
import type { TsConfigJsonResolved } from "./types";

const TsConfigFileCache = new Map<string, TsConfigResult>();

export type Options = ReadTsConfigOptions & {
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
};

export type TsConfigResult = {
    config: TsConfigJsonResolved;
    path: string;
};

const DEFAULT_CONFIG_FILE_NAME = "tsconfig.json";

/**
 * Builds a cache key that includes the file's mtime so a long-lived process
 * (dev server, language tool) does not serve a stale config after the file is
 * edited on disk.
 */
const buildCacheKey = (filePath: string, options: Options): string => {
    let mtimeMs = 0;

    try {
        mtimeMs = statSync(filePath).mtimeMs;
    } catch {
        // If the file disappeared between findUp and stat, fall back to a
        // mtime-less key; the subsequent read will surface the real error.
    }

    return `${filePath}::${String(options.tscCompatible)}::${String(options.typescriptVersion)}::${String(mtimeMs)}`;
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

    if (options.cache && cache.has(cacheKey)) {
        return cache.get(cacheKey) as TsConfigResult;
    }

    const output = {
        config: readTsConfig(filePath, {
            tscCompatible: options.tscCompatible,
            typescriptVersion: options.typescriptVersion,
        }),
        path: filePath,
    };

    if (options.cache) {
        cache.set(cacheKey, output);
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

    if (options.cache && cache.has(cacheKey)) {
        return cache.get(cacheKey) as TsConfigResult;
    }

    const output = {
        config: readTsConfig(filePath, {
            tscCompatible: options.tscCompatible,
            typescriptVersion: options.typescriptVersion,
        }),
        path: filePath,
    };

    if (options.cache) {
        cache.set(cacheKey, output);
    }

    return output;
};
