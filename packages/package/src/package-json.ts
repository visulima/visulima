import { existsSync } from "node:fs";

import { installPackage } from "@antfu/install-pkg";
import confirm from "@inquirer/confirm";
import type { FindUpOptions, WriteJsonOptions } from "@visulima/fs";
import { findUp, findUpSync, readFile, readFileSync, readJson, readJsonSync, writeJson, writeJsonSync } from "@visulima/fs";
import { NotFoundError } from "@visulima/fs/error";
import { parseJson, toPath } from "@visulima/fs/utils";
import { readYaml, readYamlSync } from "@visulima/fs/yaml";
import { join } from "@visulima/path";
// eslint-disable-next-line import/no-extraneous-dependencies
import { getProperty, hasProperty } from "dot-prop";
import JSON5 from "json5";
import type { Input } from "normalize-package-data";
import normalizeData from "normalize-package-data";
import type { JsonObject, Paths } from "type-fest";

import { readPnpmCatalogs, readPnpmCatalogsSync, resolveCatalogReferences } from "./pnpm";
import type { Cache, EnsurePackagesOptions, NormalizedPackageJson, PackageJson } from "./types";
import isNode from "./utils/is-node";

const PackageJsonParseCache = new Map<string, NormalizedPackageJson>();

type ReadOptions = {
    cache?: FindPackageJsonCache | boolean;
    ignoreWarnings?: (RegExp | string)[];
    json5?: boolean;
    resolveCatalogs?: boolean;
    strict?: boolean;
    yaml?: boolean;
};

const PackageJsonFileCache = new Map<string, NormalizedReadResult>();

class PackageJsonValidationError extends Error {
    public constructor(warnings: string[]) {
        super(`The following warnings were encountered while normalizing package data:\n- ${warnings.join("\n- ")}`);
        this.name = "PackageJsonValidationError";
    }
}

/**
 * Normalizes package.json data with optional strict validation and warning skipping.
 * @param input The package.json data to normalize
 * @param strict Whether to throw errors on normalization warnings
 * @param ignoreWarnings List of warning messages or patterns to skip in strict mode
 * @returns The normalized package.json data
 * @throws {Error} When strict mode is enabled and non-skipped normalization warnings occur
 */
const normalizeInput = (input: Input, strict: boolean, ignoreWarnings: (RegExp | string)[] = []): NormalizedPackageJson => {
    const warnings: string[] = [];

    normalizeData(
        input,
        (message) => {
            warnings.push(message);
        },
        strict,
    );

    if (strict && warnings.length > 0) {
        const filteredWarnings = warnings.filter(
            (warning) =>
                !ignoreWarnings.some((pattern) => {
                    if (pattern instanceof RegExp) {
                        return pattern.test(warning);
                    }

                    return pattern === warning;
                }),
        );

        if (filteredWarnings.length > 0) {
            throw new PackageJsonValidationError(filteredWarnings);
        }
    }

    return input as NormalizedPackageJson;
};

/**
 * Parses a YAML file and returns the parsed data as a JSON object.
 * @param filePath The path to the YAML file
 * @returns The parsed YAML data as a JSON object
 */
const parseYamlFile = async (filePath: string): Promise<JsonObject> => {
    const yamlData = await readYaml(filePath);

    return yamlData as JsonObject;
};

/**
 * Parses a YAML file synchronously and returns the parsed data as a JSON object.
 * @param filePath The path to the YAML file
 * @returns The parsed YAML data as a JSON object
 */
const parseYamlFileSync = (filePath: string): JsonObject => {
    const yamlData = readYamlSync(filePath);

    return yamlData as JsonObject;
};

/**
 * Parses a JSON5 file and returns the parsed data as a JSON object.
 * @param filePath The path to the JSON5 file
 * @returns The parsed JSON5 data as a JSON object
 */
const parseJson5File = async (filePath: string): Promise<JsonObject> => {
    const text = await readFile(filePath);

    return JSON5.parse(text) as JsonObject;
};

/**
 * Parses a JSON5 file synchronously and returns the parsed data as a JSON object.
 * @param filePath The path to the JSON5 file
 * @returns The parsed JSON5 data as a JSON object
 */
