# Installation

## Requirements

- **Node.js**: Version 20.18 or higher (up to 24.x)
- **Package Manager**: npm, yarn, or pnpm

## Installation Methods

### Using npm

```bash
npm install @visulima/ansi
```

### Using yarn

```bash
yarn add @visulima/ansi
```

### Using pnpm

```bash
pnpm add @visulima/ansi
```

## Importing the Package

`@visulima/ansi` is distributed as both ESM (ECMAScript Module) and CommonJS, supporting various import styles.

### ES Modules (Recommended)

Import everything from the main package:

```typescript
import { cursorUp, cursorLeft, eraseLine } from "@visulima/ansi";
```

Import from specific modules:

```typescript
import { cursorUp, cursorTo } from "@visulima/ansi/cursor";
import { eraseLine, eraseScreen } from "@visulima/ansi/erase";
import { hyperlink } from "@visulima/ansi/hyperlink";
```

### CommonJS

```javascript
const { cursorUp, cursorLeft, eraseLine } = require("@visulima/ansi");
```

Or with specific modules:

```javascript
const { cursorUp, cursorTo } = require("@visulima/ansi/cursor");
const { eraseLine } = require("@visulima/ansi/erase");
```

## Available Sub-modules

The package provides the following sub-modules for more granular imports:

- `@visulima/ansi/cursor` - Cursor control functions
- `@visulima/ansi/erase` - Text and screen erasure
- `@visulima/ansi/clear` - Screen clearing utilities
- `@visulima/ansi/scroll` - Screen scrolling
- `@visulima/ansi/hyperlink` - Terminal hyperlinks
- `@visulima/ansi/image` - Image display (iTerm2)
- `@visulima/ansi/strip` - Remove ANSI codes from strings
- `@visulima/ansi/title` - Window title manipulation
- `@visulima/ansi/mouse` - Mouse event handling
- `@visulima/ansi/mode` - Terminal mode management
- `@visulima/ansi/screen` - Screen manipulation
- `@visulima/ansi/status` - Terminal status reporting
- `@visulima/ansi/window-ops` - Window operations
- `@visulima/ansi/xterm` - XTerm-specific features
- `@visulima/ansi/iterm2` - iTerm2-specific features
- `@visulima/ansi/termcap` - Termcap/Terminfo requests
- `@visulima/ansi/passthrough` - Passthrough sequences (tmux/screen)
- `@visulima/ansi/reset` - Terminal reset
- `@visulima/ansi/alternative-screen` - Alternative screen buffer

## TypeScript Support

The package includes full TypeScript type definitions. No additional `@types` packages are needed.

```typescript
import { CursorStyle, setCursorStyle } from "@visulima/ansi/cursor";

// TypeScript will provide full autocomplete and type checking
process.stdout.write(setCursorStyle(CursorStyle.BlinkingUnderline));
```

## Verifying Installation

Create a simple test file to verify the installation:

```javascript
// test.js
import { cursorUp, eraseLine } from "@visulima/ansi";

console.log("Testing @visulima/ansi...");
process.stdout.write(cursorUp(1));
process.stdout.write(eraseLine);
console.log("Installation successful!");
```

Run it:

```bash
node test.js
```

If the installation is successful, you should see "Installation successful!" appear on the line where "Testing @visulima/ansi..." was printed.

## Next Steps

- Read the [Getting Started Guide](./getting-started.md) to learn basic usage
- Explore [Examples](./examples.md) for common use cases
- Check the [API Reference](./api-reference.md) for detailed documentation
