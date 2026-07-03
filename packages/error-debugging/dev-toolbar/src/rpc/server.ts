import type { ViteDevServer, WebSocketClient } from "vite";

import { isPathInsideBase } from "../store/annotation-store";
import type { CreateAnnotationData, UpdateAnnotationData } from "../types/annotations";
import type { ClientFunctions, ServerFunctions, ServerRPCContext } from "../types/rpc";
import { createAnnotation, deleteAnnotation, getAnnotations, getScreenshot, saveScreenshot, updateAnnotation } from "./functions/annotations";
import { getStaticAssets } from "./functions/assets";
import { getModuleGraph } from "./functions/module-graph";
import { openInEditor } from "./functions/open-in-editor";
import { getTailwindConfig } from "./functions/tailwind-config";
import { getViteConfig } from "./functions/vite-config";

/**
 * Default set of file extensions the `readFile` RPC is allowed to return. These
 * are source/markup/text/config formats that the inspector and custom apps need;
 * sensitive files such as `.env`, lockfiles, certificates, and key material are
 * intentionally excluded. Override via the `readFile.extensions` option.
 */
const DEFAULT_READ_FILE_EXTENSIONS: ReadonlyArray<string> = [
    "astro",
    "cjs",
    "css",
    "cts",
    "html",
    "js",
    "json",
    "jsx",
    "less",
    "md",
    "mdx",
    "mjs",
    "mts",
    "sass",
    "scss",
    "svelte",
    "ts",
    "tsx",
    "txt",
    "vue",
];

/**
 * Configuration for the `readFile` RPC endpoint.
 */
export interface ReadFileOptions {
    /**
     * Lower-cased file extensions (without the dot) the `readFile` RPC may return.
     * Defaults to a curated list of source/markup/text formats — set this to widen
     * or narrow the surface. Sensitive formats (`.env`, `.pem`, lockfiles) are not
     * in the default list.
     */
    extensions?: string[];
}

/**
 * Options accepted by {@link createServerRPCContext}.
 */
export interface ServerRPCOptions {
    /** Editor to use for "open in editor" functionality. */
    editor?: string;

    /**
     * `readFile` RPC behaviour. Set to `false` to remove the endpoint entirely,
     * or pass an object to customise the allowed extensions.
     * @default { extensions: curated source/text list }
     */
    readFile?: ReadFileOptions | false;
}

/**
 * Creates default server functions bound to a server instance.
 */
const createDefaultServerFunctions = (server: ViteDevServer, options: ServerRPCOptions = {}): Partial<ServerFunctions> => {
    const functions: Partial<ServerFunctions> = {
        createAnnotation: async (data: CreateAnnotationData) => createAnnotation(server, data),
        deleteAnnotation: async (id: string) => deleteAnnotation(server, id),
        getAnnotations: async () => getAnnotations(server),
        getModuleGraph: async () => getModuleGraph(server),
        getScreenshot: async (annotationId: string) => getScreenshot(server, annotationId),
        getStaticAssets: async () => getStaticAssets(server),
        getTailwindConfig: async () => getTailwindConfig(server),
        getViteConfig: async () => getViteConfig(server),
        openInEditor: async (file: string, line?: number, column?: number) => openInEditor(server, file, line, column, options.editor),
        saveScreenshot: async (annotationId: string, dataUrl: string) => saveScreenshot(server, annotationId, dataUrl),
        updateAnnotation: async (id: string, data: UpdateAnnotationData) => updateAnnotation(server, id, data),
    };

    // The readFile endpoint is opt-out: it returns any file under the project
    // root, so a consumer can disable it (readFile: false) when the dev server is
    // exposed over the network (`--host`). Otherwise it is restricted to a curated
    // extension allowlist so `.env`/lockfiles/keys are never served to WS clients.
    if (options.readFile !== false) {
        const allowed = new Set((options.readFile?.extensions ?? DEFAULT_READ_FILE_EXTENSIONS).map((extension) => extension.toLowerCase().replace(/^\./, "")));

        functions.readFile = async (path: string): Promise<string> => {
            const { readFile } = await import("node:fs/promises");
            const { extname, resolve } = await import("node:path");
            const { root } = server.config;
            const filePath = resolve(root, path);

            if (!isPathInsideBase(filePath, root)) {
                throw new Error(`Refusing to read file outside project root: ${path}`);
            }

            const extension = extname(filePath).slice(1).toLowerCase();

            if (!allowed.has(extension)) {
                throw new Error(`Refusing to read file with disallowed extension ".${extension}": ${path}`);
            }

            return readFile(filePath, "utf8");
        };
    }

    return functions;
};

/**
 * Creates server-side RPC context.
 * @param server Vite dev server instance.
 * @param customFunctions Custom server functions to register.
 * @param options Additional options (e.g. which editor to launch, readFile policy).
 * @param options.editor Editor to use for "open in editor" functionality.
 * @param options.readFile `readFile` RPC policy — `false` disables it, or pass an
 * object to override the allowed extension list.
 * @returns Server RPC context.
 */
const createServerRPCContext = (server: ViteDevServer, customFunctions?: Partial<ServerFunctions>, options: ServerRPCOptions = {}): ServerRPCContext => {
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
