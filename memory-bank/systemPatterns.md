# System Patterns: Visulima

## Architecture

### Monorepo Structure
```
visulima/
├── packages/          # 30+ utility packages
├── apps/             # Applications (Storybook, Docs)
├── examples/         # Usage examples
├── shared/           # Shared utilities
├── tools/            # Build and config tools
└── scripts/          # Automation scripts
```

### Package Structure Pattern
Each package follows a consistent structure:
```
package-name/
├── src/              # Source code
├── __tests__/        # Unit tests
├── __fixtures__/     # Test fixtures
├── __bench__/        # Benchmarks (optional)
├── __docs__/         # Package documentation (optional)
├── dist/             # Compiled output
├── package.json      # Package metadata
├── tsconfig.json     # TypeScript config
├── vitest.config.ts  # Test configuration
├── eslint.config.js  # Linting rules
├── README.md         # Documentation
└── CHANGELOG.md      # Version history
```

## Key Technical Decisions

### 1. Nx for Build Orchestration
- Centralized task running (test, build, lint)
- Intelligent caching and parallel execution
- Dependency graph management
- Plugin ecosystem support

### 2. pnpm Workspaces
- Fast, disk-efficient package manager
- Strict dependency resolution
- Workspace protocol support
- Monorepo scalability

### 3. TypeScript as Primary Language
- Full type safety across packages
- Modern ES target (ES2020+)
- Strict mode enforced
- JSDoc support for JavaScript

### 4. Vitest for Testing
- Fast, modern test framework
- ESM support native
- Parallel test execution
- Coverage reporting

### 5. ES Modules Only
- No CommonJS fallbacks
- Tree-shakeable by default
- Modern JavaScript standard
- Browser-compatible

### 6. Build System: tsup
- Zero-config TypeScript bundler
- Multiple format outputs (ESM, types)
- Source map generation
- Minimal overhead

## Design Patterns

### Single Responsibility
Each package solves one specific problem:
- `bytes` → byte parsing
- `colorize` → color formatting
- `deep-clone` → deep cloning
- NOT: one mega package with everything

### Immutability First
- Functional, immutable approach preferred
- Minimize side effects
- Pure functions where possible
- State management is explicit

### Error Handling
- Consistent error types via `ono`
- Custom error classes for business logic
- Stack traces preserved
- Error messages are descriptive

### Export Organization
- Default exports for main functionality
- Named exports for utilities
- Type-only exports for TypeScript types
- Clear public API boundaries

## Caching Strategy

### Nx Cache Inputs
- Uses `namedInputs` for intelligent invalidation
- Shared globals tracked (tsconfig, package.json)
- Parallel execution up to 5 tasks
- Cache directory managed by Nx

### Build Caching
- Dependencies cached after `build` target
- Type checking cached for `lint:types`
- Test results cached with coverage
- ESLint results cached

## Code Quality Standards

### TypeScript
- `strict: true` required
- No implicit any
- JSDoc for public APIs
- Type inference where appropriate

### Testing
- Unit tests for critical functionality
- Mock external dependencies
- Test edge cases and error scenarios
- >80% coverage target

### Linting
- ESLint for code quality
- Prettier for formatting
- Biome for performance (future)
- Husky pre-commit hooks

### Documentation
- README for each package
- JSDoc comments on exports
- Inline comments for complex logic
- Examples for key features

## Versioning
- Semantic versioning (SemVer)
- Multi-semantic-release for independent versioning
- CHANGELOG per package
- Git tags for releases

## CI/CD Pipeline
- Run on every commit (pre-commit)
- Parallel linting, testing, type-checking
- Coverage reporting
- Semantic release on merge to main
