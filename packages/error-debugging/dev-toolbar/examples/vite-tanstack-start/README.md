# Dev Toolbar TanStack Start Example

This example demonstrates how to use `@visulima/dev-toolbar` with [TanStack Start](https://tanstack.com/start), the full-stack React SSR framework built on TanStack Router.

## Features

- ✅ Dev Toolbar with built-in apps (Settings, Timeline, More)
- ✅ Hook system for event subscriptions (client-side via `useEffect`)
- ✅ Timeline event tracking
- ✅ Error overlay via `@visulima/vite-overlay`
- ✅ TanStack Start SSR with file-based routing
- ✅ TanStack Router Devtools

## Getting Started

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start
```

## Setup

```typescript
// vite.config.ts
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { devToolbar } from "@visulima/dev-toolbar/vite";
import viteOverlay from "@visulima/vite-overlay";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
    resolve: {
        tsconfigPaths: true,
    },
    plugins: [
        viteOverlay({ showBallonButton: false }),
        tanstackStart({ customViteReactPlugin: true }),
        viteReact(),
        devToolbar({
            apps: { settings: true, timeline: true },
            defaultVisible: true,
            placement: "bottom-center",
        }),
    ],
});
```

> **Note**: Because TanStack Start renders on the server, the dev-toolbar hook
> integration must be inside a `useEffect` to ensure it only runs in the browser.

## Learn More

- [Documentation](https://visulima.com/packages/dev-toolbar)
- [TanStack Start](https://tanstack.com/start)
- [TanStack Router](https://tanstack.com/router)
- [GitHub Repository](https://github.com/visulima/visulima)
