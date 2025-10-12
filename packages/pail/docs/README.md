# Pail Documentation

This directory contains comprehensive documentation for the Pail logging library.

## Documentation Structure

The documentation is organized using [fumadocs](https://fumadocs.dev/) markdown format:

- **index.mdx** - Introduction and overview
- **installation.mdx** - Installation guide
- **concepts/** - Core concepts and theory
  - log-levels.mdx - Understanding log levels
  - reporters.mdx - Output formatting and destinations
  - processors.mdx - Log processing and transformation
- **usage/** - Practical usage guides
  - basic.mdx - Basic logging
  - scoped.mdx - Scoped loggers
  - custom-types.mdx - Custom log types
  - timers.mdx - Performance timing
  - interactive.mdx - Interactive mode
- **configuration.mdx** - Configuration options
- **api.mdx** - Complete API reference
- **examples.mdx** - Real-world examples
- **meta.json** - Navigation structure for fumadocs

## Using These Docs

### With fumadocs

These docs are designed to work with fumadocs. To integrate them into a fumadocs site:

1. Copy or symlink this directory into your fumadocs content folder
2. Configure fumadocs to include this directory
3. The meta.json file defines the navigation structure

### As Standalone Reference

The MDX files can also be read directly or converted to other formats. Each file is self-contained with proper frontmatter and internal links.

## Documentation Coverage

The documentation covers:

- Installation and setup
- All core concepts (log levels, reporters, processors)
- Basic and advanced usage
- Complete API reference
- Real-world examples
- Configuration options
- TypeScript support
- Browser and Node.js environments

## Building Documentation

If you're building a documentation site with fumadocs:

```bash
# Install fumadocs
npm install fumadocs

# Follow fumadocs setup guide
# https://fumadocs.dev/docs/ui/getting-started
```

## Contributing

When adding new features to Pail, please update the relevant documentation:

1. Add new API methods to `api.mdx`
2. Add usage examples to appropriate usage guides
3. Update `meta.json` if adding new pages
4. Add real-world examples to `examples.mdx`

## Links

- [Pail GitHub Repository](https://github.com/visulima/visulima/tree/main/packages/pail)
- [fumadocs Documentation](https://fumadocs.dev/)
- [Visulima Project](https://www.visulima.com/)
