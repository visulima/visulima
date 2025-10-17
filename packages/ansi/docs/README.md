---
title: Introduction
description: Comprehensive ANSI escape codes library for terminal control
---

import { Card, Cards } from 'fumadocs-ui/components/card';
import { Callout } from 'fumadocs-ui/components/callout';

## Overview

`@visulima/ansi` is a comprehensive library that provides ANSI escape codes for terminal manipulation. It enables you to control cursor positioning, screen clearing, text formatting, hyperlinks, images, and much more in your terminal applications.

<Cards>
  <Card title="Installation" href="/installation" />
  <Card title="Getting Started" href="/getting-started" />
  <Card title="Examples" href="/examples" />
  <Card title="API Reference" href="/api-reference" />
</Cards>

## Key Features

- **Comprehensive Cursor Control**: Precise cursor positioning, movement, visibility, and styling
- **Screen Manipulation**: Clear screen areas, manage alternative screen buffers, control scrolling
- **Text Erasure**: Erase characters, lines, or screen portions efficiently
- **iTerm2 Integration**: Display images and use iTerm2-specific features
- **Terminal Mode Management**: Control line feed, local echo, and mouse events
- **Mouse Event Handling**: Enable and disable various types of mouse tracking
- **Window Control**: Manipulate window titles, icons, and basic window operations
- **Hyperlinks**: Create clickable terminal hyperlinks
- **Utility Functions**: Strip ANSI codes, passthrough sequences for tmux

## Quick Start

```typescript title="example.ts"
import { cursorUp, cursorLeft, eraseLine } from "@visulima/ansi";

// Move cursor up 2 lines and to the left
process.stdout.write(cursorUp(2) + cursorLeft);

// Erase the current line
process.stdout.write(eraseLine);
```

## Platform Support

<Callout>
This library is designed for Node.js terminal applications. ANSI escape codes are not applicable in browser environments.
</Callout>

<Callout type="warn">
Some advanced features (like iTerm2 image display or specific xterm extensions) may only work in their respective terminal emulators.
</Callout>

## Related Packages

<Cards>
  <Card 
    title="@visulima/colorize" 
    href="https://github.com/visulima/visulima/tree/main/packages/colorize"
    description="Terminal color styling"
  />
  <Card 
    title="@visulima/pail" 
    href="https://github.com/visulima/visulima/tree/main/packages/pail"
    description="Beautiful logging for Node.js"
  />
  <Card 
    title="@visulima/boxen" 
    href="https://github.com/visulima/visulima/tree/main/packages/boxen"
    description="Create boxes in the terminal"
  />
</Cards>
