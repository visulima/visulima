import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

import { findUp, findUpSync } from "@visulima/fs";
import { NotFoundError } from "@visulima/fs/error";
import { dirname, join } from "@visulima/path";

import { parsePackageJson } from "./package-json";

const lockFileNames = ["yarn.lock", "package-lock.json", "pnpm-lock.yaml", "npm-shrinkwrap.json", "bun.lockb"];

const packageMangerFindUpMatcher = (directory: string) => {
    let lockFile: string | undefined;

    lockFileNames.forEach((lockFileName) => {
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        if (!lockFile && existsSync(join(directory, lockFileName))) {
            lockFile = join(directory, lockFileName);
        }
    });

    if (lockFile) {
        return lockFile;
    }

    const packageJsonFilePath = join(directory, "package.json");
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (existsSync(packageJsonFilePath)) {
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        const packageJson = parsePackageJson(readFileSync(packageJsonFilePath, "utf8"));

        if (packageJson.packageManager !== undefined) {
            return packageJsonFilePath;
        }
    }

    return undefined;
};

const findPackageManagerOnFile = (foundFile: string | undefined): PackageManagerResult => {
    if (!foundFile) {
        throw new NotFoundError("Could not find a package manager");
    }

    if (foundFile.endsWith("package.json")) {
        const packageJson = parsePackageJson(foundFile);

        if (packageJson.packageManager) {
            const packageManagerNames = ["npm", "yarn", "pnpm", "bun"] as const;
            const foundPackageManager = packageManagerNames.find((prefix) => (packageJson.packageManager as string).startsWith(prefix));

            if (foundPackageManager) {
                return {
                    packageManager: foundPackageManager,
                    path: dirname(foundFile),
                };
            }
        }
    }

    if (foundFile.endsWith("yarn.lock")) {
        return {
            packageManager: "yarn",
            path: dirname(foundFile),
        };
    }

    if (foundFile.endsWith("package-lock.json") || foundFile.endsWith("npm-shrinkwrap.json")) {
        return {
            packageManager: "npm",
            path: dirname(foundFile),
        };
    }

    if (foundFile.endsWith("pnpm-lock.yaml")) {
        return {
            packageManager: "pnpm",
            path: dirname(foundFile),
        };
    }

    if (foundFile.endsWith("bun.lockb")) {
        return {
            packageManager: "bun",
            path: dirname(foundFile),
        };
    }

    throw new NotFoundError("Could not find a package manager");
};

/**
 * An asynchronous function that finds a lock file in the specified directory or any of its parent directories.
 *
 * @param cwd - Optional. The directory path to start the search from. The type of `cwd` is part of an `Options` type,
 * specifically `URL | string`. Defaults to the current working directory.
 * @returns A `Promise` that resolves with the path of the found lock file.
 * The type of the returned promise is `Promise<string>`.
 * @throws An `Error` if no lock file is found.
 */
export const findLockFile = async (cwd?: URL | string): Promise<string> => {
    const filePath = await findUp(lockFileNames, {
        type: "file",
        ...(cwd && { cwd }),
    });

    if (!filePath) {
        throw new Error("Could not find lock file");
    }

    return filePath;
};

export const findLockFileSync = (cwd?: URL | string): string => {
    const filePath = findUpSync(lockFileNames, {
        type: "file",
        ...(cwd && { cwd }),
    });

    if (!filePath) {
        throw new Error("Could not find lock file");
    }

    return filePath;
};

export type PackageManager = "bun" | "npm" | "pnpm" | "yarn";

export type PackageManagerResult = {
    packageManager: PackageManager;
    path: string;
};

/**
 * An asynchronous function that finds the package manager used in a project based on the presence of lock files
 * or package.json configuration. If found, it returns the package manager and the path to the lock file or package.json.
 * Throws an error if no lock file or package.json is found.
 *
 * @param cwd - Optional. The current working directory to start the search from. The type of `cwd` is part of an `Options`
 * type, specifically `URL | string`.
 * @returns A `Promise` that resolves to an object containing the package manager and path.
 * The return type of the function is `Promise<PackageManagerResult>`.
 * @throws An `Error` if no lock file or package.json is found.
 */
export const findPackageManager = async (cwd?: URL | string): Promise<PackageManagerResult> => {
    const foundFile = await findUp(packageMangerFindUpMatcher, {
        ...(cwd && { cwd }),
    });

    return findPackageManagerOnFile(foundFile);
};

/**
 * An function that finds the package manager used in a project based on the presence of lock files
 * or package.json configuration. If found, it returns the package manager and the path to the lock file or package.json.
 * Throws an error if no lock file or package.json is found.
 *
 * @param cwd - Optional. The current working directory to start the search from. The type of `cwd` is part of an `Options`
 * type, specifically `URL | string`.
 * @returns A `Promise` that resolves to an object containing the package manager and path.
 * The return type of the function is `Promise<PackageManagerResult>`.
 * @throws An `Error` if no lock file or package.json is found.
 */

export const findPackageManagerSync = (cwd?: URL | string): PackageManagerResult => {
    const foundFile = findUpSync(packageMangerFindUpMatcher, {
        ...(cwd && { cwd }),
    });

    return findPackageManagerOnFile(foundFile);
};

/**
 * Function that retrieves the version of the specified package manager.
 *
 * @param name - The name of the package manager. The type of `name` is `string`.
 * @returns The version of the package manager. The return type of the function is `string`.
 */
export const getPackageManagerVersion = (name: string): string => execSync(`${name} --version`).toString("utf8").trim();

/**
 * An asynchronous function that detects what package manager executes the process.
 *
 * Supports npm, pnpm, Yarn, cnpm, and bun. And also any other package manager that sets the npm_config_user_agent env variable.
 *
 * @returns A `Promise` that resolves to an object containing the name and version of the package manager,
 * or undefined if the package manager information cannot be determined. The return type of the function
 * is `Promise<{ name: PackageManager | "cnpm"; version: string } | undefined>`.
 */
export const identifyInitiatingPackageManager = async (): Promise<
    | {
          name: PackageManager | "cnpm";
          version: string;
      }
    | undefined
> => {
    if (!process.env.npm_config_user_agent) {
        return undefined;
    }

    const pmSpec = process.env.npm_config_user_agent.split(" ")[0] as string;
    const separatorPos = pmSpec.lastIndexOf("/");
    const name = pmSpec.slice(0, Math.max(0, separatorPos));

    return {
        name: name === "npminstall" ? "cnpm" : (name as PackageManager),
        version: pmSpec.slice(Math.max(0, separatorPos + 1)),
    };
};
