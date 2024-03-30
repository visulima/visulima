import { stat } from "node:fs/promises";
import Module from "node:module";
import { cwd, env, exit, versions } from "node:process";

import { bold, cyan, gray, green } from "@visulima/colorize";
import { emptyDir, isAccessible, walk } from "@visulima/fs";
import { formatBytes } from "@visulima/humanizer";
import type { PackageJson, TsConfigJsonResolved } from "@visulima/package";
import { findPackageJson, findTSConfig, readTsConfig } from "@visulima/package";
import { defu } from "defu";
import { createHooks } from "hookable";
import { isAbsolute, normalize, relative, resolve } from "pathe";

import { build as rollupBuild, watch as rollupWatch } from "./builder/rollup";
import createStub from "./builder/rollup/create-stub";
import logger from "./logger";
import type { BuildConfig, BuildContext, BuildOptions, Mode } from "./types";
import dumpObject from "./utils/dump-object";
import removeExtension from "./utils/remove-extension";
import resolvePreset from "./utils/resolve-preset";
import tryRequire from "./utils/try-require";
import warn from "./utils/warn";
import validateDependencies from "./validator/validate-dependencies";
import validatePackage from "./validator/validate-package";

// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
type PackEmPackageJson = PackageJson & { packem?: BuildConfig };

const logErrors = (context: BuildContext): void => {
    if (context.warnings.size > 0) {
        warn(context, `Build is done with some warnings:\n\n${[...context.warnings].map((message) => `- ${message}`).join("\n")}`);

        if (context.options.failOnWarn) {
            logger.error("Exiting with code (1). You can change this behavior by setting `failOnWarn: false` .");

            exit(1);
        }
    }
};

const build = async (
    rootDirectory: string,
    mode: Mode,
    inputConfig: BuildConfig,
    buildConfig: BuildConfig,
    package_: PackEmPackageJson,
    tsConfigContent: TsConfigJsonResolved | undefined,
    cleanedDirectories: string[],
    // eslint-disable-next-line sonarjs/cognitive-complexity
): Promise<void> => {
    const preset = resolvePreset(buildConfig.preset ?? package_?.packem?.preset ?? inputConfig.preset ?? "auto", rootDirectory);

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
        outDir: "dist",
        peerDependencies: [],
        replace: {},
        rollup: {
            alias: {},
            cjsBridge: false,
            commonjs: {
                ignoreTryCatch: true,
            },
            dts: {
                // https://github.com/Swatinem/rollup-plugin-dts/issues/143
                compilerOptions: { preserveSymlinks: false },
                respectExternal: true,
            },
            emitCJS: false,
            esbuild: {
                minify: env["NODE_ENV"] === "production",
                target: [`node${versions.node}`],
                tsconfigRaw: tsConfigContent,
            },
            inlineDependencies: false,
            json: {
                preferConst: true,
            },
            preserveDynamicImports: true,
            replace: {
                preventAssignment: true,
            },
            resolve: {
                preferBuiltins: true,
            },
            watch: false,
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
        watch: {
            clearScreen: true,
            exclude: ["node_modules/**"],
        },
    }) as BuildOptions;

    // Resolve dirs relative to rootDir
    options.outDir = resolve(options.rootDir, options.outDir);

    if (mode === "watch") {
    }

    // Build context
    const context: BuildContext = {
        buildEntries: [],
        hooks: createHooks(),
        options,
        pkg: package_,
        rootDir: rootDirectory,
        tsconfig: tsConfigContent,
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

    // Add all dependencies as externals
    options.externals.push(...options.dependencies, ...options.peerDependencies);

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

            logger.info(`Cleaning dist directory: \`./${relative(cwd(), directory)}\``);

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

        logErrors(context);

        return;
    }

    await rollupBuild(context);

    logger.success(green(`Build succeeded for ${options.name}`));

    // Find all dist files and add missing entries as chunks
    // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
    for await (const file of walk(options.outDir)) {
        let entry = context.buildEntries.find((bEntry) => bEntry.path === file.path);

        if (!entry) {
            entry = {
                chunk: true,
                path: file.path,
            };
            context.buildEntries.push(entry);
        }

        if (!entry.bytes) {
            entry.bytes = (await stat(resolve(options.outDir, file.path))).size;
        }
    }

    const rPath = (p: string) => relative(cwd(), resolve(options.outDir, p));

    let loggedEntries = false;

    // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
    for (const entry of context.buildEntries.filter((bEntry) => !bEntry.chunk)) {
        let totalBytes = entry.bytes ?? 0;

        // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
        for (const chunk of entry.chunks ?? []) {
            totalBytes += context.buildEntries.find((bEntry) => bEntry.path === chunk)?.bytes ?? 0;
        }

        let line = `  ${bold(rPath(entry.path))} (${[
            totalBytes && `total size: ${cyan(formatBytes(totalBytes))}`,
            entry.bytes && `chunk size: ${cyan(formatBytes(entry.bytes))}`,
        ]
            .filter(Boolean)
            .join(", ")})`;

        line += entry.exports?.length ? `\n  exports: ${gray(entry.exports.join(", "))}` : "";

        if (entry.chunks?.length) {
            line += `\n${entry.chunks
                .map((p) => {
                    const chunk = context.buildEntries.find((e) => e.path === p) || ({} as any);

                    return gray(`  └─ ${rPath(p)}${bold(chunk.bytes ? ` (${formatBytes(chunk?.bytes)})` : "")}`);
                })
                .join("\n")}`;
        }

        if (entry.modules?.length) {
            line += `\n${entry.modules
                .filter((m) => m.id.includes("node_modules"))
                .sort((a, b) => (b.bytes || 0) - (a.bytes || 0))
                .map((m) => gray(`  📦 ${rPath(m.id)}${bold(m.bytes ? ` (${formatBytes(m.bytes)})` : "")}`))
                .join("\n")}`;
        }

        loggedEntries = true;

        logger.raw(entry.chunk ? gray(line + "\n") : line + "\n");
    }

    if (loggedEntries) {
        logger.raw("\nΣ Total dist size (byte size):", cyan(formatBytes(context.buildEntries.reduce((index, entry) => index + (entry.bytes ?? 0), 0))), "\n");
    }

    // Validate
    validateDependencies(context);
    validatePackage(package_, context);

    // Call build:done
    await context.hooks.callHook("build:done", context);

    logErrors(context);
};

