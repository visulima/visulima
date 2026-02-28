import type { ViteDevServer } from "vite";

export interface SerializableModuleNode {
    id: string;
    importerCount: number;
    importerUrls: string[];
    url: string;
}

/**
 * Get module dependency graph as serializable objects.
 * Raw ModuleNode objects contain circular references (importers/importedModules)
 * which cannot be JSON-serialized; this function returns a flat, safe representation.
 * Importer URLs are extracted from each ModuleNode's importers Set before serialization
 * so the client can display the full "imported by" list without a second RPC call.
 * @param {import('vite').ViteDevServer} server Vite dev server instance
 * @returns {Promise<SerializableModuleNode[]>} Array of serializable module entries
 */
export const getModuleGraph = async (server: ViteDevServer): Promise<SerializableModuleNode[]> => {
    const { moduleGraph } = server;
    const modules: SerializableModuleNode[] = [];

    // Collect all modules from the graph as plain serializable objects
    moduleGraph.idToModuleMap.forEach((module) => {
        const importerUrls: string[] = [];

        module.importers.forEach((imp) => {
            const impUrl = imp.url ?? imp.id;

            if (impUrl) {
                importerUrls.push(impUrl);
            }
        });

        const id = module.id ?? module.url;
        const url = module.url ?? module.id;

        if (!id || !url) {
            return;
        }

        modules.push({
            id,
            importerCount: module.importers.size,
            importerUrls,
            url,
        });
    });

    return modules;
};
