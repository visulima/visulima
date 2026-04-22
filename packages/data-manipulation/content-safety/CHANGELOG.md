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
