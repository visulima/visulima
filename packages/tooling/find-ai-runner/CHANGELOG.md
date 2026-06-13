## @visulima/find-ai-runner [1.0.0-alpha.8](https://github.com/visulima/visulima/compare/@visulima/find-ai-runner@1.0.0-alpha.7...@visulima/find-ai-runner@1.0.0-alpha.8) (2026-06-13)

### Features

* **find-ai-runner:** async parallel provider detection ([5ae7954](https://github.com/visulima/visulima/commit/5ae795494890d0ac7fd3290ee628f8561534bec5))

### Bug Fixes

* **find-ai-runner:** gate permission-bypass flags and harden runner ([1553bc5](https://github.com/visulima/visulima/commit/1553bc54ea65d37d31b6090d51f0347162674b07))

### Miscellaneous Chores

* apply safe prettier and eslint formatting ([05120af](https://github.com/visulima/visulima/commit/05120af8c898d18c495575680f01134681e29b65))

### Code Refactoring

* **find-ai-runner:** reformat source and docs for prettier ([1ac69ad](https://github.com/visulima/visulima/commit/1ac69ad34e802ee19f89c2a7cde4fc2f90039bd6))

## @visulima/find-ai-runner [1.0.0-alpha.7](https://github.com/visulima/visulima/compare/@visulima/find-ai-runner@1.0.0-alpha.6...@visulima/find-ai-runner@1.0.0-alpha.7) (2026-06-04)

### Bug Fixes

* **find-ai-runner:** 3 bug fixes ([f6d28d9](https://github.com/visulima/visulima/commit/f6d28d9ac893d5fd168b5b03f63e624c9b7c8614))

### Tests

* **find-ai-runner:** cover cli handlers, runProvider spawn lifecycle, and detect edge cases ([0ec5200](https://github.com/visulima/visulima/commit/0ec52003112fa7da5646bc92b04072d66974ce98))

## @visulima/find-ai-runner [1.0.0-alpha.6](https://github.com/visulima/visulima/compare/@visulima/find-ai-runner@1.0.0-alpha.5...@visulima/find-ai-runner@1.0.0-alpha.6) (2026-05-27)

### Bug Fixes

* **storage-client:** percent-encode user fields in defaultFingerprint ([7c78a0f](https://github.com/visulima/visulima/commit/7c78a0f9512e2a673b941d80839e9f1e86b7b5d0))

### Miscellaneous Chores

* **ci-stability:** green CI across vis, native, lint, tests, attw ([#651](https://github.com/visulima/visulima/issues/651)) ([d4eb684](https://github.com/visulima/visulima/commit/d4eb684b5f75c818c9251048c605a0ed54a268e3))
* **find-ai-runner:** housekeeping cleanup ([6a970f6](https://github.com/visulima/visulima/commit/6a970f6277dedc23347963512d2b3ea2e1f1c5bf))
* **find-ai-runner:** upgrade packem to 2.0.0-alpha.76 ([9b33293](https://github.com/visulima/visulima/commit/9b332931c0a825aecc3180a61b7a3e1b3102b1a0))
* re-sort workspace package.json files via vis sort-package-json ([f625696](https://github.com/visulima/visulima/commit/f625696cfac974325774b3243e1a83c3d23acbd7))
* **repo:** sort package.json keys across all packages ([e1fd9ab](https://github.com/visulima/visulima/commit/e1fd9ab467ef96a98c777da1572ff6a50fcf7e71))
* sorted package.json ([b47c545](https://github.com/visulima/visulima/commit/b47c545591600fdab17d5cd3a3fbc68b61e199da))

## @visulima/find-ai-runner [1.0.0-alpha.5](https://github.com/visulima/visulima/compare/@visulima/find-ai-runner@1.0.0-alpha.4...@visulima/find-ai-runner@1.0.0-alpha.5) (2026-04-22)

### Bug Fixes

* Remove JSR configuration generation script and generated jsr.json files ([#616](https://github.com/visulima/visulima/issues/616)) ([533744b](https://github.com/visulima/visulima/commit/533744b103b74896941db5b727173e617a27a63b))

### Miscellaneous Chores

* bump engines.node to ^22.14.0 || >=24.10.0 ([c3d0931](https://github.com/visulima/visulima/commit/c3d0931d1504e4f21ebf50ea680cfa7ce4ba15ce))
* fixed jsr.json ([5d85e51](https://github.com/visulima/visulima/commit/5d85e5179de38e284ec433b14d77c71a1619c8d6))

### Tests

* **find-ai-runner:** fix vitest lint warnings and cli test error ([44fc93c](https://github.com/visulima/visulima/commit/44fc93cb6d267b711be99652d2925817d262a2cd))

## @visulima/find-ai-runner [1.0.0-alpha.4](https://github.com/visulima/visulima/compare/@visulima/find-ai-runner@1.0.0-alpha.3...@visulima/find-ai-runner@1.0.0-alpha.4) (2026-04-15)

### Bug Fixes

* **tooling:** resolve eslint and formatting issues ([399d292](https://github.com/visulima/visulima/commit/399d29282be5b29bb26b4e5b24d45e2a6cdeeca3))

## @visulima/find-ai-runner [1.0.0-alpha.3](https://github.com/visulima/visulima/compare/@visulima/find-ai-runner@1.0.0-alpha.2...@visulima/find-ai-runner@1.0.0-alpha.3) (2026-04-08)

### Features

* **find-ai-runner:** add CLI binary and update docs ([6bd07af](https://github.com/visulima/visulima/commit/6bd07afe9d4ef0cd41a536bbef7baebc4241cde6))
* **find-ai-runner:** add CLI binary for npx usage ([6798d51](https://github.com/visulima/visulima/commit/6798d5116882b5721b5233eabff9577a55afe8aa))

### Bug Fixes

* **find-ai-runner:** fake provider in CLI list test for CI and fix tsconfig ([7af9e7f](https://github.com/visulima/visulima/commit/7af9e7fa74d6b9c8a0999cd5f274af7a33c7fd95))
* **find-ai-runner:** increase timeout for list providers test ([91a78ae](https://github.com/visulima/visulima/commit/91a78ae55b5b270c0a2816264b6d44ad0d97884b))
* **find-ai-runner:** resolve eslint errors ([ea1e74a](https://github.com/visulima/visulima/commit/ea1e74ae7ffe50ae79743381e3954e29201b06ab))

### Documentation

* **find-ai-runner:** add CLI usage examples to docs ([d2c82ab](https://github.com/visulima/visulima/commit/d2c82ab45863453af4877560d88065325168a917))

### Miscellaneous Chores

* added og images ([02d9d1e](https://github.com/visulima/visulima/commit/02d9d1e47be3ce75679ea89e857dc4e4bfe4946b))
* **find-ai-runner:** add tsconfig.eslint.json for type-aware linting ([3615b43](https://github.com/visulima/visulima/commit/3615b43e460d5e7a566fa655199026c69d5db620))
* **find-ai-runner:** migrate .prettierrc.cjs to prettier.config.js ([4eeed5d](https://github.com/visulima/visulima/commit/4eeed5dfe8be7056571fcad1643896cd856a6cea))

## @visulima/find-ai-runner [1.0.0-alpha.2](https://github.com/visulima/visulima/compare/@visulima/find-ai-runner@1.0.0-alpha.1...@visulima/find-ai-runner@1.0.0-alpha.2) (2026-03-26)

### Features

* **web:** auto-generate packages page from workspace metadata ([623e520](https://github.com/visulima/visulima/commit/623e5207693a7fe720f5f2f179593a3654c880e3))

## @visulima/find-ai-runner 1.0.0-alpha.1 (2026-03-26)

### Features

* Add @visulima/task-runner , vis and find-ai-runner ([#594](https://github.com/visulima/visulima/issues/594)) ([034b5db](https://github.com/visulima/visulima/commit/034b5db8aadcc02e23abe007208c5196859c7755))
