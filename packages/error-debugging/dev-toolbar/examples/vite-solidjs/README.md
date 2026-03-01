# Dev Toolbar SolidJS Example

This example demonstrates how to use `@visulima/dev-toolbar` with Vite and SolidJS.

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
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

export default defineConfig({
    plugins: [
        solid(),
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

## Learn More

- [Documentation](https://visulima.com/packages/dev-toolbar)
- [SolidJS](https://solidjs.com)
- [GitHub Repository](https://github.com/visulima/visulima)
