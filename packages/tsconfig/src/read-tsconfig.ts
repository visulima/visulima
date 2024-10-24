/**
 * A modified version of `readTsconfig` from `https://github.com/privatenumber/get-tsconfig/blob/develop/src/parse-tsconfig/index.ts`
 *
 * MIT License
 * Copyright (c) Hiroki Osame <hiroki.osame@gmail.com>
 */
import { readFileSync } from "@visulima/fs";
import { NotFoundError } from "@visulima/fs/error";
import { dirname, join, normalize, relative, resolve, toNamespacedPath } from "@visulima/path";
import { parse } from "jsonc-parser";
import type { TsConfigJson } from "type-fest";

import type { TsConfigJsonResolved } from "./types";
import resolveExtendsPath from "./utils/resolve-extends-path";

type Options = {
    tscCompatible?: boolean;
};

const readJsonc = (jsonPath: string) => parse(readFileSync(jsonPath) as string) as unknown;
// eslint-disable-next-line security/detect-unsafe-regex
const normalizePath = (path: string): string => toNamespacedPath(/^\.{1,2}(?:\/.*)?$/.test(path) ? path : `./${path}`);

const filesProperties = ["files", "include", "exclude"] as const;

const resolveExtends = (extendsPath: string, fromDirectoryPath: string, circularExtendsTracker: Set<string>, options?: Options) => {
    const resolvedExtendsPath = resolveExtendsPath(extendsPath, fromDirectoryPath);

    if (!resolvedExtendsPath) {
        throw new NotFoundError(`No such file or directory, for '${extendsPath}' found.`);
    }

    if (circularExtendsTracker.has(resolvedExtendsPath)) {
        throw new Error(`Circularity detected while resolving configuration: ${resolvedExtendsPath}`);
    }

    circularExtendsTracker.add(resolvedExtendsPath);

    const extendsDirectoryPath = dirname(resolvedExtendsPath);
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    const extendsConfig = internalParseTsConfig(resolvedExtendsPath, options, circularExtendsTracker);

    delete extendsConfig.references;

    const { compilerOptions } = extendsConfig;

    if (compilerOptions) {
        const { baseUrl } = compilerOptions;

        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        if (baseUrl && !baseUrl.startsWith(configDirectoryPlaceholder)) {
            compilerOptions.baseUrl = normalizePath(relative(fromDirectoryPath, join(extendsDirectoryPath, baseUrl))) || "./";
        }

        let { outDir } = compilerOptions;

        if (outDir) {
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            if (!outDir.startsWith(configDirectoryPlaceholder)) {
                outDir = relative(fromDirectoryPath, join(extendsDirectoryPath, outDir));
            }

            compilerOptions.outDir = normalizePath(outDir) || "./";
        }
    }

    // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
    for (const property of filesProperties) {
        // eslint-disable-next-line security/detect-object-injection
        const filesList = extendsConfig[property];

        if (filesList) {
            // eslint-disable-next-line security/detect-object-injection
            extendsConfig[property] = filesList.map((file) => {
                // eslint-disable-next-line @typescript-eslint/no-use-before-define
                if (file.startsWith(configDirectoryPlaceholder)) {
                    return file;
                }

                return relative(fromDirectoryPath, join(extendsDirectoryPath, file));
            });
        }
    }

    return extendsConfig;
};

const outputFields = ["outDir", "declarationDir"] as const;

