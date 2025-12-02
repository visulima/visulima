<div align="center">
  <h3>Enhanced Error Overlay for Vite</h3>
  <p>
    A powerful development tool that provides rich error displays with source mapping, cause chain navigation, and intelligent solutions for Vite applications.
  </p>
</div>



<div align="center">

[![TypeScript](https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/) [![npm](https://img.shields.io/npm/v/@visulima/vite-overlay/latest.svg?style=for-the-badge&logo=npm)](https://www.npmjs.com/package/@visulima/vite-overlay/v/latest) [![license](https://img.shields.io/npm/l/@visulima/vite-overlay?color=blueviolet&style=for-the-badge)](https://github.com/visulima/visulima/blob/main/packages/vite-overlay/LICENSE.md)

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

| Light Mode                       | Dark Mode                      | Solution Mode                         |
| -------------------------------- | ------------------------------ | ------------------------------------- |
| ![light](./__assets__/light.png) | ![dark](./__assets__/dark.png) | ![light](./__assets__/light-hint.png) |

## Features

- **Enhanced Error Display** - Rich, interactive error overlays with syntax highlighting
- **Source Map Integration** - Shows original `.tsx`/`.ts` files instead of compiled paths
- **Cause Chain Navigation** - Navigate through multi-level error chains with original source locations
- **Console Method Forwarding** - Intercept and display console.error, console.warn, and other console methods
- **Beautiful UI** - Modern, accessible interface with light/dark theme support and floating balloon button
- **Intelligent Solutions** - AI-powered error analysis and suggested fixes
- **Real-time Updates** - Hot Module Replacement (HMR) integration for instant error feedback
- **Comprehensive Testing** - Extensive e2e test coverage for reliability

## Install

```sh
npm install @visulima/vite-overlay
```

```sh
yarn add @visulima/vite-overlay
```

```sh
pnpm add @visulima/vite-overlay
```

## Usage

Add the plugin to your Vite configuration:

```typescript
import { defineConfig } from "vite";
import errorOverlay from "@visulima/vite-overlay";

export default defineConfig({
    plugins: [errorOverlay()],
});
```

### Configuration Options

The plugin accepts an optional configuration object:

```typescript
import { defineConfig } from "vite";
import errorOverlay from "@visulima/vite-overlay";

export default defineConfig({
    plugins: [
        errorOverlay({
            // Whether to log/display client-side runtime errors (default: true)
            forwardConsole: true,

            // Array of console method names to forward (default: ["error"])
            forwardedConsoleMethods: ["error", "warn"],

            // Custom React plugin name for detection (optional)
            reactPluginName: "@vitejs/plugin-react",

            // Custom Vue plugin name for detection (optional)
            vuePluginName: "@vitejs/plugin-vue",

            // Whether to show the balloon button in the overlay (default: true)
            showBallonButton: true,

            // Overlay configuration (optional)
            overlay: {
                // Balloon button configuration
                balloon: {
                    enabled: true,
                    position: "bottom-right", // "top-left" | "top-right" | "bottom-left" | "bottom-right"
                    icon: "", // Optional custom icon URL
                    // Style can be a string or CSS.Properties object
                    style: {
                        background: "#ff4628",
                        color: "#ffffff",
                    },
                    // Or as a string:
                    // style: "background: #ff4628; color: #ffffff;",
                },
                // Custom CSS to inject for styling customization
                // Can be a string or CSS.Properties object
                customCSS: `
                    #__v_o__balloon {
                        border-radius: 20px;
                    }
                `,
            },

            // Custom solution finder functions (optional)
            solutionFinders: [],

            // @deprecated Use forwardConsole instead
            logClientRuntimeError: true,
        }),
    ],
});
```

#### Options

| Option                    | Type               | Default     | Description                                                              |
| ------------------------- | ------------------ | ----------- | ------------------------------------------------------------------------ |
| `forwardConsole`          | `boolean`          | `true`      | Enable/disable client-side runtime error logging and overlay display     |
| `forwardedConsoleMethods` | `string[]`         | `["error"]` | Array of console method names to intercept and forward to overlay        |
| `reactPluginName`         | `string`           | `undefined` | Custom React plugin name for detection (useful for custom React plugins) |
| `vuePluginName`           | `string`           | `undefined` | Custom Vue plugin name for detection (useful for custom Vue plugins)     |
| `showBallonButton`        | `boolean`          | `true`      | Whether to show the floating balloon button for error navigation         |
| `overlay`                 | `OverlayConfig`    | `undefined` | Overlay configuration options                                            |
| `overlay.balloon`         | `BalloonConfig`    | `undefined` | Balloon button configuration                                             |
| `overlay.balloon.style`  | `string \| CSS.Properties` | `undefined` | Balloon button styles (string or CSS.Properties object)                 |
| `overlay.customCSS`       | `string \| CSS.Properties` | `undefined` | Custom CSS to inject for styling customization (string or CSS.Properties object) |
| `solutionFinders`         | `SolutionFinder[]` | `[]`        | Array of custom solution finder functions for enhanced error analysis    |
| `logClientRuntimeError`   | `boolean`          | `undefined` | **@deprecated** Use `forwardConsole` instead                             |

## Error Handling

The plugin automatically handles various types of errors:

### Client-Side Errors

- Runtime JavaScript errors
- Unhandled promise rejections
- Console method interception (configurable via `forwardedConsoleMethods`)
- React component errors (when React plugin is detected)
- Async context errors

### Server-Side Errors (SSR)

- Build-time errors during SSR
- Import resolution failures
- Module loading errors
- Plugin-specific errors

### Special Cases

- **Vue SFC Compilation Errors** - Enhanced parsing for `.vue` files
- **Import Resolution Errors** - Smart suggestions for missing modules
- **TypeScript Errors** - Source map integration for `.tsx`/`.ts` files
- **Framework-Specific Issues** - Detection and handling for React, Vue, Svelte, and Astro

## User Interface

### Floating Balloon Button

When errors occur, a floating balloon button appears in the bottom-right corner of the screen. Click it to:

- View the most recent error details
- Navigate through multiple errors
- Access error overlay controls

The balloon button can be disabled by setting `showBallonButton: false` in the plugin options.

### Keyboard Shortcuts

- `ESC` - Close error overlay (client-side errors only)
- `←` / `→` - Navigate between multiple errors
- `Tab` - Switch between original/compiled code views

## Advanced Configuration

### Custom Solution Finders

You can extend the plugin with custom solution finders:

```typescript
import { defineConfig } from "vite";
import errorOverlay from "@visulima/vite-overlay";
import type { SolutionFinder } from "@visulima/error/solution";

const customSolutionFinder: SolutionFinder = {
    name: "custom-finder",
    priority: 10,
    async handle(error, context) {
        // Your custom error analysis logic
        if (error.message.includes("custom error pattern")) {
            return {
                header: "Custom Error Detected",
                body: "This is a custom error solution...",
            };
        }
        return undefined;
    },
};

export default defineConfig({
    plugins: [
        errorOverlay({
            solutionFinders: [customSolutionFinder],
        }),
    ],
});
```

### React Plugin Detection

The plugin automatically detects React plugins, but you can specify a custom plugin name:

```typescript
export default defineConfig({
    plugins: [
        errorOverlay({
            reactPluginName: "my-custom-react-plugin",
        }),
    ],
});
```

### Vue Plugin Detection

Similar to React detection, you can specify a custom Vue plugin name:

```typescript
export default defineConfig({
    plugins: [
        errorOverlay({
            vuePluginName: "my-custom-vue-plugin",
        }),
    ],
});
```

### Console Method Forwarding

By default, only `console.error` calls are intercepted and displayed in the overlay. You can customize which console methods to forward:

```typescript
export default defineConfig({
    plugins: [
        errorOverlay({
            forwardedConsoleMethods: ["error", "warn", "log"],
        }),
    ],
});
```

## Theming

The error overlay uses a custom design system with CSS custom properties:

```css
/* Light theme (default) */
--ono-v-bg: #f5f5f5;
--ono-v-surface: #ffffff;
--ono-v-text: #111827;
--ono-v-red-orange: #ff4628;

/* Dark theme */
--ono-v-bg: #161b22;
--ono-v-surface: #0d1117;
--ono-v-text: #c9d1d9;
```

### Custom CSS Injection

You can inject custom CSS to override the default styles of the overlay and button elements. The `overlay.customCSS` option accepts a CSS string (recommended) or a `CSS.Properties` object:

```typescript
export default defineConfig({
    plugins: [
        errorOverlay({
            overlay: {
                customCSS: `
                    /* Customize the balloon button */
                    #__v_o__balloon {
                        border-radius: 20px;
                        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                    }

                    /* Customize the overlay panel */
                    #__v_o__panel {
                        border-radius: 12px;
                    }

                    /* Customize the backdrop */
                    #__v_o__backdrop {
                        background-color: rgba(0, 0, 0, 0.7);
                    }
                `,
            },
        }),
    ],
});
```

