## @visulima/humanizer [3.0.1](https://github.com/visulima/visulima/compare/%40visulima%2Fhumanizer%403.0.0...%40visulima%2Fhumanizer%403.0.1) (2026-07-17)

## @visulima/humanizer [3.0.0](https://github.com/visulima/visulima/compare/@visulima/humanizer@2.0.5...@visulima/humanizer@3.0.0) (2026-07-03)

### ⚠ BREAKING CHANGES

* change min node version to 22.13

### Features

* **humanizer:** add Norwegian Nynorsk (nn) duration language ([#684](https://github.com/visulima/visulima/issues/684)) ([4d0c07d](https://github.com/visulima/visulima/commit/4d0c07dbb1d9dc17efb8585e93bc24deaf83eb68)), closes [EvanHahn/HumanizeDuration.js#236](https://github.com/EvanHahn/HumanizeDuration.js/issues/236)
* **humanizer:** fix parse/format bugs and add humanizer factory, bits, iso8601 ([15a4a19](https://github.com/visulima/visulima/commit/15a4a19404e2bbd3f8fe413eac427a966604480a))
* **web:** auto-generate packages page from workspace metadata ([623e520](https://github.com/visulima/visulima/commit/623e5207693a7fe720f5f2f179593a3654c880e3))

### Bug Fixes

* add new package image, fixed readme rendering on npm, fixed building of packages ([b790ba2](https://github.com/visulima/visulima/commit/b790ba253ea07fef83528fd822a678facf021b5f))
* **data-manipulation:** resolve eslint and type-safety issues ([f1682c2](https://github.com/visulima/visulima/commit/f1682c2611cbcc6c85d4bbea520d43464b42e7ee))
* **humanizer:** 3 bug fixes + 1 perf ([97686e3](https://github.com/visulima/visulima/commit/97686e33c6c286c1f4f3ecafd5852368355d26e7))
* **humanizer:** keep runtime dynamic language import out of the build glob ([48693e3](https://github.com/visulima/visulima/commit/48693e326cd12e99e2debd8135aa8f4454cb0f9a))
* **humanizer:** properly fix eslint errors in code ([cb00491](https://github.com/visulima/visulima/commit/cb00491092837af7e1fb519e7fee4d1567f51e34))
* **humanizer:** remove remaining eslint suppressions with proper code fixes ([ec9c058](https://github.com/visulima/visulima/commit/ec9c058bcd0524c6843198679faad9f9f8b546e0))
* **humanizer:** resolve eslint and formatting issues ([18e63f7](https://github.com/visulima/visulima/commit/18e63f701b8a75ba9d24bee32d38a59304a1bbc4))
* **humanizer:** resolve eslint errors ([4dea64f](https://github.com/visulima/visulima/commit/4dea64f9cd70b6d6a485c59993a6b26c2a15ea7f))
* **humanizer:** update package files ([f370cff](https://github.com/visulima/visulima/commit/f370cff64a0c065ca66f87ffbbd5f7d20cc41a8f))
* **humanizer:** update packem to 2.0.0-alpha.54 ([f38a2ba](https://github.com/visulima/visulima/commit/f38a2baf3067292f65ded370fa2194bab518ee3c))
* Remove JSR configuration generation script and generated jsr.json files ([#616](https://github.com/visulima/visulima/issues/616)) ([533744b](https://github.com/visulima/visulima/commit/533744b103b74896941db5b727173e617a27a63b))
* resolve failing tests across multiple packages ([2b4b6f0](https://github.com/visulima/visulima/commit/2b4b6f04169b60fdc4cf77b293015436a272c0fb))
* **storage-client:** percent-encode user fields in defaultFingerprint ([7c78a0f](https://github.com/visulima/visulima/commit/7c78a0f9512e2a673b941d80839e9f1e86b7b5d0))
* update Node.js engine version requirement to >=22.13 in multiple package.json files for improved compatibility ([b828e9a](https://github.com/visulima/visulima/commit/b828e9aeaebfc798eecddccd90e6ec7560c6d36a))
* update package OG images across multiple packages ([f08e4dd](https://github.com/visulima/visulima/commit/f08e4dd2b105ccb29c8412020a9c2be36d6c1e9e))
* update Romanian duration translations and improve unit handling ([f553b09](https://github.com/visulima/visulima/commit/f553b09e0d001853a88223d456bcb1709415667d))
* **web:** improve build setup with incremental stats caching and prod install ([fe33e75](https://github.com/visulima/visulima/commit/fe33e75827586779b4b3a0c6d57b39f889ee6207))

### Documentation

* **humanizer,html,iso-locale,package,tsconfig:** add comprehensive Fumadocs documentation ([19781ce](https://github.com/visulima/visulima/commit/19781ce5d27605971a9f2fdf0a99863effd98091))
* **humanizer:** add HumanizeDuration.js credits ([#688](https://github.com/visulima/visulima/issues/688)) ([a4d57c8](https://github.com/visulima/visulima/commit/a4d57c87d3352a764732bf3cb13305247d512650))

### Miscellaneous Chores

* add fallow code-intelligence across all packages ([a3b4821](https://github.com/visulima/visulima/commit/a3b48215002e86fed20f2973038b5d4a0aa1ce04))
* bump engines.node to ^22.14.0 || >=24.10.0 ([c3d0931](https://github.com/visulima/visulima/commit/c3d0931d1504e4f21ebf50ea680cfa7ce4ba15ce))
* **ci-stability:** green CI across vis, native, lint, tests, attw ([#651](https://github.com/visulima/visulima/issues/651)) ([d4eb684](https://github.com/visulima/visulima/commit/d4eb684b5f75c818c9251048c605a0ed54a268e3))
* **data-manipulation:** remove empty dependency objects from package.json ([c0e8f76](https://github.com/visulima/visulima/commit/c0e8f7689a2da413f771494f6ecb07babc4b5e06))
* **data-manipulation:** update dependencies ([49458ab](https://github.com/visulima/visulima/commit/49458ab8f8e17d875840b1b4fe8b5efe12ff3513))
* fixed jsr.json ([5d85e51](https://github.com/visulima/visulima/commit/5d85e5179de38e284ec433b14d77c71a1619c8d6))
* fixed project.json names and schema path ([964722f](https://github.com/visulima/visulima/commit/964722f691db205c7edb9aa6db29e849a647500b))
* **humanizer:** add tsconfig.eslint.json for type-aware linting ([3c39145](https://github.com/visulima/visulima/commit/3c391453b8ad7a75598384a152e62cd4d44141ca))
* **humanizer:** apply prettier formatting ([f66629e](https://github.com/visulima/visulima/commit/f66629e5138777948bc3bef31eb17d8f27aa120e))
* **humanizer:** enforce curly braces and apply lint fixes ([35b82d7](https://github.com/visulima/visulima/commit/35b82d76b9177ba3e11b078f3ba11cce61822307))
* **humanizer:** exclude __bench__ dir from eslint config ([435f953](https://github.com/visulima/visulima/commit/435f953d48fc1f117aa57f90a5b5ced389c3bb63))
* **humanizer:** housekeeping cleanup ([0aa67b7](https://github.com/visulima/visulima/commit/0aa67b737fcce7ee793c6242f36d4d7647cb1960))
* **humanizer:** migrate .prettierrc.cjs to prettier.config.js ([85c09a7](https://github.com/visulima/visulima/commit/85c09a74f03e3d6450b9ec25a97b5a4123ca2ea4))
* **humanizer:** migrate deps to pnpm catalogs ([f731305](https://github.com/visulima/visulima/commit/f73130503a2cd7caa211799e668ede30b40844b4))
* **humanizer:** update dependencies ([48f5e2c](https://github.com/visulima/visulima/commit/48f5e2c4f16bd4503722644043dce08967193634))
* **humanizer:** update dependencies ([70c666e](https://github.com/visulima/visulima/commit/70c666ee1f7dcf5cf6a7fde56b2763ea3f037dd7))
* **humanizer:** update dependencies ([d536412](https://github.com/visulima/visulima/commit/d5364126592f69e4ac06af6f692842aa9c971c82))
* **humanizer:** upgrade packem to 2.0.0-alpha.76 ([d0399e3](https://github.com/visulima/visulima/commit/d0399e31873cbde38eb6143437446ec6caf853b3))
* moved all packages into groups ([0615e9d](https://github.com/visulima/visulima/commit/0615e9d14a8a886e11da529ce150cf31ca973c10))
* re-sort workspace package.json files via vis sort-package-json ([f625696](https://github.com/visulima/visulima/commit/f625696cfac974325774b3243e1a83c3d23acbd7))
* **release:** @visulima/humanizer@3.0.0-alpha.1 [skip ci]\n\n## @visulima/humanizer [3.0.0-alpha.1](https://github.com/visulima/visulima/compare/@visulima/humanizer@2.0.5...@visulima/humanizer@3.0.0-alpha.1) (2025-12-04) ([60ba833](https://github.com/visulima/visulima/commit/60ba8332120fd536a98a37d8ca70a72b19f66e16))
* **release:** @visulima/humanizer@3.0.0-alpha.10 [skip ci]\n\n## @visulima/humanizer [3.0.0-alpha.10](https://github.com/visulima/visulima/compare/@visulima/humanizer@3.0.0-alpha.9...@visulima/humanizer@3.0.0-alpha.10) (2026-04-15) ([6e90778](https://github.com/visulima/visulima/commit/6e90778ee18c0333f77c4339f8d732208b7b77b2))
* **release:** @visulima/humanizer@3.0.0-alpha.11 [skip ci]\n\n## @visulima/humanizer [3.0.0-alpha.11](https://github.com/visulima/visulima/compare/@visulima/humanizer@3.0.0-alpha.10...@visulima/humanizer@3.0.0-alpha.11) (2026-04-22) ([55e381a](https://github.com/visulima/visulima/commit/55e381a86cf11cee1d986a8121ce90c00c96a69b))
* **release:** @visulima/humanizer@3.0.0-alpha.12 [skip ci]\n\n## @visulima/humanizer [3.0.0-alpha.12](https://github.com/visulima/visulima/compare/@visulima/humanizer@3.0.0-alpha.11...@visulima/humanizer@3.0.0-alpha.12) (2026-05-27) ([5b58e7d](https://github.com/visulima/visulima/commit/5b58e7dcdce3161b9b39cfac8523de94c847cb8f))
* **release:** @visulima/humanizer@3.0.0-alpha.13 [skip ci]\n\n## @visulima/humanizer [3.0.0-alpha.13](https://github.com/visulima/visulima/compare/@visulima/humanizer@3.0.0-alpha.12...@visulima/humanizer@3.0.0-alpha.13) (2026-06-04) ([197bbee](https://github.com/visulima/visulima/commit/197bbeec3e9c34e8fa152d2ff799a826bf2f3b64))
* **release:** @visulima/humanizer@3.0.0-alpha.14 [skip ci]\n\n## @visulima/humanizer [3.0.0-alpha.14](https://github.com/visulima/visulima/compare/@visulima/humanizer@3.0.0-alpha.13...@visulima/humanizer@3.0.0-alpha.14) (2026-06-13) ([bab30a9](https://github.com/visulima/visulima/commit/bab30a9829e09ac16c35d999dffd11250b03c196))
* **release:** @visulima/humanizer@3.0.0-alpha.15 [skip ci]\n\n## @visulima/humanizer [3.0.0-alpha.15](https://github.com/visulima/visulima/compare/@visulima/humanizer@3.0.0-alpha.14...@visulima/humanizer@3.0.0-alpha.15) (2026-06-19) ([6c56082](https://github.com/visulima/visulima/commit/6c56082f53c63a5f9ead67a9db0230604bb5b617))
* **release:** @visulima/humanizer@3.0.0-alpha.2 [skip ci]\n\n## @visulima/humanizer [3.0.0-alpha.2](https://github.com/visulima/visulima/compare/@visulima/humanizer@3.0.0-alpha.1...@visulima/humanizer@3.0.0-alpha.2) (2025-12-06) ([eff2416](https://github.com/visulima/visulima/commit/eff24163d562821990767800bd0cd4285bc7757a))
* **release:** @visulima/humanizer@3.0.0-alpha.3 [skip ci]\n\n## @visulima/humanizer [3.0.0-alpha.3](https://github.com/visulima/visulima/compare/@visulima/humanizer@3.0.0-alpha.2...@visulima/humanizer@3.0.0-alpha.3) (2025-12-10) ([83174fd](https://github.com/visulima/visulima/commit/83174fd8e8da2d91cea2a6de4024aa1482472370))
* **release:** @visulima/humanizer@3.0.0-alpha.4 [skip ci]\n\n## @visulima/humanizer [3.0.0-alpha.4](https://github.com/visulima/visulima/compare/@visulima/humanizer@3.0.0-alpha.3...@visulima/humanizer@3.0.0-alpha.4) (2025-12-11) ([f307744](https://github.com/visulima/visulima/commit/f307744223a5858f9f44493acdf108a63af936c2))
* **release:** @visulima/humanizer@3.0.0-alpha.5 [skip ci]\n\n## @visulima/humanizer [3.0.0-alpha.5](https://github.com/visulima/visulima/compare/@visulima/humanizer@3.0.0-alpha.4...@visulima/humanizer@3.0.0-alpha.5) (2025-12-27) ([40a9c7d](https://github.com/visulima/visulima/commit/40a9c7def8a30fac17558494e70a33c4b0447bbe))
* **release:** @visulima/humanizer@3.0.0-alpha.6 [skip ci]\n\n## @visulima/humanizer [3.0.0-alpha.6](https://github.com/visulima/visulima/compare/@visulima/humanizer@3.0.0-alpha.5...@visulima/humanizer@3.0.0-alpha.6) (2026-03-06) ([74def4f](https://github.com/visulima/visulima/commit/74def4f5e51663b364654f0ab5103858977eaa80))
* **release:** @visulima/humanizer@3.0.0-alpha.7 [skip ci]\n\n## @visulima/humanizer [3.0.0-alpha.7](https://github.com/visulima/visulima/compare/@visulima/humanizer@3.0.0-alpha.6...@visulima/humanizer@3.0.0-alpha.7) (2026-03-26) ([abb72a0](https://github.com/visulima/visulima/commit/abb72a0b020f043429febb5eee7c41d4cebab8be))
* **release:** @visulima/humanizer@3.0.0-alpha.8 [skip ci]\n\n## @visulima/humanizer [3.0.0-alpha.8](https://github.com/visulima/visulima/compare/@visulima/humanizer@3.0.0-alpha.7...@visulima/humanizer@3.0.0-alpha.8) (2026-03-26) ([6f2e9f8](https://github.com/visulima/visulima/commit/6f2e9f84bbfd4d235da43702372eb3f6d677f1ef))
* **release:** @visulima/humanizer@3.0.0-alpha.9 [skip ci]\n\n## @visulima/humanizer [3.0.0-alpha.9](https://github.com/visulima/visulima/compare/@visulima/humanizer@3.0.0-alpha.8...@visulima/humanizer@3.0.0-alpha.9) (2026-04-08) ([ee162e4](https://github.com/visulima/visulima/commit/ee162e4ac5ef120ec96be31cf61b8ba9c1ab4ae9))
* **repo:** sort package.json keys across all packages ([e1fd9ab](https://github.com/visulima/visulima/commit/e1fd9ab467ef96a98c777da1572ff6a50fcf7e71))
* simplify pnpm-workspace packages list ([7cab221](https://github.com/visulima/visulima/commit/7cab221163632d9b7aa044a6f88c49083103a869))
* sorted package.json ([b47c545](https://github.com/visulima/visulima/commit/b47c545591600fdab17d5cd3a3fbc68b61e199da))
* update @anolilab/semantic-release-pnpm and @anolilab/semantic-release-preset to versions 3.2.2 and 12.1.2 across multiple package.json files for improved compatibility ([3921626](https://github.com/visulima/visulima/commit/3921626141fe5da398749bf0ba675f1596f18afb))
* update dependencies across multiple packages to improve compatibility and performance, including upgrading `@anolilab/semantic-release-pnpm` and `@anolilab/semantic-release-preset` to versions 3.2.0 and 12.1.0 respectively, and updating `react`, `react-dom`, and `next` versions to 19.2.1 and 16.0.7 in various package.json files ([aee8fcd](https://github.com/visulima/visulima/commit/aee8fcd796ae9b8d055903260e7150996ea9f53d))
* update lock file maintenance ([d83e716](https://github.com/visulima/visulima/commit/d83e71697b75d24704185b66bb521a934d2db02d))
* visulima website ([#591](https://github.com/visulima/visulima/issues/591)) ([59ab2e2](https://github.com/visulima/visulima/commit/59ab2e2befb03e51cd2088956f83d9b87de6d033))
* year update ([47f4105](https://github.com/visulima/visulima/commit/47f410596ce7190cfea36a073db32e0cec50bbcd))

### Tests

* **humanizer:** cover bytes/duration edge paths, slavic plural forms, and create-duration-language options ([f557598](https://github.com/visulima/visulima/commit/f55759841d579f8608ea24ec9b48cef573e5ab85))
* **humanizer:** tighten bytes and duration assertions ([0d74921](https://github.com/visulima/visulima/commit/0d74921f7750417c5e961f034723374257284372))
* improve coverage across packages ([91bd6d3](https://github.com/visulima/visulima/commit/91bd6d3b61736e3c8bd1fc59b0b5955f76a5d323))
* **repo:** add dist runtime + types integration tests ([32ee300](https://github.com/visulima/visulima/commit/32ee300b7184117a0ddf9f9d390f75f8932d5ed9))

### Continuous Integration

* **fallow:** make fallow:health advisory (--report-only) ([d57148e](https://github.com/visulima/visulima/commit/d57148ea0e3556b4c24d8d336b9fa14987f5dc7d))

## @visulima/humanizer [3.0.0-alpha.15](https://github.com/visulima/visulima/compare/@visulima/humanizer@3.0.0-alpha.14...@visulima/humanizer@3.0.0-alpha.15) (2026-06-19)

### Features

* **humanizer:** add Norwegian Nynorsk (nn) duration language ([#684](https://github.com/visulima/visulima/issues/684)) ([4d0c07d](https://github.com/visulima/visulima/commit/4d0c07dbb1d9dc17efb8585e93bc24deaf83eb68)), closes [EvanHahn/HumanizeDuration.js#236](https://github.com/EvanHahn/HumanizeDuration.js/issues/236)

## @visulima/humanizer [3.0.0-alpha.14](https://github.com/visulima/visulima/compare/@visulima/humanizer@3.0.0-alpha.13...@visulima/humanizer@3.0.0-alpha.14) (2026-06-13)

### Features

* **humanizer:** fix parse/format bugs and add humanizer factory, bits, iso8601 ([15a4a19](https://github.com/visulima/visulima/commit/15a4a19404e2bbd3f8fe413eac427a966604480a))

### Bug Fixes

* **humanizer:** keep runtime dynamic language import out of the build glob ([48693e3](https://github.com/visulima/visulima/commit/48693e326cd12e99e2debd8135aa8f4454cb0f9a))

### Miscellaneous Chores

* **humanizer:** exclude __bench__ dir from eslint config ([435f953](https://github.com/visulima/visulima/commit/435f953d48fc1f117aa57f90a5b5ced389c3bb63))

### Tests

* **humanizer:** tighten bytes and duration assertions ([0d74921](https://github.com/visulima/visulima/commit/0d74921f7750417c5e961f034723374257284372))

## @visulima/humanizer [3.0.0-alpha.13](https://github.com/visulima/visulima/compare/@visulima/humanizer@3.0.0-alpha.12...@visulima/humanizer@3.0.0-alpha.13) (2026-06-04)

### Bug Fixes

* **humanizer:** 3 bug fixes + 1 perf ([97686e3](https://github.com/visulima/visulima/commit/97686e33c6c286c1f4f3ecafd5852368355d26e7))

### Tests

* **humanizer:** cover bytes/duration edge paths, slavic plural forms, and create-duration-language options ([f557598](https://github.com/visulima/visulima/commit/f55759841d579f8608ea24ec9b48cef573e5ab85))
* improve coverage across packages ([91bd6d3](https://github.com/visulima/visulima/commit/91bd6d3b61736e3c8bd1fc59b0b5955f76a5d323))

## @visulima/humanizer [3.0.0-alpha.12](https://github.com/visulima/visulima/compare/@visulima/humanizer@3.0.0-alpha.11...@visulima/humanizer@3.0.0-alpha.12) (2026-05-27)

### Bug Fixes

* **storage-client:** percent-encode user fields in defaultFingerprint ([7c78a0f](https://github.com/visulima/visulima/commit/7c78a0f9512e2a673b941d80839e9f1e86b7b5d0))

### Miscellaneous Chores

* **ci-stability:** green CI across vis, native, lint, tests, attw ([#651](https://github.com/visulima/visulima/issues/651)) ([d4eb684](https://github.com/visulima/visulima/commit/d4eb684b5f75c818c9251048c605a0ed54a268e3))
* **humanizer:** housekeeping cleanup ([0aa67b7](https://github.com/visulima/visulima/commit/0aa67b737fcce7ee793c6242f36d4d7647cb1960))
* **humanizer:** upgrade packem to 2.0.0-alpha.76 ([d0399e3](https://github.com/visulima/visulima/commit/d0399e31873cbde38eb6143437446ec6caf853b3))
* re-sort workspace package.json files via vis sort-package-json ([f625696](https://github.com/visulima/visulima/commit/f625696cfac974325774b3243e1a83c3d23acbd7))
* **repo:** sort package.json keys across all packages ([e1fd9ab](https://github.com/visulima/visulima/commit/e1fd9ab467ef96a98c777da1572ff6a50fcf7e71))
* simplify pnpm-workspace packages list ([7cab221](https://github.com/visulima/visulima/commit/7cab221163632d9b7aa044a6f88c49083103a869))
* sorted package.json ([b47c545](https://github.com/visulima/visulima/commit/b47c545591600fdab17d5cd3a3fbc68b61e199da))

### Tests

* **repo:** add dist runtime + types integration tests ([32ee300](https://github.com/visulima/visulima/commit/32ee300b7184117a0ddf9f9d390f75f8932d5ed9))

## @visulima/humanizer [3.0.0-alpha.11](https://github.com/visulima/visulima/compare/@visulima/humanizer@3.0.0-alpha.10...@visulima/humanizer@3.0.0-alpha.11) (2026-04-22)

### Bug Fixes

* Remove JSR configuration generation script and generated jsr.json files ([#616](https://github.com/visulima/visulima/issues/616)) ([533744b](https://github.com/visulima/visulima/commit/533744b103b74896941db5b727173e617a27a63b))

### Miscellaneous Chores

* bump engines.node to ^22.14.0 || >=24.10.0 ([c3d0931](https://github.com/visulima/visulima/commit/c3d0931d1504e4f21ebf50ea680cfa7ce4ba15ce))
* fixed jsr.json ([5d85e51](https://github.com/visulima/visulima/commit/5d85e5179de38e284ec433b14d77c71a1619c8d6))
* **humanizer:** enforce curly braces and apply lint fixes ([35b82d7](https://github.com/visulima/visulima/commit/35b82d76b9177ba3e11b078f3ba11cce61822307))

## @visulima/humanizer [3.0.0-alpha.10](https://github.com/visulima/visulima/compare/@visulima/humanizer@3.0.0-alpha.9...@visulima/humanizer@3.0.0-alpha.10) (2026-04-15)

### Bug Fixes

* **data-manipulation:** resolve eslint and type-safety issues ([f1682c2](https://github.com/visulima/visulima/commit/f1682c2611cbcc6c85d4bbea520d43464b42e7ee))
* **humanizer:** resolve eslint and formatting issues ([18e63f7](https://github.com/visulima/visulima/commit/18e63f701b8a75ba9d24bee32d38a59304a1bbc4))

## @visulima/humanizer [3.0.0-alpha.9](https://github.com/visulima/visulima/compare/@visulima/humanizer@3.0.0-alpha.8...@visulima/humanizer@3.0.0-alpha.9) (2026-04-08)

### Bug Fixes

* **humanizer:** properly fix eslint errors in code ([cb00491](https://github.com/visulima/visulima/commit/cb00491092837af7e1fb519e7fee4d1567f51e34))
* **humanizer:** remove remaining eslint suppressions with proper code fixes ([ec9c058](https://github.com/visulima/visulima/commit/ec9c058bcd0524c6843198679faad9f9f8b546e0))
* **humanizer:** resolve eslint errors ([4dea64f](https://github.com/visulima/visulima/commit/4dea64f9cd70b6d6a485c59993a6b26c2a15ea7f))
* resolve failing tests across multiple packages ([2b4b6f0](https://github.com/visulima/visulima/commit/2b4b6f04169b60fdc4cf77b293015436a272c0fb))

### Miscellaneous Chores

* **data-manipulation:** remove empty dependency objects from package.json ([c0e8f76](https://github.com/visulima/visulima/commit/c0e8f7689a2da413f771494f6ecb07babc4b5e06))
* **humanizer:** add tsconfig.eslint.json for type-aware linting ([3c39145](https://github.com/visulima/visulima/commit/3c391453b8ad7a75598384a152e62cd4d44141ca))
* **humanizer:** apply prettier formatting ([f66629e](https://github.com/visulima/visulima/commit/f66629e5138777948bc3bef31eb17d8f27aa120e))
* **humanizer:** migrate .prettierrc.cjs to prettier.config.js ([85c09a7](https://github.com/visulima/visulima/commit/85c09a74f03e3d6450b9ec25a97b5a4123ca2ea4))

## @visulima/humanizer [3.0.0-alpha.8](https://github.com/visulima/visulima/compare/@visulima/humanizer@3.0.0-alpha.7...@visulima/humanizer@3.0.0-alpha.8) (2026-03-26)

### Features

* **web:** auto-generate packages page from workspace metadata ([623e520](https://github.com/visulima/visulima/commit/623e5207693a7fe720f5f2f179593a3654c880e3))

## @visulima/humanizer [3.0.0-alpha.7](https://github.com/visulima/visulima/compare/@visulima/humanizer@3.0.0-alpha.6...@visulima/humanizer@3.0.0-alpha.7) (2026-03-26)

### Bug Fixes

* **web:** improve build setup with incremental stats caching and prod install ([fe33e75](https://github.com/visulima/visulima/commit/fe33e75827586779b4b3a0c6d57b39f889ee6207))

### Miscellaneous Chores

* **humanizer:** migrate deps to pnpm catalogs ([f731305](https://github.com/visulima/visulima/commit/f73130503a2cd7caa211799e668ede30b40844b4))
* **humanizer:** update dependencies ([48f5e2c](https://github.com/visulima/visulima/commit/48f5e2c4f16bd4503722644043dce08967193634))
* visulima website ([#591](https://github.com/visulima/visulima/issues/591)) ([59ab2e2](https://github.com/visulima/visulima/commit/59ab2e2befb03e51cd2088956f83d9b87de6d033))

## @visulima/humanizer [3.0.0-alpha.6](https://github.com/visulima/visulima/compare/@visulima/humanizer@3.0.0-alpha.5...@visulima/humanizer@3.0.0-alpha.6) (2026-03-06)

### Bug Fixes

* **humanizer:** update packem to 2.0.0-alpha.54 ([f38a2ba](https://github.com/visulima/visulima/commit/f38a2baf3067292f65ded370fa2194bab518ee3c))

### Documentation

* **humanizer,html,iso-locale,package,tsconfig:** add comprehensive Fumadocs documentation ([19781ce](https://github.com/visulima/visulima/commit/19781ce5d27605971a9f2fdf0a99863effd98091))

### Miscellaneous Chores

* **data-manipulation:** update dependencies ([49458ab](https://github.com/visulima/visulima/commit/49458ab8f8e17d875840b1b4fe8b5efe12ff3513))
* **humanizer:** update dependencies ([70c666e](https://github.com/visulima/visulima/commit/70c666ee1f7dcf5cf6a7fde56b2763ea3f037dd7))
* **humanizer:** update dependencies ([d536412](https://github.com/visulima/visulima/commit/d5364126592f69e4ac06af6f692842aa9c971c82))
* update lock file maintenance ([d83e716](https://github.com/visulima/visulima/commit/d83e71697b75d24704185b66bb521a934d2db02d))
* year update ([47f4105](https://github.com/visulima/visulima/commit/47f410596ce7190cfea36a073db32e0cec50bbcd))

## @visulima/humanizer [3.0.0-alpha.5](https://github.com/visulima/visulima/compare/@visulima/humanizer@3.0.0-alpha.4...@visulima/humanizer@3.0.0-alpha.5) (2025-12-27)

### Bug Fixes

* **humanizer:** update package files ([f370cff](https://github.com/visulima/visulima/commit/f370cff64a0c065ca66f87ffbbd5f7d20cc41a8f))

### Miscellaneous Chores

* fixed project.json names and schema path ([964722f](https://github.com/visulima/visulima/commit/964722f691db205c7edb9aa6db29e849a647500b))

## @visulima/humanizer [3.0.0-alpha.4](https://github.com/visulima/visulima/compare/@visulima/humanizer@3.0.0-alpha.3...@visulima/humanizer@3.0.0-alpha.4) (2025-12-11)

### Bug Fixes

* update package OG images across multiple packages ([f08e4dd](https://github.com/visulima/visulima/commit/f08e4dd2b105ccb29c8412020a9c2be36d6c1e9e))

## @visulima/humanizer [3.0.0-alpha.3](https://github.com/visulima/visulima/compare/@visulima/humanizer@3.0.0-alpha.2...@visulima/humanizer@3.0.0-alpha.3) (2025-12-10)

### Bug Fixes

* update Romanian duration translations and improve unit handling ([f553b09](https://github.com/visulima/visulima/commit/f553b09e0d001853a88223d456bcb1709415667d))

## @visulima/humanizer [3.0.0-alpha.2](https://github.com/visulima/visulima/compare/@visulima/humanizer@3.0.0-alpha.1...@visulima/humanizer@3.0.0-alpha.2) (2025-12-06)

### Bug Fixes

* add new package image, fixed readme rendering on npm, fixed building of packages ([b790ba2](https://github.com/visulima/visulima/commit/b790ba253ea07fef83528fd822a678facf021b5f))

### Miscellaneous Chores

* update @anolilab/semantic-release-pnpm and @anolilab/semantic-release-preset to versions 3.2.2 and 12.1.2 across multiple package.json files for improved compatibility ([3921626](https://github.com/visulima/visulima/commit/3921626141fe5da398749bf0ba675f1596f18afb))

## @visulima/humanizer [3.0.0-alpha.1](https://github.com/visulima/visulima/compare/@visulima/humanizer@2.0.5...@visulima/humanizer@3.0.0-alpha.1) (2025-12-04)

### ⚠ BREAKING CHANGES

* change min node version to 22.13

### Bug Fixes

* update Node.js engine version requirement to >=22.13 in multiple package.json files for improved compatibility ([b828e9a](https://github.com/visulima/visulima/commit/b828e9aeaebfc798eecddccd90e6ec7560c6d36a))

### Miscellaneous Chores

* moved all packages into groups ([0615e9d](https://github.com/visulima/visulima/commit/0615e9d14a8a886e11da529ce150cf31ca973c10))
* update dependencies across multiple packages to improve compatibility and performance, including upgrading `@anolilab/semantic-release-pnpm` and `@anolilab/semantic-release-preset` to versions 3.2.0 and 12.1.0 respectively, and updating `react`, `react-dom`, and `next` versions to 19.2.1 and 16.0.7 in various package.json files ([aee8fcd](https://github.com/visulima/visulima/commit/aee8fcd796ae9b8d055903260e7150996ea9f53d))

## @visulima/humanizer [2.0.5](https://github.com/visulima/visulima/compare/@visulima/humanizer@2.0.4...@visulima/humanizer@2.0.5) (2025-11-13)

### Bug Fixes

* bump packem, to fix minified version of the code ([2a36ceb](https://github.com/visulima/visulima/commit/2a36ceb09251b0ca1178701a26547a871ed717a7))

## @visulima/humanizer [2.0.4](https://github.com/visulima/visulima/compare/@visulima/humanizer@2.0.3...@visulima/humanizer@2.0.4) (2025-11-12)

### Bug Fixes

* update package configurations and TypeScript definitions ([b59aa59](https://github.com/visulima/visulima/commit/b59aa59dac1508216b944f4b917fb4a7ab1f70a4))

### Miscellaneous Chores

* Add jsr file to all packages for release ([#565](https://github.com/visulima/visulima/issues/565)) ([ec91652](https://github.com/visulima/visulima/commit/ec91652b4e4112adf14ba152c1239a7703ba425a))
* update license files and clean up TypeScript definitions ([fe668cc](https://github.com/visulima/visulima/commit/fe668cc26de23591d4df54a0954455ebbe31b22d))

## @visulima/humanizer [2.0.3](https://github.com/visulima/visulima/compare/@visulima/humanizer@2.0.2...@visulima/humanizer@2.0.3) (2025-11-07)

### Bug Fixes

* update TypeScript configurations and improve linting across multiple packages ([6f25ec7](https://github.com/visulima/visulima/commit/6f25ec7841da7246f8f9166efc5292a7089d37ee))

### Miscellaneous Chores

* update npm and pnpm configurations for monorepo optimization ([#564](https://github.com/visulima/visulima/issues/564)) ([5512b42](https://github.com/visulima/visulima/commit/5512b42f672c216b6a3c9e39035199a4ebd9a4b8))

## @visulima/humanizer [2.0.2](https://github.com/visulima/visulima/compare/@visulima/humanizer@2.0.1...@visulima/humanizer@2.0.2) (2025-11-05)

### Bug Fixes

* update dependencies across multiple packages ([36a47f2](https://github.com/visulima/visulima/commit/36a47f26d65d25a7b4d8371186710e7d0ab61a2b))

### Miscellaneous Chores

* update dependencies across multiple packages ([c526462](https://github.com/visulima/visulima/commit/c52646260c2ae8bbf85692e642f305f47a158d4e))
* update package dependencies and configurations ([7bfe7e7](https://github.com/visulima/visulima/commit/7bfe7e71869580900aab50efb064b4293994ed9a))

## @visulima/humanizer [2.0.1](https://github.com/visulima/visulima/compare/@visulima/humanizer@2.0.0...@visulima/humanizer@2.0.1) (2025-10-21)

### Bug Fixes

* allow node v25 and updated dev deps ([8158cc5](https://github.com/visulima/visulima/commit/8158cc53ec92bd0331e8c6bd0fcbc8ab61b9320f))

### Miscellaneous Chores

* **deps:** update package versions and dependencies ([88d8d32](https://github.com/visulima/visulima/commit/88d8d32c4629a7a06c8770369191da2cc81087cc))
* update license years and add validation rules ([b97811e](https://github.com/visulima/visulima/commit/b97811ed2d253d908c0d86b4579a0a6bc33673a8))
* update package dependencies across multiple packages ([17e3f23](https://github.com/visulima/visulima/commit/17e3f2377c8a3f98e2eed2192c5adaf6e32558b5))

## @visulima/humanizer [2.0.0](https://github.com/visulima/visulima/compare/@visulima/humanizer@1.3.0...@visulima/humanizer@2.0.0) (2025-10-15)

### ⚠ BREAKING CHANGES

* Changed the node engine requirement to min 20.19

### Features

* Changed the node engine requirement to support newer versions. ([6566972](https://github.com/visulima/visulima/commit/6566972f7ba11603739da8cfbae35e26a419bbac))

### Bug Fixes

* update @visulima/packem to 2.0.0-alpha.32 across multiple packages for improved compatibility ([27b346e](https://github.com/visulima/visulima/commit/27b346eaa1c0fb0e420d9a9824482028307f4249))

### Miscellaneous Chores

* refine ESLint commands and improve packem.config.ts formatting ([459c417](https://github.com/visulima/visulima/commit/459c417eff734df032e133e73e00111082651251))
* remove deprecated @babel/core dependency and update packem configuration ([7c89a4f](https://github.com/visulima/visulima/commit/7c89a4f840ec273a8da6c88c0ec1b9cc2101ef0d))
* update package dependencies across multiple packages for improved compatibility and performance ([9567591](https://github.com/visulima/visulima/commit/9567591c415da3002f3a4fe08f8caf7ce01ca5f7))

## @visulima/humanizer [1.3.0](https://github.com/visulima/visulima/compare/@visulima/humanizer@1.2.2...@visulima/humanizer@1.3.0) (2025-09-24)

### Features

* **humanizer:** Added new language support for Serbian (Latin) in `src/language/sr_Latn.ts`. ([b7e0413](https://github.com/visulima/visulima/commit/b7e0413eb98707a4030415fc75096572835e7092))

### Bug Fixes

* **humanizer:** restore 'require' exports for types and default files in package.json ([be263a7](https://github.com/visulima/visulima/commit/be263a7649b852dd62cc40f9f0cf0370416f1f84))

### Miscellaneous Chores

* **deps:** update build scripts and remove cross-env dependency ([7510e82](https://github.com/visulima/visulima/commit/7510e826b9235a0013fe61c82a7eb333bc4cbb78))
* update package.json and pnpm-lock.yaml to include publint@0.3.12 and adjust build/test commands to exclude shared-utils ([1f7b3c0](https://github.com/visulima/visulima/commit/1f7b3c0381d77edfeec80ea1bf57b3469e929414))

## @visulima/humanizer [1.2.2](https://github.com/visulima/visulima/compare/@visulima/humanizer@1.2.1...@visulima/humanizer@1.2.2) (2025-06-04)


### Dependencies

* **@visulima/path:** upgraded to 1.4.0

## @visulima/humanizer [1.2.1](https://github.com/visulima/visulima/compare/@visulima/humanizer@1.2.0...@visulima/humanizer@1.2.1) (2025-05-30)

### Bug Fixes

* **humanizer:** update dependencies ([6782034](https://github.com/visulima/visulima/commit/6782034653ef55705aa209c3597172bdded11775))


### Dependencies

* **@visulima/path:** upgraded to 1.3.6

## @visulima/humanizer [1.2.0](https://github.com/visulima/visulima/compare/@visulima/humanizer@1.1.2...@visulima/humanizer@1.2.0) (2025-05-04)

### Features

* **humanizer:** update duration language files and add parseDuration ([#500](https://github.com/visulima/visulima/issues/500)) ([406c965](https://github.com/visulima/visulima/commit/406c965b188195fc00758caed6c802403c5446cb))

### Miscellaneous Chores

* updated dev dependencies ([2433ed5](https://github.com/visulima/visulima/commit/2433ed5fb662e0303c37edee8ddc21b46c21263f))

## @visulima/humanizer [1.1.2](https://github.com/visulima/visulima/compare/@visulima/humanizer@1.1.1...@visulima/humanizer@1.1.2) (2025-03-07)

### Bug Fixes

* updated @visulima/packem and other dev deps, for better bundling size ([e940581](https://github.com/visulima/visulima/commit/e9405812201594e54dd81d17ddb74177df5f3c24))

### Miscellaneous Chores

* updated dev dependencies ([487a976](https://github.com/visulima/visulima/commit/487a976932dc7c39edfc19ffd3968960ff338066))


### Dependencies

* **@visulima/path:** upgraded to 1.3.5

## @visulima/humanizer [1.1.1](https://github.com/visulima/visulima/compare/@visulima/humanizer@1.1.0...@visulima/humanizer@1.1.1) (2025-01-25)

### Bug Fixes

* fixed wrong node version range in package.json ([4ae2929](https://github.com/visulima/visulima/commit/4ae292984681c71a770e4d4560432f7b7c5a141a))

### Styles

* **humanizer:** cs fixes ([7302f3e](https://github.com/visulima/visulima/commit/7302f3e53f7c68018b8309f5487eed62734aeb5d))

### Miscellaneous Chores

* fixed typescript url ([fe65a8c](https://github.com/visulima/visulima/commit/fe65a8c0296ece7ee26474c70d065b06d4d0da89))
* updated all dev dependencies ([37fb298](https://github.com/visulima/visulima/commit/37fb298b2af7c63be64252024e54bb3af6ddabec))
* updated all dev dependencies and all dependencies in the app folder ([87f4ccb](https://github.com/visulima/visulima/commit/87f4ccbf9f7900ec5b56f3c1477bc4a0ef571bcf))


### Dependencies

* **@visulima/path:** upgraded to 1.3.4

## @visulima/humanizer [1.1.0](https://github.com/visulima/visulima/compare/@visulima/humanizer@1.0.20...@visulima/humanizer@1.1.0) (2025-01-19)

### Features

* **humanizer:** added new units to parseBytes and formatBytes ([499fe1d](https://github.com/visulima/visulima/commit/499fe1d53e9b9aef5fdc65d2d9f3badc98f86a5a))

## @visulima/humanizer [1.0.20](https://github.com/visulima/visulima/compare/@visulima/humanizer@1.0.19...@visulima/humanizer@1.0.20) (2025-01-13)


### Dependencies

* **@visulima/path:** upgraded to 1.3.3

## @visulima/humanizer [1.0.19](https://github.com/visulima/visulima/compare/@visulima/humanizer@1.0.18...@visulima/humanizer@1.0.19) (2025-01-12)

### Bug Fixes

* updated @visulima/packem, and all other dev dependencies ([7797a1c](https://github.com/visulima/visulima/commit/7797a1c3e6f1fc532895247bd88285a8a9883c40))


### Dependencies

* **@visulima/path:** upgraded to 1.3.2

## @visulima/humanizer [1.0.18](https://github.com/visulima/visulima/compare/@visulima/humanizer@1.0.17...@visulima/humanizer@1.0.18) (2025-01-08)


### Dependencies

* **@visulima/path:** upgraded to 1.3.1

## @visulima/humanizer [1.0.17](https://github.com/visulima/visulima/compare/@visulima/humanizer@1.0.16...@visulima/humanizer@1.0.17) (2025-01-08)


### Dependencies

* **@visulima/path:** upgraded to 1.3.0

## @visulima/humanizer [1.0.16](https://github.com/visulima/visulima/compare/@visulima/humanizer@1.0.15...@visulima/humanizer@1.0.16) (2024-12-31)

### Miscellaneous Chores

* updated dev dependencies ([9de2eab](https://github.com/visulima/visulima/commit/9de2eab91e95c8b9289d12f863a5167218770650))


### Dependencies

* **@visulima/path:** upgraded to 1.2.0

## @visulima/humanizer [1.0.15](https://github.com/visulima/visulima/compare/@visulima/humanizer@1.0.14...@visulima/humanizer@1.0.15) (2024-12-12)

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

* **@visulima/path:** upgraded to 1.1.2

## @visulima/humanizer [1.0.14](https://github.com/visulima/visulima/compare/@visulima/humanizer@1.0.13...@visulima/humanizer@1.0.14) (2024-10-05)


### Dependencies

* **@visulima/path:** upgraded to 1.1.1

## @visulima/humanizer [1.0.13](https://github.com/visulima/visulima/compare/@visulima/humanizer@1.0.12...@visulima/humanizer@1.0.13) (2024-10-05)

### Bug Fixes

* updated dev dependencies, updated packem to v1.0.7, fixed naming of some lint config files ([c071a9c](https://github.com/visulima/visulima/commit/c071a9c8e129014a962ff654a16f302ca18a5c67))


### Dependencies

* **@visulima/path:** upgraded to 1.1.0

## @visulima/humanizer [1.0.12](https://github.com/visulima/visulima/compare/@visulima/humanizer@1.0.11...@visulima/humanizer@1.0.12) (2024-09-24)

### Bug Fixes

* update packem to v1 ([05f3bc9](https://github.com/visulima/visulima/commit/05f3bc960df10a1602e24f9066e2b0117951a877))
* updated esbuild from v0.23 to v0.24 ([3793010](https://github.com/visulima/visulima/commit/3793010d0d549c0d41f85dea04b8436251be5fe8))

### Miscellaneous Chores

* updated dev dependencies ([05edb67](https://github.com/visulima/visulima/commit/05edb671285b1cc42875223314b24212e6a12588))


### Dependencies

* **@visulima/path:** upgraded to 1.0.9

## @visulima/humanizer [1.0.11](https://github.com/visulima/visulima/compare/@visulima/humanizer@1.0.10...@visulima/humanizer@1.0.11) (2024-09-11)

### Bug Fixes

* fixed node10 support ([f5e78d9](https://github.com/visulima/visulima/commit/f5e78d9bff8fd603967666598b34f9338a8726b5))

### Miscellaneous Chores

* updated dev dependencies ([28b5ee5](https://github.com/visulima/visulima/commit/28b5ee5c805ca8868536418829cde7ba8c5bb8dd))


### Dependencies

* **@visulima/path:** upgraded to 1.0.8

## @visulima/humanizer [1.0.10](https://github.com/visulima/visulima/compare/@visulima/humanizer@1.0.9...@visulima/humanizer@1.0.10) (2024-09-07)

### Bug Fixes

* fixed broken chunk splitting from packem ([1aaf277](https://github.com/visulima/visulima/commit/1aaf27779292d637923c5f8a220e18606e78caa2))


### Dependencies

* **@visulima/path:** upgraded to 1.0.7

## @visulima/humanizer [1.0.9](https://github.com/visulima/visulima/compare/@visulima/humanizer@1.0.8...@visulima/humanizer@1.0.9) (2024-09-07)

### Bug Fixes

* added types support for node10 ([604583f](https://github.com/visulima/visulima/commit/604583fa3c24b950fafad45d17e7a1333040fd76))

### Miscellaneous Chores

* update dev dependencies ([0738f98](https://github.com/visulima/visulima/commit/0738f9810478bb215ce4b2571dc8874c4c503089))


### Dependencies

* **@visulima/path:** upgraded to 1.0.6

## @visulima/humanizer [1.0.8](https://github.com/visulima/visulima/compare/@visulima/humanizer@1.0.7...@visulima/humanizer@1.0.8) (2024-08-30)

### Miscellaneous Chores

* updated dev dependencies ([45c2a76](https://github.com/visulima/visulima/commit/45c2a76bc974ecb2c6b172c3af03373d4cc6a5ce))


### Dependencies

* **@visulima/path:** upgraded to 1.0.5

## @visulima/humanizer [1.0.7](https://github.com/visulima/visulima/compare/@visulima/humanizer@1.0.6...@visulima/humanizer@1.0.7) (2024-08-04)


### Dependencies

* **@visulima/path:** upgraded to 1.0.4

## @visulima/humanizer [1.0.6](https://github.com/visulima/visulima/compare/@visulima/humanizer@1.0.5...@visulima/humanizer@1.0.6) (2024-08-01)

### Bug Fixes

* upgraded @visulima/packem ([dc0cb57](https://github.com/visulima/visulima/commit/dc0cb5701b30f3f81404346c909fd4daf891b894))

### Styles

* cs fixes ([6f727ec](https://github.com/visulima/visulima/commit/6f727ec36437384883ca4b764d920cf03ffe44df))
* cs fixes ([253af1e](https://github.com/visulima/visulima/commit/253af1e788c9544a2286dc0018c6549f62ca6c7b))

### Miscellaneous Chores

* added private true into fixture package.json files ([4a9494c](https://github.com/visulima/visulima/commit/4a9494c642fa98f224505a1d231b5af4e73d6c79))
* changed typescript version back to 5.4.5 ([55d28bb](https://github.com/visulima/visulima/commit/55d28bbdc103718d19f844034b38a0e8e5af798a))
* updated all dev deps ([ef143ce](https://github.com/visulima/visulima/commit/ef143ce2e15952a0910aa5c8bd78d25de9ebd7f3))
* updated dev dependencies ([ac67ec1](https://github.com/visulima/visulima/commit/ac67ec1bcba16175d225958e318199f60b10d179))
* updated dev dependencies ([34df456](https://github.com/visulima/visulima/commit/34df4569f2fc074823a406c44a131c8fbae2b147))
* updated dev dependencies and sorted the package.json ([9571572](https://github.com/visulima/visulima/commit/95715725a8ed053ca24fd1405a55205c79342ecb))

### Build System

* fixed found audit error, updated all dev package deps, updated deps in apps and examples ([4c51950](https://github.com/visulima/visulima/commit/4c519500dc5504579d35725572920658999885cb))


### Dependencies

* **@visulima/path:** upgraded to 1.0.3

## @visulima/humanizer [1.0.5](https://github.com/visulima/visulima/compare/@visulima/humanizer@1.0.4...@visulima/humanizer@1.0.5) (2024-06-06)


### Bug Fixes

* allow node v22 ([890d457](https://github.com/visulima/visulima/commit/890d4570f18428e2463944813c0c638b3f142803))



### Dependencies

* **@visulima/path:** upgraded to 1.0.2

## @visulima/humanizer [1.0.4](https://github.com/visulima/visulima/compare/@visulima/humanizer@1.0.3...@visulima/humanizer@1.0.4) (2024-06-05)


### Bug Fixes

* **humanizer:** hide unit count with dual forms if arabic translation is used, thanks to [@6km](https://github.com/6km) ([ee23b9e](https://github.com/visulima/visulima/commit/ee23b9edaf9e7e22f356aaa91c46ee3fa1aad531))
* **humanizer:** switching from tsup to packem ([8322fc6](https://github.com/visulima/visulima/commit/8322fc69d82531ff4fe18ac46b4e0fb0305bc657))


### Miscellaneous Chores

* updated dev dependencies ([a2e0504](https://github.com/visulima/visulima/commit/a2e0504dc239049434c2482756ff15bdbaac9b54))

## @visulima/humanizer [1.0.3](https://github.com/visulima/visulima/compare/@visulima/humanizer@1.0.2...@visulima/humanizer@1.0.3) (2024-05-24)


### Bug Fixes

* **humanizer:** added Unlicense for the duration functions ([72ff020](https://github.com/visulima/visulima/commit/72ff0200be90e9707bea8606a03bd6091b229f43))

## @visulima/humanizer [1.0.2](https://github.com/visulima/visulima/compare/@visulima/humanizer@1.0.1...@visulima/humanizer@1.0.2) (2024-05-24)


### Bug Fixes

* changed pathe to @visulima/path ([#410](https://github.com/visulima/visulima/issues/410)) ([bfe1287](https://github.com/visulima/visulima/commit/bfe1287aff6d28d5dca302fd4d58c1f6234ce0bb))


### Styles

* cs fixes ([7bf5b91](https://github.com/visulima/visulima/commit/7bf5b91383b612598d955fe23505c94f22a8d277))


### Miscellaneous Chores

* changed semantic-release-npm to pnpm ([b6d100a](https://github.com/visulima/visulima/commit/b6d100a2bf3fd026577be48726a37754947f0973))
* **deps:** updated dev deps ([d91ac38](https://github.com/visulima/visulima/commit/d91ac389cea85a6c6bdc8de97905252a6c467abc))
* downgrade eslint-plugin-vitest ([0162771](https://github.com/visulima/visulima/commit/0162771e6022e4594486a796bc41e91a2d87bcd8))
* fixed wrong named folders to integration, added TEST_PROD_BUILD ([1b826f5](https://github.com/visulima/visulima/commit/1b826f5baf8285847199de9ede8fbdbadf201ad6))
* update dev dependencies ([068bdbf](https://github.com/visulima/visulima/commit/068bdbfe0b371b5cc7e5ac071dc3310a3b8cea98))
* update dev dependencies ([09c4854](https://github.com/visulima/visulima/commit/09c4854e221fa8b808dfe66d7196d8db2a39b366))
* updated dev dependencies ([2e08f23](https://github.com/visulima/visulima/commit/2e08f23ba4f23ff4c64a36807b53242e9497c073))
* updated dev dependencies ([abd319c](https://github.com/visulima/visulima/commit/abd319c23576aa1dc751ac874e806bddbc977d51))
* updated dev dependencies ([0767afe](https://github.com/visulima/visulima/commit/0767afe9be83da6698c1343724400171f952599e))
* updated dev dependencies ([d7791e3](https://github.com/visulima/visulima/commit/d7791e327917e438757636573b1e5549a97bba7b))
* updated dev dependencies ([6005345](https://github.com/visulima/visulima/commit/60053456717a3889fc77b4fb5b05d50a662475b2))
* updated dev dependencies ([87dee15](https://github.com/visulima/visulima/commit/87dee156e797b5dee2557a09ad32c935d851847c))
* updated dev dependencies ([bf2c635](https://github.com/visulima/visulima/commit/bf2c635859601cc97858226e70f47219eabc213e))
* updated dev dependencies ([f67c7f1](https://github.com/visulima/visulima/commit/f67c7f14ecc328ed91d06d01ac6514e8bce72cb4))



### Dependencies

* **@visulima/path:** upgraded to 1.0.1

## @visulima/humanizer [1.0.1](https://github.com/visulima/visulima/compare/@visulima/humanizer@1.0.0...@visulima/humanizer@1.0.1) (2024-03-29)


### Bug Fixes

* **humanizer:** fixed language export for duration ([266cfed](https://github.com/visulima/visulima/commit/266cfed81c6e0d6839fc505f2511384c21fa4eb6))

## @visulima/humanizer 1.0.0 (2024-03-29)


### Features

* adding humanizer package ([#384](https://github.com/visulima/visulima/issues/384)) ([eeea745](https://github.com/visulima/visulima/commit/eeea7457ead1304f2aa8c0d90b84c69d6c93d176))
