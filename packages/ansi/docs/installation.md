---
title: Installation
description: How to install and set up @visulima/ansi in your project
---

import { Tab, Tabs } from 'fumadocs-ui/components/tabs';
import { Callout } from 'fumadocs-ui/components/callout';
import { Steps, Step } from 'fumadocs-ui/components/steps';

## Requirements

<Callout>
**Requirements:**
- Node.js: Version 20.18 or higher (up to 24.x)
- Package Manager: npm, yarn, or pnpm
</Callout>

## Installation

<Tabs items={['npm', 'yarn', 'pnpm']}>
  <Tab value="npm">
```bash
npm install @visulima/ansi
```
  </Tab>
  <Tab value="yarn">
```bash
yarn add @visulima/ansi
```
  </Tab>
  <Tab value="pnpm">
```bash
pnpm add @visulima/ansi
```
  </Tab>
</Tabs>

## Importing

`@visulima/ansi` supports both ESM and CommonJS.

### ES Modules

<Tabs items={['Main Package', 'Specific Modules']}>
  <Tab value="Main Package">
```typescript title="index.ts"
import { cursorUp, cursorLeft, eraseLine } from "@visulima/ansi";
```
  </Tab>
  <Tab value="Specific Modules">
```typescript title="index.ts"
import { cursorUp, cursorTo } from "@visulima/ansi/cursor";
import { eraseLine, eraseScreen } from "@visulima/ansi/erase";
import { hyperlink } from "@visulima/ansi/hyperlink";
```
  </Tab>
</Tabs>

### CommonJS

```javascript title="index.js"
const { cursorUp, cursorLeft, eraseLine } = require("@visulima/ansi");

// Or with specific modules
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

<Callout>
Full TypeScript type definitions are included. No additional `@types` packages needed.
</Callout>

```typescript title="example.ts"
import { CursorStyle, setCursorStyle } from "@visulima/ansi/cursor";

// Full autocomplete and type checking
process.stdout.write(setCursorStyle(CursorStyle.BlinkingUnderline));
```

## Verify Installation

<Steps>

### Create test file

```javascript title="test.js"
import { cursorUp, eraseLine } from "@visulima/ansi";

console.log("Testing @visulima/ansi...");
process.stdout.write(cursorUp(1));
process.stdout.write(eraseLine);
console.log("Installation successful!");
```

### Run the test

```bash
node test.js
```

### Expected output

You should see "Installation successful!" appear on the line where "Testing @visulima/ansi..." was printed.

</Steps>

## Next Steps

- Read the [Getting Started Guide](./getting-started.md) to learn basic usage
- Explore [Examples](./examples.md) for common use cases
- Check the [API Reference](./api-reference.md) for detailed documentation
