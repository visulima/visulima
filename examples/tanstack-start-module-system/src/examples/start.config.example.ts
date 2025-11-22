/**
 * Example: Start configuration file
 * Alternative way to configure modules
 */

import type { ModuleEntry } from '../types.js'
import authModule from './auth-module.js'
import i18nModule from './i18n-module.js'

/**
 * Start configuration
 * This file can be imported by the Vite plugin
 */
export default {
  modules: [
    '@tanstack/start-router',
    ['@tanstack/start-auth', { providers: ['github'] }],
    i18nModule,
  ] as ModuleEntry[],

  // Module options
  auth: {
    providers: ['github', 'google'],
    sessionSecret: process.env.SESSION_SECRET,
  },

  i18n: {
    locales: ['en', 'fr', 'de'],
    defaultLocale: 'en',
  },
}
