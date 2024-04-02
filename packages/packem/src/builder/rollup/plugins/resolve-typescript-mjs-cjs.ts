import type { Plugin } from "rollup";

const resolveTypescriptMjsCts = (): Plugin => {
    const isJs = /\.(?:[mc]?js|jsx)$/;

    return {
        name: "packem:resolve-typescript-mjs-cjs",
        resolveId(id, importer, options) {
            if (isJs.test(id) && importer) {
                return this.resolve(id.replace(/js(x?)$/, "ts$1"), importer, options);
            }

            return null;
        },
    };
};

export default resolveTypescriptMjsCts;
