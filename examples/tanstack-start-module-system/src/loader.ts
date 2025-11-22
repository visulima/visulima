/**
 * Module loader for resolving and loading modules
 */

import type { StartModule, ModuleEntry, ResolvedConfig } from './types.js'
import { resolve } from 'node:path'

/**
 * Load a module entry
 * Handles different module entry formats and resolves them
 */
export async function loadModule(
  moduleEntry: ModuleEntry,
  config: ResolvedConfig,
  root: string
): Promise<StartModule> {
  if (typeof moduleEntry === 'string') {
    // String format: 'module-name' or '@scope/module-name'
    return await importModule(moduleEntry, root)
  } else if (Array.isArray(moduleEntry)) {
    // Array format: ['module-name', { options }]
    return await importModule(moduleEntry[0], root)
  } else {
    // Direct module object
    return moduleEntry
  }
}

/**
 * Import a module by name
 * Tries multiple resolution strategies:
 * 1. npm package (node_modules)
 * 2. Local file path
 * 3. Relative path from root
 */
async function importModule(name: string, root: string): Promise<StartModule> {
  // Try to import as npm package first
  try {
    const module = await import(name)
    return module.default || module
  } catch (error) {
    // Try as local file path
    try {
      // Try absolute path
      if (name.startsWith('/')) {
        const module = await import(name)
        return module.default || module
      }
      
      // Try relative to root
      const modulePath = resolve(root, name)
      const module = await import(modulePath)
      return module.default || module
    } catch (localError) {
      // Try as URL
      try {
        const module = await import(new URL(name, import.meta.url).href)
        return module.default || module
      } catch (urlError) {
        throw new Error(
          `Failed to load module "${name}": ${error instanceof Error ? error.message : String(error)}`
        )
      }
    }
  }
}
