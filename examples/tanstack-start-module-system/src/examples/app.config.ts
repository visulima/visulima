/**
 * Example: Application configuration using modules
 * Shows how modules would be configured in a TanStack Start app
 */

import type { ModuleEntry } from '../types.js'
import authModule from './auth-module.js'
import i18nModule from './i18n-module.js'
import databaseModule from './database-module.js'

/**
 * TanStack Start application configuration with modules
 * This would be used in vite.config.ts
 */
export const modules: ModuleEntry[] = [
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

  // Database module with options
  [
    databaseModule,
    {
      provider: 'postgresql',
      url: process.env.DATABASE_URL,
      migrations: true,
      seed: process.env.NODE_ENV === 'development',
    },
  ],
]