**Note:** For `customCSS`, using a CSS string is recommended since you need CSS selectors. `CSS.Properties` objects are mainly useful for inline styles (like `balloon.style`).

### Balloon Button Styling

The `balloon.style` option supports both string and `CSS.Properties` object. Using `CSS.Properties` provides type safety and autocomplete:

```typescript
import type * as CSS from "csstype";

export default defineConfig({
    plugins: [
        errorOverlay({
            overlay: {
                balloon: {
                    // Using CSS.Properties object (type-safe with autocomplete)
                    style: {
                        background: "#ff4628",
                        color: "#ffffff",
                        borderRadius: "20px",
                    } as CSS.Properties,
                    // Or using a string:
                    // style: "background: #ff4628; color: #ffffff; border-radius: 20px;",
                },
            },
        }),
    ],
});
```

**Note:** When using `CSS.Properties`, property names should be in camelCase (e.g., `borderRadius`), and they will be automatically converted to kebab-case CSS properties (e.g., `border-radius`) when applied.

#### Available Element IDs for Customization

The following element IDs can be targeted in your custom CSS:

**Main Overlay Elements:**

- `__v_o__root` - Root container element
- `__v_o__backdrop` - Backdrop element behind the overlay
- `__v_o__notch` - Notch container at the top of the overlay
- `__v_o__panel` - Main panel container
- `__v_o__overlay` - Overlay content container

