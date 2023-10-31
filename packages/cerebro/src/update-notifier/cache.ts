import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import findCacheDirectory from "find-cache-dir";

const FILE_NAME = "last-update-check.json";

/**
 * Retrieves the configuration file path for the given package name.
 *
 * @param {string} packageName - The name of the package.
 * @throws {Error} - If the cache directory cannot be found.
 * @returns {string} - The absolute path to the configuration file.
 */
const getConfigFile = (packageName: string): string => {
    const cacheDirectory = findCacheDirectory({ name: packageName });

    if (cacheDirectory === undefined) {
        throw new Error("Could not find cache directory");
    }

    return join(cacheDirectory, FILE_NAME);
};

/**
 * Retrieves the last update check timestamp for the specified package.
 *
 * @param {string} packageName - The name of the package.
 * @returns {number | undefined} - The timestamp of the last update check, or undefined if the check failed.
 */
export const getLastUpdate = (packageName: string): undefined | number => {
    const configFile = getConfigFile(packageName);

    try {
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        if (!existsSync(configFile)) {
            return undefined;
        }

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        const { lastUpdateCheck } = JSON.parse(readFileSync(configFile, "utf8")) as { lastUpdateCheck: number };

        return lastUpdateCheck as number;
    } catch {
        return undefined;
    }
};

/**
 * Saves the last update time for a given package.
 *
 * @param {string} packageName - The name of the package.
 * @returns {void}
 */
export const saveLastUpdate = (packageName: string): void => {
    const configFile = getConfigFile(packageName);
    const configDir = dirname(configFile);

    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (!existsSync(configDir)) {
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        mkdirSync(configDir, { recursive: true });
    }

    // eslint-disable-next-line security/detect-non-literal-fs-filename
    writeFileSync(configFile, JSON.stringify({ lastUpdateCheck: Date.now() }));
};
