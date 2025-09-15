<div align="center">
  <h3>visulima vite-overlay</h3>
  <p>
  Improved vite overlay
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

Add the plugin to your Vite config:

```typescript
import { defineConfig } from "vite";
import { errorOverlay } from "@visulima/vite-overlay";

export default defineConfig({
    plugins: [errorOverlay()],
});
```

## Testing

This package includes comprehensive e2e tests to ensure error overlay functionality works correctly:

### Running Tests

```bash
# Install Playwright browsers (one-time setup)
node playwright-setup.js

# Run all e2e tests
pnpm test:e2e

# Run with interactive UI
pnpm test:e2e:ui

# Run in headed mode (visible browser)
pnpm test:e2e:headed
```

### Test Coverage

- ✅ **Basic Error Display** - Runtime errors trigger overlay with proper source mapping
- ✅ **Cause Chain Navigation** - Multi-error chains are navigable with original source locations
- ✅ **Source Map Resolution** - Original `.tsx`/`.ts` files shown instead of compiled paths
- ✅ **Cross-browser Compatibility** - Works in Chromium, Firefox, and WebKit
- ✅ **UI Interactions** - Close button, ESC key, and mode switching work correctly

### Test Fixtures

Visit `http://localhost:5173/error-test` during development to manually test different error scenarios:

- **Simple Error** - Basic runtime error testing
- **Cause Chain Error** - Multi-level error chains
- **Async Error** - Async context error handling
- **Complex Nested Error** - Deep error nesting

## Related

## Supported Node.js Versions

Libraries in this ecosystem make the best effort to track [Node.js’ release schedule](https://github.com/nodejs/release#release-schedule).
Here’s [a post on why we think this is important](https://medium.com/the-node-js-collection/maintainers-should-consider-following-node-js-release-schedule-ab08ed4de71a).

## Contributing

If you would like to help take a look at the [list of issues](https://github.com/visulima/visulima/issues) and check our [Contributing](.github/CONTRIBUTING.md) guidelines.

> **Note:** please note that this project is released with a Contributor Code of Conduct. By participating in this project you agree to abide by its terms.

## Credits

- [Daniel Bannert](https://github.com/prisis)
- [All Contributors](https://github.com/visulima/visulima/graphs/contributors)

## License

The visulima vite-overlay is open-sourced software licensed under the [MIT][license-url]

[typescript-image]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]: https://www.typescriptlang.org/ "TypeScript"
[license-image]: https://img.shields.io/npm/l/@visulima/vite-overlay?color=blueviolet&style=for-the-badge
[license-url]: LICENSE.md "license"
[npm-image]: https://img.shields.io/npm/v/@visulima/vite-overlay/latest.svg?style=for-the-badge&logo=npm
[npm-url]: https://www.npmjs.com/package/@visulima/vite-overlay/v/latest "npm"
