## @visulima/task-runner-client [1.0.0-alpha.3](https://github.com/visulima/visulima/compare/@visulima/task-runner-client@1.0.0-alpha.2...@visulima/task-runner-client@1.0.0-alpha.3) (2026-06-30)

### ⚠ BREAKING CHANGES

* the listed packages no longer publish a CommonJS build —
consumers must use ESM (import) or dynamic import(). @visulima/connect,
@visulima/crud, @visulima/prisma-dmmf-transformer and @visulima/api-platform
are removed and deprecated.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>

### Styles

* cs fixes ([2a960bb](https://github.com/visulima/visulima/commit/2a960bb1772c9dc70080e2d75d3a0d827034e294))

### Miscellaneous Chores

* add fallow code-intelligence across all packages ([a3b4821](https://github.com/visulima/visulima/commit/a3b48215002e86fed20f2973038b5d4a0aa1ce04))

### Code Refactoring

* ship esm-only; remove deprecated api packages ([6e58351](https://github.com/visulima/visulima/commit/6e58351e73ac7d8f8ec88be4d77871e4de5d5405))

### Build System

* emit .js instead of .mjs for esm output ([c8a6026](https://github.com/visulima/visulima/commit/c8a602665a59f0441a61a5a510cdfed9353101e6))

### Continuous Integration

* **fallow:** make fallow:health advisory (--report-only) ([d57148e](https://github.com/visulima/visulima/commit/d57148ea0e3556b4c24d8d336b9fa14987f5dc7d))

## @visulima/task-runner-client [1.0.0-alpha.2](https://github.com/visulima/visulima/compare/@visulima/task-runner-client@1.0.0-alpha.1...@visulima/task-runner-client@1.0.0-alpha.2) (2026-06-13)

### Features

- **task-runner-client:** add positive hints, protocol/managed helpers, dedupe ([fa4da70](https://github.com/visulima/visulima/commit/fa4da7029998dc8dbf030eea65fb7ff614fe59d5))

### Documentation

- **task-runner-client:** reformat README and CHANGELOG alignment ([c0bcf08](https://github.com/visulima/visulima/commit/c0bcf08af55d8335b8a8efc2d7c1bfba8b874434))

### Code Refactoring

- **task-runner-client:** correctness + quality fixes ([d4d7e7d](https://github.com/visulima/visulima/commit/d4d7e7db1d842dc01570f6161f5e7343f7635373))

### Tests

- fix platform-specific path assertions ([a74080a](https://github.com/visulima/visulima/commit/a74080ab1adc4227af3d7d9c302547167cca7f16))
- **task-runner-client:** add proto pollution test ([c043140](https://github.com/visulima/visulima/commit/c0431409ee11eac65a482988cb0e1b933d59e13a))

## @visulima/task-runner-client 1.0.0-alpha.1 (2026-06-02)

### Features

- **task-runner,vis:** per-task pty + concurrency weight, abort cache gate, fspy scaffolds ([#656](https://github.com/visulima/visulima/issues/656)) ([ca64010](https://github.com/visulima/visulima/commit/ca64010b236903e08273680ea65dec7046fcd18b))
