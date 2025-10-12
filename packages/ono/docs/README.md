# Ono Documentation

Comprehensive documentation for the Ono error overlay and inspector library.

## Documentation Structure

This documentation is organized into the following sections:

### [Introduction](./index.mdx)

Overview of Ono, its features, and quick start guide. Start here if you're new to Ono.

### [Getting Started](./getting-started.mdx)

Installation instructions and basic usage examples for:
- Web applications (Node.js, Express, Hono)
- CLI applications
- Editor integration
- Request context setup

### [API Reference](./api-reference.mdx)

Complete API documentation including:
- `Ono` class methods (`toHTML`, `toANSI`)
- `createRequestContextPage` function
- Editor integration handlers
- Solution finder interface
- Type definitions

### [Features](./features.mdx)

Detailed feature documentation:
- Beautiful error pages with themes
- Stack trace viewer with syntax highlighting
- Request context panel
- Error causes viewer
- Solution finders (built-in and custom)
- Editor integration
- Terminal output (ANSI)
- Accessibility features
- Security features

### [Examples](./examples.mdx)

Real-world examples for:
- Node.js HTTP servers
- Express.js middleware
- Hono framework
- CLI applications
- Custom solution finders
- Error cause chains
- Custom context pages
- TypeScript error classes
- Bun and Deno integration
- Production error handlers

### [Advanced Usage](./advanced.mdx)

Advanced topics:
- Custom solution finders
- Advanced context pages
- Security hardening
- Performance optimization
- Editor configuration
- Error tracking integration
- Custom themes
- Testing
- Best practices

## Quick Links

- [NPM Package](https://www.npmjs.com/package/@visulima/ono)
- [GitHub Repository](https://github.com/visulima/visulima/tree/main/packages/ono)
- [Bug Reports](https://github.com/visulima/visulima/issues)
- [Examples Directory](../examples/)

## Documentation Format

This documentation is written in MDX (Markdown with JSX) and is designed for use with [Fumadocs](https://fumadocs.dev/). The documentation follows these conventions:

- Code blocks with syntax highlighting
- Callouts for important information
- Tabs for multi-option instructions
- Cards for navigation
- Inline code formatting

## Contributing to Documentation

If you find errors or want to improve the documentation:

1. Fork the repository
2. Make your changes in the `packages/ono/docs/` directory
3. Submit a pull request

Please follow these guidelines:

- Use clear, concise language
- Include code examples for new features
- Test all code examples
- Maintain consistent formatting
- Add links to related sections

## Local Documentation Development

To work on the documentation locally:

```bash
# Install dependencies
pnpm install

# Run tests to ensure examples work
cd packages/ono
pnpm test

# Run example applications
pnpm dev:node  # Node.js example
pnpm dev:hono  # Hono example
```

## Documentation Versioning

This documentation corresponds to:
- Package: `@visulima/ono`
- Minimum Node.js version: 20.19
- Latest stable release: Check [NPM](https://www.npmjs.com/package/@visulima/ono)

## Support

If you need help:

- Check the [GitHub Issues](https://github.com/visulima/visulima/issues)
- Start a [Discussion](https://github.com/visulima/visulima/discussions)
- Sponsor the project on [GitHub Sponsors](https://github.com/sponsors/prisis)

## License

This documentation is part of the Ono package, licensed under the MIT License.
