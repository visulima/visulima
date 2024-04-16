import { existsSync, statSync } from "node:fs";

import { createFilter } from "@rollup/pluginutils";
import type { Loader } from "esbuild";
import { transform } from "esbuild";
import { dirname, extname, join, resolve } from "pathe";
import type { Plugin as RollupPlugin } from "rollup";

import logger from "../../../../logger";
import getRenderChunk from "./get-render-chunk";
import doOptimizeDeps from "./optmize-deps";
import type { OptimizeDepsResult, Options } from "./types";
import warn from "./warn";

const defaultLoaders: Record<string, Loader> = {
    ".cjs": "js",
    ".css": "css",
    ".cts": "ts",
    ".js": "js",
    // Add .json files support - require @rollup/plugin-json
    ".json": "json",
    ".jsx": "jsx",
    ".mjs": "js",
    ".mts": "ts",
    ".svg": "text",
    ".ts": "ts",
    ".tsx": "tsx",
};

// eslint-disable-next-line sonarjs/cognitive-complexity
export default ({ exclude, include, loaders: _loaders, optimizeDeps, sourceMap = true, ...esbuildOptions }: Options = {}): RollupPlugin => {
    const loaders = {
        ...defaultLoaders,
    };

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
    const EXCLUDE_REGEXP = /node_modules/;

    const filter = createFilter(include || INCLUDE_REGEXP, exclude || EXCLUDE_REGEXP);

    const resolveFile = (resolved: string, index = false) => {
        const fileWithoutExtension = resolved.replace(/\.[jt]sx?$/, "");

        // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
        for (const extension of extensions) {
            const file = index ? join(resolved, `index${extension}`) : `${fileWithoutExtension}${extension}`;

            // eslint-disable-next-line security/detect-non-literal-fs-filename
            if (existsSync(file)) {
                return file as string;
            }
        }

        return null;
    };

    let optimizeDepsResult: OptimizeDepsResult | undefined;
    let cwd = process.cwd();

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

        async resolveId(id, importer): Promise<string | null> {
            if (optimizeDepsResult?.optimized.has(id)) {
                const m = optimizeDepsResult.optimized.get(id);

                if (m) {
                    logger.debug("resolved %s to %s", id, m.file);

                    return m.file;
                }
            }

            if (importer && id[0] === ".") {
                const resolved = resolve(importer ? dirname(importer) : process.cwd(), id);

                let file = resolveFile(resolved);

                if (file) {
                    return file as string;
                }

                // eslint-disable-next-line security/detect-non-literal-fs-filename
                if (!file && existsSync(resolved) && statSync(resolved).isDirectory()) {
                    file = resolveFile(resolved, true);

                    if (file) {
                        return file as string;
                    }
                }
            }

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
