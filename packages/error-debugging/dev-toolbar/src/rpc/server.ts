import type { ViteDevServer, WebSocketClient } from "vite";

import type { CreateAnnotationData, UpdateAnnotationData } from "../types/annotations";
import type { ClientFunctions, ServerFunctions, ServerRPCContext } from "../types/rpc";
import {
    addAnnotationAttachment,
    createAnnotation,
    deleteAnnotation,
    getAnnotationAttachment,
    getAnnotations,
    getScreenshot,
    removeAnnotationAttachment,
    saveScreenshot,
    updateAnnotation,
} from "./functions/annotations";
import { getStaticAssets } from "./functions/assets";
import { exportSession } from "./functions/export-session";
import { getModuleGraph } from "./functions/module-graph";
import { openInEditor } from "./functions/open-in-editor";
import { getTailwindConfig } from "./functions/tailwind-config";
import { getViteConfig } from "./functions/vite-config";

/**
 * Creates default server functions bound to a server instance.
 */
const createDefaultServerFunctions = (server: ViteDevServer, options: { editor?: string } = {}): Partial<ServerFunctions> => {
    return {
        addAnnotationAttachment: async (annotationId: string, dataUrl: string, name?: string) => addAnnotationAttachment(server, annotationId, dataUrl, name),
        createAnnotation: async (data: CreateAnnotationData) => createAnnotation(server, data),
        deleteAnnotation: async (id: string) => deleteAnnotation(server, id),
        exportSession: async (markdown: string) => exportSession(server, markdown),
        getAnnotationAttachment: async (attachmentPath: string) => getAnnotationAttachment(server, attachmentPath),
        getAnnotations: async () => getAnnotations(server),
        getModuleGraph: async () => getModuleGraph(server),
        getScreenshot: async (annotationId: string) => getScreenshot(server, annotationId),
        getStaticAssets: async () => getStaticAssets(server),
        getTailwindConfig: async () => getTailwindConfig(server),
        getViteConfig: async () => getViteConfig(server),
        openInEditor: async (file: string, line?: number, column?: number, editor?: string) =>
            openInEditor(server, file, line, column, editor || options.editor),
        readFile: async (path: string) => {
            const { readFile } = await import("node:fs/promises");
            const filePath = path.startsWith("/") ? path : `${server.config.root}/${path}`;

            return readFile(filePath, "utf8");
        },
        removeAnnotationAttachment: async (annotationId: string, attachmentPath: string) => removeAnnotationAttachment(server, annotationId, attachmentPath),
        saveScreenshot: async (annotationId: string, dataUrl: string) => saveScreenshot(server, annotationId, dataUrl),
        updateAnnotation: async (id: string, data: UpdateAnnotationData) => updateAnnotation(server, id, data),
    };
};

/**
 * Creates server-side RPC context.
 * @param server Vite dev server instance.
 * @param customFunctions Custom server functions to register.
 * @param options Additional options (e.g. which editor to launch).
 * @param options.editor Editor to use for "open in editor" functionality.
 * @returns Server RPC context.
 */
const createServerRPCContext = (server: ViteDevServer, customFunctions?: Partial<ServerFunctions>, options: { editor?: string } = {}): ServerRPCContext => {
    const defaultFunctions = createDefaultServerFunctions(server, options);
    const functions: ServerFunctions = {
        ...defaultFunctions,
        ...customFunctions,
    } as ServerFunctions;

    // Setup WebSocket handler for RPC calls

    server.ws.on("dev-toolbar:rpc", async (data: { args: any[]; id: string; method: string }, client: WebSocketClient) => {
        const { args, id, method } = data;
        const handler = functions[method];

        if (!handler) {
            client.send("dev-toolbar:rpc:error", {
                error: `Unknown RPC method: ${method}`,
                id,
            });

            return;
        }

        try {
            // All registered functions already close over `server` via
            // createDefaultServerFunctions, so just spread the RPC args.
            const result = await handler(...args);

            client.send("dev-toolbar:rpc:response", { id, result });
        } catch (error) {
            client.send("dev-toolbar:rpc:error", {
                error: error instanceof Error ? error.message : String(error),
                id,
            });
        }
    });

    return {
        callClient<K extends keyof ClientFunctions>(name: K, ...args: Parameters<ClientFunctions[K]>): void {
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

export { createServerRPCContext };
export default createServerRPCContext;