**Navigation & Pagination:**

- `__v_o__error-overlay-pagination-previous` - Previous error button
- `__v_o__error-overlay-pagination-next` - Next error button
- `__v_o__error-overlay_pagination_count` - Pagination count container
- `__v_o__pagination_current` - Current page number display
- `__v_o__pagination_total` - Total page number display

**History:**

- `__v_o__history_toggle` - History toggle button
- `__v_o__history_indicator` - History indicator container
- `__v_o__history_count` - History count display
- `__v_o__history_total` - History total display
- `__v_o__history_timestamp` - History timestamp display
- `__v_o__history_layer_depth` - History layer depth container
- `__v_o__history_layer_depth_1` - History layer depth level 1
- `__v_o__history_layer_depth_2` - History layer depth level 2

**Header Elements:**

- `__v_o__header` - Header container
- `__v_o__header_loader` - Header loader skeleton
- `__v_o__title` - Title container
- `__v_o__heading` - Error heading/name
- `__v_o__filelink` - File link button
- `__v_o__mode` - Mode switch container (original/compiled)
- `__v_o__copy_error` - Copy error button
- `__v_o__close` - Close button

**Balloon Button:**

- `__v_o__balloon` - Floating balloon button
- `__v_o__balloon_count` - Error count badge in balloon
- `__v_o__balloon_text` - Text label in balloon

**Message & Content:**

- `__v_o__message_loader` - Message loader skeleton
- `__v_o__message` - Error message container
- `__v_o__body` - Body container
- `__v_o__body_loader` - Body loader skeleton
- `__v_o__solutions` - Solutions container
- `__v_o__solutions_container` - Solutions content container
- `__v_o__stacktrace` - Stack trace details element

**Other:**

- `__v_o__editor` - Editor selector container
- `editor-selector` - Editor selector dropdown
- `v-o-theme-switch` - Theme switch container

## Browser Support

The error overlay is designed to work in all modern browsers with at least 1% global market share. This includes:

| Browser              | Minimum Version | Release Date  |
| -------------------- | --------------- | ------------- |
| **Chrome**           | 91+             | January 2021  |
| **Firefox**          | 91+             | August 2021   |
| **Safari**           | 14.1+           | April 2021    |
| **Edge**             | 91+             | January 2021  |
| **iOS Safari**       | 14.5+           | April 2021    |
| **Opera**            | 77+             | February 2021 |
| **Samsung Internet** | 16+             | October 2021  |

### Browser Features Used

The overlay uses modern JavaScript features that are well-supported in the target browsers:

- **ES2015+ Features**: Classes, arrow functions, template literals, destructuring
- **Shadow DOM API**: For component isolation and styling encapsulation
- **localStorage**: For persisting user preferences and state
- **Modern DOM APIs**: Query selectors, event listeners, CSS custom properties

## Supported Node.js Versions

Libraries in this ecosystem make the best effort to track [Node.js’ release schedule](https://github.com/nodejs/release#release-schedule).
Here’s [a post on why we think this is important](https://medium.com/the-node-js-collection/maintainers-should-consider-following-node-js-release-schedule-ab08ed4de71a).

## Contributing

If you would like to help take a look at the [list of issues](https://github.com/visulima/visulima/issues) and check our [Contributing](.github/CONTRIBUTING.md) guidelines.

> **Note:** please note that this project is released with a Contributor Code of Conduct. By participating in this project you agree to abide by its terms.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/visulima/visulima.git
cd visulima

# Install dependencies
pnpm install
```

## Credits

- [Daniel Bannert](https://github.com/prisis)
- [All Contributors](https://github.com/visulima/visulima/graphs/contributors)

## License

This project is licensed under the MIT License - see the [MIT](https://github.com/visulima/visulima/blob/main/packages/vite-overlay/LICENSE.md) file for details.