const createBundler = async (
    rootDirectory: string,
    mode: Mode,
    inputConfig: BuildConfig & {
        tsconfigPath?: string;
    } = {},
): Promise<void> => {
    const { tsconfigPath, ...otherInputConfig } = inputConfig;
    // Determine rootDirectory
    // eslint-disable-next-line no-param-reassign
    rootDirectory = resolve(cwd(), rootDirectory);

    let tsConfigContent: TsConfigJsonResolved | undefined;

    if (tsconfigPath) {
        if (!(await isAccessible(tsconfigPath))) {
            logger.error("tsconfig.json not found at", tsconfigPath);

            exit(1);
        }

        tsConfigContent = readTsConfig(tsconfigPath);

        logger.debug("Using tsconfig.json found at", tsconfigPath);
    } else {
        try {
            const foundTsconfig = await findTSConfig(rootDirectory);

            tsConfigContent = foundTsconfig.config;

            logger.debug("Using tsconfig.json found at", foundTsconfig.path);
        } catch {
            logger.info("No tsconfig.json found. Using default settings.");
        }
    }

    const { packageJson } = await findPackageJson(rootDirectory);

    // eslint-disable-next-line @typescript-eslint/naming-convention
    const _buildConfig: BuildConfig | BuildConfig[] = tryRequire("./packem.config", rootDirectory) || {};

    const buildConfigs = (Array.isArray(_buildConfig) ? _buildConfig : [_buildConfig]).filter(Boolean);

    // Invoke build for every build config defined in packem.config.ts
    const cleanedDirectories: string[] = [];

    // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
    for (const buildConfig of buildConfigs) {
        // eslint-disable-next-line no-await-in-loop
        await build(rootDirectory, mode, otherInputConfig, buildConfig, packageJson as PackEmPackageJson, tsConfigContent, cleanedDirectories);
    }
};

export default createBundler;
