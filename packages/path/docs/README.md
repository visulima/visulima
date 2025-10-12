# @visulima/path Documentation

Welcome to the comprehensive documentation for `@visulima/path`, a drop-in replacement for Node.js's path module that ensures consistent cross-platform behavior.

## Table of Contents

- [Introduction](./introduction.md)
- [Installation](./installation.md)
- [Getting Started](./getting-started.md)
- [API Reference](./api-reference.md)
- [Utility Functions](./utility-functions.md)
- [Examples](./examples.md)
- [Migration Guide](./migration-guide.md)

## Quick Links

- [GitHub Repository](https://github.com/visulima/visulima)
- [NPM Package](https://www.npmjs.com/package/@visulima/path)
- [Issue Tracker](https://github.com/visulima/visulima/issues)

## What is @visulima/path?

`@visulima/path` is a modern, cross-platform path manipulation library that provides identical exports to Node.js's `path` module while ensuring consistent behavior across all operating systems. Unlike the native Node.js path module, which varies based on the operating system, `@visulima/path` normalizes all operations to use forward slashes (POSIX style), making your code predictable and consistent whether it runs on Windows, macOS, or Linux.

## Key Features

- **Drop-in Replacement**: Compatible with Node.js's path module API
- **Cross-Platform Consistency**: All paths use forward slashes, regardless of OS
- **Zero Node.js Dependencies**: Works in any JavaScript environment
- **TypeScript Support**: Written in modern TypeScript with full type definitions
- **ESM and CommonJS**: Supports both module systems
- **Extra Utilities**: Additional helper functions for common path operations
- **Lightweight**: No external dependencies beyond development tools

## Why Use @visulima/path?

For historical reasons, Windows uses backslashes for path separators while POSIX systems (macOS, Linux) use forward slashes. The native Node.js path module varies its behavior based on the operating system, which can lead to inconsistent code behavior across platforms.

`@visulima/path` solves this by normalizing all path operations, ensuring your application behaves identically on all platforms.

## Getting Started

To get started quickly, check out the [Installation Guide](./installation.md) and then explore the [Getting Started Guide](./getting-started.md) for basic usage examples.