const parseJson5FileSync = (filePath: string): JsonObject => {
    const text = readFileSync(filePath);

    return JSON5.parse(text) as JsonObject;
};

/**
 * Parses a package file based on its extension and options.
 * @param filePath The path to the package file
 * @param options Parsing options
 * @param options.json5 Whether to enable package.json5 parsing (default: true)
 * @param options.yaml Whether to enable package.yaml parsing (default: true)
 * @returns The parsed package data as a JSON object
 */
const parsePackageFile = async (filePath: string, options?: { json5?: boolean; yaml?: boolean }): Promise<JsonObject> => {
    // Parse the file based on its extension
    if (options?.yaml !== false && (filePath.endsWith(".yaml") || filePath.endsWith(".yml"))) {
        return parseYamlFile(filePath);
    }

    if (options?.json5 !== false && filePath.endsWith(".json5")) {
        return parseJson5File(filePath);
    }

    return readJson(filePath);
};

/**
 * Parses a package file synchronously based on its extension and options.
 * @param filePath The path to the package file
 * @param options Parsing options
 * @param options.json5 Whether to enable package.json5 parsing (default: true)
 * @param options.yaml Whether to enable package.yaml parsing (default: true)
 * @returns The parsed package data as a JSON object
 */
const parsePackageFileSync = (filePath: string, options?: { json5?: boolean; yaml?: boolean }): JsonObject => {
    // Parse the file based on its extension
    if (options?.yaml !== false && (filePath.endsWith(".yaml") || filePath.endsWith(".yml"))) {
        return parseYamlFileSync(filePath);
    }

    if (options?.json5 !== false && filePath.endsWith(".json5")) {
        return parseJson5FileSync(filePath);
    }

    return readJsonSync(filePath);
};

export type FindPackageJsonCache = Cache<NormalizedReadResult>;

export type NormalizedReadResult = {
    packageJson: NormalizedPackageJson;
    path: string;
};

/**
 * An asynchronous function to find the package.json, package.yaml, or package.json5 file in the specified directory or its parent directories.
 * @param cwd The current working directory.
 * @param options Configuration options including yaml, json5, and resolveCatalogs flags.
 * @returns A `Promise` that resolves to an object containing the parsed package data and the file path.
 * The type of the returned promise is `Promise&lt;NormalizedReadResult>`.
 * @throws {Error} If no package file can be found or if strict mode is enabled and normalize warnings are thrown.
 */
export const findPackageJson = async (cwd?: URL | string, options: ReadOptions = {}): Promise<NormalizedReadResult> => {
    const findUpConfig: FindUpOptions = {
        type: "file",
    };

    if (cwd) {
        findUpConfig.cwd = cwd;
    }

    // Define the search patterns based on enabled options
    const searchPatterns = ["package.json"];

    if (options.yaml !== false) {
        searchPatterns.push("package.yaml", "package.yml");
    }

    if (options.json5 !== false) {
        searchPatterns.push("package.json5");
    }

    let filePath: string | undefined;

    // Search for files in order of preference
    for await (const pattern of searchPatterns) {
        filePath = await findUp(pattern, findUpConfig);

        if (filePath) {
            break;
        }
    }

    if (!filePath) {
        throw new NotFoundError(`No such file or directory, for ${searchPatterns.join(", ").replace(/, ([^,]*)$/, " or $1")} found.`);
    }

    const cache = options.cache && typeof options.cache !== "boolean" ? options.cache : PackageJsonFileCache;

    if (options.cache && cache.has(filePath)) {
        return cache.get(filePath) as NormalizedReadResult;
    }

    // Parse the file based on its extension
    const packageJson = await parsePackageFile(filePath, options);

    // Resolve catalog references if enabled
    if (options.resolveCatalogs) {
        const catalogs = await readPnpmCatalogs(filePath);

        if (catalogs) {
            resolveCatalogReferences(packageJson as JsonObject, catalogs);
        }
    }

    normalizeInput(packageJson as Input, options.strict ?? false, options.ignoreWarnings);

    const output = {
        packageJson: packageJson as NormalizedPackageJson,
        path: filePath,
    };

    if (options.cache) {
        cache.set(filePath, output);
    }

    return output;
};