// eslint-disable-next-line sonarjs/cognitive-complexity
const internalParseTsConfig = (tsconfigPath: string, options?: Options, circularExtendsTracker = new Set<string>()): TsConfigJsonResolved => {
    /**
     * Decided not to cache the TsConfigJsonResolved object because it's
     * mutable.
     *
     * Note how `resolveExtends` can call `readTsconfig` rescursively
     * and actually mutates the object. It can also be mutated in
     * user-land.
     *
     * By only caching fs results, we can avoid serving mutated objects
     */
    let config: TsConfigJson;

    try {
        config = readJsonc(tsconfigPath) || {};
    } catch {
        throw new Error(`Cannot resolve tsconfig at path: ${tsconfigPath}`);
    }

    if (typeof config !== "object") {
        throw new SyntaxError(`Failed to parse tsconfig at: ${tsconfigPath}`);
    }

    const directoryPath = dirname(tsconfigPath);

    if (config.compilerOptions) {
        const { compilerOptions } = config;

        if (compilerOptions.paths && !compilerOptions.baseUrl) {
            // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
            type WithImplicitBaseUrl = TsConfigJson.CompilerOptions & {
                // eslint-disable-next-line @typescript-eslint/no-use-before-define
                [implicitBaseUrlSymbol]: string;
            };
            // eslint-disable-next-line security/detect-object-injection,@typescript-eslint/no-use-before-define
            (compilerOptions as WithImplicitBaseUrl)[implicitBaseUrlSymbol] = directoryPath;
        }
    }

    if (config.extends) {
        const extendsPathList = Array.isArray(config.extends) ? config.extends : [config.extends];

        delete config.extends;

        // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
        for (const extendsPath of extendsPathList.reverse()) {
            const extendsConfig = resolveExtends(extendsPath, directoryPath, new Set(circularExtendsTracker), options);
            const merged = {
                ...extendsConfig,
                ...config,

                compilerOptions: {
                    ...extendsConfig.compilerOptions,
                    ...config.compilerOptions,
                },
            };

            if (extendsConfig.watchOptions) {
                merged.watchOptions = {
                    ...extendsConfig.watchOptions,
                    ...config.watchOptions,
                };
            }

            config = merged;
        }
    }

    if (config.compilerOptions) {
        const { compilerOptions } = config;
        const normalizedPaths = ["baseUrl", "rootDir"] as const;

        // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
        for (const property of normalizedPaths) {
            // eslint-disable-next-line security/detect-object-injection
            const unresolvedPath = compilerOptions[property];

            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            if (unresolvedPath && !unresolvedPath.startsWith(configDirectoryPlaceholder)) {
                const resolvedBaseUrl = resolve(directoryPath, unresolvedPath);

                // eslint-disable-next-line security/detect-object-injection
                compilerOptions[property] = relative(directoryPath, resolvedBaseUrl);
            }
        }

        // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
        for (const outputField of outputFields) {
            // eslint-disable-next-line security/detect-object-injection
            let outputPath = compilerOptions[outputField];

            if (outputPath) {
                if (!Array.isArray(config.exclude)) {
                    config.exclude = [];
                }

                if (!config.exclude.includes(outputPath)) {
                    config.exclude.push(outputPath);
                }

                // eslint-disable-next-line @typescript-eslint/no-use-before-define
                if (!outputPath.startsWith(configDirectoryPlaceholder)) {
                    outputPath = normalizePath(outputPath);
                }

                // eslint-disable-next-line security/detect-object-injection
                compilerOptions[outputField] = outputPath;
            }
        }

        if (options?.tscCompatible && compilerOptions.module === "node16") {
            compilerOptions.allowSyntheticDefaultImports = compilerOptions.allowSyntheticDefaultImports ?? true;
            compilerOptions.esModuleInterop = compilerOptions.esModuleInterop ?? true;
            compilerOptions.moduleDetection = compilerOptions.moduleDetection ?? "force";
            compilerOptions.moduleResolution = compilerOptions.moduleResolution ?? "node16";
            compilerOptions.target = compilerOptions.target ?? "es2022";
            compilerOptions.useDefineForClassFields = compilerOptions.useDefineForClassFields ?? true;
        }

        if (options?.tscCompatible && compilerOptions.strict) {
            compilerOptions.noImplicitAny = compilerOptions.noImplicitAny ?? true;
            compilerOptions.noImplicitThis = compilerOptions.noImplicitThis ?? true;
            compilerOptions.strictNullChecks = compilerOptions.strictNullChecks ?? true;
            compilerOptions.strictFunctionTypes = compilerOptions.strictFunctionTypes ?? true;
            compilerOptions.strictBindCallApply = compilerOptions.strictBindCallApply ?? true;
            compilerOptions.strictPropertyInitialization = compilerOptions.strictPropertyInitialization ?? true;
            compilerOptions.alwaysStrict = compilerOptions.alwaysStrict ?? true;
            compilerOptions.useUnknownInCatchVariables = compilerOptions.useUnknownInCatchVariables ?? true;
        }

        if (options?.tscCompatible && compilerOptions.isolatedModules) {
            compilerOptions.preserveConstEnums = compilerOptions.preserveConstEnums ?? true;
        }

        if (options?.tscCompatible && compilerOptions.esModuleInterop) {
            compilerOptions.allowSyntheticDefaultImports = compilerOptions.allowSyntheticDefaultImports ?? true;
        }

        if (options?.tscCompatible && compilerOptions.target === "esnext") {
            compilerOptions.useDefineForClassFields = compilerOptions.useDefineForClassFields ?? true;
        }
    } else {
        config.compilerOptions = {};
    }

    if (config.include) {
        config.include = config.include.map((element) => normalize(element));

        if (config.files) {
            delete config.files;
        }
    } else if (config.files) {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        config.files = config.files.map((file) => (file.startsWith(configDirectoryPlaceholder) ? file : normalizePath(file)));
    }

    if (config.watchOptions) {
        const { watchOptions } = config;

        if (watchOptions.excludeDirectories) {
            watchOptions.excludeDirectories = watchOptions.excludeDirectories.map((excludePath) => resolve(directoryPath, excludePath));
        }
    }

    return config;
};

