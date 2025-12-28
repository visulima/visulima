import type { ViteDevServer, WebSocketClient } from 'vite';
import type { ServerFunctions, ServerRPCContext } from '../types/rpc.js';
import { getViteConfig } from './functions/vite-config.js';
import { getModuleGraph } from './functions/module-graph.js';
import { openInEditor } from './functions/open-in-editor.js';

/**
 * Create default server functions bound to a server instance
 */
const createDefaultServerFunctions = (server: ViteDevServer): Partial<ServerFunctions> => ({
  getViteConfig: async () => getViteConfig(server),
  getModuleGraph: async () => getModuleGraph(server),
  openInEditor: async (_server: ViteDevServer, file: string, line?: number, column?: number) =>
    openInEditor(server, file, line, column),
  readFile: async (_server: ViteDevServer, path: string) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { readFile } = await import('node:fs/promises');
    const filePath = path.startsWith('/') ? path : `${server.config.root}/${path}`;
    return readFile(filePath, 'utf-8');
  },
});

/**
 * Creates server-side RPC context
 * @param server - Vite dev server instance
 * @param customFunctions - Custom server functions to register
 * @returns Server RPC context
 */
export const createServerRPCContext = (
  server: ViteDevServer,
  customFunctions?: Partial<ServerFunctions>,
): ServerRPCContext => {
  const defaultFunctions = createDefaultServerFunctions(server);
  const functions: ServerFunctions = {
    ...defaultFunctions,
    ...customFunctions,
  } as ServerFunctions;

  // Setup WebSocket handler for RPC calls
  server.ws.on('dev-toolbar:rpc', async (data: { method: string; args: any[]; id: string }, client: WebSocketClient) => {
    const { method, args, id } = data;
    const fn = functions[method];

    if (!fn) {
      client.send(JSON.stringify({
        type: 'custom',
        event: 'dev-toolbar:rpc:error',
        data: {
          id,
          error: `Unknown RPC method: ${method}`,
        },
      }));
      return;
    }

    try {
      // Call function (server is already bound in default functions)
      const result = await fn(server, ...args);
      client.send(JSON.stringify({
        type: 'custom',
        event: 'dev-toolbar:rpc:response',
        data: {
          id,
          result,
        },
      }));
    } catch (error) {
      client.send(JSON.stringify({
        type: 'custom',
        event: 'dev-toolbar:rpc:error',
        data: {
          id,
          error: error instanceof Error ? error.message : String(error),
        },
      }));
    }
  });

  return {
    server,
    registerFunction<K extends keyof ServerFunctions>(name: K, fn: ServerFunctions[K]): void {
      functions[name] = fn;
    },
    callClient<K extends keyof import('../types/rpc.js').ClientFunctions>(
      name: K,
      ...args: Parameters<import('../types/rpc.js').ClientFunctions[K]>
    ): void {
      server.ws.send({
        type: 'custom',
        event: 'dev-toolbar:client',
        data: {
          method: name,
          args,
        },
      });
    },
  };
};
