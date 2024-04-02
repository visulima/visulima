import alias from "@rollup/plugin-alias";
import commonjs from "@rollup/plugin-commonjs";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import replace from "@rollup/plugin-replace";
import { isAbsolute, resolve } from "pathe";
import type { OutputOptions, PreRenderedChunk, RollupOptions } from "rollup";

import { DEFAULT_EXTENSIONS } from "../../constants";
import type { BuildContext } from "../../types";
import arrayIncludes from "../../utils/array-includes";
import arrayify from "../../utils/arrayify";
import getPackageName from "../../utils/get-package-name";
import warn from "../../utils/warn";
import getChunkFilename from "./get-chunk-filename";
import cjsPlugin from "./plugins/cjs";
import esbuildPlugin from "./plugins/esbuild";
import externalizeNodeBuiltins from "./plugins/externalize-node-builtins";
import JSONPlugin from "./plugins/json";
import { metafilePlugin } from "./plugins/metafile";
import { rawPlugin } from "./plugins/raw";
import resolveTypescriptMjsCts from "./plugins/resolve-typescript-mjs-cjs";
import { shebangPlugin } from "./plugins/shebang";
import resolveAliases from "./resolve-aliases";

const getRollupOptions = (context: BuildContext): RollupOptions =>
    (<RollupOptions>{
        external(id) {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            const package_ = getPackageName(id);
            const isExplicitExternal: boolean = arrayIncludes(context.options.externals, package_) || arrayIncludes(context.options.externals, id);

            if (isExplicitExternal) {
                return true;
            }

            if (context.options.rollup.inlineDependencies || id[0] === "." || isAbsolute(id) || /src[/\\]/.test(id) || id.startsWith(context.pkg.name)) {
                return false;
            }

            if (!isExplicitExternal) {
                warn(context, `Inlined implicit external ${id}`);
            }

            return isExplicitExternal;
        },

        input: Object.fromEntries(
            context.options.entries.filter((entry) => entry.builder === "rollup").map((entry) => [entry.name, resolve(context.options.rootDir, entry.input)]),
        ),

        onwarn(warning, rollupWarn) {
            if (!warning.code || !["CIRCULAR_DEPENDENCY"].includes(warning.code)) {
                rollupWarn(warning);
            }
        },

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
            externalizeNodeBuiltins({ target: arrayify(context.options.rollup.esbuild.target) }),
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
                    tsconfig: context.tsconfig,
                }),

            context.options.rollup.commonjs &&
                commonjs({
                    extensions: DEFAULT_EXTENSIONS,
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
        ].filter(Boolean),
    }) as RollupOptions;

export default getRollupOptions;
