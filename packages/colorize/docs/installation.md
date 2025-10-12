# Installation

This guide covers how to install and set up `@visulima/colorize` in your project.

## Prerequisites

- **Node.js** 18.x or higher
- **Package Manager**: npm, yarn, or pnpm

## Installation Methods

### Using npm

```bash
npm install @visulima/colorize
```

### Using yarn

```bash
yarn add @visulima/colorize
```

### Using pnpm

```bash
pnpm add @visulima/colorize
```

## Verification

After installation, verify that Colorize is installed correctly:

```typescript
import { red } from '@visulima/colorize';

console.log(red('Installation successful!'));
```

If you see a red message in your terminal, the installation was successful.

## Import Methods

Colorize supports both ESM and CommonJS imports.

### ESM (Recommended)

#### Default Import

```typescript
import colorize from '@visulima/colorize';

colorize.red('Error message');
```

#### Named Import

```typescript
import { red, green, blue, bold } from '@visulima/colorize';

console.log(red('Error'));
console.log(green('Success'));
```

#### Combined Import

```typescript
import colorize, { red, strip } from '@visulima/colorize';

const styledText = red('Error');
const plainText = strip(styledText);
```

### CommonJS

#### Default Import

```javascript
const colorize = require('@visulima/colorize');

colorize.red('Error message');
```

#### Named Import

```javascript
const { red, green, blue } = require('@visulima/colorize');

console.log(red('Error'));
console.log(green('Success'));
```

## Module Exports

Colorize provides several entry points for different use cases:

### Main Package

```typescript
// Node.js (server-side)
import colorize from '@visulima/colorize';
```

### Browser

```typescript
// Browser-specific version
import colorize from '@visulima/colorize/browser';
import { red, green } from '@visulima/colorize/browser';
```

### Template

```typescript
// Tagged template literals
import template from '@visulima/colorize/template';
```

### Gradient

```typescript
// Gradient functionality
import { gradient, multilineGradient } from '@visulima/colorize/gradient';
```

### Utils

```typescript
// Utility functions
import { convertHexToRgb } from '@visulima/colorize/utils';
```

## TypeScript Configuration

Colorize includes TypeScript definitions out of the box. No additional `@types` packages are needed.

### tsconfig.json

Ensure your `tsconfig.json` is configured for module resolution:

```json
{
  "compilerOptions": {
    "moduleResolution": "node",
    "esModuleInterop": true,
    "skipLibCheck": false
  }
}
```

## Deno Support

Colorize can be used with Deno via npm specifiers:

```typescript
import { red, green } from "npm:@visulima/colorize";

console.log(red("Error in Deno!"));
```

## Next.js Configuration

Colorize works seamlessly with Next.js applications:

### App Router (Next.js 13+)

```typescript
// app/page.tsx
import { red } from '@visulima/colorize';

export default function Page() {
  console.log(red('Server-side logging'));
  return <div>Hello World</div>;
}
```

### API Routes

```typescript
// pages/api/hello.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { green } from '@visulima/colorize';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log(green('API request received'));
  res.status(200).json({ message: 'Hello' });
}
```

## Browser Setup

For browser usage, import from the browser-specific entry point:

```typescript
import { red, green, blue } from '@visulima/colorize/browser';

// Note: Browser version returns an array for console.log
console.log(...red('Error in browser!'));
```

See the [Browser Usage Guide](./browser.md) for detailed browser documentation.

## Bundler Configuration

### Webpack

Colorize works out of the box with Webpack. No special configuration needed.

### Vite

Colorize is compatible with Vite. No additional configuration required.

### Rollup

For Rollup, ensure you have the appropriate plugins for CommonJS and Node.js modules:

```javascript
// rollup.config.js
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default {
  plugins: [
    nodeResolve(),
    commonjs()
  ]
};
```

### esbuild

Works with esbuild without additional configuration:

```bash
esbuild app.js --bundle --platform=node
```

## Environment Variables

Colorize respects common color environment variables:

- `NO_COLOR` - Disables all colors
- `FORCE_COLOR` - Forces color output
- `TERM` - Terminal capabilities detection

See [Environment Variables & CLI](./cli-environment.md) for more details.

## Troubleshooting

### Colors Not Showing

If colors aren't appearing in your terminal:

1. Check if your terminal supports colors
2. Verify environment variables (`NO_COLOR`, `FORCE_COLOR`)
3. Ensure you're not redirecting output to a file

### TypeScript Errors

If you encounter TypeScript errors:

1. Ensure TypeScript version is 4.5 or higher
2. Check your `moduleResolution` setting
3. Try clearing your TypeScript cache: `rm -rf node_modules/.cache`

### Import Errors

If you get import errors:

1. Verify the package is installed: `npm ls @visulima/colorize`
2. Clear your package manager cache
3. Try reinstalling: `rm -rf node_modules && npm install`

## What's Next?

- Read the [Getting Started Guide](./getting-started.md) for basic usage
- Explore [Examples](./examples.md) for common use cases
- Check the [API Reference](./api-reference.md) for complete documentation

## Additional Resources

- [Package on npm](https://www.npmjs.com/package/@visulima/colorize)
- [GitHub Repository](https://github.com/visulima/visulima/tree/main/packages/colorize)
- [Report Issues](https://github.com/visulima/visulima/issues)
