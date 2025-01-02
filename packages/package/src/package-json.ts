import { existsSync } from "node:fs";

import type {InstallPackageOptions} from '@antfu/install-pkg';
import { installPackage  } from '@antfu/install-pkg'
import confirm from "@inquirer/confirm";
import type { Theme } from "@inquirer/core";
import type { PartialDeep } from "@inquirer/type";
import type { FindUpOptions, WriteJsonOptions } from "@visulima/fs";
import { findUp, findUpSync, readJson, readJsonSync, writeJson, writeJsonSync } from "@visulima/fs";
import { NotFoundError } from "@visulima/fs/error";
import { parseJson, toPath } from "@visulima/fs/utils";
import { join } from "@visulima/path";
// eslint-disable-next-line import/no-extraneous-dependencies
import { getProperty, hasProperty } from "dot-prop";
import type { Input } from "normalize-package-data";
import normalizeData from "normalize-package-data";
import type { JsonObject, Paths } from "type-fest";

import type { Cache, NormalizedPackageJson, PackageJson } from "./types";
import isNode from "./utils/is-node";

type ReadOptions = {
    cache?: Cache<NormalizedReadResult> | boolean;
};

const PackageJsonFileCache = new Map<string, NormalizedReadResult>();

export type NormalizedReadResult = {
    packageJson: NormalizedPackageJson;
    path: string;
};

/**
 * An asynchronous function to find the package.json file in the specified directory or its parent directories.
 *
 * @param cwd - The current working directory.
 * @returns A `Promise` that resolves to an object containing the parsed package.json data and the file path.
 * The type of the returned promise is `Promise<NormalizedReadResult>`.
 * @throws An `Error` if the package.json file cannot be found.
 */
export const findPackageJson = async (cwd?: URL | string, options: ReadOptions = {}): Promise<NormalizedReadResult> => {
    const findUpConfig: FindUpOptions = {
        type: "file",
    };

    if (cwd) {
        findUpConfig.cwd = cwd;
    }

    const filePath = await findUp("package.json", findUpConfig);

    if (!filePath) {
        throw new NotFoundError("No such file or directory, for package.json found.");
    }

    const cache = options.cache && typeof options.cache !== "boolean" ? options.cache : PackageJsonFileCache;

    if (options.cache && cache.has(filePath)) {
        return cache.get(filePath) as NormalizedReadResult;
    }

    const packageJson = await readJson(filePath);

    normalizeData(packageJson as Input);

    const output = {
        packageJson: packageJson as NormalizedPackageJson,
        path: filePath,
    };

    cache.set(filePath, output);

    return output;
};

export const findPackageJsonSync = (cwd?: URL | string, options: ReadOptions = {}): NormalizedReadResult => {
    const findUpConfig: FindUpOptions = {
        type: "file",
    };

    if (cwd) {
        findUpConfig.cwd = cwd;
    }

    const filePath = findUpSync("package.json", findUpConfig);

    if (!filePath) {
        throw new NotFoundError("No such file or directory, for package.json found.");
    }

    const cache = options.cache && typeof options.cache !== "boolean" ? options.cache : PackageJsonFileCache;

    if (options.cache && cache.has(filePath)) {
        return cache.get(filePath) as NormalizedReadResult;
    }

    const packageJson = readJsonSync(filePath);

    normalizeData(packageJson as Input);

    const output = {
        packageJson: packageJson as NormalizedPackageJson,
        path: filePath,
    };

    cache.set(filePath, output);

    return output;
};

/**
 * An asynchronous function to write the package.json file with the given data.
 *
 * @param data - The package.json data to write. The data is an intersection type of `PackageJson` and a record where keys are `string` and values can be any type.
 * @param options - Optional. The options for writing the package.json. If not provided, an empty object will be used `{}`.
 *                 This is an intersection type of `WriteJsonOptions` and a record with an optional `cwd` key which type is `Options["cwd"]`.
 *                 `cwd` represents the current working directory. If not specified, the default working directory will be used.
 * @returns A `Promise` that resolves once the package.json file has been written. The type of the returned promise is `Promise<void>`.
 */

export const writePackageJson = async <T = PackageJson>(data: T, options: WriteJsonOptions & { cwd?: URL | string } = {}): Promise<void> => {
    const { cwd, ...writeOptions } = options;
    const directory = toPath(options.cwd ?? process.cwd());

    await writeJson(join(directory, "package.json"), data, writeOptions);
};

export const writePackageJsonSync = <T = PackageJson>(data: T, options: WriteJsonOptions & { cwd?: URL | string } = {}): void => {
    const { cwd, ...writeOptions } = options;
    const directory = toPath(options.cwd ?? process.cwd());

    writeJsonSync(join(directory, "package.json"), data, writeOptions);
};

