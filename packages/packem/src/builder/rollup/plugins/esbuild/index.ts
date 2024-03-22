import { existsSync, statSync } from "fs";
import { extname, resolve, dirname, join } from "pathe";
import type { Plugin as RollupPlugin } from "rollup";
import type { Loader } from "esbuild";
import { transform } from "esbuild";
import { createFilter } from "@rollup/pluginutils";
import createDebug from "debug";
import { minify, getRenderChunk } from "./minify";
import { optimizeDeps as doOptimizeDeps } from "./optmize-deps";
import { findTSConfigSync } from "@visulima/package";
import warn from "./warn";
import type { Options, OptimizeDepsResult } from "./types";

export { minify };

const debugOptimizeDeps = createDebug("rpe:optimize-deps");

const defaultLoaders: { [ext: string]: Loader } = {
    ".js": "js",
    ".jsx": "jsx",
    ".ts": "ts",
    ".tsx": "tsx",
};

export default ({ include, exclude, sourceMap = true, optimizeDeps, tsconfig, loaders: _loaders, ...esbuildOptions }: Options = {}): RollupPlugin => {
    const loaders = {
        ...defaultLoaders,
    };

    if (_loaders) {
        for (let [key, value] of Object.entries(_loaders)) {
            key = key[0] === "." ? key : `.${key}`;

            if (typeof value === "string") {
                loaders[key] = value;
            } else if (value === false) {
                delete loaders[key];
            }
        }
    }

    const extensions: string[] = Object.keys(loaders);
    const INCLUDE_REGEXP = new RegExp(`\\.(${extensions.map((ext) => ext.slice(1)).join("|")})$`);
    const EXCLUDE_REGEXP = /node_modules/;

    const filter = createFilter(include || INCLUDE_REGEXP, exclude || EXCLUDE_REGEXP);

    const resolveFile = (resolved: string, index: boolean = false) => {
        const fileWithoutExt = resolved.replace(/\.[jt]sx?$/, "");
        for (const ext of extensions) {
            const file = index ? join(resolved, `index${ext}`) : `${fileWithoutExt}${ext}`;
            if (existsSync(file)) return file;
        }
        return null;
    };

    let optimizeDepsResult: OptimizeDepsResult | undefined;
    let cwd = process.cwd();

    return {
        name: "esbuild",

        options({ context }) {
            if (context) {
                cwd = context;
            }
            return null;
        },

        async buildStart() {
            if (!optimizeDeps || optimizeDepsResult) return;

            optimizeDepsResult = await doOptimizeDeps({
                cwd,
                sourceMap,
                ...optimizeDeps,
            });

            debugOptimizeDeps("optimized %O", optimizeDepsResult.optimized);
        },

        async resolveId(id, importer): Promise<undefined | string> {
            if (optimizeDepsResult?.optimized.has(id)) {
                const m = optimizeDepsResult.optimized.get(id)!;

                debugOptimizeDeps("resolved %s to %s", id, m.file);

                return m.file;
            }

            if (importer && id[0] === ".") {
                const resolved = resolve(importer ? dirname(importer) : process.cwd(), id);

                let file = resolveFile(resolved);

                if (file) {
                    return file;
                }

                if (!file && existsSync(resolved) && statSync(resolved).isDirectory()) {
                    file = resolveFile(resolved, true);
                    if (file) {
                        return file;
                    }
                }
            }

            return undefined;
        },

        async transform(code, id) {
            if (!filter(id) || optimizeDepsResult?.optimized.has(id)) {
                return null;
            }

            const ext = extname(id);
            const loader = loaders[ext];

            if (!loader) {
                return null;
            }

            const tsconfigRaw =
                tsconfig === false
                    ? undefined
                    : findTSConfigSync(id, {
                          configFileName: tsconfig,
                      });

            const result = await transform(code, {
                loader,
                sourcemap: sourceMap,
                sourcefile: id,
                tsconfigRaw,
                target: "es2020",
                format: (["base64", "binary", "dataurl", "text", "json"] satisfies Loader[] as Loader[]).includes(loader) ? "esm" : undefined,
                ...esbuildOptions,
            });

            await warn(this, result.warnings);

            return (
                result.code && {
                    code: result.code,
                    map: result.map || null,
                }
            );
        },

        renderChunk: getRenderChunk({
            ...esbuildOptions,
            sourceMap,
        }),
    };
};
