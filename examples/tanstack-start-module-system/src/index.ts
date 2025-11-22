/**
 * TanStack Start Module System
 * 
 * This module system is inspired by Nuxt's module architecture and provides:
 * - Module definition and registration
 * - Module context with hooks and utilities
 * - Module loading and initialization
 * - Lifecycle hooks
 * - Vite plugin integration
 * - Server middleware integration
 * - Client plugin integration
 * - Route middleware integration
 */

export * from './types.js'
export * from './module.js'
export * from './loader.js'

// Re-export examples for reference
export { default as authModule } from './examples/auth-module.js'
export { default as i18nModule } from './examples/i18n-module.js'
export { default as databaseModule } from './examples/database-module.js'
