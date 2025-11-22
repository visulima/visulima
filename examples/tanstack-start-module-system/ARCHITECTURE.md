# TanStack Start Module System Architecture

## Design Philosophy

The module system is built around a **Vite plugin** as the core integration point. This approach provides:

1. **Deep Build Integration** - Modules are loaded during Vite's config phase, allowing them to modify the build process
2. **Virtual Modules** - Modules can generate code that can be imported in your app
3. **Lifecycle Alignment** - Module hooks align with Vite's plugin hooks
4. **Type Safety** - Full TypeScript support throughout

## Core Components

### 1. Vite Plugin (`startModulePlugin`)

The plugin is the entry point that:
- Loads modules during `configResolved` hook
- Manages virtual modules
- Integrates server middleware
- Handles module hooks
- Generates manifests

```typescript
// vite.config.ts
import { startModulePlugin } from '@tanstack/start-modules'

export default defineConfig({
  plugins: [
    startModulePlugin({
      modules: ['@tanstack/start-auth'],
    }),
  ],
})
```

### 2. Module Definition

Modules are defined using `defineStartModule`:

```typescript
export default defineStartModule({
  meta: {
    name: 'my-module',
    configKey: 'myModule',
  },
  setup(context: ModuleContext) {
    // Module implementation
  },
})
```

### 3. Module Context

The context provides access to:
- **Vite Config** - Resolved Vite configuration
- **Utilities** - Add plugins, middleware, virtual modules
- **Hooks** - Lifecycle event hooks
- **Options** - Merged module options
- **Path Resolution** - Resolve paths and aliases

## Key Improvements Over Initial Design

### 1. Vite Plugin Integration

**Before**: Modules were loaded separately from the build system
**After**: Modules are loaded via Vite plugin, deeply integrated with the build

### 2. Simplified Context Interface

**Before**: 
```typescript
setup(options: ModuleOptions, context: ModuleContext)
```

**After**:
```typescript
setup(context: ModuleContext)
// Options accessed via context.options
```

### 3. Virtual Modules

Modules can now generate virtual modules:

```typescript
context.addVirtualModule('i18n', () => `
  export const locales = ${JSON.stringify(locales)}
  export function t(key: string) { /* ... */ }
`)

// In your app
import { t } from 'virtual:start-modules/i18n'
```

### 4. Better Hook Alignment

Hooks now align with Vite's lifecycle:
- `build:before` / `build:done` - Build lifecycle
- `dev:server:configure` / `dev:server:ready` - Dev server lifecycle
- `router:ready` - Router initialization
- `app:ready` - Application ready

### 5. Type Safety

Full TypeScript support with:
- Typed module context
- Typed hooks
- Typed options (via type assertions)
- Typed virtual modules

## Module Lifecycle

1. **Plugin Initialization** - Plugin is added to Vite config
2. **Config Resolution** - `configResolved` hook loads modules
3. **Module Setup** - Each module's `setup` function is called
4. **Hook Registration** - Module hooks are registered
5. **Build/Dev** - Hooks are called at appropriate times

## Virtual Modules

Virtual modules are resolved and loaded by the plugin:

```typescript
// Module adds virtual module
context.addVirtualModule('utils', 'export const value = 42')

// App imports it
import { value } from 'virtual:start-modules/utils'
```

The plugin handles:
- Resolving virtual module IDs
- Loading module content
- Supporting both string and function-based content

## Server Middleware

Modules can add server middleware that runs in the Vite dev server:

```typescript
context.addServerMiddleware({
  path: '/api/auth',
  handler: async (req, res, next) => {
    // Middleware logic
    next()
  },
})
```

## Benefits of This Design

1. **Build-Time Integration** - Modules can modify the build process
2. **Code Generation** - Virtual modules enable code generation
3. **Type Safety** - Full TypeScript support
4. **Developer Experience** - Simple, intuitive API
5. **Extensibility** - Easy to add new features
6. **Performance** - Modules loaded once during config phase

## Comparison with Nuxt

| Feature | Nuxt | TanStack Start (This Design) |
|---------|------|------------------------------|
| Integration | Nuxt Kit | Vite Plugin |
| Module Loading | Nuxt internal | Vite `configResolved` |
| Virtual Modules | Nuxt virtual modules | Vite virtual modules |
| Hooks | Nuxt hooks | Vite plugin hooks + custom |
| Type Safety | Partial | Full TypeScript |

## Future Enhancements

1. **Module Dependencies** - Automatic dependency resolution
2. **Module Composition** - Modules can compose other modules
3. **Hot Module Replacement** - Support for HMR in modules
4. **Module DevTools** - Debugging tools for modules
5. **Module Marketplace** - Discover and install modules
