<!-- START_PACKAGE_OG_IMAGE_PLACEHOLDER --><!-- END_PACKAGE_OG_IMAGE_PLACEHOLDER -->

<br />

<div align="center">

[![typescript-image][typescript-badge]][typescript-url]
[![mit licence][license-badge]][license]
[![npm downloads][npm-downloads-badge]][npm-downloads]
[![Chat][chat-badge]][chat]
[![PRs Welcome][prs-welcome-badge]][prs-welcome]

</div>

---

<div align="center">
    <p>
        <sup>
            Daniel Bannert's open source work is supported by the community on <a href="https://github.com/sponsors/prisis">GitHub Sponsors</a>
        </sup>
    </p>
</div>

---

## Overview

`@visulima/dev-toolbar` is a framework-agnostic development toolbar for **any Vite project** — React, Vue, Svelte, SolidJS, or plain HTML. Inspired by Astro DevToolbar, Vue DevTools, and Nuxt DevTools, it provides a consistent developer experience regardless of your framework.

The toolbar renders inside a Shadow DOM custom element (zero style leakage), communicates with the Vite dev server over type-safe RPC, and ships **nine built-in apps** covering the most common development workflows.

## Install

```sh
npm install -D @visulima/dev-toolbar
```

```sh
pnpm add -D @visulima/dev-toolbar
```

```sh
yarn add -D @visulima/dev-toolbar
```

## Quick Start

Add the plugin to your `vite.config.ts`:

```ts
import { defineConfig } from "vite";
import { devToolbar } from "@visulima/dev-toolbar/vite";

export default defineConfig({
    plugins: [
        devToolbar(),
    ],
});
```

Start your dev server and press **`Alt`+`Shift`+`D`** to open the toolbar.

## Built-in Apps

| App | What it does |
|---|---|
| **Accessibility** | axe-core WCAG audit with live element overlays and sessionStorage persistence |
| **Performance** | Web Vitals (LCP, INP, CLS, FCP, TTFB), resource timing, navigation waterfall |
| **SEO** | Social preview cards for 7 platforms + full meta tag audit |
| **Timeline** | Chronological event log from your app and integrated libraries |
| **Module Graph** | Browse and filter Vite's live module dependency graph |
| **Vite Config** | Inspect the fully resolved Vite configuration |
| **Inspector** | Click any element to jump to its JSX source in your editor |
| **Tailwind** | Browse all resolved Tailwind CSS design tokens and their values |
| **Settings** | Theme, toolbar behaviour, panel sizing, and custom keyboard shortcuts |

All apps are enabled by default. Disable individual apps via plugin options:

```ts
devToolbar({
    apps: {
        performance: false,
        seo: false,
    },
})
```

## Plugin Options

```ts
devToolbar({
    // Built-in apps (all true by default)
    apps: {
        a11y: true,
        moduleGraph: true,
        performance: true,
        seo: true,
        settings: true,
        timeline: true,
        viteConfig: true,
        inspector: true,
        tailwind: true,
    },

    // Register custom apps
    customApps: [],

    // Toolbar pill placement
    placement: "bottom-center",     // "bottom-left" | "bottom-center" | "bottom-right"
    position: "bottom",             // "bottom" | "top" | "left" | "right"

    // Panel defaults (users can override via Settings app)
    height: 60,                     // % of viewport height
    width: 80,                      // % of viewport width
    minimizePanelInactive: 5000,    // ms; -1 = never auto-hide
    closeOnOutsideClick: true,

    // Keyboard shortcuts (project-level defaults)
    keybindings: {
        toggle: "Alt+Shift+D",
        close: "Escape",
    },

    // Strip toolbar from production builds (default: true)
    removeDevtoolsOnBuild: true,

    // Force a specific editor for "Open in editor" (auto-detected if omitted)
    editor: "webstorm",

    // JSX source injection for click-to-source in the inspector
    injectSource: {
        enabled: true,           // set false to opt out
        ignore: {
            files: ["**/generated/**"],      // glob patterns
            components: ["StrictMode"],      // component names
        },
    },
})
```

See the [full configuration reference](./docs/configuration.mdx) for all options.

## Keyboard Shortcuts

| Action | Default |
|---|---|
| Toggle toolbar open/close | `Alt`+`Shift`+`D` |
| Close active app / panel | `Escape` |

Both shortcuts are configurable in the Settings app or via plugin options.

## Custom Apps

Build your own devtools panel with a Preact component:

```tsx
/** @jsxImportSource preact */
import type { ComponentChildren } from "preact";
import type { AppComponentProps } from "@visulima/dev-toolbar";

const MyApp = ({ helpers }: AppComponentProps): ComponentChildren => {
    return <div class="p-5">Hello from My App!</div>;
};
```

```ts
// vite.config.ts
devToolbar({
    customApps: [
        {
            id: "my-package:my-app",
            name: "My App",
            icon: myIconSvg,        // raw SVG string
            component: MyApp,
            tooltip: MyTooltip,     // optional hover summary
        },
    ],
})
```

See the [custom apps guide](./docs/custom-apps/creating-apps.mdx) for a step-by-step walkthrough including RPC, tooltips, and styling.

## RPC — Server ↔ Client Communication

