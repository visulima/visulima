# Dev Toolbar React Router Example

This example demonstrates how to use `@visulima/dev-toolbar` with Vite and React Router.

## Features

- ✅ Dev Toolbar with built-in apps (Settings, Timeline, More)
- ✅ Custom app registration via global API
- ✅ Hook system for event subscriptions
- ✅ Timeline event tracking
- ✅ Error overlay via `@visulima/vite-overlay`
- ✅ React Router with client-side navigation

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
import { defineConfig } from "vite";

export default defineConfig({
    plugins: [
        react(),
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

```tsx
// src/main.tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";

import App from "./App.tsx";

createRoot(document.querySelector("#root")!).render(
    <StrictMode>
        <BrowserRouter>
            <App />
        </BrowserRouter>
    </StrictMode>,
);
```

## Routes

- `/` — Home page with error trigger buttons
- `/about` — About page demonstrating cross-route error handling

## Learn More

- [Documentation](https://visulima.com/packages/dev-toolbar)
- [React Router](https://reactrouter.com)
- [GitHub Repository](https://github.com/visulima/visulima)
