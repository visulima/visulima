import { existsSync } from "node:fs";

import { findUp, findUpSync, readJsonSync } from "@visulima/fs";
import { dirname, join } from "@visulima/path";

import { findLockFile, findLockFileSync } from "./package-manager";
import type { PackageJson } from "./types";

const packageJsonMatcher = (directory: string): string | undefined => {
    if (existsSync(join(directory, "package.json"))) {
        const packageJson = readJsonSync(join(directory, "package.json")) as PackageJson;

        if (packageJson.name && packageJson.private !== true) {
            return "package.json";
        }
    }

    return undefined;
};

/**
 * An asynchronous function that finds the root directory of a project based on certain lookup criteria.
 * @param cwd Optional. The current working directory to start the search from. The type of `cwd` is `string`.
 * @returns A `Promise` that resolves to the path of the root directory. The type of the returned promise is `Promise&lt;string>`.
 * @throws An `Error` if the root directory could not be found.
 * @example
 * const rootDirectory = await findPackageRoot();
 * console.log(rootDirectory); // '/path/to/project'
 */
export const findPackageRoot = async (cwd?: URL | string): Promise<string> => {
    try {
        const lockFile = await findLockFile(cwd);

        return dirname(lockFile);
    } catch {
        /* empty */
    }

    const gitConfig: string | undefined = await findUp(".git/config", {
        ...(cwd && { cwd }),
        type: "file",
    });

    if (gitConfig) {
        return dirname(dirname(gitConfig));
    }

    const filePath: string | undefined = await findUp(packageJsonMatcher, {
        ...(cwd && { cwd }),
        type: "file",
    });

    if (filePath) {
        return dirname(filePath);
    }

    throw new Error("Could not find root directory");
};

export const findPackageRootSync = (cwd?: URL | string): string => {
    try {
        const lockFile = findLockFileSync(cwd);

        return dirname(lockFile);
    } catch {
        /* empty */
    }

    const gitConfig: string | undefined = findUpSync(".git/config", {
        ...(cwd && { cwd }),
        type: "file",
    });

    if (gitConfig) {
        return dirname(dirname(gitConfig));
    }

    const filePath: string | undefined = findUpSync(packageJsonMatcher, {
        ...(cwd && { cwd }),
        type: "file",
    });

    if (filePath) {
        return dirname(filePath);
    }

    throw new Error("Could not find root directory");
};
