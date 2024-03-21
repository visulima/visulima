/**
 * A modified version of `parseTsConfig` from `https://github.com/privatenumber/get-tsconfig/blob/develop/src/parse-tsconfig/index.ts`
 *
 * MIT License
 * Copyright (c) Hiroki Osame <hiroki.osame@gmail.com>
 */
import { realpathSync } from "node:fs";

import { readFileSync } from "@visulima/fs";
import { parse } from "jsonc-parser";
import { dirname, join, relative, resolve, toNamespacedPath } from "pathe";
import type { TsConfigJson } from "type-fest";

import type { Cache, TsConfigJsonResolved } from "./types";
import resolveExtendsPath from "./utils/resolve-extends-path";

const implicitBaseUrlSymbol = Symbol("implicitBaseUrl");

const readJsonc = (jsonPath: string) => parse(readFileSync(jsonPath) as string) as unknown;
// eslint-disable-next-line security/detect-unsafe-regex
const normalizePath = (path: string): string => toNamespacedPath(/^\.{1,2}(?:\/.*)?$/.test(path) ? path : `./${path}`);

const resolveExtends = (extendsPath: string, fromDirectoryPath: string, circularExtendsTracker: Set<string>, cache?: Cache<string>) => {
    const resolvedExtendsPath = resolveExtendsPath(extendsPath, fromDirectoryPath, cache);

    if (!resolvedExtendsPath) {
        throw new Error(`File '${extendsPath}' not found.`);
    }

    if (circularExtendsTracker.has(resolvedExtendsPath)) {
        throw new Error(`Circularity detected while resolving configuration: ${resolvedExtendsPath}`);
    }

    circularExtendsTracker.add(resolvedExtendsPath);

    const extendsDirectoryPath = dirname(resolvedExtendsPath);
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    const extendsConfig = internalPparseTsConfig(resolvedExtendsPath, cache, circularExtendsTracker);
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
const internalPparseTsConfig = (tsconfigPath: string, cache?: Cache<string>, circularExtendsTracker = new Set<string>()): TsConfigJsonResolved => {
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
     * Note how `resolveExtends` can call `parseTsConfig` rescursively
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
            const extendsConfig = resolveExtends(extendsPath, directoryPath, new Set(circularExtendsTracker), cache);
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
    } else {
        config.compilerOptions = {};
    }

    if (config.files) {
        config.files = config.files.map((element) => normalizePath(element));
    }

    if (config.include) {
        config.include = config.include.map((element) => normalizePath(element));
    }

    if (config.watchOptions) {
        const { watchOptions } = config;

        if (watchOptions.excludeDirectories) {
            watchOptions.excludeDirectories = watchOptions.excludeDirectories.map((excludePath) => resolve(directoryPath, excludePath));
        }
    }

    return config;
};

const parseTsConfig = (tsconfigPath: string, cache: Cache<string> = new Map()): TsConfigJsonResolved => internalPparseTsConfig(tsconfigPath, cache);

export default parseTsConfig;