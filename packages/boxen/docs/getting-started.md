# Getting Started with Boxen

Welcome to Boxen, your terminal's new best friend for creating beautiful boxes around text! Whether you're building a CLI tool, adding visual emphasis to your terminal output, or just want to make your console logs more stylish, Boxen has got you covered.

## What is Boxen?

Boxen is a powerful yet simple utility that creates customizable boxes in the terminal. Built on top of industry-standard libraries like `cli-boxes`, `string-width`, `terminal-size`, and `wrap-ansi`, it provides a robust foundation for all your terminal boxing needs.

## Why Use Boxen?

- **Easy to Use**: Get started with just one line of code
- **Highly Customizable**: Control borders, colors, padding, margins, and more
- **Terminal-Aware**: Automatically handles terminal width and ANSI escape codes
- **Feature-Rich**: Headers, footers, alignment options, and custom styling
- **TypeScript Support**: Full type definitions included
- **Zero Dependencies Drama**: Uses well-maintained, battle-tested dependencies

## Quick Start

Here's the simplest possible example to get you started:

```typescript
import { boxen } from "@visulima/boxen";

console.log(boxen("Hello, World!"));
```

This produces:

```
┌─────────────┐
│Hello, World!│
└─────────────┘
```

That's it! You've just created your first box.

## Next Steps

Ready to dive deeper? Check out these guides:

- **[Installation](./installation.md)** - Detailed installation instructions for different package managers
- **[Basic Usage](./basic-usage.md)** - Learn the fundamentals of creating boxes
- **[Styling Options](./styling-options.md)** - Explore all the ways to style your boxes
- **[Advanced Usage](./advanced-usage.md)** - Master complex layouts and customizations
- **[API Reference](./api-reference.md)** - Complete API documentation
- **[Examples](./examples.md)** - Real-world examples and use cases

## Browser Support

Boxen is designed for Node.js environments and requires:

- Node.js 20.18 or higher
- Works on macOS, Linux, and Windows

## Need Help?

- Check the [FAQ](./faq.md) for common questions
- Browse the [examples folder](../examples) in the repository
- Report issues on [GitHub](https://github.com/visulima/visulima/issues)

Let's make those terminal outputs beautiful!
