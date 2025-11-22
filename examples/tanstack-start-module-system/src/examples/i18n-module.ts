/**
 * Example: Internationalization (i18n) module
 * Demonstrates how a module can add i18n functionality
 */

import { defineStartModule } from './module.js'
import type { ModuleOptions, ModuleContext } from './types.js'

interface I18nModuleOptions extends ModuleOptions {
  locales?: string[]
  defaultLocale?: string
  strategy?: 'prefix' | 'prefix_except_default' | 'prefix_and_default'
  detectBrowserLanguage?: boolean
}

/**
 * Internationalization module for TanStack Start
 */
export default defineStartModule({
  meta: {
    name: '@tanstack/start-i18n',
    version: '1.0.0',
    configKey: 'i18n',
  },

  async setup(options: I18nModuleOptions, context: ModuleContext) {
    const {
      locales = ['en', 'fr', 'de'],
      defaultLocale = 'en',
      strategy = 'prefix_except_default',
      detectBrowserLanguage = true,
    } = options

    // Add Vite plugin for i18n
    context.addVitePlugin({
      name: 'start-i18n',
      configResolved(config) {
        // Configure i18n during build
      },
    })

    // Add server middleware for locale detection
    context.addServerMiddleware({
      path: '*',
      handler: async (req, res, next) => {
        // Detect locale from headers or URL
        const locale = detectBrowserLanguage
          ? req.headers['accept-language']?.split(',')[0]?.split('-')[0] || defaultLocale
          : defaultLocale

        // Set locale in request context
        ;(req as any).locale = locale
        next()
      },
    })

    // Add route middleware for locale handling
    context.addRouteMiddleware({
      name: 'i18n',
      handler: async (routeContext) => {
        // Handle locale prefix in routes
        // Redirect if locale is missing/invalid
      },
    })

    // Add template for i18n utilities
    context.utils.addTemplate({
      filename: 'i18n.ts',
      getContents: () => `
        export const locales = ${JSON.stringify(locales)}
        export const defaultLocale = '${defaultLocale}'
        export const strategy = '${strategy}'
        
        export function getLocale(): string {
          // Implementation
          return '${defaultLocale}'
        }
        
        export function t(key: string, params?: Record<string, string>): string {
          // Translation implementation
          return key
        }
      `,
    })

    // Hook into build process
    context.hooks['build:before'] = async () => {
      // Pre-process translation files
    }
  },
})
