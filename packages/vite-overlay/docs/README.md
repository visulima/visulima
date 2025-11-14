# Vite Overlay Documentation

This directory contains the complete documentation for the `@visulima/vite-overlay` package.

## Documentation Structure

The documentation is organized following fumadocs.dev markdown format conventions:

### Core Documentation Files

1. **index.mdx** - Introduction and overview of the package
   - What is Vite Overlay
   - Key features
   - Use cases
   - Browser support

2. **installation.mdx** - Installation and setup guide
   - Prerequisites
   - Package installation (npm, yarn, pnpm, bun)
   - Basic setup
   - Framework-specific setup (React, Vue, Svelte, Preact)
   - Verification steps

3. **usage.mdx** - Usage guide and workflows
   - Basic usage
   - Understanding the error overlay
   - Error types (client-side, SSR, imports, etc.)
   - Keyboard shortcuts
   - Error cause chains
   - Framework-specific features

4. **configuration.mdx** - Configuration reference
   - All available options
   - Configuration examples
   - Custom solution finders
   - Environment-specific configuration
   - Best practices

5. **api-reference.mdx** - Complete API documentation
   - Plugin function
   - TypeScript interfaces
   - Constants
   - Utility functions
   - Advanced usage

6. **examples.mdx** - Real-world examples
   - React, Vue, Svelte examples
   - Custom solution finder examples
   - SSR setup
   - Monorepo configuration
   - Testing integration
   - Error boundary integration

7. **troubleshooting.mdx** - Common issues and solutions
   - Installation issues
   - Plugin not working
   - Source map issues
   - Performance issues
   - Framework-specific issues
   - Browser compatibility
   - Debugging tips

### Navigation File

- **meta.json** - Navigation structure for documentation systems

## Format

All documentation files use MDX format with:
- YAML frontmatter for metadata (title, description)
- Markdown content with code examples
- Fumadocs UI components (Callout, Tabs, etc.)
- Syntax-highlighted code blocks
- Tables for reference information

## Usage with Fumadocs

These files are designed to work with [Fumadocs](https://fumadocs.dev/), a documentation framework. The structure follows their recommended patterns:

- MDX format with frontmatter
- Component imports from `fumadocs-ui`
- Proper linking between pages
- Responsive layouts

## Code Examples

All code examples include:
- File path annotations (e.g., `title="vite.config.ts"`)
- Syntax highlighting
- Multiple package manager options (npm, yarn, pnpm, bun)
- TypeScript and JavaScript variants where applicable
- Complete, runnable examples

## Contributing

When adding new documentation:

1. Follow the existing MDX format
2. Include frontmatter with title and description
3. Add code examples with file path annotations
4. Use Callout components for important notes
5. Update meta.json if adding new pages
6. Cross-reference related pages

## Building Documentation

These files can be used with:
- Fumadocs (recommended)
- Next.js with MDX
- Docusaurus
- Any static site generator supporting MDX

## License

Documentation is part of the @visulima/vite-overlay package and follows the same MIT license.
