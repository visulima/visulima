import { access, mkdir, readFile, writeFile } from "node:fs/promises";

import { findCacheDirSync } from "@visulima/find-cache-dir";
// eslint-disable-next-line import/no-extraneous-dependencies
import { dirname, join } from "@visulima/path";

import UpdateNotifierError from "../../errors/update-notifier-error";
import type { CerebroFs } from "../../types/runtime";

const FILE_NAME = "last-update-check.json";

/**
 * Default {@link CerebroFs} adapter backed by `node:fs/promises`.
 *
 * Used when the update-notifier runs outside the toolbox (e.g. its own unit
 * tests); the plugin itself passes `toolbox.fs` so MCP / sandboxed runtimes can
 * swap the filesystem.
 */
const defaultFs: Pick<CerebroFs, "access" | "mkdir" | "readFile" | "writeFile"> = {
    access: (path, mode) => access(path, mode),
    mkdir: (path, options) => mkdir(path, options),
    readFile: (async (path: string, encoding?: BufferEncoding) => {
        if (encoding === undefined) {
            return readFile(path);
        }

        return readFile(path, encoding);
    }) as CerebroFs["readFile"],
    writeFile: (path, data, encoding) => writeFile(path, data, encoding),
};

/**
 * Existence check expressed against the injectable {@link CerebroFs} adapter
 * (which has no sync `existsSync`).
 * @param fs The filesystem adapter to probe with.
 * @param path The absolute path to check.
 * @returns `true` when the path is accessible, `false` otherwise.
 */
const existsViaFs = async (fs: Pick<CerebroFs, "access">, path: string): Promise<boolean> => {
    try {
        await fs.access(path);

        return true;
    } catch {
        return false;
    }
};

/**
 * Retrieves the configuration file path for the given package name.
 * @param packageName
 * @throws {Error} - If the cache directory cannot be found.
 * @returns - The absolute path to the configuration file.
 */
const getConfigFile = (packageName: string): string => {
    const cacheDirectory = findCacheDirSync(packageName);

    if (cacheDirectory === undefined) {
        throw new UpdateNotifierError("Could not find cache directory", "CACHE_DIRECTORY_NOT_FOUND", { packageName });
    }

    return join(cacheDirectory, FILE_NAME);
};

/**
 * Retrieves the last update check timestamp for the specified package.
 * @param packageName
 * @param fs Filesystem adapter (defaults to a `node:fs/promises` wrapper).
 * @returns - The timestamp of the last update check, or undefined if the check failed.
 */
export const getLastUpdate = async (packageName: string, fs: Pick<CerebroFs, "access" | "readFile"> = defaultFs): Promise<number | undefined> => {
    const configFile = getConfigFile(packageName);

    try {
        const exists = await existsViaFs(fs, configFile);

        if (!exists) {
            return undefined;
        }

        const { lastUpdateCheck } = JSON.parse(await fs.readFile(configFile, "utf8")) as { lastUpdateCheck: number };

        return lastUpdateCheck;
    } catch {
        return undefined;
    }
};

/**
 * Saves the last update time for a given package.
 * @param packageName
 * @param fs Filesystem adapter (defaults to a `node:fs/promises` wrapper).
 */
export const saveLastUpdate = async (packageName: string, fs: Pick<CerebroFs, "access" | "mkdir" | "writeFile"> = defaultFs): Promise<void> => {
    const configFile = getConfigFile(packageName);
    const configDirectory = dirname(configFile);
    const directoryExists = await existsViaFs(fs, configDirectory);

    if (!directoryExists) {
        await fs.mkdir(configDirectory, { recursive: true });
    }

    await fs.writeFile(configFile, JSON.stringify({ lastUpdateCheck: Date.now() }), "utf8");
};
