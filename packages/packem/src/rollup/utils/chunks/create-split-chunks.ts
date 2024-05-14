// eslint-disable-next-line no-secrets/no-secrets
/**
 * Modified copy of https://github.com/huozhi/bunchee/blob/3cb85160bbad3af229654cc09d6fcd67120fe8bd/src/lib/split-chunk.ts
 *
 * The MIT License (MIT)
 *
 * Copyright (c) 2018 these people -> https://github.com/huozhi/bunchee/graphs/contributors
 */
import { basename, extname } from "@visulima/path";
import type { GetManualChunk } from "rollup";

import type { BuildContextBuildEntry } from "../../../types";
import getCustomModuleLayer from "./get-custom-module-layer";
import getModuleLayer from "./get-module-layer";

const createSplitChunks = (dependencyGraphMap: Map<string, Set<[string, string]>>, entryFiles: BuildContextBuildEntry[]): GetManualChunk => {
    // If there's existing chunk being splitted, and contains a layer { <id>: <chunkGroup> }
    const splitChunksGroupMap = new Map<string, string>();

    // eslint-disable-next-line sonarjs/cognitive-complexity
    return function splitChunks(id, context) {
        const moduleInfo = context.getModuleInfo(id);

        if (!moduleInfo) {
            return undefined;
        }

        const { isEntry } = moduleInfo;
        const moduleMeta = moduleInfo.meta;
        const moduleLayer = getModuleLayer(moduleMeta);

        if (!isEntry) {
            const cachedCustomModuleLayer = splitChunksGroupMap.get(id);

            if (cachedCustomModuleLayer) {
                return cachedCustomModuleLayer;
            }

            const customModuleLayer = getCustomModuleLayer(id);

            if (customModuleLayer) {
                splitChunksGroupMap.set(id, customModuleLayer);

                return customModuleLayer;
            }
        }

        // Collect the sub modules of the entry, if they're having layer, and the same layer with the entry, push them to the dependencyGraphMap.
        if (isEntry) {
            const subModuleIds = context.getModuleIds();

            for (const subId of subModuleIds) {
                const subModuleInfo = context.getModuleInfo(subId);
                if (!subModuleInfo) {
                    continue;
                }

                const subModuleLayer = getModuleLayer(moduleMeta);

                if (subModuleLayer === moduleLayer) {
                    if (!dependencyGraphMap.has(subId)) {
                        dependencyGraphMap.set(subId, new Set());
                    }

                    dependencyGraphMap.get(subId)!.add([id, moduleLayer]);
                }
            }
        }

        // If current module has a layer, and it's not an entry
        if (moduleLayer && !isEntry && // If the module is imported by the entry:
            // when the module layer is same as entry layer, keep it as part of entry and don't split it;
            // when the module layer is different from entry layer, split the module into a separate chunk as a separate boundary.
            dependencyGraphMap.has(id)) {
                const parentModuleIds = [...(dependencyGraphMap.get(id)!)];
                const isImportFromOtherEntry = parentModuleIds.some(([id]) => {
                    console.log(id);
                    // If other entry is dependency of this entry
                    if (entryFiles.some((entry) => entry.path === id)) {
                        const entryModuleInfo = context.getModuleInfo(id);
                        const entryModuleLayer = getModuleLayer(entryModuleInfo ? entryModuleInfo.meta : {});

                        return entryModuleLayer === moduleLayer;
                    }
                    return false;
                });
                if (isImportFromOtherEntry) {
                    return undefined;
                }

                const isPartOfCurrentEntry = parentModuleIds.every(([, layer]) => layer === moduleLayer);
                if (isPartOfCurrentEntry) {
                    if (splitChunksGroupMap.has(id)) {
                        return splitChunksGroupMap.get(id);
                    }

                    return undefined;
                }

                const chunkName = basename(id, extname(id));
                const chunkGroup = `${chunkName}-${moduleLayer}`;

                splitChunksGroupMap.set(id, chunkGroup);

                return chunkGroup;
            }

        return undefined;
    };
}

export default createSplitChunks;
