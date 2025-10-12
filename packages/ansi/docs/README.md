# @visulima/ansi Documentation

Welcome to the comprehensive documentation for `@visulima/ansi`, a powerful library for controlling terminal output using ANSI escape codes.

## Table of Contents

- [Installation](./installation.md)
- [Getting Started](./getting-started.md)
- [Examples](./examples.md)
- [API Reference](./api-reference.md)
- [Advanced Usage](./advanced.md)

## What is @visulima/ansi?

`@visulima/ansi` is a comprehensive library that provides ANSI escape codes for terminal manipulation. It enables you to control cursor positioning, screen clearing, text formatting, hyperlinks, images, and much more in your terminal applications.

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

## Quick Example

```typescript
import { cursorUp, cursorLeft, eraseLine } from "@visulima/ansi";

// Move cursor up 2 lines and to the left
process.stdout.write(cursorUp(2) + cursorLeft);

// Erase the current line
process.stdout.write(eraseLine);
```

## Browser Support

This library is designed for Node.js terminal applications. For browser-based applications, ANSI escape codes are not applicable as they are terminal-specific.

## Terminal Compatibility

Most modern terminal emulators support the ANSI escape codes provided by this library. Some advanced features (like iTerm2 image display or specific xterm extensions) may only work in their respective terminal emulators.

## Need Help?

- Check the [Examples](./examples.md) for common use cases
- Refer to the [API Reference](./api-reference.md) for detailed function documentation
- See [Advanced Usage](./advanced.md) for complex scenarios

## Related Libraries

- [@visulima/colorize](https://github.com/visulima/visulima/tree/main/packages/colorize) - Terminal color styling
- [@visulima/pail](https://github.com/visulima/visulima/tree/main/packages/pail) - Beautiful logging for Node.js
- [@visulima/boxen](https://github.com/visulima/visulima/tree/main/packages/boxen) - Create boxes in the terminal

## License

MIT License - See LICENSE.md for details
