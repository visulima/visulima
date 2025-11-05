## @visulima/cerebro [2.0.0](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.1.58...@visulima/cerebro@2.0.0) (2025-11-05)

### ⚠ BREAKING CHANGES

* **cerebro:** This release introduces significant breaking changes:

- **ESM-only**: CommonJS exports removed, now requires ESM (Node.js 20.19+, Deno 1.0+, Bun 1.0+)
- **Granular exports**: Plugins and commands must be imported from specific paths (e.g., `@visulima/cerebro/plugins/error-handler`)
- **Enhanced error types**: New error classes with improved validation and error codes
- **Runtime requirements**: Minimum Node.js version is now 20.19

## Features

- **Cross-runtime support**: Full support for Node.js, Deno, and Bun with runtime-agnostic utilities
- **Nested commands**: Hierarchical command structure with parent-child relationships
- **Plugin system**: Extensible plugin architecture with built-in plugins:
  - Error handler plugin for custom error formatting
  - Runtime version check plugin
  - Update notifier plugin for package version checks
- **Shell completion**: New completion command for bash/zsh/fish autocompletion
- **README generation**: Command to automatically generate CLI documentation
- **Environment variables**: Support for environment variable definitions in command options
- **Enhanced logging**: Integration with Pail logger for structured logging
- **Performance benchmarks**: Comprehensive benchmark suite for performance monitoring
- **Enhanced error handling**: Improved error types, validation, and error codes
- **Security enhancements**: Input validation and security utilities

## Improvements

- **Type safety**: Replaced 'any' types with 'unknown' for better type safety
- **Code organization**: Restructured types from `@types` to `types` directory
- **Documentation**: Extensive API documentation, migration guide, and enhanced guides
- **Examples**: Reorganized and expanded examples covering all major features
- **Testing**: Comprehensive unit tests, integration tests, and improved test coverage
- **Performance**: Optimized command processing and enhanced performance

## Documentation

- Added migration guide (MIGRATION-GUIDE.md) with detailed breaking change information
- Enhanced API documentation with complete type definitions
- Added guides for advanced usage, commands, options, and plugins
- Expanded examples with README files and comprehensive use cases

See MIGRATION-GUIDE.md for detailed migration instructions.

### Features

