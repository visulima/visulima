/**
 * Modified copy of https://github.com/privatenumber/pkgroll/blob/develop/src/utils/rollup-plugins/resolve-typescript-mjs-cjs.ts
 *
 * MIT License
 *
 * Copyright (c) Hiroki Osame <hiroki.osame@gmail.com>
 */
import type { Plugin } from "rollup";

const resolveTypescriptMjsCts = (): Plugin => {
    const isJs = /\.(?:[mc]?js|jsx)$/;

    return {
        name: "packem:resolve-typescript-mjs-cjs",
        resolveId(id, importer, options) {
            if (isJs.test(id) && importer) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-return
                return this.resolve(id.replace(/js(x?)$/, "ts$1"), importer, options);
            }

            return null;
        },
    };
};

export default resolveTypescriptMjsCts;
