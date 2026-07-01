## @visulima/notification [1.0.0-alpha.5](https://github.com/visulima/visulima/compare/@visulima/notification@1.0.0-alpha.4...@visulima/notification@1.0.0-alpha.5) (2026-07-01)


### Dependencies

* **@visulima/email:** upgraded to 1.0.0-alpha.45

## @visulima/notification [1.0.0-alpha.4](https://github.com/visulima/visulima/compare/@visulima/notification@1.0.0-alpha.3...@visulima/notification@1.0.0-alpha.4) (2026-06-30)

### Styles

* cs fixes ([2a960bb](https://github.com/visulima/visulima/commit/2a960bb1772c9dc70080e2d75d3a0d827034e294))

### Miscellaneous Chores

* add fallow code-intelligence across all packages ([a3b4821](https://github.com/visulima/visulima/commit/a3b48215002e86fed20f2973038b5d4a0aa1ce04))

### Code Refactoring

* resolve fallow dead-code across 13 packages ([8c458d2](https://github.com/visulima/visulima/commit/8c458d2eb17225ed48fc4bee4569e522912e8c3d))

### Continuous Integration

* **fallow:** make fallow:health advisory (--report-only) ([d57148e](https://github.com/visulima/visulima/commit/d57148ea0e3556b4c24d8d336b9fa14987f5dc7d))
* **lint:** raise eslint job timeout and cache slow per-package eslint runs ([#717](https://github.com/visulima/visulima/issues/717)) ([c93878d](https://github.com/visulima/visulima/commit/c93878dbfa1888cc834704448ae6eefd3098597e)), closes [#713](https://github.com/visulima/visulima/issues/713)


### Dependencies

* **@visulima/email:** upgraded to 1.0.0-alpha.44
* **@visulima/error:** upgraded to 6.0.0-alpha.35
* **@visulima/workflow:** upgraded to 1.0.0-alpha.2

## @visulima/notification [1.0.0-alpha.3](https://github.com/visulima/visulima/compare/@visulima/notification@1.0.0-alpha.2...@visulima/notification@1.0.0-alpha.3) (2026-06-23)

### Dependencies

- **@visulima/email:** upgraded to 1.0.0-alpha.43

## @visulima/notification [1.0.0-alpha.2](https://github.com/visulima/visulima/compare/@visulima/notification@1.0.0-alpha.1...@visulima/notification@1.0.0-alpha.2) (2026-06-23)

### Features

- **notification:** add workflow steps and digest subsystems ([#698](https://github.com/visulima/visulima/issues/698)) ([81e2551](https://github.com/visulima/visulima/commit/81e2551b00508e1b5b50e96cb2aec248d938f8fc))

### Bug Fixes

- fixed hoisted package ([45d4062](https://github.com/visulima/visulima/commit/45d40626dc6930fcd457ae90d6d4293cfad92595))

### Dependencies

- **@visulima/email:** upgraded to 1.0.0-alpha.42
- **@visulima/workflow:** upgraded to 1.0.0-alpha.1

## @visulima/notification 1.0.0-alpha.1 (2026-06-20)

### Features

- **notification:** add multi-channel notification package ([88fe816](https://github.com/visulima/visulima/commit/88fe81690763e334aa403b4baa455a77557f5880))

### Bug Fixes

- **notification:** harden webhook verifiers + dedupe crypto helpers ([22a7b74](https://github.com/visulima/visulima/commit/22a7b74504619d2c513ef3e5954a0c92d4aea972))

### Tests

- **notification:** cover provider + middleware error/guard branches ([9eff3fb](https://github.com/visulima/visulima/commit/9eff3fbf6c72f1154ec942280622f5cb9fc5f8f5))
- **notification:** cover webhook provider, unstorage queue, worker, middleware ([6a4bbb5](https://github.com/visulima/visulima/commit/6a4bbb569787f0f4a3138ed854ba89a4c7df04dd))

### Dependencies

- **@visulima/email:** upgraded to 1.0.0-alpha.41
