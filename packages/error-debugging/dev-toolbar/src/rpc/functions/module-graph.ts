import type { ViteDevServer } from "vite";

export interface SerializableModuleNode {
    id: string;
    importerCount: number;
    url: string;
}

/**
 * Get module dependency graph as serializable objects.
 * Raw ModuleNode objects contain circular references (importers/importedModules)
 * which cannot be JSON-serialized; this function returns a flat, safe representation.
 * @param server Vite dev server instance
 * @returns Array of serializable module entries
 */
export const getModuleGraph = async (server: ViteDevServer): Promise<SerializableModuleNode[]> => {
    const { moduleGraph } = server;
    const modules: SerializableModuleNode[] = [];

    // Collect all modules from the graph as plain serializable objects
    moduleGraph.idToModuleMap.forEach((module) => {
        modules.push({
            id: module.id ?? module.url ?? "",
            importerCount: module.importers.size,
            url: module.url ?? module.id ?? "",
        });
    });

    return modules;
};
