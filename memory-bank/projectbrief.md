# Project Brief: Visulima

## Overview
Visulima is an open-source monorepo containing 30+ utility packages for JavaScript/TypeScript applications. It provides a comprehensive collection of utilities for CLI tools, error handling, string manipulation, data transformation, and more.

## Core Purpose
To provide well-maintained, high-quality utility libraries that solve common development problems while maintaining excellent documentation and developer experience.

## Key Goals
1. Maintain 30+ specialized utility packages with consistent quality standards
2. Provide comprehensive documentation and examples
3. Support multiple environments (Node.js, Browser) where applicable
4. Ensure excellent TypeScript support throughout
5. Keep dependencies minimal and packages tree-shakeable
6. Foster community contributions with clear contribution guidelines

## Primary Technologies
- **Build System**: Nx 21.5.2 (monorepo orchestration)
- **Package Manager**: pnpm 10.19.0
- **Language**: TypeScript 5.9.3
- **Testing**: Vitest 3.2.4
- **Runtime Target**: Node.js 20.19 - 25.x

## Scope
- **In Scope**: Core package development, testing, linting, documentation, examples
- **Out of Scope**: Enterprise SaaS features, proprietary vendor tools

## Key Constraints
- MIT License
- Strict TypeScript types required
- pnpm workspaces only
- ES modules required
- Tree-shakeable exports
- Browser and Node.js compatibility where applicable

## Success Metrics
- All tests passing
- Zero linting errors
- Type safety maintained
- Documentation complete for each package
- Community engagement and contributions
