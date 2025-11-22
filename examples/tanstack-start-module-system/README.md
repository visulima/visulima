# TanStack Start Module System (Nuxt-Inspired)

This example demonstrates how a module system could work in TanStack Start, inspired by Nuxt's module architecture, with a **Vite plugin as the core integration point**.

## Overview

Nuxt modules are powerful plugins that can:
- Extend the framework configuration
- Add Vite plugins
- Register server middleware
- Add client-side plugins
- Modify the build process
- Add runtime utilities

This implementation provides similar functionality for TanStack Start, integrated through a **Vite plugin** that handles module loading and initialization during the build process.

## Architecture

### Core Components

1. **Vite Plugin** (`startModulePlugin`) - Core integration point that loads modules during Vite's config phase
2. **Module Definition** - A module is an object with `meta` and `setup` function
3. **Module Context** - Provides access to Vite config, hooks, and utilities
4. **Module Registry** - Manages module loading and execution
5. **Virtual Modules** - Modules can generate virtual modules for code generation
6. **Hooks System** - Aligned with Vite's lifecycle hooks

## Usage

### 1. Install and Configure the Plugin

In your `vite.config.ts`:

```typescript
import { defineConfig } from 'vite'
import { startModulePlugin } from '@tanstack/start-modules'

export default defineConfig({
  plugins: [
    startModulePlugin({
      modules: [
        '@tanstack/start-auth',
        ['@tanstack/start-i18n', { locales: ['en', 'fr'] }],
      ],
    }),
  ],
})
```

### 2. Module Structure

A TanStack Start module follows this pattern:

```typescript
import { defineStartModule } from '@tanstack/start-modules'
import type { ModuleContext } from '@tanstack/start-modules'

export default defineStartModule({
  meta: {
    name: 'my-module',
    version: '1.0.0',
    configKey: 'myModule'
  },
  
  setup(context: ModuleContext) {
    // Access options via context.options
    const options = context.options
    
    // Add Vite plugins
    context.addVitePlugin({
      name: 'my-plugin',
      // ...
    })
    
    // Add virtual modules
    context.addVirtualModule('my-utils', () => `
      export const value = '${options.value}'
    `)
    
    // Add server middleware
    context.addServerMiddleware({
      path: '/api/my-endpoint',
      handler: async (req, res, next) => {
        // ...
      }
    })
    
    // Hook into lifecycle events
    context.hooks['router:ready'] = async (router) => {
      // ...
    }
  }
})
```

## Key Features

### Virtual Modules

Modules can generate virtual modules that can be imported in your app:

```typescript
// In your module
context.addVirtualModule('i18n', () => `
  export const locales = ${JSON.stringify(locales)}
  export function t(key: string) { /* ... */ }
`)

// In your app
import { t } from 'virtual:start-modules/i18n'
```

### Lifecycle Hooks

Modules can hook into various lifecycle events:
- `build:before` - Before build starts
- `build:done` - After build completes
- `dev:server:configure` - When dev server is being configured
- `dev:server:ready` - When dev server is ready
- `router:ready` - When router is initialized
- `app:ready` - When app is ready

### Module Options

Modules can accept options in multiple ways:

```typescript
// In vite.config.ts
startModulePlugin({
  modules: [
    // String format
    '@tanstack/start-auth',
    
    // Array format with options
    ['@tanstack/start-auth', { providers: ['github'] }],
    
    // Direct module object
    myCustomModule,
  ],
})
```

Options are merged with config file options and accessible via `context.options`.