* **cerebro:** major upgrade with cross-runtime support, plugin system, and nested commands ([6e2c930](https://github.com/visulima/visulima/commit/6e2c930322ae263ecf8c1b44e63e53094b26631b))

### Bug Fixes

* update dependencies across multiple packages ([36a47f2](https://github.com/visulima/visulima/commit/36a47f26d65d25a7b4d8371186710e7d0ab61a2b))
* update dependencies and add terminal width support ([c50fc05](https://github.com/visulima/visulima/commit/c50fc05f0b6c2ec925ca3483e05a6db08a6d6be7))

### Tests

* add CEREBRO_TERMINAL_WIDTH environment variable for terminal output ([88ce74e](https://github.com/visulima/visulima/commit/88ce74eb7f16646de9e515676d5aed904a9b0132))


### Dependencies

* **@visulima/colorize:** upgraded to 1.4.26
* **@visulima/tabular:** upgraded to 3.0.0
* **@visulima/error:** upgraded to 5.0.3
* **@visulima/find-cache-dir:** upgraded to 2.0.3
* **@visulima/boxen:** upgraded to 2.0.7
* **@visulima/command-line-args:** upgraded to 1.0.1
* **@visulima/pail:** upgraded to 3.0.3
* **@visulima/path:** upgraded to 2.0.2
* **@visulima/string:** upgraded to 2.0.3

## @visulima/cerebro [1.1.58](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.1.57...@visulima/cerebro@1.1.58) (2025-10-22)

### Bug Fixes

* Downgraded '@visulima/pail' from 3.0.2 to 2.1.31 in package.json ([e910dcd](https://github.com/visulima/visulima/commit/e910dcd29eec9b451d3ec2c6d19ffd04082b0b7b))

## @visulima/cerebro [1.1.57](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.1.56...@visulima/cerebro@1.1.57) (2025-10-22)

### Bug Fixes

* Downgraded @visulima/pail dependency from version 3.0.1 to 2.1.31 in package.json. ([ef8ca71](https://github.com/visulima/visulima/commit/ef8ca714f6e64d6a00b57c120bbb88fd13573997))

### Miscellaneous Chores

* update package dependencies and configurations ([7bfe7e7](https://github.com/visulima/visulima/commit/7bfe7e71869580900aab50efb064b4293994ed9a))


### Dependencies

* **@visulima/boxen:** upgraded to 2.0.6
* **@visulima/pail:** upgraded to 3.0.2

## @visulima/cerebro [1.1.56](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.1.55...@visulima/cerebro@1.1.56) (2025-10-21)

### Bug Fixes

* allow node v25 and updated dev deps ([8158cc5](https://github.com/visulima/visulima/commit/8158cc53ec92bd0331e8c6bd0fcbc8ab61b9320f))

### Miscellaneous Chores

* update copyright year in LICENSE.md files ([c46a28d](https://github.com/visulima/visulima/commit/c46a28d2afb4cc7d73a7edde9a271a7156f87eae))
* update license years and add validation rules ([b97811e](https://github.com/visulima/visulima/commit/b97811ed2d253d908c0d86b4579a0a6bc33673a8))


### Dependencies

* **@visulima/boxen:** upgraded to 2.0.5
* **@visulima/colorize:** upgraded to 1.4.25
* **@visulima/find-cache-dir:** upgraded to 2.0.2
* **@visulima/pail:** upgraded to 3.0.1
* **@visulima/path:** upgraded to 2.0.1

## @visulima/cerebro [1.1.55](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.1.54...@visulima/cerebro@1.1.55) (2025-10-20)

### Bug Fixes

* downgrade @visulima/pail to version 2.1.31 in cerebro package.json ([3518bd4](https://github.com/visulima/visulima/commit/3518bd4b0f7a6cc7a6bf862ebf9dcf129798c1e2))

## @visulima/cerebro [1.1.54](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.1.53...@visulima/cerebro@1.1.54) (2025-10-20)

### Miscellaneous Chores

* **deps:** update package versions and dependencies ([88d8d32](https://github.com/visulima/visulima/commit/88d8d32c4629a7a06c8770369191da2cc81087cc))


### Dependencies

* **@visulima/find-cache-dir:** upgraded to 2.0.1
* **@visulima/pail:** upgraded to 3.0.0

## @visulima/cerebro [1.1.53](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.1.52...@visulima/cerebro@1.1.53) (2025-10-15)

### Bug Fixes

* downgraded `@visulima/find-cache-dir` to version 1.0.35 ([8f21f66](https://github.com/visulima/visulima/commit/8f21f66ead00c7bc35e7c775d8a18280f8863c0b))


### Dependencies

* **@visulima/pail:** upgraded to 2.1.31

## @visulima/cerebro [1.1.52](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.1.51...@visulima/cerebro@1.1.52) (2025-10-15)

### Bug Fixes

* update @visulima/packem to 2.0.0-alpha.29 and refine packem.config.ts settings ([63f14a1](https://github.com/visulima/visulima/commit/63f14a1c11bd7c004e76874ed0b3938ad4740da6))
* update @visulima/packem to 2.0.0-alpha.32 across multiple packages for improved compatibility ([27b346e](https://github.com/visulima/visulima/commit/27b346eaa1c0fb0e420d9a9824482028307f4249))

### Miscellaneous Chores

* update package dependencies across multiple packages for improved compatibility and performance ([9567591](https://github.com/visulima/visulima/commit/9567591c415da3002f3a4fe08f8caf7ce01ca5f7))

### Code Refactoring

* consolidate ESLint configuration and remove obsolete files for improved maintainability ([76d27af](https://github.com/visulima/visulima/commit/76d27afba1dd1946820dc28ae8add2aa1b0ec288))


### Dependencies

* **@visulima/boxen:** upgraded to 2.0.4
* **@visulima/colorize:** upgraded to 1.4.24
* **@visulima/find-cache-dir:** upgraded to 2.0.0
* **@visulima/pail:** upgraded to 2.1.30
* **@visulima/path:** upgraded to 2.0.0

## @visulima/cerebro [1.1.51](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.1.50...@visulima/cerebro@1.1.51) (2025-09-23)

### Miscellaneous Chores

* update package.json and pnpm-lock.yaml to include publint@0.3.12 and adjust build/test commands to exclude shared-utils ([1f7b3c0](https://github.com/visulima/visulima/commit/1f7b3c0381d77edfeec80ea1bf57b3469e929414))


### Dependencies

* **@visulima/find-cache-dir:** upgraded to 1.0.35
* **@visulima/pail:** upgraded to 2.1.29

## @visulima/cerebro [1.1.50](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.1.49...@visulima/cerebro@1.1.50) (2025-09-19)

### Miscellaneous Chores

* **deps:** update build scripts and remove cross-env dependency ([7510e82](https://github.com/visulima/visulima/commit/7510e826b9235a0013fe61c82a7eb333bc4cbb78))


### Dependencies

* **@visulima/find-cache-dir:** upgraded to 1.0.34
* **@visulima/pail:** upgraded to 2.1.28

## @visulima/cerebro [1.1.49](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.1.48...@visulima/cerebro@1.1.49) (2025-09-12)


### Dependencies

* **@visulima/find-cache-dir:** upgraded to 1.0.33
* **@visulima/pail:** upgraded to 2.1.27

## @visulima/cerebro [1.1.48](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.1.47...@visulima/cerebro@1.1.48) (2025-09-12)

### Miscellaneous Chores

* update dependencies and fix linting issues ([0e802fe](https://github.com/visulima/visulima/commit/0e802fe02bb9ed791659cb5f3c77605ae5b42ec8))


### Dependencies

* **@visulima/boxen:** upgraded to 2.0.3

## @visulima/cerebro [1.1.47](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.1.46...@visulima/cerebro@1.1.47) (2025-09-07)


### Dependencies

* **@visulima/find-cache-dir:** upgraded to 1.0.32
* **@visulima/pail:** upgraded to 2.1.26

## @visulima/cerebro [1.1.46](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.1.45...@visulima/cerebro@1.1.46) (2025-06-04)


### Dependencies

* **@visulima/boxen:** upgraded to 2.0.2
* **@visulima/colorize:** upgraded to 1.4.23
* **@visulima/find-cache-dir:** upgraded to 1.0.31
* **@visulima/pail:** upgraded to 2.1.25
* **@visulima/path:** upgraded to 1.4.0

## @visulima/cerebro [1.1.45](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.1.44...@visulima/cerebro@1.1.45) (2025-06-03)


### Dependencies

* **@visulima/boxen:** upgraded to 2.0.1

## @visulima/cerebro [1.1.44](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.1.43...@visulima/cerebro@1.1.44) (2025-06-03)


### Dependencies

* **@visulima/find-cache-dir:** upgraded to 1.0.30

## @visulima/cerebro [1.1.43](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.1.42...@visulima/cerebro@1.1.43) (2025-06-01)


### Dependencies

* **@visulima/boxen:** upgraded to 2.0.0

## @visulima/cerebro [1.1.42](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.1.41...@visulima/cerebro@1.1.42) (2025-05-31)


### Dependencies

* **@visulima/pail:** upgraded to 2.1.24

## @visulima/cerebro [1.1.41](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.1.40...@visulima/cerebro@1.1.41) (2025-05-30)

### Bug Fixes

* **cerebro:** update dependencies ([0c120e1](https://github.com/visulima/visulima/commit/0c120e1f363dc97e2d33cd94249e08a5da30f7f1))

### Styles

* cs fixes ([6570d56](https://github.com/visulima/visulima/commit/6570d568a80bd3fd4bfd73c824dc78f7e3a372f8))

### Miscellaneous Chores

* updated dev dependencies ([2433ed5](https://github.com/visulima/visulima/commit/2433ed5fb662e0303c37edee8ddc21b46c21263f))


### Dependencies

* **@visulima/boxen:** upgraded to 1.0.31
* **@visulima/colorize:** upgraded to 1.4.22
* **@visulima/find-cache-dir:** upgraded to 1.0.29
* **@visulima/pail:** upgraded to 2.1.23
* **@visulima/path:** upgraded to 1.3.6

## @visulima/cerebro [1.1.40](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.1.39...@visulima/cerebro@1.1.40) (2025-03-07)

### Bug Fixes

* updated @visulima/packem and other dev deps, for better bundling size ([e940581](https://github.com/visulima/visulima/commit/e9405812201594e54dd81d17ddb74177df5f3c24))


### Dependencies

* **@visulima/boxen:** upgraded to 1.0.30
* **@visulima/colorize:** upgraded to 1.4.21
* **@visulima/find-cache-dir:** upgraded to 1.0.28
* **@visulima/pail:** upgraded to 2.1.22
* **@visulima/path:** upgraded to 1.3.5

## @visulima/cerebro [1.1.39](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.1.38...@visulima/cerebro@1.1.39) (2025-03-03)

### Bug Fixes

* **cerebro:** add type assertion for cell in row processing ([4516f4c](https://github.com/visulima/visulima/commit/4516f4cd8700f06f641c86bf1c9a0d0d5b5c69bb))

### Miscellaneous Chores

* updated dev dependencies ([487a976](https://github.com/visulima/visulima/commit/487a976932dc7c39edfc19ffd3968960ff338066))


### Dependencies

* **@visulima/find-cache-dir:** upgraded to 1.0.27

## @visulima/cerebro [1.1.38](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.1.37...@visulima/cerebro@1.1.38) (2025-01-29)


### Dependencies

* **@visulima/find-cache-dir:** upgraded to 1.0.26

## @visulima/cerebro [1.1.37](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.1.36...@visulima/cerebro@1.1.37) (2025-01-26)


### Dependencies

* **@visulima/pail:** upgraded to 2.1.21

## @visulima/cerebro [1.1.36](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.1.35...@visulima/cerebro@1.1.36) (2025-01-25)

### Bug Fixes

* fixed wrong node version range in package.json ([4ae2929](https://github.com/visulima/visulima/commit/4ae292984681c71a770e4d4560432f7b7c5a141a))

### Miscellaneous Chores

* fixed typescript url ([fe65a8c](https://github.com/visulima/visulima/commit/fe65a8c0296ece7ee26474c70d065b06d4d0da89))


### Dependencies

* **@visulima/boxen:** upgraded to 1.0.29
* **@visulima/colorize:** upgraded to 1.4.20
* **@visulima/find-cache-dir:** upgraded to 1.0.25
* **@visulima/pail:** upgraded to 2.1.20
* **@visulima/path:** upgraded to 1.3.4

## @visulima/cerebro [1.1.35](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.1.34...@visulima/cerebro@1.1.35) (2025-01-25)

### Miscellaneous Chores

* updated all dev dependencies ([37fb298](https://github.com/visulima/visulima/commit/37fb298b2af7c63be64252024e54bb3af6ddabec))


### Dependencies

* **@visulima/find-cache-dir:** upgraded to 1.0.24

## @visulima/cerebro [1.1.34](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.1.33...@visulima/cerebro@1.1.34) (2025-01-22)

### Styles

* cs fixes ([f615a6a](https://github.com/visulima/visulima/commit/f615a6af4c0d4fb9ec054565fe5c93e88df487e9))

### Miscellaneous Chores

* updated all dev dependencies and all dependencies in the app folder ([87f4ccb](https://github.com/visulima/visulima/commit/87f4ccbf9f7900ec5b56f3c1477bc4a0ef571bcf))


### Dependencies

* **@visulima/boxen:** upgraded to 1.0.28
* **@visulima/colorize:** upgraded to 1.4.19
* **@visulima/find-cache-dir:** upgraded to 1.0.23
* **@visulima/pail:** upgraded to 2.1.19

## @visulima/cerebro [1.1.33](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.1.32...@visulima/cerebro@1.1.33) (2025-01-13)


### Dependencies

* **@visulima/boxen:** upgraded to 1.0.27
* **@visulima/colorize:** upgraded to 1.4.18
* **@visulima/find-cache-dir:** upgraded to 1.0.22
* **@visulima/pail:** upgraded to 2.1.18
* **@visulima/path:** upgraded to 1.3.3

## @visulima/cerebro [1.1.32](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.1.31...@visulima/cerebro@1.1.32) (2025-01-12)

### Bug Fixes

* updated @visulima/packem, and all other dev dependencies ([7797a1c](https://github.com/visulima/visulima/commit/7797a1c3e6f1fc532895247bd88285a8a9883c40))


### Dependencies

* **@visulima/boxen:** upgraded to 1.0.26
* **@visulima/colorize:** upgraded to 1.4.17
* **@visulima/find-cache-dir:** upgraded to 1.0.21
* **@visulima/pail:** upgraded to 2.1.17
* **@visulima/path:** upgraded to 1.3.2

## @visulima/cerebro [1.1.31](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.1.30...@visulima/cerebro@1.1.31) (2025-01-09)


### Dependencies

* **@visulima/pail:** upgraded to 2.1.16

## @visulima/cerebro [1.1.30](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.1.29...@visulima/cerebro@1.1.30) (2025-01-08)


### Dependencies

* **@visulima/boxen:** upgraded to 1.0.25
* **@visulima/colorize:** upgraded to 1.4.16
* **@visulima/find-cache-dir:** upgraded to 1.0.20
* **@visulima/pail:** upgraded to 2.1.15
* **@visulima/path:** upgraded to 1.3.1

## @visulima/cerebro [1.1.29](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.1.28...@visulima/cerebro@1.1.29) (2025-01-08)


### Dependencies

* **@visulima/boxen:** upgraded to 1.0.24
* **@visulima/colorize:** upgraded to 1.4.15
* **@visulima/find-cache-dir:** upgraded to 1.0.19
* **@visulima/pail:** upgraded to 2.1.14
* **@visulima/path:** upgraded to 1.3.0

## @visulima/cerebro [1.1.28](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.1.27...@visulima/cerebro@1.1.28) (2024-12-31)


### Dependencies

* **@visulima/boxen:** upgraded to 1.0.23
* **@visulima/colorize:** upgraded to 1.4.14
* **@visulima/find-cache-dir:** upgraded to 1.0.18
* **@visulima/pail:** upgraded to 2.1.13
* **@visulima/path:** upgraded to 1.2.0

## @visulima/cerebro [1.1.27](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.1.26...@visulima/cerebro@1.1.27) (2024-12-27)

### Miscellaneous Chores

* updated dev dependencies ([9de2eab](https://github.com/visulima/visulima/commit/9de2eab91e95c8b9289d12f863a5167218770650))


### Dependencies

* **@visulima/find-cache-dir:** upgraded to 1.0.17

## @visulima/cerebro [1.1.26](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.1.25...@visulima/cerebro@1.1.26) (2024-12-12)

### Bug Fixes

* allow node v23 ([8ca929a](https://github.com/visulima/visulima/commit/8ca929af311ce8036cbbfde68b6db05381b860a5))
* allowed node 23, updated dev dependencies ([f99d34e](https://github.com/visulima/visulima/commit/f99d34e01f6b13be8586a1b5d37dc8b8df0a5817))
* updated packem to v1.8.2 ([23f869b](https://github.com/visulima/visulima/commit/23f869b4120856cc97e2bffa6d508e2ae30420ea))
* updated packem to v1.9.2 ([47bdc2d](https://github.com/visulima/visulima/commit/47bdc2dfaeca4e7014dbe7772eae2fdf8c8b35bb))

### Styles

* cs fixes ([46d31e0](https://github.com/visulima/visulima/commit/46d31e082e1865262bf380859c14fabd28ff456d))

### Miscellaneous Chores

* updated dev dependencies ([a916944](https://github.com/visulima/visulima/commit/a916944b888bb34c34b0c54328b38d29e4399857))


### Dependencies

* **@visulima/boxen:** upgraded to 1.0.22
* **@visulima/colorize:** upgraded to 1.4.13
* **@visulima/find-cache-dir:** upgraded to 1.0.16
* **@visulima/pail:** upgraded to 2.1.12
* **@visulima/path:** upgraded to 1.1.2

## @visulima/cerebro [1.1.25](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.1.24...@visulima/cerebro@1.1.25) (2024-10-25)


### Dependencies

* **@visulima/find-cache-dir:** upgraded to 1.0.15

## @visulima/cerebro [1.1.24](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.1.23...@visulima/cerebro@1.1.24) (2024-10-05)


### Dependencies

* **@visulima/boxen:** upgraded to 1.0.21
* **@visulima/colorize:** upgraded to 1.4.12
* **@visulima/find-cache-dir:** upgraded to 1.0.14
* **@visulima/pail:** upgraded to 2.1.11
* **@visulima/path:** upgraded to 1.1.1

## @visulima/cerebro [1.1.23](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.1.22...@visulima/cerebro@1.1.23) (2024-10-05)

### Bug Fixes

* updated dev dependencies, updated packem to v1.0.7, fixed naming of some lint config files ([c071a9c](https://github.com/visulima/visulima/commit/c071a9c8e129014a962ff654a16f302ca18a5c67))


### Dependencies

* **@visulima/boxen:** upgraded to 1.0.20
* **@visulima/colorize:** upgraded to 1.4.11
* **@visulima/find-cache-dir:** upgraded to 1.0.13
* **@visulima/pail:** upgraded to 2.1.10
* **@visulima/path:** upgraded to 1.1.0

## @visulima/cerebro [1.1.22](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.1.21...@visulima/cerebro@1.1.22) (2024-09-29)


### Dependencies

* **@visulima/find-cache-dir:** upgraded to 1.0.12

## @visulima/cerebro [1.1.21](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.1.20...@visulima/cerebro@1.1.21) (2024-09-24)

### Bug Fixes

* update packem to v1 ([05f3bc9](https://github.com/visulima/visulima/commit/05f3bc960df10a1602e24f9066e2b0117951a877))
* updated esbuild from v0.23 to v0.24 ([3793010](https://github.com/visulima/visulima/commit/3793010d0d549c0d41f85dea04b8436251be5fe8))

### Miscellaneous Chores

* updated dev dependencies ([05edb67](https://github.com/visulima/visulima/commit/05edb671285b1cc42875223314b24212e6a12588))


### Dependencies

* **@visulima/boxen:** upgraded to 1.0.19
* **@visulima/colorize:** upgraded to 1.4.10
* **@visulima/find-cache-dir:** upgraded to 1.0.11
* **@visulima/pail:** upgraded to 2.1.9
* **@visulima/path:** upgraded to 1.0.9

## @visulima/cerebro [1.1.20](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.1.19...@visulima/cerebro@1.1.20) (2024-09-12)


### Dependencies

* **@visulima/boxen:** upgraded to 1.0.18

## @visulima/cerebro [1.1.19](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.1.18...@visulima/cerebro@1.1.19) (2024-09-11)

### Bug Fixes

* fixed node10 support ([f5e78d9](https://github.com/visulima/visulima/commit/f5e78d9bff8fd603967666598b34f9338a8726b5))

### Miscellaneous Chores

* updated dev dependencies ([28b5ee5](https://github.com/visulima/visulima/commit/28b5ee5c805ca8868536418829cde7ba8c5bb8dd))


### Dependencies

* **@visulima/boxen:** upgraded to 1.0.17
* **@visulima/colorize:** upgraded to 1.4.9
* **@visulima/find-cache-dir:** upgraded to 1.0.10
* **@visulima/pail:** upgraded to 2.1.8
* **@visulima/path:** upgraded to 1.0.8

## @visulima/cerebro [1.1.18](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.1.17...@visulima/cerebro@1.1.18) (2024-09-07)

### Bug Fixes

* fixed broken chunk splitting from packem ([1aaf277](https://github.com/visulima/visulima/commit/1aaf27779292d637923c5f8a220e18606e78caa2))


### Dependencies

* **@visulima/boxen:** upgraded to 1.0.16
* **@visulima/colorize:** upgraded to 1.4.8
* **@visulima/find-cache-dir:** upgraded to 1.0.9
* **@visulima/pail:** upgraded to 2.1.7
* **@visulima/path:** upgraded to 1.0.7

## @visulima/cerebro [1.1.17](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.1.16...@visulima/cerebro@1.1.17) (2024-09-07)

### Bug Fixes

* added types support for node10 ([604583f](https://github.com/visulima/visulima/commit/604583fa3c24b950fafad45d17e7a1333040fd76))

### Styles

* cs fixes ([f5c4af7](https://github.com/visulima/visulima/commit/f5c4af7cfa9fc79b6d3fa60c1e48d88bffab5a08))

### Miscellaneous Chores

* update dev dependencies ([0738f98](https://github.com/visulima/visulima/commit/0738f9810478bb215ce4b2571dc8874c4c503089))


### Dependencies

* **@visulima/boxen:** upgraded to 1.0.15
* **@visulima/colorize:** upgraded to 1.4.7
* **@visulima/find-cache-dir:** upgraded to 1.0.8
* **@visulima/pail:** upgraded to 2.1.6
* **@visulima/path:** upgraded to 1.0.6

## @visulima/cerebro [1.1.16](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.1.15...@visulima/cerebro@1.1.16) (2024-08-30)

### Bug Fixes

* updated license content ([63e34b3](https://github.com/visulima/visulima/commit/63e34b3a173d0b05b4eea97f85d37f08559559dd))

### Styles

* **cerebro:** cs fix ([3965a47](https://github.com/visulima/visulima/commit/3965a4782ef59832b12832dd42962cf2fb4cc524))

### Miscellaneous Chores

* updated dev dependencies ([45c2a76](https://github.com/visulima/visulima/commit/45c2a76bc974ecb2c6b172c3af03373d4cc6a5ce))


### Dependencies

* **@visulima/boxen:** upgraded to 1.0.14
* **@visulima/colorize:** upgraded to 1.4.6
* **@visulima/find-cache-dir:** upgraded to 1.0.7
* **@visulima/pail:** upgraded to 2.1.5
* **@visulima/path:** upgraded to 1.0.5

## @visulima/cerebro [1.1.15](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.1.14...@visulima/cerebro@1.1.15) (2024-08-08)

### Bug Fixes

* **cerebro:** fixed conflict handling on commands ([#471](https://github.com/visulima/visulima/issues/471)) ([5a19ebc](https://github.com/visulima/visulima/commit/5a19ebc91e35fcb502bd17c7282c609e498b95e6))


### Dependencies

* **@visulima/find-cache-dir:** upgraded to 1.0.6
* **@visulima/pail:** upgraded to 2.1.4

## @visulima/cerebro [1.1.14](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.1.13...@visulima/cerebro@1.1.14) (2024-08-04)


### Dependencies

* **@visulima/boxen:** upgraded to 1.0.13
* **@visulima/colorize:** upgraded to 1.4.5
* **@visulima/find-cache-dir:** upgraded to 1.0.5
* **@visulima/pail:** upgraded to 2.1.3
* **@visulima/path:** upgraded to 1.0.4

## @visulima/cerebro [1.1.13](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.1.12...@visulima/cerebro@1.1.13) (2024-08-01)

### Bug Fixes

* upgraded @visulima/packem ([dc0cb57](https://github.com/visulima/visulima/commit/dc0cb5701b30f3f81404346c909fd4daf891b894))

### Styles

* cs fixes ([6f727ec](https://github.com/visulima/visulima/commit/6f727ec36437384883ca4b764d920cf03ffe44df))

### Miscellaneous Chores

* updated dev dependencies ([ac67ec1](https://github.com/visulima/visulima/commit/ac67ec1bcba16175d225958e318199f60b10d179))


### Dependencies

* **@visulima/boxen:** upgraded to 1.0.12
* **@visulima/colorize:** upgraded to 1.4.4
* **@visulima/find-cache-dir:** upgraded to 1.0.4
* **@visulima/pail:** upgraded to 2.1.2
* **@visulima/path:** upgraded to 1.0.3

## @visulima/cerebro [1.1.12](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.1.11...@visulima/cerebro@1.1.12) (2024-07-22)


### Dependencies

* **@visulima/pail:** upgraded to 2.1.1

## @visulima/cerebro [1.1.11](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.1.10...@visulima/cerebro@1.1.11) (2024-07-16)

### Bug Fixes

* **cerebro:** updated dev deps and command-line-args to v6 ([3458108](https://github.com/visulima/visulima/commit/3458108ada809e851a1e5b0168a0463041d6cf4e))

## @visulima/cerebro [1.1.10](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.1.9...@visulima/cerebro@1.1.10) (2024-07-10)


### Dependencies

* **@visulima/pail:** upgraded to 2.1.0

## @visulima/cerebro [1.1.9](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.1.8...@visulima/cerebro@1.1.9) (2024-07-09)


### Dependencies

* **@visulima/pail:** upgraded to 2.0.1

## @visulima/cerebro [1.1.8](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.1.7...@visulima/cerebro@1.1.8) (2024-07-09)

### Bug Fixes

* **cerebro:** removed the pail ErrorProcessor ([668a290](https://github.com/visulima/visulima/commit/668a290afb0303a430803d738d6a0d0916892d32))

## @visulima/cerebro [1.1.7](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.1.6...@visulima/cerebro@1.1.7) (2024-07-09)


### Dependencies

* **@visulima/pail:** upgraded to 2.0.0

## @visulima/cerebro [1.1.6](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.1.5...@visulima/cerebro@1.1.6) (2024-07-09)

### Styles

* cs fixes ([ee5ed6f](https://github.com/visulima/visulima/commit/ee5ed6f31bdabcfacdb0d1abd1eff2cc6207cefc))

### Miscellaneous Chores

* added private true into fixture package.json files ([4a9494c](https://github.com/visulima/visulima/commit/4a9494c642fa98f224505a1d231b5af4e73d6c79))


### Dependencies

* **@visulima/pail:** upgraded to 1.4.4

## @visulima/cerebro [1.1.5](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.1.4...@visulima/cerebro@1.1.5) (2024-07-02)

### Miscellaneous Chores

* changed typescript version back to 5.4.5 ([55d28bb](https://github.com/visulima/visulima/commit/55d28bbdc103718d19f844034b38a0e8e5af798a))


### Dependencies

* **@visulima/find-cache-dir:** upgraded to 1.0.3

## @visulima/cerebro [1.1.4](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.1.3...@visulima/cerebro@1.1.4) (2024-07-02)


### Dependencies

* **@visulima/find-cache-dir:** upgraded to 1.0.2

## @visulima/cerebro [1.1.3](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.1.2...@visulima/cerebro@1.1.3) (2024-07-01)

### Styles

* cs fixes ([66b9583](https://github.com/visulima/visulima/commit/66b9583f7ee8591b92955e65bc2dc7cbba7d03be))

### Miscellaneous Chores

* updated dev dependencies ([34df456](https://github.com/visulima/visulima/commit/34df4569f2fc074823a406c44a131c8fbae2b147))


### Dependencies

* **@visulima/boxen:** upgraded to 1.0.11

## @visulima/cerebro [1.1.2](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.1.1...@visulima/cerebro@1.1.2) (2024-07-01)


### Dependencies

* **@visulima/find-cache-dir:** upgraded to 1.0.1

## @visulima/cerebro [1.1.1](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.1.0...@visulima/cerebro@1.1.1) (2024-06-26)

### Bug Fixes

* **cerebro:** fixed typing of command options ([6eca24b](https://github.com/visulima/visulima/commit/6eca24b95528842d898a69415c86abfbf2fab871))

## @visulima/cerebro [1.1.0](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.0.51...@visulima/cerebro@1.1.0) (2024-06-25)

### Features

* **cerebro:** added caller processor for pail when debug mode is used, fixed some typing issues ([db6cac5](https://github.com/visulima/visulima/commit/db6cac52abb216148bddca93f421119c4f56bbd3))

### Bug Fixes

* **cerebro:** fixed wrong variable call for options ([4748502](https://github.com/visulima/visulima/commit/47485029110ee743e57cb93a584903904937160d))

### Miscellaneous Chores

* **cerebro:** fixed issues with new cli test ([2ee88cd](https://github.com/visulima/visulima/commit/2ee88cde7737097331ccf5cd23262c450109a069))
* **cerebro:** removed old dev dependency ([6e96425](https://github.com/visulima/visulima/commit/6e96425717d53e06ba9297b2f20dda67cccfe4da))

## @visulima/cerebro [1.0.51](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.0.50...@visulima/cerebro@1.0.51) (2024-06-20)

### Bug Fixes

* **cerebro:** fixed handling of option conflicts ([#425](https://github.com/visulima/visulima/issues/425)) ([97856a3](https://github.com/visulima/visulima/commit/97856a32030ffd5382f9c84a9f479db2dc7034f6))

## @visulima/cerebro [1.0.50](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.0.49...@visulima/cerebro@1.0.50) (2024-06-20)


### Dependencies

* **@visulima/package:** upgraded to 3.0.0

## @visulima/cerebro [1.0.49](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.0.48...@visulima/cerebro@1.0.49) (2024-06-19)


### Dependencies

* **@visulima/package:** upgraded to 2.0.1

## @visulima/cerebro [1.0.48](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.0.47...@visulima/cerebro@1.0.48) (2024-06-17)


### Dependencies

* **@visulima/package:** upgraded to 2.0.0

## @visulima/cerebro [1.0.47](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.0.46...@visulima/cerebro@1.0.47) (2024-06-17)


### Dependencies

* **@visulima/package:** upgraded to 1.10.3

## @visulima/cerebro [1.0.46](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.0.45...@visulima/cerebro@1.0.46) (2024-06-16)


### Dependencies

* **@visulima/package:** upgraded to 1.10.2

## @visulima/cerebro [1.0.45](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.0.44...@visulima/cerebro@1.0.45) (2024-06-14)


### Dependencies

* **@visulima/pail:** upgraded to 1.4.3

## @visulima/cerebro [1.0.44](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.0.43...@visulima/cerebro@1.0.44) (2024-06-14)


### Dependencies

* **@visulima/pail:** upgraded to 1.4.2

## @visulima/cerebro [1.0.43](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.0.42...@visulima/cerebro@1.0.43) (2024-06-14)


### Dependencies

* **@visulima/pail:** upgraded to 1.4.1

## @visulima/cerebro [1.0.42](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.0.41...@visulima/cerebro@1.0.42) (2024-06-14)


### Dependencies

* **@visulima/pail:** upgraded to 1.4.0

## @visulima/cerebro [1.0.41](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.0.40...@visulima/cerebro@1.0.41) (2024-06-14)


### Dependencies

* **@visulima/pail:** upgraded to 1.3.1

## @visulima/cerebro [1.0.40](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.0.39...@visulima/cerebro@1.0.40) (2024-06-14)


### Dependencies

* **@visulima/pail:** upgraded to 1.3.0

## @visulima/cerebro [1.0.39](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.0.38...@visulima/cerebro@1.0.39) (2024-06-14)

### Bug Fixes

* **cerebro:** fixed wrong typing of error log ([2aee6e4](https://github.com/visulima/visulima/commit/2aee6e4b8aa8d20f252aba52c7d73d83e4979163))


### Dependencies

* **@visulima/pail:** upgraded to 1.2.2

## @visulima/cerebro [1.0.38](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.0.37...@visulima/cerebro@1.0.38) (2024-06-13)


### Dependencies

* **@visulima/pail:** upgraded to 1.2.1

## @visulima/cerebro [1.0.37](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.0.36...@visulima/cerebro@1.0.37) (2024-06-13)


### Dependencies

* **@visulima/pail:** upgraded to 1.2.0

## @visulima/cerebro [1.0.36](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.0.35...@visulima/cerebro@1.0.36) (2024-06-13)


### Dependencies

* **@visulima/boxen:** upgraded to 1.0.10
* **@visulima/colorize:** upgraded to 1.4.3
* **@visulima/pail:** upgraded to 1.1.13

## @visulima/cerebro [1.0.35](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.0.34...@visulima/cerebro@1.0.35) (2024-06-11)

### Miscellaneous Chores

* updated all dev deps ([ef143ce](https://github.com/visulima/visulima/commit/ef143ce2e15952a0910aa5c8bd78d25de9ebd7f3))


### Dependencies

* **@visulima/package:** upgraded to 1.10.1

## @visulima/cerebro [1.0.34](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.0.33...@visulima/cerebro@1.0.34) (2024-06-11)


### Build System

* fixed found audit error, updated all dev package deps, updated deps in apps and examples ([4c51950](https://github.com/visulima/visulima/commit/4c519500dc5504579d35725572920658999885cb))



### Dependencies

* **@visulima/package:** upgraded to 1.10.0

## @visulima/cerebro [1.0.33](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.0.32...@visulima/cerebro@1.0.33) (2024-06-06)


### Bug Fixes

* allow node v22 ([890d457](https://github.com/visulima/visulima/commit/890d4570f18428e2463944813c0c638b3f142803))



### Dependencies

* **@visulima/boxen:** upgraded to 1.0.9
* **@visulima/colorize:** upgraded to 1.4.2
* **@visulima/pail:** upgraded to 1.1.12
* **@visulima/nextra-theme-docs:** upgraded to 4.0.26
* **@visulima/package:** upgraded to 1.9.2
* **@visulima/path:** upgraded to 1.0.2

## @visulima/cerebro [1.0.32](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.0.31...@visulima/cerebro@1.0.32) (2024-06-05)


### Miscellaneous Chores

* updated dev dependencies ([a2e0504](https://github.com/visulima/visulima/commit/a2e0504dc239049434c2482756ff15bdbaac9b54))



### Dependencies

* **@visulima/nextra-theme-docs:** upgraded to 4.0.25
* **@visulima/package:** upgraded to 1.9.1

## @visulima/cerebro [1.0.31](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.0.30...@visulima/cerebro@1.0.31) (2024-05-31)



### Dependencies

* **@visulima/package:** upgraded to 1.9.0

## @visulima/cerebro [1.0.30](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.0.29...@visulima/cerebro@1.0.30) (2024-05-31)



### Dependencies

* **@visulima/package:** upgraded to 1.8.4

## @visulima/cerebro [1.0.29](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.0.28...@visulima/cerebro@1.0.29) (2024-05-28)



### Dependencies

* **@visulima/package:** upgraded to 1.8.3

## @visulima/cerebro [1.0.28](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.0.27...@visulima/cerebro@1.0.28) (2024-05-24)


### Bug Fixes

* changed pathe to @visulima/path ([#410](https://github.com/visulima/visulima/issues/410)) ([bfe1287](https://github.com/visulima/visulima/commit/bfe1287aff6d28d5dca302fd4d58c1f6234ce0bb))


### Miscellaneous Chores

* changed semantic-release-npm to pnpm ([b6d100a](https://github.com/visulima/visulima/commit/b6d100a2bf3fd026577be48726a37754947f0973))



### Dependencies

* **@visulima/boxen:** upgraded to 1.0.8
* **@visulima/colorize:** upgraded to 1.4.1
* **@visulima/pail:** upgraded to 1.1.11
* **@visulima/package:** upgraded to 1.8.2
* **@visulima/path:** upgraded to 1.0.1

## @visulima/cerebro [1.0.27](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.0.26...@visulima/cerebro@1.0.27) (2024-05-13)


### Bug Fixes

* **cerebro:** updated cli-table3 to version 0.6.5 ([5b0aae1](https://github.com/visulima/visulima/commit/5b0aae1d4a80489a238595ac11bf2293b584400e))

## @visulima/cerebro [1.0.26](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.0.25...@visulima/cerebro@1.0.26) (2024-04-10)



### Dependencies

* **@visulima/boxen:** upgraded to 1.0.6
* **@visulima/colorize:** upgraded to 1.4.0
* **@visulima/pail:** upgraded to 1.1.8

## @visulima/cerebro [1.0.25](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.0.24...@visulima/cerebro@1.0.25) (2024-04-09)



### Dependencies

* **@visulima/boxen:** upgraded to 1.0.5
* **@visulima/colorize:** upgraded to 1.3.3
* **@visulima/pail:** upgraded to 1.1.7

## @visulima/cerebro [1.0.24](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.0.23...@visulima/cerebro@1.0.24) (2024-04-09)



### Dependencies

* **@visulima/boxen:** upgraded to 1.0.4
* **@visulima/colorize:** upgraded to 1.3.2
* **@visulima/pail:** upgraded to 1.1.6

## @visulima/cerebro [1.0.23](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.0.22...@visulima/cerebro@1.0.23) (2024-04-09)



### Dependencies

* **@visulima/package:** upgraded to 1.7.1
* **@visulima/nextra-theme-docs:** upgraded to 4.0.21

## @visulima/cerebro [1.0.22](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.0.21...@visulima/cerebro@1.0.22) (2024-04-07)



### Dependencies

* **@visulima/pail:** upgraded to 1.1.5

## @visulima/cerebro [1.0.21](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.0.20...@visulima/cerebro@1.0.21) (2024-04-06)



### Dependencies

* **@visulima/package:** upgraded to 1.7.0

## @visulima/cerebro [1.0.20](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.0.19...@visulima/cerebro@1.0.20) (2024-04-05)


### Bug Fixes

* **cerebro:** fixed exit handling on cli run ([e3f86a9](https://github.com/visulima/visulima/commit/e3f86a91074d0bcc452e821eecacc78d2f580dca))



### Dependencies

* **@visulima/package:** upgraded to 1.6.2

## @visulima/cerebro [1.0.19](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.0.18...@visulima/cerebro@1.0.19) (2024-04-02)



### Dependencies

* **@visulima/package:** upgraded to 1.6.1

## @visulima/cerebro [1.0.18](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.0.17...@visulima/cerebro@1.0.18) (2024-04-02)



### Dependencies

* **@visulima/package:** upgraded to 1.6.0

## @visulima/cerebro [1.0.17](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.0.16...@visulima/cerebro@1.0.17) (2024-04-01)



### Dependencies

* **@visulima/package:** upgraded to 1.5.3

## @visulima/cerebro [1.0.16](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.0.15...@visulima/cerebro@1.0.16) (2024-03-30)



### Dependencies

* **@visulima/package:** upgraded to 1.5.2
* **@visulima/nextra-theme-docs:** upgraded to 4.0.20

## @visulima/cerebro [1.0.15](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.0.14...@visulima/cerebro@1.0.15) (2024-03-30)



### Dependencies

* **@visulima/pail:** upgraded to 1.1.4

## @visulima/cerebro [1.0.14](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.0.13...@visulima/cerebro@1.0.14) (2024-03-27)


### Bug Fixes

* added missing os key to package.json ([4ad1268](https://github.com/visulima/visulima/commit/4ad1268ed12cbdcf60aeb46d4c052ed1696bc150))



### Dependencies

* **@visulima/boxen:** upgraded to 1.0.3
* **@visulima/colorize:** upgraded to 1.3.1
* **@visulima/package:** upgraded to 1.5.1
* **@visulima/pail:** upgraded to 1.1.3

## @visulima/cerebro [1.0.13](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.0.12...@visulima/cerebro@1.0.13) (2024-03-26)


### Bug Fixes

* **cerebro:** fixed cjs version of cerebro ([#383](https://github.com/visulima/visulima/issues/383)) ([8ac3c88](https://github.com/visulima/visulima/commit/8ac3c88a14b27bf108296a051907ff0ba156f3b2))

## @visulima/cerebro [1.0.12](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.0.11...@visulima/cerebro@1.0.12) (2024-03-26)



### Dependencies

* **@visulima/boxen:** upgraded to 1.0.2

## @visulima/cerebro [1.0.11](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.0.10...@visulima/cerebro@1.0.11) (2024-03-23)


### Bug Fixes

* **cerebro:** updated cli-table3 ([b626292](https://github.com/visulima/visulima/commit/b626292dbda362a96870ef62ba2fe6166cca9268))

## @visulima/cerebro [1.0.10](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.0.9...@visulima/cerebro@1.0.10) (2024-03-22)



### Dependencies

* **@visulima/nextra-theme-docs:** upgraded to 4.0.19

## @visulima/cerebro [1.0.9](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.0.8...@visulima/cerebro@1.0.9) (2024-03-19)



### Dependencies

* **@visulima/pail:** upgraded to 1.1.2

## @visulima/cerebro [1.0.8](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.0.7...@visulima/cerebro@1.0.8) (2024-03-16)



### Dependencies

* **@visulima/nextra-theme-docs:** upgraded to 4.0.18

## @visulima/cerebro [1.0.7](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.0.6...@visulima/cerebro@1.0.7) (2024-03-10)



### Dependencies

* **@visulima/nextra-theme-docs:** upgraded to 4.0.17

## @visulima/cerebro [1.0.6](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.0.5...@visulima/cerebro@1.0.6) (2024-03-09)



### Dependencies

* **@visulima/boxen:** upgraded to 1.0.1

## @visulima/cerebro [1.0.5](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.0.4...@visulima/cerebro@1.0.5) (2024-03-07)



### Dependencies

* **@visulima/pail:** upgraded to 1.1.1

## @visulima/cerebro [1.0.4](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.0.3...@visulima/cerebro@1.0.4) (2024-03-06)


### Bug Fixes

* removed lodash.set ([387d110](https://github.com/visulima/visulima/commit/387d110f715d295457d8cb34f6cbd900856e92a3))



### Dependencies

* **@visulima/nextra-theme-docs:** upgraded to 4.0.16

## @visulima/cerebro [1.0.3](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.0.2...@visulima/cerebro@1.0.3) (2024-03-06)


### Bug Fixes

* updated camelcase to 8 ([9c0ab52](https://github.com/visulima/visulima/commit/9c0ab523ec5234e1bf1b958a1204414fdafed5cd))

## @visulima/cerebro [1.0.2](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.0.1...@visulima/cerebro@1.0.2) (2024-03-06)


### Bug Fixes

* **cerebro:** allow to overwrite the logger settings ([3437a08](https://github.com/visulima/visulima/commit/3437a081cf5d304cf9bd79b62b159bb10242c92f))

## @visulima/cerebro [1.0.1](https://github.com/visulima/visulima/compare/@visulima/cerebro@1.0.0...@visulima/cerebro@1.0.1) (2024-03-06)


### Bug Fixes

* **cerebro:** changed package to commonjs and esm, removed hard-rejection ([4c2dffb](https://github.com/visulima/visulima/commit/4c2dffba479b3c29eef833f9535b98e4c1bf9c44))

## @visulima/cerebro 1.0.0 (2024-03-06)


### Features

* adding a new cli lib to rule them all ([#241](https://github.com/visulima/visulima/issues/241)) ([0c3ff31](https://github.com/visulima/visulima/commit/0c3ff31ab351c39cb3b2653b5f1a7aa3b417ff2c))
