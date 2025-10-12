# Colorize Documentation

Welcome to the comprehensive documentation for `@visulima/colorize` - a powerful terminal and console string styling library.

## Table of Contents

### Getting Started
- [Installation](./installation.md) - How to install and set up Colorize
- [Quick Start](./getting-started.md) - Get up and running in minutes
- [Migration Guide](./migration.md) - Migrating from Chalk, Kleur, or other libraries

### Core Documentation
- [API Reference](./api-reference.md) - Complete API documentation
- [Examples](./examples.md) - Practical usage examples
- [Advanced Features](./advanced.md) - Gradients, templates, and more

### Platform-Specific
- [Browser Usage](./browser.md) - Using Colorize in the browser

### Additional Resources
- [Environment Variables & CLI](./cli-environment.md) - Configuration options
- [FAQ](./faq.md) - Frequently asked questions
- [Troubleshooting](./troubleshooting.md) - Common issues and solutions

## What is Colorize?

Colorize is a sleek, lightning-fast library for adding colors and styles to terminal and console output. It's a modern alternative to Chalk with additional features and better performance.

### Key Features

- **Full ESM and CommonJS Support** - Works with both module systems
- **TypeScript First** - Complete type definitions out of the box
- **Multi-Runtime Support** - Node.js, Deno, Next.js, and Browser
- **Chalk-Compatible API** - Drop-in replacement with zero code changes
- **Template Literals** - Modern tagged template syntax
- **Nested Styles** - Compose styles infinitely deep
- **256 Colors & TrueColor** - Full color spectrum support
- **Smart Fallbacks** - Automatic color space detection
- **Fast Performance** - Up to 3x faster than alternatives
- **Zero Dependencies** - Minimal footprint

### Quick Example

```typescript
import { red, green, blue, bold, hex } from '@visulima/colorize';

// Simple colors
console.log(red('Error!'));
console.log(green('Success!'));

// Template literals
console.log(blue`Information message`);

// Chained styles
console.log(red.bold.underline('Critical Warning!'));

// Nested styles
console.log(red`Alert: ${blue.underline('file.js')} not found!`);

// TrueColor support
console.log(hex('#FF69B4')('Hot Pink!'));
```

## Why Choose Colorize?

### Performance
Colorize is built for speed, offering performance that's up to 3x faster than popular alternatives like Chalk.

### Modern API
Take advantage of JavaScript template literals for cleaner, more readable code:

```typescript
// Old way
chalk.red.bold('Error: ' + message);

// Modern way with Colorize
red.bold`Error: ${message}`;
```

### Rich Feature Set
- **Gradients** - Create beautiful color gradients
- **Template Strings** - Use placeholders in styled templates
- **ANSI Codes** - Direct access to escape codes when needed
- **Strip Colors** - Remove ANSI codes from strings
- **Color Detection** - Smart color support detection

### Type Safety
Full TypeScript support means you get autocomplete and type checking for all colors and styles.

## Browser Support

Colorize works in all modern browsers with console styling support:
- Chrome 69+ (and all Chromium-based browsers)
- Firefox (via `%c` syntax)
- Safari
- Edge

## Node.js Support

Compatible with Node.js 18.x and above.

## Next Steps

- New to Colorize? Start with the [Installation Guide](./installation.md)
- Migrating from another library? Check the [Migration Guide](./migration.md)
- Want to see examples? Browse the [Examples](./examples.md)
- Need detailed API info? See the [API Reference](./api-reference.md)

## Support

- Report issues on [GitHub Issues](https://github.com/visulima/visulima/issues)
- View the source on [GitHub](https://github.com/visulima/visulima/tree/main/packages/colorize)
- Check the [main README](../README.md) for additional information

## License

MIT License - see [LICENSE.md](../LICENSE.md) for details
