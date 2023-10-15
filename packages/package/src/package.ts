import { dirname } from "node:path";

import type { Options } from "find-up";
import { findUp } from "find-up";

import { findLockFile } from "./package-manager";

/**
 * An asynchronous function that finds the root directory of a project based on certain lookup criteria.
 *
 * @param cwd - Optional. The current working directory to start the search from. The type of `cwd` is `string`.
 * @returns A `Promise` that resolves to the path of the root directory. The type of the returned promise is `Promise<string>`.
 * @throws An `Error` if the root directory could not be found.
 *
 * @example
 * const rootDirectory = await findPackageRoot();
 * console.log(rootDirectory); // '/path/to/project'
 */
// eslint-disable-next-line import/prefer-default-export
export const findPackageRoot = async (cwd?: Options["cwd"]): Promise<string> => {
    // Lookdown for lockfile
    try {
        const lockFile = await findLockFile(cwd);

        return dirname(lockFile);
    } catch {
        /* empty */
    }

    // Lookup for .git/config
    const gitConfig = await findUp(".git/config", {
        ...(cwd && { cwd }),
        allowSymlinks: false,
        type: "file",
    });

    if (gitConfig) {
        return dirname(dirname(gitConfig));
    }

    // Lookdown for package.json
    const filePath = await findUp("package.json", {
        ...(cwd && { cwd }),
        allowSymlinks: false,
        type: "file",
    });

    if (filePath) {
        return dirname(filePath);
    }

    throw new Error("Could not find root directory");
};
