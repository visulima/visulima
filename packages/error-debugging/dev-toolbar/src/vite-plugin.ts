import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { Plugin, ResolvedConfig, UserConfig } from "vite";
import { normalizePath } from "vite";

import { createServerRPCContext } from "./rpc/server";
import type { DevToolbarApp, ServerFunctions } from "./types/index";
import type { InjectSourceIgnore } from "./vite/inject-source";

/**
 * Returns the path to the dev-toolbar dist directory.
 * Always uses the dist folder — Vite should never access src.
 */
const getDevToolbarPath = (): string => {
    const pluginPath = normalizePath(path.dirname(fileURLToPath(import.meta.url)));

    // import.meta.url points to dist when loaded from the built package
    return pluginPath;
};

// eslint-disable-next-line sonarjs/slow-regex
const URL_QUERY_RE = /\?.+$/;
const DIST_BUILD_RE = /\/dist\/|\/build\//;
const JSX_EXT_RE = /\.[jt]sx$/;

/**
 * Removes the URL query string from a path.
 */
const removeUrlQuery = (url: string): string => url.replace(URL_QUERY_RE, "");

// Query marker for dev-toolbar resources
// Why use query instead of vite virtual module on devtools resource?
// Devtools resource will import other packages, which vite cannot analyze correctly on virtual module.
// So we should use absolute path + `query` to mark the resource as devtools resource.
const devToolbarResourceSymbol = "?__visulima-dev-toolbar-resource";

// Virtual module IDs
const VIRTUAL_OPTIONS = "virtual:visulima-dev-toolbar-options";
const RESOLVED_OPTIONS = `\0${VIRTUAL_OPTIONS}`;
const VIRTUAL_PATH_PREFIX = "virtual:visulima-dev-toolbar-path:";

// Sentinel ID returned by the remove-on-build plugin for any of our virtual modules
const RESOLVED_EMPTY = "\0__visulima-dev-toolbar-empty";

/**
 * Dev toolbar plugin options
 */
export interface DevToolbarOptions {
    /**
     * append an import to the module id ending with `appendTo` instead of adding a script into body
     * useful for projects that do not use html file as an entry
     *
     * WARNING: only set this if you know exactly what it does.
     * @default Empty string (disabled).
     */
    appendTo?: string | RegExp;

