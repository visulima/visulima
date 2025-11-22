/**
 * Example: Database module
 * Demonstrates how a module can add database functionality
 */

import { defineStartModule } from '../module.js'
import type { ModuleContext } from '../types.js'

interface DatabaseModuleOptions {
  provider?: 'postgresql' | 'mysql' | 'sqlite'
  url?: string
  migrations?: boolean
  seed?: boolean
}

/**
 * Database module for TanStack Start
 */
export default defineStartModule({
  meta: {
    name: '@tanstack/start-database',
    version: '1.0.0',
    configKey: 'database',
  },

  async setup(context: ModuleContext) {
    const options = context.options as DatabaseModuleOptions
    const {
      provider = 'postgresql',
      url = process.env.DATABASE_URL || '',
      migrations = true,
      seed = false,
    } = options

    if (!url) {
      throw new Error('Database URL is required')
    }

    // Add server middleware for database connection
    context.addServerMiddleware({
      path: '*',
      handler: async (req, res, next) => {
        // Initialize database connection per request
        // Add database client to request context
        ;(req as any).db = {
          // Database client instance
        }
        next()
      },
    })

    // Add Vite plugin for database types generation
    context.addVitePlugin({
      name: 'start-database-types',
      buildStart() {
        // Generate TypeScript types from database schema
      },
    })

    // Extend build to run migrations
    if (migrations) {
      context.extendBuild((config) => {
        // Add migration step to build process
        return config
      })
    }

    // Hook into server ready to run migrations/seeds
    context.hooks['server:ready'] = async () => {
      if (migrations) {
        // Run database migrations
      }
      if (seed) {
        // Seed database
      }
    }

    // Add template for database utilities
    context.utils.addTemplate({
      filename: 'db.ts',
      getContents: () => `
        export function getDb() {
          // Return database client from request context
          return (globalThis as any).db
        }
        
        export async function query(sql: string, params?: unknown[]) {
          const db = getDb()
          return db.query(sql, params)
        }
      `,
    })
  },
})
