import type { TsConfigResult } from "@visulima/package";
import type { Plugin } from "rollup";

import createPathsMatcher from "./paths-matcher";

const resolveTsconfigPaths = (tsconfig: TsConfigResult, replaces: Record<string, string>): Plugin => {
    const matcher = createPathsMatcher(tsconfig)
    return {
        name: "packem:tsconfig-paths",
        resolveId(id, importer) {
            if (matcher !== undefined) {
                const results = matcher(id);
            }
        }
    };
}

export default resolveTsconfigPaths;
