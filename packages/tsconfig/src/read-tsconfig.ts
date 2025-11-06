/**
 * A modified version of `readTsconfig` from `https://github.com/privatenumber/get-tsconfig/blob/develop/src/parse-tsconfig/index.ts`
 *
 * MIT License
 * Copyright (c) Hiroki Osame &lt;hiroki.osame@gmail.com>
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

const resolveExtends = (resolvedExtendsPath: string, fromDirectoryPath: string, circularExtendsTracker: Set<string>, options?: Options) => {
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
            compilerOptions.outDir = normalizePath(outDir.replace(`${configDirectoryPlaceholder}/`, "")) || "./";
        }
    }

    for (const property of filesProperties) {
        const filesList = extendsConfig[property];

        if (filesList) {
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
            type WithImplicitBaseUrl = TsConfigJson.CompilerOptions & {
                // eslint-disable-next-line @typescript-eslint/no-use-before-define
                [implicitBaseUrlSymbol]: string;
            };
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            (compilerOptions as WithImplicitBaseUrl)[implicitBaseUrlSymbol] = directoryPath;
        }
    }

    if (config.extends) {
        const extendsPathList = Array.isArray(config.extends) ? config.extends : [config.extends];

        delete config.extends;

        for (const extendsPath of extendsPathList.toReversed()) {
            const resolvedExtendsPath = resolveExtendsPath(extendsPath, directoryPath);

            if (!resolvedExtendsPath) {
                throw new NotFoundError(`No such file or directory, for '${extendsPath}' found.`);
            }

            const extendsConfig = resolveExtends(resolvedExtendsPath, directoryPath, new Set(circularExtendsTracker), options);

            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            if (extendsConfig.compilerOptions?.rootDir !== undefined && !extendsConfig.compilerOptions.rootDir.startsWith(configDirectoryPlaceholder)) {
                extendsConfig.compilerOptions.rootDir = join(dirname(resolvedExtendsPath), extendsConfig.compilerOptions.rootDir);
            }

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

        for (const property of ["baseUrl", "rootDir"] as const) {
            const unresolvedPath = compilerOptions[property];

            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            if (unresolvedPath && !unresolvedPath.startsWith(configDirectoryPlaceholder)) {
                const resolvedBaseUrl = resolve(directoryPath, unresolvedPath);

                compilerOptions[property] = normalizePath(relative(directoryPath, resolvedBaseUrl));
            }
        }

        for (const outputField of ["outDir", "declarationDir"] as const) {
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

                compilerOptions[outputField] = outputPath;
            }
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

    if (config.compilerOptions?.lib) {
        config.compilerOptions.lib = config.compilerOptions.lib.map((library) => library.toLowerCase()) as TsConfigJson.CompilerOptions.Lib[];
    }

    if (config.compilerOptions.module) {
        config.compilerOptions.module = config.compilerOptions.module.toLowerCase() as TsConfigJson.CompilerOptions.Module;
    }

    if (config.compilerOptions.target) {
        config.compilerOptions.target = config.compilerOptions.target.toLowerCase() as TsConfigJson.CompilerOptions.Target;
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

// eslint-disable-next-line sonarjs/cognitive-complexity
const tsCompatibleWrapper = (config: TsConfigJsonResolved, options: Options | undefined): TsConfigJsonResolved => {
    if (config.compilerOptions === undefined) {
        return config;
    }

    if (["5.4", "5.5", "5.6", "5.7", "5.8", "5.9", "true"].includes(String(options?.tscCompatible))) {
        if (
            config.compilerOptions.esModuleInterop === undefined
            && (config.compilerOptions.module === "node16" || config.compilerOptions.module === "nodenext" || config.compilerOptions.module === "preserve")
        ) {
            // eslint-disable-next-line no-param-reassign
            config.compilerOptions.esModuleInterop = true;
        }

        if (
            config?.compilerOptions.moduleDetection === undefined
            && config.compilerOptions.module
            && ["node16", "nodenext"].includes(config.compilerOptions.module)
        ) {
            // eslint-disable-next-line no-param-reassign
            config.compilerOptions.moduleDetection = "force";
        }

        if (config.compilerOptions.moduleResolution === undefined) {
            let moduleResolution: TsConfigJson.CompilerOptions.ModuleResolution = "classic";

            if (config.compilerOptions.module !== undefined) {
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
                    // No default
                }
            }

            if (moduleResolution !== "classic") {
                // eslint-disable-next-line no-param-reassign
                config.compilerOptions.moduleResolution = moduleResolution;
            }
        }

        if (config.compilerOptions.moduleResolution === "bundler") {
            // eslint-disable-next-line no-param-reassign
            config.compilerOptions.resolveJsonModule = true;
        }

        if (
            (config.compilerOptions.esModuleInterop || config.compilerOptions.module === "system" || config.compilerOptions.moduleResolution === "bundler")
            && config.compilerOptions.allowSyntheticDefaultImports === undefined
        ) {
            // eslint-disable-next-line no-param-reassign
            config.compilerOptions.allowSyntheticDefaultImports = true;
        }

        if (["5.7", "5.8", "5.9", "true"].includes(String(options?.tscCompatible)) && config.compilerOptions.moduleResolution) {
            let resolvePackageJson = false;

            if (["bundler", "node16", "nodenext"].includes(config.compilerOptions.moduleResolution.toLocaleLowerCase())) {
                resolvePackageJson = true;
            }

            if (config.compilerOptions.resolvePackageJsonExports === undefined && resolvePackageJson) {
                // eslint-disable-next-line no-param-reassign
                config.compilerOptions.resolvePackageJsonExports = true;
            }

            if (config.compilerOptions.resolvePackageJsonImports === undefined && resolvePackageJson) {
                // eslint-disable-next-line no-param-reassign
                config.compilerOptions.resolvePackageJsonImports = true;
            }
        }

        if (config.compilerOptions.target === undefined) {
            let target: TsConfigJson.CompilerOptions.Target = "es5";

            if (config.compilerOptions.module === "node16") {
                target = "es2022";
            } else if (config.compilerOptions.module === "nodenext") {
                target = "esnext";
            }

            if (target !== "es5") {
                // eslint-disable-next-line no-param-reassign
                config.compilerOptions.target = target;
            }
        }

        if (
            config.compilerOptions.useDefineForClassFields === undefined
            && config.compilerOptions.target
            && (config.compilerOptions.target.includes("es202") || config.compilerOptions.target === "esnext")
        ) {
            // eslint-disable-next-line no-param-reassign
            config.compilerOptions.useDefineForClassFields = true;
        }
    }

    if (
        ["5.6", "5.7", "5.8", "5.9", "true"].includes(String(options?.tscCompatible))
        && config.compilerOptions.strict
        && config.compilerOptions.strictBuiltinIteratorReturn === undefined
    ) {
        // eslint-disable-next-line no-param-reassign
        config.compilerOptions.strictBuiltinIteratorReturn = true;
    }

    if (["5.4", "5.5", "5.6", "5.7", "5.8", "5.9", "true"].includes(String(options?.tscCompatible))) {
        if (config.compilerOptions.strict) {
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
        }

        if (config.compilerOptions.useDefineForClassFields === undefined && config.compilerOptions.target) {
            let useDefineForClassFields = false;

            if (config.compilerOptions.target.includes("es202") || config.compilerOptions.target === "esnext") {
                useDefineForClassFields = true;
            }

            if (useDefineForClassFields) {
                // eslint-disable-next-line no-param-reassign
                config.compilerOptions.useDefineForClassFields = true;
            }
        }

        if (config.compilerOptions.strict && config.compilerOptions.useUnknownInCatchVariables === undefined) {
            // eslint-disable-next-line no-param-reassign
            config.compilerOptions.useUnknownInCatchVariables = true;
        }

        if (config.compilerOptions.isolatedModules) {
            // eslint-disable-next-line no-param-reassign
            config.compilerOptions.preserveConstEnums = config.compilerOptions.preserveConstEnums ?? true;
        }
    }

    if (config.compileOnSave === false) {
        // eslint-disable-next-line no-param-reassign
        delete config.compileOnSave;
    }

    return config;
};

export type Options = {
    /**
     * Make the configuration compatible with the specified TypeScript version.
     *
     * When `true`, it will make the configuration compatible with the latest TypeScript version.
     * @default undefined
     */
    tscCompatible?: "5.3" | "5.4" | "5.5" | "5.6" | true;
};

