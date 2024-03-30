import { existsSync, statSync } from "node:fs";

import { createFilter } from "@rollup/pluginutils";
import type { Loader } from "esbuild";
import { transform } from "esbuild";
import { dirname, extname, join,resolve } from "pathe";
import type { Plugin as RollupPlugin } from "rollup";

import logger from "../../../../logger";
import { getRenderChunk } from "./get-render-chunk";
import { optimizeDeps as doOptimizeDeps } from "./optmize-deps";
import type { OptimizeDepsResult,Options } from "./types";
import warn from "./warn";

const defaultLoaders: Record<string, Loader> = {
    ".js": "js",
    ".jsx": "jsx",
    ".ts": "ts",
    ".tsx": "tsx",
};

export default ({ exclude, include, loaders: _loaders, optimizeDeps, sourceMap = true, tsconfig, ...esbuildOptions }: Options = {}): RollupPlugin => {
    const loaders = {
        ...defaultLoaders,
    };

    if (_loaders) {
        for (let [key, value] of Object.entries(_loaders)) {
            key = key.startsWith(".") ? key : `.${key}`;

            if (typeof value === "string") {
                loaders[key] = value;
            } else if (value === false) {
                delete loaders[key];
            }
        }
    }

    const extensions: string[] = Object.keys(loaders);
    const INCLUDE_REGEXP = new RegExp(`\\.(${extensions.map((extension) => extension.slice(1)).join("|")})$`);
    const EXCLUDE_REGEXP = /node_modules/;

    const filter = createFilter(include || INCLUDE_REGEXP, exclude || EXCLUDE_REGEXP);

    const resolveFile = (resolved: string, index = false) => {
        const fileWithoutExtension = resolved.replace(/\.[jt]sx?$/, "");

        for (const extension of extensions) {
            const file = index ? join(resolved, `index${extension}`) : `${fileWithoutExtension}${extension}`;

            if (existsSync(file)) {
                return file;
            }
        }

        return null;
    };

    let optimizeDepsResult: OptimizeDepsResult | undefined;
    let cwd = process.cwd();

    return {
        async buildStart() {
            if (!optimizeDeps || optimizeDepsResult)
return;

            optimizeDepsResult = await doOptimizeDeps({
                cwd,
                sourceMap,
                ...optimizeDeps,
            });

            logger.debug("optimized %O", optimizeDepsResult.optimized);
        },

        name: "esbuild",

        options({ context }) {
            if (context) {
                cwd = context;
            }
            return null;
        },

        renderChunk: getRenderChunk({
            ...esbuildOptions,
            sourceMap,
        }),

        async resolveId(id, importer): Promise<string | undefined> {
            if (optimizeDepsResult?.optimized.has(id)) {
                const m = optimizeDepsResult.optimized.get(id)!;

                logger.debug("resolved %s to %s", id, m.file);

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

            const extension = extname(id);
            const loader = loaders[extension];

            if (!loader) {
                return null;
            }

            const result = await transform(code, {
                format: (["base64", "binary", "dataurl", "text", "json"] satisfies Loader[] as Loader[]).includes(loader) ? "esm" : undefined,
                loader,
                sourcefile: id,
                sourcemap: sourceMap,
                target: "es2020",
                tsconfigRaw: tsconfig,
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
    };
};
