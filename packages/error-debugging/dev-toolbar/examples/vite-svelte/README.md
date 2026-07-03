# Dev Toolbar Vite + Svelte Example

This example demonstrates how to use `@visulima/dev-toolbar` with Vite and Svelte 5.

## Features

- ✅ Dev Toolbar with built-in apps (Settings, Timeline, More)
- ✅ Custom app registration via global API
- ✅ Hook system for event subscriptions
- ✅ Timeline event tracking
- ✅ Error overlay via `@visulima/vite-overlay`
- ✅ Svelte 5 runes syntax

## Getting Started

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm dev

# Build for production
pnpm build

# Type check
pnpm check

# Preview production build
pnpm preview
```

## Setup

```typescript
// vite.config.ts
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { devToolbar } from "@visulima/dev-toolbar/vite";
import viteOverlay from "@visulima/vite-overlay";
import { defineConfig } from "vite";

export default defineConfig({
    plugins: [
        svelte(),
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
- [Svelte](https://svelte.dev)
- [SvelteKit](https://kit.svelte.dev)
- [GitHub Repository](https://github.com/visulima/visulima)
