# Dev Toolbar Vite + React SWC Example

This example demonstrates how to use `@visulima/dev-toolbar` with Vite and React using the [SWC](https://swc.rs/) compiler for faster transforms.

## Features

- ✅ Dev Toolbar with built-in apps (Settings, Timeline, More)
- ✅ Custom app registration via global API
- ✅ Hook system for event subscriptions
- ✅ Timeline event tracking
- ✅ Error overlay via `@visulima/vite-overlay`
- ✅ SWC-powered Fast Refresh

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
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";

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
- [SWC](https://swc.rs)
- [GitHub Repository](https://github.com/visulima/visulima)
