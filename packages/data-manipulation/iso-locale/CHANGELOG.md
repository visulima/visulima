## @visulima/iso-locale [1.0.0-alpha.11](https://github.com/visulima/visulima/compare/@visulima/iso-locale@1.0.0-alpha.10...@visulima/iso-locale@1.0.0-alpha.11) (2026-06-04)

### Bug Fixes

* **iso-locale:** 2 bug fixes + 1 perf ([5a75216](https://github.com/visulima/visulima/commit/5a752163531e8bd458dffa264e05466e33f9d444))

### Miscellaneous Chores

* apply eslint + prettier autofixes across packages ([c1bb784](https://github.com/visulima/visulima/commit/c1bb7848a0d93d0dfe2960c77e3cda22239c79a0))

### Tests

* improve coverage across packages ([91bd6d3](https://github.com/visulima/visulima/commit/91bd6d3b61736e3c8bd1fc59b0b5955f76a5d323))
* **iso-locale:** cover numeric country lookups, currency fallbacks, and bcp47 parse branches ([695bf35](https://github.com/visulima/visulima/commit/695bf354daac3699c166b6a3a671cec15bd639ee))

## @visulima/iso-locale [1.0.0-alpha.10](https://github.com/visulima/visulima/compare/@visulima/iso-locale@1.0.0-alpha.9...@visulima/iso-locale@1.0.0-alpha.10) (2026-05-27)

### Bug Fixes

* **storage-client:** percent-encode user fields in defaultFingerprint ([7c78a0f](https://github.com/visulima/visulima/commit/7c78a0f9512e2a673b941d80839e9f1e86b7b5d0))

### Documentation

* prettier-format agent instructions ([71b6414](https://github.com/visulima/visulima/commit/71b6414528780ac82c4e0bb25b5f4f11faba5549))

### Miscellaneous Chores

* sorted package.json ([b47c545](https://github.com/visulima/visulima/commit/b47c545591600fdab17d5cd3a3fbc68b61e199da))

## @visulima/iso-locale [1.0.0-alpha.9](https://github.com/visulima/visulima/compare/@visulima/iso-locale@1.0.0-alpha.8...@visulima/iso-locale@1.0.0-alpha.9) (2026-05-26)

### Bug Fixes

* **security:** address codeql findings across packages ([3366f9c](https://github.com/visulima/visulima/commit/3366f9c07d54bdde5242fbd90780baa4634de179))

### Miscellaneous Chores

* **ci-stability:** green CI across vis, native, lint, tests, attw ([#651](https://github.com/visulima/visulima/issues/651)) ([d4eb684](https://github.com/visulima/visulima/commit/d4eb684b5f75c818c9251048c605a0ed54a268e3))
* **iso-locale:** housekeeping cleanup ([326d3e4](https://github.com/visulima/visulima/commit/326d3e4be152fdcb828da32a67341fae0c274709))
* **iso-locale:** upgrade packem to 2.0.0-alpha.76 ([9908d9c](https://github.com/visulima/visulima/commit/9908d9c57641ade481016ea711981e03d53c746c))
* re-sort workspace package.json files via vis sort-package-json ([f625696](https://github.com/visulima/visulima/commit/f625696cfac974325774b3243e1a83c3d23acbd7))
* **repo:** sort package.json keys across all packages ([e1fd9ab](https://github.com/visulima/visulima/commit/e1fd9ab467ef96a98c777da1572ff6a50fcf7e71))

### Tests

* **repo:** add dist runtime + types integration tests ([32ee300](https://github.com/visulima/visulima/commit/32ee300b7184117a0ddf9f9d390f75f8932d5ed9))

## @visulima/iso-locale [1.0.0-alpha.8](https://github.com/visulima/visulima/compare/@visulima/iso-locale@1.0.0-alpha.7...@visulima/iso-locale@1.0.0-alpha.8) (2026-04-22)

### Bug Fixes

* Remove JSR configuration generation script and generated jsr.json files ([#616](https://github.com/visulima/visulima/issues/616)) ([533744b](https://github.com/visulima/visulima/commit/533744b103b74896941db5b727173e617a27a63b))

### Miscellaneous Chores

* bump engines.node to ^22.14.0 || >=24.10.0 ([c3d0931](https://github.com/visulima/visulima/commit/c3d0931d1504e4f21ebf50ea680cfa7ce4ba15ce))
* fixed jsr.json ([5d85e51](https://github.com/visulima/visulima/commit/5d85e5179de38e284ec433b14d77c71a1619c8d6))

## @visulima/iso-locale [1.0.0-alpha.7](https://github.com/visulima/visulima/compare/@visulima/iso-locale@1.0.0-alpha.6...@visulima/iso-locale@1.0.0-alpha.7) (2026-04-15)

### Bug Fixes

* **data-manipulation:** resolve eslint and type-safety issues ([f1682c2](https://github.com/visulima/visulima/commit/f1682c2611cbcc6c85d4bbea520d43464b42e7ee))
* **iso-locale:** cast readonly Country array to mutable type for public export ([b93bc50](https://github.com/visulima/visulima/commit/b93bc5064e123c541140b1ab072c280989087afc))

## @visulima/iso-locale [1.0.0-alpha.6](https://github.com/visulima/visulima/compare/@visulima/iso-locale@1.0.0-alpha.5...@visulima/iso-locale@1.0.0-alpha.6) (2026-04-08)

### Bug Fixes

* **iso-locale:** resolve eslint errors ([8f24691](https://github.com/visulima/visulima/commit/8f246919ecf1c5d08a3f85a019d8857bcbf31c4f))

### Miscellaneous Chores

* apply linting and formatting fixes across packages ([5d150a5](https://github.com/visulima/visulima/commit/5d150a578f9ce861c791843c683deeb849b774a9))
* **data-manipulation:** remove empty dependency objects from package.json ([c0e8f76](https://github.com/visulima/visulima/commit/c0e8f7689a2da413f771494f6ecb07babc4b5e06))
* **iso-locale:** add tsconfig.eslint.json for type-aware linting ([0322596](https://github.com/visulima/visulima/commit/0322596031774fef5e1bbbce188de31d2033824b))
* **iso-locale:** apply prettier formatting ([420b06e](https://github.com/visulima/visulima/commit/420b06e28f37beea0679b16f2ada733518e2cffe))
* **iso-locale:** migrate .prettierrc.cjs to prettier.config.js ([ecc98a0](https://github.com/visulima/visulima/commit/ecc98a0b65de3b5c97cc5b12bd55732e193b2dc9))

## @visulima/iso-locale [1.0.0-alpha.5](https://github.com/visulima/visulima/compare/@visulima/iso-locale@1.0.0-alpha.4...@visulima/iso-locale@1.0.0-alpha.5) (2026-03-26)

### Features

* **web:** auto-generate packages page from workspace metadata ([623e520](https://github.com/visulima/visulima/commit/623e5207693a7fe720f5f2f179593a3654c880e3))

## @visulima/iso-locale [1.0.0-alpha.4](https://github.com/visulima/visulima/compare/@visulima/iso-locale@1.0.0-alpha.3...@visulima/iso-locale@1.0.0-alpha.4) (2026-03-26)

### Bug Fixes

* **web:** improve build setup with incremental stats caching and prod install ([fe33e75](https://github.com/visulima/visulima/commit/fe33e75827586779b4b3a0c6d57b39f889ee6207))

### Miscellaneous Chores

* **iso-locale:** migrate deps to pnpm catalogs ([77a0af9](https://github.com/visulima/visulima/commit/77a0af94f3ee1c405cfca1df1db16af6c6b288ea))
* **iso-locale:** update dependencies ([171ce31](https://github.com/visulima/visulima/commit/171ce31272306c952d35018dea8ec4072f11cd52))
* visulima website ([#591](https://github.com/visulima/visulima/issues/591)) ([59ab2e2](https://github.com/visulima/visulima/commit/59ab2e2befb03e51cd2088956f83d9b87de6d033))

## @visulima/iso-locale [1.0.0-alpha.3](https://github.com/visulima/visulima/compare/@visulima/iso-locale@1.0.0-alpha.2...@visulima/iso-locale@1.0.0-alpha.3) (2026-03-06)

### Bug Fixes

* **iso-locale:** update packem to 2.0.0-alpha.54 ([17ce847](https://github.com/visulima/visulima/commit/17ce8479d65e21f26da08674cedadfd69bf8fbeb))

### Documentation

* **humanizer,html,iso-locale,package,tsconfig:** add comprehensive Fumadocs documentation ([19781ce](https://github.com/visulima/visulima/commit/19781ce5d27605971a9f2fdf0a99863effd98091))

### Miscellaneous Chores

* **data-manipulation:** update dependencies ([49458ab](https://github.com/visulima/visulima/commit/49458ab8f8e17d875840b1b4fe8b5efe12ff3513))
* **iso-locale:** update dependencies ([78c7b5e](https://github.com/visulima/visulima/commit/78c7b5e3528c2ec4a32cab44449c5840664fa94d))
* update lock file maintenance ([d83e716](https://github.com/visulima/visulima/commit/d83e71697b75d24704185b66bb521a934d2db02d))
* year update ([47f4105](https://github.com/visulima/visulima/commit/47f410596ce7190cfea36a073db32e0cec50bbcd))

## @visulima/iso-locale [1.0.0-alpha.2](https://github.com/visulima/visulima/compare/@visulima/iso-locale@1.0.0-alpha.1...@visulima/iso-locale@1.0.0-alpha.2) (2026-01-17)

### Bug Fixes

* added missing og image ([7712247](https://github.com/visulima/visulima/commit/771224739f29e977d5684849dcf015486c75ff00))

### Miscellaneous Chores

* fixed changelog ([6ebdc5b](https://github.com/visulima/visulima/commit/6ebdc5b56e94054f4ac88d2bc2235a2c14d3d608))
* sorting package.json ([430ed68](https://github.com/visulima/visulima/commit/430ed683d3e38e4c5c5530f787ca832f083b17e4))

## @visulima/iso-locale 1.0.0-alpha.1 (2026-01-17)

### Features

* add new exports for countries, currencies, regions, timezones, and types in iso-locale package ([acb2104](https://github.com/visulima/visulima/commit/acb210457cd57160cadd49b84a22c1098ada70eb))
* create new iso-locale package ([#584](https://github.com/visulima/visulima/issues/584)) ([3436f36](https://github.com/visulima/visulima/commit/3436f36aa96636c08f74df1a4eed28a6a29881fb))
* update imports and add new data files for countries, currencies, regions, and timezones in iso-locale package ([639dd6e](https://github.com/visulima/visulima/commit/639dd6ee41ac89a21539f8eac17f1db298bce5ee))

### Code Refactoring

* streamline installation instructions and enhance data structure for countries, currencies, and regions in iso-locale package ([17b9e20](https://github.com/visulima/visulima/commit/17b9e201fef738ff80c6439da4998c4d1da7fbd3))
* update ESLint configuration, improve data handling in regions and timezones, and enhance currency data structure in iso-locale package ([229680d](https://github.com/visulima/visulima/commit/229680d0ecd6b422b594893b8f13e3de504d5475))
