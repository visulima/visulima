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

import type { Cache, TsConfigJsonResolved } from "./types";
import resolveExtendsPath from "./utils/resolve-extends-path";
import { detectTypeScriptVersion } from "./utils/typescript-version";
import { applyVersionDefaults } from "./version-defaults";

const readJsonc = (jsonPath: string): unknown => parse(readFileSync(jsonPath, { buffer: false }));

/** Converts backslashes to forward slashes without resolving ../ segments. */
const slash = (path: string): string => path.replaceAll("\\", "/");

const normalizePath = (path: string): string => {
    const namespacedPath = toNamespacedPath(path);

    return isRelative(namespacedPath) ? namespacedPath : `./${namespacedPath}`;
};

const filesProperties = ["files", "include", "exclude"] as const;

/**
 * Resolves a path from extended config to canonical form relative to parent config.
 *
 * TypeScript normalizes these paths: nested/../. → .
 * Used for: baseUrl, outDir, rootDir, declarationDir.
 */
const resolveAndRelativize = (fromDirectoryPath: string, extendsDirectoryPath: string, filePath: string): string => {
    const absolutePath = join(extendsDirectoryPath, filePath);
    const relativePath = relative(fromDirectoryPath, absolutePath);

    return normalize(relativePath) || "./";
};

/**
 * Prefixes a pattern with relative directory path without normalization.
 *
 * TypeScript literally prefixes: nested/../. stays as nested/../.
 * Used for: files, include, exclude patterns.
 */
const prefixPattern = (fromDirectoryPath: string, extendsDirectoryPath: string, pattern: string): string => {
    const relativeDirectory = relative(fromDirectoryPath, extendsDirectoryPath);

    if (!relativeDirectory) {
        return pattern;
    }

    // Remove leading ./ from pattern to avoid double prefix like ./some-dir/./file.ts
    const cleanPattern = pattern.startsWith("./") ? pattern.slice(2) : pattern;

    // Do NOT normalize — TypeScript preserves literal ../  in patterns
    return `${relativeDirectory}/${cleanPattern}`;
};

const resolveExtends = (
    resolvedExtendsPath: string,
    fromDirectoryPath: string,
    circularExtendsTracker: Set<string>,
    options?: Options,
    resolveExtendsCache?: Cache<string>,
) => {
    if (circularExtendsTracker.has(resolvedExtendsPath)) {
        throw new Error(`Circularity detected while resolving configuration: ${resolvedExtendsPath}`);
    }

    circularExtendsTracker.add(resolvedExtendsPath);

    const extendsDirectoryPath = dirname(resolvedExtendsPath);
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    const extendsConfig = internalParseTsConfig(resolvedExtendsPath, options, circularExtendsTracker, resolveExtendsCache);

    delete extendsConfig.references;

    const { compilerOptions } = extendsConfig;

    if (compilerOptions) {
        // eslint-disable-next-line sonarjs/deprecation -- `baseUrl` is deprecated in TS 5+ but we must still support it for backward compatibility
        const { baseUrl } = compilerOptions;

        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        if (baseUrl && !baseUrl.startsWith(configDirectoryPlaceholder)) {
            // eslint-disable-next-line sonarjs/deprecation -- see note above
            compilerOptions.baseUrl = resolveAndRelativize(fromDirectoryPath, extendsDirectoryPath, baseUrl);
        }

        const { outDir } = compilerOptions;

        if (
            outDir // eslint-disable-next-line @typescript-eslint/no-use-before-define
            && !outDir.startsWith(configDirectoryPlaceholder)
        ) {
            compilerOptions.outDir = resolveAndRelativize(fromDirectoryPath, extendsDirectoryPath, outDir);
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

                return prefixPattern(fromDirectoryPath, extendsDirectoryPath, file);
            });
        }
    }

    return extendsConfig;
};

