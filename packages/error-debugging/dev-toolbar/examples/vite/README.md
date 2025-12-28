# Dev Toolbar Vite Example

This example demonstrates how to use `@visulima/dev-toolbar` with Vite.

## Features

- ✅ Dev Toolbar with built-in apps (Settings, Timeline, More)
- ✅ Custom app registration via global API
- ✅ RPC communication (server functions)
- ✅ Hook system for event subscriptions
- ✅ Timeline event tracking

## Getting Started

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview
```

## Usage

### Basic Setup

```typescript
// vite.config.ts
import { devToolbar } from "@visulima/dev-toolbar";
import { defineConfig } from "vite";

export default defineConfig({
    plugins: [
        devToolbar({
            apps: {
                settings: true,
                timeline: true,
            },
            placement: "bottom-center",
            defaultVisible: true,
        }),
    ],
});
```

### Global API

The dev toolbar exposes a global API on `window.__VISULIMA_DEVTOOLS__`:

```typescript
// Show/hide toolbar
window.__VISULIMA_DEVTOOLS__.show();
window.__VISULIMA_DEVTOOLS__.hide();

// Open an app
window.__VISULIMA_DEVTOOLS__.openApp('dev-toolbar:settings');

// Register a custom app
window.__VISULIMA_DEVTOOLS__.registerApp({
    id: 'my-app',
    name: 'My App',
    icon: '<svg>...</svg>',
    init(canvas, eventTarget, helpers) {
        // Initialize your app UI here
    },
});
```

### Hook System

Subscribe to dev toolbar events:

```typescript
if (window.__DEV_TOOLBAR_HOOK__) {
    window.__DEV_TOOLBAR_HOOK__.on('devtools:init', () => {
        console.log('Dev Tools initialized!');
    });

    window.__DEV_TOOLBAR_HOOK__.on('devtools:open', (appId) => {
        console.log(`App opened: ${appId}`);
    });
}
```

### RPC Functions

Call server functions from your apps:

```typescript
// In your app's init function
const config = await helpers.rpc.getViteConfig();
const moduleGraph = await helpers.rpc.getModuleGraph();
await helpers.rpc.openInEditor('src/App.ts', 10, 5);
```

### Timeline Events

Add events to the timeline:

```typescript
if (window.__DEV_TOOLBAR_HOOK__) {
    window.__DEV_TOOLBAR_HOOK__.addTimelineEvent('custom', {
        id: 'event-1',
        title: 'My Event',
        time: Date.now(),
        level: 'info',
        data: { custom: 'data' },
    });
}
```

## Learn More

- [Documentation](https://visulima.com/packages/dev-toolbar)
- [GitHub Repository](https://github.com/visulima/visulima)
