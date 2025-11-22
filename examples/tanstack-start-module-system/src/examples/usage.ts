/**
 * Example: How to use the module system in a TanStack Start application
 */

import { loadModules } from './loader.js'
import { startConfig } from './examples/app.config.js'

/**
 * Initialize modules during application startup
 */
export async function initializeApp() {
  // Load all modules from configuration
  const moduleRegistry = await loadModules(startConfig)

  // Call hooks at appropriate times
  await moduleRegistry.callHook('dev:before')

  // Initialize Vite with plugins from modules
  // Initialize server with middleware from modules
  // Initialize router with routes from modules

  await moduleRegistry.callHook('dev:ready')
}

/**
 * Example: Using module context in a route handler
 */
export async function routeHandler(req: Request) {
  // Access module-provided utilities
  // For example, database client from database module
  const db = (req as any).db

  // Use i18n utilities
  const locale = (req as any).locale

  return new Response(JSON.stringify({ db, locale }), {
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * Example: Creating a custom module
 */
import { defineStartModule } from './module.js'
import type { ModuleOptions, ModuleContext } from './types.js'

export const myCustomModule = defineStartModule({
  meta: {
    name: 'my-custom-module',
    version: '1.0.0',
    configKey: 'custom',
  },

  async setup(options: ModuleOptions, context: ModuleContext) {
    // Add custom functionality
    context.addVitePlugin({
      name: 'my-custom-plugin',
      // Plugin implementation
    })

    // Add server middleware
    context.addServerMiddleware({
      path: '/api/custom',
      handler: async (req, res, next) => {
        // Custom middleware logic
        next()
      },
    })

    // Hook into lifecycle events
    context.hooks['router:ready'] = async (router) => {
      // Custom router setup
    }
  },
})
