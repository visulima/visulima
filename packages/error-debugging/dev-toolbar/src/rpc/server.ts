import type { ViteDevServer, WebSocketClient } from "vite";

import type { ServerFunctions, ServerRPCContext } from "../types/rpc";
import { getModuleGraph } from "./functions/module-graph";
import { openInEditor } from "./functions/open-in-editor";
import { getTailwindConfig } from "./functions/tailwind-config";
import { getViteConfig } from "./functions/vite-config";

/**
 * Create default server functions bound to a server instance
 */
const createDefaultServerFunctions = (server: ViteDevServer): Partial<ServerFunctions> => {
    return {
        getModuleGraph: async () => getModuleGraph(server),
        getTailwindConfig: async () => getTailwindConfig(server),
        getViteConfig: async () => getViteConfig(server),
        openInEditor: async (file: string, line?: number, column?: number) => openInEditor(server, file, line, column),
        readFile: async (path: string) => {
            const { readFile } = await import("node:fs/promises");
            const filePath = path.startsWith("/") ? path : `${server.config.root}/${path}`;

            return readFile(filePath, "utf-8");
        },
    };
};

/**
 * Creates server-side RPC context
 * @param server Vite dev server instance
 * @param customFunctions Custom server functions to register
 * @returns Server RPC context
 */
export const createServerRPCContext = (server: ViteDevServer, customFunctions?: Partial<ServerFunctions>): ServerRPCContext => {
    const defaultFunctions = createDefaultServerFunctions(server);
    const functions: ServerFunctions = {
        ...defaultFunctions,
        ...customFunctions,
    } as ServerFunctions;

    // Setup WebSocket handler for RPC calls
    server.ws.on("dev-toolbar:rpc", async (data: { args: any[]; id: string; method: string }, client: WebSocketClient) => {
        const { args, id, method } = data;
        const function_ = functions[method];

        if (!function_) {
            client.send("dev-toolbar:rpc:error", {
                error: `Unknown RPC method: ${method}`,
                id,
            });

            return;
        }

        try {
            // All registered functions already close over `server` via
            // createDefaultServerFunctions, so just spread the RPC args.
            const result = await function_(...args);

            client.send("dev-toolbar:rpc:response", { id, result });
        } catch (error) {
            client.send("dev-toolbar:rpc:error", {
                error: error instanceof Error ? error.message : String(error),
                id,
            });
        }
    });

    return {
        callClient<K extends keyof import("../types/rpc.js").ClientFunctions>(
            name: K,
            ...args: Parameters<import("../types/rpc.js").ClientFunctions[K]>
        ): void {
            server.ws.send({
                data: {
                    args,
                    method: name,
                },
                event: "dev-toolbar:client",
                type: "custom",
            });
        },
        registerFunction<K extends keyof ServerFunctions>(name: K, function_: ServerFunctions[K]): void {
            functions[name] = function_;
        },
        server,
    };
};
