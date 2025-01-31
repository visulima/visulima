# Product Context

## Project Overview
Visulima is a comprehensive TypeScript-based framework/platform project providing a suite of utilities, tools, and frameworks for modern web development.

## Core Components

### Applications
- `docs`: Documentation site
- `storybook`: Component visualization and documentation

### Key Packages
1. API & Data:
   - `api-platform`: API development framework
   - `crud`: CRUD operations framework
   - `prisma-dmmf-transformer`: Prisma schema transformation utilities

2. Web Framework Tools:
   - `connect`: Web framework connectivity
   - `health-check`: System health monitoring
   - `pagination`: Data pagination utilities

3. Development Utilities:
   - `cerebro`: Development tooling
   - `deep-clone`: Object cloning utility
   - `object`: Object manipulation utilities
   - `package`: Package management tools

4. Formatting & Display:
   - `ansi`: ANSI color support
   - `colorize`: Text coloring utilities
   - `fmt`: Formatting utilities
   - `boxen`: Terminal box drawing
   - `table`: Table formatting
   - `humanizer`: Text humanization tools
   - `string`: Advanced string manipulation
     - Case transformation (camel, pascal, kebab, etc.)
     - Locale-aware string operations
     - ANSI and emoji handling
     - Extensible with custom acronyms
     - High-performance ASCII optimizations

5. System Utilities:
   - `fs`: File system utilities
   - `path`: Path manipulation utilities
   - `find-cache-dir`: Cache directory management

6. Development Tools:
   - `inspector`: Debugging and inspection tools
   - `error`: Error handling utilities
   - `source-map`: Source map handling
   - `tsconfig`: TypeScript configuration

## Organization
- Monorepo structure using pnpm workspaces
- NX for project management and task orchestration
- TypeScript-based with comprehensive type definitions
- Modular architecture with clear package separation

## Development Standards
- Comprehensive linting setup:
  - ESLint for code quality
  - Prettier for code formatting
  - Secretlint for security
  - Textlint for documentation
- Conventional commits with commitlint
- Automated CI/CD pipeline
- Comprehensive documentation with dedicated docs site
- Component visualization through Storybook
