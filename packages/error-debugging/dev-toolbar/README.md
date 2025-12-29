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

## Install

```sh
npm install @visulima/dev-toolbar
```

```sh
yarn add @visulima/dev-toolbar
```

```sh
pnpm add @visulima/dev-toolbar
```

## Overview

`@visulima/dev-toolbar` is a framework-agnostic development toolbar for Vite applications. Inspired by Astro's dev-toolbar and Vue/Nuxt DevTools, it provides a powerful, extensible platform for building developer tools with a modern UI built on Preact and Tailwind CSS.

## Features

- **Framework Agnostic**: Works with any Vite-based project (React, Vue, Svelte, etc.)
- **Type-Safe RPC**: Bidirectional communication between client and server with full TypeScript support
- **Hook System**: Global hook (`__DEV_TOOLBAR_HOOK__`) for library integrations
- **Global API**: Programmatic control via `__VISULIMA_DEVTOOLS__` global API
- **Timeline System**: Event tracking and visualization for debugging
- **iframe Isolation**: Optional iframe-based app rendering for complete isolation
- **Customizable**: Register custom apps, configure placement, and extend functionality
- **Built-in Apps**: Settings app, Timeline viewer, and More apps panel

## Architecture

The dev-toolbar is built with a layered architecture for maximum flexibility and extensibility:

```
┌─────────────────────────────────────────────────────────────┐
│                    Vite Plugin Layer                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ vite-plugin  │  │ Server RPC  │  │ Client       │      │
│  │              │  │ Handler     │  │ Injector     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      RPC Layer                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Type-safe    │  │ Server       │  │ Client       │      │
│  │ Definitions  │  │ Functions    │  │ Proxy        │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                 Communication Layer                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Messaging    │  │ Vite HMR     │  │ Broadcast    │      │
│  │ Core         │  │ Preset       │  │ Channel      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Hook System                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Global Hook  │  │ Event        │  │ Library      │      │
│  │              │  │ Emitter      │  │ Integrations │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Toolbar Core                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ DevToolbar   │  │ App Manager  │  │ Settings     │      │
│  │ Class        │  │              │  │ Store        │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │          Global API (__VISULIMA_DEVTOOLS__)          │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Preact UI Layer                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Toolbar      │  │ App Canvas   │  │ iframe       │      │
│  │ Component    │  │              │  │ Renderer     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              UI Library Components                     │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Built-in Apps                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Settings     │  │ More Apps    │  │ Timeline     │      │
│  │ App          │  │ Panel        │  │ App          │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

## Usage

### Basic Setup

Add the plugin to your `vite.config.ts`:

```typescript
import { defineConfig } from "vite";
import { devToolbar } from "@visulima/dev-toolbar/vite";

export default defineConfig({
    plugins: [
        devToolbar({
            apps: {
                settings: true,
                timeline: true,
            },
            placement: "bottom-center",
            defaultVisible: true,
        }),
    ],
});
```

### Plugin Options

```typescript
interface DevToolbarOptions {
    /**
     * Built-in apps to enable
     */
    apps?: {
        settings?: boolean;
        timeline?: boolean;
        [key: string]: boolean | undefined;
    };

    /**
     * Custom apps to register
     */
    customApps?: DevToolbarApp[];

    /**
     * Toolbar placement
     */
    placement?: "bottom-left" | "bottom-center" | "bottom-right";

    /**
     * Whether toolbar is visible by default
     */
    defaultVisible?: boolean;

    /**
     * Custom server RPC functions
     */
    serverFunctions?: Partial<ServerFunctions>;
}
```

### Custom Apps

Create a custom app by implementing the `DevToolbarApp` interface:

```typescript
import type { DevToolbarApp } from "@visulima/dev-toolbar";

const myCustomApp: DevToolbarApp = {
    id: "my-app",
    name: "My App",
    icon: "🔧",
    view: {
        type: "inline",
    },
    async init(canvas, eventTarget, helpers) {
        // Initialize your app UI here
        const container = document.createElement("div");
        container.innerHTML = "<h1>My Custom App</h1>";
        canvas.appendChild(container);
    },
};

