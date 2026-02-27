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
        a11y?: boolean;
        moduleGraph?: boolean;
        performance?: boolean;
        seo?: boolean;
        settings?: boolean;
        timeline?: boolean;
        viteConfig?: boolean;
    };

    /**
     * Whether clicking outside the DevTools panel closes it.
     * @default true
     */
    closeOnOutsideClick?: boolean;

    /**
     * Custom apps to register
     */
    customApps?: DevToolbarApp[];

    /**
     * Whether toolbar is visible by default
     */
    defaultVisible?: boolean;

    /**
     * Initial panel height as a percentage of the viewport height (20–95).
     * @default 60
     */
    height?: number;

    /**
     * Keyboard shortcut bindings.
     * These are project-level defaults; users can still override them via the
     * Settings app (stored in localStorage).
     */
    keybindings?: {
        /** Close active app / panel. @default "Escape" */
        close?: string;
        /** Toggle the DevTools panel open/closed. @default "Alt+Shift+D" */
        toggle?: string;
    };

    /**
     * Auto-hide the toolbar pill after this many milliseconds of inactivity.
     * Set to -1 to never auto-hide.
     * @default 5000
     */
    minimizePanelInactive?: number;

    /**
     * Toolbar placement (coarse shorthand — sets the edge and rough horizontal
     * alignment of the toolbar pill).
     * @default "bottom-center"
     */
    placement?: "bottom-left" | "bottom-center" | "bottom-right";

    /**
     * Which edge of the viewport the toolbar pill is anchored to.
     * Takes precedence over the edge implied by `placement`.
     * @default "bottom"
     */
    position?: "bottom" | "left" | "right" | "top";

    /**
     * Reduce motion for accessibility (disables all CSS animations).
     * @default false
     */
    reduceMotion?: boolean;

    /**
     * Only activate the toolbar when the URL contains a specific query parameter.
     * Useful for staging/production environments where you want opt-in debugging.
     * @example requireUrlFlag: true, urlFlagName: 'debug' → toolbar only shows when URL has ?debug=true
     * @default false
     */
    requireUrlFlag?: boolean;

    /**
     * Custom server RPC functions
     */
    serverFunctions?: Partial<ServerFunctions>;

    /**
     * The URL query parameter name used when requireUrlFlag is true.
     * @default 'devtools'
     */
    urlFlagName?: string;

    /**
     * Initial panel width as a percentage of the viewport width (20–95).
     * Applies when position is "left" or "right".
     * @default 80
     */
    width?: number;
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
                        a11y: options.apps?.a11y ?? true,
                        moduleGraph: options.apps?.moduleGraph ?? true,
                        performance: options.apps?.performance ?? true,
                        seo: options.apps?.seo ?? true,
                        settings: options.apps?.settings ?? true,
                        timeline: options.apps?.timeline ?? true,
                        viteConfig: options.apps?.viteConfig ?? true,
                    },
                    base: config.base,
                    closeOnOutsideClick: options.closeOnOutsideClick ?? true,
                    defaultVisible: options.defaultVisible ?? true,
                    height: options.height ?? 60,
                    keybindings: options.keybindings ?? {},
                    minimizePanelInactive: options.minimizePanelInactive ?? 5000,
                    placement: options.placement ?? "bottom-center",
                    position: options.position ?? "bottom",
                    reduceMotion: options.reduceMotion ?? false,
                    requireUrlFlag: options.requireUrlFlag ?? false,
                    urlFlagName: options.urlFlagName ?? "devtools",
                    width: options.width ?? 80,
                })};`;
            }

            // Load dev-toolbar resources by reading file directly
            // This bypasses Vite's fs.allow check (same pattern as Vue DevTools)
            if (id.endsWith(devToolbarResourceSymbol)) {
                const filename = removeUrlQuery(id);

                // Watch the file so Vite invalidates this module when it changes on disk
                // (e.g. after `pnpm build` rebuilds the dist)
                this.addWatchFile(filename);

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
