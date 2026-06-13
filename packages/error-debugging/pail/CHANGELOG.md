## @visulima/pail [4.0.0-alpha.22](https://github.com/visulima/visulima/compare/@visulima/pail@4.0.0-alpha.21...@visulima/pail@4.0.0-alpha.22) (2026-06-13)

### Bug Fixes

* **pail:** fix rfc5424 stream routing and add reporter lifecycle ([2c798f5](https://github.com/visulima/visulima/commit/2c798f5742e35a91c2b68154de346823c88678ac))
* **pail:** route stderr levels via isStderrLevel ([c4ac8a5](https://github.com/visulima/visulima/commit/c4ac8a51858777556864c26f2d88f4f0b6109d76))

### Performance Improvements

* **pail:** drop per-log meta spread and date rewrap ([dbc4622](https://github.com/visulima/visulima/commit/dbc46226732f92c097664f903756cee759bc2f8d))

### Miscellaneous Chores

* **pail:** apply lint-driven style cleanup to src and README ([309d8d1](https://github.com/visulima/visulima/commit/309d8d127932d3f37a63b42bd170c9bf26957585))
* **pail:** clear baseline eslint violations ([ac1802f](https://github.com/visulima/visulima/commit/ac1802fdd7a7863411dd6834d57eb585d2d1ded5))
* **pail:** clear baseline lint in manager unit tests ([59ec66e](https://github.com/visulima/visulima/commit/59ec66e7fa474e5632dd4056cb3d38c6b1a0f46e))

### Code Refactoring

* **pail:** extract CounterManager from PailBrowserImpl ([9698faf](https://github.com/visulima/visulima/commit/9698faf865f5614e921b83cc480f0a1de0c12375))
* **pail:** extract TimerManager from PailBrowserImpl ([551271b](https://github.com/visulima/visulima/commit/551271ba5814ab8d8afc3c61718dc4b32ed45f9e))
* **pail:** route wide-event serializer through error ([3c7010a](https://github.com/visulima/visulima/commit/3c7010a89a7e752aa6319d8a3b0944a266d0e07f))

### Tests

* **pail:** add unit tests for TimerManager and CounterManager ([38c0580](https://github.com/visulima/visulima/commit/38c058033b5112b63db404592eefb86992622e78))
* **pail:** expect honored replacement in redact-processor ([ef3f5fb](https://github.com/visulima/visulima/commit/ef3f5fbfbb891c3885e3a333dd58a29f89fa6747))
* **pail:** route warning fixtures to stdout for ESM check ([116c0d0](https://github.com/visulima/visulima/commit/116c0d0471bccbb9d534a787594af369e032e30e))

### Build System

* **deps:** update pail dependencies ([d88731f](https://github.com/visulima/visulima/commit/d88731f39ab61facb41012f698496a6b5a6cacbe))
* regenerate bundled-license manifests and types ordering ([af26588](https://github.com/visulima/visulima/commit/af26588d75aaa937fd4862800560bd4070a4878c))


### Dependencies

* **@visulima/colorize:** upgraded to 2.0.0-alpha.14
* **@visulima/interactive-manager:** upgraded to 1.0.0-alpha.5
* **@visulima/ansi:** upgraded to 4.0.0-alpha.17
* **@visulima/error:** upgraded to 6.0.0-alpha.33
* **@visulima/fmt:** upgraded to 2.0.0-alpha.13
* **@visulima/inspector:** upgraded to 2.0.0-alpha.14
* **@visulima/redact:** upgraded to 3.0.0-alpha.14
* **@visulima/string:** upgraded to 3.0.0-alpha.17

## @visulima/pail [4.0.0-alpha.21](https://github.com/visulima/visulima/compare/@visulima/pail@4.0.0-alpha.20...@visulima/pail@4.0.0-alpha.21) (2026-06-04)

### Performance Improvements

* **pail:** disable esbuild keepNames in prod build ([346908c](https://github.com/visulima/visulima/commit/346908c9f91c726cb9bb74dbf1122783ab2c925f))

### Tests

* **pail:** fix message-formatter benchmark format string ([c0567c6](https://github.com/visulima/visulima/commit/c0567c68e5ddec0b61f799582ba5f62beb763019))


### Dependencies

* **@visulima/inspector:** upgraded to 2.0.0-alpha.13
* **@visulima/string:** upgraded to 3.0.0-alpha.16

## @visulima/pail [4.0.0-alpha.20](https://github.com/visulima/visulima/compare/@visulima/pail@4.0.0-alpha.19...@visulima/pail@4.0.0-alpha.20) (2026-06-04)

### Bug Fixes

* **lint:** clear pre-existing eslint rot across packages ([#674](https://github.com/visulima/visulima/issues/674)) ([5354253](https://github.com/visulima/visulima/commit/5354253b163bd50bcefaf8a3fddf831bdb5df32b))
* **pail:** 3 bug fixes + 2 perf ([b90de36](https://github.com/visulima/visulima/commit/b90de36906ccbbd2578aad974b59b08c2ce0ee1e))

### Miscellaneous Chores

* apply eslint + prettier autofixes across packages ([c1bb784](https://github.com/visulima/visulima/commit/c1bb7848a0d93d0dfe2960c77e3cda22239c79a0))


### Dependencies

* **@visulima/colorize:** upgraded to 2.0.0-alpha.13
* **@visulima/interactive-manager:** upgraded to 1.0.0-alpha.4
* **@visulima/ansi:** upgraded to 4.0.0-alpha.16
* **@visulima/error:** upgraded to 6.0.0-alpha.32
* **@visulima/fmt:** upgraded to 2.0.0-alpha.12
* **@visulima/inspector:** upgraded to 2.0.0-alpha.12
* **@visulima/redact:** upgraded to 3.0.0-alpha.13
* **@visulima/string:** upgraded to 3.0.0-alpha.15

## @visulima/pail [4.0.0-alpha.19](https://github.com/visulima/visulima/compare/@visulima/pail@4.0.0-alpha.18...@visulima/pail@4.0.0-alpha.19) (2026-05-29)

### Bug Fixes

* **pail:** create rotating-file-stream factory in immediate mode ([a72ac70](https://github.com/visulima/visulima/commit/a72ac70cfd6df3e738568f6479031265ebae95af))

### Tests

* **pail:** cover browser logger scope, timers, groups, raw, and reporter paths ([7b1ba52](https://github.com/visulima/visulima/commit/7b1ba52e5c14bfd638870eac668e66f6015560e3))
* **pail:** cover browser pretty reporter console and DOM formatting paths ([f8c1742](https://github.com/visulima/visulima/commit/f8c17424e90a80aa1a51393cc2740c8a4e404bb2))
* **pail:** cover browser wrapConsole rewrap, processless exception, and throttle resolve ([b28e8fa](https://github.com/visulima/visulima/commit/b28e8fa3d7040d170a92d80435ea87df68ddaff6))
* **pail:** cover http reporter data/rest payload, force-send, and batch errors ([d00c4cc](https://github.com/visulima/visulima/commit/d00c4cc85e091fbcd54477e6299b1db2e68842a0))
* **pail:** cover http reporter error and batch edge paths ([fceb9f5](https://github.com/visulima/visulima/commit/fceb9f5daa72d922e2167ed462cbc98c73783726))
* **pail:** cover middleware fallbacks, storage throw, and reporter edge branches ([25cc807](https://github.com/visulima/visulima/commit/25cc807bc4f97f93a4e3316ffbb2bf2caa75120f))
* **pail:** cover middleware route glob patterns for mid and trailing ** ([9b5da54](https://github.com/visulima/visulima/commit/9b5da54e40fbb560e7f2590aa947333cfc5376b2))
* **pail:** cover next and elysia middleware exclude/include and emit guards ([c75e359](https://github.com/visulima/visulima/commit/c75e359c61c81e82fe770d355f9097bc48c93341))
* **pail:** cover object-tree option validation and safe stream handler ([3efeda2](https://github.com/visulima/visulima/commit/3efeda2b1137edb5c2715f670f4237cb4f17b1bc))
* **pail:** cover object-tree sort fallback branch ([6e7c68f](https://github.com/visulima/visulima/commit/6e7c68f8e131a0aef198788f07f11d902e26179d))
* **pail:** cover pretty browser date, badge, message, and context branches ([a05a7ba](https://github.com/visulima/visulima/commit/a05a7baafd981143b46c42df017ae560e6f93e9c))
* **pail:** cover pretty reporter interactive, context, error, and caller paths ([8fdd0cc](https://github.com/visulima/visulima/commit/8fdd0cce3b6f6277127009f24a696f3aeecbd704))
* **pail:** cover pretty server group, nameless file, and empty message ([0552536](https://github.com/visulima/visulima/commit/0552536137b80a94af8c4e8def14499a3b2a7385))
* **pail:** cover reporter utils, raw object/interactive paths, and json context ([f7e228c](https://github.com/visulima/visulima/commit/f7e228cefaa0b17e4b114779a7286dc1b9da3bee))
* **pail:** cover retry throws without onError for client and retryable errors ([776ab80](https://github.com/visulima/visulima/commit/776ab80c1c5d7c962329b46d0fca8678d4417474))
* **pail:** cover server child overrides and stream wrap ([2e30e6f](https://github.com/visulima/visulima/commit/2e30e6f8190873ef9e794d1ad2af5230a054ef6e))
* **pail:** cover server child scope, wrap/clear, and reporter extension paths ([c4abf3f](https://github.com/visulima/visulima/commit/c4abf3fc65265a9ba9d372922557d914f13ff0f8))
* **pail:** cover server/browser entry points and default log level resolution ([c1c34f6](https://github.com/visulima/visulima/commit/c1c34f66f5c29b52d46471d858cc6d0f75bb9384))
* **pail:** cover simple reporter and message formatter ([31d7d1e](https://github.com/visulima/visulima/commit/31d7d1e58406445093266ce89b1fb187da71ef92))
* **pail:** cover simple reporter interactive, context, error, and caller paths ([d75bd5f](https://github.com/visulima/visulima/commit/d75bd5fcae40e5a0c072871c2061cc034c608166))
* **pail:** cover wide-event duration seconds and stackless error ([56cf694](https://github.com/visulima/visulima/commit/56cf694a9011c40263d39a451f53b6940883807e))

## @visulima/pail [4.0.0-alpha.18](https://github.com/visulima/visulima/compare/@visulima/pail@4.0.0-alpha.17...@visulima/pail@4.0.0-alpha.18) (2026-05-27)

### Bug Fixes

* **storage-client:** percent-encode user fields in defaultFingerprint ([7c78a0f](https://github.com/visulima/visulima/commit/7c78a0f9512e2a673b941d80839e9f1e86b7b5d0))

### Documentation

* prettier-format agent instructions ([71b6414](https://github.com/visulima/visulima/commit/71b6414528780ac82c4e0bb25b5f4f11faba5549))

### Miscellaneous Chores

* sorted package.json ([b47c545](https://github.com/visulima/visulima/commit/b47c545591600fdab17d5cd3a3fbc68b61e199da))


### Dependencies

* **@visulima/colorize:** upgraded to 2.0.0-alpha.12
* **@visulima/interactive-manager:** upgraded to 1.0.0-alpha.3
* **@visulima/ansi:** upgraded to 4.0.0-alpha.15
* **@visulima/error:** upgraded to 6.0.0-alpha.30
* **@visulima/inspector:** upgraded to 2.0.0-alpha.11
* **@visulima/redact:** upgraded to 3.0.0-alpha.12
* **@visulima/string:** upgraded to 3.0.0-alpha.14

## @visulima/pail [4.0.0-alpha.17](https://github.com/visulima/visulima/compare/@visulima/pail@4.0.0-alpha.16...@visulima/pail@4.0.0-alpha.17) (2026-05-26)

### Bug Fixes

* **pail,fs:** bind logger.raw and inline picomatch options ([e8b20d2](https://github.com/visulima/visulima/commit/e8b20d2afdbcadf2f531ac3593dc0b7210684955))

### Miscellaneous Chores

* **ci-stability:** green CI across vis, native, lint, tests, attw ([#651](https://github.com/visulima/visulima/issues/651)) ([d4eb684](https://github.com/visulima/visulima/commit/d4eb684b5f75c818c9251048c605a0ed54a268e3))

### Tests

* **repo:** add dist runtime + types integration tests ([32ee300](https://github.com/visulima/visulima/commit/32ee300b7184117a0ddf9f9d390f75f8932d5ed9))


### Dependencies

* **@visulima/error:** upgraded to 6.0.0-alpha.28

## @visulima/pail [4.0.0-alpha.16](https://github.com/visulima/visulima/compare/@visulima/pail@4.0.0-alpha.15...@visulima/pail@4.0.0-alpha.16) (2026-05-14)

### Miscellaneous Chores

* **error:** apply prettier and eslint formatting sweep ([25c5eaf](https://github.com/visulima/visulima/commit/25c5eaf4989bddfe860b52aea113b3e229fea84f))


### Dependencies

* **@visulima/colorize:** upgraded to 2.0.0-alpha.11
* **@visulima/error:** upgraded to 6.0.0-alpha.24

## @visulima/pail [4.0.0-alpha.15](https://github.com/visulima/visulima/compare/@visulima/pail@4.0.0-alpha.14...@visulima/pail@4.0.0-alpha.15) (2026-05-07)


### Dependencies

* **@visulima/error:** upgraded to 6.0.0-alpha.19
* **@visulima/redact:** upgraded to 3.0.0-alpha.11
* **@visulima/string:** upgraded to 3.0.0-alpha.12

## @visulima/pail [4.0.0-alpha.14](https://github.com/visulima/visulima/compare/@visulima/pail@4.0.0-alpha.13...@visulima/pail@4.0.0-alpha.14) (2026-05-06)


### Dependencies

* **@visulima/error:** upgraded to 6.0.0-alpha.17

## @visulima/pail [4.0.0-alpha.13](https://github.com/visulima/visulima/compare/@visulima/pail@4.0.0-alpha.12...@visulima/pail@4.0.0-alpha.13) (2026-05-06)

### Miscellaneous Chores

* **pail:** apply prettier and eslint quote-style auto-fix ([3c15292](https://github.com/visulima/visulima/commit/3c152922610130de7728183efccfb552f2939fdf))
* **pail:** fix lint errors ([03bcc1f](https://github.com/visulima/visulima/commit/03bcc1f2a5588f6730a71e21d56e280d8e537eca))

### Continuous Integration

* integrate codspeed for benchmark tracking ([e758f3d](https://github.com/visulima/visulima/commit/e758f3da491cc00d3f8bbf10d7ba3fdf8deb5325))


### Dependencies

* **@visulima/error:** upgraded to 6.0.0-alpha.16

## @visulima/pail [4.0.0-alpha.12](https://github.com/visulima/visulima/compare/@visulima/pail@4.0.0-alpha.11...@visulima/pail@4.0.0-alpha.12) (2026-04-28)

### Bug Fixes

* **pail:** use default colorize import in reporters ([0e07c5f](https://github.com/visulima/visulima/commit/0e07c5f31e1e66c34ff24c5038970b84cb21e53c))

### Miscellaneous Chores

* **pail:** upgrade packem to 2.0.0-alpha.76 ([a759cc2](https://github.com/visulima/visulima/commit/a759cc2f823cb04c545c6f50d817d752929cee3f))
* re-sort workspace package.json files via vis sort-package-json ([f625696](https://github.com/visulima/visulima/commit/f625696cfac974325774b3243e1a83c3d23acbd7))
* simplify pnpm-workspace packages list ([7cab221](https://github.com/visulima/visulima/commit/7cab221163632d9b7aa044a6f88c49083103a869))


### Dependencies

* **@visulima/inspector:** upgraded to 2.0.0-alpha.10

## @visulima/pail [4.0.0-alpha.11](https://github.com/visulima/visulima/compare/@visulima/pail@4.0.0-alpha.10...@visulima/pail@4.0.0-alpha.11) (2026-04-22)

### ⚠ BREAKING CHANGES

* **pail:** Removed createSpinner(), createMultiSpinner(),
createProgressBar(), createMultiProgressBar() methods and the
./spinner, ./progress-bar, ./interactive exports. Use the standalone
packages @visulima/spinner, @visulima/progress-bar, and
@visulima/interactive-manager instead. See MIGRATION-GUIDE.md for
details.

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>

### Features

* **pail:** remove spinner, progress-bar, and interactive from pail ([b600f82](https://github.com/visulima/visulima/commit/b600f82876330d55ba98c090b3cf37745ee1e5ed))

### Bug Fixes

* **error-debugging:** resolve eslint and type-safety issues ([886dbff](https://github.com/visulima/visulima/commit/886dbffe3f744c9493fcc54e781de3fd21eebf78))
* fixed package version ([710e732](https://github.com/visulima/visulima/commit/710e73235b82699c511cfcc2482c491c767b2376))
* **pail, boxen:** resolve eslint unsafe type issues ([d6e852e](https://github.com/visulima/visulima/commit/d6e852e63f4572a12c31ac44a4ae687c743cf7db))
* **pail:** disable noUncheckedIndexedAccess and fix middleware return types ([0e94d32](https://github.com/visulima/visulima/commit/0e94d32a6315008e17633374c6e916bc625bc617))
* **pail:** resolve eslint and formatting issues ([3697233](https://github.com/visulima/visulima/commit/3697233aecdeac382774e5c00a0ad0e8e83b2397))
* **pail:** resolve eslint issues with terminal-size and interactive-manager ([0776deb](https://github.com/visulima/visulima/commit/0776debc2c2031cb1c13c1958a3188cecae60e8e))
* **pail:** resolve typescript-eslint strict lint errors ([a0e6b1f](https://github.com/visulima/visulima/commit/a0e6b1f3ce6518450488d4c5385333534cd22b71))
* Remove JSR configuration generation script and generated jsr.json files ([#616](https://github.com/visulima/visulima/issues/616)) ([533744b](https://github.com/visulima/visulima/commit/533744b103b74896941db5b727173e617a27a63b))

### Miscellaneous Chores

* **api-platform:** apply pending lint and source updates ([3fb0043](https://github.com/visulima/visulima/commit/3fb0043a4cf35f752ca89a09a077100ae0142da8))
* bump engines.node to ^22.14.0 || >=24.10.0 ([c3d0931](https://github.com/visulima/visulima/commit/c3d0931d1504e4f21ebf50ea680cfa7ce4ba15ce))
* fixed jsr.json ([5d85e51](https://github.com/visulima/visulima/commit/5d85e5179de38e284ec433b14d77c71a1619c8d6))
* **pail:** apply formatter and lint fixes ([73e4e1f](https://github.com/visulima/visulima/commit/73e4e1fbdf4c7541fb6fa6419dfe43f0c6225ac9))
* **pail:** apply formatter and lint fixes ([367292b](https://github.com/visulima/visulima/commit/367292bb3bf0effc94ec9828a85e926e84acd1f9))
* **pail:** apply pending changes ([e777058](https://github.com/visulima/visulima/commit/e7770582a222e586bf3f84d2c10989a26e95451d))
* **pail:** apply pending lint and source updates ([e71aa5b](https://github.com/visulima/visulima/commit/e71aa5b970e596a5b3099825d0007a9bf63425f8))
* **pail:** apply pending lint and source updates ([4c0069a](https://github.com/visulima/visulima/commit/4c0069aac50254a3329bf7f5627a9fd807f5fbca))
* **pail:** enforce curly braces and apply lint fixes ([08945a9](https://github.com/visulima/visulima/commit/08945a91e090abf6ccd5e687525ed791abb2f5c7))

## @visulima/pail [4.0.0-alpha.10](https://github.com/visulima/visulima/compare/@visulima/pail@4.0.0-alpha.9...@visulima/pail@4.0.0-alpha.10) (2026-04-08)

### Features

* **pail:** add braille progress bar style with rounded caps and peak marker ([8302d7f](https://github.com/visulima/visulima/commit/8302d7faeab02ce9bb02beec706158685ab5a2dd))

### Bug Fixes

* **pail:** properly fix eslint errors in code ([31e1eba](https://github.com/visulima/visulima/commit/31e1ebac710bbadee4167278ac6b0ada83d3408b))
* **pail:** remove remaining eslint suppressions with proper code fixes ([ea50721](https://github.com/visulima/visulima/commit/ea50721882ba2848dd60f29d02fc5eff5b885757))
* **pail:** resolve eslint errors ([966eabe](https://github.com/visulima/visulima/commit/966eabe1d8d4bd3109665dea6dea792c69b23f39))

### Miscellaneous Chores

* apply linting and formatting fixes across packages ([5d150a5](https://github.com/visulima/visulima/commit/5d150a578f9ce861c791843c683deeb849b774a9))
* **error-debugging:** remove empty dependency objects from package.json ([7eb7c8e](https://github.com/visulima/visulima/commit/7eb7c8eba1394e515fa77c0f56baf41c0810de2e))
* **pail:** add tsconfig.eslint.json for type-aware linting ([273fb33](https://github.com/visulima/visulima/commit/273fb33273641c6a69678bdb1645da5c414958fb))
* **pail:** apply prettier formatting ([0416b36](https://github.com/visulima/visulima/commit/0416b3644faee118c4be0090d431aa5ca1249559))
* **pail:** migrate .prettierrc.cjs to prettier.config.js ([4787521](https://github.com/visulima/visulima/commit/47875216a2841d9d99a78e8f15a2c5cb5ad5850a))
* update bundled dependency licenses ([6ace4c6](https://github.com/visulima/visulima/commit/6ace4c69d41fc1fd0a744fbca8ca219ba631b4ab))


### Dependencies

* **@visulima/colorize:** upgraded to 2.0.0-alpha.8
* **@visulima/error:** upgraded to 6.0.0-alpha.8
* **@visulima/fmt:** upgraded to 2.0.0-alpha.8
* **@visulima/inspector:** upgraded to 2.0.0-alpha.7
* **@visulima/redact:** upgraded to 3.0.0-alpha.8
* **@visulima/string:** upgraded to 3.0.0-alpha.9

## @visulima/pail [4.0.0-alpha.9](https://github.com/visulima/visulima/compare/@visulima/pail@4.0.0-alpha.8...@visulima/pail@4.0.0-alpha.9) (2026-03-26)

### Features

* **web:** auto-generate packages page from workspace metadata ([623e520](https://github.com/visulima/visulima/commit/623e5207693a7fe720f5f2f179593a3654c880e3))

### Miscellaneous Chores

* update homepage URLs to visulima.com/packages/ format ([be42968](https://github.com/visulima/visulima/commit/be42968129df85fb074224435e33135ff44cab91))


### Dependencies

* **@visulima/colorize:** upgraded to 2.0.0-alpha.7
* **@visulima/error:** upgraded to 6.0.0-alpha.7
* **@visulima/fmt:** upgraded to 2.0.0-alpha.7
* **@visulima/inspector:** upgraded to 2.0.0-alpha.6
* **@visulima/redact:** upgraded to 3.0.0-alpha.7
* **@visulima/string:** upgraded to 3.0.0-alpha.8

## @visulima/pail [4.0.0-alpha.8](https://github.com/visulima/visulima/compare/@visulima/pail@4.0.0-alpha.7...@visulima/pail@4.0.0-alpha.8) (2026-03-26)

### Bug Fixes

* **pail:** use workspace:* for internal [@visulima](https://github.com/visulima) deps ([8423dd7](https://github.com/visulima/visulima/commit/8423dd779fbea0acff8f090e548a423e46d761fd))
* **web:** improve build setup with incremental stats caching and prod install ([fe33e75](https://github.com/visulima/visulima/commit/fe33e75827586779b4b3a0c6d57b39f889ee6207))

### Miscellaneous Chores

* **pail:** migrate deps to pnpm catalogs ([b2acd86](https://github.com/visulima/visulima/commit/b2acd864a40d0b2cc8eaf4e531cb2dedfd54181a))
* update license ([b2d306c](https://github.com/visulima/visulima/commit/b2d306cfeb1eabfd9e24880cb9198f6360724d82))


### Dependencies

* **@visulima/colorize:** upgraded to 2.0.0-alpha.6
* **@visulima/error:** upgraded to 6.0.0-alpha.6
* **@visulima/fmt:** upgraded to 2.0.0-alpha.6
* **@visulima/inspector:** upgraded to 2.0.0-alpha.5
* **@visulima/redact:** upgraded to 3.0.0-alpha.6
* **@visulima/string:** upgraded to 3.0.0-alpha.7

## @visulima/pail [4.0.0-alpha.7](https://github.com/visulima/visulima/compare/@visulima/pail@4.0.0-alpha.6...@visulima/pail@4.0.0-alpha.7) (2026-03-16)

### Features

* **pail:** add self-documenting errors, sampling processor, and environment processor ([3ec79de](https://github.com/visulima/visulima/commit/3ec79de3034cee4d1514dc93e78da2d05df4f9a7))
* **pail:** add wide events, framework middleware, tests, and docs ([6d1a4f3](https://github.com/visulima/visulima/commit/6d1a4f3ef4455da78371b8754cdbca9c939bc8b4))

### Miscellaneous Chores

* **pail:** update dependencies ([72b9561](https://github.com/visulima/visulima/commit/72b9561a3416a121198ea47cdcbe0202c0d8cbef))
* remove exit 0 ([b6d2408](https://github.com/visulima/visulima/commit/b6d2408fab8b5299a5ae902021b229909c84f184))
* visulima website ([#591](https://github.com/visulima/visulima/issues/591)) ([59ab2e2](https://github.com/visulima/visulima/commit/59ab2e2befb03e51cd2088956f83d9b87de6d033))

## @visulima/pail [4.0.0-alpha.6](https://github.com/visulima/visulima/compare/@visulima/pail@4.0.0-alpha.5...@visulima/pail@4.0.0-alpha.6) (2026-03-06)

### Bug Fixes

* **pail:** update packem to 2.0.0-alpha.54 ([100f545](https://github.com/visulima/visulima/commit/100f54587dca2c89aa70867d9a398d56ffb86ada))

### Miscellaneous Chores

* **error-debugging:** update dependencies ([6002ece](https://github.com/visulima/visulima/commit/6002ece1803b2ba8261cff42a362dd6e8ddcc3ee))
* **pail:** update dependencies ([5e4bf79](https://github.com/visulima/visulima/commit/5e4bf79575b61d2a299fcd45957fa3ea782f8194))
* **pail:** update dependencies ([4cc1e2a](https://github.com/visulima/visulima/commit/4cc1e2a48881684296d88a7f2107bd29f8457a25))
* update lock file maintenance ([d83e716](https://github.com/visulima/visulima/commit/d83e71697b75d24704185b66bb521a934d2db02d))
* year update ([47f4105](https://github.com/visulima/visulima/commit/47f410596ce7190cfea36a073db32e0cec50bbcd))


### Dependencies

* **@visulima/colorize:** upgraded to 2.0.0-alpha.5
* **@visulima/error:** upgraded to 6.0.0-alpha.5
* **@visulima/fmt:** upgraded to 2.0.0-alpha.5
* **@visulima/inspector:** upgraded to 2.0.0-alpha.4
* **@visulima/redact:** upgraded to 3.0.0-alpha.5
* **@visulima/string:** upgraded to 3.0.0-alpha.6

## @visulima/pail [4.0.0-alpha.5](https://github.com/visulima/visulima/compare/@visulima/pail@4.0.0-alpha.4...@visulima/pail@4.0.0-alpha.5) (2025-12-27)

### Bug Fixes

* **pail:** update package files ([7797567](https://github.com/visulima/visulima/commit/779756772379e8044b0dfa35815518450eff5cf6))


### Dependencies

* **@visulima/colorize:** upgraded to 2.0.0-alpha.4
* **@visulima/error:** upgraded to 6.0.0-alpha.3
* **@visulima/fmt:** upgraded to 2.0.0-alpha.4
* **@visulima/inspector:** upgraded to 2.0.0-alpha.3
* **@visulima/redact:** upgraded to 3.0.0-alpha.4
* **@visulima/string:** upgraded to 3.0.0-alpha.5

## @visulima/pail [4.0.0-alpha.4](https://github.com/visulima/visulima/compare/@visulima/pail@4.0.0-alpha.3...@visulima/pail@4.0.0-alpha.4) (2025-12-13)

### Miscellaneous Chores

* fixed project.json names and schema path ([964722f](https://github.com/visulima/visulima/commit/964722f691db205c7edb9aa6db29e849a647500b))


### Dependencies

* **@visulima/string:** upgraded to 3.0.0-alpha.4

## @visulima/pail [4.0.0-alpha.3](https://github.com/visulima/visulima/compare/@visulima/pail@4.0.0-alpha.2...@visulima/pail@4.0.0-alpha.3) (2025-12-11)

### Bug Fixes

* update package OG images across multiple packages ([f08e4dd](https://github.com/visulima/visulima/commit/f08e4dd2b105ccb29c8412020a9c2be36d6c1e9e))

### Miscellaneous Chores

* update package dependencies and improve configuration ([4ed22d6](https://github.com/visulima/visulima/commit/4ed22d6511aa8150dcd4ba7b9dccf05dbe2d6adc))


### Dependencies

* **@visulima/colorize:** upgraded to 2.0.0-alpha.3
* **@visulima/error:** upgraded to 6.0.0-alpha.2
* **@visulima/fmt:** upgraded to 2.0.0-alpha.3
* **@visulima/inspector:** upgraded to 2.0.0-alpha.2
* **@visulima/redact:** upgraded to 3.0.0-alpha.3
* **@visulima/string:** upgraded to 3.0.0-alpha.3

## @visulima/pail [4.0.0-alpha.2](https://github.com/visulima/visulima/compare/@visulima/pail@4.0.0-alpha.1...@visulima/pail@4.0.0-alpha.2) (2025-12-08)


### Dependencies

* **@visulima/string:** upgraded to 3.0.0-alpha.2

## @visulima/pail [4.0.0-alpha.1](https://github.com/visulima/visulima/compare/@visulima/pail@3.2.2...@visulima/pail@4.0.0-alpha.1) (2025-12-07)

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

* **@visulima/error:** upgraded to 6.0.0-alpha.1
* **@visulima/inspector:** upgraded to 2.0.0-alpha.1
* **@visulima/string:** upgraded to 3.0.0-alpha.1

## @visulima/pail [3.2.2](https://github.com/visulima/visulima/compare/@visulima/pail@3.2.1...@visulima/pail@3.2.2) (2025-11-13)

### Bug Fixes

* bump packem, to fix minified version of the code ([2a36ceb](https://github.com/visulima/visulima/commit/2a36ceb09251b0ca1178701a26547a871ed717a7))


### Dependencies

* **@visulima/colorize:** upgraded to 1.4.29
* **@visulima/error:** upgraded to 5.0.6
* **@visulima/fmt:** upgraded to 1.1.21
* **@visulima/inspector:** upgraded to 1.0.30
* **@visulima/redact:** upgraded to 2.0.5
* **@visulima/string:** upgraded to 2.0.6

## @visulima/pail [3.2.1](https://github.com/visulima/visulima/compare/@visulima/pail@3.2.0...@visulima/pail@3.2.1) (2025-11-12)

### Bug Fixes

* **deps:** update type-fest dependency across multiple packages ([93e13be](https://github.com/visulima/visulima/commit/93e13be5248207968a96303710db2a0604d16b9b))
* update package configurations and TypeScript definitions ([b59aa59](https://github.com/visulima/visulima/commit/b59aa59dac1508216b944f4b917fb4a7ab1f70a4))

### Miscellaneous Chores

* Add jsr file to all packages for release ([#565](https://github.com/visulima/visulima/issues/565)) ([ec91652](https://github.com/visulima/visulima/commit/ec91652b4e4112adf14ba152c1239a7703ba425a))
* **pail:** add rslog logging to benchmarks ([c5675c8](https://github.com/visulima/visulima/commit/c5675c880a81a979a713771d6c82f6d2682daaaa))
* **pail:** integrate roarr logging into benchmarks ([563bb52](https://github.com/visulima/visulima/commit/563bb52b7311ad9a3bfc4de6a2ff0593b2cfcc44))
* **pail:** update benchmark results and add rslog performance metrics ([123e2b5](https://github.com/visulima/visulima/commit/123e2b533dc3a75e6bab45055a4055897824630b))
* update license files and clean up TypeScript definitions ([fe668cc](https://github.com/visulima/visulima/commit/fe668cc26de23591d4df54a0954455ebbe31b22d))


### Dependencies

* **@visulima/colorize:** upgraded to 1.4.28
* **@visulima/error:** upgraded to 5.0.5
* **@visulima/fmt:** upgraded to 1.1.20
* **@visulima/inspector:** upgraded to 1.0.29
* **@visulima/redact:** upgraded to 2.0.4
* **@visulima/string:** upgraded to 2.0.5

## @visulima/pail [3.2.0](https://github.com/visulima/visulima/compare/@visulima/pail@3.1.0...@visulima/pail@3.2.0) (2025-11-07)

### Features

* **pail:** add child logger functionality with inheritance and overrides ([c5dce1d](https://github.com/visulima/visulima/commit/c5dce1d3208a75aac223cde650e1072e2fb333b2))
* **pail:** add OpenTelemetryProcessor for enhanced logging with trace context ([c7dfb9c](https://github.com/visulima/visulima/commit/c7dfb9c5bdabc7e41609d6c3fad9195a49de9a64))
* **pail:** implement force logging methods to bypass log level filters ([52b8516](https://github.com/visulima/visulima/commit/52b85168fc27feb23879d716ac68676d42d3aa3b))
* **pail:** introduce HTTP Reporter with Edge compatibility and enhanced logging features ([9cd695c](https://github.com/visulima/visulima/commit/9cd695c6ee34259b65ccd4b98dbe3a3d43bef50a))

### Bug Fixes

* **pail:** enhance PailBrowserType and PailServerType to extend Console ([ce7f2c6](https://github.com/visulima/visulima/commit/ce7f2c61551aa899b7775d04518340e61c2db1d2))
* update TypeScript configurations and improve linting across multiple packages ([6f25ec7](https://github.com/visulima/visulima/commit/6f25ec7841da7246f8f9166efc5292a7089d37ee))

### Miscellaneous Chores

* **pail:** add simple reporter example for basic usage and advanced features ([be16be5](https://github.com/visulima/visulima/commit/be16be5cbde1cf72019343be646361af02bef8de))
* **pail:** update package.json dependencies and fix example scripts ([8f98736](https://github.com/visulima/visulima/commit/8f9873619ca5ae49acd27ce63337958a7908c013))
* update npm and pnpm configurations for monorepo optimization ([#564](https://github.com/visulima/visulima/issues/564)) ([5512b42](https://github.com/visulima/visulima/commit/5512b42f672c216b6a3c9e39035199a4ebd9a4b8))

### Code Refactoring

* **pail:** replace hardcoded '/dev/null' with 'devNull' import for improved cross-platform compatibility ([3e8e95d](https://github.com/visulima/visulima/commit/3e8e95da4dc15d1ec0996b5ee3df403953e50c95))


### Dependencies

* **@visulima/colorize:** upgraded to 1.4.27
* **@visulima/error:** upgraded to 5.0.4
* **@visulima/fmt:** upgraded to 1.1.19
* **@visulima/inspector:** upgraded to 1.0.28
* **@visulima/redact:** upgraded to 2.0.3
* **@visulima/string:** upgraded to 2.0.4

## @visulima/pail [3.1.0](https://github.com/visulima/visulima/compare/@visulima/pail@3.0.3...@visulima/pail@3.1.0) (2025-11-05)

### Features

* add comprehensive documentation for Pail logging library ([6b552ad](https://github.com/visulima/visulima/commit/6b552adc5763aa13b9ac03f457db686c09a73e1c))
* add interactive module and update package.json ([bb9328c](https://github.com/visulima/visulima/commit/bb9328c98701108e601c07c5f1fff4f554c682cf))
* **pail:** add comprehensive documentation, object tree, spinner, and enhanced progress bar ([f69738b](https://github.com/visulima/visulima/commit/f69738b708fa73b6755d66b0c5ef5283e85fd55b))

### Miscellaneous Chores

* update dependencies in package.json for cerebro and pail ([4ff6e98](https://github.com/visulima/visulima/commit/4ff6e984e4e2707095bbdff76c1362fa7d30c8ec))
* update documentation and improve formatting across multiple files ([449b4fb](https://github.com/visulima/visulima/commit/449b4fbd1a57711e2daf5c8ded6a95c9cca87a03))

## @visulima/pail [3.0.3](https://github.com/visulima/visulima/compare/@visulima/pail@3.0.2...@visulima/pail@3.0.3) (2025-11-05)

### Bug Fixes

* update dependencies across multiple packages ([36a47f2](https://github.com/visulima/visulima/commit/36a47f26d65d25a7b4d8371186710e7d0ab61a2b))
* Upgraded `type-fest` to version `5.2.0` ([bd6cd53](https://github.com/visulima/visulima/commit/bd6cd5367ff102a7487372dc1ca7742a41c69ea9))


### Dependencies

* **@visulima/colorize:** upgraded to 1.4.26
* **@visulima/error:** upgraded to 5.0.3
* **@visulima/fmt:** upgraded to 1.1.18
* **@visulima/inspector:** upgraded to 1.0.27
* **@visulima/redact:** upgraded to 2.0.2
* **@visulima/string:** upgraded to 2.0.3

## @visulima/pail [3.0.2](https://github.com/visulima/visulima/compare/@visulima/pail@3.0.1...@visulima/pail@3.0.2) (2025-10-22)

### Miscellaneous Chores

* update package dependencies and configurations ([7bfe7e7](https://github.com/visulima/visulima/commit/7bfe7e71869580900aab50efb064b4293994ed9a))

### Tests

* enhance unit tests with beforeEach for mock cleanup ([aba2a50](https://github.com/visulima/visulima/commit/aba2a50d5031193fbb0902cfa407b5e226c43ced))


### Dependencies

* **@visulima/string:** upgraded to 2.0.2

## @visulima/pail [3.0.1](https://github.com/visulima/visulima/compare/@visulima/pail@3.0.0...@visulima/pail@3.0.1) (2025-10-21)

### Bug Fixes

* allow node v25 and updated dev deps ([8158cc5](https://github.com/visulima/visulima/commit/8158cc53ec92bd0331e8c6bd0fcbc8ab61b9320f))

### Miscellaneous Chores

* update @visulima/pail dependency to version 3.0.0 in bun package.json ([0d5e1de](https://github.com/visulima/visulima/commit/0d5e1de116b34b8ef09fd2822857e107942ec16a))
* update copyright year in LICENSE.md files ([c46a28d](https://github.com/visulima/visulima/commit/c46a28d2afb4cc7d73a7edde9a271a7156f87eae))
* update license years and add validation rules ([b97811e](https://github.com/visulima/visulima/commit/b97811ed2d253d908c0d86b4579a0a6bc33673a8))


### Dependencies

* **@visulima/colorize:** upgraded to 1.4.25
* **@visulima/fmt:** upgraded to 1.1.17
* **@visulima/inspector:** upgraded to 1.0.26
* **@visulima/redact:** upgraded to 2.0.1
* **@visulima/error:** upgraded to 5.0.2
* **@visulima/string:** upgraded to 2.0.1

## @visulima/pail [3.0.0](https://github.com/visulima/visulima/compare/@visulima/pail@2.1.31...@visulima/pail@3.0.0) (2025-10-20)

### ⚠ BREAKING CHANGES

* **pail:** - Public import paths for reporters changed. Use new scoped reporter entrypoints:
  Before:
    import { PrettyReporter } from '@visulima/pail/src/reporter/pretty/pretty.server';
  After:
    import { PrettyReporter } from '@visulima/pail/reporter/pretty';
  (Similar changes for raw, simple, json reporters. Browser/server-specific files were
  renamed e.g. pretty-reporter.server.ts / pretty-reporter.browser.ts and re-exported
  via reporter/* index files.)
- Deprecated top-level reporter and processor entrypoints removed:
  - Removed: 'src/reporter.server.ts', 'src/reporter.browser.ts'
  - Removed: 'src/processor.server.ts', 'src/processor.browser.ts'
  Use the dedicated reporter imports under '@visulima/pail/reporter/*' and the
  processor modules under 'src/processor/*' as re-exported by the package entrypoints.
- Interactive manager API and types were adjusted (see migration guide). Update usage of
  interactiveManager and related hooks to the new signatures.
- Types in 'src/types.ts' updated; consuming TypeScript projects may need to adjust
  imports/usages to match the refined reporter and progress bar types.

### Features

* **pail:** restructure reporters/API and add progress bar ([164420a](https://github.com/visulima/visulima/commit/164420a272ba3b6ac0ef773f202099d19c27a329))

### Bug Fixes

* **deps:** update minor updates ([#455](https://github.com/visulima/visulima/issues/455)) ([cebf7dc](https://github.com/visulima/visulima/commit/cebf7dcdc7f6ca423ad141f90f6c30279f5fa392))

### Miscellaneous Chores

* add new logging dependencies and benchmarks ([9633019](https://github.com/visulima/visulima/commit/963301910db84b2a78674f083331dad744fc8122))


### Dependencies

* **@visulima/error:** upgraded to 5.0.1

## @visulima/pail [2.1.31](https://github.com/visulima/visulima/compare/@visulima/pail@2.1.30...@visulima/pail@2.1.31) (2025-10-15)

### Bug Fixes

* downgrade @visulima/redact to version 1.0.15 ([3c2a8c2](https://github.com/visulima/visulima/commit/3c2a8c26c1e8ea5988a45cdea83811e200e4b99b))
* Downgraded `@visulima/error` to version 4.6.2. ([069e946](https://github.com/visulima/visulima/commit/069e94648aef5d965e8499b55b48c504c2048967))

## @visulima/pail [2.1.30](https://github.com/visulima/visulima/compare/@visulima/pail@2.1.29...@visulima/pail@2.1.30) (2025-10-15)

### Bug Fixes

* consolidate ESLint configuration and remove obsolete files for improved maintainability ([5b3e825](https://github.com/visulima/visulima/commit/5b3e825f3f2f428c9fb0950c300de10b42b657f9))
* update @visulima/packem to 2.0.0-alpha.32 across multiple packages for improved compatibility ([27b346e](https://github.com/visulima/visulima/commit/27b346eaa1c0fb0e420d9a9824482028307f4249))

### Miscellaneous Chores

* update package dependencies across multiple packages for improved compatibility and performance ([9567591](https://github.com/visulima/visulima/commit/9567591c415da3002f3a4fe08f8caf7ce01ca5f7))


### Dependencies

* **@visulima/colorize:** upgraded to 1.4.24
* **@visulima/error:** upgraded to 5.0.0
* **@visulima/fmt:** upgraded to 1.1.16
* **@visulima/inspector:** upgraded to 1.0.25
* **@visulima/redact:** upgraded to 2.0.0

## @visulima/pail [2.1.29](https://github.com/visulima/visulima/compare/@visulima/pail@2.1.28...@visulima/pail@2.1.29) (2025-09-23)

### Miscellaneous Chores

* update package.json and pnpm-lock.yaml to include publint@0.3.12 and adjust build/test commands to exclude shared-utils ([1f7b3c0](https://github.com/visulima/visulima/commit/1f7b3c0381d77edfeec80ea1bf57b3469e929414))


### Dependencies

* **@visulima/error:** upgraded to 4.6.2

## @visulima/pail [2.1.28](https://github.com/visulima/visulima/compare/@visulima/pail@2.1.27...@visulima/pail@2.1.28) (2025-09-19)

### Miscellaneous Chores

* **deps:** update build scripts and remove cross-env dependency ([7510e82](https://github.com/visulima/visulima/commit/7510e826b9235a0013fe61c82a7eb333bc4cbb78))


### Dependencies

* **@visulima/error:** upgraded to 4.6.1

## @visulima/pail [2.1.27](https://github.com/visulima/visulima/compare/@visulima/pail@2.1.26...@visulima/pail@2.1.27) (2025-09-12)

### Miscellaneous Chores

* update dependencies and fix linting issues ([0e802fe](https://github.com/visulima/visulima/commit/0e802fe02bb9ed791659cb5f3c77605ae5b42ec8))


### Dependencies

* **@visulima/error:** upgraded to 4.6.0

## @visulima/pail [2.1.26](https://github.com/visulima/visulima/compare/@visulima/pail@2.1.25...@visulima/pail@2.1.26) (2025-09-07)


### Dependencies

* **@visulima/error:** upgraded to 4.5.0

## @visulima/pail [2.1.25](https://github.com/visulima/visulima/compare/@visulima/pail@2.1.24...@visulima/pail@2.1.25) (2025-06-04)


### Dependencies

* **@visulima/colorize:** upgraded to 1.4.23
* **@visulima/error:** upgraded to 4.4.18
* **@visulima/inspector:** upgraded to 1.0.24

## @visulima/pail [2.1.24](https://github.com/visulima/visulima/compare/@visulima/pail@2.1.23...@visulima/pail@2.1.24) (2025-05-31)


### Dependencies

* **@visulima/inspector:** upgraded to 1.0.23

## @visulima/pail [2.1.23](https://github.com/visulima/visulima/compare/@visulima/pail@2.1.22...@visulima/pail@2.1.23) (2025-05-30)

### Bug Fixes

* **pail:** update dependencies ([99bd792](https://github.com/visulima/visulima/commit/99bd792fabc031fdba81c9d7f38a53124f233578))

### Miscellaneous Chores

* **pail-bench:** update devDependencies ([94c563c](https://github.com/visulima/visulima/commit/94c563cf673865dcfe927d399ca4b9a8615facb2))
* updated dev dependencies ([2433ed5](https://github.com/visulima/visulima/commit/2433ed5fb662e0303c37edee8ddc21b46c21263f))


### Dependencies

* **@visulima/colorize:** upgraded to 1.4.22
* **@visulima/error:** upgraded to 4.4.17
* **@visulima/inspector:** upgraded to 1.0.22
* **@visulima/redact:** upgraded to 1.0.15

## @visulima/pail [2.1.22](https://github.com/visulima/visulima/compare/@visulima/pail@2.1.21...@visulima/pail@2.1.22) (2025-03-07)

### Bug Fixes

* updated @visulima/packem and other dev deps, for better bundling size ([e940581](https://github.com/visulima/visulima/commit/e9405812201594e54dd81d17ddb74177df5f3c24))

### Miscellaneous Chores

* updated dev dependencies ([487a976](https://github.com/visulima/visulima/commit/487a976932dc7c39edfc19ffd3968960ff338066))


### Dependencies

* **@visulima/colorize:** upgraded to 1.4.21
* **@visulima/error:** upgraded to 4.4.16
* **@visulima/fmt:** upgraded to 1.1.15
* **@visulima/inspector:** upgraded to 1.0.21
* **@visulima/redact:** upgraded to 1.0.14

## @visulima/pail [2.1.21](https://github.com/visulima/visulima/compare/@visulima/pail@2.1.20...@visulima/pail@2.1.21) (2025-01-26)

### Bug Fixes

* **pail:** dont call extra log on the a function ([a272682](https://github.com/visulima/visulima/commit/a27268205556f0b338e0634143b5361b4e345e07))

## @visulima/pail [2.1.20](https://github.com/visulima/visulima/compare/@visulima/pail@2.1.19...@visulima/pail@2.1.20) (2025-01-25)

### Bug Fixes

* fixed wrong node version range in package.json ([4ae2929](https://github.com/visulima/visulima/commit/4ae292984681c71a770e4d4560432f7b7c5a141a))

### Miscellaneous Chores

* fixed typescript url ([fe65a8c](https://github.com/visulima/visulima/commit/fe65a8c0296ece7ee26474c70d065b06d4d0da89))
* updated all dev dependencies ([37fb298](https://github.com/visulima/visulima/commit/37fb298b2af7c63be64252024e54bb3af6ddabec))


### Dependencies

* **@visulima/colorize:** upgraded to 1.4.20
* **@visulima/error:** upgraded to 4.4.15
* **@visulima/fmt:** upgraded to 1.1.14
* **@visulima/inspector:** upgraded to 1.0.20
* **@visulima/redact:** upgraded to 1.0.13

## @visulima/pail [2.1.19](https://github.com/visulima/visulima/compare/@visulima/pail@2.1.18...@visulima/pail@2.1.19) (2025-01-22)

### Miscellaneous Chores

* updated all dev dependencies and all dependencies in the app folder ([87f4ccb](https://github.com/visulima/visulima/commit/87f4ccbf9f7900ec5b56f3c1477bc4a0ef571bcf))


### Dependencies

* **@visulima/colorize:** upgraded to 1.4.19
* **@visulima/error:** upgraded to 4.4.14
* **@visulima/inspector:** upgraded to 1.0.19
* **@visulima/redact:** upgraded to 1.0.12

## @visulima/pail [2.1.18](https://github.com/visulima/visulima/compare/@visulima/pail@2.1.17...@visulima/pail@2.1.18) (2025-01-13)


### Dependencies

* **@visulima/colorize:** upgraded to 1.4.18
* **@visulima/error:** upgraded to 4.4.13
* **@visulima/inspector:** upgraded to 1.0.18

## @visulima/pail [2.1.17](https://github.com/visulima/visulima/compare/@visulima/pail@2.1.16...@visulima/pail@2.1.17) (2025-01-12)

### Bug Fixes

* updated @visulima/packem, and all other dev dependencies ([7797a1c](https://github.com/visulima/visulima/commit/7797a1c3e6f1fc532895247bd88285a8a9883c40))


### Dependencies

* **@visulima/colorize:** upgraded to 1.4.17
* **@visulima/error:** upgraded to 4.4.12
* **@visulima/fmt:** upgraded to 1.1.13
* **@visulima/inspector:** upgraded to 1.0.17
* **@visulima/redact:** upgraded to 1.0.11

## @visulima/pail [2.1.16](https://github.com/visulima/visulima/compare/@visulima/pail@2.1.15...@visulima/pail@2.1.16) (2025-01-09)

### Bug Fixes

* **pail:** fixed wrong description ([14f0d57](https://github.com/visulima/visulima/commit/14f0d577a779ed003c316f5c791f06700609eabf))

## @visulima/pail [2.1.15](https://github.com/visulima/visulima/compare/@visulima/pail@2.1.14...@visulima/pail@2.1.15) (2025-01-08)


### Dependencies

* **@visulima/colorize:** upgraded to 1.4.16
* **@visulima/error:** upgraded to 4.4.11
* **@visulima/inspector:** upgraded to 1.0.16

## @visulima/pail [2.1.14](https://github.com/visulima/visulima/compare/@visulima/pail@2.1.13...@visulima/pail@2.1.14) (2025-01-08)


### Dependencies

* **@visulima/colorize:** upgraded to 1.4.15
* **@visulima/error:** upgraded to 4.4.10
* **@visulima/inspector:** upgraded to 1.0.15

## @visulima/pail [2.1.13](https://github.com/visulima/visulima/compare/@visulima/pail@2.1.12...@visulima/pail@2.1.13) (2024-12-31)

### Miscellaneous Chores

* updated dev dependencies ([9de2eab](https://github.com/visulima/visulima/commit/9de2eab91e95c8b9289d12f863a5167218770650))


### Dependencies

* **@visulima/colorize:** upgraded to 1.4.14
* **@visulima/error:** upgraded to 4.4.9
* **@visulima/inspector:** upgraded to 1.0.14

## @visulima/pail [2.1.12](https://github.com/visulima/visulima/compare/@visulima/pail@2.1.11...@visulima/pail@2.1.12) (2024-12-12)

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

* **@visulima/colorize:** upgraded to 1.4.13
* **@visulima/error:** upgraded to 4.4.8
* **@visulima/fmt:** upgraded to 1.1.12
* **@visulima/inspector:** upgraded to 1.0.13
* **@visulima/redact:** upgraded to 1.0.10

## @visulima/pail [2.1.11](https://github.com/visulima/visulima/compare/@visulima/pail@2.1.10...@visulima/pail@2.1.11) (2024-10-05)


### Dependencies

* **@visulima/colorize:** upgraded to 1.4.12
* **@visulima/error:** upgraded to 4.4.7
* **@visulima/inspector:** upgraded to 1.0.12

## @visulima/pail [2.1.10](https://github.com/visulima/visulima/compare/@visulima/pail@2.1.9...@visulima/pail@2.1.10) (2024-10-05)

### Bug Fixes

* updated dev dependencies, updated packem to v1.0.7, fixed naming of some lint config files ([c071a9c](https://github.com/visulima/visulima/commit/c071a9c8e129014a962ff654a16f302ca18a5c67))


### Dependencies

* **@visulima/colorize:** upgraded to 1.4.11
* **@visulima/error:** upgraded to 4.4.6
* **@visulima/fmt:** upgraded to 1.1.11
* **@visulima/inspector:** upgraded to 1.0.11
* **@visulima/redact:** upgraded to 1.0.9

## @visulima/pail [2.1.9](https://github.com/visulima/visulima/compare/@visulima/pail@2.1.8...@visulima/pail@2.1.9) (2024-09-24)

### Bug Fixes

* update packem to v1 ([05f3bc9](https://github.com/visulima/visulima/commit/05f3bc960df10a1602e24f9066e2b0117951a877))
* updated esbuild from v0.23 to v0.24 ([3793010](https://github.com/visulima/visulima/commit/3793010d0d549c0d41f85dea04b8436251be5fe8))

### Miscellaneous Chores

* updated dev dependencies ([05edb67](https://github.com/visulima/visulima/commit/05edb671285b1cc42875223314b24212e6a12588))


### Dependencies

* **@visulima/colorize:** upgraded to 1.4.10
* **@visulima/error:** upgraded to 4.4.5
* **@visulima/fmt:** upgraded to 1.1.10
* **@visulima/inspector:** upgraded to 1.0.10
* **@visulima/redact:** upgraded to 1.0.8

## @visulima/pail [2.1.8](https://github.com/visulima/visulima/compare/@visulima/pail@2.1.7...@visulima/pail@2.1.8) (2024-09-11)

### Bug Fixes

* fixed node10 support ([f5e78d9](https://github.com/visulima/visulima/commit/f5e78d9bff8fd603967666598b34f9338a8726b5))

### Miscellaneous Chores

* updated dev dependencies ([28b5ee5](https://github.com/visulima/visulima/commit/28b5ee5c805ca8868536418829cde7ba8c5bb8dd))


### Dependencies

* **@visulima/colorize:** upgraded to 1.4.9
* **@visulima/error:** upgraded to 4.4.4
* **@visulima/fmt:** upgraded to 1.1.9
* **@visulima/inspector:** upgraded to 1.0.9
* **@visulima/redact:** upgraded to 1.0.7

## @visulima/pail [2.1.7](https://github.com/visulima/visulima/compare/@visulima/pail@2.1.6...@visulima/pail@2.1.7) (2024-09-07)

### Bug Fixes

* fixed broken chunk splitting from packem ([1aaf277](https://github.com/visulima/visulima/commit/1aaf27779292d637923c5f8a220e18606e78caa2))


### Dependencies

* **@visulima/colorize:** upgraded to 1.4.8
* **@visulima/error:** upgraded to 4.4.3
* **@visulima/fmt:** upgraded to 1.1.8
* **@visulima/inspector:** upgraded to 1.0.8
* **@visulima/redact:** upgraded to 1.0.6

## @visulima/pail [2.1.6](https://github.com/visulima/visulima/compare/@visulima/pail@2.1.5...@visulima/pail@2.1.6) (2024-09-07)

### Bug Fixes

* added types support for node10 ([604583f](https://github.com/visulima/visulima/commit/604583fa3c24b950fafad45d17e7a1333040fd76))

### Styles

* cs fixes ([f5c4af7](https://github.com/visulima/visulima/commit/f5c4af7cfa9fc79b6d3fa60c1e48d88bffab5a08))

### Miscellaneous Chores

* update dev dependencies ([0738f98](https://github.com/visulima/visulima/commit/0738f9810478bb215ce4b2571dc8874c4c503089))


### Dependencies

* **@visulima/colorize:** upgraded to 1.4.7
* **@visulima/error:** upgraded to 4.4.2
* **@visulima/fmt:** upgraded to 1.1.7
* **@visulima/inspector:** upgraded to 1.0.7
* **@visulima/redact:** upgraded to 1.0.5

## @visulima/pail [2.1.5](https://github.com/visulima/visulima/compare/@visulima/pail@2.1.4...@visulima/pail@2.1.5) (2024-08-30)

### Bug Fixes

* **pail:** update safe-stable-stringify package to version 2.5.0 ([e463964](https://github.com/visulima/visulima/commit/e4639641231b73f3928cbef1753017b532378389))

### Styles

* **pail:** cs fix ([06b3af0](https://github.com/visulima/visulima/commit/06b3af06029421be64130ce591344a659f111275))

### Miscellaneous Chores

* updated dev dependencies ([45c2a76](https://github.com/visulima/visulima/commit/45c2a76bc974ecb2c6b172c3af03373d4cc6a5ce))


### Dependencies

* **@visulima/colorize:** upgraded to 1.4.6
* **@visulima/error:** upgraded to 4.4.1
* **@visulima/inspector:** upgraded to 1.0.6
* **@visulima/redact:** upgraded to 1.0.4

## @visulima/pail [2.1.4](https://github.com/visulima/visulima/compare/@visulima/pail@2.1.3...@visulima/pail@2.1.4) (2024-08-08)

### Miscellaneous Chores

* updated dev dependencies ([da46d8e](https://github.com/visulima/visulima/commit/da46d8ef8a964c086060944172f1bd931b7bde9a))


### Dependencies

* **@visulima/error:** upgraded to 4.4.0

## @visulima/pail [2.1.3](https://github.com/visulima/visulima/compare/@visulima/pail@2.1.2...@visulima/pail@2.1.3) (2024-08-04)


### Dependencies

* **@visulima/colorize:** upgraded to 1.4.5
* **@visulima/error:** upgraded to 4.3.2
* **@visulima/inspector:** upgraded to 1.0.5

## @visulima/pail [2.1.2](https://github.com/visulima/visulima/compare/@visulima/pail@2.1.1...@visulima/pail@2.1.2) (2024-08-01)

### Bug Fixes

* upgraded @visulima/packem ([dc0cb57](https://github.com/visulima/visulima/commit/dc0cb5701b30f3f81404346c909fd4daf891b894))

### Miscellaneous Chores

* updated dev dependencies ([ac67ec1](https://github.com/visulima/visulima/commit/ac67ec1bcba16175d225958e318199f60b10d179))


### Dependencies

* **@visulima/colorize:** upgraded to 1.4.4
* **@visulima/error:** upgraded to 4.3.1
* **@visulima/fmt:** upgraded to 1.1.6
* **@visulima/inspector:** upgraded to 1.0.4
* **@visulima/redact:** upgraded to 1.0.3

## @visulima/pail [2.1.1](https://github.com/visulima/visulima/compare/@visulima/pail@2.1.0...@visulima/pail@2.1.1) (2024-07-22)

### Miscellaneous Chores

* updated dev dependencies and sorted the package.json ([9571572](https://github.com/visulima/visulima/commit/95715725a8ed053ca24fd1405a55205c79342ecb))


### Dependencies

* **@visulima/inspector:** upgraded to 1.0.3

## @visulima/pail [2.1.0](https://github.com/visulima/visulima/compare/@visulima/pail@2.0.1...@visulima/pail@2.1.0) (2024-07-10)

### Features

* **pail:** added new options for the json error serializer ([6df9535](https://github.com/visulima/visulima/commit/6df95355cacc50f420d9fd6c583c13e69da728fb))

## @visulima/pail [2.0.1](https://github.com/visulima/visulima/compare/@visulima/pail@2.0.0...@visulima/pail@2.0.1) (2024-07-09)

### Bug Fixes

* **fail:** fixed types for error and inspect options ([cc4202c](https://github.com/visulima/visulima/commit/cc4202c22936e2ebd4d640018387e4e5acc3154f))

## @visulima/pail [2.0.0](https://github.com/visulima/visulima/compare/@visulima/pail@1.4.4...@visulima/pail@2.0.0) (2024-07-09)

### ⚠ BREAKING CHANGES

* removed abstract-file-reporter - the new base is now the AbstractJsonReporter, removed ErrorProcessor - was replaced with @visulima/error
Signed-off-by: prisis <d.bannert@anolilab.de>

### Features

* switched error serialize to @visulima/error, export type for reporter options ([a761356](https://github.com/visulima/visulima/commit/a761356a9215a8dc72a1477d5b0a493c73aa7b88))

## @visulima/pail [1.4.4](https://github.com/visulima/visulima/compare/@visulima/pail@1.4.3...@visulima/pail@1.4.4) (2024-07-09)

### Bug Fixes

* **pail:** adding better error view ([#450](https://github.com/visulima/visulima/issues/450)) ([21f3622](https://github.com/visulima/visulima/commit/21f362256edc903fc2f1ab70f2264fe90234f896))

### Styles

* cs fixes ([ee5ed6f](https://github.com/visulima/visulima/commit/ee5ed6f31bdabcfacdb0d1abd1eff2cc6207cefc))
* cs fixes ([cf19938](https://github.com/visulima/visulima/commit/cf199384f25cd6e97d4041317b35b6a3cc586f88))
* cs fixes found by eslint and prettier ([69ef744](https://github.com/visulima/visulima/commit/69ef7444c0bfbf1c94763623332e06b7fffc0039))

### Miscellaneous Chores

* added private true into fixture package.json files ([4a9494c](https://github.com/visulima/visulima/commit/4a9494c642fa98f224505a1d231b5af4e73d6c79))
* changed typescript version back to 5.4.5 ([55d28bb](https://github.com/visulima/visulima/commit/55d28bbdc103718d19f844034b38a0e8e5af798a))
* **pail:** fixed benchmarks ([238aeaf](https://github.com/visulima/visulima/commit/238aeaf550324b19aa4ee9b4b3d5928380abe5ff))
* updated dev dependencies ([34df456](https://github.com/visulima/visulima/commit/34df4569f2fc074823a406c44a131c8fbae2b147))
* updated dev dependencies ([c889486](https://github.com/visulima/visulima/commit/c889486f8980741f459b993648c1b6d0815e3d66))

## @visulima/pail [1.4.3](https://github.com/visulima/visulima/compare/@visulima/pail@1.4.2...@visulima/pail@1.4.3) (2024-06-14)

### Bug Fixes

* **pail:** fixed striping of spaces from messages ([6d6ae8b](https://github.com/visulima/visulima/commit/6d6ae8baac4844b2b90baee62105fa66e772d529))

## @visulima/pail [1.4.2](https://github.com/visulima/visulima/compare/@visulima/pail@1.4.1...@visulima/pail@1.4.2) (2024-06-14)

### Bug Fixes

* **pail:** fixed broken grouping of logs ([2922a17](https://github.com/visulima/visulima/commit/2922a17dd983e06b9a76f2abe4bf19eec5c263f1))

## @visulima/pail [1.4.1](https://github.com/visulima/visulima/compare/@visulima/pail@1.4.0...@visulima/pail@1.4.1) (2024-06-14)

### Bug Fixes

* **pail:** fixed missing warning on timeEnd, added more tests, fixed wrong default of pail server and browser ([a67254d](https://github.com/visulima/visulima/commit/a67254d3fce460b49b41c1183bd8b1cfd4a11a1c))

## @visulima/pail [1.4.0](https://github.com/visulima/visulima/compare/@visulima/pail@1.3.1...@visulima/pail@1.4.0) (2024-06-14)

### Features

* **pail:** adding inspector into pretty reporters ([#424](https://github.com/visulima/visulima/issues/424)) ([76b1435](https://github.com/visulima/visulima/commit/76b14350904eb9b2e5c3b92b273204db11a2b6f8))

## @visulima/pail [1.3.1](https://github.com/visulima/visulima/compare/@visulima/pail@1.3.0...@visulima/pail@1.3.1) (2024-06-14)

### Bug Fixes

* **pail:** fixed rendering of undefined and null as a message ([eb80d23](https://github.com/visulima/visulima/commit/eb80d2309641eb79aed02eafe743d77f6c402d02))

### Styles

* **pail:** cs fixes ([f1b9549](https://github.com/visulima/visulima/commit/f1b9549bcb24b3f31f8c21dc0b5af30b50e61859))

## @visulima/pail [1.3.0](https://github.com/visulima/visulima/compare/@visulima/pail@1.2.2...@visulima/pail@1.3.0) (2024-06-14)

### Features

* **pail:** added new redact processor ([#423](https://github.com/visulima/visulima/issues/423)) ([0614067](https://github.com/visulima/visulima/commit/0614067bec83a46ffe92abfb8a715b2c385b1d7d))

## @visulima/pail [1.2.2](https://github.com/visulima/visulima/compare/@visulima/pail@1.2.1...@visulima/pail@1.2.2) (2024-06-14)

### Bug Fixes

* **pail:** fixed wrong global import of rotating-file-stream, this did call the require to early ([ac0c8bc](https://github.com/visulima/visulima/commit/ac0c8bcf3dfc5fb197e7b89ab5d32d3dc2ec5abd))

## @visulima/pail [1.2.1](https://github.com/visulima/visulima/compare/@visulima/pail@1.2.0...@visulima/pail@1.2.1) (2024-06-13)

### Bug Fixes

* **pail:** fixed wrong require use of rotating-file-stream ([37d9353](https://github.com/visulima/visulima/commit/37d9353e84f9373e1ba05c622e28a5a254d1d5e5))
* **pail:** moved import of rotating-file-stream into a lazy import, removed wrong never typing ([0513e27](https://github.com/visulima/visulima/commit/0513e2719eebda4d139ae406cfadd2ae483be5ba))

## @visulima/pail [1.2.0](https://github.com/visulima/visulima/compare/@visulima/pail@1.1.13...@visulima/pail@1.2.0) (2024-06-13)

### Features

* added simple reporter, fixed caller return, changed log color ([#418](https://github.com/visulima/visulima/issues/418)) ([e22b954](https://github.com/visulima/visulima/commit/e22b9543dc9eaf118e415414d31b5119e4a2455a))

## @visulima/pail [1.1.13](https://github.com/visulima/visulima/compare/@visulima/pail@1.1.12...@visulima/pail@1.1.13) (2024-06-13)

### Miscellaneous Chores

* updated all dev deps ([ef143ce](https://github.com/visulima/visulima/commit/ef143ce2e15952a0910aa5c8bd78d25de9ebd7f3))

### Build System

* fixed found audit error, updated all dev package deps, updated deps in apps and examples ([4c51950](https://github.com/visulima/visulima/commit/4c519500dc5504579d35725572920658999885cb))


### Dependencies

* **@visulima/colorize:** upgraded to 1.4.3

## @visulima/pail [1.1.12](https://github.com/visulima/visulima/compare/@visulima/pail@1.1.11...@visulima/pail@1.1.12) (2024-06-06)


### Bug Fixes

* allow node v22 ([890d457](https://github.com/visulima/visulima/commit/890d4570f18428e2463944813c0c638b3f142803))


### Miscellaneous Chores

* updated dev dependencies ([a2e0504](https://github.com/visulima/visulima/commit/a2e0504dc239049434c2482756ff15bdbaac9b54))



### Dependencies

* **@visulima/colorize:** upgraded to 1.4.2
* **@visulima/fmt:** upgraded to 1.1.5

## @visulima/pail [1.1.11](https://github.com/visulima/visulima/compare/@visulima/pail@1.1.10...@visulima/pail@1.1.11) (2024-05-24)


### Styles

* cs fixes ([7bf5b91](https://github.com/visulima/visulima/commit/7bf5b91383b612598d955fe23505c94f22a8d277))


### Miscellaneous Chores

* changed semantic-release-npm to pnpm ([b6d100a](https://github.com/visulima/visulima/commit/b6d100a2bf3fd026577be48726a37754947f0973))
* updated dev dependencies ([2e08f23](https://github.com/visulima/visulima/commit/2e08f23ba4f23ff4c64a36807b53242e9497c073))
* updated dev dependencies ([abd319c](https://github.com/visulima/visulima/commit/abd319c23576aa1dc751ac874e806bddbc977d51))
* updated dev dependencies ([0767afe](https://github.com/visulima/visulima/commit/0767afe9be83da6698c1343724400171f952599e))
* updated dev dependencies ([d7791e3](https://github.com/visulima/visulima/commit/d7791e327917e438757636573b1e5549a97bba7b))
* updated dev dependencies ([6005345](https://github.com/visulima/visulima/commit/60053456717a3889fc77b4fb5b05d50a662475b2))



### Dependencies

* **@visulima/colorize:** upgraded to 1.4.1

## @visulima/pail [1.1.10](https://github.com/visulima/visulima/compare/@visulima/pail@1.1.9...@visulima/pail@1.1.10) (2024-04-27)


### Bug Fixes

* **api-platform:** updated ts-japi dep ([4f4d29f](https://github.com/visulima/visulima/commit/4f4d29f5995c899926837edb1703f4ea262bba09))

## @visulima/pail [1.1.9](https://github.com/visulima/visulima/compare/@visulima/pail@1.1.8...@visulima/pail@1.1.9) (2024-04-17)


### Bug Fixes

* **pail:** fixed log rendering for small terminal, exported error processor ([47afd8a](https://github.com/visulima/visulima/commit/47afd8a3777cb8d42ae9686d322f4a44f0315797))

## @visulima/pail [1.1.8](https://github.com/visulima/visulima/compare/@visulima/pail@1.1.7...@visulima/pail@1.1.8) (2024-04-10)



### Dependencies

* **@visulima/colorize:** upgraded to 1.4.0

## @visulima/pail [1.1.7](https://github.com/visulima/visulima/compare/@visulima/pail@1.1.6...@visulima/pail@1.1.7) (2024-04-09)



### Dependencies

* **@visulima/colorize:** upgraded to 1.3.3

## @visulima/pail [1.1.6](https://github.com/visulima/visulima/compare/@visulima/pail@1.1.5...@visulima/pail@1.1.6) (2024-04-09)



### Dependencies

* **@visulima/colorize:** upgraded to 1.3.2

## @visulima/pail [1.1.5](https://github.com/visulima/visulima/compare/@visulima/pail@1.1.4...@visulima/pail@1.1.5) (2024-04-07)


### Bug Fixes

* **pail:** fixed error handling as context ([#389](https://github.com/visulima/visulima/issues/389)) ([f24e3a0](https://github.com/visulima/visulima/commit/f24e3a03594b3fdc2fcdab832cf887462fd98024))

## @visulima/pail [1.1.4](https://github.com/visulima/visulima/compare/@visulima/pail@1.1.3...@visulima/pail@1.1.4) (2024-03-30)


### Bug Fixes

* **pail:** fixed wrong function call on wrapConsole ([0ae24cf](https://github.com/visulima/visulima/commit/0ae24cf287723e1ca108846d4bef4377974f8ad9))

## @visulima/pail [1.1.3](https://github.com/visulima/visulima/compare/@visulima/pail@1.1.2...@visulima/pail@1.1.3) (2024-03-27)


### Bug Fixes

* added missing os key to package.json ([4ad1268](https://github.com/visulima/visulima/commit/4ad1268ed12cbdcf60aeb46d4c052ed1696bc150))



### Dependencies

* **@visulima/colorize:** upgraded to 1.3.1
* **@visulima/fmt:** upgraded to 1.1.4

## @visulima/pail [1.1.2](https://github.com/visulima/visulima/compare/@visulima/pail@1.1.1...@visulima/pail@1.1.2) (2024-03-19)


### Bug Fixes

* **pail:** fixed cjs export ([#352](https://github.com/visulima/visulima/issues/352)) ([cf84ce6](https://github.com/visulima/visulima/commit/cf84ce63f1ec504601592092611d8ba85fbae17e))

## @visulima/pail [1.1.1](https://github.com/visulima/visulima/compare/@visulima/pail@1.1.0...@visulima/pail@1.1.1) (2024-03-07)


### Bug Fixes

* fixed logger function type, for better input typing ([f08bbd4](https://github.com/visulima/visulima/commit/f08bbd44b33e62dc0f04fb516557541abaec6863))

## @visulima/pail [1.1.0](https://github.com/visulima/visulima/compare/@visulima/pail@1.0.0...@visulima/pail@1.1.0) (2024-03-04)


### Features

* adding new gradient helper ([#324](https://github.com/visulima/visulima/issues/324)) ([49b1ab0](https://github.com/visulima/visulima/commit/49b1ab0c94b1e6c272ae41e2477b064150c9ec49))


### Bug Fixes

* fixed all found type issues ([eaa40d1](https://github.com/visulima/visulima/commit/eaa40d11f3fc056dfddcc25404bf109587ef2862))
* minifyWhitespace on prod build, removed @tsconfig/* configs ([410cb73](https://github.com/visulima/visulima/commit/410cb737c44c445a0479bdd49b4100d5daf2d83d))



### Dependencies

* **@visulima/colorize:** upgraded to 1.3.0
* **@visulima/fmt:** upgraded to 1.1.3

## @visulima/pail 1.0.0 (2024-02-28)


### Features

* added all tests to the is-ansi-color-supported, updated deps ([6639e75](https://github.com/visulima/visulima/commit/6639e75ab45fe4dfc0338b9f5b2527354e3cb36e))
* added correct badge display, adding new docs ([5c7ff29](https://github.com/visulima/visulima/commit/5c7ff297f7cebddaec6472ae8709036f93d3e6cf))
* added count and countReset, fixed time, timeLog and timeEnd ([bef8926](https://github.com/visulima/visulima/commit/bef8926b1813394f36cbaec0fe2b076d514fb2d3))
* added header images ([21e8d5a](https://github.com/visulima/visulima/commit/21e8d5a5e9fec47e7a3362e0f76d8e6840d02fc9))
* added more docs ([ec33d26](https://github.com/visulima/visulima/commit/ec33d268a66fd62d2e1841bc235a7734d736e581))
* added new color pacakge ([ca23c3d](https://github.com/visulima/visulima/commit/ca23c3d8582b0c0eb77870f57394696f587e72c4))
* added new interactive manager, fixed tests, fixed styling, and more ([e7359d3](https://github.com/visulima/visulima/commit/e7359d379f2e4b6f8d8953448055fcfa613fc41e))
* added tests ([e30de63](https://github.com/visulima/visulima/commit/e30de63aa522490914b8bd627e2d7b0185b9b3b6))
* added time, timeLog and timeEnd, better design for browser console, some fixes ([737378a](https://github.com/visulima/visulima/commit/737378a1f16d9d113dcee09ae5c129b15d9de46f))
* adding interactive mode ([a88ccb4](https://github.com/visulima/visulima/commit/a88ccb453375eeae9f7bdbb84b67151da1a3d875))
* adding new raw reporter and raw function to pail ([#320](https://github.com/visulima/visulima/issues/320)) ([e6cf56f](https://github.com/visulima/visulima/commit/e6cf56ffc98213f8631b25ad09775d65c109cc5f))
* fixed some design issues between server and browser, added trace ([57a34b6](https://github.com/visulima/visulima/commit/57a34b6aa2cac4ff7bad85ec52f9d3a64958e8fe))
* improvement ([1964590](https://github.com/visulima/visulima/commit/1964590e2699adb3c5d1e6856f177fa5269885c4))
* more work ([3d41672](https://github.com/visulima/visulima/commit/3d4167217305c293128853bc8ece457d899973c4))
* more work ([435ca60](https://github.com/visulima/visulima/commit/435ca608587932aab8cb66d0c7c4fdb81bc9aeb0))
* more work on the logger ([01f2f94](https://github.com/visulima/visulima/commit/01f2f9452d938c0a8bcda7ab217e4d5c2ca2495a))
* more work on the logger ([3b8b1f0](https://github.com/visulima/visulima/commit/3b8b1f0dab65a0b6e882f8786fa820e5e57460c3))
* more work on the logger ([93b658b](https://github.com/visulima/visulima/commit/93b658b9704f3ce4b3a734eed97efd677ce028f5))
* more work on the logger ([95e5f2a](https://github.com/visulima/visulima/commit/95e5f2a0ed77700c3ff574e28485f9e6440bfe5e))
* more work on the logger ([93a9d4c](https://github.com/visulima/visulima/commit/93a9d4c1cb07de4a827dade9e37ff31d9bf1e330))
* new color and support color package ([c580e05](https://github.com/visulima/visulima/commit/c580e05aaf516e4ecb939bcb39dcc5305ee17aed))
* new console interface func, fixed some eslint errors ([84917bd](https://github.com/visulima/visulima/commit/84917bdd14312716038ff390907cf53cfbffec4f))
* removed child handling ([39abe92](https://github.com/visulima/visulima/commit/39abe922ca57fd09dce6b4e13e0f03824e3da2e0))
* removed some deps ([bd6150a](https://github.com/visulima/visulima/commit/bd6150a69f1d7fc5693ab7d540b3548d2aca1307))
* speed up pail ([2caab01](https://github.com/visulima/visulima/commit/2caab01fb5052990905b18dfb623bbbd8222ee99))
* split pail into browser class and server class ([23dbcd6](https://github.com/visulima/visulima/commit/23dbcd692efa52b40e75f8b06de31cd4986348a5))
* updated readme ([69278b3](https://github.com/visulima/visulima/commit/69278b3b9745912508d2c195ac37be101d9b1968))
* updated readme ([faa6425](https://github.com/visulima/visulima/commit/faa6425ae9808740f3b29c61419d3ae2d773534a))
* updated readme ([10adfed](https://github.com/visulima/visulima/commit/10adfed8dae983c2613d98ce4cf274dc841be42e))
* updated string template to normale strings ([a796e0f](https://github.com/visulima/visulima/commit/a796e0f6766854d29bd4c77ce714b117e0d3f33c))


### Bug Fixes

* added missing exports ([0d0ad93](https://github.com/visulima/visulima/commit/0d0ad9388017c562679f56d51a226b5d1eb86936))
* fixed build step ([a882a13](https://github.com/visulima/visulima/commit/a882a13e5041aed9dc3ce37e5f97b628b2501622))
* fixed cjs export, fixed eslint errors ([d401258](https://github.com/visulima/visulima/commit/d4012587828d78680e6f1a1370720d5a3660d094))
* fixed fmt handling ([a0b2352](https://github.com/visulima/visulima/commit/a0b23525935c68ea270803b2d907d87187f2eb0b))
* fixed found issues ([858bc32](https://github.com/visulima/visulima/commit/858bc3257d24b2159df801dcde948d4fcfc495b1))
* fixed package.json exports ([685b636](https://github.com/visulima/visulima/commit/685b636b471712e3888db645f1897e6bc7710f7c))
* fixed test ([c1b56f6](https://github.com/visulima/visulima/commit/c1b56f6202c8ec5ab9f1b4f9c44e4aa5fc0f71c5))
* fixed tests ([a3df0e2](https://github.com/visulima/visulima/commit/a3df0e2ec27314e4419d224a740dff93e121a19a))



### Dependencies

* **@visulima/colorize:** upgraded to 1.2.2
