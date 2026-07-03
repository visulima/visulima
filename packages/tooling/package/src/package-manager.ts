import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

import { findUp, findUpSync } from "@visulima/fs";
import { NotFoundError } from "@visulima/fs/error";
import { parseJson } from "@visulima/fs/utils";
import { dirname, join } from "@visulima/path";

const lockFileNames = ["yarn.lock", "package-lock.json", "pnpm-lock.yaml", "npm-shrinkwrap.json", "bun.lock", "bun.lockb"];

const KNOWN_PACKAGE_MANAGERS = new Set<PackageManager>(["bun", "npm", "pnpm", "yarn"]);

/**
 * Reads the `packageManager` field from a package.json file without running the full
 * `normalize-package-data` pass. Returns `undefined` when the field is missing or not a
 * string. Throws a `JSONError` on malformed JSON, matching the previous parse behavior.
 * @param packageJsonFilePath Absolute path to the package.json file.
 * @returns The raw `packageManager` string, or `undefined`.
 */
const readPackageManagerField = (packageJsonFilePath: string): string | undefined => {
    const parsed = parseJson(readFileSync(packageJsonFilePath, "utf8")) as { packageManager?: unknown } | null;

    return typeof parsed?.packageManager === "string" ? parsed.packageManager : undefined;
};

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

    if (existsSync(packageJsonFilePath) && readPackageManagerField(packageJsonFilePath) !== undefined) {
        return packageJsonFilePath;
    }

    return undefined;
};

const resolvePackageManagerFromFile = (foundFile: string | undefined): PackageManagerResult => {
    if (!foundFile) {
        throw new NotFoundError("Could not find a package manager");
    }

    if (foundFile.endsWith("package.json")) {
        const packageManager = readPackageManagerField(foundFile);

        if (packageManager) {
            const packageManagerNames = ["npm", "yarn", "pnpm", "bun"] as const;
            const foundPackageManager = packageManagerNames.find((prefix) => packageManager.startsWith(prefix));

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

    // Both the modern text lockfile (`bun.lock`, Bun v1.1+) and the legacy
    // binary lockfile (`bun.lockb`) identify a bun project.
    if (foundFile.endsWith("bun.lock") || foundFile.endsWith("bun.lockb")) {
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
    const filePath: string | undefined = await findUp(lockFileNames, {
        type: "file",
        ...cwd && { cwd },
    });

    if (!filePath) {
        throw new Error("Could not find lock file");
    }

    return filePath;
};

export const findLockFileSync = (cwd?: URL | string): string => {
    const filePath: string | undefined = findUpSync(lockFileNames, {
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
    const foundFile: string | undefined = await findUp(packageMangerFindUpMatcher, {
        ...cwd && { cwd },
    });

    return resolvePackageManagerFromFile(foundFile);
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
    const foundFile: string | undefined = findUpSync(packageMangerFindUpMatcher, {
        ...cwd && { cwd },
    });

    return resolvePackageManagerFromFile(foundFile);
};

/**
 * Function that retrieves the version of the specified package manager.
 * @param name The name of the package manager. Must be one of the known managers (`npm`, `pnpm`, `yarn`, `bun`).
 * @returns The version of the package manager. The return type of the function is `string`.
 * @throws An `Error` if `name` is not a recognized package manager. This guards against executing an
 * arbitrary or relative-path binary derived from untrusted input.
 */
export const getPackageManagerVersion = (name: string): string => {
    if (!KNOWN_PACKAGE_MANAGERS.has(name as PackageManager)) {
        throw new Error(`Unsupported package manager "${name}". Expected one of: ${[...KNOWN_PACKAGE_MANAGERS].join(", ")}.`);
    }

    return execFileSync(name, ["--version"]).toString("utf8").trim();
};

/**
 * An asynchronous function that detects what package manager executes the process.
 *
 * Supports npm, pnpm, Yarn, cnpm, and bun. And also any other package manager that sets the npm_config_user_agent env variable.
 * @returns An object containing the name and version of the package manager,
 * or undefined if the package manager information cannot be determined.
 */
export const identifyInitiatingPackageManager = ():
    | {
        name: PackageManager | "cnpm" | (string & {});
        version: string;
    }
    | undefined => {
    if (!process.env.npm_config_user_agent) {
        return undefined;
    }

    const pmSpec = process.env.npm_config_user_agent.split(" ")[0] as string;
    const separatorPos = pmSpec.lastIndexOf("/");
    const rawName = pmSpec.slice(0, Math.max(0, separatorPos));

    const name: PackageManager | "cnpm" | (string & {}) = rawName === "npminstall" ? "cnpm" : rawName;

    return {
        name,
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

    const packageManagers = options.packageManagers ?? ["npm", "pnpm", "yarn"];

    if (packageManagers.length === 0) {
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
        const lastAt = name.lastIndexOf("@");

        // lastAt > 0 means a version segment is already present (index 0 is the scope marker for @scope/pkg)
        if (lastAt > 0) {
            return name;
        }

        return `${name}@latest`;
    };

    const packageManagerCommands = packageManagers.map((packageManager) => {
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
