import path from "node:path";

import { normalizePath } from "../../utils/path";
import type { Loader } from "../types";
import importer from "./importer";

/** Options for Less loader */
export interface LESSLoaderOptions extends Record<string, unknown>, Less.Options {}

const loader: Loader<LESSLoaderOptions> = {
    name: "less",
    async process({ code, map }) {
        const options = { ...this.options };
        const less = await import("less").then((m) => m.default);

        if (!less) {
            throw new Error("You need to install `less` package in order to process Less files");
        }

        const plugins = [importer];

        if (options.plugins) {
            plugins.push(...options.plugins);
        }

        const res = await less.render(code, {
            ...options,
            filename: this.id,
            plugins,
            sourceMap: { outputSourceFiles: true, sourceMapBasepath: path.dirname(this.id) },
        });

        const deps = res.imports;

        for (const dep of deps) {
            this.deps.add(normalizePath(dep));
        }

        return { code: res.css, map: res.map ?? map };
    },
    test: /\.less$/i,
};

export default loader;
