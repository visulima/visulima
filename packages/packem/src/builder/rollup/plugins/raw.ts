import type { FilterPattern } from "@rollup/pluginutils";
import { createFilter } from "@rollup/pluginutils";
import type { Plugin } from "rollup";

export interface RawLoaderOptions {
    exclude?: FilterPattern;
    include?: FilterPattern;
}

const defaults: RawLoaderOptions = {
    exclude: [],
    include: [/\.(md|txt|css|htm|html)$/],
};

export function rawPlugin(options: RawLoaderOptions = {}): Plugin {
    options = { ...options, ...defaults };
    const filter = createFilter(options.include, options.exclude);
    return {
        name: "pack-raw",
        transform(code, id) {
            if (filter(id)) {
                return {
                    code: `export default ${JSON.stringify(code)}`,
                    map: null,
                };
            }
        },
    };
}
