# Dev Toolbar TanStack Start + Cloudflare Example

This example demonstrates how to use `@visulima/dev-toolbar` with [TanStack Start](https://tanstack.com/start) deployed on [Cloudflare Pages](https://pages.cloudflare.com) with full SSR support.

## Features

- Dev Toolbar with built-in apps (Settings, Timeline, More)
- Hook system for event subscriptions (client-side via `useEffect`)
- Timeline event tracking
- Error overlay via `@visulima/vite-overlay`
- TanStack Start SSR with file-based routing
- TanStack Router Devtools
- Cloudflare Pages deployment via Nitro `cloudflare-pages` preset

## Getting Started

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm dev

# Build for production
pnpm build

# Preview with Wrangler (Cloudflare local emulation)
pnpm cf:preview

# Deploy to Cloudflare Pages
pnpm deploy
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
        tanstackStart({ sitemap: { host: "https://your-project.pages.dev" } }),
        viteReact(),
        devToolbar({
            apps: { settings: true, timeline: true },
            defaultVisible: true,
            placement: "bottom-center",
        }),
    ],
});
```

> **SSR Note**: Because TanStack Start renders on the server, the dev-toolbar hook
> integration must be inside a `useEffect` to ensure it only runs in the browser.

> **Cloudflare Note**: To enable the Cloudflare Pages SSR preset in newer versions
> of TanStack Start (≥ 1.160), configure Nitro via `app.config.ts`:
>
> ```ts
> export default defineConfig({ server: { preset: "cloudflare-pages" } });
> ```
>
> The build output goes to `.output/public`, referenced by `wrangler.jsonc` via
> `pages_build_output_dir`. Run `pnpm deploy` to publish to Cloudflare Pages.

## Learn More

- [Documentation](https://visulima.com/packages/dev-toolbar)
- [TanStack Start](https://tanstack.com/start)
- [Cloudflare Pages](https://developers.cloudflare.com/pages)
- [GitHub Repository](https://github.com/visulima/visulima)
