import aliasPlugin from "@rollup/plugin-alias";
import commonjsPlugin from "@rollup/plugin-commonjs";
import dynamicImportVarsPlugin from "@rollup/plugin-dynamic-import-vars";
import { nodeResolve as nodeResolvePlugin } from "@rollup/plugin-node-resolve";
import replacePlugin from "@rollup/plugin-replace";
import { wasm as wasmPlugin } from "@rollup/plugin-wasm";
import { cyan } from "@visulima/colorize";
import { isAbsolute, relative, resolve } from "pathe";
import type { OutputOptions, Plugin, PreRenderedAsset, PreRenderedChunk, RollupLog, RollupOptions } from "rollup";
import { dts as dtsPlugin } from "rollup-plugin-dts";
import polifillPlugin from "rollup-plugin-polyfill-node";
import { visualizer as visualizerPlugin } from "rollup-plugin-visualizer";

import { DEFAULT_EXTENSIONS } from "../constants";
import type { BuildContext } from "../types";
import arrayIncludes from "../utils/array-includes";
import getPackageName from "../utils/get-package-name";
import { cjsInterop as cjsInteropPlugin } from "./plugins/cjs-interop";
import { copyPlugin } from "./plugins/copy";
import esbuildPlugin from "./plugins/esbuild";
import JSONPlugin from "./plugins/json";
import { jsxRemoveAttributes } from "./plugins/jsx-remove-attributes";
import { license as licensePlugin } from "./plugins/license";
import metafilePlugin from "./plugins/metafile";
import preserveDirectivesPlugin from "./plugins/preserve-directives";
import { rawPlugin } from "./plugins/raw";
import resolveFileUrlPlugin from "./plugins/resolve-file-url";
import { removeShebangPlugin, shebangPlugin } from "./plugins/shebang";
import shimCjsPlugin from "./plugins/shim-cjs";
import { patchTypescriptTypes as patchTypescriptTypesPlugin } from "./plugins/typescript/patch-typescript-types";
import { getConfigAlias, resolveTsconfigPaths as resolveTsconfigPathsPlugin } from "./plugins/typescript/resolve-tsconfig-paths";
import resolveTsconfigRootDirectoriesPlugin from "./plugins/typescript/resolve-tsconfig-root-dirs";
import resolveTypescriptMjsCtsPlugin from "./plugins/typescript/resolve-typescript-mjs-cjs";
import createSplitChunks from "./utils/chunks/create-split-chunks";
import getChunkFilename from "./utils/get-chunk-filename";
import getEntryFileNames from "./utils/get-entry-file-names";
import resolveAliases from "./utils/resolve-aliases";
import { sucrasePlugin } from "./plugins/sucrase";
// import nativeNodeModule from "./plugins/native-node-module";

const sharedOnWarn = (warning: RollupLog, context: BuildContext): boolean => {
    // If the circular dependency warning is from node_modules, ignore it
    if (warning.code === "CIRCULAR_DEPENDENCY" && /Circular dependency:[\s\S]*node_modules/.test(warning.message)) {
        return true;
    }

    // eslint-disable-next-line no-secrets/no-secrets
    // @see https:// github.com/rollup/rollup/blob/5abe71bd5bae3423b4e2ee80207c871efde20253/cli/run/batchWarnings.ts#L236
    if (warning.code === "UNRESOLVED_IMPORT") {
        context.logger.error(
            `Failed to resolve the module "${warning.exporter}" imported by "${cyan(relative(resolve(), warning.id as string))}"` +
                `\nIs the module installed? Note:` +
                `\n ↳ to inline a module into your bundle, install it to "devDependencies".` +
                `\n ↳ to depend on a module via import/require, install it to "dependencies".`,
        );

        process.exitCode = 1;

        return true;
    }

    // eslint-disable-next-line sonarjs/prefer-single-boolean-return
    if (warning.code === "MIXED_EXPORTS" && context.options.cjsInterop) {
        return true;
    }

    return false;
};

const calledImplicitExternals = new Map<string, boolean>();