/**
 * A synchronous function to find the package.json, package.yaml, or package.json5 file in the specified directory or its parent directories.
 * @param cwd The current working directory.
 * @param options Configuration options including yaml, json5, and resolveCatalogs flags.
 * @returns An object containing the parsed package data and the file path.
 * @throws {Error} If no package file can be found or if strict mode is enabled and normalize warnings are thrown.
 */
export const findPackageJsonSync = (cwd?: URL | string, options: ReadOptions = {}): NormalizedReadResult => {
    const findUpConfig: FindUpOptions = {
        type: "file",
    };

    if (cwd) {
        findUpConfig.cwd = cwd;
    }

    // Define the search patterns based on enabled options
    const searchPatterns = ["package.json"];

    if (options.yaml !== false) {
        searchPatterns.push("package.yaml", "package.yml");
    }

    if (options.json5 !== false) {
        searchPatterns.push("package.json5");
    }

    let filePath: string | undefined;

    // Search for files in order of preference
    for (const pattern of searchPatterns) {
        filePath = findUpSync(pattern, findUpConfig);

        if (filePath) {
            break;
        }
    }

    if (!filePath) {
        throw new NotFoundError(`No such file or directory, for ${searchPatterns.join(", ").replace(/, ([^,]*)$/, " or $1")} found.`);
    }

    const cache = options.cache && typeof options.cache !== "boolean" ? options.cache : PackageJsonFileCache;

    if (options.cache && cache.has(filePath)) {
        return cache.get(filePath) as NormalizedReadResult;
    }

    // Parse the file based on its extension
    const packageJson = parsePackageFileSync(filePath, options);

    // Resolve catalog references if enabled
    if (options.resolveCatalogs) {
        const catalogs = readPnpmCatalogsSync(filePath);

        if (catalogs) {
            resolveCatalogReferences(packageJson as JsonObject, catalogs);
        }
    }

    normalizeInput(packageJson as Input, options.strict ?? false, options.ignoreWarnings);

    const output = {
        packageJson: packageJson as NormalizedPackageJson,
        path: filePath,
    };

    if (options.cache) {
        cache.set(filePath, output);
    }

    return output;
};

/**
 * An asynchronous function to write the package.json file with the given data.
 * @param data The package.json data to write. The data is an intersection type of `PackageJson` and a record where keys are `string` and values can be any type.
 * @param options Optional. The options for writing the package.json. If not provided, an empty object will be used `{}`.
 * This is an intersection type of `WriteJsonOptions` and a record with an optional `cwd` key which type is `Options["cwd"]`.
 * `cwd` represents the current working directory. If not specified, the default working directory will be used.
 * @returns A `Promise` that resolves once the package.json file has been written. The type of the returned promise is `Promise&lt;void>`.
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

/**
 * A synchronous function to parse the package.json, package.yaml, or package.json5 file/object/string and return normalize the data.
 * @param packageFile
 * @param options
 * @param options.cache Cache for parsed results (only applies to file paths)
 * @param options.ignoreWarnings List of warning messages or patterns to skip in strict mode
 * @param options.resolveCatalogs Whether to resolve pnpm catalog references
 * @param options.strict Whether to throw errors on normalization warnings
 * @param options.yaml Whether to enable package.yaml parsing (default: true)
 * @param options.json5 Whether to enable package.json5 parsing (default: true)
 * @returns
 * @throws {Error} If the packageFile parameter is not an object or a string or if strict mode is enabled and normalize warnings are thrown.
 */
