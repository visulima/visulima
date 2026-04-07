import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

import { findUp, findUpSync } from "@visulima/fs";
import { NotFoundError } from "@visulima/fs/error";
import { dirname, join } from "@visulima/path";

import { parsePackageJson, parsePackageJsonSync } from "./package-json";

const lockFileNames = ["yarn.lock", "package-lock.json", "pnpm-lock.yaml", "npm-shrinkwrap.json", "bun.lockb"];

const packageMangerFindUpMatcher = (directory: string): string | undefined => {
    let lockFile: string | undefined;

    lockFileNames.forEach((lockFileName) => {
        if (!lockFile && existsSync(join(directory, lockFileName))) {
            lockFile = join(directory, lockFileName);
        }
    });

    if (lockFile) {
        return lockFile;
    }

    const packageJsonFilePath = join(directory, "package.json");

    if (existsSync(packageJsonFilePath)) {
        const packageJson = parsePackageJsonSync(readFileSync(packageJsonFilePath, "utf8"));

        if (packageJson.packageManager !== undefined) {
            return packageJsonFilePath;
        }
    }

    return undefined;
};

const findPackageManagerOnFile = async (foundFile: string | undefined): Promise<PackageManagerResult> => {
    if (!foundFile) {
        throw new NotFoundError("Could not find a package manager");
    }

    if (foundFile.endsWith("package.json")) {
        const packageJson = await parsePackageJson(foundFile);

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

const findPackageManagerOnFileSync = (foundFile: string | undefined): PackageManagerResult => {
    if (!foundFile) {
        throw new NotFoundError("Could not find a package manager");
    }

    if (foundFile.endsWith("package.json")) {
        const packageJson = parsePackageJsonSync(foundFile);

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
 * @param cwd Optional. The directory path to start the search from. The type of `cwd` is part of an `Options` type,
 * specifically `URL | string`. Defaults to the current working directory.
 * @returns A `Promise` that resolves with the path of the found lock file.
 * The type of the returned promise is `Promise&lt;string>`.
 * @throws An `Error` if no lock file is found.
 */
export const findLockFile = async (cwd?: URL | string): Promise<string> => {
    const filePath = await findUp(lockFileNames, {
        type: "file",
        ...cwd && { cwd },
    });

    if (!filePath) {
        throw new Error("Could not find lock file");
    }

    return filePath;
};

export const findLockFileSync = (cwd?: URL | string): string => {
    const filePath = findUpSync(lockFileNames, {
        type: "file",
        ...cwd && { cwd },
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
 * @param cwd Optional. The current working directory to start the search from. The type of `cwd` is part of an `Options`
 * type, specifically `URL | string`.
 * @returns A `Promise` that resolves to an object containing the package manager and path.
 * The return type of the function is `Promise&lt;PackageManagerResult>`.
 * @throws An `Error` if no lock file or package.json is found.
 */
export const findPackageManager = async (cwd?: URL | string): Promise<PackageManagerResult> => {
    const foundFile = await findUp(packageMangerFindUpMatcher, {
        ...cwd && { cwd },
    });

    return findPackageManagerOnFile(foundFile);
};

/**
 * An function that finds the package manager used in a project based on the presence of lock files
 * or package.json configuration. If found, it returns the package manager and the path to the lock file or package.json.
 * Throws an error if no lock file or package.json is found.
 * @param cwd Optional. The current working directory to start the search from. The type of `cwd` is part of an `Options`
 * type, specifically `URL | string`.
 * @returns A `Promise` that resolves to an object containing the package manager and path.
 * The return type of the function is `Promise&lt;PackageManagerResult>`.
 * @throws An `Error` if no lock file or package.json is found.
 */

export const findPackageManagerSync = (cwd?: URL | string): PackageManagerResult => {
    const foundFile = findUpSync(packageMangerFindUpMatcher, {
        ...cwd && { cwd },
    });

    return findPackageManagerOnFileSync(foundFile);
};

/**
 * Function that retrieves the version of the specified package manager.
 * @param name The name of the package manager. The type of `name` is `string`.
 * @returns The version of the package manager. The return type of the function is `string`.
 */
// eslint-disable-next-line sonarjs/os-command
export const getPackageManagerVersion = (name: string): string => execSync(`${name} --version`).toString("utf8").trim();

/**
 * An asynchronous function that detects what package manager executes the process.
 *
 * Supports npm, pnpm, Yarn, cnpm, and bun. And also any other package manager that sets the npm_config_user_agent env variable.
 * @returns A `Promise` that resolves to an object containing the name and version of the package manager,
 * or undefined if the package manager information cannot be determined. The return type of the function
 * is `Promise&lt;{ name: PackageManager | "cnpm"; version: string } | undefined>`.
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

/**
 * Function that generates a message to install missing packages.
 * @param packageName The name of the package that requires the missing packages.
 * @param missingPackages An array of missing package names.
 * @param options An object containing optional parameters:
 * @param options.packageManagers An array of package managers to include in the message. Defaults to \["npm", "pnpm", "yarn"\].
 * @param options.postMessage A string to append to the end of the message.
 * @param options.preMessage A string to prepend to the beginning of the message.
 * @returns A string message with instructions to install the missing packages using the specified package managers.
 * @throws An `Error` if no package managers are provided in the options.
 */
export const generateMissingPackagesInstallMessage = (
    packageName: string,
    missingPackages: string[],
    options: {
        packageManagers?: PackageManager[];
        postMessage?: string;
        preMessage?: string;
    },
): string => {
    const s = missingPackages.length === 1 ? "" : "s";

    if (options.packageManagers === undefined) {
        // eslint-disable-next-line no-param-reassign
        options.packageManagers = ["npm", "pnpm", "yarn"];
    }

    if (options.packageManagers.length === 0) {
        throw new Error("No package managers provided, please provide at least one package manager");
    }

    if (missingPackages.length === 0) {
        throw new Error("No missing packages provided, please provide at least one missing package");
    }

    let message = `\n${options.preMessage ?? ""}
${packageName} could not find the following package${s}

  ${missingPackages.join("\n  ")}

To install the missing package${s}, please run the following command:
`;

    const atLatest = (name: string): string => {
        if (!name.split("@").includes("@")) {
            return `${name}@latest`;
        }

        return name;
    };

    const packageManagerCommands = options.packageManagers.map((packageManager) => {
        const missingPackagesString = missingPackages.map((element) => atLatest(element)).join(" ");

        switch (packageManager) {
            case "bun": {
                return `  bun add ${missingPackagesString} -D`;
            }
            case "npm": {
                return `  npm install ${missingPackagesString} --save-dev`;
            }
            case "pnpm": {
                return `  pnpm add ${missingPackagesString} -D`;
            }
            case "yarn": {
                return `  yarn add ${missingPackagesString} --dev`;
            }
            default: {
                throw new Error("Unknown package manager");
            }
        }
    });

    message += packageManagerCommands.join("\n\nor\n\n");

    if (options.postMessage) {
        message += options.postMessage;
    }

    return message;
};
