# Project Brief

## Overview
This is the `@visulima/package` package, a comprehensive package management utility that helps find root directories, monorepos, package managers, and parse package.json, package.yaml, and package.json5 files with advanced features like catalog resolution.

## Current State
The package currently supports:
- Finding package.json files in directories
- Support for package.yaml and package.json5 files
- Catalog resolution for pnpm workspaces
- Caching mechanisms
- Package installation utilities

## Current File Discovery Order
The current implementation searches for files in this order:
1. package.json
2. package.yaml (if yaml option enabled)
3. package.json5 (if json5 option enabled)

## Requested Changes
1. **Change file discovery order**: Should search for yaml first, then json5, then json when options are enabled
2. **Add comprehensive tests**: Test scenarios with yaml+json, json5+json combinations
3. **Add new option**: Allow users to specify custom file search order

## Technical Context
- TypeScript project with comprehensive test coverage
- Uses vitest for testing
- Supports both sync and async operations
- Has caching mechanisms for performance
- Integrates with pnpm catalog resolution