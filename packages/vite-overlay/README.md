<div align="center">
  <h3>Enhanced Error Overlay for Vite</h3>
  <p>
    A powerful development tool that provides rich error displays with source mapping, cause chain navigation, and intelligent solutions for Vite applications.
  </p>
</div>

<br />

<div align="center">

[![typescript-image]][typescript-url] [![npm-image]][npm-url] [![license-image]][license-url]

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
- **Beautiful UI** - Modern, accessible interface with light/dark theme support
- **Intelligent Solutions** - AI-powered error analysis and suggested fixes
- **Real-time Updates** - Hot Module Replacement (HMR) integration for instant error feedback
- **Comprehensive Testing** - Extensive e2e test coverage for reliability

## Installation

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
import { errorOverlay } from "@visulima/vite-overlay";

export default defineConfig({
    plugins: [errorOverlay()],
});
```

### Configuration Options

The plugin accepts an optional configuration object:

```typescript
import { defineConfig } from "vite";
import { errorOverlay } from "@visulima/vite-overlay";

export default defineConfig({
    plugins: [
        errorOverlay({
            // Whether to log/display client-side runtime errors (default: true)
            logClientRuntimeError: true,

            // Custom React plugin name for detection (optional)
            reactPluginName: "@vitejs/plugin-react",

            // Custom solution finder functions (optional)
            solutionFinders: [],
        }),
    ],
});
```

#### Options

| Option                  | Type               | Default     | Description                                                              |
| ----------------------- | ------------------ | ----------- | ------------------------------------------------------------------------ |
| `logClientRuntimeError` | `boolean`          | `true`      | Enable/disable client-side runtime error logging and overlay display     |
| `reactPluginName`       | `string`           | `undefined` | Custom React plugin name for detection (useful for custom React plugins) |
| `solutionFinders`       | `SolutionFinder[]` | `[]`        | Array of custom solution finder functions for enhanced error analysis    |

## Error Handling

The plugin automatically handles various types of errors:

### Client-Side Errors

- Runtime JavaScript errors
- Unhandled promise rejections
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

### Keyboard Shortcuts

- `ESC` - Close error overlay (client-side errors only)
- `←` / `→` - Navigate between multiple errors
- `Tab` - Switch between original/compiled code views

## Advanced Configuration

### Custom Solution Finders

You can extend the plugin with custom solution finders:

```typescript
import { defineConfig } from "vite";
import { errorOverlay } from "@visulima/vite-overlay";
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

This project is licensed under the MIT License - see the [MIT][license-url] file for details.

[typescript-image]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]: https://www.typescriptlang.org/ "TypeScript"
[license-image]: https://img.shields.io/npm/l/@visulima/vite-overlay?color=blueviolet&style=for-the-badge
[license-url]: LICENSE.md "license"
[npm-image]: https://img.shields.io/npm/v/@visulima/vite-overlay/latest.svg?style=for-the-badge&logo=npm
[npm-url]: https://www.npmjs.com/package/@visulima/vite-overlay/v/latest "npm"
