# @visulima/string Documentation

This directory contains comprehensive documentation for the @visulima/string package following the fumadocs.dev markdown format.

## Documentation Structure

### Getting Started
- **index.mdx** - Overview and quick start guide
- **installation.mdx** - Installation instructions and setup

### Core Features
- **case-conversion.mdx** - Case conversion utilities (camelCase, PascalCase, etc.)
- **string-manipulation.mdx** - Text formatting, truncation, wrapping, and alignment
- **slugification.mdx** - URL slug generation and transliteration
- **string-width.mdx** - Visual width calculation for Unicode strings
- **string-similarity.mdx** - String comparison and similarity algorithms

### Advanced
- **testing.mdx** - Testing utilities for ANSI strings
- **typescript.mdx** - TypeScript support and type definitions
- **api.mdx** - Complete API reference

### Navigation
- **meta.json** - Documentation navigation structure for fumadocs

## Features Covered

### Case Conversion
- camelCase, PascalCase, snake_case, kebab-case
- CONSTANT_CASE, dot.case, path/case
- Title Case, Sentence case, and more
- Multi-language support (CJK, Cyrillic, Greek, etc.)
- Smart acronym handling

### String Manipulation
- Text truncation with Unicode support
- Word wrapping with multiple modes
- Text alignment (left, center, right)
- Indentation removal (outdent)
- ANSI-aware slicing and replacement

### String Width
- Visual width calculation
- Unicode character support
- Emoji handling
- ANSI escape code awareness
- Terminal output formatting

### Slugification
- URL-friendly slug generation
- Unicode to ASCII transliteration
- 60+ language support
- Custom replacement rules
- Thai romanization

### String Similarity
- Levenshtein distance calculation
- Closest string matching
- Similarity scoring
- Fuzzy search support
- Typo correction

### Testing
- ANSI string comparison
- Vitest integration
- Color code testing
- Terminal output validation

### TypeScript
- Full type definitions
- Type-level string manipulation
- Native string type extensions
- Generic type utilities

## Usage

These documentation files are designed to be used with fumadocs.dev or similar markdown documentation systems. They include:

- Frontmatter with title and description
- Code examples with syntax highlighting
- Type definitions and interfaces
- Best practices and common patterns
- Cross-references between pages

## Building the Docs

To integrate with your documentation site:

1. Copy the docs folder to your documentation system
2. Configure fumadocs to read from this directory
3. Update meta.json if needed for your navigation structure
4. Customize the styling to match your brand

## Contributing

When adding new features to @visulima/string:

1. Update the relevant documentation file
2. Add examples demonstrating the new feature
3. Update type definitions in typescript.mdx
4. Add API reference entry in api.mdx
5. Update meta.json if adding new pages

## File Format

All documentation files use MDX format with:
- YAML frontmatter for metadata
- Markdown for content
- JSX components for interactive elements (Cards, Tabs, etc.)
- TypeScript code blocks with syntax highlighting

## Documentation Guidelines

1. **No Emojis** - Keep documentation professional
2. **Clear Examples** - Provide practical, runnable code examples
3. **Complete Options** - Document all configuration options
4. **Type Safety** - Include TypeScript types and interfaces
5. **Cross-Reference** - Link related documentation pages
6. **Best Practices** - Include recommendations and patterns
7. **Real-World Use Cases** - Show practical applications

## Maintenance

Keep documentation:
- Up to date with package changes
- Consistent in style and format
- Well-organized and easy to navigate
- Comprehensive but concise
- Example-driven

## Support

For questions or issues:
- GitHub Issues: https://github.com/visulima/visulima/issues
- Package Homepage: https://visulima.com/packages/string
