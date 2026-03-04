# Dev Toolbar Vite + React + Cloudflare Example

This example demonstrates how to use `@visulima/dev-toolbar` with Vite, React, and [Cloudflare Workers](https://workers.cloudflare.com/) via the `@cloudflare/vite-plugin`.

## Features

- ✅ Dev Toolbar with built-in apps (Settings, Timeline, More)
- ✅ Custom app registration via global API
- ✅ Hook system for event subscriptions
- ✅ Timeline event tracking
- ✅ Error overlay via `@visulima/vite-overlay`
- ✅ Cloudflare Workers serving the React SPA via `ASSETS` binding
- ✅ Deploy to Cloudflare Pages with `wrangler`

## Getting Started

```bash
# Install dependencies
pnpm install

# Start Vite dev server (with Cloudflare Workers bindings emulation)
pnpm dev

# Preview with Wrangler (closer to production)
pnpm cf:preview

# Build for production
pnpm build

# Deploy to Cloudflare Pages
pnpm deploy
```

## Setup

```typescript
// vite.config.ts
import { cloudflare } from "@cloudflare/vite-plugin";
import { devToolbar } from "@visulima/dev-toolbar/vite";
import viteOverlay from "@visulima/vite-overlay";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
    plugins: [
        cloudflare(),
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

```jsonc
// wrangler.jsonc
{
    "name": "dev-toolbar-cloudflare",
    "compatibility_date": "2025-01-01",
    "compatibility_flags": ["nodejs_compat"],
    "main": "./src/worker.ts",
    "assets": {
        "directory": "./public",
        "binding": "ASSETS",
    },
}
```

## Learn More

- [Documentation](https://visulima.com/packages/dev-toolbar)
- [Cloudflare Workers](https://workers.cloudflare.com)
- [@cloudflare/vite-plugin](https://github.com/cloudflare/workers-sdk/tree/main/packages/vite-plugin)
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/)
- [GitHub Repository](https://github.com/visulima/visulima)