export const parsePackageJsonSync = (
    packageFile: JsonObject | string,
    options?: {
        cache?: Cache<NormalizedPackageJson> | boolean;
        ignoreWarnings?: (RegExp | string)[];
        json5?: boolean;
        resolveCatalogs?: boolean;
        strict?: boolean;
        yaml?: boolean;
    },
    // eslint-disable-next-line sonarjs/cognitive-complexity
): NormalizedPackageJson => {
    const isObject = packageFile !== null && typeof packageFile === "object" && !Array.isArray(packageFile);
    const isString = typeof packageFile === "string";

    if (!isObject && !isString) {
        throw new TypeError("`packageFile` should be either an `object` or a `string`.");
    }

    let json;
    let isFile = false;
    let filePath: string | undefined;

    if (isObject) {
        json = structuredClone(packageFile);
    } else if (existsSync(packageFile as string)) {
        filePath = packageFile as string;

        // Check cache for file-based parsing
        const cache = options?.cache && typeof options.cache !== "boolean" ? options.cache : PackageJsonParseCache;

        if (options?.cache && cache.has(filePath)) {
            return cache.get(filePath) as NormalizedPackageJson;
        }

        // Parse the file based on its extension
        json = parsePackageFileSync(filePath, options);

        isFile = true;
    } else {
        json = parseJson(packageFile as string);
    }

    // Resolve catalog references if enabled and we have a file path
    if (options?.resolveCatalogs) {
        if (isFile) {
            const catalogs = readPnpmCatalogsSync(packageFile as string);

            if (catalogs) {
                resolveCatalogReferences(json as JsonObject, catalogs);
            }
        } else {
            throw new Error("The 'resolveCatalogs' option can only be used on a file path.");
        }
    }

    normalizeInput(json as Input, options?.strict ?? false, options?.ignoreWarnings);

    const result = json as NormalizedPackageJson;

    // Cache the result for file-based parsing
    if (isFile && filePath && options?.cache) {
        const cache = options.cache && typeof options.cache !== "boolean" ? options.cache : PackageJsonParseCache;

        cache.set(filePath, result);
    }

    return result;
};

/**
 * An asynchronous function to parse the package.json, package.yaml, or package.json5 file/object/string and return normalize the data.
 * @param packageFile
 * @param options
 * @param options.cache Cache for parsed results (only applies to file paths)
 * @param options.ignoreWarnings List of warning messages or patterns to skip in strict mode
 * @param options.strict Whether to throw errors on normalization warnings
 * @param options.resolveCatalogs Whether to resolve pnpm catalog references
 * @param options.yaml Whether to enable package.yaml parsing (default: true)
 * @param options.json5 Whether to enable package.json5 parsing (default: true)
 * @returns
 * @throws {Error} If the packageFile parameter is not an object or a string or if strict mode is enabled and normalize warnings are thrown.
 */
export const parsePackageJson = async (
    packageFile: JsonObject | string,
    options?: {
        cache?: Cache<NormalizedPackageJson> | boolean;
        ignoreWarnings?: (RegExp | string)[];
        json5?: boolean;
        resolveCatalogs?: boolean;
        strict?: boolean;
        yaml?: boolean;
    },
// eslint-disable-next-line sonarjs/cognitive-complexity
): Promise<NormalizedPackageJson> => {
    const isObject = packageFile !== null && typeof packageFile === "object" && !Array.isArray(packageFile);
    const isString = typeof packageFile === "string";

    if (!isObject && !isString) {
        throw new TypeError("`packageFile` should be either an `object` or a `string`.");
    }

    let json;
    let isFile = false;
    let filePath: string | undefined;

    if (isObject) {
        json = structuredClone(packageFile);
    } else if (existsSync(packageFile as string)) {
        filePath = packageFile as string;

        // Check cache for file-based parsing
        const cache = options?.cache && typeof options.cache !== "boolean" ? options.cache : PackageJsonParseCache;

        if (options?.cache && cache.has(filePath)) {
            return cache.get(filePath) as NormalizedPackageJson;
        }

        // Parse the file based on its extension
        json = await parsePackageFile(filePath, options);

        isFile = true;
    } else {
        json = parseJson(packageFile as string);
    }

    // Resolve catalog references if enabled
    if (options?.resolveCatalogs) {
        if (isFile) {
            const catalogs = await readPnpmCatalogs(packageFile as string);

            if (catalogs) {
                resolveCatalogReferences(json as JsonObject, catalogs);
            }
        } else {
            throw new Error("The 'resolveCatalogs' option can only be used on a file path.");
        }
    }

    normalizeInput(json as Input, options?.strict ?? false, options?.ignoreWarnings);

    const result = json as NormalizedPackageJson;

    // Cache the result for file-based parsing
    if (isFile && filePath && options?.cache) {
        const cache = options.cache && typeof options.cache !== "boolean" ? options.cache : PackageJsonParseCache;

        cache.set(filePath, result);
    }

    return result;
};

/**
 * An asynchronous function to get the value of a property from the package.json file.
 * @param packageJson
 * @param property
 * @param defaultValue
 * @returns
 */