// Register in vite.config.ts
export default defineConfig({
    plugins: [
        devToolbar({
            customApps: [myCustomApp],
        }),
    ],
});
```

### iframe Apps

For complete isolation, use an iframe-based app:

```typescript
const isolatedApp: DevToolbarApp = {
    id: "isolated-app",
    name: "Isolated App",
    icon: "📦",
    view: {
        type: "iframe",
        src: "/my-app-iframe.html",
    },
};
```

### Library Integration

Libraries can integrate with the dev-toolbar using the global hook:

```typescript
if (window.__DEV_TOOLBAR_HOOK__) {
    // Register an app
    window.__DEV_TOOLBAR_HOOK__.registerApp({
        id: "my-library",
        name: "My Library",
        icon: "📚",
        view: { type: "inline" },
        init(canvas) {
            // Initialize library dev tools
        },
    });

    // Listen to events
    window.__DEV_TOOLBAR_HOOK__.on("devtools:open", (appId) => {
        console.log(`DevTools opened: ${appId}`);
    });

    // Add timeline events
    window.__DEV_TOOLBAR_HOOK__.addTimelineEvent("my-library", {
        id: "event-1",
        title: "Component Rendered",
        time: Date.now(),
        level: "info",
    });
}
```

### Programmatic Control

Control the toolbar programmatically via the global API:

```typescript
if (window.__VISULIMA_DEVTOOLS__) {
    const devtools = window.__VISULIMA_DEVTOOLS__;

    // Show/hide toolbar
    devtools.show();
    devtools.hide();
    devtools.toggle();

    // Open/close apps
    devtools.openApp("settings");
    devtools.closeApp();

    // Get active app
    const activeApp = devtools.getActiveApp();

    // Register/unregister apps dynamically
    devtools.registerApp(myApp);
    devtools.unregisterApp("my-app");

    // Get all registered apps
    const apps = devtools.getApps();

    // Show notifications
    devtools.notify("my-app", "warning");
    devtools.clearNotification("my-app");

    // Access settings
    const settings = devtools.getSettings();
    devtools.updateSettings({ placement: "bottom-right" });

    // Access RPC functions
    const viteConfig = await devtools.rpc.getViteConfig();
    await devtools.rpc.openInEditor("/path/to/file.ts", 10, 5);

    // Access hook system
    devtools.hook.on("devtools:open", (appId) => {
        console.log(`App opened: ${appId}`);
    });
}
```

## API Reference

### RPC Functions

The RPC layer provides type-safe communication between client and server:

#### Server Functions

```typescript
interface ServerFunctions {
    getViteConfig(): Promise<ViteResolvedConfig>;
    getModuleGraph(): Promise<ModuleNode[]>;
    openInEditor(file: string, line?: number, column?: number): Promise<void>;
    readFile(path: string): Promise<string>;
    [key: string]: (...args: any[]) => Promise<any>;
}
```

#### Client Functions

```typescript
interface ClientFunctions {
    onModuleUpdate(module: ModuleNode): void;
    onConfigChange(config: ViteResolvedConfig): void;
    onHMRUpdate(payload: HMRPayload): void;
    [key: string]: (...args: any[]) => void;
}
```

### Hook System

The hook system provides event-based communication:

```typescript
interface DevToolbarHook {
    on<T extends keyof HookEvents>(event: T, handler: HookEvents[T]): () => void;
    once<T extends keyof HookEvents>(event: T, handler: HookEvents[T]): void;
    off<T extends keyof HookEvents>(event: T, handler?: HookEvents[T]): void;
    emit<T extends keyof HookEvents>(event: T, ...args: Parameters<HookEvents[T]>): void;
    registerApp(app: DevToolbarApp): void;
    addTimelineEvent(groupId: string, event: TimelineEvent): void;
}

interface HookEvents {
    "devtools:init": () => void;
    "devtools:open": (appId: string) => void;
    "devtools:close": () => void;
    "app:error": (error: Error, appId?: string) => void;
    "timeline:event": (event: TimelineEvent) => void;
    [key: string]: (...args: any[]) => void;
}
```

### Timeline System

Track and visualize events:

```typescript
interface TimelineEvent {
    id: string;
    title: string;
    subtitle?: string;
    time: number;
    duration?: number;
    data?: Record<string, any>;
    level?: "info" | "warning" | "error";
}

