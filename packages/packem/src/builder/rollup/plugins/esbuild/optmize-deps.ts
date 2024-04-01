import fs from "node:fs";

import { findCacheDirectory } from "@visulima/package";
import { init, parse } from "es-module-lexer";
import { build } from "esbuild";
import { join } from "pathe";

import type { Optimized, OptimizeDepsOptions, OptimizeDepsResult } from "./types";

const slash = (p: string) => p.replaceAll('\\', "/");

const optimizeDeps = async (options: OptimizeDepsOptions): Promise<OptimizeDepsResult> => {
    // eslint-disable-next-line unicorn/prevent-abbreviations
    const cacheDir = await findCacheDirectory("packem/optimize_deps", {
        create: true,
        cwd: options.cwd,
    });

    await init;
    await build({
        absWorkingDir: options.cwd,
        bundle: true,
        entryPoints: options.include,
        format: "esm",
        ignoreAnnotations: true,
        metafile: true,
        outdir: cacheDir,
        sourcemap: options.sourceMap,
        splitting: true,
        ...options.esbuildOptions,
        plugins: [
            {
                name: "optimize-deps",
                async setup(build) {
                    build.onResolve({ filter: /.*/ }, async (arguments_) => {
                        if (options.exclude?.includes(arguments_.path)) {
                            return {
                                external: true,
                            };
                        }

                        if (arguments_.pluginData?.__resolving_dep_path__) {
                            return; // use default resolve algorithm
                        }

                        if (options.include.includes(arguments_.path)) {
                            const resolved = await build.resolve(arguments_.path, {
                                kind: "import-statement",
                                pluginData: { __resolving_dep_path__: true },
                                resolveDir: arguments_.resolveDir,
                            });

                            if (resolved.errors.length > 0 || resolved.warnings.length > 0) {
                                return resolved;
                            }

                            return {
                                namespace: "optimize-deps",
                                path: arguments_.path,
                                pluginData: {
                                    absolute: resolved.path,
                                    resolveDir: arguments_.resolveDir,
                                },
                            };
                        }
                    });
                    build.onLoad({ filter: /.*/, namespace: "optimize-deps" }, async (arguments_) => {
                        const { absolute, resolveDir } = arguments_.pluginData;
                        const contents = await fs.promises.readFile(absolute, "utf8");
                        const [, exported] = parse(contents);

                        return {
                            contents: exported.length > 0 ? `export * from '${slash(absolute)}'` : `module.exports = require('${slash(absolute)}')`,
                            resolveDir,
                        };
                    });
                },
            },
            ...(options.esbuildOptions?.plugins || []),
        ],
    });

    const optimized: Optimized = new Map();

    // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
    for (const id of options.include) {
        optimized.set(id, { file: join(cacheDir, `${id}.js`) });
    }

    return {
        cacheDir,
        optimized,
    };
};

export default optimizeDeps;
