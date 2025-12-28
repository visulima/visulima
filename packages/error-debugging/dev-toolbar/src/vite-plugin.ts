import type { Plugin, ResolvedConfig } from 'vite';
import type { DevToolbarApp, ServerFunctions } from './types/index.js';
import { createServerRPCContext } from './rpc/server.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizePath } from 'vite';

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
    settings?: boolean;
    timeline?: boolean;
    [key: string]: boolean | undefined;
  };

  /**
   * Custom apps to register
   */
  customApps?: DevToolbarApp[];

  /**
   * Toolbar placement
   */
  placement?: 'bottom-left' | 'bottom-center' | 'bottom-right';

  /**
   * Whether toolbar is visible by default
   */
  defaultVisible?: boolean;

  /**
   * Custom server RPC functions
   */
  serverFunctions?: Partial<ServerFunctions>;
}

/**
 * Get the path to the dev-toolbar source/dist directory
 * Similar to Vue DevTools: handles both /dist and /src paths
 */
function getDevToolbarPath(): string {
  const pluginPath = normalizePath(path.dirname(fileURLToPath(import.meta.url)));
  // Replace /dist$ with /src for development
  return pluginPath.replace(/\/dist$/, '/src');
}

/**
 * Remove URL query string from a path
 * Similar to Vue DevTools' removeUrlQuery utility
 */
function removeUrlQuery(url: string): string {
  return url.replace(/\?.*$/, '');
}

// Query marker for dev-toolbar resources
// Why use query instead of vite virtual module on devtools resource?
// Devtools resource will import other packages, which vite cannot analyze correctly on virtual module.
// So we should use absolute path + `query` to mark the resource as devtools resource.
const devToolbarResourceSymbol = '?__visulima-dev-toolbar-resource';

// Virtual module IDs
const VIRTUAL_OPTIONS = 'virtual:visulima-dev-toolbar-options';
const RESOLVED_OPTIONS = `\0${VIRTUAL_OPTIONS}`;
const VIRTUAL_PATH_PREFIX = 'virtual:visulima-dev-toolbar-path:';

/**
 * Dev toolbar Vite plugin
 */
export const devToolbar = (options: DevToolbarOptions = {}): Plugin => {
  const devToolbarPath = getDevToolbarPath();
  let config: ResolvedConfig;

  return {
    name: '@visulima/dev-toolbar',
    enforce: 'pre',
    apply: 'serve',

    configResolved(resolvedConfig) {
      config = resolvedConfig;
    },

    configureServer(srv) {
      // Setup RPC context
      createServerRPCContext(srv, options.serverFunctions);

      // Send init event to clients on connection
      srv.ws.on('connection', () => {
        srv.ws.send({
          type: 'custom',
          event: 'dev-toolbar:init',
        });
      });
    },

    async resolveId(importee: string) {
      if (importee === VIRTUAL_OPTIONS) {
        return RESOLVED_OPTIONS;
      }
      // Handle path-based virtual modules
      // Similar to Vue DevTools: use actual file paths with query string
      if (importee.startsWith(VIRTUAL_PATH_PREFIX)) {
        const resolved = importee.replace(VIRTUAL_PATH_PREFIX, `${devToolbarPath}/`);
        return `${resolved}${devToolbarResourceSymbol}`;
      }
      return null;
    },

    async load(id) {
      if (id === RESOLVED_OPTIONS) {
        return `export default ${JSON.stringify({
          base: config.base,
          apps: {
            settings: options.apps?.settings ?? true,
            timeline: options.apps?.timeline ?? true,
          },
          placement: options.placement ?? 'bottom-center',
          defaultVisible: options.defaultVisible ?? true,
        })};`;
      }
      // Load files directly to bypass Vite's fs.allow check
      if (id.endsWith(devToolbarResourceSymbol)) {
        const filename = removeUrlQuery(id);
        try {
          return await fs.promises.readFile(filename, 'utf-8');
        } catch (error) {
          console.error(`[dev-toolbar] Failed to read file: ${filename}`, error);
          return null;
        }
      }
      return null;
    },

    transform(code, id, transformOptions) {
      // Skip SSR transforms
      if (transformOptions?.ssr) {
        return;
      }

      const { appendTo } = options;
      const filename = id.split('?', 2)[0];

      // Support appendTo option like Vue DevTools
      if (appendTo && filename && (
        (typeof appendTo === 'string' && filename.endsWith(appendTo)) ||
        (appendTo instanceof RegExp && appendTo.test(filename))
      )) {
        return `import '${VIRTUAL_PATH_PREFIX}client/overlay.js';\n${code}`;
      }

      return code;
    },

    transformIndexHtml() {
      // Skip if appendTo is set
      if (options.appendTo) {
        return;
      }

      const base = config.base || '/';
      return {
        html: '',
        tags: [
          {
            tag: 'script',
            injectTo: 'head-prepend' as const,
            attrs: {
              type: 'module',
              src: `${base}@id/${VIRTUAL_PATH_PREFIX}client/overlay.js`,
            },
          },
        ],
      };
    },
  };
};

export default devToolbar;