    /**
     * Built-in apps to enable. All apps are disabled by default — only
     * `viteConfig`, `settings`, and the "more" drawer are shown out of the box.
     * Explicitly set an app to `true` to enable it.
     * @example { inspector: true, seo: true }
     */
    apps?: {
        [key: string]: boolean | undefined;
        a11y?: boolean;
        inspector?: boolean;
        moduleGraph?: boolean;
        performance?: boolean;
        seo?: boolean;
        settings?: boolean;
        tailwind?: boolean;
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
     * The editor to open when clicking "Open in editor" in the inspector.
     * Accepts any value supported by `launch-editor` — an editor name/alias
     * (e.g. `"code"`, `"webstorm"`, `"vim"`, `"atom"`) or the full path to
     * the editor executable.
     *
     * If omitted, `launch-editor` auto-detects the editor from the `EDITOR`
     * / `VISUAL` environment variables or from the currently running IDE
     * process detected on the OS process list.
     * @example "webstorm"
     * @example "code"
     */
    editor?: string;

    /**
     * Initial panel height as a percentage of the viewport height (20–95).
     * @default 60
     */
    height?: number;

    /**
     * Inject `data-vdt-source="&lt;file>:&lt;line>:&lt;col>"` attributes into every JSX
     * opening element during development. This lets the inspector jump directly
     * to the source file when an element is clicked.
     *
     * Only active when `mode === 'development'`. Set `enabled: false` to opt out.
     * Use `ignore.files` / `ignore.components` to exclude specific paths or
     * component names (strings are treated as glob patterns).
     * @default { enabled: true }
     */
    injectSource?: {
        enabled?: boolean;
        ignore?: InjectSourceIgnore;
    };

    /**
     * Keyboard shortcut bindings.
     * These are project-level defaults; users can still override them via the
     * Settings app (stored in localStorage).
     */
    keybindings?: {
        /** Close active app / panel. \@default "Escape" */
        close?: string;
        /** Toggle the DevTools panel open/closed. \@default "Alt+Shift+D" */
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
     * Strip all \@visulima/dev-toolbar imports and virtual modules when building
     * for production (i.e. when `command !== 'serve'` or `mode === 'production'`).
     * This guarantees the toolbar never ends up in a production bundle even if the
     * user accidentally imports our package in application code.
     * @default true
     */
    removeDevtoolsOnBuild?: boolean;

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
 * Returns the Vite plugin array for the dev toolbar.
 */
export const devToolbar = (options: DevToolbarOptions = {}): Plugin[] => {
    const devToolbarPath = getDevToolbarPath();
    const removeOnBuild = options.removeDevtoolsOnBuild ?? true;
    const injectSourceEnabled = options.injectSource?.enabled ?? true;
    let config: ResolvedConfig;

    const mainPlugin: Plugin = {
        apply: "serve",

        configResolved(resolvedConfig) {
            config = resolvedConfig;
        },

        configureServer(srv) {
            // Setup RPC context
            createServerRPCContext(srv, options.serverFunctions, { editor: options.editor });

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
                        a11y: options.apps?.a11y ?? false,
                        inspector: options.apps?.inspector ?? false,
                        moduleGraph: options.apps?.moduleGraph ?? false,
                        performance: options.apps?.performance ?? false,
                        seo: options.apps?.seo ?? false,
                        settings: options.apps?.settings ?? true,
                        tailwind: options.apps?.tailwind ?? false,
                        timeline: options.apps?.timeline ?? false,
                        viteConfig: options.apps?.viteConfig ?? true,
                    },
                    base: config.base,
                    closeOnOutsideClick: options.closeOnOutsideClick ?? true,
                    editor: options.editor ?? "",
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
                appendTo
                && filename
                && ((typeof appendTo === "string" && filename.endsWith(appendTo)) || (appendTo instanceof RegExp && appendTo.test(filename)))
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

    const removeOnBuildPlugin: Plugin = {
        apply(_userConfig: UserConfig, { command, mode }: { command: string; mode: string }): boolean {
            return removeOnBuild && (command !== "serve" || mode === "production");
        },

        load(id) {
            if (id === RESOLVED_EMPTY) {
                return "export default {};";
            }

            return undefined;
        },

        name: "@visulima/dev-toolbar:remove-on-build",

        resolveId(id) {
            if (id === VIRTUAL_OPTIONS || id.startsWith(VIRTUAL_PATH_PREFIX)) {
                return RESOLVED_EMPTY;
            }

            return undefined;
        },
    };

    const injectSourcePlugin: Plugin = {
        enforce: "pre",

        name: "@visulima/dev-toolbar:inject-source",

        async transform(code, id) {
            if (!injectSourceEnabled || config.mode !== "development") {
                return undefined;
            }

            if (id.includes("node_modules") || id.includes("?raw") || DIST_BUILD_RE.test(id)) {
                return undefined;
            }

            if (!JSX_EXT_RE.test(id.split("?")[0] ?? "")) {
                return undefined;
            }

            // Read the original source file from disk so that both the SSR build and the
            // client build use the same JSX line/column positions.  SSR compilation pipelines
            // (e.g. TanStack Start / Vinxi) are enforce:"pre" plugins that prepend
            // server-specific imports before our transform runs, shifting line numbers in the
            // received `code`.  By passing the unmodified on-disk content as `originalCode`,
            // addSourceToJsx builds a position map from the real source and injects positions
            // from that map into `code`'s AST — so both builds produce identical
            // data-vdt-source values and React hydration never sees a mismatch.
            const { readFile } = await import("node:fs/promises");

            let originalCode: string | undefined;

            try {
                const diskContent = await readFile(id.split("?")[0] ?? id, "utf8");

                if (diskContent !== code) {
                    originalCode = diskContent;
                }
            } catch {
                // Virtual modules, generated code — fall through and transform code directly
            }

            const { addSourceToJsx } = await import("./vite/inject-source.js");
            const result = addSourceToJsx(code, id, options.injectSource?.ignore, originalCode);

            if (!result) {
                return undefined;
            }

            return { code: result.code ?? code, map: result.map ?? undefined };
        },
    };

    return [mainPlugin, injectSourcePlugin, removeOnBuildPlugin];
};