// eslint-disable-next-line no-template-curly-in-string
export const configDirectoryPlaceholder = "${configDir}";
export const implicitBaseUrlSymbol = Symbol("implicitBaseUrl");

// eslint-disable-next-line sonarjs/cognitive-complexity
export const readTsConfig = (tsconfigPath: string, options?: Options): TsConfigJsonResolved => {
    const resolvedTsconfigPath = resolve(tsconfigPath);

    const config = internalParseTsConfig(resolvedTsconfigPath, options);

    const configDirectory = dirname(resolvedTsconfigPath);

    const { compilerOptions } = config;

    if (compilerOptions) {
        for (const property of compilerFieldsWithConfigDirectory) {
            const value = compilerOptions[property];

            if (value) {
                const resolvedPath = interpolateConfigDirectory(value, configDirectory);

                compilerOptions[property] = resolvedPath ? normalizePath(relative(configDirectory, resolvedPath)) : value;
            }
        }

        for (const property of ["rootDirs", "typeRoots"] as const) {
            const value = compilerOptions[property];

            if (value) {
                compilerOptions[property] = value.map((v) => {
                    const resolvedPath = interpolateConfigDirectory(v, configDirectory);

                    return resolvedPath ? normalizePath(relative(configDirectory, resolvedPath)) : v;
                });
            }
        }

        const { paths } = compilerOptions;

        if (paths) {
            for (const name of Object.keys(paths)) {
                paths[name] = (paths[name] as string[]).map((filePath) => interpolateConfigDirectory(filePath, configDirectory) ?? filePath);
            }
        }

        if (compilerOptions.outDir) {
            compilerOptions.outDir = compilerOptions.outDir.replace(configDirectoryPlaceholder, "");
        }
    }

    for (const property of filesProperties) {
        const value = config[property];

        if (value) {
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

    return tsCompatibleWrapper(config, options);
};
