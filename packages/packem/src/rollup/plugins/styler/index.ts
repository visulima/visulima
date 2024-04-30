import path from "node:path";

import { createFilter } from "@rollup/pluginutils";
import cssnano from "cssnano";
import type { OutputAsset,OutputChunk, Plugin } from "rollup";

import Loaders from "./loaders";
import type { Extracted,LoaderContext } from "./loaders/types";
import type { ExtractedData, Options, PostCSSLoaderOptions } from "./types";
import concat from "./utils/concat";
import { ensurePCSSOption, ensurePCSSPlugins,ensureUseOption, inferHandlerOption, inferModeOption, inferOption, inferSourceMapOption } from "./utils/options";
import { humanlizePath, isAbsolutePath, isRelativePath,normalizePath } from "./utils/path";
import { mm } from "./utils/sourcemap";

export default (options: Options = {}): Plugin => {
    const isIncluded = createFilter(options.include, options.exclude);

    const sourceMap = inferSourceMapOption(options.sourceMap);
    const loaderOptions: PostCSSLoaderOptions = {
        ...inferModeOption(options.mode),

        autoModules: options.autoModules ?? false,
        config: inferOption(options.config, {}),
        dts: options.dts ?? false,
        extensions: options.extensions ?? [".css", ".pcss", ".postcss", ".sss"],
        import: inferHandlerOption(options.import, options.alias),

        minimize: inferOption(options.minimize, false),
        modules: inferOption(options.modules, false),
        namedExports: options.namedExports ?? false,
        postcss: {},
        to: options.to,
        url: inferHandlerOption(options.url, options.alias),
    };

    if (typeof loaderOptions.inject === "object" && loaderOptions.inject.treeshakeable && loaderOptions.namedExports) {
        throw new Error("`inject.treeshakeable` option is incompatible with `namedExports` option");
    }

    if (options.parser) {
        loaderOptions.postcss.parser = ensurePCSSOption(options.parser, "parser");
    }

    if (options.syntax) {
        loaderOptions.postcss.syntax = ensurePCSSOption(options.syntax, "syntax");
    }

    if (options.stringifier) {
        loaderOptions.postcss.stringifier = ensurePCSSOption(options.stringifier, "stringifier");
    }

    if (options.plugins) {
        loaderOptions.postcss.plugins = ensurePCSSPlugins(options.plugins);
    }

    const loaders = new Loaders({
        extensions: loaderOptions.extensions,
        loaders: options.loaders,
        use: [["postcss", loaderOptions], ...ensureUseOption(options), ["sourcemap", {}]],
    });

    let extracted: Extracted[] = [];

    const plugin: Plugin = {
        augmentChunkHash(chunk) {
            if (extracted.length === 0) {
                return;
            }

            const ids: string[] = [];

            for (const module of Object.keys(chunk.modules)) {
                const traversed = new Set<string>();

                let current = [module];

                do {
                    const imports: string[] = [];
                    for (const id of current) {
                        if (traversed.has(id)) {
                            continue;
                        }

                        if (loaders.isSupported(id)) {
                            if (isIncluded(id)) {
                                imports.push(id);
                            }

                            continue;
                        }

                        traversed.add(id);

                        const index = this.getModuleInfo(id);

                        index && imports.push(...index.importedIds);
                    }

                    current = imports;
                } while (current.some((id) => !loaders.isSupported(id)));
                ids.push(...current);
            }

            const hashable = extracted
                .filter((e) => ids.includes(e.id))
                .sort((a, b) => ids.lastIndexOf(a.id) - ids.lastIndexOf(b.id))
                .map((e) => `${path.basename(e.id)}:${e.css}`);

            if (hashable.length === 0) {
                return;
            }

            return hashable.join(":");
        },

        async generateBundle(options_, bundle) {
             
            if (extracted.length === 0 || !(options_.dir || options_.file)) {
                return;
            }

            const dir = options_.dir ?? path.dirname(options_.file!);
            const chunks = Object.values(bundle).filter((c): c is OutputChunk => c.type === "chunk");
            const manual = chunks.filter((c) => !c.facadeModuleId);
            const emitted = options_.preserveModules ? chunks : chunks.filter((c) => c.isEntry || c.isDynamicEntry);

            const emittedList: [string, string[]][] = [];

            const getExtractedData = async (name: string, ids: string[]): Promise<ExtractedData> => {
                const fileName =
                    typeof loaderOptions.extract === "string" ? normalizePath(loaderOptions.extract).replace(/^\.[/\\]/, "") : normalizePath(`${name}.css`);

                if (isAbsolutePath(fileName)) {
                    this.error(["Extraction path must be relative to the output directory,", `which is ${humanlizePath(dir)}`].join("\n"));
                }

                if (isRelativePath(fileName)) {
                    this.error(["Extraction path must be nested inside output directory,", `which is ${humanlizePath(dir)}`].join("\n"));
                }

                const entries = extracted.filter((e) => ids.includes(e.id)).sort((a, b) => ids.lastIndexOf(a.id) - ids.lastIndexOf(b.id));

                const res = await concat(entries);

                return {
                    css: res.css,
                    map: mm(res.map.toString())
                        .relative(path.dirname(path.resolve(dir, fileName)))
                        .toString(),
                    name: fileName,
                };
            };

            const getName = (chunk: OutputChunk): string => {
                if (options_.file) {
                    return path.parse(options_.file).name;
                }

                if (options_.preserveModules) {
                    const { dir, name } = path.parse(chunk.fileName);
                    return dir ? `${dir}/${name}` : name;
                }

                return chunk.name;
            };

            const getImports = (chunk: OutputChunk): string[] => {
                const ids: string[] = [];

                for (const module of Object.keys(chunk.modules)) {
                    const traversed = new Set<string>();

                    let current = [module];

                    do {
                        const imports: string[] = [];
                        for (const id of current) {
                            if (traversed.has(id)) {
                                continue;
                            }

                            if (loaders.isSupported(id)) {
                                if (isIncluded(id)) {
                                    imports.push(id);
                                }

                                continue;
                            }

                            traversed.add(id);

                            const index = this.getModuleInfo(id);

                            index && imports.push(...index.importedIds);
                        }

                        current = imports;
                    } while (current.some((id) => !loaders.isSupported(id)));

                    ids.push(...current);
                }

                return ids;
            };

            const moved: string[] = [];
            if (typeof loaderOptions.extract === "string") {
                const ids: string[] = [];

                for (const chunk of manual) {
                    const chunkIds = getImports(chunk);

                    moved.push(...chunkIds);
                    ids.push(...chunkIds);
                }

                for (const chunk of emitted) {
                    ids.push(...getImports(chunk).filter((id) => !moved.includes(id)));
                }

                const name = getName(chunks[0]);

                emittedList.push([name, ids]);
            } else {
                for (const chunk of manual) {
                    const ids = getImports(chunk);

                    if (ids.length === 0) {
                        continue;
                    }

                    moved.push(...ids);

                    const name = getName(chunk);

                    emittedList.push([name, ids]);
                }

                for (const chunk of emitted) {
                    const ids = getImports(chunk).filter((id) => !moved.includes(id));

                    if (ids.length === 0) {
                        continue;
                    }

                    const name = getName(chunk);

                    emittedList.push([name, ids]);
                }
            }

            for await (const [name, ids] of emittedList) {
                const res = await getExtractedData(name, ids);

                if (typeof options.onExtract === "function") {
                    const shouldExtract = options.onExtract(res);

                    if (!shouldExtract) {
                        continue;
                    }
                }

                // Perform minimization on the extracted file
                if (loaderOptions.minimize) {
                    const cssnanoOptions = typeof loaderOptions.minimize === "object" ? loaderOptions.minimize : {};
                    const minifier = cssnano(cssnanoOptions);

                    const resMin = await minifier.process(res.css, {
                        from: res.name,
                        map: sourceMap && {
                            annotation: false,
                            inline: false,
                            prev: res.map,
                            sourcesContent: sourceMap.content,
                        },
                        to: res.name,
                    });

                    res.css = resMin.css;
                    res.map = resMin.map?.toString();
                }

                const cssFile = { name: res.name, source: res.css, type: "asset" as const };
                const cssFileId = this.emitFile(cssFile);

                if (res.map && sourceMap) {
                    const fileName = this.getFileName(cssFileId);

                    const assetDir =
                        typeof options_.assetFileNames === "string"
                            ? normalizePath(path.dirname(options_.assetFileNames))
                            : typeof options_.assetFileNames === "function"
                              ? normalizePath(path.dirname(options_.assetFileNames(cssFile)))
                              : "assets"; // Default for Rollup v2

                    const map = mm(res.map)
                        .modify((m) => (m.file = path.basename(fileName)))
                        .modifySources((s) => {
                            // Compensate for possible nesting depending on `assetFileNames` value
                            if (s === "<no source>") {
                                return s;
                            }

                            if (assetDir.length <= 1) {
                                return s;
                            }

                            s = `../${s}`; // ...then there's definitely at least 1 level offset

                            for (const c of assetDir) {
                                if (c === "/") {
                                    s = `../${s}`;
                                }
                            }

                            return s;
                        });

                    if (sourceMap.inline) {
                        map.modify((m) => sourceMap.transform?.(m, normalizePath(dir, fileName)));

                        (bundle[fileName] as OutputAsset).source += map.toCommentData();
                    } else {
                        const mapFileName = `${fileName}.map`;

                        map.modify((m) => sourceMap.transform?.(m, normalizePath(dir, mapFileName)));

                        this.emitFile({ fileName: mapFileName, source: map.toString(), type: "asset" });

                        const { base } = path.parse(mapFileName);

                        (bundle[fileName] as OutputAsset).source += map.toCommentFile(base);
                    }
                }
            }
        },

        name: "styles",

        async transform(code, id) {
            if (!isIncluded(id) || !loaders.isSupported(id)) {
                return null;
            }

            // Skip empty files
            if (code.replaceAll(/\s/g, "") === "") {
                return null;
            }

            // Check if file was already processed into JS
            // by other instance(s) of this or other plugin(s)
            try {
                this.parse(code, {}); // If it doesn't throw...
                this.warn(`Skipping processed file ${humanlizePath(id)}`);

                return null;
            } catch {
                // Was not already processed, continuing
            }

            if (typeof options.onImport === "function") {
                options.onImport(code, id);
            }

            const context: LoaderContext = {
                assets: new Map<string, Uint8Array>(),
                deps: new Set(),
                id,
                options: {},
                plugin: this,
                sourceMap,
                warn: this.warn.bind(this),
            };

            const res = await loaders.process({ code }, context);

            for (const dep of context.deps) {
                this.addWatchFile(dep);
            }

            for (const [fileName, source] of context.assets) {
                this.emitFile({ fileName, source, type: "asset" });
            }

            if (res.extracted) {
                const { id } = res.extracted;

                extracted = extracted.filter((e) => e.id !== id);
                extracted.push(res.extracted);
            }

            return {
                code: res.code,
                map: sourceMap && res.map ? res.map : { mappings: "" as const },
                moduleSideEffects: res.extracted ? true : null,
            };
        },
    };

    return plugin;
};
