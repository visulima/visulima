/**
 * Core types for TanStack Start module system
 */

import type { Plugin, ResolvedConfig, ViteDevServer } from 'vite'
import type { Router } from '@tanstack/react-router'

/**
 * Module metadata
 */
export interface ModuleMeta {
  name: string
  version?: string
  configKey?: string
  compatibility?: {
    start?: string
  }
}

/**
 * Module options passed from user configuration
 */
export type ModuleOptions = Record<string, unknown>

/**
 * Module context providing access to framework internals
 * This context is available during module setup and hooks
 */
export interface ModuleContext {
  // Vite resolved configuration
  viteConfig: ResolvedConfig
  
  // Project root directory
  root: string
  
  // Module utilities
  addVitePlugin: (plugin: Plugin | Plugin[]) => void
  addVirtualModule: (id: string, content: string | (() => string)) => void
  addServerMiddleware: (middleware: ServerMiddleware) => void
  addClientPlugin: (plugin: ClientPlugin) => void
  addRouteMiddleware: (middleware: RouteMiddleware) => void
  
  // Code generation utilities
  addTemplate: (template: Template) => void
  addLayout: (layout: LayoutConfig) => void
  
  // Path resolution
  resolve: {
    path: (path: string) => string
    alias: (alias: string) => string | undefined
  }
  
  // Hooks for module lifecycle
  hooks: ModuleHooks
  
  // Module options
  options: ModuleOptions
  
  // Module metadata
  meta: ModuleMeta
}

/**
 * Module definition
 */
export interface StartModule {
  meta?: ModuleMeta
  setup: (context: ModuleContext) => void | Promise<void>
  hooks?: Partial<ModuleHooks>
  dependencies?: string[]
  optionalDependencies?: string[]
}

/**
 * Module entry - can be a string, array with options, or direct module
 */
export type ModuleEntry = string | [string, ModuleOptions] | StartModule

/**
 * Module hooks for lifecycle events
 * These map to Vite's plugin hooks and TanStack Start lifecycle
 */
export interface ModuleHooks {
  // Vite build hooks
  'build:before': () => void | Promise<void>
  'build:done': () => void | Promise<void>
  
  // Vite dev server hooks
  'dev:server:configure': (server: ViteDevServer) => void | Promise<void>
  'dev:server:ready': (server: ViteDevServer) => void | Promise<void>
  
  // Router hooks
  'router:ready': (router: Router) => void | Promise<void>
  
  // Application hooks
  'app:ready': () => void | Promise<void>
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
 * Start module configuration
 * Modules are configured in vite.config.ts or start.config.ts
 */
export interface StartModuleConfig {
  modules?: ModuleEntry[]
  [key: string]: unknown
}

/**
 * Plugin options for the Start module system Vite plugin
 */
export interface StartModulePluginOptions {
  configFile?: string
  modules?: ModuleEntry[]
  root?: string
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
