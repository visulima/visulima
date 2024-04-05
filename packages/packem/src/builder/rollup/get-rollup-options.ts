import alias from "@rollup/plugin-alias";
import commonjs from "@rollup/plugin-commonjs";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import replace from "@rollup/plugin-replace";
import { cyan } from "@visulima/colorize";
import { isAbsolute, relative, resolve } from "pathe";
import type { OutputOptions, Plugin, PreRenderedChunk, RollupLog, RollupOptions } from "rollup";
import { dts } from "rollup-plugin-dts";
import polifill from "rollup-plugin-polyfill-node";

import { DEFAULT_EXTENSIONS } from "../../constants";
import logger from "../../logger";
import type { BuildContext } from "../../types";
import arrayIncludes from "../../utils/array-includes";
import getPackageName from "../../utils/get-package-name";
import cjsPlugin from "./plugins/cjs";
import esbuildPlugin from "./plugins/esbuild";
import externalizeNodeBuiltins from "./plugins/externalize-node-builtins";
import JSONPlugin from "./plugins/json";
import { license } from "./plugins/license";
import metafilePlugin from "./plugins/metafile";
import rawPlugin from "./plugins/raw";
import resolveFileUrl from "./plugins/resolve-file-url";
import resolveTypescriptMjsCts from "./plugins/resolve-typescript-mjs-cjs";
import { removeShebangPlugin, shebangPlugin } from "./plugins/shebang";
import { patchTypes } from "./plugins/typescript/patch-types";
import getChunkFilename from "./utils/get-chunk-filename";
import resolveAliases from "./utils/resolve-aliases";

const sharedOnWarn = (warning: RollupLog): boolean => {
    // eslint-disable-next-line no-secrets/no-secrets
    // @see https:// github.com/rollup/rollup/blob/5abe71bd5bae3423b4e2ee80207c871efde20253/cli/run/batchWarnings.ts#L236
    if (warning.code === "UNRESOLVED_IMPORT") {
        logger.error(
            `Failed to resolve the module "${warning.exporter}" imported by "${cyan(relative(resolve(), warning.id as string))}"` +
                `\nIs the module installed? Note:` +
                `\n ↳ to inline a module into your bundle, install it to "devDependencies".` +
                `\n ↳ to depend on a module via import/require, install it to "dependencies".`,
        );

        process.exitCode = 1;

        return true;
    }

    return false;
};

const calledImplicitExternals = new Map<string, boolean>();

const baseRollupOptions = (context: BuildContext): RollupOptions =>
    <RollupOptions>{
        external(id) {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            const package_ = getPackageName(id);
            const isExplicitExternal: boolean = arrayIncludes(context.options.externals, package_) || arrayIncludes(context.options.externals, id);

            if (isExplicitExternal) {
                return true;
            }

            if (id[0] === "." || isAbsolute(id) || /src[/\\]/.test(id) || (context.pkg.name && id.startsWith(context.pkg.name))) {
                return false;
            }

            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            if (!isExplicitExternal && calledImplicitExternals.has(id)) {
                logger.info(`Inlined implicit external ${id}. If this is incorrect, add it to the "externals" option.`);
            }

            calledImplicitExternals.set(id, true);

            return isExplicitExternal;
        },

        input: Object.fromEntries(
            context.options.entries.filter((entry) => entry.builder === "rollup").map((entry) => [entry.name, resolve(context.options.rootDir, entry.input)]),
        ),

        onwarn(warning: RollupLog, rollupWarn) {
            if (sharedOnWarn(warning)) {
                return;
            }

            if (!warning.code || !["CIRCULAR_DEPENDENCY"].includes(warning.code)) {
                rollupWarn(warning);
            }
        },
    };

