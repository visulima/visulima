/**
 * Vite plugin for TanStack Start module system
 * This is the core integration point that loads and initializes modules
 */

import type { Plugin, ResolvedConfig, ViteDevServer } from 'vite'
import type {
  StartModule,
  ModuleEntry,
  ModuleOptions,
  ModuleContext,
  StartModulePluginOptions,
  ServerMiddleware,
  ClientPlugin,
  RouteMiddleware,
  Template,
  LayoutConfig,
} from './types.js'
import { ModuleRegistry } from './module.js'
import { loadModule } from './loader.js'
import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'

/**
 * Virtual module prefix for generated code
 */
const VIRTUAL_MODULE_PREFIX = 'virtual:start-modules/'

/**
 * Create the Start module system Vite plugin
 */
export function startModulePlugin(options: StartModulePluginOptions = {}): Plugin {
  const {
    configFile = 'start.config.ts',
    modules: inlineModules = [],
    root = process.cwd(),
  } = options

  let viteConfig: ResolvedConfig
  let moduleRegistry: ModuleRegistry
  let virtualModules: Map<string, string | (() => string)> = new Map()
  let vitePlugins: Plugin[] = []
  let serverMiddlewares: ServerMiddleware[] = []
  let clientPlugins: ClientPlugin[] = []
  let routeMiddlewares: RouteMiddleware[] = []
  let templates: Template[] = []
  let layouts: LayoutConfig[] = []

  return {
    name: 'start-modules',
    enforce: 'pre', // Run before other plugins

    /**
     * Resolve virtual modules
     */
    resolveId(id: string) {
      if (id.startsWith(VIRTUAL_MODULE_PREFIX)) {
        return `\0${id}`
      }
      return null
    },

    /**
     * Load virtual module content
     */
    load(id: string) {
      if (id.startsWith('\0' + VIRTUAL_MODULE_PREFIX)) {
        const moduleId = id.slice(VIRTUAL_MODULE_PREFIX.length + 1)
        const content = virtualModules.get(moduleId)
        if (typeof content === 'function') {
          return content()
        }
        return content
      }
      return null
    },

    /**
     * Configure Vite - this is where we load modules
     */
    async configResolved(config: ResolvedConfig) {
      viteConfig = config
      moduleRegistry = new ModuleRegistry()

      // Load config file if it exists
      const configPath = resolve(root, configFile)
      let configModules: ModuleEntry[] = []

      try {
        // Try to load config file (simplified - in real implementation would use dynamic import)
        // For now, we'll use inline modules
        configModules = inlineModules
      } catch (error) {
        // Config file not found or error - use inline modules
        configModules = inlineModules
      }

      // Combine config modules with inline modules
      const allModules = [...configModules, ...inlineModules]

      // Load all modules
      for (const moduleEntry of allModules) {
        await loadModuleEntry(moduleEntry, config, moduleRegistry)
      }

      // Call build:before hooks
      await moduleRegistry.callHook('build:before')
    },

    /**
     * Configure the Vite dev server
     */
    configureServer(server: ViteDevServer) {
      // Call dev:server:configure hooks
      moduleRegistry.callHook('dev:server:configure', server).then(() => {
        // Add server middleware
        for (const middleware of serverMiddlewares) {
          server.middlewares.use(middleware.path, async (req, res, next) => {
            await middleware.handler(req as any, res as any, next)
          })
        }

        // Call dev:server:ready hooks
        moduleRegistry.callHook('dev:server:ready', server)
      })
    },

    /**
     * Build start hook
     */
    buildStart() {
      // Generate templates
      for (const template of templates) {
        if (template.write !== false) {
          // Write template to file system
          // In real implementation, would write to appropriate location
        }
      }
    },

    /**
     * Build end hook
     */
    buildEnd() {
      moduleRegistry.callHook('build:done')
    },

    /**
     * Generate manifest for client-side module loading
     */
    generateBundle() {
      // Generate module manifest
      const manifest = {
        clientPlugins: clientPlugins.map((p) => p.name),
        routeMiddlewares: routeMiddlewares.map((m) => m.name),
      }

      this.emitFile({
        type: 'asset',
        fileName: 'start-modules.json',
        source: JSON.stringify(manifest, null, 2),
      })
    },
  }

  /**
   * Load a module entry and create its context
   */
  async function loadModuleEntry(
    moduleEntry: ModuleEntry,
    config: ResolvedConfig,
    registry: ModuleRegistry
  ): Promise<void> {
    const module = await loadModule(moduleEntry, config, root)
    const moduleName = getModuleName(moduleEntry, module)

    // Merge options
    const configKey = module.meta?.configKey || moduleName
    const configOptions = (viteConfig?.config || {})[configKey] as ModuleOptions | undefined
    const entryOptions = getModuleOptions(moduleEntry)
    const finalOptions = { ...configOptions, ...entryOptions }

    // Create module context
    const context = createModuleContext(
      config,
      root,
      finalOptions,
      module.meta || { name: moduleName },
      registry,
      {
        virtualModules,
        vitePlugins,
        serverMiddlewares,
        clientPlugins,
        routeMiddlewares,
        templates,
        layouts,
      }
    )

    // Register module
    registry.register(moduleName, module, context)

    // Setup module
    if (module.setup) {
      await module.setup(context)
    }

    // Add collected Vite plugins
    if (vitePlugins.length > 0) {
      // In real implementation, would add these to Vite's plugin array
      // For now, we collect them for later use
    }
  }
}

