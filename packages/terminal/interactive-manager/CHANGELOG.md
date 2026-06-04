## @visulima/interactive-manager [1.0.0-alpha.4](https://github.com/visulima/visulima/compare/@visulima/interactive-manager@1.0.0-alpha.3...@visulima/interactive-manager@1.0.0-alpha.4) (2026-06-04)

### Bug Fixes

* **interactive-manager:** 2 bug fixes + 1 perf ([e7d9871](https://github.com/visulima/visulima/commit/e7d98710254f1d784c5c1f2a8d95eddec92f01d4))

### Miscellaneous Chores

* apply eslint + prettier autofixes across packages ([c1bb784](https://github.com/visulima/visulima/commit/c1bb7848a0d93d0dfe2960c77e3cda22239c79a0))

### Tests

* improve coverage across packages ([91bd6d3](https://github.com/visulima/visulima/commit/91bd6d3b61736e3c8bd1fc59b0b5955f76a5d323))
* **interactive-manager:** cover viewport overflow and scroll clamp paths ([1ec80f6](https://github.com/visulima/visulima/commit/1ec80f633b42f1db00227cf5eeb5c314027aea4e))


### Dependencies

* **@visulima/ansi:** upgraded to 4.0.0-alpha.16
* **@visulima/string:** upgraded to 3.0.0-alpha.15

## @visulima/interactive-manager [1.0.0-alpha.3](https://github.com/visulima/visulima/compare/@visulima/interactive-manager@1.0.0-alpha.2...@visulima/interactive-manager@1.0.0-alpha.3) (2026-05-27)

### Bug Fixes

- **storage-client:** percent-encode user fields in defaultFingerprint ([7c78a0f](https://github.com/visulima/visulima/commit/7c78a0f9512e2a673b941d80839e9f1e86b7b5d0))

### Miscellaneous Chores

- **ci-stability:** green CI across vis, native, lint, tests, attw ([#651](https://github.com/visulima/visulima/issues/651)) ([d4eb684](https://github.com/visulima/visulima/commit/d4eb684b5f75c818c9251048c605a0ed54a268e3))
- **interactive-manager:** housekeeping cleanup ([7bfd667](https://github.com/visulima/visulima/commit/7bfd66710540b573318a6548e9ede01b74236d80))
- **interactive-manager:** upgrade packem to 2.0.0-alpha.76 ([34e5e82](https://github.com/visulima/visulima/commit/34e5e82588b82c8031b2e1075d936b5b543ed2b3))
- re-sort workspace package.json files via vis sort-package-json ([f625696](https://github.com/visulima/visulima/commit/f625696cfac974325774b3243e1a83c3d23acbd7))
- **repo:** apply eslint --fix and prettier --fix across packages ([#650](https://github.com/visulima/visulima/issues/650)) ([2e26a84](https://github.com/visulima/visulima/commit/2e26a84774f218f21345e9a8ecd68236b6542743)), closes [#620](https://github.com/visulima/visulima/issues/620)
- sorted package.json ([b47c545](https://github.com/visulima/visulima/commit/b47c545591600fdab17d5cd3a3fbc68b61e199da))
- **terminal:** apply prettier and eslint formatting sweep ([15fd89c](https://github.com/visulima/visulima/commit/15fd89c677eea60866e08e4fd5f5a6bc8f3bd2e5))

### Tests

- **repo:** add dist runtime + types integration tests ([32ee300](https://github.com/visulima/visulima/commit/32ee300b7184117a0ddf9f9d390f75f8932d5ed9))

### Dependencies

- **@visulima/ansi:** upgraded to 4.0.0-alpha.15
- **@visulima/string:** upgraded to 3.0.0-alpha.14

## @visulima/interactive-manager [1.0.0-alpha.2](https://github.com/visulima/visulima/compare/@visulima/interactive-manager@1.0.0-alpha.1...@visulima/interactive-manager@1.0.0-alpha.2) (2026-04-22)

### Bug Fixes

- Remove JSR configuration generation script and generated jsr.json files ([#616](https://github.com/visulima/visulima/issues/616)) ([533744b](https://github.com/visulima/visulima/commit/533744b103b74896941db5b727173e617a27a63b))

### Miscellaneous Chores

- update the jsr.json ([864ab7e](https://github.com/visulima/visulima/commit/864ab7e71c4b5ae82f64792d1ae8debfea2c539b))

### Dependencies

- **@visulima/ansi:** upgraded to 4.0.0-alpha.13
- **@visulima/string:** upgraded to 3.0.0-alpha.11

## @visulima/interactive-manager 1.0.0-alpha.1 (2026-04-21)

### Features

- **interactive-manager:** add interactive terminal output manager package ([91dde37](https://github.com/visulima/visulima/commit/91dde372b5bcb14fd6c87077e2f7d3bca3f3f763))

### Bug Fixes

- **interactive-manager:** resolve eslint and formatting issues ([cf0d47c](https://github.com/visulima/visulima/commit/cf0d47c1b55467b2074057eb73ba3df6b33e4557))

### Miscellaneous Chores

- bump engines.node to ^22.14.0 || >=24.10.0 ([c3d0931](https://github.com/visulima/visulima/commit/c3d0931d1504e4f21ebf50ea680cfa7ce4ba15ce))
- fixed jsr.json ([5d85e51](https://github.com/visulima/visulima/commit/5d85e5179de38e284ec433b14d77c71a1619c8d6))
- **interactive-manager:** apply pending changes ([7b3ba9b](https://github.com/visulima/visulima/commit/7b3ba9b3381a9ca7cb066e864287473bcd599a8b))

### Dependencies

- **@visulima/ansi:** upgraded to 4.0.0-alpha.10
- **@visulima/string:** upgraded to 3.0.0-alpha.10

# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## 0.0.0 (2024-04-14)

### Features

- Initial release of @visulima/spinner with 90+ built-in spinner animations
- Full TypeScript support
- Zero dependencies
- Fluent API with method chaining
- Support for custom symbols and styling
- TTY and non-TTY stream support
