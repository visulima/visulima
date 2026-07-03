import type { ViteDevServer } from "vite";

export interface SerializableModuleNode {
    id: string;
    importerCount: number;
    importerUrls: string[];
    url: string;
}

/** Hard cap to prevent memory exhaustion / unbounded WS payloads on huge module graphs */
const MAX_MODULES = 5000;

/**
 * Get module dependency graph as serializable objects.
 * Raw ModuleNode objects contain circular references (importers/importedModules)
 * which cannot be JSON-serialized; this function returns a flat, safe representation.
 * Importer URLs are extracted from each ModuleNode's importers Set before serialization
 * so the client can display the full "imported by" list without a second RPC call.
 * Vite-internal modules (ids starting with "/@") are skipped and the result is capped
 * at MAX_MODULES (5000) to bound the serialized WebSocket payload on large apps.
 * @param server Vite dev server instance
 * @returns Array of serializable module entries
 */
export const getModuleGraph = async (server: ViteDevServer): Promise<SerializableModuleNode[]> => {
    const { moduleGraph } = server;
    const modules: SerializableModuleNode[] = [];

    // Collect modules from the graph as plain serializable objects, bounded by MAX_MODULES
    for (const module of moduleGraph.idToModuleMap.values()) {
        if (modules.length >= MAX_MODULES) {
            break;
        }

        const id = module.id ?? module.url;
        const url = module.url ?? module.id;

        if (!id || !url) {
            continue;
        }

        // Skip Vite-internal virtual / fs modules (e.g. "/@vite/", "/@id/", "/@fs/")
        if (id.startsWith("/@")) {
            continue;
        }

        const importerUrls: string[] = [];

        module.importers.forEach((imp) => {
            const impUrl = imp.url ?? imp.id;

            if (impUrl) {
                importerUrls.push(impUrl);
            }
        });

        modules.push({
            id,
            importerCount: module.importers.size,
            importerUrls,
            url,
        });
    }

    return modules;
};