// eslint-disable-next-line sonarjs/cognitive-complexity
const baseRollupOptions = (context: BuildContext, resolvedAliases: Record<string, string>): RollupOptions => {
    const findAlias = (id: string): string | undefined => {
        // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
        for (const [key, replacement] of Object.entries(resolvedAliases)) {
            if (id.startsWith(key)) {
                return id.replace(key, replacement);
            }
        }

        return undefined;
    };

    const configAlias = getConfigAlias(context.tsconfig, false);

    return <RollupOptions>{
        external(id) {
            const foundAlias = findAlias(id);

            if (foundAlias) {
                // eslint-disable-next-line no-param-reassign
                id = foundAlias;
            }

            // eslint-disable-next-line @typescript-eslint/naming-convention
            const package_ = getPackageName(id);
            const isExplicitExternal: boolean = arrayIncludes(context.options.externals, package_) || arrayIncludes(context.options.externals, id);

            if (isExplicitExternal) {
                return true;
            }

            if (id[0] === "." || isAbsolute(id) || /src[/\\]/.test(id) || (context.pkg.name && id.startsWith(context.pkg.name))) {
                return false;
            }

            if (configAlias) {
                // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
                for (const { find } of configAlias) {
                    if (find.test(id)) {
                        context.logger.debug(`Resolved alias ${id} to ${find.source}`);

                        return false;
                    }
                }
            }

            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            if (!isExplicitExternal && calledImplicitExternals.has(id)) {
                context.logger.info(`Inlined implicit external ${id}. If this is incorrect, add it to the "externals" option.`);
            }

            calledImplicitExternals.set(id, true);

            return isExplicitExternal;
        },

        input: Object.fromEntries(context.options.entries.map((entry) => [entry.name, resolve(context.options.rootDir, entry.input)])),

        onwarn(warning: RollupLog, rollupWarn) {
            if (sharedOnWarn(warning, context)) {
                return;
            }

            if (!warning.code) {
                rollupWarn(warning);
            }
        },

        watch: context.mode === "watch" ? context.options.rollup.watch : false,
    };
};