export const getRollupOptions = (context: BuildContext): RollupOptions =>
    (<RollupOptions>{
        ...baseRollupOptions(context),

        output: [
            context.options.rollup.emitCJS &&
                <OutputOptions>{
                    chunkFileNames: (chunk: PreRenderedChunk) => getChunkFilename(context, chunk, "cjs"),
                    dir: resolve(context.options.rootDir, context.options.outDir),
                    entryFileNames: "[name].cjs",
                    exports: "auto",
                    externalLiveBindings: false,
                    format: "cjs",
                    freeze: false,
                    generatedCode: { constBindings: true },
                    interop: "compat",
                    sourcemap: context.options.sourcemap,
                    ...context.options.rollup.output,
                },
            <OutputOptions>{
                chunkFileNames: (chunk: PreRenderedChunk) => getChunkFilename(context, chunk, "mjs"),
                dir: resolve(context.options.rootDir, context.options.outDir),
                entryFileNames: "[name].mjs",
                exports: "auto",
                externalLiveBindings: false,
                format: "esm",
                freeze: false,
                generatedCode: { constBindings: true },
                sourcemap: context.options.sourcemap,
                ...context.options.rollup.output,
            },
        ].filter(Boolean),

        plugins: [
            externalizeNodeBuiltins([context.options.target]),

            resolveFileUrl(),

            resolveTypescriptMjsCts(),

            context.options.rollup.replace &&
                replace({
                    ...context.options.rollup.replace,
                    values: {
                        ...context.options.replace,
                        ...context.options.rollup.replace.values,
                    },
                }),

            context.options.rollup.alias &&
                alias({
                    // https://github.com/rollup/plugins/tree/master/packages/alias#custom-resolvers
                    customResolver: nodeResolve({
                        extensions: DEFAULT_EXTENSIONS,
                        ...context.options.rollup.resolve,
                    }),
                    ...context.options.rollup.alias,
                    entries: resolveAliases(context),
                }),

            context.options.rollup.resolve &&
                nodeResolve({
                    extensions: DEFAULT_EXTENSIONS,
                    ...context.options.rollup.resolve,
                }),

            context.options.rollup.polyfillNode &&
                polifill({
                    sourceMap: context.options.sourcemap,
                    ...context.options.rollup.polyfillNode,
                }),

            context.options.rollup.json &&
                JSONPlugin({
                    ...context.options.rollup.json,
                }),

            shebangPlugin(
                context.options.entries
                    .filter((entry) => entry.isExecutable)
                    .map((entry) => entry.name)
                    .filter(Boolean) as string[],
            ),

            context.options.rollup.esbuild &&
                esbuildPlugin({
                    sourceMap: context.options.sourcemap,
                    ...context.options.rollup.esbuild,
                }),

            context.options.rollup.commonjs &&
                commonjs({
                    extensions: DEFAULT_EXTENSIONS,
                    sourceMap: context.options.sourcemap,
                    ...context.options.rollup.commonjs,
                }),

            context.options.rollup.preserveDynamicImports && {
                renderDynamicImport() {
                    return { left: "import(", right: ")" };
                },
            },

            context.options.rollup.cjsBridge && cjsPlugin(),

            rawPlugin(),

            context.options.rollup.metafile &&
                metafilePlugin({
                    outDir: resolve(context.options.rootDir, context.options.outDir),
                    rootDir: context.options.rootDir,
                }),

            context.options.rollup.license &&
                context.options.rollup.license.path &&
                typeof context.options.rollup.license.template === "function" &&
                license(
                    context.options.rollup.license.path,
                    context.options.rollup.license.marker ?? "DEPENDENCIES",
                    context.pkg.name,
                    context.options.rollup.license.template,
                    "dependencies",
                ),
        ].filter(Boolean),
    }) as RollupOptions;

export const getRollupDtsOptions = (context: BuildContext): RollupOptions => {
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
        ...baseRollupOptions(context),

        onwarn(warning, rollupWarn) {
            if (sharedOnWarn(warning)) {
                return;
            }

            if (warning.code === "CIRCULAR_DEPENDENCY" || warning.code === "EMPTY_BUNDLE") {
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
            externalizeNodeBuiltins([context.options.target]),

            resolveFileUrl(),

            resolveTypescriptMjsCts(),

            context.options.rollup.replace &&
                replace({
                    ...context.options.rollup.replace,
                    values: {
                        ...context.options.replace,
                        ...context.options.rollup.replace.values,
                    },
                }),

            context.options.rollup.alias &&
                alias({
                    // https://github.com/rollup/plugins/tree/master/packages/alias#custom-resolvers
                    customResolver: nodeResolve({
                        extensions: DEFAULT_EXTENSIONS,
                        ...context.options.rollup.resolve,
                    }),
                    ...context.options.rollup.alias,
                    entries: resolveAliases(context),
                }),

            context.options.rollup.resolve &&
                nodeResolve({
                    extensions: DEFAULT_EXTENSIONS,
                    ...context.options.rollup.resolve,
                }),

            context.options.rollup.json &&
                JSONPlugin({
                    ...context.options.rollup.json,
                }),

            ignoreFiles,

            context.options.rollup.dts &&
                dts({
                    compilerOptions: {
                        ...context.options.rollup.dts.compilerOptions,
                    },
                    respectExternal: context.options.rollup.dts.respectExternal,
                    tsconfig: context.tsconfig?.path,
                }),

            context.options.rollup.patchTypes && patchTypes(context.options.rollup.patchTypes),

            removeShebangPlugin(),

            context.options.rollup.license &&
                context.options.rollup.license.path &&
                typeof context.options.rollup.license.dtsTemplate === "function" &&
                license(
                    context.options.rollup.license.path,
                    context.options.rollup.license.dtsMarker ?? "TYPE_DEPENDENCIES",
                    context.pkg.name,
                    context.options.rollup.license.dtsTemplate,
                    "types",
                ),
        ].filter(Boolean),
    };
};
