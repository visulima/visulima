## @visulima/boxen [3.0.0](https://github.com/visulima/visulima/compare/@visulima/boxen@2.0.10...@visulima/boxen@3.0.0) (2026-07-03)

### ⚠ BREAKING CHANGES

* the listed packages no longer publish a CommonJS build —
consumers must use ESM (import) or dynamic import(). @visulima/connect,
@visulima/crud, @visulima/prisma-dmmf-transformer and @visulima/api-platform
are removed and deprecated.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
* change min node version to 22.13

### Features

* **boxen:** fix fullscreen contract and add bg/vertical-align options ([e526ac9](https://github.com/visulima/visulima/commit/e526ac9ce9cf1153d61f4c142019d3fe8df23d4a))
* **web:** auto-generate packages page from workspace metadata ([623e520](https://github.com/visulima/visulima/commit/623e5207693a7fe720f5f2f179593a3654c880e3))

### Bug Fixes

* add new package image, fixed readme rendering on npm, fixed building of packages ([b790ba2](https://github.com/visulima/visulima/commit/b790ba253ea07fef83528fd822a678facf021b5f))
* **boxen:** 4 bug fixes + 1 perf ([c7dc1ad](https://github.com/visulima/visulima/commit/c7dc1ad31abcd515d60872358b4d09afcb33e7de))
* **boxen:** remove remaining eslint suppressions with proper code fixes ([da594ee](https://github.com/visulima/visulima/commit/da594ee2403c03886137293c69e87944feba01a5))
* **boxen:** resolve eslint and formatting issues ([cff5767](https://github.com/visulima/visulima/commit/cff5767dcd4fb3327fbd59b8d2f41faf73a66292))
* **boxen:** resolve eslint errors ([69daf5d](https://github.com/visulima/visulima/commit/69daf5d9d50a208e5c1bf17f91990f5bc465b9ac))
* **boxen:** update package files ([173adef](https://github.com/visulima/visulima/commit/173adef0a39db7e4773bff77d08a7d2371ce83b8))
* **boxen:** update packem to 2.0.0-alpha.54 ([3d70a31](https://github.com/visulima/visulima/commit/3d70a315c440175171399546afa78ca0cdb4e13c))
* **boxen:** use workspace:* for internal [@visulima](https://github.com/visulima) deps ([e413000](https://github.com/visulima/visulima/commit/e413000f12a46a452568b18868d39e60db249afd))
* **lint:** clear pre-existing eslint rot across packages ([#674](https://github.com/visulima/visulima/issues/674)) ([5354253](https://github.com/visulima/visulima/commit/5354253b163bd50bcefaf8a3fddf831bdb5df32b))
* **pail, boxen:** resolve eslint unsafe type issues ([d6e852e](https://github.com/visulima/visulima/commit/d6e852e63f4572a12c31ac44a4ae687c743cf7db))
* Remove JSR configuration generation script and generated jsr.json files ([#616](https://github.com/visulima/visulima/issues/616)) ([533744b](https://github.com/visulima/visulima/commit/533744b103b74896941db5b727173e617a27a63b))
* **storage-client:** percent-encode user fields in defaultFingerprint ([7c78a0f](https://github.com/visulima/visulima/commit/7c78a0f9512e2a673b941d80839e9f1e86b7b5d0))
* **terminal:** resolve eslint and formatting issues ([12ef283](https://github.com/visulima/visulima/commit/12ef283684d1808fbcfe44077a0cfe8324801485))
* **terminal:** resolve eslint and formatting issues ([8f30389](https://github.com/visulima/visulima/commit/8f30389deb9ff81e7afce0aa064ef11fcb179f23))
* update Node.js engine version requirement to >=22.13 in multiple package.json files for improved compatibility ([b828e9a](https://github.com/visulima/visulima/commit/b828e9aeaebfc798eecddccd90e6ec7560c6d36a))
* update package OG images across multiple packages ([f08e4dd](https://github.com/visulima/visulima/commit/f08e4dd2b105ccb29c8412020a9c2be36d6c1e9e))
* update package.json description and keywords ([#578](https://github.com/visulima/visulima/issues/578)) ([154709c](https://github.com/visulima/visulima/commit/154709c05e71d1ffd3e360b27e12febd817912f0))
* **web:** improve build setup with incremental stats caching and prod install ([fe33e75](https://github.com/visulima/visulima/commit/fe33e75827586779b4b3a0c6d57b39f889ee6207))

### Performance Improvements

* **boxen:** disable esbuild keepNames in prod build ([aa3f457](https://github.com/visulima/visulima/commit/aa3f457076945af0b62685af7a1578e6fe7040a2))
* **boxen:** memoize terminal-size probe across renders ([0dded4e](https://github.com/visulima/visulima/commit/0dded4e18197982e9078f825c2e74a07ea90cbd4))

### Documentation

* **boxen,command-line-args,tabular,is-ansi-color-supported,disposable-email-domains:** add comprehensive Fumadocs documentation ([95e0578](https://github.com/visulima/visulima/commit/95e057833978dfeeb9f2768269e36862572539db))

### Styles

* cs fixes ([2a960bb](https://github.com/visulima/visulima/commit/2a960bb1772c9dc70080e2d75d3a0d827034e294))

### Miscellaneous Chores

* add fallow code-intelligence across all packages ([a3b4821](https://github.com/visulima/visulima/commit/a3b48215002e86fed20f2973038b5d4a0aa1ce04))
* apply eslint + prettier autofixes across packages ([c1bb784](https://github.com/visulima/visulima/commit/c1bb7848a0d93d0dfe2960c77e3cda22239c79a0))
* apply safe prettier and eslint formatting ([05120af](https://github.com/visulima/visulima/commit/05120af8c898d18c495575680f01134681e29b65))
* **boxen:** add tsconfig.eslint.json for type-aware linting ([0cbef9d](https://github.com/visulima/visulima/commit/0cbef9dc94e8136433e3d01760f2f81abb583935))
* **boxen:** apply auto-fix formatting ([6e0e929](https://github.com/visulima/visulima/commit/6e0e929db65279570c27e94ad63c244fa9f039ed))
* **boxen:** apply formatter and lint fixes ([91844ef](https://github.com/visulima/visulima/commit/91844ef7df194964535500cf0fa5799ae7e16d06))
* **boxen:** apply pending changes ([4cde666](https://github.com/visulima/visulima/commit/4cde666adba97af439798cc44ad72d74bbaa385f))
* **boxen:** apply prettier and eslint quote-style auto-fix ([6be7d00](https://github.com/visulima/visulima/commit/6be7d00db2ef5054354f05c834548155e2011661))
* **boxen:** apply prettier formatting ([04c86f9](https://github.com/visulima/visulima/commit/04c86f99d10eedaac1727696c86a1f7e39cce2b4))
* **boxen:** enforce curly braces and apply lint fixes ([c7228d8](https://github.com/visulima/visulima/commit/c7228d840b2df4dcb149c71bda00408f933dbe5e))
* **boxen:** housekeeping cleanup ([ce659c2](https://github.com/visulima/visulima/commit/ce659c25510a511e43aa8075e08b77a2f60fb16d))
* **boxen:** migrate .prettierrc.cjs to prettier.config.js ([b18eace](https://github.com/visulima/visulima/commit/b18eace05c6db089931d5323e7034f8f8655aa07))
* **boxen:** migrate deps to pnpm catalogs ([869ea80](https://github.com/visulima/visulima/commit/869ea8004d7fd96253d7eb8dfa004f3880b48303))
* **boxen:** update dependencies ([a06e27a](https://github.com/visulima/visulima/commit/a06e27ac2d27942e729d9aa18be54fed6b2c6742))
* **boxen:** update dependencies ([7853ee6](https://github.com/visulima/visulima/commit/7853ee64c78974efe7097fc03fc11a60381c1cb6))
* **boxen:** update dependencies ([90b472d](https://github.com/visulima/visulima/commit/90b472dca27b89cd20d2aafe2d36a35ce1f33bc9))
* **boxen:** upgrade packem to 2.0.0-alpha.76 ([0966324](https://github.com/visulima/visulima/commit/09663243bd8980c1ce709901ee5c5786adcf3cee))
* bump engines.node to ^22.14.0 || >=24.10.0 ([c3d0931](https://github.com/visulima/visulima/commit/c3d0931d1504e4f21ebf50ea680cfa7ce4ba15ce))
* **ci-stability:** green CI across vis, native, lint, tests, attw ([#651](https://github.com/visulima/visulima/issues/651)) ([d4eb684](https://github.com/visulima/visulima/commit/d4eb684b5f75c818c9251048c605a0ed54a268e3))
* fixed jsr.json ([5d85e51](https://github.com/visulima/visulima/commit/5d85e5179de38e284ec433b14d77c71a1619c8d6))
* fixed project.json names and schema path ([964722f](https://github.com/visulima/visulima/commit/964722f691db205c7edb9aa6db29e849a647500b))
* moved all packages into groups ([0615e9d](https://github.com/visulima/visulima/commit/0615e9d14a8a886e11da529ce150cf31ca973c10))
* re-sort workspace package.json files via vis sort-package-json ([f625696](https://github.com/visulima/visulima/commit/f625696cfac974325774b3243e1a83c3d23acbd7))
* **release:** @visulima/boxen@3.0.0-alpha.1 [skip ci]\n\n## @visulima/boxen [3.0.0-alpha.1](https://github.com/visulima/visulima/compare/@visulima/boxen@2.0.10...@visulima/boxen@3.0.0-alpha.1) (2025-12-07) ([1ab16d5](https://github.com/visulima/visulima/commit/1ab16d5ea5b4447d4c1018c58ee7579e715ef913))
* **release:** @visulima/boxen@3.0.0-alpha.10 [skip ci]\n\n## @visulima/boxen [3.0.0-alpha.10](https://github.com/visulima/visulima/compare/@visulima/boxen@3.0.0-alpha.9...@visulima/boxen@3.0.0-alpha.10) (2026-04-22) ([3b5f780](https://github.com/visulima/visulima/commit/3b5f780929414ad73aa2e50f42d205c23da55e62))
* **release:** @visulima/boxen@3.0.0-alpha.11 [skip ci]\n\n## @visulima/boxen [3.0.0-alpha.11](https://github.com/visulima/visulima/compare/@visulima/boxen@3.0.0-alpha.10...@visulima/boxen@3.0.0-alpha.11) (2026-05-27) ([b6ffbae](https://github.com/visulima/visulima/commit/b6ffbae22377914587036f74ff4919077b446af4))
* **release:** @visulima/boxen@3.0.0-alpha.12 [skip ci]\n\n## @visulima/boxen [3.0.0-alpha.12](https://github.com/visulima/visulima/compare/@visulima/boxen@3.0.0-alpha.11...@visulima/boxen@3.0.0-alpha.12) (2026-06-04) ([d6a211e](https://github.com/visulima/visulima/commit/d6a211e3cde4cd1119f4fd3a8110454d642ee671))
* **release:** @visulima/boxen@3.0.0-alpha.13 [skip ci]\n\n## @visulima/boxen [3.0.0-alpha.13](https://github.com/visulima/visulima/compare/@visulima/boxen@3.0.0-alpha.12...@visulima/boxen@3.0.0-alpha.13) (2026-06-04) ([c742104](https://github.com/visulima/visulima/commit/c74210482a7892516bb3a868491ef81a0148c1e7))
* **release:** @visulima/boxen@3.0.0-alpha.14 [skip ci]\n\n## @visulima/boxen [3.0.0-alpha.14](https://github.com/visulima/visulima/compare/@visulima/boxen@3.0.0-alpha.13...@visulima/boxen@3.0.0-alpha.14) (2026-06-13) ([54f1526](https://github.com/visulima/visulima/commit/54f1526494fbcc8e3aa149a1f9a01b11e8d277be))
* **release:** @visulima/boxen@3.0.0-alpha.15 [skip ci]\n\n## @visulima/boxen [3.0.0-alpha.15](https://github.com/visulima/visulima/compare/@visulima/boxen@3.0.0-alpha.14...@visulima/boxen@3.0.0-alpha.15) (2026-06-30) ([206c2fa](https://github.com/visulima/visulima/commit/206c2fac99fe36a72e2e30a72d7a23b02de7bc20))
* **release:** @visulima/boxen@3.0.0-alpha.2 [skip ci]\n\n## @visulima/boxen [3.0.0-alpha.2](https://github.com/visulima/visulima/compare/@visulima/boxen@3.0.0-alpha.1...@visulima/boxen@3.0.0-alpha.2) (2025-12-08) ([98b8428](https://github.com/visulima/visulima/commit/98b84282fcbfa25af42b4ad2fd72f523aa2df5dd))
* **release:** @visulima/boxen@3.0.0-alpha.3 [skip ci]\n\n## @visulima/boxen [3.0.0-alpha.3](https://github.com/visulima/visulima/compare/@visulima/boxen@3.0.0-alpha.2...@visulima/boxen@3.0.0-alpha.3) (2025-12-11) ([8cdde4e](https://github.com/visulima/visulima/commit/8cdde4e0116a2e5145dcd818b7edc206202e91e0))
* **release:** @visulima/boxen@3.0.0-alpha.4 [skip ci]\n\n## @visulima/boxen [3.0.0-alpha.4](https://github.com/visulima/visulima/compare/@visulima/boxen@3.0.0-alpha.3...@visulima/boxen@3.0.0-alpha.4) (2025-12-13) ([4cc04de](https://github.com/visulima/visulima/commit/4cc04de7b9f496841a8d7b5098c549daede7967d))
* **release:** @visulima/boxen@3.0.0-alpha.5 [skip ci]\n\n## @visulima/boxen [3.0.0-alpha.5](https://github.com/visulima/visulima/compare/@visulima/boxen@3.0.0-alpha.4...@visulima/boxen@3.0.0-alpha.5) (2025-12-27) ([081e8dd](https://github.com/visulima/visulima/commit/081e8dd8074a01d724adc53e49842cfc19b85bd2))
* **release:** @visulima/boxen@3.0.0-alpha.6 [skip ci]\n\n## @visulima/boxen [3.0.0-alpha.6](https://github.com/visulima/visulima/compare/@visulima/boxen@3.0.0-alpha.5...@visulima/boxen@3.0.0-alpha.6) (2026-03-06) ([afe23a2](https://github.com/visulima/visulima/commit/afe23a2ae033494d57068c7963deff228e05d74d))
* **release:** @visulima/boxen@3.0.0-alpha.7 [skip ci]\n\n## @visulima/boxen [3.0.0-alpha.7](https://github.com/visulima/visulima/compare/@visulima/boxen@3.0.0-alpha.6...@visulima/boxen@3.0.0-alpha.7) (2026-03-26) ([1b06e7e](https://github.com/visulima/visulima/commit/1b06e7e9372c3771f3fa507dd1e8904cb175f20d))
* **release:** @visulima/boxen@3.0.0-alpha.8 [skip ci]\n\n## @visulima/boxen [3.0.0-alpha.8](https://github.com/visulima/visulima/compare/@visulima/boxen@3.0.0-alpha.7...@visulima/boxen@3.0.0-alpha.8) (2026-03-26) ([503af03](https://github.com/visulima/visulima/commit/503af038e8d61ea7fbe6ecba881c3c1ef7857806))
* **release:** @visulima/boxen@3.0.0-alpha.9 [skip ci]\n\n## @visulima/boxen [3.0.0-alpha.9](https://github.com/visulima/visulima/compare/@visulima/boxen@3.0.0-alpha.8...@visulima/boxen@3.0.0-alpha.9) (2026-04-08) ([ac37823](https://github.com/visulima/visulima/commit/ac37823e58c16359a085b90087ec5d0c2e3d7419))
* **repo:** apply eslint --fix and prettier --fix across packages ([#650](https://github.com/visulima/visulima/issues/650)) ([2e26a84](https://github.com/visulima/visulima/commit/2e26a84774f218f21345e9a8ecd68236b6542743)), closes [#620](https://github.com/visulima/visulima/issues/620)
* simplify pnpm-workspace packages list ([7cab221](https://github.com/visulima/visulima/commit/7cab221163632d9b7aa044a6f88c49083103a869))
* **terminal:** apply prettier and eslint formatting sweep ([15fd89c](https://github.com/visulima/visulima/commit/15fd89c677eea60866e08e4fd5f5a6bc8f3bd2e5))
* **terminal:** remove empty dependency objects from package.json ([562c704](https://github.com/visulima/visulima/commit/562c704e5d90aa2d13eae942ebbdcfeb787c2b46))
* **terminal:** update dependencies ([a5bb91a](https://github.com/visulima/visulima/commit/a5bb91a66f2be2ade485d586156a54c347a23cc9))
* update @anolilab/semantic-release-pnpm and @anolilab/semantic-release-preset to versions 3.2.2 and 12.1.2 across multiple package.json files for improved compatibility ([3921626](https://github.com/visulima/visulima/commit/3921626141fe5da398749bf0ba675f1596f18afb))
* update bundled dependency licenses ([6ace4c6](https://github.com/visulima/visulima/commit/6ace4c69d41fc1fd0a744fbca8ca219ba631b4ab))
* update dependencies across multiple packages to improve compatibility and performance, including upgrading `@anolilab/semantic-release-pnpm` and `@anolilab/semantic-release-preset` to versions 3.2.0 and 12.1.0 respectively, and updating `react`, `react-dom`, and `next` versions to 19.2.1 and 16.0.7 in various package.json files ([aee8fcd](https://github.com/visulima/visulima/commit/aee8fcd796ae9b8d055903260e7150996ea9f53d))
* update homepage URLs to visulima.com/packages/ format ([be42968](https://github.com/visulima/visulima/commit/be42968129df85fb074224435e33135ff44cab91))
* update lock file maintenance ([d83e716](https://github.com/visulima/visulima/commit/d83e71697b75d24704185b66bb521a934d2db02d))
* visulima website ([#591](https://github.com/visulima/visulima/issues/591)) ([59ab2e2](https://github.com/visulima/visulima/commit/59ab2e2befb03e51cd2088956f83d9b87de6d033))
* year update ([47f4105](https://github.com/visulima/visulima/commit/47f410596ce7190cfea36a073db32e0cec50bbcd))

### Code Refactoring

* **boxen:** apply prettier operator-linebreak style ([ae05131](https://github.com/visulima/visulima/commit/ae05131f6be5f20a0e8b1081e9a124cda937ef65))
* ship esm-only; remove deprecated api packages ([6e58351](https://github.com/visulima/visulima/commit/6e58351e73ac7d8f8ec88be4d77871e4de5d5405))

### Tests

* **boxen:** cover retro border shorthand, invalid side throw, title centering and overflow padding ([b735d99](https://github.com/visulima/visulima/commit/b735d99a78ac7fc9e0f460e1dbf6a6d5c79c104c))
* **repo:** add dist runtime + types integration tests ([32ee300](https://github.com/visulima/visulima/commit/32ee300b7184117a0ddf9f9d390f75f8932d5ed9))

### Build System

* emit .js instead of .mjs for esm output ([c8a6026](https://github.com/visulima/visulima/commit/c8a602665a59f0441a61a5a510cdfed9353101e6))
* regenerate bundled-license manifests and types ordering ([af26588](https://github.com/visulima/visulima/commit/af26588d75aaa937fd4862800560bd4070a4878c))

### Continuous Integration

* **fallow:** make fallow:health advisory (--report-only) ([d57148e](https://github.com/visulima/visulima/commit/d57148ea0e3556b4c24d8d336b9fa14987f5dc7d))
* integrate codspeed for benchmark tracking ([e758f3d](https://github.com/visulima/visulima/commit/e758f3da491cc00d3f8bbf10d7ba3fdf8deb5325))


### Dependencies

* **@visulima/colorize:** upgraded to 2.0.0
* **@visulima/path:** upgraded to 3.0.0
* **@visulima/string:** upgraded to 3.0.0

## @visulima/boxen [3.0.0-alpha.15](https://github.com/visulima/visulima/compare/@visulima/boxen@3.0.0-alpha.14...@visulima/boxen@3.0.0-alpha.15) (2026-06-30)

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


### Dependencies

* **@visulima/colorize:** upgraded to 2.0.0-alpha.15
* **@visulima/string:** upgraded to 3.0.0-alpha.18

## @visulima/boxen [3.0.0-alpha.14](https://github.com/visulima/visulima/compare/@visulima/boxen@3.0.0-alpha.13...@visulima/boxen@3.0.0-alpha.14) (2026-06-13)

### Features

* **boxen:** fix fullscreen contract and add bg/vertical-align options ([e526ac9](https://github.com/visulima/visulima/commit/e526ac9ce9cf1153d61f4c142019d3fe8df23d4a))

### Performance Improvements

* **boxen:** memoize terminal-size probe across renders ([0dded4e](https://github.com/visulima/visulima/commit/0dded4e18197982e9078f825c2e74a07ea90cbd4))

### Miscellaneous Chores

* apply safe prettier and eslint formatting ([05120af](https://github.com/visulima/visulima/commit/05120af8c898d18c495575680f01134681e29b65))

### Code Refactoring

* **boxen:** apply prettier operator-linebreak style ([ae05131](https://github.com/visulima/visulima/commit/ae05131f6be5f20a0e8b1081e9a124cda937ef65))

### Build System

* regenerate bundled-license manifests and types ordering ([af26588](https://github.com/visulima/visulima/commit/af26588d75aaa937fd4862800560bd4070a4878c))


### Dependencies

* **@visulima/colorize:** upgraded to 2.0.0-alpha.14
* **@visulima/path:** upgraded to 3.0.0-alpha.13
* **@visulima/string:** upgraded to 3.0.0-alpha.17

## @visulima/boxen [3.0.0-alpha.13](https://github.com/visulima/visulima/compare/@visulima/boxen@3.0.0-alpha.12...@visulima/boxen@3.0.0-alpha.13) (2026-06-04)

### Performance Improvements

* **boxen:** disable esbuild keepNames in prod build ([aa3f457](https://github.com/visulima/visulima/commit/aa3f457076945af0b62685af7a1578e6fe7040a2))


### Dependencies

* **@visulima/string:** upgraded to 3.0.0-alpha.16

## @visulima/boxen [3.0.0-alpha.12](https://github.com/visulima/visulima/compare/@visulima/boxen@3.0.0-alpha.11...@visulima/boxen@3.0.0-alpha.12) (2026-06-04)

### Bug Fixes

* **boxen:** 4 bug fixes + 1 perf ([c7dc1ad](https://github.com/visulima/visulima/commit/c7dc1ad31abcd515d60872358b4d09afcb33e7de))
* **lint:** clear pre-existing eslint rot across packages ([#674](https://github.com/visulima/visulima/issues/674)) ([5354253](https://github.com/visulima/visulima/commit/5354253b163bd50bcefaf8a3fddf831bdb5df32b))

### Miscellaneous Chores

* apply eslint + prettier autofixes across packages ([c1bb784](https://github.com/visulima/visulima/commit/c1bb7848a0d93d0dfe2960c77e3cda22239c79a0))

### Tests

* **boxen:** cover retro border shorthand, invalid side throw, title centering and overflow padding ([b735d99](https://github.com/visulima/visulima/commit/b735d99a78ac7fc9e0f460e1dbf6a6d5c79c104c))


### Dependencies

* **@visulima/colorize:** upgraded to 2.0.0-alpha.13
* **@visulima/path:** upgraded to 3.0.0-alpha.12
* **@visulima/string:** upgraded to 3.0.0-alpha.15

## @visulima/boxen [3.0.0-alpha.11](https://github.com/visulima/visulima/compare/@visulima/boxen@3.0.0-alpha.10...@visulima/boxen@3.0.0-alpha.11) (2026-05-27)

### Bug Fixes

* **storage-client:** percent-encode user fields in defaultFingerprint ([7c78a0f](https://github.com/visulima/visulima/commit/7c78a0f9512e2a673b941d80839e9f1e86b7b5d0))

### Miscellaneous Chores

* **boxen:** apply prettier and eslint quote-style auto-fix ([6be7d00](https://github.com/visulima/visulima/commit/6be7d00db2ef5054354f05c834548155e2011661))
* **boxen:** housekeeping cleanup ([ce659c2](https://github.com/visulima/visulima/commit/ce659c25510a511e43aa8075e08b77a2f60fb16d))
* **boxen:** upgrade packem to 2.0.0-alpha.76 ([0966324](https://github.com/visulima/visulima/commit/09663243bd8980c1ce709901ee5c5786adcf3cee))
* **ci-stability:** green CI across vis, native, lint, tests, attw ([#651](https://github.com/visulima/visulima/issues/651)) ([d4eb684](https://github.com/visulima/visulima/commit/d4eb684b5f75c818c9251048c605a0ed54a268e3))
* re-sort workspace package.json files via vis sort-package-json ([f625696](https://github.com/visulima/visulima/commit/f625696cfac974325774b3243e1a83c3d23acbd7))
* **repo:** apply eslint --fix and prettier --fix across packages ([#650](https://github.com/visulima/visulima/issues/650)) ([2e26a84](https://github.com/visulima/visulima/commit/2e26a84774f218f21345e9a8ecd68236b6542743)), closes [#620](https://github.com/visulima/visulima/issues/620)
* simplify pnpm-workspace packages list ([7cab221](https://github.com/visulima/visulima/commit/7cab221163632d9b7aa044a6f88c49083103a869))
* **terminal:** apply prettier and eslint formatting sweep ([15fd89c](https://github.com/visulima/visulima/commit/15fd89c677eea60866e08e4fd5f5a6bc8f3bd2e5))

### Tests

* **repo:** add dist runtime + types integration tests ([32ee300](https://github.com/visulima/visulima/commit/32ee300b7184117a0ddf9f9d390f75f8932d5ed9))

### Continuous Integration

* integrate codspeed for benchmark tracking ([e758f3d](https://github.com/visulima/visulima/commit/e758f3da491cc00d3f8bbf10d7ba3fdf8deb5325))


### Dependencies

* **@visulima/colorize:** upgraded to 2.0.0-alpha.12
* **@visulima/path:** upgraded to 3.0.0-alpha.11
* **@visulima/string:** upgraded to 3.0.0-alpha.14

## @visulima/boxen [3.0.0-alpha.10](https://github.com/visulima/visulima/compare/@visulima/boxen@3.0.0-alpha.9...@visulima/boxen@3.0.0-alpha.10) (2026-04-22)

### Bug Fixes

* **boxen:** resolve eslint and formatting issues ([cff5767](https://github.com/visulima/visulima/commit/cff5767dcd4fb3327fbd59b8d2f41faf73a66292))
* **pail, boxen:** resolve eslint unsafe type issues ([d6e852e](https://github.com/visulima/visulima/commit/d6e852e63f4572a12c31ac44a4ae687c743cf7db))
* Remove JSR configuration generation script and generated jsr.json files ([#616](https://github.com/visulima/visulima/issues/616)) ([533744b](https://github.com/visulima/visulima/commit/533744b103b74896941db5b727173e617a27a63b))
* **terminal:** resolve eslint and formatting issues ([12ef283](https://github.com/visulima/visulima/commit/12ef283684d1808fbcfe44077a0cfe8324801485))
* **terminal:** resolve eslint and formatting issues ([8f30389](https://github.com/visulima/visulima/commit/8f30389deb9ff81e7afce0aa064ef11fcb179f23))

### Miscellaneous Chores

* **boxen:** apply formatter and lint fixes ([91844ef](https://github.com/visulima/visulima/commit/91844ef7df194964535500cf0fa5799ae7e16d06))
* **boxen:** apply pending changes ([4cde666](https://github.com/visulima/visulima/commit/4cde666adba97af439798cc44ad72d74bbaa385f))
* **boxen:** enforce curly braces and apply lint fixes ([c7228d8](https://github.com/visulima/visulima/commit/c7228d840b2df4dcb149c71bda00408f933dbe5e))
* bump engines.node to ^22.14.0 || >=24.10.0 ([c3d0931](https://github.com/visulima/visulima/commit/c3d0931d1504e4f21ebf50ea680cfa7ce4ba15ce))
* fixed jsr.json ([5d85e51](https://github.com/visulima/visulima/commit/5d85e5179de38e284ec433b14d77c71a1619c8d6))

## @visulima/boxen [3.0.0-alpha.9](https://github.com/visulima/visulima/compare/@visulima/boxen@3.0.0-alpha.8...@visulima/boxen@3.0.0-alpha.9) (2026-04-08)

### Bug Fixes

* **boxen:** remove remaining eslint suppressions with proper code fixes ([da594ee](https://github.com/visulima/visulima/commit/da594ee2403c03886137293c69e87944feba01a5))
* **boxen:** resolve eslint errors ([69daf5d](https://github.com/visulima/visulima/commit/69daf5d9d50a208e5c1bf17f91990f5bc465b9ac))

### Miscellaneous Chores

* **boxen:** add tsconfig.eslint.json for type-aware linting ([0cbef9d](https://github.com/visulima/visulima/commit/0cbef9dc94e8136433e3d01760f2f81abb583935))
* **boxen:** apply auto-fix formatting ([6e0e929](https://github.com/visulima/visulima/commit/6e0e929db65279570c27e94ad63c244fa9f039ed))
* **boxen:** apply prettier formatting ([04c86f9](https://github.com/visulima/visulima/commit/04c86f99d10eedaac1727696c86a1f7e39cce2b4))
* **boxen:** migrate .prettierrc.cjs to prettier.config.js ([b18eace](https://github.com/visulima/visulima/commit/b18eace05c6db089931d5323e7034f8f8655aa07))
* **terminal:** remove empty dependency objects from package.json ([562c704](https://github.com/visulima/visulima/commit/562c704e5d90aa2d13eae942ebbdcfeb787c2b46))
* update bundled dependency licenses ([6ace4c6](https://github.com/visulima/visulima/commit/6ace4c69d41fc1fd0a744fbca8ca219ba631b4ab))


### Dependencies

* **@visulima/colorize:** upgraded to 2.0.0-alpha.8
* **@visulima/path:** upgraded to 3.0.0-alpha.8
* **@visulima/string:** upgraded to 3.0.0-alpha.9

## @visulima/boxen [3.0.0-alpha.8](https://github.com/visulima/visulima/compare/@visulima/boxen@3.0.0-alpha.7...@visulima/boxen@3.0.0-alpha.8) (2026-03-26)

### Features

* **web:** auto-generate packages page from workspace metadata ([623e520](https://github.com/visulima/visulima/commit/623e5207693a7fe720f5f2f179593a3654c880e3))

### Miscellaneous Chores

* update homepage URLs to visulima.com/packages/ format ([be42968](https://github.com/visulima/visulima/commit/be42968129df85fb074224435e33135ff44cab91))


### Dependencies

* **@visulima/colorize:** upgraded to 2.0.0-alpha.7
* **@visulima/path:** upgraded to 3.0.0-alpha.7
* **@visulima/string:** upgraded to 3.0.0-alpha.8

## @visulima/boxen [3.0.0-alpha.7](https://github.com/visulima/visulima/compare/@visulima/boxen@3.0.0-alpha.6...@visulima/boxen@3.0.0-alpha.7) (2026-03-26)

### Bug Fixes

* **boxen:** use workspace:* for internal [@visulima](https://github.com/visulima) deps ([e413000](https://github.com/visulima/visulima/commit/e413000f12a46a452568b18868d39e60db249afd))
* **web:** improve build setup with incremental stats caching and prod install ([fe33e75](https://github.com/visulima/visulima/commit/fe33e75827586779b4b3a0c6d57b39f889ee6207))

### Miscellaneous Chores

* **boxen:** migrate deps to pnpm catalogs ([869ea80](https://github.com/visulima/visulima/commit/869ea8004d7fd96253d7eb8dfa004f3880b48303))
* **boxen:** update dependencies ([a06e27a](https://github.com/visulima/visulima/commit/a06e27ac2d27942e729d9aa18be54fed6b2c6742))
* visulima website ([#591](https://github.com/visulima/visulima/issues/591)) ([59ab2e2](https://github.com/visulima/visulima/commit/59ab2e2befb03e51cd2088956f83d9b87de6d033))


### Dependencies

* **@visulima/colorize:** upgraded to 2.0.0-alpha.6
* **@visulima/path:** upgraded to 3.0.0-alpha.6
* **@visulima/string:** upgraded to 3.0.0-alpha.7

## @visulima/boxen [3.0.0-alpha.6](https://github.com/visulima/visulima/compare/@visulima/boxen@3.0.0-alpha.5...@visulima/boxen@3.0.0-alpha.6) (2026-03-06)

### Bug Fixes

* **boxen:** update packem to 2.0.0-alpha.54 ([3d70a31](https://github.com/visulima/visulima/commit/3d70a315c440175171399546afa78ca0cdb4e13c))

### Documentation

* **boxen,command-line-args,tabular,is-ansi-color-supported,disposable-email-domains:** add comprehensive Fumadocs documentation ([95e0578](https://github.com/visulima/visulima/commit/95e057833978dfeeb9f2768269e36862572539db))

### Miscellaneous Chores

* **boxen:** update dependencies ([7853ee6](https://github.com/visulima/visulima/commit/7853ee64c78974efe7097fc03fc11a60381c1cb6))
* **boxen:** update dependencies ([90b472d](https://github.com/visulima/visulima/commit/90b472dca27b89cd20d2aafe2d36a35ce1f33bc9))
* **terminal:** update dependencies ([a5bb91a](https://github.com/visulima/visulima/commit/a5bb91a66f2be2ade485d586156a54c347a23cc9))
* update lock file maintenance ([d83e716](https://github.com/visulima/visulima/commit/d83e71697b75d24704185b66bb521a934d2db02d))
* year update ([47f4105](https://github.com/visulima/visulima/commit/47f410596ce7190cfea36a073db32e0cec50bbcd))


### Dependencies

* **@visulima/colorize:** upgraded to 2.0.0-alpha.5
* **@visulima/path:** upgraded to 3.0.0-alpha.5
* **@visulima/string:** upgraded to 3.0.0-alpha.6

## @visulima/boxen [3.0.0-alpha.5](https://github.com/visulima/visulima/compare/@visulima/boxen@3.0.0-alpha.4...@visulima/boxen@3.0.0-alpha.5) (2025-12-27)

### Bug Fixes

* **boxen:** update package files ([173adef](https://github.com/visulima/visulima/commit/173adef0a39db7e4773bff77d08a7d2371ce83b8))


### Dependencies

* **@visulima/colorize:** upgraded to 2.0.0-alpha.4
* **@visulima/path:** upgraded to 3.0.0-alpha.4
* **@visulima/string:** upgraded to 3.0.0-alpha.5

## @visulima/boxen [3.0.0-alpha.4](https://github.com/visulima/visulima/compare/@visulima/boxen@3.0.0-alpha.3...@visulima/boxen@3.0.0-alpha.4) (2025-12-13)

### Miscellaneous Chores

* fixed project.json names and schema path ([964722f](https://github.com/visulima/visulima/commit/964722f691db205c7edb9aa6db29e849a647500b))


### Dependencies

* **@visulima/string:** upgraded to 3.0.0-alpha.4

## @visulima/boxen [3.0.0-alpha.3](https://github.com/visulima/visulima/compare/@visulima/boxen@3.0.0-alpha.2...@visulima/boxen@3.0.0-alpha.3) (2025-12-11)

### Bug Fixes

* update package OG images across multiple packages ([f08e4dd](https://github.com/visulima/visulima/commit/f08e4dd2b105ccb29c8412020a9c2be36d6c1e9e))


### Dependencies

* **@visulima/colorize:** upgraded to 2.0.0-alpha.3
* **@visulima/path:** upgraded to 3.0.0-alpha.3
* **@visulima/string:** upgraded to 3.0.0-alpha.3

## @visulima/boxen [3.0.0-alpha.2](https://github.com/visulima/visulima/compare/@visulima/boxen@3.0.0-alpha.1...@visulima/boxen@3.0.0-alpha.2) (2025-12-08)


### Dependencies

* **@visulima/string:** upgraded to 3.0.0-alpha.2

## @visulima/boxen [3.0.0-alpha.1](https://github.com/visulima/visulima/compare/@visulima/boxen@2.0.10...@visulima/boxen@3.0.0-alpha.1) (2025-12-07)

### ⚠ BREAKING CHANGES

* change min node version to 22.13

### Bug Fixes

* add new package image, fixed readme rendering on npm, fixed building of packages ([b790ba2](https://github.com/visulima/visulima/commit/b790ba253ea07fef83528fd822a678facf021b5f))
* update Node.js engine version requirement to >=22.13 in multiple package.json files for improved compatibility ([b828e9a](https://github.com/visulima/visulima/commit/b828e9aeaebfc798eecddccd90e6ec7560c6d36a))
* update package.json description and keywords ([#578](https://github.com/visulima/visulima/issues/578)) ([154709c](https://github.com/visulima/visulima/commit/154709c05e71d1ffd3e360b27e12febd817912f0))

### Miscellaneous Chores

* moved all packages into groups ([0615e9d](https://github.com/visulima/visulima/commit/0615e9d14a8a886e11da529ce150cf31ca973c10))
* update @anolilab/semantic-release-pnpm and @anolilab/semantic-release-preset to versions 3.2.2 and 12.1.2 across multiple package.json files for improved compatibility ([3921626](https://github.com/visulima/visulima/commit/3921626141fe5da398749bf0ba675f1596f18afb))
* update dependencies across multiple packages to improve compatibility and performance, including upgrading `@anolilab/semantic-release-pnpm` and `@anolilab/semantic-release-preset` to versions 3.2.0 and 12.1.0 respectively, and updating `react`, `react-dom`, and `next` versions to 19.2.1 and 16.0.7 in various package.json files ([aee8fcd](https://github.com/visulima/visulima/commit/aee8fcd796ae9b8d055903260e7150996ea9f53d))


### Dependencies

* **@visulima/string:** upgraded to 3.0.0-alpha.1

## @visulima/boxen [2.0.10](https://github.com/visulima/visulima/compare/@visulima/boxen@2.0.9...@visulima/boxen@2.0.10) (2025-11-13)

### Bug Fixes

* bump packem, to fix minified version of the code ([2a36ceb](https://github.com/visulima/visulima/commit/2a36ceb09251b0ca1178701a26547a871ed717a7))


### Dependencies

* **@visulima/colorize:** upgraded to 1.4.29
* **@visulima/path:** upgraded to 2.0.5
* **@visulima/string:** upgraded to 2.0.6

## @visulima/boxen [2.0.9](https://github.com/visulima/visulima/compare/@visulima/boxen@2.0.8...@visulima/boxen@2.0.9) (2025-11-12)

### Bug Fixes

* update package configurations and TypeScript definitions ([b59aa59](https://github.com/visulima/visulima/commit/b59aa59dac1508216b944f4b917fb4a7ab1f70a4))

### Miscellaneous Chores

* Add jsr file to all packages for release ([#565](https://github.com/visulima/visulima/issues/565)) ([ec91652](https://github.com/visulima/visulima/commit/ec91652b4e4112adf14ba152c1239a7703ba425a))
* update license files and clean up TypeScript definitions ([fe668cc](https://github.com/visulima/visulima/commit/fe668cc26de23591d4df54a0954455ebbe31b22d))


### Dependencies

* **@visulima/colorize:** upgraded to 1.4.28
* **@visulima/path:** upgraded to 2.0.4
* **@visulima/string:** upgraded to 2.0.5

## @visulima/boxen [2.0.8](https://github.com/visulima/visulima/compare/@visulima/boxen@2.0.7...@visulima/boxen@2.0.8) (2025-11-07)

### Bug Fixes

* update TypeScript configurations and improve linting across multiple packages ([6f25ec7](https://github.com/visulima/visulima/commit/6f25ec7841da7246f8f9166efc5292a7089d37ee))

### Miscellaneous Chores

* update npm and pnpm configurations for monorepo optimization ([#564](https://github.com/visulima/visulima/issues/564)) ([5512b42](https://github.com/visulima/visulima/commit/5512b42f672c216b6a3c9e39035199a4ebd9a4b8))
* update package.json files and pnpm-lock.yaml ([95d9f5b](https://github.com/visulima/visulima/commit/95d9f5b607105d05a006deadb4379e89f06dfe99))


### Dependencies

* **@visulima/colorize:** upgraded to 1.4.27
* **@visulima/path:** upgraded to 2.0.3
* **@visulima/string:** upgraded to 2.0.4

## @visulima/boxen [2.0.7](https://github.com/visulima/visulima/compare/@visulima/boxen@2.0.6...@visulima/boxen@2.0.7) (2025-11-05)

### Bug Fixes

* update dependencies across multiple packages ([36a47f2](https://github.com/visulima/visulima/commit/36a47f26d65d25a7b4d8371186710e7d0ab61a2b))

### Miscellaneous Chores

* update dependencies across multiple packages ([c526462](https://github.com/visulima/visulima/commit/c52646260c2ae8bbf85692e642f305f47a158d4e))


### Dependencies

* **@visulima/colorize:** upgraded to 1.4.26
* **@visulima/path:** upgraded to 2.0.2
* **@visulima/string:** upgraded to 2.0.3

## @visulima/boxen [2.0.6](https://github.com/visulima/visulima/compare/@visulima/boxen@2.0.5...@visulima/boxen@2.0.6) (2025-10-22)

### Miscellaneous Chores

* update package dependencies and configurations ([7bfe7e7](https://github.com/visulima/visulima/commit/7bfe7e71869580900aab50efb064b4293994ed9a))


### Dependencies

* **@visulima/string:** upgraded to 2.0.2

## @visulima/boxen [2.0.5](https://github.com/visulima/visulima/compare/@visulima/boxen@2.0.4...@visulima/boxen@2.0.5) (2025-10-21)

### Bug Fixes

* allow node v25 and updated dev deps ([8158cc5](https://github.com/visulima/visulima/commit/8158cc53ec92bd0331e8c6bd0fcbc8ab61b9320f))

### Miscellaneous Chores

* **deps:** update package versions and dependencies ([88d8d32](https://github.com/visulima/visulima/commit/88d8d32c4629a7a06c8770369191da2cc81087cc))
* update license years and add validation rules ([b97811e](https://github.com/visulima/visulima/commit/b97811ed2d253d908c0d86b4579a0a6bc33673a8))
* update package dependencies across multiple packages ([17e3f23](https://github.com/visulima/visulima/commit/17e3f2377c8a3f98e2eed2192c5adaf6e32558b5))


### Dependencies

* **@visulima/colorize:** upgraded to 1.4.25
* **@visulima/path:** upgraded to 2.0.1
* **@visulima/string:** upgraded to 2.0.1

## @visulima/boxen [2.0.4](https://github.com/visulima/visulima/compare/@visulima/boxen@2.0.3...@visulima/boxen@2.0.4) (2025-10-15)

### Bug Fixes

* add Prettier configuration and update ESLint settings for improved code formatting ([0039641](https://github.com/visulima/visulima/commit/0039641662fd2e9f55f07e4956666aac9e943bca))
* update @visulima/packem to 2.0.0-alpha.32 across multiple packages for improved compatibility ([27b346e](https://github.com/visulima/visulima/commit/27b346eaa1c0fb0e420d9a9824482028307f4249))

### Miscellaneous Chores

* update package dependencies across multiple packages for improved compatibility and performance ([9567591](https://github.com/visulima/visulima/commit/9567591c415da3002f3a4fe08f8caf7ce01ca5f7))
* update package.json and pnpm-lock.yaml to include publint@0.3.12 and adjust build/test commands to exclude shared-utils ([1f7b3c0](https://github.com/visulima/visulima/commit/1f7b3c0381d77edfeec80ea1bf57b3469e929414))


### Dependencies

* **@visulima/colorize:** upgraded to 1.4.24
* **@visulima/path:** upgraded to 2.0.0
* **@visulima/string:** upgraded to 2.0.0

## @visulima/boxen [2.0.3](https://github.com/visulima/visulima/compare/@visulima/boxen@2.0.2...@visulima/boxen@2.0.3) (2025-09-12)


### Dependencies

* **@visulima/string:** upgraded to 1.5.2

## @visulima/boxen [2.0.2](https://github.com/visulima/visulima/compare/@visulima/boxen@2.0.1...@visulima/boxen@2.0.2) (2025-06-04)


### Dependencies

* **@visulima/colorize:** upgraded to 1.4.23
* **@visulima/path:** upgraded to 1.4.0
* **@visulima/string:** upgraded to 1.5.1

## @visulima/boxen [2.0.1](https://github.com/visulima/visulima/compare/@visulima/boxen@2.0.0...@visulima/boxen@2.0.1) (2025-06-03)

### Miscellaneous Chores

* update ESLint configuration and dependencies ([1cf0391](https://github.com/visulima/visulima/commit/1cf0391cf67757844387b4d98b1f28d458e7f233))


### Dependencies

* **@visulima/string:** upgraded to 1.5.0

## @visulima/boxen [2.0.0](https://github.com/visulima/visulima/compare/@visulima/boxen@1.0.31...@visulima/boxen@2.0.0) (2025-06-01)

### ⚠ BREAKING CHANGES

* **boxen:** Changed wrap-ansi, string-width to @visulima/string, changed min version of node to 20.18

### Features

* **boxen:** changing wrap-ansi, string-width to @visulima/string ([#505](https://github.com/visulima/visulima/issues/505)) ([133510d](https://github.com/visulima/visulima/commit/133510da7409d7a67c8a423432f60b3df307331b))

## @visulima/boxen [1.0.31](https://github.com/visulima/visulima/compare/@visulima/boxen@1.0.30...@visulima/boxen@1.0.31) (2025-05-30)

### Bug Fixes

* **boxen:** update dependencies ([2604613](https://github.com/visulima/visulima/commit/26046137036cfd7b2fbe27221f1132896fd2cc5e))

### Miscellaneous Chores

* remove quick-format-unescaped dependency from package.json ([059c35d](https://github.com/visulima/visulima/commit/059c35d1c8a861b2c8f2406fc2040ed309d7fd32))
* updated dev dependencies ([2433ed5](https://github.com/visulima/visulima/commit/2433ed5fb662e0303c37edee8ddc21b46c21263f))


### Dependencies

* **@visulima/colorize:** upgraded to 1.4.22
* **@visulima/path:** upgraded to 1.3.6

## @visulima/boxen [1.0.30](https://github.com/visulima/visulima/compare/@visulima/boxen@1.0.29...@visulima/boxen@1.0.30) (2025-03-07)

### Bug Fixes

* updated @visulima/packem and other dev deps, for better bundling size ([e940581](https://github.com/visulima/visulima/commit/e9405812201594e54dd81d17ddb74177df5f3c24))

### Miscellaneous Chores

* updated dev dependencies ([487a976](https://github.com/visulima/visulima/commit/487a976932dc7c39edfc19ffd3968960ff338066))


### Dependencies

* **@visulima/colorize:** upgraded to 1.4.21
* **@visulima/path:** upgraded to 1.3.5

## @visulima/boxen [1.0.29](https://github.com/visulima/visulima/compare/@visulima/boxen@1.0.28...@visulima/boxen@1.0.29) (2025-01-25)

### Bug Fixes

* fixed wrong node version range in package.json ([4ae2929](https://github.com/visulima/visulima/commit/4ae292984681c71a770e4d4560432f7b7c5a141a))

### Miscellaneous Chores

* fixed typescript url ([fe65a8c](https://github.com/visulima/visulima/commit/fe65a8c0296ece7ee26474c70d065b06d4d0da89))
* updated all dev dependencies ([37fb298](https://github.com/visulima/visulima/commit/37fb298b2af7c63be64252024e54bb3af6ddabec))


### Dependencies

* **@visulima/colorize:** upgraded to 1.4.20
* **@visulima/path:** upgraded to 1.3.4

## @visulima/boxen [1.0.28](https://github.com/visulima/visulima/compare/@visulima/boxen@1.0.27...@visulima/boxen@1.0.28) (2025-01-22)

### Styles

* cs fixes ([f615a6a](https://github.com/visulima/visulima/commit/f615a6af4c0d4fb9ec054565fe5c93e88df487e9))

### Miscellaneous Chores

* updated all dev dependencies and all dependencies in the app folder ([87f4ccb](https://github.com/visulima/visulima/commit/87f4ccbf9f7900ec5b56f3c1477bc4a0ef571bcf))


### Dependencies

* **@visulima/colorize:** upgraded to 1.4.19

## @visulima/boxen [1.0.27](https://github.com/visulima/visulima/compare/@visulima/boxen@1.0.26...@visulima/boxen@1.0.27) (2025-01-13)


### Dependencies

* **@visulima/colorize:** upgraded to 1.4.18
* **@visulima/path:** upgraded to 1.3.3

## @visulima/boxen [1.0.26](https://github.com/visulima/visulima/compare/@visulima/boxen@1.0.25...@visulima/boxen@1.0.26) (2025-01-12)

### Bug Fixes

* updated @visulima/packem, and all other dev dependencies ([7797a1c](https://github.com/visulima/visulima/commit/7797a1c3e6f1fc532895247bd88285a8a9883c40))


### Dependencies

* **@visulima/colorize:** upgraded to 1.4.17
* **@visulima/path:** upgraded to 1.3.2

## @visulima/boxen [1.0.25](https://github.com/visulima/visulima/compare/@visulima/boxen@1.0.24...@visulima/boxen@1.0.25) (2025-01-08)


### Dependencies

* **@visulima/colorize:** upgraded to 1.4.16
* **@visulima/path:** upgraded to 1.3.1

## @visulima/boxen [1.0.24](https://github.com/visulima/visulima/compare/@visulima/boxen@1.0.23...@visulima/boxen@1.0.24) (2025-01-08)


### Dependencies

* **@visulima/colorize:** upgraded to 1.4.15
* **@visulima/path:** upgraded to 1.3.0

## @visulima/boxen [1.0.23](https://github.com/visulima/visulima/compare/@visulima/boxen@1.0.22...@visulima/boxen@1.0.23) (2024-12-31)

### Miscellaneous Chores

* updated dev dependencies ([9de2eab](https://github.com/visulima/visulima/commit/9de2eab91e95c8b9289d12f863a5167218770650))


### Dependencies

* **@visulima/colorize:** upgraded to 1.4.14
* **@visulima/path:** upgraded to 1.2.0

## @visulima/boxen [1.0.22](https://github.com/visulima/visulima/compare/@visulima/boxen@1.0.21...@visulima/boxen@1.0.22) (2024-12-12)

### Bug Fixes

* added missing placeholder variables into LICENSE.md file ([cef32c6](https://github.com/visulima/visulima/commit/cef32c6eb19dc3215a835e848ef12223a8fa05e0))
* allow node v23 ([8ca929a](https://github.com/visulima/visulima/commit/8ca929af311ce8036cbbfde68b6db05381b860a5))
* allowed node 23, updated dev dependencies ([f99d34e](https://github.com/visulima/visulima/commit/f99d34e01f6b13be8586a1b5d37dc8b8df0a5817))
* **boxen:** fixed wrong error message for textColor ([7d489b3](https://github.com/visulima/visulima/commit/7d489b33ea2441c0543cd14be33fa36383dce71d))
* updated packem to v1.8.2 ([23f869b](https://github.com/visulima/visulima/commit/23f869b4120856cc97e2bffa6d508e2ae30420ea))
* updated packem to v1.9.2 ([47bdc2d](https://github.com/visulima/visulima/commit/47bdc2dfaeca4e7014dbe7772eae2fdf8c8b35bb))

### Styles

* cs fixes ([46d31e0](https://github.com/visulima/visulima/commit/46d31e082e1865262bf380859c14fabd28ff456d))

### Miscellaneous Chores

* **boxen:** fixed test ([b139f80](https://github.com/visulima/visulima/commit/b139f80b036d8629f5fa6621197879936443e4d0))
* updated dev dependencies ([a916944](https://github.com/visulima/visulima/commit/a916944b888bb34c34b0c54328b38d29e4399857))


### Dependencies

* **@visulima/colorize:** upgraded to 1.4.13
* **@visulima/path:** upgraded to 1.1.2

## @visulima/boxen [1.0.21](https://github.com/visulima/visulima/compare/@visulima/boxen@1.0.20...@visulima/boxen@1.0.21) (2024-10-05)


### Dependencies

* **@visulima/colorize:** upgraded to 1.4.12
* **@visulima/path:** upgraded to 1.1.1

## @visulima/boxen [1.0.20](https://github.com/visulima/visulima/compare/@visulima/boxen@1.0.19...@visulima/boxen@1.0.20) (2024-10-05)

### Bug Fixes

* updated dev dependencies, updated packem to v1.0.7, fixed naming of some lint config files ([c071a9c](https://github.com/visulima/visulima/commit/c071a9c8e129014a962ff654a16f302ca18a5c67))


### Dependencies

* **@visulima/colorize:** upgraded to 1.4.11
* **@visulima/path:** upgraded to 1.1.0

## @visulima/boxen [1.0.19](https://github.com/visulima/visulima/compare/@visulima/boxen@1.0.18...@visulima/boxen@1.0.19) (2024-09-24)

### Bug Fixes

* update packem to v1 ([05f3bc9](https://github.com/visulima/visulima/commit/05f3bc960df10a1602e24f9066e2b0117951a877))
* updated esbuild from v0.23 to v0.24 ([3793010](https://github.com/visulima/visulima/commit/3793010d0d549c0d41f85dea04b8436251be5fe8))

### Miscellaneous Chores

* updated dev dependencies ([05edb67](https://github.com/visulima/visulima/commit/05edb671285b1cc42875223314b24212e6a12588))


### Dependencies

* **@visulima/colorize:** upgraded to 1.4.10
* **@visulima/path:** upgraded to 1.0.9

## @visulima/boxen [1.0.18](https://github.com/visulima/visulima/compare/@visulima/boxen@1.0.17...@visulima/boxen@1.0.18) (2024-09-12)

### Bug Fixes

* **boxen:** moved from tsup to packem ([ef8c01a](https://github.com/visulima/visulima/commit/ef8c01add9f6908b7003e6b5fc72df4804c14585))

### Styles

* **boxen:** cs fix ([ff34cb6](https://github.com/visulima/visulima/commit/ff34cb69dd5db5ac471782738f8925415369be71))

## @visulima/boxen [1.0.17](https://github.com/visulima/visulima/compare/@visulima/boxen@1.0.16...@visulima/boxen@1.0.17) (2024-09-11)


### Dependencies

* **@visulima/colorize:** upgraded to 1.4.9
* **@visulima/path:** upgraded to 1.0.8

## @visulima/boxen [1.0.16](https://github.com/visulima/visulima/compare/@visulima/boxen@1.0.15...@visulima/boxen@1.0.16) (2024-09-07)


### Dependencies

* **@visulima/colorize:** upgraded to 1.4.8
* **@visulima/path:** upgraded to 1.0.7

## @visulima/boxen [1.0.15](https://github.com/visulima/visulima/compare/@visulima/boxen@1.0.14...@visulima/boxen@1.0.15) (2024-09-07)


### Dependencies

* **@visulima/colorize:** upgraded to 1.4.7
* **@visulima/path:** upgraded to 1.0.6

## @visulima/boxen [1.0.14](https://github.com/visulima/visulima/compare/@visulima/boxen@1.0.13...@visulima/boxen@1.0.14) (2024-08-30)

### Miscellaneous Chores

* updated dev dependencies ([45c2a76](https://github.com/visulima/visulima/commit/45c2a76bc974ecb2c6b172c3af03373d4cc6a5ce))


### Dependencies

* **@visulima/colorize:** upgraded to 1.4.6
* **@visulima/path:** upgraded to 1.0.5

## @visulima/boxen [1.0.13](https://github.com/visulima/visulima/compare/@visulima/boxen@1.0.12...@visulima/boxen@1.0.13) (2024-08-04)


### Dependencies

* **@visulima/colorize:** upgraded to 1.4.5
* **@visulima/path:** upgraded to 1.0.4

## @visulima/boxen [1.0.12](https://github.com/visulima/visulima/compare/@visulima/boxen@1.0.11...@visulima/boxen@1.0.12) (2024-08-01)

### Styles

* cs fixes ([6f727ec](https://github.com/visulima/visulima/commit/6f727ec36437384883ca4b764d920cf03ffe44df))
* cs fixes ([ee5ed6f](https://github.com/visulima/visulima/commit/ee5ed6f31bdabcfacdb0d1abd1eff2cc6207cefc))

### Miscellaneous Chores

* added private true into fixture package.json files ([4a9494c](https://github.com/visulima/visulima/commit/4a9494c642fa98f224505a1d231b5af4e73d6c79))
* changed typescript version back to 5.4.5 ([55d28bb](https://github.com/visulima/visulima/commit/55d28bbdc103718d19f844034b38a0e8e5af798a))
* updated dev dependencies ([ac67ec1](https://github.com/visulima/visulima/commit/ac67ec1bcba16175d225958e318199f60b10d179))
* updated dev dependencies and sorted the package.json ([9571572](https://github.com/visulima/visulima/commit/95715725a8ed053ca24fd1405a55205c79342ecb))


### Dependencies

* **@visulima/colorize:** upgraded to 1.4.4
* **@visulima/path:** upgraded to 1.0.3

## @visulima/boxen [1.0.11](https://github.com/visulima/visulima/compare/@visulima/boxen@1.0.10...@visulima/boxen@1.0.11) (2024-07-01)

### Bug Fixes

* update dev-dependency string-width to 7.2.0 ([0cdc4e9](https://github.com/visulima/visulima/commit/0cdc4e969e90ad1713ebacf5285901405dfb5486))

## @visulima/boxen [1.0.10](https://github.com/visulima/visulima/compare/@visulima/boxen@1.0.9...@visulima/boxen@1.0.10) (2024-06-13)

### Miscellaneous Chores

* updated all dev deps ([ef143ce](https://github.com/visulima/visulima/commit/ef143ce2e15952a0910aa5c8bd78d25de9ebd7f3))

### Build System

* fixed found audit error, updated all dev package deps, updated deps in apps and examples ([4c51950](https://github.com/visulima/visulima/commit/4c519500dc5504579d35725572920658999885cb))


### Dependencies

* **@visulima/colorize:** upgraded to 1.4.3

## @visulima/boxen [1.0.9](https://github.com/visulima/visulima/compare/@visulima/boxen@1.0.8...@visulima/boxen@1.0.9) (2024-06-06)


### Bug Fixes

* allow node v22 ([890d457](https://github.com/visulima/visulima/commit/890d4570f18428e2463944813c0c638b3f142803))


### Miscellaneous Chores

* updated dev dependencies ([a2e0504](https://github.com/visulima/visulima/commit/a2e0504dc239049434c2482756ff15bdbaac9b54))



### Dependencies

* **@visulima/colorize:** upgraded to 1.4.2
* **@visulima/path:** upgraded to 1.0.2

## @visulima/boxen [1.0.8](https://github.com/visulima/visulima/compare/@visulima/boxen@1.0.7...@visulima/boxen@1.0.8) (2024-05-24)


### Bug Fixes

* changed pathe to @visulima/path ([#410](https://github.com/visulima/visulima/issues/410)) ([bfe1287](https://github.com/visulima/visulima/commit/bfe1287aff6d28d5dca302fd4d58c1f6234ce0bb))


### Miscellaneous Chores

* changed semantic-release-npm to pnpm ([b6d100a](https://github.com/visulima/visulima/commit/b6d100a2bf3fd026577be48726a37754947f0973))
* fixed wrong named folders to integration, added TEST_PROD_BUILD ([1b826f5](https://github.com/visulima/visulima/commit/1b826f5baf8285847199de9ede8fbdbadf201ad6))
* updated dev dependencies ([abd319c](https://github.com/visulima/visulima/commit/abd319c23576aa1dc751ac874e806bddbc977d51))
* updated dev dependencies ([0767afe](https://github.com/visulima/visulima/commit/0767afe9be83da6698c1343724400171f952599e))



### Dependencies

* **@visulima/colorize:** upgraded to 1.4.1
* **@visulima/path:** upgraded to 1.0.1

## @visulima/boxen [1.0.7](https://github.com/visulima/visulima/compare/@visulima/boxen@1.0.6...@visulima/boxen@1.0.7) (2024-05-03)


### Bug Fixes

* **boxen:** moved cli-boxes into boxen ([25f2e83](https://github.com/visulima/visulima/commit/25f2e8336b6bbe8f0ebb5ce801c8b46f991b71a0))


### Miscellaneous Chores

* **deps:** updated dev deps ([d91ac38](https://github.com/visulima/visulima/commit/d91ac389cea85a6c6bdc8de97905252a6c467abc))
* update dev dependencies ([09c4854](https://github.com/visulima/visulima/commit/09c4854e221fa8b808dfe66d7196d8db2a39b366))
* updated dev dependencies ([d7791e3](https://github.com/visulima/visulima/commit/d7791e327917e438757636573b1e5549a97bba7b))

## @visulima/boxen [1.0.6](https://github.com/visulima/visulima/compare/@visulima/boxen@1.0.5...@visulima/boxen@1.0.6) (2024-04-10)



### Dependencies

* **@visulima/colorize:** upgraded to 1.4.0

## @visulima/boxen [1.0.5](https://github.com/visulima/visulima/compare/@visulima/boxen@1.0.4...@visulima/boxen@1.0.5) (2024-04-09)



### Dependencies

* **@visulima/colorize:** upgraded to 1.3.3

## @visulima/boxen [1.0.4](https://github.com/visulima/visulima/compare/@visulima/boxen@1.0.3...@visulima/boxen@1.0.4) (2024-04-09)


### Styles

* disabled noPropertyAccessFromIndexSignature ([#386](https://github.com/visulima/visulima/issues/386)) ([2250c02](https://github.com/visulima/visulima/commit/2250c02b870a5b37d78d01365105a0777c5728e2))


### Miscellaneous Chores

* downgrade eslint-plugin-vitest ([0162771](https://github.com/visulima/visulima/commit/0162771e6022e4594486a796bc41e91a2d87bcd8))
* updated dev dependencies ([87dee15](https://github.com/visulima/visulima/commit/87dee156e797b5dee2557a09ad32c935d851847c))
* updated dev dependencies ([bf2c635](https://github.com/visulima/visulima/commit/bf2c635859601cc97858226e70f47219eabc213e))
* updated dev dependencies ([f67c7f1](https://github.com/visulima/visulima/commit/f67c7f14ecc328ed91d06d01ac6514e8bce72cb4))



### Dependencies

* **@visulima/colorize:** upgraded to 1.3.2

## @visulima/boxen [1.0.3](https://github.com/visulima/visulima/compare/@visulima/boxen@1.0.2...@visulima/boxen@1.0.3) (2024-03-27)



### Dependencies

* **@visulima/colorize:** upgraded to 1.3.1

## @visulima/boxen [1.0.2](https://github.com/visulima/visulima/compare/@visulima/boxen@1.0.1...@visulima/boxen@1.0.2) (2024-03-26)


### Bug Fixes

* **boxen:** adding cjs and esm package test ([#382](https://github.com/visulima/visulima/issues/382)) ([ac08502](https://github.com/visulima/visulima/commit/ac0850202a40db238358adf3f08c3b7ef3e842ba))


### Miscellaneous Chores

* better code-coverage ([51d8efb](https://github.com/visulima/visulima/commit/51d8efb36b20fb878e128cdbb25d3ac5c81f79f4))
* updated all devDependencies ([133b1ca](https://github.com/visulima/visulima/commit/133b1cac6783bc1ecf8140972ef16bd7b68976f1))
* updated dev dependencies ([5f0bcd6](https://github.com/visulima/visulima/commit/5f0bcd6e6ec6e86303eb7d28d029f062294f3464))
* updated dev dependencies ([130b82c](https://github.com/visulima/visulima/commit/130b82c07879326db4975c7073137a24fc8b5e7a))
* updated dev dependencies ([956b7b3](https://github.com/visulima/visulima/commit/956b7b3a18d9fac12b0ac3b87f99680f169f824e))


### Continuous Integration

* improved vitest and tsup config ([#367](https://github.com/visulima/visulima/issues/367)) ([82fb585](https://github.com/visulima/visulima/commit/82fb585da639c916b770afe6617d735d15a4195c))

## @visulima/boxen [1.0.1](https://github.com/visulima/visulima/compare/@visulima/boxen@1.0.0...@visulima/boxen@1.0.1) (2024-03-09)


### Bug Fixes

* added missing type module to the package.json ([510c5b7](https://github.com/visulima/visulima/commit/510c5b7e9cdca2b6de104d0b6b0f5ad2fbf50956))

## @visulima/boxen 1.0.0 (2024-03-06)


### Features

* new boxen component ([#329](https://github.com/visulima/visulima/issues/329)) ([b40ebed](https://github.com/visulima/visulima/commit/b40ebedccc5743aa3ad748d0aecd0d50373695aa))
