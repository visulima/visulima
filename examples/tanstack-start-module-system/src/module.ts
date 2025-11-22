/**
 * Module definition helper and registry
 */

import type {
  StartModule,
  ModuleOptions,
  ModuleContext,
  ModuleMeta,
  StartConfig,
} from './types.js'

/**
 * Define a Start module
 */
export function defineStartModule(
  module: StartModule | ((options: ModuleOptions, context: ModuleContext) => void | Promise<void>)
): StartModule {
  if (typeof module === 'function') {
    return {
      setup: module,
    }
  }
  return module
}

/**
 * Module registry for managing loaded modules
 */
export class ModuleRegistry {
  private modules: Map<string, StartModule> = new Map()
  private moduleContexts: Map<string, ModuleContext> = new Map()
  private hooks: Map<string, Set<Function>> = new Map()

  /**
   * Register a module
   */
  register(name: string, module: StartModule, context: ModuleContext): void {
    this.modules.set(name, module)
    this.moduleContexts.set(name, context)

    // Register module hooks
    if (module.hooks) {
      for (const [hookName, hookFn] of Object.entries(module.hooks)) {
        this.addHook(hookName, hookFn)
      }
    }
  }

  /**
   * Get a registered module
   */
  get(name: string): StartModule | undefined {
    return this.modules.get(name)
  }

  /**
   * Get module context
   */
  getContext(name: string): ModuleContext | undefined {
    return this.moduleContexts.get(name)
  }

  /**
   * Add a hook listener
   */
  addHook(hookName: string, hookFn: Function): void {
    if (!this.hooks.has(hookName)) {
      this.hooks.set(hookName, new Set())
    }
    this.hooks.get(hookName)!.add(hookFn)
  }

  /**
   * Call all hooks for a given hook name
   */
  async callHook(hookName: string, ...args: unknown[]): Promise<void> {
    const hooks = this.hooks.get(hookName)
    if (!hooks) {
      return
    }

    for (const hook of hooks) {
      await hook(...args)
    }
  }

  /**
   * Get all registered modules
   */
  getAllModules(): Map<string, StartModule> {
    return new Map(this.modules)
  }
}

/**
 * Create module context
 */
export function createModuleContext(
  config: StartConfig,
  registry: ModuleRegistry
): ModuleContext {
  const vitePlugins: any[] = []
  const serverMiddlewares: any[] = []
  const clientPlugins: any[] = []
  const routeMiddlewares: any[] = []
  const templates: any[] = []
  const layouts: any[] = []

  return {
    config,
    hooks: {
      'build:before': () => registry.callHook('build:before'),
      'build:done': () => registry.callHook('build:done'),
      'dev:before': () => registry.callHook('dev:before'),
      'dev:ready': () => registry.callHook('dev:ready'),
      'router:ready': (router) => registry.callHook('router:ready', router),
      'server:ready': () => registry.callHook('server:ready'),
    },
    addVitePlugin: (plugin) => {
      vitePlugins.push(plugin)
    },
    addServerMiddleware: (middleware) => {
      serverMiddlewares.push(middleware)
    },
    addClientPlugin: (plugin) => {
      clientPlugins.push(plugin)
    },
    addRouteMiddleware: (middleware) => {
      routeMiddlewares.push(middleware)
    },
    utils: {
      resolvePath: (path: string) => {
        // Resolve path relative to project root
        return path
      },
      addTemplate: (template) => {
        templates.push(template)
      },
      addLayout: (layout) => {
        layouts.push(layout)
      },
    },
    extendBuild: (extendFn) => {
      // Store build extender for later use
    },
    extendRouter: (extendFn) => {
      // Store router extender for later use
    },
  }
}
