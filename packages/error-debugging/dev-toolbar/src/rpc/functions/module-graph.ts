import type { ModuleNode, ViteDevServer } from "vite";

/**
 * Get module dependency graph
 * @param server Vite dev server instance
 * @returns Array of module nodes
 */
export const getModuleGraph = async (server: ViteDevServer): Promise<ModuleNode[]> => {
    const { moduleGraph } = server;
    const modules: ModuleNode[] = [];

    // Collect all modules from the graph
    moduleGraph.idToModuleMap.forEach((module) => {
        modules.push(module);
    });

    return modules;
};
