# Installation Guide

This guide covers how to install and set up `@visulima/error` in your project.

## Package Manager Installation

Choose your preferred package manager:

### npm

```bash
npm install @visulima/error
```

### pnpm (Recommended)

```bash
pnpm add @visulima/error
```

### yarn

```bash
yarn add @visulima/error
```

## Optional Dependencies

### AI Integration

If you want to use AI-powered error solution generation, install the optional `ai` peer dependency:

```bash
# pnpm
pnpm add ai

# npm
npm install ai

# yarn
yarn add ai
```

The AI integration requires an API key from a supported provider (OpenAI, Anthropic, etc.).

## Verifying Installation

After installation, verify that the package is installed correctly:

```typescript
import { VisulimaError } from "@visulima/error";

console.log(VisulimaError.name); // Should output: "VisulimaError"
```

Or with CommonJS:

```javascript
const { VisulimaError } = require("@visulima/error");

console.log(VisulimaError.name); // Should output: "VisulimaError"
```

## Module System Support

`@visulima/error` supports both ESM (ES Modules) and CommonJS:

### ESM (ES Modules)

```typescript
import { VisulimaError, renderError, parseStacktrace } from "@visulima/error";
```

### CommonJS

```javascript
const { VisulimaError, renderError, parseStacktrace } = require("@visulima/error");
```

## Subpath Imports

The package provides several subpath exports for importing specific functionality:

```typescript
// Main export (includes all features)
import { VisulimaError, renderError } from "@visulima/error";

// Code frame utilities
import { codeFrame } from "@visulima/error/code-frame";

// Error utilities
import { serializeError, deserializeError } from "@visulima/error/error";

// Stack trace utilities
import { parseStacktrace, formatStackFrameLine } from "@visulima/error/stacktrace";

// Solution finders
import { ruleBasedFinder, errorHintFinder } from "@visulima/error/solution";

// AI integration
import { aiPrompt, aiSolutionResponse } from "@visulima/error/solution/ai";
```

## TypeScript Configuration

For TypeScript projects, ensure your `tsconfig.json` has the following settings:

```json
{
  "compilerOptions": {
    "moduleResolution": "bundler", // or "node16", "nodenext"
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

## System Requirements

### Node.js Versions

- Minimum: Node.js 18.0.0
- Maximum: Node.js 24.x
- Recommended: Node.js 20.x LTS or later

### Supported Operating Systems

- macOS (darwin)
- Linux
- Windows (win32)

### Browser Support

For stack trace parsing in browsers:

- Firefox (latest)
- Chrome (latest)
- Safari/WebKit (latest)
- Edge (latest)
- Opera Chromium-based (latest)

Note: Browsers older than 6 years are not supported.

## Development Setup

If you're contributing to the package or running it from source:

```bash
# Clone the repository
git clone https://github.com/visulima/visulima.git

# Navigate to the error package
cd visulima/packages/error

# Install dependencies
pnpm install

# Build the package
pnpm run build

# Run tests
pnpm test
```

## Troubleshooting

### Module Not Found

If you encounter "Cannot find module" errors:

1. Clear your package manager cache:
```bash
# npm
npm cache clean --force

# pnpm
pnpm store prune

# yarn
yarn cache clean
```

2. Delete `node_modules` and reinstall:
```bash
rm -rf node_modules
pnpm install
```

### TypeScript Type Errors

If TypeScript can't find type definitions:

1. Ensure you're using TypeScript >= 5.0
2. Add `skipLibCheck: true` to your `tsconfig.json`
3. Try deleting `node_modules/@types` and reinstalling

### AI Integration Issues

If AI features aren't working:

1. Verify the `ai` package is installed
2. Check your API key configuration
3. Ensure you're importing from the correct subpath: `@visulima/error/solution/ai`

## Next Steps

- [Quick Start Guide](./quick-start.md) - Learn the basics
- [API Reference](./api-reference.md) - Explore all available features
- [Examples](./examples.md) - See practical examples