export const parsePackageJson = (packageFile: JsonObject | string): NormalizedPackageJson => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    const isObject = packageFile !== null && typeof packageFile === "object" && !Array.isArray(packageFile);
    const isString = typeof packageFile === "string";

    if (!isObject && !isString) {
        throw new TypeError("`packageFile` should be either an `object` or a `string`.");
    }

    const json = isObject
        ? structuredClone(packageFile)
        : // eslint-disable-next-line security/detect-non-literal-fs-filename
          existsSync(packageFile as string)
          ? readJsonSync(packageFile as string)
          : parseJson(packageFile as string);

    normalizeData(json as Input);

    return json as NormalizedPackageJson;
};

/**
 * An asynchronous function to get the value of a property from the package.json file.
 *
 * @param {NormalizedPackageJson} packageJson
 * @param {Paths<NormalizedPackageJson>} property
 * @param {T} defaultValue
 *
 * @returns {T}
 */
export const getPackageJsonProperty = <T = unknown>(packageJson: NormalizedPackageJson, property: Paths<NormalizedPackageJson>, defaultValue?: T): T =>
    getProperty(packageJson, property, defaultValue) as T;

/**
 * An asynchronous function to check if a property exists in the package.json file.
 *
 * @param {NormalizedPackageJson} packageJson
 * @param {Paths<NormalizedPackageJson>} property
 *
 * @returns {boolean}
 */
export const hasPackageJsonProperty = (packageJson: NormalizedPackageJson, property: Paths<NormalizedPackageJson>): boolean =>
    hasProperty(packageJson, property);

/**
 * An asynchronous function to check if any of the specified dependencies exist in the package.json file.
 *
 * @param {NormalizedPackageJson} packageJson
 * @param {string[]} arguments_
 * @param {{peerDeps?: boolean}} options
 *
 * @returns {boolean}
 */
export const hasPackageJsonAnyDependency = (packageJson: NormalizedPackageJson, arguments_: string[], options?: { peerDeps?: boolean }): boolean => {
    const dependencies = getProperty(packageJson, "dependencies", {});
    const devDependencies = getProperty(packageJson, "devDependencies", {});
    const peerDependencies = getProperty(packageJson, "peerDependencies", {});

    const allDependencies = { ...dependencies, ...devDependencies, ...(options?.peerDeps === false ? {} : peerDependencies) };

    // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
    for (const argument of arguments_) {
        if (hasProperty(allDependencies, argument)) {
            return true;
        }
    }

    return false;
};

/**
 * An asynchronous function to ensure that the specified packages are installed in the package.json file.
 * If the packages are not installed, the user will be prompted to install them.
 * If the user agrees, the packages will be installed.
 * If the user declines, the function will return without installing the packages.
 * If the user does not respond, the function will return without installing the packages.
 *
 * @param {NormalizedPackageJson} packageJson
 * @param {string[]} packages
 * @param {"dependencies" | "devDependencies"} installKey
 * @param {{confirm?: {default?: false | true | undefined, message: string, theme?: PartialDeep<Theme>, cwd?: string | URL | undefined, deps?: false | true | undefined, devDeps?: false | true | undefined, installPackage?: Omit<InstallPackageOptions, "cwd" | "dev"> | undefined, peerDeps?: false | true | undefined}} options
 * @returns {Promise<void>}
 */
export const ensurePackages = async (
    packageJson: NormalizedPackageJson,
    packages: string[],
    installKey: "dependencies" | "devDependencies" = "dependencies",
    options: {
        confirm?: {
            default?: boolean;
            message: string;
            theme?: PartialDeep<Theme>;
            transformer?: (value: boolean) => string;
        };
        cwd?: URL | string;
        deps?: boolean;
        devDeps?: boolean;
        installPackage?: Omit<InstallPackageOptions, "cwd" | "dev">
        peerDeps?: boolean;
    } = {},
): Promise<void> => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (process.env.CI || (isNode && process.stdout?.isTTY === false)) {

        console.warn("Skipping package installation because the process is not interactive.");
        return;
    }

    const dependencies = getProperty(packageJson, "dependencies", {});
    const devDependencies = getProperty(packageJson, "devDependencies", {});
    const peerDependencies = getProperty(packageJson, "peerDependencies", {});

    const nonExistingPackages = [];

    const config = {
        confirm: {},
        deps: true,
        devDeps: true,
        peerDeps: false,
        ...options,
    };

    // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
    for (const packageName of packages) {
        if (
            (config.deps && hasProperty(dependencies, packageName)) ||
            (config.devDeps && hasProperty(devDependencies, packageName)) ||
            (config.peerDeps && hasProperty(peerDependencies, packageName))
        ) {
            // eslint-disable-next-line no-continue
            continue;
        }

        nonExistingPackages.push(packageName);
    }

    const answer = await confirm({
        message: `${nonExistingPackages.length === 1 ? "Package is" : "Packages are"} required for this config: ${nonExistingPackages.join(", ")}. Do you want to install them?`,
        ...config.confirm,
    });

    if (!answer) {
        return;
    }

    await installPackage(nonExistingPackages, {
        ...config.installPackage,
        cwd: config.cwd ? toPath(config.cwd) : undefined,
        dev: installKey === "devDependencies",
    });
};
