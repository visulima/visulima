/**
 * Modified copy of https://github.com/egoist/rollup-plugin-esbuild/blob/dev/src/index.ts
 *
 * MIT License
 *
 * Copyright (c) 2020 EGOIST
 */
import { existsSync, statSync } from "node:fs";

import { createFilter } from "@rollup/pluginutils";
import type { Pail } from "@visulima/pail";
import type { Loader } from "esbuild";
import { transform } from "esbuild";
import { dirname, extname, resolve } from "pathe";
import type { Plugin as RollupPlugin } from "rollup";

import { DEFAULT_LOADERS, EXCLUDE_REGEXP } from "../../../constants";
import resolveFile from "../../utils/resolve-file";
import getRenderChunk from "./get-render-chunk";
import doOptimizeDeps from "./optmize-deps";
import type { OptimizeDepsResult, Options } from "./types";
import warn from "./warn";

type PluginConfig = Options & {
    logger: Pail<never, string>;
};

// eslint-disable-next-line sonarjs/cognitive-complexity
export default ({ exclude, include, loaders: _loaders, logger, optimizeDeps, sourceMap = true, ...esbuildOptions }: PluginConfig): RollupPlugin => {
    const loaders = DEFAULT_LOADERS;

    if (_loaders) {
        // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax,prefer-const
        for (let [key, value] of Object.entries(_loaders)) {
            key = key.startsWith(".") ? key : `.${key}`;

            if (typeof value === "string") {
                // eslint-disable-next-line security/detect-object-injection
                loaders[key] = value;
            } else if (value === false) {
                // eslint-disable-next-line @typescript-eslint/no-dynamic-delete,security/detect-object-injection
                delete loaders[key];
            }
        }
    }

    const extensions: string[] = Object.keys(loaders);
    // eslint-disable-next-line @rushstack/security/no-unsafe-regexp,security/detect-non-literal-regexp
    const INCLUDE_REGEXP = new RegExp(`\\.(${extensions.map((extension) => extension.slice(1)).join("|")})$`);

    const filter = createFilter(include || INCLUDE_REGEXP, exclude || EXCLUDE_REGEXP);

    let optimizeDepsResult: OptimizeDepsResult | undefined;
    let cwd = process.cwd();

    // Initialize own resolution cache.
    const resolveIdCache = new Map();

    return {
        async buildStart() {
            if (!optimizeDeps || optimizeDepsResult) {
                return;
            }

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

        async resolveId(id, importer, { isEntry }): Promise<string | null> {
            if (!importer || isEntry || !filter(id) || id.startsWith("\0")) {
                return null;
            }

            if (optimizeDepsResult?.optimized.has(id)) {
                const m = optimizeDepsResult.optimized.get(id);

                if (m) {
                    logger.debug("resolved %s to %s", id, m.file);

                    return m.file;
                }
            }

            // Some plugins sometimes cause the resolver to be called multiple times for the same id,
            // so we cache our results for faster response when this happens.
            // (undefined = not seen before, null = not handled by us, string = resolved)
            const resolvedId = resolveIdCache.get(id);

            if (resolvedId !== undefined) {
                return resolvedId as string | null;
            }

            if (importer && id[0] === ".") {
                const resolved = resolve(importer ? dirname(importer) : process.cwd(), id);

                let file = resolveFile(extensions, resolved);

                if (file) {
                    resolveIdCache.set(id, file);

                    return file as string;
                }

                // eslint-disable-next-line security/detect-non-literal-fs-filename
                if (!file && existsSync(resolved) && statSync(resolved).isDirectory()) {
                    file = resolveFile(extensions, resolved, true);

                    if (file) {
                        resolveIdCache.set(id, file);

                        return file as string;
                    }
                }
            }

            resolveIdCache.set(id, null);

            return null;
        },

        async transform(code, id) {
            if (!filter(id) || optimizeDepsResult?.optimized.has(id)) {
                return null;
            }

            const extension = extname(id);
            // eslint-disable-next-line security/detect-object-injection
            const loader = loaders[extension];

            if (!loader) {
                return null;
            }

            const result = await transform(code, {
                format: (["base64", "binary", "dataurl", "text", "json"] satisfies Loader[] as Loader[]).includes(loader) ? "esm" : undefined,
                loader,
                // @see https://github.com/evanw/esbuild/issues/1932#issuecomment-1013380565
                sourcefile: id.replace(/\.[cm]ts/, ".ts"),
                sourcemap: sourceMap,

                ...esbuildOptions,
            });

            await warn(this, result.warnings);

            if (result.code) {
                return {
                    code: result.code,
                    map: result.map || null,
                };
            }

            return null;
        },
    };
};
