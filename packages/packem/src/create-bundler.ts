import { mkdir } from "node:fs/promises";
import Module from "node:module";

import { bold, cyan, green } from "@visulima/colorize";
import type { TsConfigResult } from "@visulima/package";
import { findPackageJson, findTSConfig } from "@visulima/package";
import { createHooks } from "hookable";
import { isAbsolute, normalize, relative, resolve } from "pathe";
import prettyBytes from "pretty-bytes";
import type { PackageJson } from "read-pkg";

import { rollupBuild } from "./builder/rollup";
import logger from "./logger";
import type { BuildConfig, BuildContext, BuildOptions } from "./types";
import { dumpObject } from "./utils/dump-object";
import { removeExtension } from "./utils/remove-extension";
import { resolvePreset } from "./utils/resolve-preset";
import { rmdir } from "./utils/rmdir";
import { tryRequire } from "./utils/try-require";
import defu from "defu";

// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
type PackEmPackageJson = PackageJson & { packem?: BuildConfig };

export const createBundler = async (rootDir: string): Promise<void> => {
    // Determine rootDir
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call,no-param-reassign
    rootDir = resolve(process.cwd(), rootDir || ".");

    let tsConfig: TsConfigResult | undefined;

    try {
        tsConfig = await findTSConfig(rootDir);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        logger.debug("Using tsconfig.json found at", (tsConfig as TsConfigResult).path);
    } catch {
        logger.info("No tsconfig.json found. Using default settings.");
    }

    const packageJson: PackEmPackageJson = (await findPackageJson(rootDir)) as PackEmPackageJson;

    // eslint-disable-next-line @typescript-eslint/naming-convention
    const _buildConfig: BuildConfig | BuildConfig[] = tryRequire("./packem.config", rootDir) || {};

    const buildConfigs = (Array.isArray(_buildConfig) ? _buildConfig : [_buildConfig]).filter(Boolean);

    // Invoke build for every build config defined in packem.config.ts
    const cleanedDirectories: string[] = [];

    // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
    for (const buildConfig of buildConfigs) {
        // eslint-disable-next-line no-await-in-loop
        await build(rootDir, stub, inputConfig, buildConfig, packageJson, tsConfig, cleanedDirectories);
    }
};

const build = async (
    rootDir: string,
    stub: boolean,
    inputConfig: BuildConfig,
    buildConfig: BuildConfig,
    package_: PackEmPackageJson,
    tsConfig: TsConfigResult | undefined,
    cleanedDirectories: string[],
): Promise<void> => {
    const preset = resolvePreset(buildConfig.preset ?? package_?.packem?.preset ?? inputConfig.preset ?? "auto", rootDir);

    // Merge options
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
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
            esbuild: { target: "esnext" },
            inlineDependencies: false,
            json: {
                preferConst: true,
            },
            preserveDynamicImports: true,
            // Plugins
            replace: {
                preventAssignment: true,
            },
            resolve: {
                preferBuiltins: true,
            },
        },
        rootDir,
        sourcemap: false,
        stub,
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
    }) as BuildOptions;

    // Resolve dirs relative to rootDir
    options.outDir = resolve(options.rootDir, options.outDir);

    // Build context
    const context: BuildContext = {
        buildEntries: [],
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        hooks: createHooks(),
        options,
        pkg: package_,
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

    for (const entry of options.entries) {
        if (typeof entry.name !== "string") {
            let relativeInput = isAbsolute(entry.input) ? relative(rootDir, entry.input) : normalize(entry.input);

            if (relativeInput.startsWith("./")) {
                relativeInput = relativeInput.slice(2);
            }
            entry.name = removeExtension(relativeInput.replace(/^src\//, ""));
        }

        if (!entry.input) {
            throw new Error(`Missing entry input: ${dumpObject(entry)}`);
        }

        if (!entry.builder) {
            entry.builder = entry.input.endsWith("/") ? "mkdist" : "rollup";
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

    logger.info(cyan(`${options.stub ? "Stubbing" : "Building"} ${options.name}`));

    logger.debug(`${bold("Root dir:")} ${options.rootDir}\n  ${bold("Entries:")}\n  ${options.entries.map((entry) => `  ${dumpObject(entry)}`).join("\n  ")}`);

    // Clean dist dirs
    if (options.clean) {
        for (const dir of new Set(
            options.entries
                .map((entry) => entry.outDir)
                .filter(Boolean)
                .sort() as unknown as Set<string>,
        )) {
            if (dir === options.rootDir || options.rootDir.startsWith(dir.endsWith("/") ? dir : `${dir}/`) || cleanedDirectories.some((c) => dir.startsWith(c))) {
                continue;
            }

            cleanedDirectories.push(dir);

            logger.info(`Cleaning dist directory: \`./${relative(process.cwd(), dir)}\``);

            await rmdir(dir);
            await mkdir(dir, { recursive: true });
        }
    }

    await rollupBuild(context);

    // Skip rest for stub
    if (options.stub) {
        await context.hooks.callHook("build:done", context);
        return;
    }

    logger.success(green(`Build succeeded for ${options.name}`));
};
