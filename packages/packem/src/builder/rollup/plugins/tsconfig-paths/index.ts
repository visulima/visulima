import type { Plugin } from "rollup";

const tsconfigPaths = (): Plugin => {
    return {
        load(id) {
            // ...
        },
        name: "packem:tsconfig-paths",
        resolveId(importee, importer) {
            // ...
        }
    };
}

export default tsconfigPaths;
