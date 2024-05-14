import { stat } from "node:fs/promises";
import Module from "node:module";
import { cwd, env, exit, versions } from "node:process";

import { bold, cyan, gray, green } from "@visulima/colorize";
import { emptyDir, ensureDirSync, isAccessible, walk } from "@visulima/fs";
import { formatBytes } from "@visulima/humanizer";
import type { PackageJson, TsConfigJson, TsConfigResult } from "@visulima/package";
import { findPackageJson, findTSConfig, readTsConfig } from "@visulima/package";
import type { Pail, Processor } from "@visulima/pail";
import { createPail } from "@visulima/pail";
import { CallerProcessor, ErrorProcessor, MessageFormatterProcessor } from "@visulima/pail/processor";
import { basename, isAbsolute, join, normalize, relative, resolve } from "@visulima/path";
import { defu } from "defu";
import { createHooks } from "hookable";
import { minVersion } from "semver";

import { EXCLUDE_REGEXP } from "./constants";
import createStub from "./jit/create-stub";
import { build as rollupBuild, watch as rollupWatch } from "./rollup";
import type { BuildConfig, BuildContext, BuildContextBuildEntry, BuildOptions, Mode } from "./types";
import arrayify from "./utils/arrayify";
import dumpObject from "./utils/dump-object";
import getPackageSideEffect from "./utils/get-package-side-effect";
import removeExtension from "./utils/remove-extension";
import resolvePreset from "./utils/resolve-preset";
import tryRequire from "./utils/try-require";
import validateDependencies from "./validator/validate-dependencies";
import validatePackage from "./validator/validate-package";

// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
type PackEmPackageJson = PackageJson & { packem?: BuildConfig };

const logErrors = (context: BuildContext, hasOtherLogs: boolean): void => {
    if (context.warnings.size > 0) {
        if (hasOtherLogs) {
            context.logger.raw("\n");
        }

        context.logger.warn(`Build is done with some warnings:\n\n${[...context.warnings].map((message) => `- ${message}`).join("\n")}`);

        if (context.options.failOnWarn) {
            context.logger.error("Exiting with code (1). You can change this behavior by setting `failOnWarn: false`.");

            exit(1);
        }
    }
};

const resolveTsconfigJsxToJsxRuntime = (jsx?: TsConfigJson.CompilerOptions.JSX): "automatic" | "preserve" | "transform" | undefined => {
    switch (jsx) {
        case "preserve":
        case "react-native": {
            return "preserve";
        }
        case "react": {
            return "transform";
        }
        case "react-jsx":
        case "react-jsxdev": {
            return "automatic";
        }
        default: {
            return undefined;
        }
    }
};

