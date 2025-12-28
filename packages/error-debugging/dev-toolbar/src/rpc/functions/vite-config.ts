import type { ViteDevServer } from 'vite';
import type { ServerFunctions } from '../../types/rpc.js';

/**
 * Get Vite configuration
 * @param server - Vite dev server instance
 * @returns Vite config object
 */
export const getViteConfig = async (server: ViteDevServer): Promise<Record<string, any>> => {
  return {
    root: server.config.root,
    mode: server.config.mode,
    base: server.config.base,
    resolve: {
      alias: server.config.resolve.alias,
    },
    server: {
      port: server.config.server?.port,
      host: server.config.server?.host,
      https: server.config.server?.https,
    },
    build: {
      outDir: server.config.build?.outDir,
    },
  };
};
