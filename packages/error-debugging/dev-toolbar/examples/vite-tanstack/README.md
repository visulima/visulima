# Dev Toolbar TanStack Router Example

This example demonstrates how to use `@visulima/dev-toolbar` with Vite and TanStack Router.

## Features

- ✅ Dev Toolbar with built-in apps (Settings, Timeline, More)
- ✅ Custom app registration via global API
- ✅ Hook system for event subscriptions
- ✅ Timeline event tracking
- ✅ Error overlay via `@visulima/vite-overlay`
- ✅ TanStack Router with file-based routing
- ✅ TanStack Router Devtools

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

## Setup

```typescript
// vite.config.ts
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { devToolbar } from "@visulima/dev-toolbar/vite";
import viteOverlay from "@visulima/vite-overlay";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
    plugins: [
        tanstackRouter({ autoCodeSplitting: true }),
        viteReact(),
        viteOverlay({ showBallonButton: false }),
        devToolbar({
            apps: {
                settings: true,
                timeline: true,
            },
            defaultVisible: true,
            placement: "bottom-center",
        }),
    ],
});
```

## Routes

- `/` — Home page
- `/error-test` — Error testing page with buttons to trigger various error types

## Learn More

- [Documentation](https://visulima.com/packages/dev-toolbar)
- [TanStack Router](https://tanstack.com/router)
- [GitHub Repository](https://github.com/visulima/visulima)
