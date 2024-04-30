import { existsSync } from "node:fs";
import path from "node:path";

import { readFileSync } from "@visulima/fs";
import type { RawSourceMap } from "source-map-js";

import { normalizePath } from "../utils/path";
import { mm } from "../utils/sourcemap";
import type { Loader } from "./types";

/** Options for Stylus loader */
export interface StylusLoaderOptions extends Record<string, unknown>, stylus.PublicOptions {}

const loader: Loader<StylusLoaderOptions> = {
    name: "stylus",
    async process({ code, map }) {
        const options = { ...this.options };
        const stylus = (await import("stylus").then((m) => m.default)) as stylus.Stylus;
        if (!stylus) {
            throw new Error("You need to install `stylus` package in order to process Stylus files");
        }

        const basePath = normalizePath(path.dirname(this.id));

        const paths = [`${basePath}/node_modules`, basePath];

        if (options.paths) {
            paths.push(...options.paths);
        }

        const style = stylus(code, options).set("filename", this.id).set("paths", paths).set("sourcemap", { basePath, comment: false });

        const render = async (): Promise<string> =>
            await new Promise((resolve, reject) => {
                style.render((error, css) => (error ? reject(error) : resolve(css)));
            });

        code = await render();

        const deps = style.deps();
        for (const dep of deps) this.deps.add(normalizePath(dep));

        // We have to manually modify the `sourcesContent` field
        // since stylus compiler doesn't support it yet
        if (style.sourcemap?.sources && !style.sourcemap.sourcesContent) {
            style.sourcemap.sourcesContent = await Promise.all(
                style.sourcemap.sources.map(async (source) => {
                    const file = normalizePath(basePath, source);
                    const exists = existsSync(file);

                    if (!exists) {
                        return null as unknown as string;
                    }

                    return readFileSync(file);
                }),
            );
        }

        map = mm(style.sourcemap as unknown as RawSourceMap).toString() ?? map;

        return { code, map };
    },
    test: /\.(styl|stylus)$/i,
};

export default loader;