// eslint-disable-next-line sonarjs/cognitive-complexity
export const getRollupOptions = (context: BuildContext): RollupOptions => {
    const resolvedAliases = resolveAliases(context, "build");

    return (<RollupOptions>{
        ...baseRollupOptions(context, resolvedAliases),

        output: [
            context.options.rollup.emitCJS &&
                <OutputOptions>{
                    chunkFileNames: (chunk: PreRenderedChunk) => getChunkFilename(context, chunk, "cjs"),
                    dir: resolve(context.options.rootDir, context.options.outDir),
                    entryFileNames: (chunkInfo: PreRenderedAsset) => getEntryFileNames(chunkInfo, "cjs"),
                    exports: "auto",
                    externalLiveBindings: false,
                    format: "cjs",
                    freeze: false,
                    generatedCode: { constBindings: true },
                    // By default in rollup, when creating multiple chunks, transitive imports of entry chunks
                    // will be added as empty imports to the entry chunks. Disable to avoid imports hoist outside of boundaries
                    hoistTransitiveImports: false,
                    interop: "compat",
                    sourcemap: context.options.sourcemap,
                    ...context.options.rollup.output,
                    ...(context.options.rollup.output?.preserveModules
                        ? {
                              preserveModules: true,
                              preserveModulesRoot: context.options.rollup.output?.preserveModulesRoot || "src",
                          }
                        : { manualChunks: createSplitChunks(context.dependencyGraphMap, context.buildEntries), preserveModules: false }),
                },
            context.options.rollup.emitESM &&
                <OutputOptions>{
                    chunkFileNames: (chunk: PreRenderedChunk) => getChunkFilename(context, chunk, "mjs"),
                    dir: resolve(context.options.rootDir, context.options.outDir),
                    entryFileNames: (chunkInfo: PreRenderedAsset) => getEntryFileNames(chunkInfo, "mjs"),
                    exports: "auto",
                    externalLiveBindings: false,
                    format: "esm",
                    freeze: false,
                    generatedCode: { constBindings: true },
                    // By default in rollup, when creating multiple chunks, transitive imports of entry chunks
                    // will be added as empty imports to the entry chunks. Disable to avoid imports hoist outside of boundaries
                    hoistTransitiveImports: false,
                    sourcemap: context.options.sourcemap,
                    ...context.options.rollup.output,
                    ...(context.options.rollup.output?.preserveModules
                        ? {
                              preserveModules: true,
                              preserveModulesRoot: context.options.rollup.output?.preserveModulesRoot || "src",
                          }
                        : { manualChunks: createSplitChunks(context.dependencyGraphMap, context.buildEntries), preserveModules: false }),
                },
        ].filter(Boolean),

        plugins: [
            resolveFileUrlPlugin(),
            resolveTypescriptMjsCtsPlugin(),

            context.tsconfig && resolveTsconfigRootDirectoriesPlugin(context.options.rootDir, context.logger, context.tsconfig),
            context.tsconfig && resolveTsconfigPathsPlugin(context.tsconfig, context.logger),

            context.options.rollup.replace &&
                replacePlugin({
                    ...context.options.rollup.replace,
                    values: {
                        ...context.options.replace,
                        ...context.options.rollup.replace.values,
                    },
                }),

            context.options.rollup.alias &&
                aliasPlugin({
                    // https://github.com/rollup/plugins/tree/master/packages/alias#custom-resolvers
                    customResolver: nodeResolvePlugin({
                        extensions: DEFAULT_EXTENSIONS,
                        ...context.options.rollup.resolve,
                    }),
                    ...context.options.rollup.alias,
                    entries: resolvedAliases,
                }),

            // nativeNodeModule(),

            context.options.rollup.resolve &&
                nodeResolvePlugin({
                    extensions: DEFAULT_EXTENSIONS,
                    ...context.options.rollup.resolve,
                }),

            context.options.rollup.polyfillNode &&
                polifillPlugin({
                    sourceMap: context.options.sourcemap,
                    ...context.options.rollup.polyfillNode,
                }),

            context.options.rollup.json &&
                JSONPlugin({
                    ...context.options.rollup.json,
                }),

            preserveDirectivesPlugin(context.logger),

            shebangPlugin(
                context.options.entries
                    .filter((entry) => entry.isExecutable)
                    .map((entry) => entry.name)
                    .filter(Boolean) as string[],
            ),

            context.options.rollup.wsam && wasmPlugin(context.options.rollup.wsam),

            context.options.rollup.esbuild &&
                esbuildPlugin({
                    sourceMap: context.options.sourcemap,
                    ...context.options.rollup.esbuild,
                    logger: context.logger,
                }),

            context.options.rollup.sucrase && sucrasePlugin(context.options.rollup.sucrase),

            context.options.cjsInterop &&
                context.options.rollup.emitCJS &&
                cjsInteropPlugin({
                    ...context.options.rollup.cjsInterop,
                    logger: context.logger,
                    type: context.pkg.type ?? "commonjs",
                }),

            context.options.rollup.dynamicVars && dynamicImportVarsPlugin(),

            context.options.rollup.commonjs &&
                commonjsPlugin({
                    extensions: DEFAULT_EXTENSIONS,
                    sourceMap: context.options.sourcemap,
                    ...context.options.rollup.commonjs,
                }),

            context.options.rollup.preserveDynamicImports && {
                renderDynamicImport() {
                    return { left: "import(", right: ")" };
                },
            },

            context.options.rollup.shim && shimCjsPlugin(context.pkg),

            context.options.rollup.raw && rawPlugin(context.options.rollup.raw),

            context.options.rollup.jsxRemoveAttributes &&
                jsxRemoveAttributes({
                    attributes: context.options.rollup.jsxRemoveAttributes.attributes,
                    logger: context.logger,
                }),

            context.options.rollup.metafile &&
                metafilePlugin({
                    outDir: resolve(context.options.rootDir, context.options.outDir),
                    rootDir: context.options.rootDir,
                }),

            context.options.rollup.copy && copyPlugin(context.options.rollup.copy, context.logger),

            context.options.rollup.license &&
                context.options.rollup.license.path &&
                typeof context.options.rollup.license.template === "function" &&
                licensePlugin({
                    licenseFilePath: context.options.rollup.license.path,
                    licenseTemplate: context.options.rollup.license.template,
                    logger: context.logger,
                    marker: context.options.rollup.license.marker ?? "DEPENDENCIES",
                    mode: "dependencies",
                    packageName: context.pkg.name,
                }),

            context.options.rollup.visualizer &&
                visualizerPlugin({
                    brotliSize: true,
                    filename: "packem-bundle-analyze.html",
                    gzipSize: true,
                    projectRoot: context.options.rootDir,
                    sourcemap: context.options.sourcemap,
                    title: "Packem Visualizer",
                    ...context.options.rollup.visualizer,
                }),
        ].filter(Boolean),
    }) as RollupOptions;
};

