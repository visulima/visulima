# Installation

Installing Boxen is straightforward and works with all major package managers. Choose your preferred tool below.

## Package Managers

### npm

```bash
npm install @visulima/boxen
```

### Yarn

```bash
yarn add @visulima/boxen
```

### pnpm

```bash
pnpm add @visulima/boxen
```

### bun

```bash
bun add @visulima/boxen
```

## System Requirements

Before installing, make sure your environment meets these requirements:

- **Node.js**: Version 20.18 or higher (up to 24.x)
- **Operating System**: macOS, Linux, or Windows

## Verify Installation

After installation, verify that Boxen is working correctly:

```typescript
import { boxen } from "@visulima/boxen";

console.log(boxen("Installation successful!"));
```

If you see a nicely boxed message, you're all set!

## TypeScript Support

Boxen is written in TypeScript and includes type definitions out of the box. No need to install separate `@types` packages.

```typescript
import { boxen, type Options } from "@visulima/boxen";

const options: Options = {
    padding: 1,
    borderStyle: "double"
};

console.log(boxen("TypeScript ready!", options));
```

## Module Systems

Boxen supports both CommonJS and ES Modules:

### ES Modules (Recommended)

```typescript
import { boxen } from "@visulima/boxen";
```

### CommonJS

```javascript
const { boxen } = require("@visulima/boxen");
```

## Development vs Production

For development, you might want to install Boxen as a dev dependency if you're only using it for build scripts or development tools:

```bash
npm install --save-dev @visulima/boxen
```

For production CLI applications, install it as a regular dependency:

```bash
npm install @visulima/boxen
```

## Peer Dependencies

Boxen manages its own dependencies internally. You don't need to install any additional packages unless you want to use color functions, in which case we recommend:

```bash
npm install @visulima/colorize
```

This is optional but provides excellent color and styling utilities that work seamlessly with Boxen.

## Troubleshooting Installation

### Permission Errors

If you encounter permission errors on Unix-based systems:

```bash
sudo npm install -g @visulima/boxen
```

Or better yet, [fix your npm permissions](https://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally).

### Network Issues

If you're behind a proxy or experiencing network issues:

```bash
npm install @visulima/boxen --registry=https://registry.npmjs.org/
```

### Version Conflicts

To install a specific version:

```bash
npm install @visulima/boxen@2.0.3
```

To check your installed version:

```bash
npm list @visulima/boxen
```

## Next Steps

Now that you've installed Boxen, head over to the [Basic Usage](./basic-usage.md) guide to start creating beautiful boxes!