const internalParseTsConfig = (
    tsconfigPath: string,
    options?: Options,
    circularExtendsTracker = new Set<string>(),
    resolveExtendsCache: Cache<string> = new Map<string, string>(),
    // eslint-disable-next-line sonarjs/cognitive-complexity -- load-bearing tsconfig parser tested for parity against the live TypeScript compiler; refactoring risks behavioral drift
): TsConfigJsonResolved => {
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
        const parsed = readJsonc(tsconfigPath);

        config = parsed ?? {};
    } catch (error) {
        // Preserve the original failure (ENOENT, EACCES, read error, …) so the
        // caller can tell *why* the tsconfig could not be resolved.
        throw new Error(`Cannot resolve tsconfig at path: ${tsconfigPath}`, { cause: error });
    }

    if (typeof config !== "object") {
        throw new SyntaxError(`Failed to parse tsconfig at: ${tsconfigPath}`);
    }

    const directoryPath = dirname(tsconfigPath);

    if (config.compilerOptions) {
        const { compilerOptions } = config;

        // eslint-disable-next-line sonarjs/deprecation -- `baseUrl` is deprecated in TS 5+ but we must still support it for backward compatibility
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

        const reversedExtends = extendsPathList.toReversed();

        // eslint-disable-next-line unicorn/no-for-loop,no-plusplus -- index-based loop preferred for array performance
        for (let index = 0; index < reversedExtends.length; index++) {
            const extendsPath = reversedExtends[index] as string;
            const resolvedExtendsPath = resolveExtendsPath(extendsPath, directoryPath, resolveExtendsCache);

            if (!resolvedExtendsPath) {
                throw new NotFoundError(`No such file or directory, for '${extendsPath}' found.`);
            }

            const extendsConfig = resolveExtends(resolvedExtendsPath, directoryPath, new Set(circularExtendsTracker), options, resolveExtendsCache);

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
                    config.exclude = (["outDir", "declarationDir"] as const)
                        .map((field) => {
                            const value = compilerOptions[field];

                            if (!value) {
                                return undefined;
                            }

                            // configDir values will be interpolated later in readTsConfig
                            // eslint-disable-next-line @typescript-eslint/no-use-before-define
                            if (value.startsWith(configDirectoryPlaceholder)) {
                                return value;
                            }

                            return isAbsolute(value) ? value : join(directoryPath, value);
                        })
                        .filter(Boolean);
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
        config.include = config.include.map((element) => slash(element));
    }

    if (config.files) {
        config.files = config.files.map((file) => {
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            if (file.startsWith(configDirectoryPlaceholder)) {
                return file;
            }

            return normalizePath(file);
        });
    }

    if (config.watchOptions) {
        const { watchOptions } = config;

        if (watchOptions.excludeDirectories) {
            watchOptions.excludeDirectories = watchOptions.excludeDirectories.map((excludePath) => normalize(resolve(directoryPath, excludePath)));
        }

        if (watchOptions.excludeFiles) {
            watchOptions.excludeFiles = watchOptions.excludeFiles.map((excludePath) => normalize(resolve(directoryPath, excludePath)));
        }

        if (watchOptions.watchFile) {
            watchOptions.watchFile = watchOptions.watchFile.toLowerCase() as TsConfigJson.WatchOptions["watchFile"];
        }

        if (watchOptions.watchDirectory) {
            watchOptions.watchDirectory = watchOptions.watchDirectory.toLowerCase() as TsConfigJson.WatchOptions["watchDirectory"];
        }

        if (watchOptions.fallbackPolling) {
            watchOptions.fallbackPolling = watchOptions.fallbackPolling.toLowerCase() as TsConfigJson.WatchOptions["fallbackPolling"];
        }
    }

    if (config.compilerOptions.lib) {
        config.compilerOptions.lib = config.compilerOptions.lib.map((library) => library.toLowerCase()) as TsConfigJson.CompilerOptions.Lib[];
    }

    if (config.compilerOptions.module) {
        let module = config.compilerOptions.module.toLowerCase() as TsConfigJson.CompilerOptions.Module;

        if (module === "es2015") {
            module = "es6";
        }

        config.compilerOptions.module = module;
    }

    if (config.compilerOptions.target) {
        let target = config.compilerOptions.target.toLowerCase() as TsConfigJson.CompilerOptions.Target;

        if (target === "es2015") {
            target = "es6";
        }

        config.compilerOptions.target = target;
    }

    if (config.compilerOptions.moduleResolution) {
        let moduleResolution = config.compilerOptions.moduleResolution.toLowerCase() as TsConfigJson.CompilerOptions.ModuleResolution;

        if (moduleResolution === ("node" as TsConfigJson.CompilerOptions.ModuleResolution)) {
            moduleResolution = "node10";
        }

        config.compilerOptions.moduleResolution = moduleResolution;
    }

    if (config.compilerOptions.jsx) {
        config.compilerOptions.jsx = config.compilerOptions.jsx.toLowerCase() as TsConfigJson.CompilerOptions.JSX;
    }

    if (config.compilerOptions.moduleDetection) {
        config.compilerOptions.moduleDetection = config.compilerOptions.moduleDetection.toLowerCase() as TsConfigJson.CompilerOptions.ModuleDetection;
    }

    // eslint-disable-next-line sonarjs/deprecation -- must handle deprecated field for backwards compatibility with older tsconfigs
    if (config.compilerOptions.importsNotUsedAsValues) {
        // eslint-disable-next-line sonarjs/deprecation -- must handle deprecated field for backwards compatibility with older tsconfigs
        config.compilerOptions.importsNotUsedAsValues
            // eslint-disable-next-line sonarjs/deprecation -- must handle deprecated field for backwards compatibility with older tsconfigs
            = config.compilerOptions.importsNotUsedAsValues.toLowerCase() as TsConfigJson.CompilerOptions.ImportsNotUsedAsValues;
    }

    if (config.compilerOptions.newLine) {
        config.compilerOptions.newLine = config.compilerOptions.newLine.toLowerCase() as TsConfigJson.CompilerOptions.NewLine;
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

/**
 * TypeScript implies `useDefineForClassFields = true` when the *effective*
 * target is ES2022 or later (ES2022, ES2023, ES2024, ES2025, ESNext).
 *
 * The previous implementation used `target.includes("es202")` which also
 * matched ES2020/ES2021 — that was incorrect since TS only flips the flag at
 * ES2022+.
 */
const targetImpliesUseDefineForClassFields = (target: string): boolean =>
    target === "es2022" || target === "es2023" || target === "es2024" || target === "es2025" || target === "esnext";

// eslint-disable-next-line sonarjs/cognitive-complexity
const tsCompatibleWrapper = (config: TsConfigJsonResolved, options: Options | undefined): TsConfigJsonResolved => {
    if (config.compilerOptions === undefined) {
        return config;
    }

    if (config.compilerOptions.rewriteRelativeImportExtensions) {
        // eslint-disable-next-line no-param-reassign
        config.compilerOptions.allowImportingTsExtensions ??= true;
    }

    if (config.compilerOptions.composite) {
        // eslint-disable-next-line no-param-reassign
        config.compilerOptions.declaration ??= true;
        // eslint-disable-next-line no-param-reassign
        config.compilerOptions.incremental ??= true;
    }

    if (config.compilerOptions.checkJs) {
        // eslint-disable-next-line no-param-reassign
        config.compilerOptions.allowJs ??= true;
    }

    if (config.compilerOptions.verbatimModuleSyntax) {
        // eslint-disable-next-line no-param-reassign
        config.compilerOptions.isolatedModules ??= true;
        // eslint-disable-next-line no-param-reassign
        config.compilerOptions.preserveConstEnums ??= true;
    }

    if (["5.4", "5.5", "5.6", "5.7", "5.8", "5.9"].includes(String(options?.tscCompatible))) {
        if (
            config.compilerOptions.esModuleInterop === undefined
            && (config.compilerOptions.module === "node16"
                || config.compilerOptions.module === "node18"
                || config.compilerOptions.module === "node20"
                || config.compilerOptions.module === "nodenext"
                || config.compilerOptions.module === "preserve")
        ) {
            // eslint-disable-next-line no-param-reassign
            config.compilerOptions.esModuleInterop = true;
        }

        if (
            config.compilerOptions.moduleDetection === undefined
            && config.compilerOptions.module
            && ["node16", "node18", "node20", "nodenext"].includes(config.compilerOptions.module)
        ) {
            // eslint-disable-next-line no-param-reassign
            config.compilerOptions.moduleDetection = "force";
        }

        if (config.compilerOptions.moduleResolution === undefined) {
            let moduleResolution: TsConfigJson.CompilerOptions.ModuleResolution = "classic";

            if (config.compilerOptions.module !== undefined) {
                // eslint-disable-next-line default-case
                switch (config.compilerOptions.module.toLocaleLowerCase()) {
                    case "commonjs": {
                        moduleResolution = "node10";

                        break;
                    }
                    case "node16":
                    case "node18": {
                        moduleResolution = "node16";

                        break;
                    }
                    case "node20": {
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
            config.compilerOptions.resolveJsonModule ??= true;
        }

        if (config.compilerOptions.module && ["node20", "nodenext"].includes(config.compilerOptions.module)) {
            // eslint-disable-next-line no-param-reassign
            config.compilerOptions.resolveJsonModule ??= true;
        }

        if (
            (config.compilerOptions.esModuleInterop || config.compilerOptions.module === "system" || config.compilerOptions.moduleResolution === "bundler")
            && config.compilerOptions.allowSyntheticDefaultImports === undefined
        ) {
            // eslint-disable-next-line no-param-reassign
            config.compilerOptions.allowSyntheticDefaultImports = true;
        }

        if (["5.7", "5.8", "5.9"].includes(String(options?.tscCompatible)) && config.compilerOptions.moduleResolution) {
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

            // eslint-disable-next-line default-case
            switch (config.compilerOptions.module) {
                case "node16":
                case "node18": {
                    target = "es2022";

                    break;
                }
                case "node20": {
                    target = "es2023";

                    break;
                }
                case "nodenext": {
                    target = "esnext";

                    break;
                }
                // No default
            }

            if (target !== "es5") {
                // eslint-disable-next-line no-param-reassign
                config.compilerOptions.target = target;
            }
        }

        if (
            config.compilerOptions.useDefineForClassFields === undefined
            && config.compilerOptions.target
            && targetImpliesUseDefineForClassFields(config.compilerOptions.target)
        ) {
            // eslint-disable-next-line no-param-reassign
            config.compilerOptions.useDefineForClassFields = true;
        }
    }

    if (
        ["5.6", "5.7", "5.8", "5.9"].includes(String(options?.tscCompatible))
        && config.compilerOptions.strict
        && config.compilerOptions.strictBuiltinIteratorReturn === undefined
    ) {
        // eslint-disable-next-line no-param-reassign
        config.compilerOptions.strictBuiltinIteratorReturn = true;
    }

    if (["5.4", "5.5", "5.6", "5.7", "5.8", "5.9"].includes(String(options?.tscCompatible))) {
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

        if (
            config.compilerOptions.useDefineForClassFields === undefined
            && config.compilerOptions.target
            && targetImpliesUseDefineForClassFields(config.compilerOptions.target)
        ) {
            // eslint-disable-next-line no-param-reassign
            config.compilerOptions.useDefineForClassFields = true;
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

    // TypeScript 6.0+ emits fewer implicit defaults in --showConfig. TS 7.0 (the
    // native port) adopts 6.0's derived-default behaviour, so it shares this gate.
    // `true` means "latest supported version", which follows the 7.0 regime.
    if (["6.0", "7.0", "true"].includes(String(options?.tscCompatible))) {
        // moduleDetection: force for node-style modules
        if (
            config.compilerOptions.moduleDetection === undefined
            && config.compilerOptions.module
            && ["node16", "node18", "node20", "nodenext"].includes(config.compilerOptions.module)
        ) {
            // eslint-disable-next-line no-param-reassign
            config.compilerOptions.moduleDetection = "force";
        }

        // moduleResolution implications
        if (config.compilerOptions.moduleResolution === undefined && config.compilerOptions.module) {
            const currentModule = config.compilerOptions.module.toLocaleLowerCase();

            if (currentModule === "node16" || currentModule === "node18" || currentModule === "node20") {
                // eslint-disable-next-line no-param-reassign
                config.compilerOptions.moduleResolution = "node16";
            } else if (currentModule === "nodenext") {
                // eslint-disable-next-line no-param-reassign
                config.compilerOptions.moduleResolution = "nodenext";
            }
            // TS 6.0 does not show moduleResolution for "preserve" in --showConfig
        }

        // useDefineForClassFields: false when target is below ES2022 with node-style modules
        if (
            config.compilerOptions.useDefineForClassFields === undefined
            && config.compilerOptions.module
            && ["node16", "node18", "node20", "nodenext"].includes(config.compilerOptions.module)
            && config.compilerOptions.target
            && !targetImpliesUseDefineForClassFields(config.compilerOptions.target)
        ) {
            // eslint-disable-next-line no-param-reassign
            config.compilerOptions.useDefineForClassFields = false;
        }

        // preserveConstEnums when isolatedModules is set
        if (config.compilerOptions.isolatedModules && config.compilerOptions.preserveConstEnums === undefined) {
            // eslint-disable-next-line no-param-reassign
            config.compilerOptions.preserveConstEnums = true;
        }

        // resolveJsonModule: only node20/nodenext/bundler imply true; everything else defaults to false
        if (config.compilerOptions.resolveJsonModule === undefined) {
            const currentModule = config.compilerOptions.module;
            const resolution = config.compilerOptions.moduleResolution?.toLocaleLowerCase();

            const moduleImplies = currentModule !== undefined && ["node20", "nodenext"].includes(currentModule);
            const impliesTrue = moduleImplies ? true : resolution === "bundler";

            if (!impliesTrue && resolution) {
                // eslint-disable-next-line no-param-reassign
                config.compilerOptions.resolveJsonModule = false;
            }
        }

        // resolvePackageJsonExports/Imports: false for non-modern resolutions
        if (config.compilerOptions.moduleResolution) {
            const resolution = config.compilerOptions.moduleResolution.toLocaleLowerCase();

            if (!["bundler", "node16", "nodenext"].includes(resolution)) {
                // eslint-disable-next-line no-param-reassign
                config.compilerOptions.resolvePackageJsonExports ??= false;
                // eslint-disable-next-line no-param-reassign
                config.compilerOptions.resolvePackageJsonImports ??= false;
            }
        }
    }

    if (config.compileOnSave === false) {
        // eslint-disable-next-line no-param-reassign
        delete config.compileOnSave;
    }

    return config;
};

type Options = {
    /**
     * Make the configuration compatible with the specified TypeScript version.
     *
     * Controls *derived* defaults — fields TypeScript synthesizes when other
     * fields are set (e.g. `module: nodenext` ⇒ `moduleResolution: nodenext`).
     *
     * When `true`, it will make the configuration compatible with the latest TypeScript version.
     *
     * Supported version strings map to the version gates below — `"5.3"` is
     * intentionally absent because TypeScript 5.3 introduced no derived-default
     * changes over 5.2, so it would be a silent no-op.
     * @default undefined
     */
    tscCompatible?: "5.4" | "5.5" | "5.6" | "5.7" | "5.8" | "5.9" | "6.0" | "7.0" | true;

    /**
     * Apply the *unconditional* compiler-option defaults TypeScript would
     * synthesize for the given version (e.g. TS 6.0's `strict: true`,
     * `target: 'es2025'`, `moduleResolution: 'bundler'`).
     * - `'auto'` — auto-detect the installed TypeScript version by walking up
     * from the tsconfig directory (and consulting Yarn Berry pnp).
     * - `string` — pin to an explicit version (e.g. `'6.0.0'`, `'5.4'`).
     * - `false` (default) — do not apply unconditional defaults; preserves
     * prior behaviour where the parsed config matches `tsc --showConfig`.
     * Distinct from `tscCompatible`, which only governs derived defaults.
     * Both can be combined.
     * @default false
     */
    typescriptVersion?: "auto" | false | (Record<never, never> & string);
};

/**
 * Resolves `options.typescriptVersion` to a concrete version string, or
 * `undefined` when defaults should be skipped.
 */
const resolveTypeScriptVersion = (options: Options | undefined, configDirectory: string): string | undefined => {
    const typescriptVersion = options?.typescriptVersion;

    if (typescriptVersion === false || typescriptVersion === undefined) {
        return undefined;
    }

    if (typescriptVersion === "auto") {
        return detectTypeScriptVersion(configDirectory);
    }

    return typescriptVersion;
};

export type { Options };

// eslint-disable-next-line no-template-curly-in-string
export const configDirectoryPlaceholder: string = "${configDir}";
export const implicitBaseUrlSymbol: symbol = Symbol("implicitBaseUrl");

// eslint-disable-next-line sonarjs/cognitive-complexity
export const readTsConfig = (tsconfigPath: string, options?: Options): TsConfigJsonResolved => {
    const resolvedTsconfigPath = resolve(tsconfigPath);

    const config = internalParseTsConfig(resolvedTsconfigPath, options);

    const configDirectory = dirname(resolvedTsconfigPath);

    const resolvedVersion = resolveTypeScriptVersion(options, configDirectory);

    if (resolvedVersion && config.compilerOptions) {
        applyVersionDefaults(config.compilerOptions, resolvedVersion);
    }

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
            const pathKeys = Object.keys(paths);

            // eslint-disable-next-line unicorn/no-for-loop,no-plusplus -- index-based loop preferred for array performance
            for (let index = 0; index < pathKeys.length; index++) {
                const name = pathKeys[index] as string;

                paths[name] = (paths[name] as string[]).map((filePath) => interpolateConfigDirectory(filePath, configDirectory) ?? filePath);
            }
        }
    }

    // eslint-disable-next-line no-plusplus -- index-based loop preferred for array performance
    for (let index = 0; index < filesProperties.length; index++) {
        const property = filesProperties[index] as (typeof filesProperties)[number];
        const value = config[property];

        if (value) {
            config[property] = value.map((filePath) => interpolateConfigDirectory(filePath, configDirectory) ?? filePath);
        }
    }

    return tsCompatibleWrapper(config, options);
};
