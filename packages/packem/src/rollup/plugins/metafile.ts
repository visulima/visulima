import { writeJsonSync } from "@visulima/fs";
import { resolve } from "@visulima/path";
import type { Plugin } from "rollup";

interface MetafileOptions {
    outDir: string;
    rootDir: string;
}

interface MetaInfo {
    source: string;
    target: string;
}

const metafilePlugin = (options: MetafileOptions): Plugin =>
    ({
        async buildEnd() {
            const deps: MetaInfo[] = [];

            // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
            for (const id of this.getModuleIds()) {
                const m = this.getModuleInfo(id);

                if (m != null && !m.isExternal) {
                    // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
                    for (const target of m.importedIds) {
                        deps.push({
                            source: id,
                            target,
                        });
                    }
                }
            }

            if (Array.isArray(deps) && deps.length === 0) {
                return;
            }

            const outPath = resolve(options.outDir, `graph.json`);

            writeJsonSync(outPath, deps);
        },
        name: "packem:metafile",
    }) as Plugin;

export default metafilePlugin;
