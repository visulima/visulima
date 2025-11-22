/**
 * Example: Authentication module
 * Demonstrates how a module can add authentication functionality
 */

import { defineStartModule } from './module.js'
import type { ModuleOptions, ModuleContext } from './types.js'

interface AuthModuleOptions extends ModuleOptions {
  providers?: string[]
  sessionSecret?: string
  redirectTo?: string
}

/**
 * Authentication module for TanStack Start
 */
export default defineStartModule({
  meta: {
    name: '@tanstack/start-auth',
    version: '1.0.0',
    configKey: 'auth',
  },

  async setup(options: AuthModuleOptions, context: ModuleContext) {
    const {
      providers = ['github', 'google'],
      sessionSecret = process.env.SESSION_SECRET || 'default-secret',
      redirectTo = '/dashboard',
    } = options

    // Add server middleware for authentication
    context.addServerMiddleware({
      path: '/api/auth',
      handler: async (req, res, next) => {
        // Authentication logic
        if (req.url?.startsWith('/api/auth/login')) {
          // Handle login
        } else if (req.url?.startsWith('/api/auth/logout')) {
          // Handle logout
        } else if (req.url?.startsWith('/api/auth/callback')) {
          // Handle OAuth callback
        }
        next()
      },
    })

    // Add route middleware for protected routes
    context.addRouteMiddleware({
      name: 'auth',
      handler: async (routeContext) => {
        // Check authentication status
        // Redirect if not authenticated
      },
    })

    // Add client plugin for auth state management
    context.addClientPlugin({
      name: 'auth',
      setup: async (app) => {
        // Initialize auth client
      },
    })

    // Hook into router ready to add auth routes
    context.hooks['router:ready'] = async (router) => {
      // Register auth routes programmatically if needed
    }
  },
})
