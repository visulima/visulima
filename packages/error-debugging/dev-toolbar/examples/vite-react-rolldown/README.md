# Dev Toolbar Rolldown-Vite + React Example

This example demonstrates how to use `@visulima/dev-toolbar` with [Rolldown-Vite](https://github.com/rolldown/vite) and React.

> Rolldown-Vite is an experimental Vite fork that uses Rolldown as its bundler for faster builds.

## Features

- ✅ Dev Toolbar with built-in apps (Settings, Timeline, More)
- ✅ Custom app registration via global API
- ✅ Hook system for event subscriptions
- ✅ Timeline event tracking
- ✅ Error overlay via `@visulima/vite-overlay`

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
import { devToolbar } from "@visulima/dev-toolbar/vite";
import viteOverlay from "@visulima/vite-overlay";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite"; // resolves to rolldown-vite

export default defineConfig({
    plugins: [
        react(),
        viteOverlay({ showBallonButton: false }),
        devToolbar({
            apps: { settings: true, timeline: true },
            defaultVisible: true,
            placement: "bottom-center",
        }),
    ],
});
```

## Learn More

- [Documentation](https://visulima.com/packages/dev-toolbar)
- [Rolldown-Vite](https://github.com/rolldown/vite)
- [GitHub Repository](https://github.com/visulima/visulima)