/**
 * Create module context
 */
function createModuleContext(
  config: ResolvedConfig,
  root: string,
  options: ModuleOptions,
  meta: { name: string; configKey?: string; version?: string },
  registry: ModuleRegistry,
  collections: {
    virtualModules: Map<string, string | (() => string)>
    vitePlugins: Plugin[]
    serverMiddlewares: ServerMiddleware[]
    clientPlugins: ClientPlugin[]
    routeMiddlewares: RouteMiddleware[]
    templates: Template[]
    layouts: LayoutConfig[]
  }
): ModuleContext {
  return {
    viteConfig: config,
    root,
    options,
    meta,
    addVitePlugin: (plugin) => {
      const plugins = Array.isArray(plugin) ? plugin : [plugin]
      collections.vitePlugins.push(...plugins)
    },
    addVirtualModule: (id: string, content: string | (() => string)) => {
      collections.virtualModules.set(id, content)
    },
    addServerMiddleware: (middleware) => {
      collections.serverMiddlewares.push(middleware)
    },
    addClientPlugin: (plugin) => {
      collections.clientPlugins.push(plugin)
    },
    addRouteMiddleware: (middleware) => {
      collections.routeMiddlewares.push(middleware)
    },
    addTemplate: (template) => {
      collections.templates.push(template)
    },
    addLayout: (layout) => {
      collections.layouts.push(layout)
    },
    resolve: {
      path: (path: string) => resolve(root, path),
      alias: (alias: string) => {
        // Resolve Vite alias
        const aliasConfig = config.resolve?.alias
        if (Array.isArray(aliasConfig)) {
          const found = aliasConfig.find((a) => a.find === alias)
          return found?.replacement
        } else if (aliasConfig) {
          return aliasConfig[alias]
        }
        return undefined
      },
    },
    hooks: {
      'build:before': () => registry.callHook('build:before'),
      'build:done': () => registry.callHook('build:done'),
      'dev:server:configure': (server) => registry.callHook('dev:server:configure', server),
      'dev:server:ready': (server) => registry.callHook('dev:server:ready', server),
      'router:ready': (router) => registry.callHook('router:ready', router),
      'app:ready': () => registry.callHook('app:ready'),
    },
  }
}

/**
 * Get module name from entry
 */
function getModuleName(entry: ModuleEntry, module: StartModule): string {
  if (typeof entry === 'string') {
    return entry
  }
  if (Array.isArray(entry)) {
    return entry[0]
  }
  return module.meta?.name || 'anonymous-module'
}

/**
 * Get module options from entry
 */
function getModuleOptions(entry: ModuleEntry): ModuleOptions {
  if (Array.isArray(entry)) {
    return entry[1] || {}
  }
  return {}
}
