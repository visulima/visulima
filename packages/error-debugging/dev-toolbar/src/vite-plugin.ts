import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { Plugin, ResolvedConfig } from "vite";
import { normalizePath } from "vite";

import { createServerRPCContext } from "./rpc/server";
import type { DevToolbarApp, ServerFunctions } from "./types/index";

/**
 * Get the path to the dev-toolbar dist directory
 * Always use dist folder - Vite should never access src
 */
const getDevToolbarPath = (): string => {
    const pluginPath = normalizePath(path.dirname(fileURLToPath(import.meta.url)));

    // import.meta.url points to dist when loaded from the built package
    return pluginPath;
};

/**
 * Remove URL query string from a path
 */
const removeUrlQuery = (url: string): string => url.replace(/\?.*$/, "");

// Query marker for dev-toolbar resources
// Why use query instead of vite virtual module on devtools resource?
// Devtools resource will import other packages, which vite cannot analyze correctly on virtual module.
// So we should use absolute path + `query` to mark the resource as devtools resource.
const devToolbarResourceSymbol = "?__visulima-dev-toolbar-resource";

// Virtual module IDs
const VIRTUAL_OPTIONS = "virtual:visulima-dev-toolbar-options";
const RESOLVED_OPTIONS = `\0${VIRTUAL_OPTIONS}`;
const VIRTUAL_PATH_PREFIX = "virtual:visulima-dev-toolbar-path:";

/**
 * Dev toolbar plugin options
 */
export interface DevToolbarOptions {
    /**
     * append an import to the module id ending with `appendTo` instead of adding a script into body
     * useful for projects that do not use html file as an entry
     *
     * WARNING: only set this if you know exactly what it does.
     * @default ''
     */
    appendTo?: string | RegExp;

    /**
     * Built-in apps to enable
     */
    apps?: {
        [key: string]: boolean | undefined;
        settings?: boolean;
        timeline?: boolean;
    };

    /**
     * Custom apps to register
     */
    customApps?: DevToolbarApp[];

    /**
     * Whether toolbar is visible by default
     */
    defaultVisible?: boolean;

    /**
     * Toolbar placement
     */
    placement?: "bottom-left" | "bottom-center" | "bottom-right";

    /**
     * Custom server RPC functions
     */
    serverFunctions?: Partial<ServerFunctions>;
}

/**
 * Dev toolbar Vite plugin
 */
export const devToolbar = (options: DevToolbarOptions = {}): Plugin => {
    const devToolbarPath = getDevToolbarPath();
    let config: ResolvedConfig;

    return {
        apply: "serve",

        configResolved(resolvedConfig) {
            config = resolvedConfig;
        },

        configureServer(srv) {
            // Setup RPC context
            createServerRPCContext(srv, options.serverFunctions);

            // Send init event to clients on connection
            srv.ws.on("connection", () => {
                srv.ws.send({
                    event: "dev-toolbar:init",
                    type: "custom",
                });
            });
        },

        enforce: "pre",

        async load(id) {
            if (id === RESOLVED_OPTIONS) {
                return `export default ${JSON.stringify({
                    apps: {
                        settings: options.apps?.settings ?? true,
                        timeline: options.apps?.timeline ?? true,
                    },
                    base: config.base,
                    defaultVisible: options.defaultVisible ?? true,
                    placement: options.placement ?? "bottom-center",
                })};`;
            }

            // Load dev-toolbar resources by reading file directly
            // This bypasses Vite's fs.allow check (same pattern as Vue DevTools)
            if (id.endsWith(devToolbarResourceSymbol)) {
                const filename = removeUrlQuery(id);

                return await fs.promises.readFile(filename, "utf8");
            }

            return undefined;
        },

        name: "@visulima/dev-toolbar",

        resolveId(importee: string) {
            if (importee === VIRTUAL_OPTIONS) {
                return RESOLVED_OPTIONS;
            }

            // Handle path-based virtual modules
            // Use absolute path + query to mark as devtools resource
            // This allows imports like: virtual:visulima-dev-toolbar-path:client/overlay.js
            if (importee.startsWith(VIRTUAL_PATH_PREFIX)) {
                const resolved = importee.replace(VIRTUAL_PATH_PREFIX, `${devToolbarPath}/`);

                return `${resolved}${devToolbarResourceSymbol}`;
            }

            return undefined;
        },

        transform(code, id, transformOptions) {
            // Skip SSR transforms
            if (transformOptions?.ssr) {
                return undefined;
            }

            const { appendTo } = options;
            const filename = id.split("?", 2)[0];

            // Support appendTo option like Vue DevTools
            if (
                appendTo &&
                filename &&
                ((typeof appendTo === "string" && filename.endsWith(appendTo)) || (appendTo instanceof RegExp && appendTo.test(filename)))
            ) {
                return `import '${VIRTUAL_PATH_PREFIX}client/overlay.js';\n${code}`;
            }

            return undefined;
        },

        transformIndexHtml() {
            // Skip if appendTo is set
            if (options.appendTo) {
                return undefined;
            }

            const base = config.base || "/";

            return {
                html: "",
                tags: [
                    {
                        attrs: {
                            src: `${base}@id/${VIRTUAL_PATH_PREFIX}client/overlay.js`,
                            type: "module",
                        },
                        injectTo: "head-prepend" as const,
                        tag: "script",
                    },
                ],
            };
        },
    };
};
