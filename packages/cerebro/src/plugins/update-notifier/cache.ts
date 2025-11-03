import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { findCacheDirSync } from "@visulima/find-cache-dir";
// eslint-disable-next-line import/no-extraneous-dependencies
import { dirname, join } from "@visulima/path";

const FILE_NAME = "last-update-check.json";

/**
 * Retrieves the configuration file path for the given package name.
 * @param packageName
 * @throws {Error} - If the cache directory cannot be found.
 * @returns - The absolute path to the configuration file.
 */
const getConfigFile = (packageName: string): string => {
    const cacheDirectory = findCacheDirSync(packageName);

    if (cacheDirectory === undefined) {
        throw new Error("Could not find cache directory");
    }

    return join(cacheDirectory, FILE_NAME);
};

/**
 * Retrieves the last update check timestamp for the specified package.
 * @param packageName
 * @returns - The timestamp of the last update check, or undefined if the check failed.
 */
export const getLastUpdate = (packageName: string): number | undefined => {
    const configFile = getConfigFile(packageName);

    try {
        if (!existsSync(configFile)) {
            return undefined;
        }

        const { lastUpdateCheck } = JSON.parse(readFileSync(configFile, "utf8")) as { lastUpdateCheck: number };

        return lastUpdateCheck as number;
    } catch {
        return undefined;
    }
};

/**
 * Saves the last update time for a given package.
 * @param packageName
 */
export const saveLastUpdate = (packageName: string): void => {
    const configFile = getConfigFile(packageName);
    const configDirectory = dirname(configFile);

    if (!existsSync(configDirectory)) {
        mkdirSync(configDirectory, { recursive: true });
    }

    writeFileSync(configFile, JSON.stringify({ lastUpdateCheck: Date.now() }));
};