export const getPackageJsonProperty = <T = unknown>(packageJson: NormalizedPackageJson, property: Paths<NormalizedPackageJson>, defaultValue?: T): T =>
    getProperty(packageJson, property, defaultValue) as T;

/**
 * An asynchronous function to check if a property exists in the package.json file.
 * @param packageJson
 * @param property
 * @returns
 */
export const hasPackageJsonProperty = (packageJson: NormalizedPackageJson, property: Paths<NormalizedPackageJson>): boolean =>
    hasProperty(packageJson, property);

/**
 * An asynchronous function to check if any of the specified dependencies exist in the package.json file.
 * @param packageJson
 * @param arguments_
 * @param options
 * @param options.peerDeps Whether to include peer dependencies
 * @returns
 */
export const hasPackageJsonAnyDependency = (packageJson: NormalizedPackageJson, arguments_: string[], options?: { peerDeps?: boolean }): boolean => {
    const dependencies = getProperty(packageJson, "dependencies", {});
    const devDependencies = getProperty(packageJson, "devDependencies", {});
    const peerDependencies = getProperty(packageJson, "peerDependencies", {});

    const allDependencies = { ...dependencies, ...devDependencies, ...options?.peerDeps === false ? {} : peerDependencies };

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
 * @param packageJson
 * @param packages
 * @param installKey
 * @param options
 * @param options.deps Whether to include regular dependencies
 * @param options.devDeps Whether to include development dependencies
 * @param options.peerDeps Whether to include peer dependencies
 * @param options.throwOnWarn Whether to throw an error when warnings are logged instead of just logging them
 * @param options.logger Whether to use a custom logger
 * @param options.confirm Whether to use a custom confirmation prompt
 * @param options.installPackage Whether to use a custom installation package
 * @param options.cwd Whether to use a custom current working directory
 * @param options.dev Whether to use a custom installation key
 * @returns
 */
export const ensurePackages = async (
    packageJson: NormalizedPackageJson,
    packages: string[],
    installKey: "dependencies" | "devDependencies" = "dependencies",
    options: EnsurePackagesOptions = {},
    // eslint-disable-next-line sonarjs/cognitive-complexity
): Promise<void> => {
    const dependencies = getProperty(packageJson, "dependencies", {});
    const devDependencies = getProperty(packageJson, "devDependencies", {});
    const peerDependencies = getProperty(packageJson, "peerDependencies", {});

    const nonExistingPackages = [];

    const config = {
        deps: true,
        devDeps: true,
        peerDeps: false,
        ...options,
    } satisfies EnsurePackagesOptions;

    for (const packageName of packages) {
        if (
            (config.deps && hasProperty(dependencies, packageName))
            || (config.devDeps && hasProperty(devDependencies, packageName))
            || (config.peerDeps && hasProperty(peerDependencies, packageName))
        ) {
            continue;
        }

        nonExistingPackages.push(packageName);
    }

    if (nonExistingPackages.length === 0) {
        return;
    }

    if (process.env.CI || (isNode && !process.stdout?.isTTY)) {
        const message = `Skipping package installation for [${packages.join(", ")}] because the process is not interactive.`;

        if (options.throwOnWarn) {
            throw new Error(message);
        } else if (options.logger?.warn) {
            options.logger.warn(message);
        } else {
            // eslint-disable-next-line no-console
            console.warn(message);
        }

        return;
    }

    if (typeof config.confirm?.message === "function") {
        config.confirm.message = config.confirm.message(nonExistingPackages);
    }

    if (config.confirm?.message === undefined) {
        const message = `${nonExistingPackages.length === 1 ? "Package is" : "Packages are"} required for this config: ${nonExistingPackages.join(", ")}. Do you want to install them?`;

        if (config.confirm === undefined) {
            config.confirm = {
                message,
            };
        } else {
            config.confirm.message = message;
        }
    }

    const answer = await confirm(config.confirm as EnsurePackagesOptions["confirm"] & { message: string });

    if (!answer) {
        return;
    }

    await installPackage(nonExistingPackages, {
        ...config.installPackage,
        cwd: config.cwd ? toPath(config.cwd) : undefined,
        dev: installKey === "devDependencies",
    });
};
