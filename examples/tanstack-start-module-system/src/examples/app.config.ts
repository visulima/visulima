/**
 * Example: Application configuration using modules
 * Shows how modules would be configured in a TanStack Start app
 */

import type { StartConfig } from './types.js'
import authModule from './examples/auth-module.js'
import i18nModule from './examples/i18n-module.js'
import databaseModule from './examples/database-module.js'

/**
 * TanStack Start application configuration with modules
 */
export const startConfig: StartConfig = {
  // Register modules
  modules: [
    // String format - module will be imported from node_modules
    '@tanstack/start-router',

    // Array format - module with options
    [
      '@tanstack/start-auth',
      {
        providers: ['github', 'google'],
        sessionSecret: process.env.SESSION_SECRET,
        redirectTo: '/dashboard',
      },
    ],

    // Direct module object
    i18nModule,
    {
      ...i18nModule,
      meta: {
        ...i18nModule.meta!,
        name: 'custom-i18n',
      },
    },

    // Database module
    [
      databaseModule,
      {
        provider: 'postgresql',
        url: process.env.DATABASE_URL,
        migrations: true,
        seed: process.env.NODE_ENV === 'development',
      },
    ],
  ],

  // Module-specific configuration (using configKey)
  auth: {
    providers: ['github', 'google'],
    sessionSecret: process.env.SESSION_SECRET,
  },

  i18n: {
    locales: ['en', 'fr', 'de', 'es'],
    defaultLocale: 'en',
    strategy: 'prefix_except_default',
    detectBrowserLanguage: true,
  },

  database: {
    provider: 'postgresql',
    url: process.env.DATABASE_URL,
    migrations: true,
  },

  // Standard TanStack Start configuration
  vite: {
    plugins: [],
  },

  router: {
    // Router configuration
  },

  server: {
    port: 3000,
    host: 'localhost',
  },
}
