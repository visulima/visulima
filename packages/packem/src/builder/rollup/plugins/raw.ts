import type { FilterPattern } from "@rollup/pluginutils";
import { createFilter } from "@rollup/pluginutils";
import type { Plugin } from "rollup";

const defaults: RawLoaderOptions = {
    exclude: [],
    include: [/\.(md|txt|css|htm|html)$/],
};

interface RawLoaderOptions {
    exclude?: FilterPattern;
    include?: FilterPattern;
}

const rawPlugin = (options: RawLoaderOptions = {}): Plugin => {
    // eslint-disable-next-line no-param-reassign
    options = { ...options, ...defaults };

    const filter = createFilter(options.include, options.exclude);

    return {
        name: "packem:raw",
        transform(code, id) {
            if (filter(id)) {
                return {
                    code: `export default ${JSON.stringify(code)}`,
                    map: null,
                };
            }

            return null;
        },
    };
};

export default rawPlugin;
