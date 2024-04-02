import { writeJsonSync } from "@visulima/fs";
import { resolve } from "pathe";
import type { Plugin } from "rollup";

export interface MetafileOptions {
    outDir: string;
    rootDir: string;
}

export interface MetaInfo {
    source: string;
    target: string;
}

export const metafilePlugin = (options: MetafileOptions): Plugin => ({
        async buildEnd() {
            const deps: MetaInfo[] = [];

            for (const id of this.getModuleIds()) {
                const m = this.getModuleInfo(id);

                if (m != null && !m.isExternal) {
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
    } as Plugin);