interface TimelineGroup {
    id: string;
    label: string;
    color?: string;
    events: TimelineEvent[];
}
```

### App Definition

```typescript
interface DevToolbarApp {
    id: string;
    name: string;
    icon: string;
    view?:
        | {
              type: "inline";
          }
        | {
              type: "iframe";
              src: string;
          };
    init?(canvas: ShadowRoot, eventTarget: ToolbarAppEventTarget, helpers: ServerHelpers): void | Promise<void>;
    beforeTogglingOff?(canvas: ShadowRoot): boolean | Promise<boolean>;
}
```

## Package Structure

```
packages/error-debugging/dev-toolbar/src/
├── index.ts                      # Main exports
├── vite-plugin.ts                # Vite plugin entry
│
├── types/                        # Type definitions
│   ├── index.ts                  # Public type exports
│   ├── toolbar.ts                # Toolbar types
│   ├── app.ts                    # App definition types
│   ├── messaging.ts              # Communication types
│   ├── rpc.ts                    # RPC function types
│   ├── hooks.ts                  # Hook system types
│   └── timeline.ts               # Timeline event types
│
├── rpc/                          # RPC Layer
│   ├── index.ts                  # RPC exports
│   ├── server.ts                 # Server-side RPC implementation
│   ├── client.ts                 # Client-side RPC proxy
│   └── functions/                 # Server function implementations
│       ├── vite-config.ts        # Get Vite config
│       ├── open-in-editor.ts     # Open file in editor
│       └── module-graph.ts       # Get module graph
│
├── hooks/                        # Hook System
│   ├── index.ts                  # Hook exports
│   ├── create-hook.ts            # Hook factory
│   ├── global-hook.ts            # __DEV_TOOLBAR_HOOK__ setup
│   └── events.ts                  # Event definitions
│
├── messaging/                    # Messaging Layer
│   ├── index.ts                  # Messaging core
│   ├── create-channel.ts         # Channel factory
│   └── presets/                  # Messaging presets
│       ├── vite/                 # Vite HMR messaging
│       └── broadcast-channel/    # BroadcastChannel for separate window
│
├── toolbar/                      # Toolbar Core
│   ├── index.ts                  # Toolbar class (Web Component)
│   ├── settings.ts               # Settings management
│   ├── helpers.ts                # Server/client helpers
│   ├── app-manager.ts            # App registration/lifecycle
│   └── global-api.ts             # __VISULIMA_DEVTOOLS__ API
│
├── timeline/                     # Timeline System
│   ├── index.ts                  # Timeline exports
│   ├── store.ts                  # Event storage
│   └── types.ts                  # Timeline types
│
├── ui/                           # Preact UI Layer
│   ├── components/               # Preact UI components
│   │   ├── Toolbar.tsx           # Main toolbar component
│   │   ├── AppButton.tsx         # App toggle button
│   │   ├── AppCanvas.tsx         # App content container
│   │   ├── IframeCanvas.tsx      # iframe app renderer
│   │   └── Window.tsx            # Floating window component
│   └── styles/                   # Styles
│       ├── toolbar.css           # Tailwind styles
│       └── theme.ts              # Color tokens
│
├── apps/                         # Built-in Apps
│   ├── index.ts                  # Built-in apps export
│   ├── settings/                 # Settings app
│   ├── more/                     # "More apps" dropdown
│   └── timeline/                 # Timeline viewer app
│
└── client/                       # Client Entrypoint
    └── entrypoint.ts             # Client-side initialization
```

## Key Features Explained

### 1. Type-Safe RPC Layer

The RPC layer provides bidirectional, type-safe communication between the client and server. All server functions are automatically typed and available on the client via the global API.

### 2. Hook System

The global hook system (`__DEV_TOOLBAR_HOOK__`) allows libraries to integrate with the dev-toolbar without direct dependencies. Libraries can register apps, listen to events, and add timeline events.

### 3. Global DevTools API

The `__VISULIMA_DEVTOOLS__` global API provides programmatic control over the toolbar, allowing applications to show/hide the toolbar, open apps, manage settings, and more.

### 4. Timeline System

The timeline system allows tracking and visualizing events over time. Events can be grouped, filtered, and displayed in the built-in Timeline app.

### 5. iframe App Rendering

Apps can be rendered in isolated iframes for complete CSS and JavaScript isolation, preventing conflicts with the host application.

## Comparison with Other DevTools

| Aspect        | Astro      | Vue DevTools | Nuxt DevTools | Visulima    |
| ------------- | ---------- | ------------ | ------------- | ----------- |
| UI Framework  | Vanilla WC | Vue          | Vue           | Preact      |
| Styling       | Inline CSS | CSS          | UnoCSS        | Tailwind    |
| Communication | HMR only   | Messaging    | RPC           | RPC + Hooks |
| Hook System   | No         | Yes          | Yes           | Yes         |
| Timeline      | No         | Yes          | Yes           | Yes         |
| iframe Apps   | No         | Yes          | Yes           | Yes         |
| Global API    | No         | Yes          | Yes           | Yes         |
| Framework     | Astro only | Vue only     | Nuxt only     | Any Vite    |

## Related

- [Vite](https://vitejs.dev/) - Next generation frontend tooling
- [Preact](https://preactjs.com/) - Fast 3kB alternative to React
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework

## Supported Node.js Versions

Libraries in this ecosystem make the best effort to track [Node.js' release schedule](https://github.com/nodejs/release#release-schedule).
Here's [a post on why we think this is important](https://medium.com/the-node-js-collection/maintainers-should-consider-following-node-js-release-schedule-ab08ed4de71a).

## Contributing

If you would like to help take a look at the [list of issues](https://github.com/visulima/visulima/issues) and check our [Contributing](.github/CONTRIBUTING.md) guidelines.

> **Note:** please note that this project is released with a Contributor Code of Conduct. By participating in this project you agree to abide by its terms.

## Credits

- [Daniel Bannert](https://github.com/prisis)
- [All Contributors](https://github.com/visulima/visulima/graphs/contributors)

## Made with ❤️ at Anolilab

This is an open source project and will always remain free to use. If you think it's cool, please star it 🌟. [Anolilab](https://www.anolilab.com/open-source) is a Development and AI Studio. Contact us at [hello@anolilab.com](mailto:hello@anolilab.com) if you need any help with these technologies or just want to say hi!

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
