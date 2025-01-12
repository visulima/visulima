/**
 * A modified version of `readTsconfig` from `https://github.com/privatenumber/get-tsconfig/blob/develop/src/parse-tsconfig/index.ts`
 *
 * MIT License
 * Copyright (c) Hiroki Osame <hiroki.osame@gmail.com>
 */
import { readFileSync } from "@visulima/fs";
import { NotFoundError } from "@visulima/fs/error";
import { dirname, isAbsolute, join, normalize, relative, resolve, toNamespacedPath } from "@visulima/path";
import { isRelative } from "@visulima/path/utils";
import { parse } from "jsonc-parser";
import type { TsConfigJson } from "type-fest";

import type { TsConfigJsonResolved } from "./types";
import resolveExtendsPath from "./utils/resolve-extends-path";

const readJsonc = (jsonPath: string) => parse(readFileSync(jsonPath, { buffer: false })) as unknown;

const normalizePath = (path: string): string => {
    const namespacedPath = toNamespacedPath(path);

    return isRelative(namespacedPath) ? namespacedPath : `./${namespacedPath}`;
};

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
            compilerOptions.baseUrl = normalize(relative(fromDirectoryPath, join(extendsDirectoryPath, baseUrl))) || "./";
        }

        let { outDir } = compilerOptions;

        if (outDir) {
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            if (!outDir.startsWith(configDirectoryPlaceholder)) {
                outDir = relative(fromDirectoryPath, join(extendsDirectoryPath, outDir));
            }

            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            compilerOptions.outDir = normalizePath(outDir.replace(configDirectoryPlaceholder + "/", "")) || "./";
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

                if (isAbsolute(file)) {
                    return file;
                }

                return relative(fromDirectoryPath, join(extendsDirectoryPath, file));
            });
        }
    }

    return extendsConfig;
};

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

        // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
        for (const property of ["baseUrl", "rootDir"] as const) {
            // eslint-disable-next-line security/detect-object-injection
            const unresolvedPath = compilerOptions[property];

            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            if (unresolvedPath && !unresolvedPath.startsWith(configDirectoryPlaceholder)) {
                const resolvedBaseUrl = resolve(directoryPath, unresolvedPath);

                // eslint-disable-next-line security/detect-object-injection
                compilerOptions[property] = normalizePath(relative(directoryPath, resolvedBaseUrl));
            }
        }

        // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
        for (const outputField of ["outDir", "declarationDir"] as const) {
            // eslint-disable-next-line security/detect-object-injection
            let outputPath = compilerOptions[outputField];

            if (outputPath) {
                if (!Array.isArray(config.exclude)) {
                    config.exclude = [];
                }

                let excludePath = outputPath;

                if (!isAbsolute(excludePath)) {
                    excludePath = join(directoryPath, excludePath);
                }

                // eslint-disable-next-line @typescript-eslint/no-use-before-define
                excludePath = excludePath.replace(configDirectoryPlaceholder, "");

                if (!config.exclude.includes(excludePath)) {
                    config.exclude.push(excludePath);
                }

                // eslint-disable-next-line @typescript-eslint/no-use-before-define
                if (!outputPath.startsWith(configDirectoryPlaceholder)) {
                    outputPath = normalizePath(outputPath);
                }

                // eslint-disable-next-line security/detect-object-injection
                compilerOptions[outputField] = outputPath;
            }
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

const tsCompatibleWrapper = (config: TsConfigJsonResolved, options: Options): TsConfigJsonResolved => {
    if (config.compilerOptions === undefined) {
        return config;
    }

    if (config.compilerOptions.module === "node16" && ["5.4", "5.5", "5.6", "5.7", "true"].includes(String(options.tscCompatible))) {
        // eslint-disable-next-line no-param-reassign
        config.compilerOptions.allowSyntheticDefaultImports = config.compilerOptions.allowSyntheticDefaultImports ?? true;

        // eslint-disable-next-line no-param-reassign
        config.compilerOptions.esModuleInterop =
            config.compilerOptions.module === "node16" || config.compilerOptions.module === "nodenext" || config.compilerOptions.module === "perserve"
                ? (config.compilerOptions.esModuleInterop ?? true)
                : (config.compilerOptions.esModuleInterop ?? false);

        // eslint-disable-next-line no-param-reassign
        config.compilerOptions.moduleDetection =
            config?.compilerOptions.moduleDetection ?? (["node16", "nodenext"].includes(config.compilerOptions.module) ? "force" : "auto");

        let moduleResolution: TsConfigJson.CompilerOptions.ModuleResolution = "classic";

        // eslint-disable-next-line default-case
        switch ((config.compilerOptions?.module as TsConfigJson.CompilerOptions.Module).toLocaleLowerCase()) {
            case "commonjs": {
                moduleResolution = "node10";
                break;
            }
            case "node16": {
                moduleResolution = "node16";
                break;
            }
            case "nodenext": {
                moduleResolution = "nodenext";
                break;
            }
            case "preserve": {
                moduleResolution = "bundler";
                break;
            }
        }

        // eslint-disable-next-line no-param-reassign
        config.compilerOptions.moduleResolution = moduleResolution;

        if (["5.7"].includes(String(options.tscCompatible))) {
            let resolvePackageJson = false;

            if (
                config.compilerOptions.moduleResolution === "node16" ||
                config.compilerOptions.moduleResolution === "nodenext" ||
                config.compilerOptions.moduleResolution === "bundler"
            ) {
                resolvePackageJson = true;
            }

            // eslint-disable-next-line no-param-reassign
            config.compilerOptions.resolvePackageJsonExports = config.compilerOptions.resolvePackageJsonExports ?? resolvePackageJson;
            // eslint-disable-next-line no-param-reassign
            config.compilerOptions.resolvePackageJsonImports = config.compilerOptions.resolvePackageJsonImports ?? resolvePackageJson;
        }

        let target: TsConfigJson.CompilerOptions.Target = "es5";

        if (config.compilerOptions.module === "node16") {
            target = "es2022";
        } else if (config.compilerOptions.module === "nodenext") {
            target = "esnext";
        }

        // eslint-disable-next-line no-param-reassign
        config.compilerOptions.target = target;
        // eslint-disable-next-line no-param-reassign
        config.compilerOptions.useDefineForClassFields = config.compilerOptions.useDefineForClassFields ?? (config.compilerOptions.target.includes("es202") || config.compilerOptions.target === "esnext");
    }

    if (config.compilerOptions.strict) {
        if (["5.6", "5.7", "true"].includes(String(options.tscCompatible))) {
            // eslint-disable-next-line no-param-reassign
            config.compilerOptions.strictBuiltinIteratorReturn = config.compilerOptions.strictBuiltinIteratorReturn ?? true;
        }

        if (["5.4", "5.5", "5.6", "5.7", "true"].includes(String(options.tscCompatible))) {
            // eslint-disable-next-line no-param-reassign
            config.compilerOptions.noImplicitAny = config.compilerOptions.noImplicitAny ?? true;
            // eslint-disable-next-line no-param-reassign
            config.compilerOptions.noImplicitThis = config.compilerOptions.noImplicitThis ?? true;
            // eslint-disable-next-line no-param-reassign
            config.compilerOptions.strictNullChecks = config.compilerOptions.strictNullChecks ?? true;
            // eslint-disable-next-line no-param-reassign
            config.compilerOptions.strictFunctionTypes = config.compilerOptions.strictFunctionTypes ?? true;
            // eslint-disable-next-line no-param-reassign
            config.compilerOptions.strictBindCallApply = config.compilerOptions.strictBindCallApply ?? true;
            // eslint-disable-next-line no-param-reassign
            config.compilerOptions.strictPropertyInitialization = config.compilerOptions.strictPropertyInitialization ?? true;
            // eslint-disable-next-line no-param-reassign
            config.compilerOptions.alwaysStrict = config.compilerOptions.alwaysStrict ?? true;
            // eslint-disable-next-line no-param-reassign
            config.compilerOptions.useUnknownInCatchVariables = config.compilerOptions.useUnknownInCatchVariables ?? true;
        }
    }

    return config;
};

export type Options = {
    /**
     * Make the configuration compatible with the specified TypeScript version.
     *
     * When `true`, it will make the configuration compatible with the latest TypeScript version.
     *
     * @default false
     */
    tscCompatible?: "5.3" | "5.4" | "5.5" | "5.6" | true;
};

// eslint-disable-next-line no-template-curly-in-string,import/no-unused-modules
export const configDirectoryPlaceholder = "${configDir}";
export const implicitBaseUrlSymbol = Symbol("implicitBaseUrl");

// eslint-disable-next-line sonarjs/cognitive-complexity
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
                compilerOptions[property] = resolvedPath ? normalizePath(relative(configDirectory, resolvedPath)) : value;
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

                    return resolvedPath ? normalizePath(relative(configDirectory, resolvedPath)) : v;
                });
            }
        }

        const { paths } = compilerOptions;

        if (paths) {
            // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
            for (const name of Object.keys(paths)) {
                // eslint-disable-next-line security/detect-object-injection
                paths[name] = (paths[name] as string[]).map((filePath) => interpolateConfigDirectory(filePath, configDirectory) ?? filePath);
            }
        }

        if (compilerOptions.outDir) {
            compilerOptions.outDir = compilerOptions.outDir.replace(configDirectoryPlaceholder, "");
        }
    }

    // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
    for (const property of filesProperties) {
        // eslint-disable-next-line security/detect-object-injection
        const value = config[property];

        if (value) {
            // eslint-disable-next-line security/detect-object-injection
            config[property] = value.map((filePath) => {
                const interpolate = interpolateConfigDirectory(filePath, configDirectory);

                if (interpolate) {
                    return interpolate;
                }

                if (property === "files" && isRelative(filePath)) {
                    return filePath;
                }

                if (property === "include" && isRelative(filePath)) {
                    return join(configDirectory, filePath);
                }

                return normalize(filePath);
            });
        }
    }

    if (options?.tscCompatible) {
        tsCompatibleWrapper(config, options);
    }

    return config;
};
