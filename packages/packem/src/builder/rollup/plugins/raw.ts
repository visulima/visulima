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

export const rawPlugin = (options: RawLoaderOptions = {}): Plugin => {
    options = { ...options, ...defaults };

    const filter = createFilter(options.include, options.exclude);

    return {
        name: "packem-raw",
        transform(code, id) {
            if (filter(id)) {
                return {
                    code: `export default ${JSON.stringify(code)}`,
                    map: null,
                };
            }
        },
    };
};
