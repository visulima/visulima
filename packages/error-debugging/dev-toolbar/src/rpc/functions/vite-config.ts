import type { ViteDevServer } from "vite";

/**
 * Get Vite configuration
 * @param server Vite dev server instance
 * @returns Vite config object
 */
export const getViteConfig = async (server: ViteDevServer): Promise<Record<string, any>> => {
    return {
        base: server.config.base,
        build: {
            outDir: server.config.build?.outDir,
        },
        mode: server.config.mode,
        resolve: {
            alias: server.config.resolve.alias,
        },
        root: server.config.root,
        server: {
            host: server.config.server?.host,
            https: server.config.server?.https,
            port: server.config.server?.port,
        },
    };
};