export const getRollupDtsOptions = (context: BuildContext): RollupOptions => {
    const resolvedAliases = resolveAliases(context, "types");
    const ignoreFiles: Plugin = {
        load(id) {
            if (!/\.(?:js|cjs|mjs|jsx|ts|tsx|mts|json)$/.test(id)) {
                return "";
            }

            return null;
        },
        name: "packem:ignore-files",
    };

    const compilerOptions = context.tsconfig?.config?.compilerOptions;

    delete compilerOptions?.lib;

    return <RollupOptions>{
        ...baseRollupOptions(context, resolvedAliases),

        onwarn(warning, rollupWarn) {
            if (sharedOnWarn(warning, context)) {
                return;
            }

            if (warning.code === "EMPTY_BUNDLE") {
                return;
            }

            rollupWarn(warning);
        },

        output: [
            context.options.rollup.emitCJS &&
                <OutputOptions>{
                    chunkFileNames: (chunk: PreRenderedChunk) => getChunkFilename(context, chunk, "d.cts"),
                    dir: resolve(context.options.rootDir, context.options.outDir),
                    entryFileNames: "[name].d.cts",
                    format: "cjs",
                    sourcemap: context.options.sourcemap,
                    ...context.options.rollup.output,
                },
            <OutputOptions>{
                chunkFileNames: (chunk: PreRenderedChunk) => getChunkFilename(context, chunk, "d.mts"),
                dir: resolve(context.options.rootDir, context.options.outDir),
                entryFileNames: "[name].d.mts",
                format: "esm",
                sourcemap: context.options.sourcemap,
                ...context.options.rollup.output,
            },
            // .d.ts for node10 compatibility (TypeScript version < 4.7)
            (context.options.declaration === true || context.options.declaration === "compatible") &&
                <OutputOptions>{
                    chunkFileNames: (chunk: PreRenderedChunk) => getChunkFilename(context, chunk, "d.ts"),
                    dir: resolve(context.options.rootDir, context.options.outDir),
                    entryFileNames: "[name].d.ts",
                    format: "cjs",
                    sourcemap: context.options.sourcemap,
                    ...context.options.rollup.output,
                },
        ].filter(Boolean),

        plugins: [
            resolveFileUrlPlugin(),
            resolveTypescriptMjsCtsPlugin(),

            context.options.rollup.json &&
                JSONPlugin({
                    ...context.options.rollup.json,
                }),

            ignoreFiles,

            context.tsconfig && resolveTsconfigRootDirectoriesPlugin(context.options.rootDir, context.logger, context.tsconfig),
            context.tsconfig && resolveTsconfigPathsPlugin(context.tsconfig, context.logger),

            context.options.rollup.replace &&
                replacePlugin({
                    ...context.options.rollup.replace,
                    values: {
                        ...context.options.replace,
                        ...context.options.rollup.replace.values,
                    },
                }),

            context.options.rollup.alias &&
                aliasPlugin({
                    // https://github.com/rollup/plugins/tree/master/packages/alias#custom-resolvers
                    customResolver: nodeResolvePlugin({
                        extensions: DEFAULT_EXTENSIONS,
                        ...context.options.rollup.resolve,
                    }),
                    ...context.options.rollup.alias,
                    entries: resolvedAliases,
                }),

            context.options.rollup.resolve &&
                nodeResolvePlugin({
                    extensions: DEFAULT_EXTENSIONS,
                    ...context.options.rollup.resolve,
                }),

            context.options.rollup.dts &&
                dtsPlugin({
                    compilerOptions: {
                        ...context.options.rollup.dts.compilerOptions,
                        incremental: undefined,
                        inlineSources: undefined,
                        sourceMap: undefined,
                        tsBuildInfoFile: undefined,
                    },
                    respectExternal: context.options.rollup.dts.respectExternal,
                    tsconfig: context.tsconfig?.path,
                }),

            context.options.cjsInterop &&
                context.options.rollup.emitCJS &&
                cjsInteropPlugin({
                    ...context.options.rollup.cjsInterop,
                    logger: context.logger,
                    type: context.pkg.type ?? "commonjs",
                }),

            context.options.rollup.patchTypes && patchTypescriptTypesPlugin(context.options.rollup.patchTypes, context.logger),

            removeShebangPlugin(),

            context.options.rollup.license &&
                context.options.rollup.license.path &&
                typeof context.options.rollup.license.dtsTemplate === "function" &&
                licensePlugin({
                    licenseFilePath: context.options.rollup.license.path,
                    licenseTemplate: context.options.rollup.license.dtsTemplate,
                    logger: context.logger,
                    marker: context.options.rollup.license.marker ?? "TYPE_DEPENDENCIES",
                    mode: "types",
                    packageName: context.pkg.name,
                }),
        ].filter(Boolean),
    };
};