const build = async (
    logger: Pail<never, string>,
    rootDirectory: string,
    mode: Mode,
    inputConfig: BuildConfig,
    buildConfig: BuildConfig,
    package_: PackEmPackageJson,
    tsconfig: TsConfigResult | undefined,
    cleanedDirectories: string[],
    // eslint-disable-next-line sonarjs/cognitive-complexity
): Promise<void> => {
    const preset = resolvePreset(buildConfig.preset ?? package_?.packem?.preset ?? inputConfig.preset ?? "auto", rootDirectory);

    let nodeTarget = `node${versions.node.split(".")[0]}`;

    if (package_?.engines?.node) {
        const minNodeVersion = minVersion(package_.engines.node);

        if (minNodeVersion) {
            nodeTarget = `node${minNodeVersion.major}`;
        }
    }

    const jsxRuntime = resolveTsconfigJsxToJsxRuntime(tsconfig?.config?.compilerOptions?.jsx);

    const options = defu(buildConfig, package_?.packem, inputConfig, preset, <BuildOptions>{
        alias: {},
        clean: true,
        declaration: false,
        dependencies: [],
        devDependencies: [],
        entries: [],
        externals: [...Module.builtinModules, ...Module.builtinModules.map((m) => `node:${m}`)],
        failOnWarn: true,
        name: (package_?.name || "").split("/").pop() || "default",
        optionalDependencies: [],
        outDir: "dist",
        peerDependencies: [],
        replace: {},
        rollup: {
            alias: {},
            cjsInterop: { addDefaultProperty: false },
            commonjs: {
                ignoreTryCatch: true,
                preserveSymlinks: true,
                // https://github.com/rollup/plugins/tree/master/packages/commonjs#transformmixedesmodules
                transformMixedEsModules: false,
            },
            dts: {
                compilerOptions: {
                    baseUrl: tsconfig?.config?.compilerOptions?.baseUrl || ".",
                    // Avoid extra work
                    checkJs: false,
                    /**
                     * https://github.com/privatenumber/pkgroll/pull/54
                     *
                     * I think this is necessary because TypeScript's composite requires
                     * that all files are passed in via `include`. However, it seems that
                     * rollup-plugin-dts doesn't read or relay the `include` option in tsconfig.
                     *
                     * For now, simply disabling composite does the trick since it doesn't seem
                     * necessary for dts bundling.
                     *
                     * One concern here is that this overwrites the compilerOptions. According to
                     * the rollup-plugin-dts docs, it reads from baseUrl and paths.
                     */
                    composite: false,
                    // Ensure ".d.ts" modules are generated
                    declaration: true,
                    declarationMap: false,
                    emitDeclarationOnly: true,
                    // error TS5074: Option '--incremental' can only be specified using tsconfig, emitting to single
                    // file or when option '--tsBuildInfoFile' is specified.
                    incremental: false,
                    // Skip ".js" generation
                    noEmit: false,
                    // Skip code generation when error occurs
                    noEmitOnError: true,
                    // https://github.com/Swatinem/rollup-plugin-dts/issues/143
                    preserveSymlinks: false,
                    skipLibCheck: true,
                    // Ensure we can parse the latest code

                    target: 99, // ESNext
                },
                respectExternal: true,
            },
            dynamicVars: {
                errorWhenNoFilesFound: true,
                // fast path to check if source contains a dynamic import. we check for a
                // trailing slash too as a dynamic import statement can have comments between
                // the `import` and the `(`.
                include: /\bimport\s*[(/]/,
            },
            emitCJS: false,
            emitESM: true,
            esbuild: {
                charset: "utf8",
                include: /\.[jt]sx?$/,
                jsx: jsxRuntime,
                jsxDev: tsconfig?.config?.compilerOptions?.jsx === "react-jsxdev",
                jsxFactory: tsconfig?.config?.compilerOptions?.jsxFactory,
                jsxFragment: tsconfig?.config?.compilerOptions?.jsxFragmentFactory,
                jsxImportSource: tsconfig?.config?.compilerOptions?.jsxImportSource,
                jsxSideEffects: true,
                // eslint-disable-next-line no-secrets/no-secrets
                /**
                 * esbuild renames variables even if minification is not enabled
                 * https://esbuild.github.io/try/#dAAwLjE5LjUAAGNvbnN0IGEgPSAxOwooZnVuY3Rpb24gYSgpIHt9KTs
                 */
                keepNames: true,
                minify: env.NODE_ENV === "production",
                // eslint-disable-next-line no-secrets/no-secrets
                /**
                 * Smaller output for cache and marginal performance improvement:
                 * https://twitter.com/evanwallace/status/1396336348366180359?s=20
                 *
                 * minifyIdentifiers is disabled because debuggers don't use the
                 * `names` property from the source map
                 *
                 * minifySyntax is disabled because it does some tree-shaking
                 * eg. unused try-catch error variable
                 */
                minifyWhitespace: env.NODE_ENV === "production",

                /**
                 * Improve performance by generating smaller source maps
                 * that doesn't include the original source code
                 *
                 * https://esbuild.github.io/api/#sources-content
                 */
                sourcesContent: false,
                target: tsconfig?.config?.compilerOptions?.target,
                // Optionally preserve symbol names during minification
                tsconfigRaw: tsconfig?.config,
            },
            json: {
                preferConst: true,
            },
            license: {
                dtsTemplate: (licenses, dependencyLicenseTexts, pName) =>
                    `\n# Licenses of bundled types\n` +
                    `The published ${pName} artifact additionally contains code with the following licenses:\n` +
                    `${licenses.join(", ")}\n\n` +
                    `# Bundled types:\n` +
                    dependencyLicenseTexts,
                template: (licenses, dependencyLicenseTexts, pName) =>
                    `\n# Licenses of bundled dependencies\n` +
                    `The published ${pName} artifact additionally contains code with the following licenses:\n` +
                    `${licenses.join(", ")}\n\n` +
                    `# Bundled dependencies:\n` +
                    dependencyLicenseTexts,
            },
            patchTypes: {},
            polyfillNode: {},
            preserveDynamicImports: true,
            raw: {
                exclude: EXCLUDE_REGEXP,
                include: ["**/*.data", "**/*.txt"],
            },
            replace: {
                /**
                 * Seems this currently doesn't work:
                 * https://github.com/rollup/plugins/pull/1084#discussion_r861447543
                 */
                objectGuards: true,
                preventAssignment: true,
            },
            resolve: {
                // old behavior node 14 and removed in node 17
                allowExportsFolderMapping: false,
                // Following option must be *false* for polyfill to work
                preferBuiltins: false,
            },
            shim: true,
            sucrase: {
                disableESTransforms: true,
                enableLegacyBabel5ModuleInterop: false,
                enableLegacyTypeScriptModuleInterop: tsconfig?.config?.compilerOptions?.esModuleInterop === false,
                include: /\.[jt]sx?$/,
                injectCreateRequireForImportRequire: false,
                preserveDynamicImport: true,
                production: env.NODE_ENV === "production",
                ...(tsconfig?.config?.compilerOptions?.jsx && ["react", "react-jsx", "react-jsxdev"].includes(tsconfig?.config?.compilerOptions?.jsx)
                    ? {
                          jsxFragmentPragma: tsconfig?.config?.compilerOptions?.jsxFragmentFactory,
                          jsxImportSource: tsconfig?.config?.compilerOptions?.jsxImportSource,
                          jsxPragma: tsconfig?.config?.compilerOptions?.jsxFactory,
                          jsxRuntime,
                          transforms: ["typescript", "jsx", ...(tsconfig?.config?.compilerOptions?.esModuleInterop ? ["imports"] : [])],
                      }
                    : {
                          transforms: ["typescript", ...(tsconfig?.config?.compilerOptions?.esModuleInterop ? ["imports"] : [])],
                      }),
            },
            swc: {
                include: /\.[jt]sx?$/,
                inlineSourcesContent: false,
                inputSourceMap: false,
                isModule: true,
                jsc: {
                    experimental: {
                        keepImportAttributes: true,
                    },
                    externalHelpers: false,
                    keepClassNames: true,
                    loose: true, // Use loose mode
                    parser: {
                        decorators: tsconfig?.config?.compilerOptions?.experimentalDecorators,
                        dynamicImport: true,
                        syntax: tsconfig ? "typescript" : "ecmascript",
                        [tsconfig ? "tsx" : "jsx"]: true,
                    },
                    target: tsconfig?.config?.compilerOptions?.target?.toLowerCase(),
                    transform: {
                        decoratorMetadata: tsconfig?.config?.compilerOptions?.emitDecoratorMetadata,
                        legacyDecorator: true,
                        react: {
                            development: env.NODE_ENV !== "production",
                            pragma: tsconfig?.config?.compilerOptions?.jsxFactory,
                            pragmaFrag: tsconfig?.config?.compilerOptions?.jsxFragmentFactory,
                            runtime: jsxRuntime,
                            throwIfNamespace: true,
                            useBuiltins: true,
                        },
                    },
                },
                module: {
                    ignoreDynamic: true,
                    importInterop: "none",
                    preserveImportMeta: true,
                    strict: false, // no __esModule
                    strictMode: false, // no 'use strict';
                    type: "es6",
                },
            },
            treeshake: {
                moduleSideEffects: getPackageSideEffect(rootDirectory, package_),
                preset: "recommended",
            },
            watch: {
                clearScreen: true,
                exclude: EXCLUDE_REGEXP,
            },
        },
        rootDir: rootDirectory,
        sourcemap: false,
        stub: mode === "jit",
        stubOptions: {
            /**
             * See https://github.com/unjs/jiti#options
             */
            jiti: {
                alias: {},
                esmResolve: true,
                interopDefault: true,
            },
        },
        target: nodeTarget,
        transformer: "esbuild",
    }) as BuildOptions;

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (options.transformer !== "esbuild" && options.transformer !== "swc" && options.transformer !== "sucrase") {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        throw new Error(options.transformer ? `Unknown transformer ${JSON.stringify(options.transformer)}` : "Missing transformer name in options.");
    }

    if (options.rollup.emitESM === false && options.rollup.emitCJS === false) {
        throw new Error("Both emitESM and emitCJS are disabled. At least one of them must be enabled.");
    }

    // Resolve dirs relative to rootDir
    options.outDir = resolve(options.rootDir, options.outDir);

    ensureDirSync(options.outDir);

    if (options.transformer === "esbuild" && options.rollup.esbuild) {
        if (tsconfig?.config?.compilerOptions?.target?.toLowerCase() === "es3") {
            logger.warn(
                [
                    "ES3 target is not supported by esbuild, so ES5 will be used instead..",
                    "Please set 'target' option in tsconfig to at least ES5 to disable this error",
                ].join(" "),
            );

            // eslint-disable-next-line no-param-reassign
            tsconfig.config.compilerOptions.target = "es5";
            options.rollup.esbuild.target = "es5";
        }

        if (options.rollup.esbuild.jsx === "preserve") {
            let message = "Packem does not support 'preserve' jsx option. Please use 'transform' or 'automatic' instead.";

            if (tsconfig?.config?.compilerOptions?.jsx) {
                message =
                    "Packem does not support '" +
                    tsconfig.config.compilerOptions.jsx +
                    "' jsx option. Please change it to 'react' or 'react-jsx' or 'react-jsxdev' instead.";
            }

            throw new Error(message);
        }

        // Add node target to esbuild target
        if (options.rollup.esbuild.target) {
            const targets = arrayify(options.rollup.esbuild.target);

            if (!targets.some((t) => t.startsWith("node"))) {
                options.rollup.esbuild.target = [options.target, ...targets];
            }
        } else {
            options.rollup.esbuild.target = [options.target];
        }

        if (tsconfig?.config?.compilerOptions?.target === "es5") {
            options.rollup.esbuild.keepNames = false;

            logger.debug("Disabling keepNames because target is set to es5");
        }
    }

    logger.info('Using "' + cyan(options.transformer) + '" as transformer.');

    if (options.rollup.resolve && options.rollup.resolve.preferBuiltins === true) {
        options.rollup.polyfillNode = false;

        logger.debug("Disabling polyfillNode because preferBuiltins is set to true");
    }

    if (!tsconfig?.config?.compilerOptions?.isolatedModules) {
        logger.warn(
            `'compilerOptions.isolatedModules' is not enabled in tsconfig.\nBecause none of the third-party transpilers, packem uses under the hood is type-aware, some techniques or features often used in TypeScript are not properly checked and can cause mis-compilation or even runtime errors.\nTo mitigate this, you should set the isolatedModules option to true in tsconfig and let your IDE warn you when such incompatible constructs are used.`,
        );
    }

    // Build context
    const context: BuildContext = {
        buildEntries: [],
        dependencyGraphMap: new Map(),
        hooks: createHooks(),
        logger,
        mode,
        options,
        pkg: package_,
        rootDir: rootDirectory,
        tsconfig,
        usedImports: new Set(),
        warnings: new Set(),
    };

    // Register hooks
    if (preset.hooks) {
        context.hooks.addHooks(preset.hooks);
    }

    if (inputConfig.hooks) {
        context.hooks.addHooks(inputConfig.hooks);
    }

    if (buildConfig.hooks) {
        context.hooks.addHooks(buildConfig.hooks);
    }

    // Allow prepare and extending context
    await context.hooks.callHook("build:prepare", context);

    // Normalize entries
    options.entries = options.entries.map((entry) => (typeof entry === "string" ? { input: entry } : entry));

    if (options.declaration && tsconfig === undefined) {
        throw new Error("Cannot build declaration files without a tsconfig.json");
    }

    // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
    for (const entry of options.entries) {
        if (typeof entry.name !== "string") {
            let relativeInput = isAbsolute(entry.input) ? relative(rootDirectory, entry.input) : normalize(entry.input);

            if (relativeInput.startsWith("./")) {
                relativeInput = relativeInput.slice(2);
            }

            entry.name = removeExtension(relativeInput.replace(/^src\//, ""));
        }

        if (!entry.input) {
            throw new Error(`Missing entry input: ${dumpObject(entry)}`);
        }

        if (options.declaration !== undefined && entry.declaration === undefined) {
            entry.declaration = options.declaration;
        }

        entry.input = resolve(options.rootDir, entry.input);
        entry.outDir = resolve(options.rootDir, entry.outDir ?? options.outDir);
    }

    // Infer dependencies from pkg
    options.dependencies = Object.keys(package_.dependencies || {});
    options.peerDependencies = Object.keys(package_.peerDependencies || {});
    options.devDependencies = Object.keys(package_.devDependencies || {});
    options.optionalDependencies = Object.keys(package_.optionalDependencies || {});

    // Add all dependencies as externals
    options.externals.push(...options.dependencies, ...options.peerDependencies, ...options.optionalDependencies);

    // Call build:before
    await context.hooks.callHook("build:before", context);

    let modeName = "Building";

    if (mode === "watch") {
        modeName = "Watching";
    } else if (mode === "jit") {
        modeName = "Stubbing";
    }

    logger.info(cyan(`${modeName} ${options.name}`));

    logger.debug(`${bold("Root dir:")} ${options.rootDir}\n  ${bold("Entries:")}\n  ${options.entries.map((entry) => `  ${dumpObject(entry)}`).join("\n  ")}`);

    // Clean dist dirs
    if (options.clean) {
        // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
        for (const directory of new Set(
            // eslint-disable-next-line @typescript-eslint/require-array-sort-compare
            options.entries
                .map((entry) => entry.outDir)
                .filter(Boolean)
                .sort() as unknown as Set<string>,
        )) {
            if (
                directory === options.rootDir ||
                options.rootDir.startsWith(directory.endsWith("/") ? directory : `${directory}/`) ||
                cleanedDirectories.some((c) => directory.startsWith(c))
            ) {
                // eslint-disable-next-line no-continue
                continue;
            }

            cleanedDirectories.push(directory);

            logger.info(`Cleaning dist directory: \`./${relative(options.rootDir, directory)}\``);

            // eslint-disable-next-line no-await-in-loop
            await emptyDir(directory);
        }
    }

    // Skip rest for stub
    if (options.stub) {
        await createStub(context);

        await context.hooks.callHook("build:done", context);

        return;
    }

    if (mode === "watch") {
        await rollupWatch(context);

        logErrors(context, false);

        return;
    }

    await rollupBuild(context);

    logger.success(green(`Build succeeded for ${options.name}`));

    // Find all dist files and add missing entries as chunks
    // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
    for await (const file of walk(options.outDir)) {
        let entry = context.buildEntries.find((bEntry) => join(context.options.outDir, bEntry.path) === file.path);

        if (!entry) {
            entry = {
                chunk: true,
                path: file.path,
            };

            context.buildEntries.push(entry);
        }

        if (!entry.bytes) {
            const awaitedStat = await stat(resolve(options.outDir, file.path));

            entry.bytes = awaitedStat.size;
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    const rPath = (p: string) => relative(context.rootDir, resolve(options.outDir, p));

    let loggedEntries = false;

    // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
    for (const entry of context.buildEntries.filter((bEntry) => !bEntry.chunk)) {
        let totalBytes = entry.bytes ?? 0;

        // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
        for (const chunk of entry.chunks ?? []) {
            totalBytes += context.buildEntries.find((bEntry) => bEntry.path === chunk)?.bytes ?? 0;
        }

        let line = `  ${bold(rPath(entry.path))} (${[
            "total size: " + cyan(formatBytes(totalBytes)),
            entry.type !== "asset" && entry.bytes && "chunk size: " + cyan(formatBytes(entry.bytes)),
        ]
            .filter(Boolean)
            .join(", ")})`;

        line += entry.exports?.length ? "\n  exports: " + gray(entry.exports.join(", ")) : "";

        if (entry.chunks?.length) {
            line += `\n${entry.chunks
                .map((p) => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const chunk = context.buildEntries.find((buildEntry) => buildEntry.path === p) ?? ({} as any);

                    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
                    return gray("  └─ " + rPath(p) + bold(chunk.bytes ? " (" + formatBytes(chunk?.bytes) + ")" : ""));
                })
                .join("\n")}`;
        }

        if (entry.modules && entry.modules.length > 0) {
            const moduleList = entry.modules
                .filter((m) => m.id.includes("node_modules"))
                .sort((a, b) => (b.bytes || 0) - (a.bytes || 0))
                // eslint-disable-next-line @typescript-eslint/no-unsafe-return
                .map((m) => gray("  📦 " + rPath(m.id) + bold(m.bytes ? " (" + formatBytes(m.bytes) + ")" : "")))
                .join("\n");

            line += moduleList.length > 0 ? "\n  inlined modules:\n" + moduleList : "";
        }

        // find types for entry
        if (context.options.declaration && entry.type === "entry") {
            let dtsPath = entry.path.replace(/\.js$/, ".d.ts");
            let type = "commonjs";

            if (entry.path.endsWith(".cjs")) {
                dtsPath = entry.path.replace(/\.cjs$/, ".d.cts");
            } else if (entry.path.endsWith(".mjs")) {
                type = "module";
                dtsPath = entry.path.replace(/\.mjs$/, ".d.mts");
            }

            const foundDts = context.buildEntries.find((bEntry) => bEntry.path.endsWith(dtsPath));

            if (foundDts) {
                let foundCompatibleDts: BuildContextBuildEntry | undefined;

                if ((context.options.declaration === true || context.options.declaration === "compatible") && !dtsPath.includes(".d.ts")) {
                    dtsPath = (dtsPath as string).replace(type === "commonjs" ? ".d.c" : ".d.m", ".d.");

                    foundCompatibleDts = context.buildEntries.find((bEntry) => bEntry.path.endsWith(dtsPath));
                }

                line +=
                    foundCompatibleDts && type === package_.type
                        ? "\n  types:\n" +
                          [foundDts, foundCompatibleDts]
                              .map(
                                  (value: BuildContextBuildEntry) =>
                                      gray("  └─ ") + bold(rPath(value.path)) + " (total size: " + cyan(formatBytes(value.bytes ?? 0)) + ")",
                              )
                              .join("\n")
                        : "\n  types: " + bold(rPath(foundDts.path)) + " (total size: " + cyan(formatBytes(foundDts.bytes ?? 0)) + ")";
            }
        }

        loggedEntries = true;

        line += "\n\n";

        logger.raw(entry.chunk ? gray(line) : line);
    }

    if (loggedEntries) {
        logger.raw("Σ Total dist size (byte size):", cyan(formatBytes(context.buildEntries.reduce((index, entry) => index + (entry.bytes ?? 0), 0))), "\n");
    }

    // Validate
    validateDependencies(context);
    validatePackage(package_, context);

    // Call build:done
    await context.hooks.callHook("build:done", context);

    logErrors(context, loggedEntries);
};

const createBundler = async (
    rootDirectory: string,
    mode: Mode,
    inputConfig: BuildConfig & {
        configPath?: string;
        debug?: boolean;
        tsconfigPath?: string;
    } = {},
): Promise<void> => {
    const { configPath, debug, tsconfigPath, ...otherInputConfig } = inputConfig;
    const loggerProcessors: Processor<string>[] = [new MessageFormatterProcessor<string>(), new ErrorProcessor<string>()];

    if (debug) {
        loggerProcessors.push(new CallerProcessor());
    }

    const logger = createPail({
        logLevel: debug ? "debug" : "informational",
        processors: loggerProcessors,
        scope: "packem",
    });

    logger.wrapAll();

    // Determine rootDirectory
    // eslint-disable-next-line no-param-reassign
    rootDirectory = resolve(cwd(), rootDirectory);

    let tsconfig: TsConfigResult | undefined;

    if (tsconfigPath) {
        if (!(await isAccessible(tsconfigPath))) {
            logger.error("tsconfig.json not found at", tsconfigPath);

            exit(1);
        }

        tsconfig = {
            config: await readTsConfig(tsconfigPath),
            path: tsconfigPath,
        };

        logger.debug("Using tsconfig.json found at", tsconfigPath);
    } else {
        try {
            tsconfig = await findTSConfig(rootDirectory);

            logger.debug("Using " + basename(tsconfig.path) + " found at", tsconfig.path);
        } catch {
            logger.info("No tsconfig.json or jsconfig.json found.");
        }
    }

    try {
        const { packageJson, path: packageJsonPath } = await findPackageJson(rootDirectory);

        logger.debug("Using package.json found at", packageJsonPath);

        // eslint-disable-next-line @typescript-eslint/naming-convention
        const _buildConfig: BuildConfig | BuildConfig[] = tryRequire(configPath ?? "./packem.config", rootDirectory, []);

        const buildConfigs = (Array.isArray(_buildConfig) ? _buildConfig : [_buildConfig]).filter(Boolean);

        if (buildConfigs.length === 0) {
            await build(logger, rootDirectory, mode, otherInputConfig, {}, packageJson as PackEmPackageJson, tsconfig, []);
        } else {
            // Invoke build for every build config defined in packem.config.ts
            const cleanedDirectories: string[] = [];

            // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
            for (const buildConfig of buildConfigs) {
                // eslint-disable-next-line no-await-in-loop
                await build(logger, rootDirectory, mode, otherInputConfig, buildConfig, packageJson as PackEmPackageJson, tsconfig, cleanedDirectories);
            }
        }

        // Restore all wrapped console methods
        logger.restoreAll();

        exit(0);
    } catch (error) {
        logger.error("An error occurred while building", error);

        exit(1);
    }
};

export default createBundler;
