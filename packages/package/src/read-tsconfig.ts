/**
 * A modified version of `readTsconfig` from `https://github.com/privatenumber/get-tsconfig/blob/develop/src/parse-tsconfig/index.ts`
 *
 * MIT License
 * Copyright (c) Hiroki Osame <hiroki.osame@gmail.com>
 */
import { realpathSync } from "node:fs";

import { readFileSync } from "@visulima/fs";
import { NotFoundError } from "@visulima/fs/error";
import { parse } from "jsonc-parser";
import { dirname, join, normalize, relative, resolve, toNamespacedPath } from "pathe";
import type { TsConfigJson } from "type-fest";

import type { TsConfigJsonResolved } from "./types";
import resolveExtendsPath from "./utils/resolve-extends-path";

type Options = {
    tscCompatible?: boolean;
};

const implicitBaseUrlSymbol = Symbol("implicitBaseUrl");

const readJsonc = (jsonPath: string) => parse(readFileSync(jsonPath) as string) as unknown;
// eslint-disable-next-line security/detect-unsafe-regex
const normalizePath = (path: string): string => toNamespacedPath(/^\.{1,2}(?:\/.*)?$/.test(path) ? path : `./${path}`);

const resolveExtends = (extendsPath: string, fromDirectoryPath: string, circularExtendsTracker: Set<string>, options?: Options) => {
    const resolvedExtendsPath = resolveExtendsPath(extendsPath, fromDirectoryPath);

    if (!resolvedExtendsPath) {
        throw new NotFoundError(`for '${extendsPath}' found.`);
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
        const resolvePaths = ["baseUrl", "outDir"] as const;

        // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
        for (const property of resolvePaths) {
            // eslint-disable-next-line security/detect-object-injection
            const unresolvedPath = compilerOptions[property];

            if (unresolvedPath) {
                // eslint-disable-next-line security/detect-object-injection
                compilerOptions[property] = relative(fromDirectoryPath, join(extendsDirectoryPath, unresolvedPath)).replaceAll("\\", "/") || "./";
            }
        }
    }

    if (extendsConfig.files) {
        extendsConfig.files = extendsConfig.files.map((file) => relative(fromDirectoryPath, join(extendsDirectoryPath, file)));
    }

    if (extendsConfig.include) {
        extendsConfig.include = extendsConfig.include.map((file) => relative(fromDirectoryPath, join(extendsDirectoryPath, file)));
    }

    if (extendsConfig.exclude) {
        extendsConfig.exclude = extendsConfig.exclude.map((file) => relative(fromDirectoryPath, join(extendsDirectoryPath, file)));
    }

    return extendsConfig;
};

// eslint-disable-next-line sonarjs/cognitive-complexity
const internalParseTsConfig = (tsconfigPath: string, options?: Options, circularExtendsTracker = new Set<string>()): TsConfigJsonResolved => {
    let realTsconfigPath: string;

    try {
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        realTsconfigPath = realpathSync(tsconfigPath) as string;
    } catch {
        throw new Error(`Cannot resolve tsconfig at path: ${tsconfigPath}`);
    }

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
    let config: TsConfigJson = readJsonc(realTsconfigPath) || {};

    if (typeof config !== "object") {
        throw new SyntaxError(`Failed to parse tsconfig at: ${tsconfigPath}`);
    }

    const directoryPath = dirname(realTsconfigPath);

    if (config.compilerOptions) {
        const { compilerOptions } = config;
        if (compilerOptions.paths && !compilerOptions.baseUrl) {
            type WithImplicitBaseUrl = TsConfigJson.CompilerOptions & {
                [implicitBaseUrlSymbol]: string;
            };
            // eslint-disable-next-line security/detect-object-injection
            (compilerOptions as WithImplicitBaseUrl)[implicitBaseUrlSymbol] = directoryPath;
        }
    }

    if (config.extends) {
        const extendsPathList = Array.isArray(config.extends) ? config.extends : [config.extends];

        delete config.extends;

        // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax,etc/no-assign-mutated-array
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

            if (unresolvedPath) {
                const resolvedBaseUrl = resolve(directoryPath, unresolvedPath);
                const relativeBaseUrl = relative(directoryPath, resolvedBaseUrl);

                // eslint-disable-next-line security/detect-object-injection
                compilerOptions[property] = normalizePath(relativeBaseUrl);
            }
        }

        const { outDir } = compilerOptions;

        if (outDir) {
            if (!Array.isArray(config.exclude)) {
                config.exclude = [];
            }

            if (!config.exclude.includes(outDir)) {
                config.exclude.push(outDir);
            }

            compilerOptions.outDir = normalizePath(outDir);
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

    if (config.files) {
        config.files = config.files.map((element) => normalizePath(element));
    }

    if (config.include) {
        config.include = config.include.map((element) => normalize(element));
    }

    if (config.watchOptions) {
        const { watchOptions } = config;

        if (watchOptions.excludeDirectories) {
            watchOptions.excludeDirectories = watchOptions.excludeDirectories.map((excludePath) => resolve(directoryPath, excludePath));
        }
    }

    return config;
};

const readTsConfig = (tsconfigPath: string, options?: Options): TsConfigJsonResolved => internalParseTsConfig(tsconfigPath, options);

export default readTsConfig;
