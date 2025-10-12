# Redact Documentation

This directory contains comprehensive documentation for the `@visulima/redact` package.

## Documentation Structure

- **index.mdx** - Introduction and overview of the package
- **installation.mdx** - Installation instructions and setup guide
- **getting-started.mdx** - Basic usage and core concepts
- **api.mdx** - Complete API reference with types and functions
- **examples.mdx** - Practical examples and common use cases
- **advanced.mdx** - Advanced features, patterns, and best practices
- **meta.json** - Documentation metadata and navigation structure

## Documentation Format

All documentation files use MDX (Markdown with JSX components) format, following the [Fumadocs](https://fumadocs.dev/docs/ui/markdown) documentation framework standards.

## Frontmatter Structure

Each documentation page includes frontmatter metadata:

```yaml
---
title: Page Title
description: Brief description of the page content
---
```

## Building Documentation

This documentation is designed to be used with documentation frameworks like Fumadocs, Nextra, or similar tools that support MDX.

To integrate with a documentation site:

1. Configure your documentation framework to read from this directory
2. Ensure MDX parsing is enabled
3. Configure navigation using the `meta.json` file or your framework's preferred method

## Contributing

When adding or updating documentation:

1. Maintain consistency with existing formatting and style
2. Include practical code examples
3. Update the meta.json file if adding new pages
4. Avoid using emojis in documentation
5. Follow the established documentation structure
6. Test all code examples for accuracy

## Links and References

- [Visulima Redact GitHub](https://github.com/visulima/visulima/tree/main/packages/redact)
- [Fumadocs Documentation](https://fumadocs.dev/)
- [MDX Documentation](https://mdxjs.com/)
