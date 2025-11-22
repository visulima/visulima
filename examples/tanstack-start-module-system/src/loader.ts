/**
 * Module loader for resolving and loading modules
 */

import type { StartModule, ModuleOptions, StartConfig } from './types.js'
import { ModuleRegistry, createModuleContext } from './module.js'

/**
 * Load and initialize all modules from configuration
 */
export async function loadModules(
  config: StartConfig,
  registry: ModuleRegistry = new ModuleRegistry()
): Promise<ModuleRegistry> {
  const modules = config.modules || []

  for (const moduleEntry of modules) {
    await loadModule(moduleEntry, config, registry)
  }

  return registry
}

/**
 * Load a single module
 */
async function loadModule(
  moduleEntry: string | [string, ModuleOptions] | StartModule,
  config: StartConfig,
  registry: ModuleRegistry
): Promise<void> {
  let module: StartModule
  let options: ModuleOptions = {}
  let moduleName: string

  // Handle different module entry formats
  if (typeof moduleEntry === 'string') {
    // String format: 'module-name' or '@scope/module-name'
    moduleName = moduleEntry
    module = await importModule(moduleName)
  } else if (Array.isArray(moduleEntry)) {
    // Array format: ['module-name', { options }]
    ;[moduleName, options] = moduleEntry
    module = await importModule(moduleName)
  } else {
    // Direct module object
    module = moduleEntry
    moduleName = module.meta?.name || 'anonymous-module'
  }

  // Merge module options with config
  const configKey = module.meta?.configKey || moduleName
  const configOptions = (config[configKey] as ModuleOptions) || {}
  const finalOptions = { ...configOptions, ...options }

  // Create module context
  const context = createModuleContext(config, registry)

  // Register module
  registry.register(moduleName, module, context)

  // Setup module
  if (module.setup) {
    await module.setup(finalOptions, context)
  }
}

/**
 * Import a module by name
 */
async function importModule(name: string): Promise<StartModule> {
  try {
    // Try to import as npm package
    const module = await import(name)
    return module.default || module
  } catch (error) {
    // Try to import as local path
    try {
      const module = await import(new URL(name, import.meta.url).href)
      return module.default || module
    } catch (localError) {
      throw new Error(
        `Failed to load module "${name}": ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }
}
