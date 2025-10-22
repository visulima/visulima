# Tech Context: Visulima

## Core Technologies

### Build & Bundling
- **Nx** 21.5.2 - Monorepo orchestration and task running
- **tsup** - Zero-config TypeScript bundler
- **Vitest** 3.2.4 - Test runner and framework
- **TypeScript** 5.9.3 - Language and type system

### Package Management
- **pnpm** 10.19.0 - Package manager
- **pnpm-workspace** - Workspace protocol
- **Npm-publish** - Semantic release for publishing

### Code Quality
- **ESLint** - Linting
- **Prettier** 3.6.2 - Code formatting
- **Husky** 9.1.7 - Git hooks
- **Commitlint** - Commit message validation
- **textlint** - Documentation linting
- **secretlint** - Secret detection

### Development Tools
- **Storybook** - Component documentation (apps/storybook)
- **Fumadocs** - Markdown documentation framework
- **plop** - Code generation via templates

### Runtime Targets
- **Node.js** 20.19 - 25.x
- **Browser** - ES2020+ compatibility
- **Worker** - Some packages support Web Workers

## Development Setup

### Prerequisites
```bash
Node.js >= 20.19
pnpm >= 10.19.0
```

### Installation
```bash
# Install dependencies
pnpm install

# Verify setup
pnpm run lint:types:root
```

### Key Scripts
```bash
# Building
pnpm run build                 # Build all packages
pnpm run build:packages        # Build only packages
pnpm run build:storybook       # Build Storybook

# Testing
pnpm run test                  # Run all tests
pnpm run test:coverage         # With coverage report
pnpm run test:ui:*             # Individual package UI

# Linting
pnpm run lint                  # Run all linters
pnpm run lint:fix              # Fix all issues
pnpm run lint:eslint:fix       # ESLint fixes only

# Development
pnpm run dev:storybook         # Dev Storybook

# Examples
pnpm run example:api-platform:express:4:dev
```

## Project Configuration Files

### Root Config
- **tsconfig.json** - Base TypeScript config
- **tsconfig.base.json** - Shared paths
- **nx.json** - Nx configuration with caching rules
- **pnpm-workspace.yaml** - Workspace definition
- **.eslintrc.js** - Root ESLint config
- **.prettierrc.cjs** - Prettier config

### Package Config
- **project.json** - Nx project configuration
- **tsconfig.json** - Package-specific types
- **vitest.config.ts** - Test configuration
- **eslint.config.js** - ESLint (ESM format)
- **packem.config.ts** - Build metadata (optional)

## Dependencies Management

### Shared Global Dependencies
Located in root package.json:
- `nx` - Monorepo tooling
- `typescript` - Language
- `vitest` - Testing
- `prettier` - Formatting
- `eslint` - Linting
- `husky` - Git hooks

### Per-Package Dependencies
Most packages have minimal dependencies:
- Focus on zero-dependencies or minimal
- Peer dependencies preferred where applicable
- Version constraints are strict

## Build Output

### Distribution Artifacts
```
dist/
├── index.js          # ESM bundle
├── index.d.ts        # TypeScript declarations
├── index.js.map      # Source map
└── [other-entry-points]
```

### Output Characteristics
- ESM only (no CJS)
- Tree-shakeable
- Source maps included
- Type definitions first-class

## Performance Considerations

### Caching Strategy
- Nx caches build, test, lint tasks
- `namedInputs` define what invalidates cache
- Parallel execution up to 5 tasks
- `.nxignore` for files that don't affect cache

### Optimization Targets
- Fast builds (tsup is zero-config)
- Parallel testing (Vitest default)
- Incremental type checking
- Smart cache invalidation

## Type Safety

### Constraints
- `strict: true` in all tsconfigs
- No implicit any
- Proper type exports
- JSDoc for JS files

### Type Checking
- Root level: `pnpm run lint:types:root`
- Per-package: Each has `lint:types` target
- CI runs type checking on affected packages

## Common Dependencies Version Strategy
- Core packages pinned (TypeScript, Nx, Node)
- Tools allow patch/minor updates
- Security patches applied immediately
- Breaking changes reviewed by maintainers

## Known Limitations & Constraints
1. **Node.js Version**: Minimum 20.19 (modern features required)
2. **ES Modules Only**: No CommonJS compatibility
3. **pnpm Only**: No Yarn/npm support (workspace features required)
4. **Parallel Tasks**: Limited to 5 concurrent by default
5. **Memory**: Large monorepo requires adequate RAM (8GB+ recommended)
