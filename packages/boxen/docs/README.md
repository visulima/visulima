# Boxen Documentation

Complete documentation for `@visulima/boxen` - Create beautiful boxes in the terminal.

## Documentation Index

### Getting Started

- **[Getting Started](./getting-started.md)** - Introduction to Boxen and quick start guide
- **[Installation](./installation.md)** - Detailed installation instructions for all package managers

### Core Guides

- **[Basic Usage](./basic-usage.md)** - Fundamental concepts and common use cases
- **[Styling Options](./styling-options.md)** - Colors, borders, and visual customization
- **[Advanced Usage](./advanced-usage.md)** - Complex layouts, dynamic content, and advanced features

### Reference

- **[API Reference](./api-reference.md)** - Complete API documentation with all options and types
- **[Examples](./examples.md)** - Real-world examples and practical applications
- **[FAQ](./faq.md)** - Common questions, troubleshooting, and solutions

## Quick Links

### For New Users

Start here if you're new to Boxen:

1. Read [Getting Started](./getting-started.md)
2. Follow the [Installation](./installation.md) guide
3. Try the examples in [Basic Usage](./basic-usage.md)

### For Experienced Users

Jump straight to what you need:

- [API Reference](./api-reference.md) - Full API documentation
- [Advanced Usage](./advanced-usage.md) - Complex features
- [Examples](./examples.md) - Copy-paste ready examples

### Common Tasks

Quick links to common operations:

- **Add colors**: See [Styling Options → Adding Colors](./styling-options.md#adding-colors)
- **Create custom borders**: See [Styling Options → Custom Border Characters](./styling-options.md#custom-border-characters)
- **Center a box**: See [Basic Usage → Floating Boxes](./basic-usage.md#floating-boxes)
- **Make fullscreen box**: See [Advanced Usage → Fullscreen Boxes](./advanced-usage.md#fullscreen-boxes)
- **Handle long text**: See [Advanced Usage → Working with Long Text](./advanced-usage.md#working-with-long-text)

## What's in Each Guide?

### Getting Started
Introduction to Boxen, why you'd use it, and a simple example to get you started quickly.

### Installation
Everything about installing Boxen: package managers, requirements, TypeScript setup, and troubleshooting installation issues.

### Basic Usage
Core concepts including padding, margins, border styles, text alignment, headers, footers, and fixed dimensions. Perfect for most use cases.

### Styling Options
Deep dive into colors, gradients, custom borders, themes, and visual customization. Learn to make your boxes beautiful.

### Advanced Usage
Complex features like fullscreen boxes, responsive sizing, dynamic content, animations, tab handling, and performance optimization.

### API Reference
Complete technical reference for all functions, options, types, and interfaces. Your go-to for exact specifications.

### Examples
Real-world, copy-paste ready examples: CLI applications, monitoring dashboards, menus, tables, and creative uses.

### FAQ
Common questions, troubleshooting tips, performance advice, and solutions to frequent issues.

## Additional Resources

### External Links

- **Package on npm**: [@visulima/boxen](https://www.npmjs.com/package/@visulima/boxen)
- **GitHub Repository**: [visulima/visulima](https://github.com/visulima/visulima)
- **Issue Tracker**: [GitHub Issues](https://github.com/visulima/visulima/issues)
- **Changelog**: [CHANGELOG.md](../CHANGELOG.md)

### Related Packages

Boxen works great with these Visulima packages:

- **[@visulima/colorize](https://www.npmjs.com/package/@visulima/colorize)** - Terminal string styling and colors
- **[@visulima/is-ansi-color-supported](https://www.npmjs.com/package/@visulima/is-ansi-color-supported)** - Detect color support
- **[@visulima/pail](https://www.npmjs.com/package/@visulima/pail)** - Beautiful logging for Node.js

### Examples in the Repository

Check out the [examples folder](../examples) for runnable examples:

- Basic usage
- Multi-color borders
- Gradient effects
- Headers and footers
- Text alignment
- And many more!

## Documentation Standards

All documentation in this folder follows these principles:

- **Practical**: Every concept includes working code examples
- **Progressive**: Guides build from simple to complex
- **Complete**: All options and features are documented
- **Searchable**: Clear headings and structure for easy navigation
- **Current**: Kept up-to-date with the latest version

## Contributing to Documentation

Found an error or want to improve the docs?

1. **Typos and small fixes**: Submit a PR directly
2. **New examples**: Add to the [examples guide](./examples.md)
3. **Missing features**: Update the relevant guide and API reference
4. **New guides**: Discuss in an issue first

All documentation is written in Markdown and located in this folder.

## Version Information

This documentation covers **@visulima/boxen v2.x**.

For older versions:
- v1.x documentation is in the package README on npm

## Need Help?

Can't find what you need?

1. **Search this documentation** - Use your browser's find function
2. **Check the FAQ** - See [FAQ](./faq.md) for common issues
3. **Browse examples** - See [Examples](./examples.md) for practical code
4. **Ask the community** - Create an issue on GitHub
5. **Read the source** - The code is well-commented and readable

## Quick Example

Here's a taste of what Boxen can do:

```typescript
import { boxen } from "@visulima/boxen";
import { bold, cyan } from "@visulima/colorize";

console.log(
    boxen("Hello, World!", {
        padding: 1,
        margin: 1,
        borderStyle: "round",
        borderColor: (border) => cyan(border),
        textColor: (text) => bold(text),
        headerText: "Welcome",
        headerAlignment: "center"
    })
);
```

Now dive into the [Getting Started](./getting-started.md) guide to learn more!
