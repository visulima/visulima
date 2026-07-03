## @visulima/tabular [4.0.0](https://github.com/visulima/visulima/compare/@visulima/tabular@3.1.3...@visulima/tabular@4.0.0) (2026-07-03)

### ⚠ BREAKING CHANGES

* change min node version to 22.13

### Features

* **web:** auto-generate packages page from workspace metadata ([623e520](https://github.com/visulima/visulima/commit/623e5207693a7fe720f5f2f179593a3654c880e3))

### Bug Fixes

* add new package image, fixed readme rendering on npm, fixed building of packages ([b790ba2](https://github.com/visulima/visulima/commit/b790ba253ea07fef83528fd822a678facf021b5f))
* **lint:** clear pre-existing eslint rot across packages ([#674](https://github.com/visulima/visulima/issues/674)) ([5354253](https://github.com/visulima/visulima/commit/5354253b163bd50bcefaf8a3fddf831bdb5df32b))
* Remove JSR configuration generation script and generated jsr.json files ([#616](https://github.com/visulima/visulima/issues/616)) ([533744b](https://github.com/visulima/visulima/commit/533744b103b74896941db5b727173e617a27a63b))
* **storage-client:** percent-encode user fields in defaultFingerprint ([7c78a0f](https://github.com/visulima/visulima/commit/7c78a0f9512e2a673b941d80839e9f1e86b7b5d0))
* **tabular:** 3 bug fixes ([37cc0e3](https://github.com/visulima/visulima/commit/37cc0e39b5404ce2bc282517462a0596ccc9a02f)), closes [#cellVerticalPositionCache](https://github.com/visulima/visulima/issues/cellVerticalPositionCache) [#alignCellContentCache](https://github.com/visulima/visulima/issues/alignCellContentCache)
* **tabular:** fix sentinel collision, sanitize hrefs, add column defaults ([358f7d8](https://github.com/visulima/visulima/commit/358f7d85859b2624ce491f28da2ac92dd7c26808))
* **tabular:** properly fix eslint errors in code ([080e133](https://github.com/visulima/visulima/commit/080e1338ec7ad62f9e8968c45c89d19b3861d2be))
* **tabular:** remove remaining eslint suppressions with proper code fixes ([ab4df11](https://github.com/visulima/visulima/commit/ab4df11daa3cb902b30a4a130d6f49fbd191a47b))
* **tabular:** resolve eslint and formatting issues ([1d6f3ce](https://github.com/visulima/visulima/commit/1d6f3cee1134c67a8c0c671b829668efb9a94670))
* **tabular:** resolve eslint and formatting issues ([7e31ca4](https://github.com/visulima/visulima/commit/7e31ca4e292193d8adf94cd47fa6a23a32936ad6))
* **tabular:** resolve eslint errors ([56241e8](https://github.com/visulima/visulima/commit/56241e864ae8cdff5953af813c140b3c4c4e49de))
* **tabular:** route row-height warning to onWarn ([f8af98f](https://github.com/visulima/visulima/commit/f8af98f461c09a453cc42768c273f83314bc2186))
* **tabular:** update package files ([1a263de](https://github.com/visulima/visulima/commit/1a263de3a3bbb34fc0ea088630383fef1a2d3ea7))
* **tabular:** update packem to 2.0.0-alpha.54 ([1ee5965](https://github.com/visulima/visulima/commit/1ee5965bacd3c8df040eb4605e57d2c23fab34a3))
* **tabular:** use workspace:* for internal [@visulima](https://github.com/visulima) deps ([09e45ee](https://github.com/visulima/visulima/commit/09e45eefea41e619a46e37242dfbe0fe2910ed9c))
* **terminal:** resolve eslint and formatting issues ([12ef283](https://github.com/visulima/visulima/commit/12ef283684d1808fbcfe44077a0cfe8324801485))
* **terminal:** resolve eslint and formatting issues ([8f30389](https://github.com/visulima/visulima/commit/8f30389deb9ff81e7afce0aa064ef11fcb179f23))
* update Node.js engine version requirement to >=22.13 in multiple package.json files for improved compatibility ([b828e9a](https://github.com/visulima/visulima/commit/b828e9aeaebfc798eecddccd90e6ec7560c6d36a))
* update package OG images across multiple packages ([f08e4dd](https://github.com/visulima/visulima/commit/f08e4dd2b105ccb29c8412020a9c2be36d6c1e9e))
* **web:** improve build setup with incremental stats caching and prod install ([fe33e75](https://github.com/visulima/visulima/commit/fe33e75827586779b4b3a0c6d57b39f889ee6207))

### Documentation

* **boxen,command-line-args,tabular,is-ansi-color-supported,disposable-email-domains:** add comprehensive Fumadocs documentation ([95e0578](https://github.com/visulima/visulima/commit/95e057833978dfeeb9f2768269e36862572539db))

### Styles

* cs fixes ([2a960bb](https://github.com/visulima/visulima/commit/2a960bb1772c9dc70080e2d75d3a0d827034e294))

### Miscellaneous Chores

* add fallow code-intelligence across all packages ([a3b4821](https://github.com/visulima/visulima/commit/a3b48215002e86fed20f2973038b5d4a0aa1ce04))
* apply eslint + prettier autofixes across packages ([c1bb784](https://github.com/visulima/visulima/commit/c1bb7848a0d93d0dfe2960c77e3cda22239c79a0))
* bump engines.node to ^22.14.0 || >=24.10.0 ([c3d0931](https://github.com/visulima/visulima/commit/c3d0931d1504e4f21ebf50ea680cfa7ce4ba15ce))
* **ci-stability:** green CI across vis, native, lint, tests, attw ([#651](https://github.com/visulima/visulima/issues/651)) ([d4eb684](https://github.com/visulima/visulima/commit/d4eb684b5f75c818c9251048c605a0ed54a268e3))
* **fallow:** resolve dead-code findings ([c4125d5](https://github.com/visulima/visulima/commit/c4125d53e03ac9d90115399634535991927a96cc))
* fixed jsr.json ([5d85e51](https://github.com/visulima/visulima/commit/5d85e5179de38e284ec433b14d77c71a1619c8d6))
* fixed project.json names and schema path ([964722f](https://github.com/visulima/visulima/commit/964722f691db205c7edb9aa6db29e849a647500b))
* moved all packages into groups ([0615e9d](https://github.com/visulima/visulima/commit/0615e9d14a8a886e11da529ce150cf31ca973c10))
* re-sort workspace package.json files via vis sort-package-json ([f625696](https://github.com/visulima/visulima/commit/f625696cfac974325774b3243e1a83c3d23acbd7))
* **release:** @visulima/tabular@4.0.0-alpha.1 [skip ci]\n\n## @visulima/tabular [4.0.0-alpha.1](https://github.com/visulima/visulima/compare/@visulima/tabular@3.1.3...@visulima/tabular@4.0.0-alpha.1) (2025-12-07) ([ea4f2bd](https://github.com/visulima/visulima/commit/ea4f2bdbcae0299eff3345b6f85fa0be7c1e8ee8))
* **release:** @visulima/tabular@4.0.0-alpha.10 [skip ci]\n\n## @visulima/tabular [4.0.0-alpha.10](https://github.com/visulima/visulima/compare/@visulima/tabular@4.0.0-alpha.9...@visulima/tabular@4.0.0-alpha.10) (2026-04-21) ([6ab2542](https://github.com/visulima/visulima/commit/6ab2542e92ab22756d8fd14eedce1d27c459218d))
* **release:** @visulima/tabular@4.0.0-alpha.11 [skip ci]\n\n## @visulima/tabular [4.0.0-alpha.11](https://github.com/visulima/visulima/compare/@visulima/tabular@4.0.0-alpha.10...@visulima/tabular@4.0.0-alpha.11) (2026-04-22) ([4fa9b73](https://github.com/visulima/visulima/commit/4fa9b7324d070a5c3a49ae768a8731f6edc55aae))
* **release:** @visulima/tabular@4.0.0-alpha.12 [skip ci]\n\n## @visulima/tabular [4.0.0-alpha.12](https://github.com/visulima/visulima/compare/@visulima/tabular@4.0.0-alpha.11...@visulima/tabular@4.0.0-alpha.12) (2026-05-27) ([4cecbed](https://github.com/visulima/visulima/commit/4cecbeded4329eac6d22bfaf4fb397b47ca75a10))
* **release:** @visulima/tabular@4.0.0-alpha.13 [skip ci]\n\n## @visulima/tabular [4.0.0-alpha.13](https://github.com/visulima/visulima/compare/@visulima/tabular@4.0.0-alpha.12...@visulima/tabular@4.0.0-alpha.13) (2026-06-04) ([52aa438](https://github.com/visulima/visulima/commit/52aa4380e5409ad438fc4ec1d349c0edde39a4b0))
* **release:** @visulima/tabular@4.0.0-alpha.14 [skip ci]\n\n## @visulima/tabular [4.0.0-alpha.14](https://github.com/visulima/visulima/compare/@visulima/tabular@4.0.0-alpha.13...@visulima/tabular@4.0.0-alpha.14) (2026-06-13) ([055f23f](https://github.com/visulima/visulima/commit/055f23ff0478743a2801bfd6b57da2773b4276ce))
* **release:** @visulima/tabular@4.0.0-alpha.2 [skip ci]\n\n## @visulima/tabular [4.0.0-alpha.2](https://github.com/visulima/visulima/compare/@visulima/tabular@4.0.0-alpha.1...@visulima/tabular@4.0.0-alpha.2) (2025-12-08) ([735629b](https://github.com/visulima/visulima/commit/735629b4cb702d6eec2d715ff45438490cd39200))
* **release:** @visulima/tabular@4.0.0-alpha.3 [skip ci]\n\n## @visulima/tabular [4.0.0-alpha.3](https://github.com/visulima/visulima/compare/@visulima/tabular@4.0.0-alpha.2...@visulima/tabular@4.0.0-alpha.3) (2025-12-11) ([4fe3de8](https://github.com/visulima/visulima/commit/4fe3de83996ede345b9e0310ad1d761977d02eed))
* **release:** @visulima/tabular@4.0.0-alpha.4 [skip ci]\n\n## @visulima/tabular [4.0.0-alpha.4](https://github.com/visulima/visulima/compare/@visulima/tabular@4.0.0-alpha.3...@visulima/tabular@4.0.0-alpha.4) (2025-12-13) ([3d24936](https://github.com/visulima/visulima/commit/3d24936fa33416746fdfe693a073a758f9dd2057))
* **release:** @visulima/tabular@4.0.0-alpha.5 [skip ci]\n\n## @visulima/tabular [4.0.0-alpha.5](https://github.com/visulima/visulima/compare/@visulima/tabular@4.0.0-alpha.4...@visulima/tabular@4.0.0-alpha.5) (2025-12-27) ([4dd9f68](https://github.com/visulima/visulima/commit/4dd9f688a13f20fa2da74b49ba8afd5922fc5cea))
* **release:** @visulima/tabular@4.0.0-alpha.6 [skip ci]\n\n## @visulima/tabular [4.0.0-alpha.6](https://github.com/visulima/visulima/compare/@visulima/tabular@4.0.0-alpha.5...@visulima/tabular@4.0.0-alpha.6) (2026-03-06) ([af5170f](https://github.com/visulima/visulima/commit/af5170fab758925e84758783b52b73c3e6e0a8cb))
* **release:** @visulima/tabular@4.0.0-alpha.7 [skip ci]\n\n## @visulima/tabular [4.0.0-alpha.7](https://github.com/visulima/visulima/compare/@visulima/tabular@4.0.0-alpha.6...@visulima/tabular@4.0.0-alpha.7) (2026-03-26) ([10c540a](https://github.com/visulima/visulima/commit/10c540a46b1f4eaa616d9dd50a3d1ccf3a60e608))
* **release:** @visulima/tabular@4.0.0-alpha.8 [skip ci]\n\n## @visulima/tabular [4.0.0-alpha.8](https://github.com/visulima/visulima/compare/@visulima/tabular@4.0.0-alpha.7...@visulima/tabular@4.0.0-alpha.8) (2026-03-26) ([1001ac7](https://github.com/visulima/visulima/commit/1001ac756668023dbe18a06d6e4252328a808449))
* **release:** @visulima/tabular@4.0.0-alpha.9 [skip ci]\n\n## @visulima/tabular [4.0.0-alpha.9](https://github.com/visulima/visulima/compare/@visulima/tabular@4.0.0-alpha.8...@visulima/tabular@4.0.0-alpha.9) (2026-04-08) ([b36703f](https://github.com/visulima/visulima/commit/b36703f2f39c94868a46376d9e8bb88a89ce7df5))
* **repo:** apply eslint --fix and prettier --fix across packages ([#650](https://github.com/visulima/visulima/issues/650)) ([2e26a84](https://github.com/visulima/visulima/commit/2e26a84774f218f21345e9a8ecd68236b6542743)), closes [#620](https://github.com/visulima/visulima/issues/620)
* simplify pnpm-workspace packages list ([7cab221](https://github.com/visulima/visulima/commit/7cab221163632d9b7aa044a6f88c49083103a869))
* sorted package.json ([b47c545](https://github.com/visulima/visulima/commit/b47c545591600fdab17d5cd3a3fbc68b61e199da))
* **tabular:** add tsconfig.eslint.json for type-aware linting ([8992e0d](https://github.com/visulima/visulima/commit/8992e0dc0e239f7df169d1e8ae7cbcbea6e36ca0))
* **tabular:** apply pending changes ([8e15081](https://github.com/visulima/visulima/commit/8e150817cb763be80b43ec5ff3789d108817480c))
* **tabular:** apply prettier and eslint quote-style auto-fix ([20b94d4](https://github.com/visulima/visulima/commit/20b94d4d1ef348af8bc9f59e684c90751d8ef3de))
* **tabular:** apply prettier formatting ([0a4c1af](https://github.com/visulima/visulima/commit/0a4c1afdd98ad09eecf1e8b30e45e7f9f01f2731))
* **tabular:** enforce curly braces and apply lint fixes ([4330604](https://github.com/visulima/visulima/commit/43306043ca17bb0c1dfcff94b4849ef493e536af))
* **tabular:** housekeeping cleanup ([a323806](https://github.com/visulima/visulima/commit/a3238064a8fc2da14d69d0be3e219773dc289106))
* **tabular:** migrate .prettierrc.cjs to prettier.config.js ([9eadc5b](https://github.com/visulima/visulima/commit/9eadc5bbafd2ad891e2ecaf7ad4b29b4d0b0b02f))
* **tabular:** migrate deps to pnpm catalogs ([3586a84](https://github.com/visulima/visulima/commit/3586a84cd27b48aaf6ba330cf5f62c50ef9d79df))
* **tabular:** update dependencies ([9cd0d59](https://github.com/visulima/visulima/commit/9cd0d592e798f7878794a579e28dfd8780a23ba8))
* **tabular:** update dependencies ([333549a](https://github.com/visulima/visulima/commit/333549aa68f8b9a217b3214959e1c4f97e6759fb))
* **tabular:** update dependencies ([ca03869](https://github.com/visulima/visulima/commit/ca03869a6a6141be5d40022da0f0685ca444f094))
* **tabular:** upgrade packem to 2.0.0-alpha.76 ([35567ad](https://github.com/visulima/visulima/commit/35567adb878433b4dbd319f330e11f9517802bfe))
* **terminal:** apply prettier and eslint formatting sweep ([15fd89c](https://github.com/visulima/visulima/commit/15fd89c677eea60866e08e4fd5f5a6bc8f3bd2e5))
* **terminal:** remove empty dependency objects from package.json ([562c704](https://github.com/visulima/visulima/commit/562c704e5d90aa2d13eae942ebbdcfeb787c2b46))
* **terminal:** update dependencies ([a5bb91a](https://github.com/visulima/visulima/commit/a5bb91a66f2be2ade485d586156a54c347a23cc9))
* update @anolilab/semantic-release-pnpm and @anolilab/semantic-release-preset to versions 3.2.2 and 12.1.2 across multiple package.json files for improved compatibility ([3921626](https://github.com/visulima/visulima/commit/3921626141fe5da398749bf0ba675f1596f18afb))
* update bundled dependency licenses ([6ace4c6](https://github.com/visulima/visulima/commit/6ace4c69d41fc1fd0a744fbca8ca219ba631b4ab))
* update dependencies across multiple packages to improve compatibility and performance, including upgrading `@anolilab/semantic-release-pnpm` and `@anolilab/semantic-release-preset` to versions 3.2.0 and 12.1.0 respectively, and updating `react`, `react-dom`, and `next` versions to 19.2.1 and 16.0.7 in various package.json files ([aee8fcd](https://github.com/visulima/visulima/commit/aee8fcd796ae9b8d055903260e7150996ea9f53d))
* update lock file maintenance ([d83e716](https://github.com/visulima/visulima/commit/d83e71697b75d24704185b66bb521a934d2db02d))
* update the jsr.json ([864ab7e](https://github.com/visulima/visulima/commit/864ab7e71c4b5ae82f64792d1ae8debfea2c539b))
* visulima website ([#591](https://github.com/visulima/visulima/issues/591)) ([59ab2e2](https://github.com/visulima/visulima/commit/59ab2e2befb03e51cd2088956f83d9b87de6d033))
* year update ([47f4105](https://github.com/visulima/visulima/commit/47f410596ce7190cfea36a073db32e0cec50bbcd))

### Code Refactoring

* **colorize,tabular:** resolve fallow dead-code findings ([28e41ec](https://github.com/visulima/visulima/commit/28e41ecffa073614f783d8527f4dceed772f2e20))

### Tests

* **repo:** add dist runtime + types integration tests ([32ee300](https://github.com/visulima/visulima/commit/32ee300b7184117a0ddf9f9d390f75f8932d5ed9))
* **tabular:** cover border utils, row-height sizing, and table/grid edge-case layout paths ([3139e0f](https://github.com/visulima/visulima/commit/3139e0f9d35a342fb1dc9ae800dbd452c65350ef))
* tighten error-handler and tabular assertions ([cb72e51](https://github.com/visulima/visulima/commit/cb72e51e9d579fef5c4aef01af8622493bfe30f6))

### Build System

* **deps:** update tabular dependencies ([1e52eb0](https://github.com/visulima/visulima/commit/1e52eb0b5438db04931b8bbc103630fde9807878))
* regenerate bundled-license manifests and types ordering ([af26588](https://github.com/visulima/visulima/commit/af26588d75aaa937fd4862800560bd4070a4878c))

### Continuous Integration

* **fallow:** make fallow:health advisory (--report-only) ([d57148e](https://github.com/visulima/visulima/commit/d57148ea0e3556b4c24d8d336b9fa14987f5dc7d))
* integrate codspeed for benchmark tracking ([e758f3d](https://github.com/visulima/visulima/commit/e758f3da491cc00d3f8bbf10d7ba3fdf8deb5325))


### Dependencies

* **@visulima/colorize:** upgraded to 2.0.0
* **@visulima/string:** upgraded to 3.0.0

## @visulima/tabular [4.0.0-alpha.14](https://github.com/visulima/visulima/compare/@visulima/tabular@4.0.0-alpha.13...@visulima/tabular@4.0.0-alpha.14) (2026-06-13)

### Bug Fixes

* **tabular:** fix sentinel collision, sanitize hrefs, add column defaults ([358f7d8](https://github.com/visulima/visulima/commit/358f7d85859b2624ce491f28da2ac92dd7c26808))
* **tabular:** route row-height warning to onWarn ([f8af98f](https://github.com/visulima/visulima/commit/f8af98f461c09a453cc42768c273f83314bc2186))

### Tests

* tighten error-handler and tabular assertions ([cb72e51](https://github.com/visulima/visulima/commit/cb72e51e9d579fef5c4aef01af8622493bfe30f6))

### Build System

* **deps:** update tabular dependencies ([1e52eb0](https://github.com/visulima/visulima/commit/1e52eb0b5438db04931b8bbc103630fde9807878))
* regenerate bundled-license manifests and types ordering ([af26588](https://github.com/visulima/visulima/commit/af26588d75aaa937fd4862800560bd4070a4878c))


### Dependencies

* **@visulima/colorize:** upgraded to 2.0.0-alpha.14
* **@visulima/string:** upgraded to 3.0.0-alpha.17

## @visulima/tabular [4.0.0-alpha.13](https://github.com/visulima/visulima/compare/@visulima/tabular@4.0.0-alpha.12...@visulima/tabular@4.0.0-alpha.13) (2026-06-04)

### Bug Fixes

* **lint:** clear pre-existing eslint rot across packages ([#674](https://github.com/visulima/visulima/issues/674)) ([5354253](https://github.com/visulima/visulima/commit/5354253b163bd50bcefaf8a3fddf831bdb5df32b))
* **tabular:** 3 bug fixes ([37cc0e3](https://github.com/visulima/visulima/commit/37cc0e39b5404ce2bc282517462a0596ccc9a02f)), closes [#cellVerticalPositionCache](https://github.com/visulima/visulima/issues/cellVerticalPositionCache) [#alignCellContentCache](https://github.com/visulima/visulima/issues/alignCellContentCache)

### Miscellaneous Chores

* apply eslint + prettier autofixes across packages ([c1bb784](https://github.com/visulima/visulima/commit/c1bb7848a0d93d0dfe2960c77e3cda22239c79a0))

### Tests

* **tabular:** cover border utils, row-height sizing, and table/grid edge-case layout paths ([3139e0f](https://github.com/visulima/visulima/commit/3139e0f9d35a342fb1dc9ae800dbd452c65350ef))


### Dependencies

* **@visulima/colorize:** upgraded to 2.0.0-alpha.13
* **@visulima/string:** upgraded to 3.0.0-alpha.15

## @visulima/tabular [4.0.0-alpha.12](https://github.com/visulima/visulima/compare/@visulima/tabular@4.0.0-alpha.11...@visulima/tabular@4.0.0-alpha.12) (2026-05-27)

### Bug Fixes

* **storage-client:** percent-encode user fields in defaultFingerprint ([7c78a0f](https://github.com/visulima/visulima/commit/7c78a0f9512e2a673b941d80839e9f1e86b7b5d0))

### Miscellaneous Chores

* **ci-stability:** green CI across vis, native, lint, tests, attw ([#651](https://github.com/visulima/visulima/issues/651)) ([d4eb684](https://github.com/visulima/visulima/commit/d4eb684b5f75c818c9251048c605a0ed54a268e3))
* re-sort workspace package.json files via vis sort-package-json ([f625696](https://github.com/visulima/visulima/commit/f625696cfac974325774b3243e1a83c3d23acbd7))
* **repo:** apply eslint --fix and prettier --fix across packages ([#650](https://github.com/visulima/visulima/issues/650)) ([2e26a84](https://github.com/visulima/visulima/commit/2e26a84774f218f21345e9a8ecd68236b6542743)), closes [#620](https://github.com/visulima/visulima/issues/620)
* simplify pnpm-workspace packages list ([7cab221](https://github.com/visulima/visulima/commit/7cab221163632d9b7aa044a6f88c49083103a869))
* sorted package.json ([b47c545](https://github.com/visulima/visulima/commit/b47c545591600fdab17d5cd3a3fbc68b61e199da))
* **tabular:** apply prettier and eslint quote-style auto-fix ([20b94d4](https://github.com/visulima/visulima/commit/20b94d4d1ef348af8bc9f59e684c90751d8ef3de))
* **tabular:** housekeeping cleanup ([a323806](https://github.com/visulima/visulima/commit/a3238064a8fc2da14d69d0be3e219773dc289106))
* **tabular:** upgrade packem to 2.0.0-alpha.76 ([35567ad](https://github.com/visulima/visulima/commit/35567adb878433b4dbd319f330e11f9517802bfe))
* **terminal:** apply prettier and eslint formatting sweep ([15fd89c](https://github.com/visulima/visulima/commit/15fd89c677eea60866e08e4fd5f5a6bc8f3bd2e5))

### Tests

* **repo:** add dist runtime + types integration tests ([32ee300](https://github.com/visulima/visulima/commit/32ee300b7184117a0ddf9f9d390f75f8932d5ed9))

### Continuous Integration

* integrate codspeed for benchmark tracking ([e758f3d](https://github.com/visulima/visulima/commit/e758f3da491cc00d3f8bbf10d7ba3fdf8deb5325))


### Dependencies

* **@visulima/colorize:** upgraded to 2.0.0-alpha.12
* **@visulima/string:** upgraded to 3.0.0-alpha.14

## @visulima/tabular [4.0.0-alpha.11](https://github.com/visulima/visulima/compare/@visulima/tabular@4.0.0-alpha.10...@visulima/tabular@4.0.0-alpha.11) (2026-04-22)

### Bug Fixes

* Remove JSR configuration generation script and generated jsr.json files ([#616](https://github.com/visulima/visulima/issues/616)) ([533744b](https://github.com/visulima/visulima/commit/533744b103b74896941db5b727173e617a27a63b))

### Miscellaneous Chores

* update the jsr.json ([864ab7e](https://github.com/visulima/visulima/commit/864ab7e71c4b5ae82f64792d1ae8debfea2c539b))


### Dependencies

* **@visulima/colorize:** upgraded to 2.0.0-alpha.10
* **@visulima/string:** upgraded to 3.0.0-alpha.11

## @visulima/tabular [4.0.0-alpha.10](https://github.com/visulima/visulima/compare/@visulima/tabular@4.0.0-alpha.9...@visulima/tabular@4.0.0-alpha.10) (2026-04-21)

### Bug Fixes

* **tabular:** resolve eslint and formatting issues ([1d6f3ce](https://github.com/visulima/visulima/commit/1d6f3cee1134c67a8c0c671b829668efb9a94670))
* **tabular:** resolve eslint and formatting issues ([7e31ca4](https://github.com/visulima/visulima/commit/7e31ca4e292193d8adf94cd47fa6a23a32936ad6))
* **terminal:** resolve eslint and formatting issues ([12ef283](https://github.com/visulima/visulima/commit/12ef283684d1808fbcfe44077a0cfe8324801485))
* **terminal:** resolve eslint and formatting issues ([8f30389](https://github.com/visulima/visulima/commit/8f30389deb9ff81e7afce0aa064ef11fcb179f23))

### Miscellaneous Chores

* bump engines.node to ^22.14.0 || >=24.10.0 ([c3d0931](https://github.com/visulima/visulima/commit/c3d0931d1504e4f21ebf50ea680cfa7ce4ba15ce))
* fixed jsr.json ([5d85e51](https://github.com/visulima/visulima/commit/5d85e5179de38e284ec433b14d77c71a1619c8d6))
* **tabular:** apply pending changes ([8e15081](https://github.com/visulima/visulima/commit/8e150817cb763be80b43ec5ff3789d108817480c))
* **tabular:** enforce curly braces and apply lint fixes ([4330604](https://github.com/visulima/visulima/commit/43306043ca17bb0c1dfcff94b4849ef493e536af))


### Dependencies

* **@visulima/string:** upgraded to 3.0.0-alpha.10

## @visulima/tabular [4.0.0-alpha.9](https://github.com/visulima/visulima/compare/@visulima/tabular@4.0.0-alpha.8...@visulima/tabular@4.0.0-alpha.9) (2026-04-08)

### Bug Fixes

* **tabular:** properly fix eslint errors in code ([080e133](https://github.com/visulima/visulima/commit/080e1338ec7ad62f9e8968c45c89d19b3861d2be))
* **tabular:** remove remaining eslint suppressions with proper code fixes ([ab4df11](https://github.com/visulima/visulima/commit/ab4df11daa3cb902b30a4a130d6f49fbd191a47b))
* **tabular:** resolve eslint errors ([56241e8](https://github.com/visulima/visulima/commit/56241e864ae8cdff5953af813c140b3c4c4e49de))

### Miscellaneous Chores

* **tabular:** add tsconfig.eslint.json for type-aware linting ([8992e0d](https://github.com/visulima/visulima/commit/8992e0dc0e239f7df169d1e8ae7cbcbea6e36ca0))
* **tabular:** apply prettier formatting ([0a4c1af](https://github.com/visulima/visulima/commit/0a4c1afdd98ad09eecf1e8b30e45e7f9f01f2731))
* **tabular:** migrate .prettierrc.cjs to prettier.config.js ([9eadc5b](https://github.com/visulima/visulima/commit/9eadc5bbafd2ad891e2ecaf7ad4b29b4d0b0b02f))
* **terminal:** remove empty dependency objects from package.json ([562c704](https://github.com/visulima/visulima/commit/562c704e5d90aa2d13eae942ebbdcfeb787c2b46))
* update bundled dependency licenses ([6ace4c6](https://github.com/visulima/visulima/commit/6ace4c69d41fc1fd0a744fbca8ca219ba631b4ab))


### Dependencies

* **@visulima/colorize:** upgraded to 2.0.0-alpha.8
* **@visulima/string:** upgraded to 3.0.0-alpha.9

## @visulima/tabular [4.0.0-alpha.8](https://github.com/visulima/visulima/compare/@visulima/tabular@4.0.0-alpha.7...@visulima/tabular@4.0.0-alpha.8) (2026-03-26)

### Features

* **web:** auto-generate packages page from workspace metadata ([623e520](https://github.com/visulima/visulima/commit/623e5207693a7fe720f5f2f179593a3654c880e3))


### Dependencies

* **@visulima/colorize:** upgraded to 2.0.0-alpha.7
* **@visulima/string:** upgraded to 3.0.0-alpha.8

## @visulima/tabular [4.0.0-alpha.7](https://github.com/visulima/visulima/compare/@visulima/tabular@4.0.0-alpha.6...@visulima/tabular@4.0.0-alpha.7) (2026-03-26)

### Bug Fixes

* **tabular:** use workspace:* for internal [@visulima](https://github.com/visulima) deps ([09e45ee](https://github.com/visulima/visulima/commit/09e45eefea41e619a46e37242dfbe0fe2910ed9c))
* **web:** improve build setup with incremental stats caching and prod install ([fe33e75](https://github.com/visulima/visulima/commit/fe33e75827586779b4b3a0c6d57b39f889ee6207))

### Miscellaneous Chores

* **tabular:** migrate deps to pnpm catalogs ([3586a84](https://github.com/visulima/visulima/commit/3586a84cd27b48aaf6ba330cf5f62c50ef9d79df))
* **tabular:** update dependencies ([9cd0d59](https://github.com/visulima/visulima/commit/9cd0d592e798f7878794a579e28dfd8780a23ba8))
* visulima website ([#591](https://github.com/visulima/visulima/issues/591)) ([59ab2e2](https://github.com/visulima/visulima/commit/59ab2e2befb03e51cd2088956f83d9b87de6d033))


### Dependencies

* **@visulima/colorize:** upgraded to 2.0.0-alpha.6
* **@visulima/string:** upgraded to 3.0.0-alpha.7

## @visulima/tabular [4.0.0-alpha.6](https://github.com/visulima/visulima/compare/@visulima/tabular@4.0.0-alpha.5...@visulima/tabular@4.0.0-alpha.6) (2026-03-06)

### Bug Fixes

* **tabular:** update packem to 2.0.0-alpha.54 ([1ee5965](https://github.com/visulima/visulima/commit/1ee5965bacd3c8df040eb4605e57d2c23fab34a3))

### Documentation

* **boxen,command-line-args,tabular,is-ansi-color-supported,disposable-email-domains:** add comprehensive Fumadocs documentation ([95e0578](https://github.com/visulima/visulima/commit/95e057833978dfeeb9f2768269e36862572539db))

### Miscellaneous Chores

* **tabular:** update dependencies ([333549a](https://github.com/visulima/visulima/commit/333549aa68f8b9a217b3214959e1c4f97e6759fb))
* **tabular:** update dependencies ([ca03869](https://github.com/visulima/visulima/commit/ca03869a6a6141be5d40022da0f0685ca444f094))
* **terminal:** update dependencies ([a5bb91a](https://github.com/visulima/visulima/commit/a5bb91a66f2be2ade485d586156a54c347a23cc9))
* update lock file maintenance ([d83e716](https://github.com/visulima/visulima/commit/d83e71697b75d24704185b66bb521a934d2db02d))
* year update ([47f4105](https://github.com/visulima/visulima/commit/47f410596ce7190cfea36a073db32e0cec50bbcd))


### Dependencies

* **@visulima/colorize:** upgraded to 2.0.0-alpha.5
* **@visulima/string:** upgraded to 3.0.0-alpha.6

## @visulima/tabular [4.0.0-alpha.5](https://github.com/visulima/visulima/compare/@visulima/tabular@4.0.0-alpha.4...@visulima/tabular@4.0.0-alpha.5) (2025-12-27)

### Bug Fixes

* **tabular:** update package files ([1a263de](https://github.com/visulima/visulima/commit/1a263de3a3bbb34fc0ea088630383fef1a2d3ea7))


### Dependencies

* **@visulima/colorize:** upgraded to 2.0.0-alpha.4
* **@visulima/string:** upgraded to 3.0.0-alpha.5

## @visulima/tabular [4.0.0-alpha.4](https://github.com/visulima/visulima/compare/@visulima/tabular@4.0.0-alpha.3...@visulima/tabular@4.0.0-alpha.4) (2025-12-13)

### Miscellaneous Chores

* fixed project.json names and schema path ([964722f](https://github.com/visulima/visulima/commit/964722f691db205c7edb9aa6db29e849a647500b))


### Dependencies

* **@visulima/string:** upgraded to 3.0.0-alpha.4

## @visulima/tabular [4.0.0-alpha.3](https://github.com/visulima/visulima/compare/@visulima/tabular@4.0.0-alpha.2...@visulima/tabular@4.0.0-alpha.3) (2025-12-11)

### Bug Fixes

* update package OG images across multiple packages ([f08e4dd](https://github.com/visulima/visulima/commit/f08e4dd2b105ccb29c8412020a9c2be36d6c1e9e))


### Dependencies

* **@visulima/colorize:** upgraded to 2.0.0-alpha.3
* **@visulima/string:** upgraded to 3.0.0-alpha.3

## @visulima/tabular [4.0.0-alpha.2](https://github.com/visulima/visulima/compare/@visulima/tabular@4.0.0-alpha.1...@visulima/tabular@4.0.0-alpha.2) (2025-12-08)


### Dependencies

* **@visulima/string:** upgraded to 3.0.0-alpha.2

## @visulima/tabular [4.0.0-alpha.1](https://github.com/visulima/visulima/compare/@visulima/tabular@3.1.3...@visulima/tabular@4.0.0-alpha.1) (2025-12-07)

### ⚠ BREAKING CHANGES

* change min node version to 22.13

### Bug Fixes

* add new package image, fixed readme rendering on npm, fixed building of packages ([b790ba2](https://github.com/visulima/visulima/commit/b790ba253ea07fef83528fd822a678facf021b5f))
* update Node.js engine version requirement to >=22.13 in multiple package.json files for improved compatibility ([b828e9a](https://github.com/visulima/visulima/commit/b828e9aeaebfc798eecddccd90e6ec7560c6d36a))

### Miscellaneous Chores

* moved all packages into groups ([0615e9d](https://github.com/visulima/visulima/commit/0615e9d14a8a886e11da529ce150cf31ca973c10))
* update @anolilab/semantic-release-pnpm and @anolilab/semantic-release-preset to versions 3.2.2 and 12.1.2 across multiple package.json files for improved compatibility ([3921626](https://github.com/visulima/visulima/commit/3921626141fe5da398749bf0ba675f1596f18afb))
* update dependencies across multiple packages to improve compatibility and performance, including upgrading `@anolilab/semantic-release-pnpm` and `@anolilab/semantic-release-preset` to versions 3.2.0 and 12.1.0 respectively, and updating `react`, `react-dom`, and `next` versions to 19.2.1 and 16.0.7 in various package.json files ([aee8fcd](https://github.com/visulima/visulima/commit/aee8fcd796ae9b8d055903260e7150996ea9f53d))


### Dependencies

* **@visulima/string:** upgraded to 3.0.0-alpha.1

## @visulima/tabular [3.1.3](https://github.com/visulima/visulima/compare/@visulima/tabular@3.1.2...@visulima/tabular@3.1.3) (2025-11-13)

### Bug Fixes

* bump packem, to fix minified version of the code ([2a36ceb](https://github.com/visulima/visulima/commit/2a36ceb09251b0ca1178701a26547a871ed717a7))


### Dependencies

* **@visulima/colorize:** upgraded to 1.4.29
* **@visulima/string:** upgraded to 2.0.6

## @visulima/tabular [3.1.2](https://github.com/visulima/visulima/compare/@visulima/tabular@3.1.1...@visulima/tabular@3.1.2) (2025-11-12)

### Bug Fixes

* update package configurations and TypeScript definitions ([b59aa59](https://github.com/visulima/visulima/commit/b59aa59dac1508216b944f4b917fb4a7ab1f70a4))

### Miscellaneous Chores

* Add jsr file to all packages for release ([#565](https://github.com/visulima/visulima/issues/565)) ([ec91652](https://github.com/visulima/visulima/commit/ec91652b4e4112adf14ba152c1239a7703ba425a))
* update license files and clean up TypeScript definitions ([fe668cc](https://github.com/visulima/visulima/commit/fe668cc26de23591d4df54a0954455ebbe31b22d))


### Dependencies

* **@visulima/colorize:** upgraded to 1.4.28
* **@visulima/string:** upgraded to 2.0.5

## @visulima/tabular [3.1.1](https://github.com/visulima/visulima/compare/@visulima/tabular@3.1.0...@visulima/tabular@3.1.1) (2025-11-07)

### Bug Fixes

* update TypeScript configurations and improve linting across multiple packages ([6f25ec7](https://github.com/visulima/visulima/commit/6f25ec7841da7246f8f9166efc5292a7089d37ee))

### Miscellaneous Chores

* update npm and pnpm configurations for monorepo optimization ([#564](https://github.com/visulima/visulima/issues/564)) ([5512b42](https://github.com/visulima/visulima/commit/5512b42f672c216b6a3c9e39035199a4ebd9a4b8))


### Dependencies

* **@visulima/colorize:** upgraded to 1.4.27
* **@visulima/string:** upgraded to 2.0.4

## @visulima/tabular [3.1.0](https://github.com/visulima/visulima/compare/@visulima/tabular@3.0.0...@visulima/tabular@3.1.0) (2025-11-05)

### Features

* add setFooter to tabular component [#563](https://github.com/visulima/visulima/issues/563) ([09b4aae](https://github.com/visulima/visulima/commit/09b4aae136f0e1583b17e810f0ebab12784ab70b))

## @visulima/tabular [3.0.0](https://github.com/visulima/visulima/compare/@visulima/tabular@2.0.2...@visulima/tabular@3.0.0) (2025-11-05)

### ⚠ BREAKING CHANGES

* **tabular:** add cell width property and balanced widths functionality (#560)

### Features

* **tabular:** add cell width property and balanced widths functionality ([#560](https://github.com/visulima/visulima/issues/560)) ([618006c](https://github.com/visulima/visulima/commit/618006c6fda15c8f46a3db9ca4fe59f85529ffa7))
* update dependencies and deprecate truncateOverflow option ([6d025e0](https://github.com/visulima/visulima/commit/6d025e07d5eb83bfed30815318a65ef628a1797e))

### Bug Fixes

* set default value for truncateOverflow option in Table class ([463ad04](https://github.com/visulima/visulima/commit/463ad04dd992b0472631072d9b1bf0289d54354c))
* update dependencies across multiple packages ([36a47f2](https://github.com/visulima/visulima/commit/36a47f26d65d25a7b4d8371186710e7d0ab61a2b))


### Dependencies

* **@visulima/colorize:** upgraded to 1.4.26
* **@visulima/string:** upgraded to 2.0.3

## @visulima/tabular [2.0.2](https://github.com/visulima/visulima/compare/@visulima/tabular@2.0.1...@visulima/tabular@2.0.2) (2025-10-22)

### Miscellaneous Chores

* update package dependencies and configurations ([7bfe7e7](https://github.com/visulima/visulima/commit/7bfe7e71869580900aab50efb064b4293994ed9a))


### Dependencies

* **@visulima/string:** upgraded to 2.0.2

## @visulima/tabular [2.0.1](https://github.com/visulima/visulima/compare/@visulima/tabular@2.0.0...@visulima/tabular@2.0.1) (2025-10-21)

### Bug Fixes

* allow node v25 and updated dev deps ([8158cc5](https://github.com/visulima/visulima/commit/8158cc53ec92bd0331e8c6bd0fcbc8ab61b9320f))

### Miscellaneous Chores

* **deps:** update package versions and dependencies ([88d8d32](https://github.com/visulima/visulima/commit/88d8d32c4629a7a06c8770369191da2cc81087cc))
* update package dependencies across multiple packages ([17e3f23](https://github.com/visulima/visulima/commit/17e3f2377c8a3f98e2eed2192c5adaf6e32558b5))


### Dependencies

* **@visulima/colorize:** upgraded to 1.4.25
* **@visulima/string:** upgraded to 2.0.1

## @visulima/tabular [2.0.0](https://github.com/visulima/visulima/compare/@visulima/tabular@1.0.11...@visulima/tabular@2.0.0) (2025-10-15)

### ⚠ BREAKING CHANGES

* **removed `defaultTerminalWidth` option** — Use `balancedWidths: true` for proportional column distribution or set `terminalWidth` explicitly for fixed terminal constraints.
* **added `balancedWidths` option** — Enable automatic proportional column width distribution across terminal width. This replaces the behavior previously driven by `defaultTerminalWidth`.

### Migration Guide

If you were relying on `defaultTerminalWidth`:

**Before (v1.x):**
```typescript
const table = createTable({ defaultTerminalWidth: 120 });
```

**After (v2.0):**
```typescript
// For proportional/balanced column widths:
const table = createTable({ balancedWidths: true, terminalWidth: 120 });

// Or for content-based sizing with terminal constraint:
const table = createTable({ terminalWidth: 120 });
```

### Bug Fixes

* Adjusted the node engine requirement to support versions 20.19 and above. ([c5f787b](https://github.com/visulima/visulima/commit/c5f787b26ef900b0568f51d220172eff9e387a38))
* update @visulima/packem to 2.0.0-alpha.32 across multiple packages for improved compatibility ([27b346e](https://github.com/visulima/visulima/commit/27b346eaa1c0fb0e420d9a9824482028307f4249))

### Documentation

* update import paths in examples and README for consistency ([d0fee6c](https://github.com/visulima/visulima/commit/d0fee6ced40118bd306df895dc451fd5cd70860f))

### Miscellaneous Chores

* **deps:** update build scripts and remove cross-env dependency ([7510e82](https://github.com/visulima/visulima/commit/7510e826b9235a0013fe61c82a7eb333bc4cbb78))
* update linting commands and dependencies for improved performance ([b9073d5](https://github.com/visulima/visulima/commit/b9073d5d24ba0440b25109f7be8a9c4d7fa4e948))
* update package dependencies across multiple packages for improved compatibility and performance ([9567591](https://github.com/visulima/visulima/commit/9567591c415da3002f3a4fe08f8caf7ce01ca5f7))
* update package.json and pnpm-lock.yaml to include publint@0.3.12 and adjust build/test commands to exclude shared-utils ([1f7b3c0](https://github.com/visulima/visulima/commit/1f7b3c0381d77edfeec80ea1bf57b3469e929414))


### Dependencies

* **@visulima/colorize:** upgraded to 1.4.24
* **@visulima/string:** upgraded to 2.0.0

## @visulima/tabular [1.0.11](https://github.com/visulima/visulima/compare/@visulima/tabular@1.0.10...@visulima/tabular@1.0.11) (2025-09-12)


### Dependencies

* **@visulima/string:** upgraded to 1.5.2

## @visulima/tabular [1.0.10](https://github.com/visulima/visulima/compare/@visulima/tabular@1.0.9...@visulima/tabular@1.0.10) (2025-06-04)


### Dependencies

* **@visulima/colorize:** upgraded to 1.4.23
* **@visulima/string:** upgraded to 1.5.1

## @visulima/tabular [1.0.9](https://github.com/visulima/visulima/compare/@visulima/tabular@1.0.8...@visulima/tabular@1.0.9) (2025-06-03)

### Miscellaneous Chores

* **tabular:** update package.json and pnpm-lock.yaml for tabular package ([67a3bb4](https://github.com/visulima/visulima/commit/67a3bb473cf9a8d2460a25bc5638e88a5e7c8ec4))
* update ESLint configuration and dependencies ([1cf0391](https://github.com/visulima/visulima/commit/1cf0391cf67757844387b4d98b1f28d458e7f233))


### Dependencies

* **@visulima/string:** upgraded to 1.5.0

## @visulima/tabular [1.0.8](https://github.com/visulima/visulima/compare/@visulima/tabular@1.0.7...@visulima/tabular@1.0.8) (2025-05-31)


### Dependencies

* **@visulima/string:** upgraded to 1.4.1

## @visulima/tabular [1.0.7](https://github.com/visulima/visulima/compare/@visulima/tabular@1.0.6...@visulima/tabular@1.0.7) (2025-05-31)


### Dependencies

* **@visulima/string:** upgraded to 1.4.0

## @visulima/tabular [1.0.6](https://github.com/visulima/visulima/compare/@visulima/tabular@1.0.5...@visulima/tabular@1.0.6) (2025-05-31)


### Dependencies

* **@visulima/string:** upgraded to 1.3.0

## @visulima/tabular [1.0.5](https://github.com/visulima/visulima/compare/@visulima/tabular@1.0.4...@visulima/tabular@1.0.5) (2025-05-30)

### Bug Fixes

* moved @visulima/string to dev dep, for smaller size of the package ([4281eec](https://github.com/visulima/visulima/commit/4281eec70a2bd3f397b2e3397a0af48bfbdd7cfb))
* **tabular:** add terminal-size package as replace for the internal get-terminal-width utility ([0197c85](https://github.com/visulima/visulima/commit/0197c85662a002fd0990fde02c3589e7b68e1ac2))
* **tabular:** update dependencies ([97e4e78](https://github.com/visulima/visulima/commit/97e4e7817bab3fce2ba0d1746e7ba44d5fd720d8))

### Styles

* cs fixes ([6570d56](https://github.com/visulima/visulima/commit/6570d568a80bd3fd4bfd73c824dc78f7e3a372f8))


### Dependencies

* **@visulima/colorize:** upgraded to 1.4.22
* **@visulima/string:** upgraded to 1.2.3

## @visulima/tabular [1.0.4](https://github.com/visulima/visulima/compare/@visulima/tabular@1.0.3...@visulima/tabular@1.0.4) (2025-05-07)


### Dependencies

* **@visulima/string:** upgraded to 1.2.2

## @visulima/tabular [1.0.3](https://github.com/visulima/visulima/compare/@visulima/tabular@1.0.2...@visulima/tabular@1.0.3) (2025-05-07)


### Dependencies

* **@visulima/string:** upgraded to 1.2.1

## @visulima/tabular [1.0.2](https://github.com/visulima/visulima/compare/@visulima/tabular@1.0.1...@visulima/tabular@1.0.2) (2025-05-07)


### Dependencies

* **@visulima/string:** upgraded to 1.2.0

## @visulima/tabular [1.0.1](https://github.com/visulima/visulima/compare/@visulima/tabular@1.0.0...@visulima/tabular@1.0.1) (2025-05-04)


### Dependencies

* **@visulima/string:** upgraded to 1.1.0

## @visulima/tabular 1.0.0 (2025-05-03)

### Features

* adding new tabular cli package ([#499](https://github.com/visulima/visulima/issues/499)) ([646b550](https://github.com/visulima/visulima/commit/646b5501f3a78406f730b7dd1d8d41564daf3d9e))

### Miscellaneous Chores

* **tabular:** fixed readme ([d321263](https://github.com/visulima/visulima/commit/d321263b88cc6ee6210951073cfafc3b8dc88690))
