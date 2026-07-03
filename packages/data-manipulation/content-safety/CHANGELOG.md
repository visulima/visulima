## @visulima/content-safety [1.0.0-alpha.11](https://github.com/visulima/visulima/compare/@visulima/content-safety@1.0.0-alpha.10...@visulima/content-safety@1.0.0-alpha.11) (2026-06-13)

### Features

* **content-safety:** add options, censor, custom dictionaries; fix docs ([f2ef585](https://github.com/visulima/visulima/commit/f2ef585506d4c9da84de9b151b271e5ff8bc5a1f))
* **content-safety:** options for checkBannedWords ([a40ab28](https://github.com/visulima/visulima/commit/a40ab28d89f38219a2ac3ec9da71717108e5a080))

### Documentation

* **content-safety:** document lookup-table internals ([eb746ce](https://github.com/visulima/visulima/commit/eb746ce0ca65af74012e0ac4144d3eebf06cc16a))

## @visulima/content-safety [1.0.0-alpha.10](https://github.com/visulima/visulima/compare/@visulima/content-safety@1.0.0-alpha.9...@visulima/content-safety@1.0.0-alpha.10) (2026-06-04)

### Bug Fixes

* **content-safety:** 3 bug fixes ([24e1619](https://github.com/visulima/visulima/commit/24e16190e7f8adea2e6c6512d46900268ae6f62b))

### Tests

* **content-safety:** cover public entry point and cjk overlap/phrase paths ([e6b0626](https://github.com/visulima/visulima/commit/e6b06260cc431492beae4e973197f872a91c1c9b))

## @visulima/content-safety [1.0.0-alpha.9](https://github.com/visulima/visulima/compare/@visulima/content-safety@1.0.0-alpha.8...@visulima/content-safety@1.0.0-alpha.9) (2026-05-27)

### Bug Fixes

* **storage-client:** percent-encode user fields in defaultFingerprint ([7c78a0f](https://github.com/visulima/visulima/commit/7c78a0f9512e2a673b941d80839e9f1e86b7b5d0))

### Miscellaneous Chores

* **ci-stability:** green CI across vis, native, lint, tests, attw ([#651](https://github.com/visulima/visulima/issues/651)) ([d4eb684](https://github.com/visulima/visulima/commit/d4eb684b5f75c818c9251048c605a0ed54a268e3))
* **content-safety:** clear lint warnings ([e0d0e9b](https://github.com/visulima/visulima/commit/e0d0e9b08a58d6cd664dc8038f3e039e910e4e14))
* **content-safety:** fix lint errors ([9042806](https://github.com/visulima/visulima/commit/9042806a92c4bd195ad085de0394f5f07425b16c))
* **content-safety:** housekeeping cleanup ([5030462](https://github.com/visulima/visulima/commit/5030462fcac005039ba7e0be44d40d6070a3e825))
* **content-safety:** upgrade packem to 2.0.0-alpha.76 ([852e7db](https://github.com/visulima/visulima/commit/852e7db1461d79fd7b1c2480429ffd6a0f1ef1d2))
* re-sort workspace package.json files via vis sort-package-json ([f625696](https://github.com/visulima/visulima/commit/f625696cfac974325774b3243e1a83c3d23acbd7))
* **repo:** sort package.json keys across all packages ([e1fd9ab](https://github.com/visulima/visulima/commit/e1fd9ab467ef96a98c777da1572ff6a50fcf7e71))
* sorted package.json ([b47c545](https://github.com/visulima/visulima/commit/b47c545591600fdab17d5cd3a3fbc68b61e199da))

### Tests

* **repo:** add dist runtime + types integration tests ([32ee300](https://github.com/visulima/visulima/commit/32ee300b7184117a0ddf9f9d390f75f8932d5ed9))

## @visulima/content-safety [1.0.0-alpha.8](https://github.com/visulima/visulima/compare/@visulima/content-safety@1.0.0-alpha.7...@visulima/content-safety@1.0.0-alpha.8) (2026-04-22)

### Bug Fixes

* Remove JSR configuration generation script and generated jsr.json files ([#616](https://github.com/visulima/visulima/issues/616)) ([533744b](https://github.com/visulima/visulima/commit/533744b103b74896941db5b727173e617a27a63b))

### Miscellaneous Chores

* update the jsr.json ([864ab7e](https://github.com/visulima/visulima/commit/864ab7e71c4b5ae82f64792d1ae8debfea2c539b))

## @visulima/content-safety [1.0.0-alpha.7](https://github.com/visulima/visulima/compare/@visulima/content-safety@1.0.0-alpha.6...@visulima/content-safety@1.0.0-alpha.7) (2026-04-21)

### Performance Improvements

* **content-safety:** replace regex matching with set-based word lookup ([9b39449](https://github.com/visulima/visulima/commit/9b394494ea8f6387ad6ce8bb70a2365da369fe2b))

### Miscellaneous Chores

* bump engines.node to ^22.14.0 || >=24.10.0 ([c3d0931](https://github.com/visulima/visulima/commit/c3d0931d1504e4f21ebf50ea680cfa7ce4ba15ce))
* fixed jsr.json ([5d85e51](https://github.com/visulima/visulima/commit/5d85e5179de38e284ec433b14d77c71a1619c8d6))

### Tests

* **content-safety:** warm regex groups in beforeAll to avoid 20s timeout ([f361422](https://github.com/visulima/visulima/commit/f3614227959e8eab4a6eae9e1b8257914bc3d4c1))

## @visulima/content-safety [1.0.0-alpha.6](https://github.com/visulima/visulima/compare/@visulima/content-safety@1.0.0-alpha.5...@visulima/content-safety@1.0.0-alpha.6) (2026-04-15)

### Bug Fixes

* **data-manipulation:** resolve eslint and type-safety issues ([f1682c2](https://github.com/visulima/visulima/commit/f1682c2611cbcc6c85d4bbea520d43464b42e7ee))

## @visulima/content-safety [1.0.0-alpha.5](https://github.com/visulima/visulima/compare/@visulima/content-safety@1.0.0-alpha.4...@visulima/content-safety@1.0.0-alpha.5) (2026-04-08)

### Bug Fixes

* **content-safety:** resolve eslint errors ([a10a4c1](https://github.com/visulima/visulima/commit/a10a4c11b7dd80422937ad0d56e5d3db9bb9a6a4))

### Miscellaneous Chores

* **content-safety:** add tsconfig.eslint.json for type-aware linting ([3c92a47](https://github.com/visulima/visulima/commit/3c92a471db831145228c694b313152d9eeeae7e3))
* **content-safety:** apply prettier formatting ([e0f4964](https://github.com/visulima/visulima/commit/e0f496468fe988246e6788d51f784a0ca21a906a))
* **content-safety:** migrate .prettierrc.cjs to prettier.config.js ([77a2464](https://github.com/visulima/visulima/commit/77a2464b5bdde276b941b43ad41175264e4b767e))
* **data-manipulation:** remove empty dependency objects from package.json ([c0e8f76](https://github.com/visulima/visulima/commit/c0e8f7689a2da413f771494f6ecb07babc4b5e06))

## @visulima/content-safety [1.0.0-alpha.4](https://github.com/visulima/visulima/compare/@visulima/content-safety@1.0.0-alpha.3...@visulima/content-safety@1.0.0-alpha.4) (2026-03-26)

### Features

* **web:** auto-generate packages page from workspace metadata ([623e520](https://github.com/visulima/visulima/commit/623e5207693a7fe720f5f2f179593a3654c880e3))

## @visulima/content-safety [1.0.0-alpha.3](https://github.com/visulima/visulima/compare/@visulima/content-safety@1.0.0-alpha.2...@visulima/content-safety@1.0.0-alpha.3) (2026-03-26)

### Bug Fixes

* **web:** improve build setup with incremental stats caching and prod install ([fe33e75](https://github.com/visulima/visulima/commit/fe33e75827586779b4b3a0c6d57b39f889ee6207))

### Miscellaneous Chores

* **content-safety:** migrate deps to pnpm catalogs ([d7c2bd4](https://github.com/visulima/visulima/commit/d7c2bd4e0658dbd47e847a36e1b1d13f4f76d801))
* **content-safety:** update dependencies ([c6213f5](https://github.com/visulima/visulima/commit/c6213f50f9b5b7a0b4e7765560c0a80b7b4223be))
* visulima website ([#591](https://github.com/visulima/visulima/issues/591)) ([59ab2e2](https://github.com/visulima/visulima/commit/59ab2e2befb03e51cd2088956f83d9b87de6d033))

## @visulima/content-safety [1.0.0-alpha.2](https://github.com/visulima/visulima/compare/@visulima/content-safety@1.0.0-alpha.1...@visulima/content-safety@1.0.0-alpha.2) (2026-03-06)

### Bug Fixes

* **content-safety:** update packem to 2.0.0-alpha.54 ([98d017b](https://github.com/visulima/visulima/commit/98d017b23b169e5a95c4484dbee7ab2882261cd9))

### Miscellaneous Chores

* **content-safety:** update dependencies ([b38153c](https://github.com/visulima/visulima/commit/b38153cfe8dccfff6c1ac0f5dc183cc41baadf75))
* year update ([47f4105](https://github.com/visulima/visulima/commit/47f410596ce7190cfea36a073db32e0cec50bbcd))

## @visulima/content-safety 1.0.0-alpha.1 (2026-02-16)

### Features

* **content-safety:** add multi-language content safety package ([0825270](https://github.com/visulima/visulima/commit/0825270cba4f1125bd21795b82be0c834d903ce7))

### Performance Improvements

* **content-safety:** optimize regex compilation by splitting into language groups ([0f24f44](https://github.com/visulima/visulima/commit/0f24f445e679b42e54fefa4070240f92548ac307))

### Miscellaneous Chores

* **content-safety:** add comprehensive keywords to package.json ([483d6c4](https://github.com/visulima/visulima/commit/483d6c4c4d2d20c8acc3005eb56723db06db3a5a))

### Tests

* **content-safety:** increase beforeAll timeout for regex cache initialization ([3247c75](https://github.com/visulima/visulima/commit/3247c751a7ca652cb1a913f084673a28dc71f103))
* **content-safety:** increase test timeout to 20s for CI environments ([b173df8](https://github.com/visulima/visulima/commit/b173df8a8685bc59bb5a81a7e436419da8f65f84))
