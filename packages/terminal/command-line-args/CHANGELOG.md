## @visulima/command-line-args [2.0.0](https://github.com/visulima/visulima/compare/@visulima/command-line-args@1.0.4...@visulima/command-line-args@2.0.0) (2026-07-03)

### ⚠ BREAKING CHANGES

* change min node version to 22.13

### Features

* **command-line-args:** fix proto-key bug, add negation/strictTypes/typed results ([ae1f7a6](https://github.com/visulima/visulima/commit/ae1f7a693c7a6c85c1df188cd12688387eeda2d8))
* **web:** auto-generate packages page from workspace metadata ([623e520](https://github.com/visulima/visulima/commit/623e5207693a7fe720f5f2f179593a3654c880e3))

### Bug Fixes

* add new package image, fixed readme rendering on npm, fixed building of packages ([b790ba2](https://github.com/visulima/visulima/commit/b790ba253ea07fef83528fd822a678facf021b5f))
* **command-line-args:** 3 bug fixes ([d84178a](https://github.com/visulima/visulima/commit/d84178ad6f9e062404bb32b2a6918f18ab4b9e31))
* **command-line-args:** fix dts build for parseArgs and InferOptionValue ([ed9ef1f](https://github.com/visulima/visulima/commit/ed9ef1fceab78fbf9e2714115241e2e38c4b2fe6))
* **command-line-args:** parse known options after defaultOption positional values ([da113c3](https://github.com/visulima/visulima/commit/da113c3c93158e10f276d128b3f6ab1fcae3a5f0))
* **command-line-args:** properly fix eslint errors in code ([21f3df6](https://github.com/visulima/visulima/commit/21f3df64802293cbae00db8e0b81c0bd4145dd88))
* **command-line-args:** resolve eslint and formatting issues ([3b4eff6](https://github.com/visulima/visulima/commit/3b4eff6c21e2cb8c8c2fd66d5629cc6d757bc149))
* **command-line-args:** resolve eslint and formatting issues ([389f5f5](https://github.com/visulima/visulima/commit/389f5f5d93b257bc4277cbe0155f729dd502fc9a))
* **command-line-args:** resolve eslint errors ([f76440c](https://github.com/visulima/visulima/commit/f76440cc9b27cdbd29eb20ba0c6040129888517c))
* **command-line-args:** update package files ([de998ec](https://github.com/visulima/visulima/commit/de998ec2f22b5776f3e250f9ead9da6870fa6a15))
* **command-line-args:** update packem to 2.0.0-alpha.54 ([28d090d](https://github.com/visulima/visulima/commit/28d090d3944951ec9de7ee2d8f579f6785607f9f))
* **command-line-args:** use workspace:* for internal [@visulima](https://github.com/visulima) deps ([956db26](https://github.com/visulima/visulima/commit/956db26c5324081a099db9d3961e27274c0572d2))
* **lint:** clear pre-existing eslint rot across packages ([#674](https://github.com/visulima/visulima/issues/674)) ([5354253](https://github.com/visulima/visulima/commit/5354253b163bd50bcefaf8a3fddf831bdb5df32b))
* Remove JSR configuration generation script and generated jsr.json files ([#616](https://github.com/visulima/visulima/issues/616)) ([533744b](https://github.com/visulima/visulima/commit/533744b103b74896941db5b727173e617a27a63b))
* **storage-client:** percent-encode user fields in defaultFingerprint ([7c78a0f](https://github.com/visulima/visulima/commit/7c78a0f9512e2a673b941d80839e9f1e86b7b5d0))
* **terminal:** resolve eslint and formatting issues ([12ef283](https://github.com/visulima/visulima/commit/12ef283684d1808fbcfe44077a0cfe8324801485))
* **terminal:** resolve eslint and formatting issues ([8f30389](https://github.com/visulima/visulima/commit/8f30389deb9ff81e7afce0aa064ef11fcb179f23))
* update Node.js engine version requirement to >=22.13 in multiple package.json files for improved compatibility ([b828e9a](https://github.com/visulima/visulima/commit/b828e9aeaebfc798eecddccd90e6ec7560c6d36a))
* update package OG images across multiple packages ([f08e4dd](https://github.com/visulima/visulima/commit/f08e4dd2b105ccb29c8412020a9c2be36d6c1e9e))
* update package.json description and keywords ([#578](https://github.com/visulima/visulima/issues/578)) ([154709c](https://github.com/visulima/visulima/commit/154709c05e71d1ffd3e360b27e12febd817912f0))
* **web:** improve build setup with incremental stats caching and prod install ([fe33e75](https://github.com/visulima/visulima/commit/fe33e75827586779b4b3a0c6d57b39f889ee6207))

### Documentation

* **boxen,command-line-args,tabular,is-ansi-color-supported,disposable-email-domains:** add comprehensive Fumadocs documentation ([95e0578](https://github.com/visulima/visulima/commit/95e057833978dfeeb9f2768269e36862572539db))

### Miscellaneous Chores

* add fallow code-intelligence across all packages ([a3b4821](https://github.com/visulima/visulima/commit/a3b48215002e86fed20f2973038b5d4a0aa1ce04))
* apply eslint + prettier autofixes across packages ([c1bb784](https://github.com/visulima/visulima/commit/c1bb7848a0d93d0dfe2960c77e3cda22239c79a0))
* apply safe prettier and eslint formatting ([05120af](https://github.com/visulima/visulima/commit/05120af8c898d18c495575680f01134681e29b65))
* bump engines.node to ^22.14.0 || >=24.10.0 ([c3d0931](https://github.com/visulima/visulima/commit/c3d0931d1504e4f21ebf50ea680cfa7ce4ba15ce))
* **ci-stability:** green CI across vis, native, lint, tests, attw ([#651](https://github.com/visulima/visulima/issues/651)) ([d4eb684](https://github.com/visulima/visulima/commit/d4eb684b5f75c818c9251048c605a0ed54a268e3))
* **command-line-args:** add tsconfig.eslint.json for type-aware linting ([b6b91bc](https://github.com/visulima/visulima/commit/b6b91bc7fcc3de55cd432f6e5bbc01acd4b53918))
* **command-line-args:** apply formatter and lint fixes ([b19c9c8](https://github.com/visulima/visulima/commit/b19c9c89f2ebf163673301530ad3019852cdc564))
* **command-line-args:** apply pending changes ([f01a173](https://github.com/visulima/visulima/commit/f01a1738b1a28edcc9e90f6ea4e2453d079f0c7a))
* **command-line-args:** apply pending lint and source updates ([4da3c08](https://github.com/visulima/visulima/commit/4da3c08f0a33e0cdab91f4e7f7339cb3c1be6d16))
* **command-line-args:** apply prettier and eslint quote-style auto-fix ([43a56bd](https://github.com/visulima/visulima/commit/43a56bd6a70e2cdcec8b7c7f6edb02efc0280814))
* **command-line-args:** apply prettier formatting ([bbe507c](https://github.com/visulima/visulima/commit/bbe507c8bbdb2e2f24cde8eb1a78c0ef6b79b2d8))
* **command-line-args:** bump @visulima/error to 6.0.0-alpha.16 ([cb511da](https://github.com/visulima/visulima/commit/cb511da538c1311d977a04eb2b7d6ed3afae3f72))
* **command-line-args:** enforce curly braces and apply lint fixes ([e155340](https://github.com/visulima/visulima/commit/e155340c67d4287a749a340bfe916e383906eadf))
* **command-line-args:** fix lint errors ([e7f1f79](https://github.com/visulima/visulima/commit/e7f1f79b569e587959845a001c0b4cb9b1e1fcf4))
* **command-line-args:** migrate .prettierrc.cjs to prettier.config.js ([f1f4ab4](https://github.com/visulima/visulima/commit/f1f4ab4f77d14f0877311b0b943dc8ed37b1c73d))
* **command-line-args:** migrate deps to pnpm catalogs ([42a7190](https://github.com/visulima/visulima/commit/42a71907350c02ae8e0fb21e22fc3c95d49a3950))
* **command-line-args:** update dependencies ([31201e3](https://github.com/visulima/visulima/commit/31201e3ae4321e760588e5e4fa75459ee1a0e682))
* **command-line-args:** update dependencies ([5f8ae63](https://github.com/visulima/visulima/commit/5f8ae6341e8ed6a1ef189cb5c3aa16fb3df45b66))
* **command-line-args:** update dependencies ([246e9b9](https://github.com/visulima/visulima/commit/246e9b9e96e29cc36981f3e6e00dafd9a6ab3443))
* **command-line-args:** upgrade packem to 2.0.0-alpha.76 ([8133f43](https://github.com/visulima/visulima/commit/8133f43adf813115ff94439a9e34278eeed29db1))
* **fallow:** resolve dead-code findings ([c4125d5](https://github.com/visulima/visulima/commit/c4125d53e03ac9d90115399634535991927a96cc))
* fixed jsr.json ([5d85e51](https://github.com/visulima/visulima/commit/5d85e5179de38e284ec433b14d77c71a1619c8d6))
* fixed project.json names and schema path ([964722f](https://github.com/visulima/visulima/commit/964722f691db205c7edb9aa6db29e849a647500b))
* moved all packages into groups ([0615e9d](https://github.com/visulima/visulima/commit/0615e9d14a8a886e11da529ce150cf31ca973c10))
* re-sort workspace package.json files via vis sort-package-json ([f625696](https://github.com/visulima/visulima/commit/f625696cfac974325774b3243e1a83c3d23acbd7))
* **release:** @visulima/command-line-args@2.0.0-alpha.1 [skip ci]\n\n## @visulima/command-line-args [2.0.0-alpha.1](https://github.com/visulima/visulima/compare/@visulima/command-line-args@1.0.4...@visulima/command-line-args@2.0.0-alpha.1) (2025-12-07) ([90b44b7](https://github.com/visulima/visulima/commit/90b44b799cac60818eb3b6ea44f0352df553efba))
* **release:** @visulima/command-line-args@2.0.0-alpha.10 [skip ci]\n\n## @visulima/command-line-args [2.0.0-alpha.10](https://github.com/visulima/visulima/compare/@visulima/command-line-args@2.0.0-alpha.9...@visulima/command-line-args@2.0.0-alpha.10) (2026-05-27) ([cca1ba7](https://github.com/visulima/visulima/commit/cca1ba73c7ca15844cb0d990a52989d84c85229b))
* **release:** @visulima/command-line-args@2.0.0-alpha.11 [skip ci]\n\n## @visulima/command-line-args [2.0.0-alpha.11](https://github.com/visulima/visulima/compare/@visulima/command-line-args@2.0.0-alpha.10...@visulima/command-line-args@2.0.0-alpha.11) (2026-06-04) ([402dc52](https://github.com/visulima/visulima/commit/402dc52e7f70410ab15453e656d0369654f78286))
* **release:** @visulima/command-line-args@2.0.0-alpha.12 [skip ci]\n\n## @visulima/command-line-args [2.0.0-alpha.12](https://github.com/visulima/visulima/compare/@visulima/command-line-args@2.0.0-alpha.11...@visulima/command-line-args@2.0.0-alpha.12) (2026-06-13) ([0fc2f97](https://github.com/visulima/visulima/commit/0fc2f97080785e1753ceeb0b76054b877fc1cdf7))
* **release:** @visulima/command-line-args@2.0.0-alpha.13 [skip ci]\n\n## @visulima/command-line-args [2.0.0-alpha.13](https://github.com/visulima/visulima/compare/@visulima/command-line-args@2.0.0-alpha.12...@visulima/command-line-args@2.0.0-alpha.13) (2026-06-19) ([61019b0](https://github.com/visulima/visulima/commit/61019b0fd078fb9f863b2f94823cc9056dc29542))
* **release:** @visulima/command-line-args@2.0.0-alpha.14 [skip ci]\n\n## @visulima/command-line-args [2.0.0-alpha.14](https://github.com/visulima/visulima/compare/@visulima/command-line-args@2.0.0-alpha.13...@visulima/command-line-args@2.0.0-alpha.14) (2026-06-30) ([e3eb1ea](https://github.com/visulima/visulima/commit/e3eb1ea34e8bcc36f69605c947d374b367efb6f3))
* **release:** @visulima/command-line-args@2.0.0-alpha.2 [skip ci]\n\n## @visulima/command-line-args [2.0.0-alpha.2](https://github.com/visulima/visulima/compare/@visulima/command-line-args@2.0.0-alpha.1...@visulima/command-line-args@2.0.0-alpha.2) (2025-12-11) ([c8b2471](https://github.com/visulima/visulima/commit/c8b2471431c99a9b1c15783d74ee0aa40747aad8))
* **release:** @visulima/command-line-args@2.0.0-alpha.3 [skip ci]\n\n## @visulima/command-line-args [2.0.0-alpha.3](https://github.com/visulima/visulima/compare/@visulima/command-line-args@2.0.0-alpha.2...@visulima/command-line-args@2.0.0-alpha.3) (2025-12-27) ([a6ebf93](https://github.com/visulima/visulima/commit/a6ebf930ca2dbe60c3e5bec2a4a9bc6856697fd5))
* **release:** @visulima/command-line-args@2.0.0-alpha.4 [skip ci]\n\n## @visulima/command-line-args [2.0.0-alpha.4](https://github.com/visulima/visulima/compare/@visulima/command-line-args@2.0.0-alpha.3...@visulima/command-line-args@2.0.0-alpha.4) (2026-03-06) ([647491b](https://github.com/visulima/visulima/commit/647491b74639428e52b8673f4269636634b62553))
* **release:** @visulima/command-line-args@2.0.0-alpha.5 [skip ci]\n\n## @visulima/command-line-args [2.0.0-alpha.5](https://github.com/visulima/visulima/compare/@visulima/command-line-args@2.0.0-alpha.4...@visulima/command-line-args@2.0.0-alpha.5) (2026-03-26) ([f574967](https://github.com/visulima/visulima/commit/f574967ae8121c9390e36714e9b09db7137f018d))
* **release:** @visulima/command-line-args@2.0.0-alpha.6 [skip ci]\n\n## @visulima/command-line-args [2.0.0-alpha.6](https://github.com/visulima/visulima/compare/@visulima/command-line-args@2.0.0-alpha.5...@visulima/command-line-args@2.0.0-alpha.6) (2026-03-26) ([192de62](https://github.com/visulima/visulima/commit/192de62edea7ab3c86d413e7b1ab936193f28fca))
* **release:** @visulima/command-line-args@2.0.0-alpha.7 [skip ci]\n\n## @visulima/command-line-args [2.0.0-alpha.7](https://github.com/visulima/visulima/compare/@visulima/command-line-args@2.0.0-alpha.6...@visulima/command-line-args@2.0.0-alpha.7) (2026-04-08) ([f0c1376](https://github.com/visulima/visulima/commit/f0c13768b9217532408371b333155c9779272fe0))
* **release:** @visulima/command-line-args@2.0.0-alpha.8 [skip ci]\n\n## @visulima/command-line-args [2.0.0-alpha.8](https://github.com/visulima/visulima/compare/@visulima/command-line-args@2.0.0-alpha.7...@visulima/command-line-args@2.0.0-alpha.8) (2026-04-21) ([d0e63e6](https://github.com/visulima/visulima/commit/d0e63e6ff472fee401ffaf27d880a2c9b4ec87b3))
* **release:** @visulima/command-line-args@2.0.0-alpha.9 [skip ci]\n\n## @visulima/command-line-args [2.0.0-alpha.9](https://github.com/visulima/visulima/compare/@visulima/command-line-args@2.0.0-alpha.8...@visulima/command-line-args@2.0.0-alpha.9) (2026-04-22) ([0ef40e5](https://github.com/visulima/visulima/commit/0ef40e54c5517bf1edf6d79870deca803c41a027))
* remove unused deprecated aliases ([#612](https://github.com/visulima/visulima/issues/612)) ([24ee546](https://github.com/visulima/visulima/commit/24ee546bcb2c17b8915622e4878797c00aa1d813))
* sorted package.json ([b47c545](https://github.com/visulima/visulima/commit/b47c545591600fdab17d5cd3a3fbc68b61e199da))
* **terminal:** apply prettier and eslint formatting sweep ([15fd89c](https://github.com/visulima/visulima/commit/15fd89c677eea60866e08e4fd5f5a6bc8f3bd2e5))
* **terminal:** remove empty dependency objects from package.json ([562c704](https://github.com/visulima/visulima/commit/562c704e5d90aa2d13eae942ebbdcfeb787c2b46))
* **terminal:** update dependencies ([a5bb91a](https://github.com/visulima/visulima/commit/a5bb91a66f2be2ade485d586156a54c347a23cc9))
* update @anolilab/semantic-release-pnpm and @anolilab/semantic-release-preset to versions 3.2.2 and 12.1.2 across multiple package.json files for improved compatibility ([3921626](https://github.com/visulima/visulima/commit/3921626141fe5da398749bf0ba675f1596f18afb))
* update dependencies across multiple packages to improve compatibility and performance, including upgrading `@anolilab/semantic-release-pnpm` and `@anolilab/semantic-release-preset` to versions 3.2.0 and 12.1.0 respectively, and updating `react`, `react-dom`, and `next` versions to 19.2.1 and 16.0.7 in various package.json files ([aee8fcd](https://github.com/visulima/visulima/commit/aee8fcd796ae9b8d055903260e7150996ea9f53d))
* update lock file maintenance ([d83e716](https://github.com/visulima/visulima/commit/d83e71697b75d24704185b66bb521a934d2db02d))
* update the jsr.json ([864ab7e](https://github.com/visulima/visulima/commit/864ab7e71c4b5ae82f64792d1ae8debfea2c539b))
* visulima website ([#591](https://github.com/visulima/visulima/issues/591)) ([59ab2e2](https://github.com/visulima/visulima/commit/59ab2e2befb03e51cd2088956f83d9b87de6d033))
* year update ([47f4105](https://github.com/visulima/visulima/commit/47f410596ce7190cfea36a073db32e0cec50bbcd))

### Code Refactoring

* **command-line-args:** apply prettier operator-linebreak style ([123db5d](https://github.com/visulima/visulima/commit/123db5d5f3f2aa679163955af625533e270804dc))

### Tests

* **command-line-args:** cover validation errors, boolean/number parsing, debug, and resolve edge cases ([dbebe1d](https://github.com/visulima/visulima/commit/dbebe1db1aeceece87bf08d79f6bc83dcc8effe0))
* **repo:** add dist runtime + types integration tests ([32ee300](https://github.com/visulima/visulima/commit/32ee300b7184117a0ddf9f9d390f75f8932d5ed9))

### Continuous Integration

* **fallow:** make fallow:health advisory (--report-only) ([d57148e](https://github.com/visulima/visulima/commit/d57148ea0e3556b4c24d8d336b9fa14987f5dc7d))
* integrate codspeed for benchmark tracking ([e758f3d](https://github.com/visulima/visulima/commit/e758f3da491cc00d3f8bbf10d7ba3fdf8deb5325))
* **lint:** raise eslint job timeout and cache slow per-package eslint runs ([#717](https://github.com/visulima/visulima/issues/717)) ([c93878d](https://github.com/visulima/visulima/commit/c93878dbfa1888cc834704448ae6eefd3098597e)), closes [#713](https://github.com/visulima/visulima/issues/713)


### Dependencies

* **@visulima/error:** upgraded to 6.0.0

## @visulima/command-line-args [2.0.0-alpha.14](https://github.com/visulima/visulima/compare/@visulima/command-line-args@2.0.0-alpha.13...@visulima/command-line-args@2.0.0-alpha.14) (2026-06-30)

### Miscellaneous Chores

* add fallow code-intelligence across all packages ([a3b4821](https://github.com/visulima/visulima/commit/a3b48215002e86fed20f2973038b5d4a0aa1ce04))
* **fallow:** resolve dead-code findings ([c4125d5](https://github.com/visulima/visulima/commit/c4125d53e03ac9d90115399634535991927a96cc))

### Continuous Integration

* **fallow:** make fallow:health advisory (--report-only) ([d57148e](https://github.com/visulima/visulima/commit/d57148ea0e3556b4c24d8d336b9fa14987f5dc7d))
* **lint:** raise eslint job timeout and cache slow per-package eslint runs ([#717](https://github.com/visulima/visulima/issues/717)) ([c93878d](https://github.com/visulima/visulima/commit/c93878dbfa1888cc834704448ae6eefd3098597e)), closes [#713](https://github.com/visulima/visulima/issues/713)


### Dependencies

* **@visulima/error:** upgraded to 6.0.0-alpha.35

## @visulima/command-line-args [2.0.0-alpha.13](https://github.com/visulima/visulima/compare/@visulima/command-line-args@2.0.0-alpha.12...@visulima/command-line-args@2.0.0-alpha.13) (2026-06-19)


### Dependencies

* **@visulima/error:** upgraded to 6.0.0-alpha.34

## @visulima/command-line-args [2.0.0-alpha.12](https://github.com/visulima/visulima/compare/@visulima/command-line-args@2.0.0-alpha.11...@visulima/command-line-args@2.0.0-alpha.12) (2026-06-13)

### Features

* **command-line-args:** fix proto-key bug, add negation/strictTypes/typed results ([ae1f7a6](https://github.com/visulima/visulima/commit/ae1f7a693c7a6c85c1df188cd12688387eeda2d8))

### Bug Fixes

* **command-line-args:** fix dts build for parseArgs and InferOptionValue ([ed9ef1f](https://github.com/visulima/visulima/commit/ed9ef1fceab78fbf9e2714115241e2e38c4b2fe6))

### Miscellaneous Chores

* apply safe prettier and eslint formatting ([05120af](https://github.com/visulima/visulima/commit/05120af8c898d18c495575680f01134681e29b65))

### Code Refactoring

* **command-line-args:** apply prettier operator-linebreak style ([123db5d](https://github.com/visulima/visulima/commit/123db5d5f3f2aa679163955af625533e270804dc))


### Dependencies

* **@visulima/error:** upgraded to 6.0.0-alpha.33

## @visulima/command-line-args [2.0.0-alpha.11](https://github.com/visulima/visulima/compare/@visulima/command-line-args@2.0.0-alpha.10...@visulima/command-line-args@2.0.0-alpha.11) (2026-06-04)

### Bug Fixes

* **command-line-args:** 3 bug fixes ([d84178a](https://github.com/visulima/visulima/commit/d84178ad6f9e062404bb32b2a6918f18ab4b9e31))
* **lint:** clear pre-existing eslint rot across packages ([#674](https://github.com/visulima/visulima/issues/674)) ([5354253](https://github.com/visulima/visulima/commit/5354253b163bd50bcefaf8a3fddf831bdb5df32b))

### Miscellaneous Chores

* apply eslint + prettier autofixes across packages ([c1bb784](https://github.com/visulima/visulima/commit/c1bb7848a0d93d0dfe2960c77e3cda22239c79a0))

### Tests

* **command-line-args:** cover validation errors, boolean/number parsing, debug, and resolve edge cases ([dbebe1d](https://github.com/visulima/visulima/commit/dbebe1db1aeceece87bf08d79f6bc83dcc8effe0))


### Dependencies

* **@visulima/error:** upgraded to 6.0.0-alpha.32

## @visulima/command-line-args [2.0.0-alpha.10](https://github.com/visulima/visulima/compare/@visulima/command-line-args@2.0.0-alpha.9...@visulima/command-line-args@2.0.0-alpha.10) (2026-05-27)

### Bug Fixes

* **storage-client:** percent-encode user fields in defaultFingerprint ([7c78a0f](https://github.com/visulima/visulima/commit/7c78a0f9512e2a673b941d80839e9f1e86b7b5d0))

### Miscellaneous Chores

* **ci-stability:** green CI across vis, native, lint, tests, attw ([#651](https://github.com/visulima/visulima/issues/651)) ([d4eb684](https://github.com/visulima/visulima/commit/d4eb684b5f75c818c9251048c605a0ed54a268e3))
* **command-line-args:** apply prettier and eslint quote-style auto-fix ([43a56bd](https://github.com/visulima/visulima/commit/43a56bd6a70e2cdcec8b7c7f6edb02efc0280814))
* **command-line-args:** bump @visulima/error to 6.0.0-alpha.16 ([cb511da](https://github.com/visulima/visulima/commit/cb511da538c1311d977a04eb2b7d6ed3afae3f72))
* **command-line-args:** fix lint errors ([e7f1f79](https://github.com/visulima/visulima/commit/e7f1f79b569e587959845a001c0b4cb9b1e1fcf4))
* **command-line-args:** upgrade packem to 2.0.0-alpha.76 ([8133f43](https://github.com/visulima/visulima/commit/8133f43adf813115ff94439a9e34278eeed29db1))
* re-sort workspace package.json files via vis sort-package-json ([f625696](https://github.com/visulima/visulima/commit/f625696cfac974325774b3243e1a83c3d23acbd7))
* sorted package.json ([b47c545](https://github.com/visulima/visulima/commit/b47c545591600fdab17d5cd3a3fbc68b61e199da))
* **terminal:** apply prettier and eslint formatting sweep ([15fd89c](https://github.com/visulima/visulima/commit/15fd89c677eea60866e08e4fd5f5a6bc8f3bd2e5))

### Tests

* **repo:** add dist runtime + types integration tests ([32ee300](https://github.com/visulima/visulima/commit/32ee300b7184117a0ddf9f9d390f75f8932d5ed9))

### Continuous Integration

* integrate codspeed for benchmark tracking ([e758f3d](https://github.com/visulima/visulima/commit/e758f3da491cc00d3f8bbf10d7ba3fdf8deb5325))


### Dependencies

* **@visulima/error:** upgraded to 6.0.0-alpha.30

## @visulima/command-line-args [2.0.0-alpha.9](https://github.com/visulima/visulima/compare/@visulima/command-line-args@2.0.0-alpha.8...@visulima/command-line-args@2.0.0-alpha.9) (2026-04-22)

### Bug Fixes

* Remove JSR configuration generation script and generated jsr.json files ([#616](https://github.com/visulima/visulima/issues/616)) ([533744b](https://github.com/visulima/visulima/commit/533744b103b74896941db5b727173e617a27a63b))

### Miscellaneous Chores

* update the jsr.json ([864ab7e](https://github.com/visulima/visulima/commit/864ab7e71c4b5ae82f64792d1ae8debfea2c539b))


### Dependencies

* **@visulima/error:** upgraded to 6.0.0-alpha.13

## @visulima/command-line-args [2.0.0-alpha.8](https://github.com/visulima/visulima/compare/@visulima/command-line-args@2.0.0-alpha.7...@visulima/command-line-args@2.0.0-alpha.8) (2026-04-21)

### Bug Fixes

* **command-line-args:** resolve eslint and formatting issues ([3b4eff6](https://github.com/visulima/visulima/commit/3b4eff6c21e2cb8c8c2fd66d5629cc6d757bc149))
* **command-line-args:** resolve eslint and formatting issues ([389f5f5](https://github.com/visulima/visulima/commit/389f5f5d93b257bc4277cbe0155f729dd502fc9a))
* **terminal:** resolve eslint and formatting issues ([12ef283](https://github.com/visulima/visulima/commit/12ef283684d1808fbcfe44077a0cfe8324801485))
* **terminal:** resolve eslint and formatting issues ([8f30389](https://github.com/visulima/visulima/commit/8f30389deb9ff81e7afce0aa064ef11fcb179f23))

### Miscellaneous Chores

* bump engines.node to ^22.14.0 || >=24.10.0 ([c3d0931](https://github.com/visulima/visulima/commit/c3d0931d1504e4f21ebf50ea680cfa7ce4ba15ce))
* **command-line-args:** apply formatter and lint fixes ([b19c9c8](https://github.com/visulima/visulima/commit/b19c9c89f2ebf163673301530ad3019852cdc564))
* **command-line-args:** apply pending changes ([f01a173](https://github.com/visulima/visulima/commit/f01a1738b1a28edcc9e90f6ea4e2453d079f0c7a))
* **command-line-args:** apply pending lint and source updates ([4da3c08](https://github.com/visulima/visulima/commit/4da3c08f0a33e0cdab91f4e7f7339cb3c1be6d16))
* **command-line-args:** enforce curly braces and apply lint fixes ([e155340](https://github.com/visulima/visulima/commit/e155340c67d4287a749a340bfe916e383906eadf))
* fixed jsr.json ([5d85e51](https://github.com/visulima/visulima/commit/5d85e5179de38e284ec433b14d77c71a1619c8d6))
* remove unused deprecated aliases ([#612](https://github.com/visulima/visulima/issues/612)) ([24ee546](https://github.com/visulima/visulima/commit/24ee546bcb2c17b8915622e4878797c00aa1d813))


### Dependencies

* **@visulima/error:** upgraded to 6.0.0-alpha.10

## @visulima/command-line-args [2.0.0-alpha.7](https://github.com/visulima/visulima/compare/@visulima/command-line-args@2.0.0-alpha.6...@visulima/command-line-args@2.0.0-alpha.7) (2026-04-08)

### Bug Fixes

* **command-line-args:** parse known options after defaultOption positional values ([da113c3](https://github.com/visulima/visulima/commit/da113c3c93158e10f276d128b3f6ab1fcae3a5f0))
* **command-line-args:** properly fix eslint errors in code ([21f3df6](https://github.com/visulima/visulima/commit/21f3df64802293cbae00db8e0b81c0bd4145dd88))
* **command-line-args:** resolve eslint errors ([f76440c](https://github.com/visulima/visulima/commit/f76440cc9b27cdbd29eb20ba0c6040129888517c))

### Miscellaneous Chores

* **command-line-args:** add tsconfig.eslint.json for type-aware linting ([b6b91bc](https://github.com/visulima/visulima/commit/b6b91bc7fcc3de55cd432f6e5bbc01acd4b53918))
* **command-line-args:** apply prettier formatting ([bbe507c](https://github.com/visulima/visulima/commit/bbe507c8bbdb2e2f24cde8eb1a78c0ef6b79b2d8))
* **command-line-args:** migrate .prettierrc.cjs to prettier.config.js ([f1f4ab4](https://github.com/visulima/visulima/commit/f1f4ab4f77d14f0877311b0b943dc8ed37b1c73d))
* **terminal:** remove empty dependency objects from package.json ([562c704](https://github.com/visulima/visulima/commit/562c704e5d90aa2d13eae942ebbdcfeb787c2b46))


### Dependencies

* **@visulima/error:** upgraded to 6.0.0-alpha.8

## @visulima/command-line-args [2.0.0-alpha.6](https://github.com/visulima/visulima/compare/@visulima/command-line-args@2.0.0-alpha.5...@visulima/command-line-args@2.0.0-alpha.6) (2026-03-26)

### Features

* **web:** auto-generate packages page from workspace metadata ([623e520](https://github.com/visulima/visulima/commit/623e5207693a7fe720f5f2f179593a3654c880e3))


### Dependencies

* **@visulima/error:** upgraded to 6.0.0-alpha.7

## @visulima/command-line-args [2.0.0-alpha.5](https://github.com/visulima/visulima/compare/@visulima/command-line-args@2.0.0-alpha.4...@visulima/command-line-args@2.0.0-alpha.5) (2026-03-26)

### Bug Fixes

* **command-line-args:** use workspace:* for internal [@visulima](https://github.com/visulima) deps ([956db26](https://github.com/visulima/visulima/commit/956db26c5324081a099db9d3961e27274c0572d2))
* **web:** improve build setup with incremental stats caching and prod install ([fe33e75](https://github.com/visulima/visulima/commit/fe33e75827586779b4b3a0c6d57b39f889ee6207))

### Miscellaneous Chores

* **command-line-args:** migrate deps to pnpm catalogs ([42a7190](https://github.com/visulima/visulima/commit/42a71907350c02ae8e0fb21e22fc3c95d49a3950))
* **command-line-args:** update dependencies ([31201e3](https://github.com/visulima/visulima/commit/31201e3ae4321e760588e5e4fa75459ee1a0e682))
* visulima website ([#591](https://github.com/visulima/visulima/issues/591)) ([59ab2e2](https://github.com/visulima/visulima/commit/59ab2e2befb03e51cd2088956f83d9b87de6d033))


### Dependencies

* **@visulima/error:** upgraded to 6.0.0-alpha.6

## @visulima/command-line-args [2.0.0-alpha.4](https://github.com/visulima/visulima/compare/@visulima/command-line-args@2.0.0-alpha.3...@visulima/command-line-args@2.0.0-alpha.4) (2026-03-06)

### Bug Fixes

* **command-line-args:** update packem to 2.0.0-alpha.54 ([28d090d](https://github.com/visulima/visulima/commit/28d090d3944951ec9de7ee2d8f579f6785607f9f))

### Documentation

* **boxen,command-line-args,tabular,is-ansi-color-supported,disposable-email-domains:** add comprehensive Fumadocs documentation ([95e0578](https://github.com/visulima/visulima/commit/95e057833978dfeeb9f2768269e36862572539db))

### Miscellaneous Chores

* **command-line-args:** update dependencies ([5f8ae63](https://github.com/visulima/visulima/commit/5f8ae6341e8ed6a1ef189cb5c3aa16fb3df45b66))
* **command-line-args:** update dependencies ([246e9b9](https://github.com/visulima/visulima/commit/246e9b9e96e29cc36981f3e6e00dafd9a6ab3443))
* **terminal:** update dependencies ([a5bb91a](https://github.com/visulima/visulima/commit/a5bb91a66f2be2ade485d586156a54c347a23cc9))
* update lock file maintenance ([d83e716](https://github.com/visulima/visulima/commit/d83e71697b75d24704185b66bb521a934d2db02d))
* year update ([47f4105](https://github.com/visulima/visulima/commit/47f410596ce7190cfea36a073db32e0cec50bbcd))


### Dependencies

* **@visulima/error:** upgraded to 6.0.0-alpha.5

## @visulima/command-line-args [2.0.0-alpha.3](https://github.com/visulima/visulima/compare/@visulima/command-line-args@2.0.0-alpha.2...@visulima/command-line-args@2.0.0-alpha.3) (2025-12-27)

### Bug Fixes

* **command-line-args:** update package files ([de998ec](https://github.com/visulima/visulima/commit/de998ec2f22b5776f3e250f9ead9da6870fa6a15))

### Miscellaneous Chores

* fixed project.json names and schema path ([964722f](https://github.com/visulima/visulima/commit/964722f691db205c7edb9aa6db29e849a647500b))


### Dependencies

* **@visulima/error:** upgraded to 6.0.0-alpha.3

## @visulima/command-line-args [2.0.0-alpha.2](https://github.com/visulima/visulima/compare/@visulima/command-line-args@2.0.0-alpha.1...@visulima/command-line-args@2.0.0-alpha.2) (2025-12-11)

### Bug Fixes

* update package OG images across multiple packages ([f08e4dd](https://github.com/visulima/visulima/commit/f08e4dd2b105ccb29c8412020a9c2be36d6c1e9e))


### Dependencies

* **@visulima/error:** upgraded to 6.0.0-alpha.2

## @visulima/command-line-args [2.0.0-alpha.1](https://github.com/visulima/visulima/compare/@visulima/command-line-args@1.0.4...@visulima/command-line-args@2.0.0-alpha.1) (2025-12-07)

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

* **@visulima/error:** upgraded to 6.0.0-alpha.1

## @visulima/command-line-args [1.0.4](https://github.com/visulima/visulima/compare/@visulima/command-line-args@1.0.3...@visulima/command-line-args@1.0.4) (2025-11-13)

### Bug Fixes

* bump packem, to fix minified version of the code ([2a36ceb](https://github.com/visulima/visulima/commit/2a36ceb09251b0ca1178701a26547a871ed717a7))


### Dependencies

* **@visulima/error:** upgraded to 5.0.6

## @visulima/command-line-args [1.0.3](https://github.com/visulima/visulima/compare/@visulima/command-line-args@1.0.2...@visulima/command-line-args@1.0.3) (2025-11-12)

### Bug Fixes

* update package configurations and TypeScript definitions ([b59aa59](https://github.com/visulima/visulima/commit/b59aa59dac1508216b944f4b917fb4a7ab1f70a4))

### Miscellaneous Chores

* Add jsr file to all packages for release ([#565](https://github.com/visulima/visulima/issues/565)) ([ec91652](https://github.com/visulima/visulima/commit/ec91652b4e4112adf14ba152c1239a7703ba425a))
* update license files and clean up TypeScript definitions ([fe668cc](https://github.com/visulima/visulima/commit/fe668cc26de23591d4df54a0954455ebbe31b22d))


### Dependencies

* **@visulima/error:** upgraded to 5.0.5

## @visulima/command-line-args [1.0.2](https://github.com/visulima/visulima/compare/@visulima/command-line-args@1.0.1...@visulima/command-line-args@1.0.2) (2025-11-07)

### Bug Fixes

* update TypeScript configurations and improve linting across multiple packages ([6f25ec7](https://github.com/visulima/visulima/commit/6f25ec7841da7246f8f9166efc5292a7089d37ee))

### Miscellaneous Chores

* update npm and pnpm configurations for monorepo optimization ([#564](https://github.com/visulima/visulima/issues/564)) ([5512b42](https://github.com/visulima/visulima/commit/5512b42f672c216b6a3c9e39035199a4ebd9a4b8))


### Dependencies

* **@visulima/error:** upgraded to 5.0.4

## @visulima/command-line-args [1.0.1](https://github.com/visulima/visulima/compare/@visulima/command-line-args@1.0.0...@visulima/command-line-args@1.0.1) (2025-11-05)

### Bug Fixes

* update dependencies across multiple packages ([36a47f2](https://github.com/visulima/visulima/commit/36a47f26d65d25a7b4d8371186710e7d0ab61a2b))

### Miscellaneous Chores

* update dependencies across multiple packages ([c526462](https://github.com/visulima/visulima/commit/c52646260c2ae8bbf85692e642f305f47a158d4e))
* update package dependencies and configurations ([7bfe7e7](https://github.com/visulima/visulima/commit/7bfe7e71869580900aab50efb064b4293994ed9a))


### Dependencies

* **@visulima/error:** upgraded to 5.0.3

## @visulima/command-line-args 1.0.0 (2025-10-21)

### Features

* add command-line-args package ([#555](https://github.com/visulima/visulima/issues/555)) ([2ce1a14](https://github.com/visulima/visulima/commit/2ce1a1404bb9704754b3523486fd56b77c7744d8))

### Bug Fixes

* allow node v25 and updated dev deps ([8158cc5](https://github.com/visulima/visulima/commit/8158cc53ec92bd0331e8c6bd0fcbc8ab61b9320f))

### Miscellaneous Chores

* update copyright year in LICENSE.md files ([c46a28d](https://github.com/visulima/visulima/commit/c46a28d2afb4cc7d73a7edde9a271a7156f87eae))
* update license years and add validation rules ([b97811e](https://github.com/visulima/visulima/commit/b97811ed2d253d908c0d86b4579a0a6bc33673a8))


### Dependencies

* **@visulima/error:** upgraded to 5.0.2