Call Node.js functions from your app component over the Vite HMR WebSocket:

```ts
// Add server functions in vite.config.ts
devToolbar({
    serverFunctions: {
        async getRoutes() {
            const files = await fs.readdir("src/pages");
            return files.map((f) => `/${f.replace(/\.(tsx?|jsx?)$/, "")}`);
        },
    },
})

// Call from your app component
const routes = await helpers.rpc.getRoutes();
```

Built-in RPC functions: `getViteConfig()`, `getModuleGraph()`, `openInEditor(file, line, col)`.

## Global API

Programmatic control from any script or the browser console:

```ts
const api = (window as any).__VISULIMA_DEVTOOLS__;

// Open an app
await api.openApp("dev-toolbar:a11y");

// Show a notification badge on an app button
api.notify("my-package:monitor", "warning");

// Update toolbar settings
api.updateSettings({ viewMode: "fullscreen" });

// Access RPC from outside a component
const config = await api.rpc.getViteConfig();
```

## Library Integration

Add zero-dependency devtools support to your library. Users get devtools automatically when they install the toolbar — no extra configuration needed:

```ts
function installDevTools(instance: MyLibrary): void {
    const hook = (window as any).__DEV_TOOLBAR_HOOK__;
    if (!hook) return;

    hook.registerApp({
        id: "my-library:devtools",
        name: "My Library",
        icon: iconSvg,
        component: MyLibraryPanel,
    });

    instance.on("action", (action) => {
        hook.addTimelineEvent("my-library", {
            id: crypto.randomUUID(),
            title: action.type,
            time: Date.now(),
            level: "info",
            data: action,
        });
    });
}
```

See the [library integration guide](./docs/integrations/library-integration.mdx) for the full pattern.

## Documentation

All docs are in the [`docs/`](./docs/) folder in Fumadocs MDX format:

| Page | Contents |
|---|---|
| [Getting Started](./docs/getting-started.mdx) | Install, framework examples, first steps |
| [Configuration](./docs/configuration.mdx) | Full plugin options reference |
| [Accessibility](./docs/built-in-apps/accessibility.mdx) | axe-core, overlays, WCAG standards |
| [Performance](./docs/built-in-apps/performance.mdx) | Web Vitals thresholds, timing APIs |
| [SEO](./docs/built-in-apps/seo.mdx) | Social previews, meta tag audit |
| [Timeline](./docs/built-in-apps/timeline.mdx) | Event structure, emitting events |
| [Module Graph](./docs/built-in-apps/module-graph.mdx) | Search, ext badges, importer view |
| [Vite Config](./docs/built-in-apps/vite-config.mdx) | Resolved config sections |
| [Settings](./docs/built-in-apps/settings.mdx) | All settings, localStorage schema |
| [Creating Apps](./docs/custom-apps/creating-apps.mdx) | Step-by-step custom app guide |
| [App API](./docs/custom-apps/app-api.mdx) | TypeScript interface reference |
| [RPC](./docs/custom-apps/rpc.mdx) | Server functions, type-safe pattern |
| [Global API](./docs/custom-apps/global-api.mdx) | `__VISULIMA_DEVTOOLS__` reference |
| [Library Integration](./docs/integrations/library-integration.mdx) | Zero-dependency hook pattern |

## Supported Node.js Versions

Libraries in this ecosystem make the best effort to track
[Node.js' release schedule](https://github.com/nodejs/release#release-schedule).
Here's [a post on why we think this is important](https://medium.com/the-node-js-collection/maintainers-should-consider-following-node-js-release-schedule-ab08ed4de71a).

## Contributing

If you would like to help take a look at the [list of issues](https://github.com/visulima/visulima/issues) and check our [Contributing](https://github.com/visulima/visulima/blob/main/.github/CONTRIBUTING.md) guidelines.

> **Note:** please note that this project is released with a Contributor Code of Conduct. By participating in this project you agree to abide by its terms.

## Credits

- [Daniel Bannert](https://github.com/prisis)
- [All Contributors](https://github.com/visulima/visulima/graphs/contributors)

## Made with ❤️ at Anolilab

This is an open-source project and will always remain free to use. If you think it's cool, please star it 🌟. [Anolilab](https://www.anolilab.com/open-source) is a Development and AI Studio. Contact us at [hello@anolilab.com](mailto:hello@anolilab.com) if you need any help with these technologies or just want to say hi!

## License

The visulima dev-toolbar is open-sourced software licensed under the [MIT][license]

<!-- badges -->

[license-badge]: https://img.shields.io/npm/l/@visulima/dev-toolbar?style=for-the-badge
[license]: https://github.com/visulima/visulima/blob/main/LICENSE
[npm-downloads-badge]: https://img.shields.io/npm/dm/@visulima/dev-toolbar?style=for-the-badge
[npm-downloads]: https://www.npmjs.com/package/@visulima/dev-toolbar
[prs-welcome-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge
[prs-welcome]: https://github.com/visulima/visulima/blob/main/.github/CONTRIBUTING.md
[chat-badge]: https://img.shields.io/discord/932323359193186354.svg?style=for-the-badge
[chat]: https://discord.gg/TtFJY8xkFK
[typescript-badge]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]: https://www.typescriptlang.org/
