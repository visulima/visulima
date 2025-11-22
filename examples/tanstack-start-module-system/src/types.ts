/**
 * Core types for TanStack Start module system
 */

import type { Plugin } from 'vite'
import type { Router } from '@tanstack/react-router'

/**
 * Module metadata
 */
export interface ModuleMeta {
  name: string
  version?: string
  configKey?: string
  compatibility?: {
    nuxt?: string
    start?: string
  }
}

/**
 * Module options passed from user configuration
 */
export type ModuleOptions = Record<string, unknown>

/**
 * Module context providing access to framework internals
 */
export interface ModuleContext {
  // Configuration
  config: StartConfig
  
  // Utilities
  addVitePlugin: (plugin: Plugin) => void
  addServerMiddleware: (middleware: ServerMiddleware) => void
  addClientPlugin: (plugin: ClientPlugin) => void
  addRouteMiddleware: (middleware: RouteMiddleware) => void
  
  // Hooks
  hooks: ModuleHooks
  
  // Runtime utilities
  utils: {
    resolvePath: (path: string) => string
    addTemplate: (template: Template) => void
    addLayout: (layout: LayoutConfig) => void
  }
  
  // Build-time utilities
  extendBuild: (extendFn: BuildExtender) => void
  extendRouter: (extendFn: RouterExtender) => void
}

/**
 * Module definition
 */
export interface StartModule {
  meta?: ModuleMeta
  setup: (options: ModuleOptions, context: ModuleContext) => void | Promise<void>
  hooks?: Partial<ModuleHooks>
}

/**
 * Module hooks for lifecycle events
 */
export interface ModuleHooks {
  'build:before': () => void | Promise<void>
  'build:done': () => void | Promise<void>
  'dev:before': () => void | Promise<void>
  'dev:ready': () => void | Promise<void>
  'router:ready': (router: Router) => void | Promise<void>
  'server:ready': () => void | Promise<void>
}

/**
 * Server middleware definition
 */
export interface ServerMiddleware {
  path: string
  handler: (req: Request, res: Response, next: () => void) => void | Promise<void>
}

/**
 * Client plugin definition
 */
export interface ClientPlugin {
  name: string
  setup: (app: any) => void | Promise<void>
}

/**
 * Route middleware definition
 */
export interface RouteMiddleware {
  name: string
  handler: (context: RouteContext) => void | Promise<void>
}

/**
 * Route context for middleware
 */
export interface RouteContext {
  route: any
  params: Record<string, string>
  search: Record<string, unknown>
}

/**
 * Template definition for code generation
 */
export interface Template {
  filename: string
  getContents: (data: Record<string, unknown>) => string
  write?: boolean
}

/**
 * Layout configuration
 */
export interface LayoutConfig {
  name: string
  component: string
  slots?: string[]
}

/**
 * Build extender function
 */
export type BuildExtender = (config: ViteConfig) => ViteConfig | void

/**
 * Router extender function
 */
export type RouterExtender = (router: Router) => Router | void

/**
 * Start configuration
 */
export interface StartConfig {
  modules?: (string | [string, ModuleOptions] | StartModule)[]
  vite?: ViteConfig
  router?: RouterConfig
  server?: ServerConfig
  [key: string]: unknown
}

/**
 * Vite configuration
 */
export type ViteConfig = any

/**
 * Router configuration
 */
export interface RouterConfig {
  [key: string]: unknown
}

/**
 * Server configuration
 */
export interface ServerConfig {
  port?: number
  host?: string
  [key: string]: unknown
}
