# Product Context

## Purpose
The `@visulima/package` package provides utilities for package management in Node.js projects, particularly useful in monorepo environments.

## Key Features
- **Multi-format support**: package.json, package.yaml, package.json5
- **Monorepo support**: Find root directories and package managers
- **Catalog resolution**: Resolve pnpm catalog references
- **Flexible discovery**: Customizable file search order
- **Performance**: Built-in caching mechanisms

## User Experience Goals
- **Intuitive**: Easy to use API with sensible defaults
- **Flexible**: Customizable behavior for different use cases
- **Performant**: Fast file discovery with caching
- **Reliable**: Comprehensive test coverage and error handling

## Current Limitations
- Fixed file discovery order (json → yaml → json5)
- Limited test coverage for mixed file scenarios
- No user control over file search priority