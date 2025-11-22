/**
 * Example: How to use the module system in a TanStack Start application
 * 
 * The module system is integrated via the Vite plugin, so modules are
 * automatically loaded during the build/dev process.
 */

/**
 * Example: Accessing virtual modules in your app
 * Modules can generate virtual modules that you can import
 */
// import { t } from 'virtual:start-modules/i18n'
// import { getDb } from 'virtual:start-modules/database'

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
import { defineStartModule } from '../module.js'
import type { ModuleContext } from '../types.js'

export const myCustomModule = defineStartModule({
  meta: {
    name: 'my-custom-module',
    version: '1.0.0',
    configKey: 'custom',
  },

  async setup(context: ModuleContext) {
    // Access module options
    const options = context.options as { apiKey?: string }
    
    // Add Vite plugin
    context.addVitePlugin({
      name: 'my-custom-plugin',
      configResolved(config) {
        // Plugin implementation
      },
    })

    // Add virtual module
    context.addVirtualModule('custom-utils', () => `
      export const apiKey = '${options.apiKey || ''}'
      export function customFunction() {
        return 'Hello from custom module'
      }
    `)

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