const interpolateConfigDirectory = (filePath: string, configDirectory: string): string | undefined => {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    if (filePath.startsWith(configDirectoryPlaceholder)) {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        return normalize(join(configDirectory, filePath.slice(configDirectoryPlaceholder.length)));
    }

    return undefined;
};

/**
 * @see https://github.com/microsoft/TypeScript/issues/57485#issuecomment-2027787456
 * exclude paths, as it requires custom processing
 */
const compilerFieldsWithConfigDirectory = ["outDir", "declarationDir", "outFile", "rootDir", "baseUrl", "tsBuildInfoFile"] as const;

// eslint-disable-next-line no-template-curly-in-string,import/no-unused-modules
export const configDirectoryPlaceholder = "${configDir}";
export const implicitBaseUrlSymbol = Symbol("implicitBaseUrl");

export const readTsConfig = (tsconfigPath: string, options?: Options): TsConfigJsonResolved => {
    const resolvedTsconfigPath = resolve(tsconfigPath);

    const config = internalParseTsConfig(resolvedTsconfigPath, options);

    const configDirectory = dirname(resolvedTsconfigPath);

    const { compilerOptions } = config;

    if (compilerOptions) {
        // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
        for (const property of compilerFieldsWithConfigDirectory) {
            // eslint-disable-next-line security/detect-object-injection
            const value = compilerOptions[property];
            if (value) {
                const resolvedPath = interpolateConfigDirectory(value, configDirectory);
                // eslint-disable-next-line security/detect-object-injection
                compilerOptions[property] = resolvedPath ? relative(configDirectory, resolvedPath) : value;
            }
        }

        // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
        for (const property of ["rootDirs", "typeRoots"] as const) {
            // eslint-disable-next-line security/detect-object-injection
            const value = compilerOptions[property];

            if (value) {
                // eslint-disable-next-line security/detect-object-injection
                compilerOptions[property] = value.map((v) => {
                    const resolvedPath = interpolateConfigDirectory(v, configDirectory);
                    return resolvedPath ? relative(configDirectory, resolvedPath) : v;
                });
            }
        }

        const { paths } = compilerOptions;

        if (paths) {
            // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
            for (const name of Object.keys(paths)) {
                // eslint-disable-next-line security/detect-object-injection
                paths[name] = paths[name].map((filePath) => interpolateConfigDirectory(filePath, configDirectory) ?? filePath);
            }
        }
    }

    // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
    for (const property of filesProperties) {
        // eslint-disable-next-line security/detect-object-injection
        const value = config[property];

        if (value) {
            // eslint-disable-next-line security/detect-object-injection
            config[property] = value.map((filePath) => interpolateConfigDirectory(filePath, configDirectory) ?? filePath);
        }
    }

    return config;
};
