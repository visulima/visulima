## @visulima/path [3.0.0](https://github.com/visulima/visulima/compare/@visulima/path@2.0.5...@visulima/path@3.0.0) (2026-07-03)

### ⚠ BREAKING CHANGES

* change min node version to 22.13

### Features

* **web:** auto-generate packages page from workspace metadata ([623e520](https://github.com/visulima/visulima/commit/623e5207693a7fe720f5f2f179593a3654c880e3))

### Bug Fixes

* add new package image, fixed readme rendering on npm, fixed building of packages ([b790ba2](https://github.com/visulima/visulima/commit/b790ba253ea07fef83528fd822a678facf021b5f))
* **filesystem:** resolve eslint issues in fs, path, and find-cache-dir ([59ad5e3](https://github.com/visulima/visulima/commit/59ad5e3051e92365eb8b1fdd73d4f4fd1f4bb547))
* **path:** cast path module to Path type via unknown ([03954b4](https://github.com/visulima/visulima/commit/03954b4ae624724dc20ffde1f88cabe0e898e69d))
* **path:** fix basename ext, linearize relative ([6e3d160](https://github.com/visulima/visulima/commit/6e3d1608cb1927f98c78bdfcacf05c0124ccfe33))
* **path:** resolve eslint and formatting issues ([cf04504](https://github.com/visulima/visulima/commit/cf0450412b448bf2c1a6ed19637510555028a80e))
* **path:** resolve eslint errors ([51d88af](https://github.com/visulima/visulima/commit/51d88af7203408e9959cbcdadce0ffafe23074b4))
* **path:** stop format leaking "undefined" and align delimiter to posix ([d37eb39](https://github.com/visulima/visulima/commit/d37eb3986f284f05f873009e035c2e6c8bccfff1))
* **path:** update package files ([ec317d7](https://github.com/visulima/visulima/commit/ec317d77f3e54a320875130682c3db84f778448f))
* **path:** update packem to 2.0.0-alpha.54 ([5962ac2](https://github.com/visulima/visulima/commit/5962ac23fc149e4b6c8032883a14b02b57e5e812))
* **path:** widen filename() return type to string | undefined ([f88109b](https://github.com/visulima/visulima/commit/f88109bfaf4d7f0e6fdebb3080cf0fd389aa4dcb))
* Remove JSR configuration generation script and generated jsr.json files ([#616](https://github.com/visulima/visulima/issues/616)) ([533744b](https://github.com/visulima/visulima/commit/533744b103b74896941db5b727173e617a27a63b))
* **storage-client:** percent-encode user fields in defaultFingerprint ([7c78a0f](https://github.com/visulima/visulima/commit/7c78a0f9512e2a673b941d80839e9f1e86b7b5d0))
* update Node.js engine version requirement to >=22.13 in multiple package.json files for improved compatibility ([b828e9a](https://github.com/visulima/visulima/commit/b828e9aeaebfc798eecddccd90e6ec7560c6d36a))
* update package OG images across multiple packages ([f08e4dd](https://github.com/visulima/visulima/commit/f08e4dd2b105ccb29c8412020a9c2be36d6c1e9e))
* **web:** improve build setup with incremental stats caching and prod install ([fe33e75](https://github.com/visulima/visulima/commit/fe33e75827586779b4b3a0c6d57b39f889ee6207))

### Documentation

* **object,redact,colorize,path,fs:** add comprehensive Fumadocs documentation ([19c3840](https://github.com/visulima/visulima/commit/19c384041db855e1c2de41ce2067458b39737565))

### Styles

* cs fixes ([2a960bb](https://github.com/visulima/visulima/commit/2a960bb1772c9dc70080e2d75d3a0d827034e294))

### Miscellaneous Chores

* add fallow code-intelligence across all packages ([a3b4821](https://github.com/visulima/visulima/commit/a3b48215002e86fed20f2973038b5d4a0aa1ce04))
* apply eslint + prettier autofixes across packages ([c1bb784](https://github.com/visulima/visulima/commit/c1bb7848a0d93d0dfe2960c77e3cda22239c79a0))
* apply linting and formatting fixes across packages ([5d150a5](https://github.com/visulima/visulima/commit/5d150a578f9ce861c791843c683deeb849b774a9))
* bump engines.node to ^22.14.0 || >=24.10.0 ([c3d0931](https://github.com/visulima/visulima/commit/c3d0931d1504e4f21ebf50ea680cfa7ce4ba15ce))
* **ci-stability:** green CI across vis, native, lint, tests, attw ([#651](https://github.com/visulima/visulima/issues/651)) ([d4eb684](https://github.com/visulima/visulima/commit/d4eb684b5f75c818c9251048c605a0ed54a268e3))
* **filesystem:** remove empty dependency objects from package.json ([76ffc54](https://github.com/visulima/visulima/commit/76ffc545660695dde19130d1c01d9bd1aaf2ca98))
* **filesystem:** update dependencies ([d1a4591](https://github.com/visulima/visulima/commit/d1a45917ba9547a1d7f1b6f62d85ab99bc059dd4))
* fixed jsr.json ([5d85e51](https://github.com/visulima/visulima/commit/5d85e5179de38e284ec433b14d77c71a1619c8d6))
* fixed project.json names and schema path ([964722f](https://github.com/visulima/visulima/commit/964722f691db205c7edb9aa6db29e849a647500b))
* moved all packages into groups ([0615e9d](https://github.com/visulima/visulima/commit/0615e9d14a8a886e11da529ce150cf31ca973c10))
* **path:** add tsconfig.eslint.json for type-aware linting ([07195c0](https://github.com/visulima/visulima/commit/07195c08d7ce008a785ba819e77ce03e39b205e8))
* **path:** apply auto-fix formatting ([c81f1fa](https://github.com/visulima/visulima/commit/c81f1fadd66186b44a99b8e1a93d7776b55773f0))
* **path:** apply pending changes ([aa09bf2](https://github.com/visulima/visulima/commit/aa09bf22dc279a0cd780c40ddbb7ed13a1d66791))
* **path:** apply pending lint and source updates ([66822e8](https://github.com/visulima/visulima/commit/66822e83c73ea793200bd298cf7cfd191fc53927))
* **path:** apply prettier formatting ([5938bf0](https://github.com/visulima/visulima/commit/5938bf0e16e92d419d141e9724214307be7bc5e7))
* **path:** clear lint warnings ([78132f0](https://github.com/visulima/visulima/commit/78132f056527960d3656bab418600961b384ad03))
* **path:** housekeeping cleanup ([0547959](https://github.com/visulima/visulima/commit/0547959fca0a257e1c97afea7dda5503bcce51fa))
* **path:** migrate .prettierrc.cjs to prettier.config.js ([51caf05](https://github.com/visulima/visulima/commit/51caf05c0cf3a08f7e0233c8cdd0410b8cde1a85))
* **path:** migrate deps to pnpm catalogs ([aced0d8](https://github.com/visulima/visulima/commit/aced0d88d37ff54859708e18d9ebe3f0af756c74))
* **path:** update dependencies ([f749b0c](https://github.com/visulima/visulima/commit/f749b0cdc4d9a1ba1ea4f25bfc3305c9368eea06))
* **path:** update dependencies ([f181051](https://github.com/visulima/visulima/commit/f181051b127365af160e48af381f95fd6ff2d258))
* **path:** update dependencies ([c6a5899](https://github.com/visulima/visulima/commit/c6a5899f4fbf7fabf3d4bb9154e9db6c9eb33530))
* **path:** upgrade packem to 2.0.0-alpha.76 ([78dafcd](https://github.com/visulima/visulima/commit/78dafcd1ddab44d25298ebe13d235dedbc4f9829))
* re-sort workspace package.json files via vis sort-package-json ([f625696](https://github.com/visulima/visulima/commit/f625696cfac974325774b3243e1a83c3d23acbd7))
* **release:** @visulima/path@3.0.0-alpha.1 [skip ci]\n\n## @visulima/path [3.0.0-alpha.1](https://github.com/visulima/visulima/compare/@visulima/path@2.0.5...@visulima/path@3.0.0-alpha.1) (2025-12-04) ([b283e0b](https://github.com/visulima/visulima/commit/b283e0b1f0c7a10c470995a2a9faeaed27fd51a0))
* **release:** @visulima/path@3.0.0-alpha.10 [skip ci]\n\n## @visulima/path [3.0.0-alpha.10](https://github.com/visulima/visulima/compare/@visulima/path@3.0.0-alpha.9...@visulima/path@3.0.0-alpha.10) (2026-04-22) ([44d9bce](https://github.com/visulima/visulima/commit/44d9bceb79fbeb4b807eabfdd8688025241797ab))
* **release:** @visulima/path@3.0.0-alpha.11 [skip ci]\n\n## @visulima/path [3.0.0-alpha.11](https://github.com/visulima/visulima/compare/@visulima/path@3.0.0-alpha.10...@visulima/path@3.0.0-alpha.11) (2026-05-27) ([daeef86](https://github.com/visulima/visulima/commit/daeef862b4236821a7f0514df8eec96bfd6573af))
* **release:** @visulima/path@3.0.0-alpha.12 [skip ci]\n\n## @visulima/path [3.0.0-alpha.12](https://github.com/visulima/visulima/compare/@visulima/path@3.0.0-alpha.11...@visulima/path@3.0.0-alpha.12) (2026-06-04) ([7293806](https://github.com/visulima/visulima/commit/7293806a4566c2bd6015501d29480cfa32a31c35))
* **release:** @visulima/path@3.0.0-alpha.13 [skip ci]\n\n## @visulima/path [3.0.0-alpha.13](https://github.com/visulima/visulima/compare/@visulima/path@3.0.0-alpha.12...@visulima/path@3.0.0-alpha.13) (2026-06-13) ([0114542](https://github.com/visulima/visulima/commit/0114542643ff4865907237efcac6492f696718d7))
* **release:** @visulima/path@3.0.0-alpha.2 [skip ci]\n\n## @visulima/path [3.0.0-alpha.2](https://github.com/visulima/visulima/compare/@visulima/path@3.0.0-alpha.1...@visulima/path@3.0.0-alpha.2) (2025-12-06) ([b0b8234](https://github.com/visulima/visulima/commit/b0b82349fb1757a56eb6b913195ab5968d1a847f))
* **release:** @visulima/path@3.0.0-alpha.3 [skip ci]\n\n## @visulima/path [3.0.0-alpha.3](https://github.com/visulima/visulima/compare/@visulima/path@3.0.0-alpha.2...@visulima/path@3.0.0-alpha.3) (2025-12-11) ([cace09b](https://github.com/visulima/visulima/commit/cace09b8a96feef8e9acf56604450c624fbe64fb))
* **release:** @visulima/path@3.0.0-alpha.4 [skip ci]\n\n## @visulima/path [3.0.0-alpha.4](https://github.com/visulima/visulima/compare/@visulima/path@3.0.0-alpha.3...@visulima/path@3.0.0-alpha.4) (2025-12-27) ([a190e80](https://github.com/visulima/visulima/commit/a190e8073b2c80332a1acd772394e818503ca858))
* **release:** @visulima/path@3.0.0-alpha.5 [skip ci]\n\n## @visulima/path [3.0.0-alpha.5](https://github.com/visulima/visulima/compare/@visulima/path@3.0.0-alpha.4...@visulima/path@3.0.0-alpha.5) (2026-03-06) ([1389d96](https://github.com/visulima/visulima/commit/1389d96ce1fd14e4500f62b4526b43e9b03535a1))
* **release:** @visulima/path@3.0.0-alpha.6 [skip ci]\n\n## @visulima/path [3.0.0-alpha.6](https://github.com/visulima/visulima/compare/@visulima/path@3.0.0-alpha.5...@visulima/path@3.0.0-alpha.6) (2026-03-26) ([9dab82c](https://github.com/visulima/visulima/commit/9dab82ca432597433fc62f56e9ebdfc6e17e7eb2))
* **release:** @visulima/path@3.0.0-alpha.7 [skip ci]\n\n## @visulima/path [3.0.0-alpha.7](https://github.com/visulima/visulima/compare/@visulima/path@3.0.0-alpha.6...@visulima/path@3.0.0-alpha.7) (2026-03-26) ([2846780](https://github.com/visulima/visulima/commit/2846780d1a3325b7a9094adf1ea8ba0d57343088))
* **release:** @visulima/path@3.0.0-alpha.8 [skip ci]\n\n## @visulima/path [3.0.0-alpha.8](https://github.com/visulima/visulima/compare/@visulima/path@3.0.0-alpha.7...@visulima/path@3.0.0-alpha.8) (2026-04-08) ([18d5b6a](https://github.com/visulima/visulima/commit/18d5b6a412bfaa0e2274925be1b0e63ca5e8706f))
* **release:** @visulima/path@3.0.0-alpha.9 [skip ci]\n\n## @visulima/path [3.0.0-alpha.9](https://github.com/visulima/visulima/compare/@visulima/path@3.0.0-alpha.8...@visulima/path@3.0.0-alpha.9) (2026-04-15) ([f70ddc7](https://github.com/visulima/visulima/commit/f70ddc7139924620c21a711edfb55f471368ef03))
* **repo:** sort package.json keys across all packages ([e1fd9ab](https://github.com/visulima/visulima/commit/e1fd9ab467ef96a98c777da1572ff6a50fcf7e71))
* simplify pnpm-workspace packages list ([7cab221](https://github.com/visulima/visulima/commit/7cab221163632d9b7aa044a6f88c49083103a869))
* sorted package.json ([b47c545](https://github.com/visulima/visulima/commit/b47c545591600fdab17d5cd3a3fbc68b61e199da))
* update @anolilab/semantic-release-pnpm and @anolilab/semantic-release-preset to versions 3.2.2 and 12.1.2 across multiple package.json files for improved compatibility ([3921626](https://github.com/visulima/visulima/commit/3921626141fe5da398749bf0ba675f1596f18afb))
* update dependencies across multiple packages to improve compatibility and performance, including upgrading `@anolilab/semantic-release-pnpm` and `@anolilab/semantic-release-preset` to versions 3.2.0 and 12.1.0 respectively, and updating `react`, `react-dom`, and `next` versions to 19.2.1 and 16.0.7 in various package.json files ([aee8fcd](https://github.com/visulima/visulima/commit/aee8fcd796ae9b8d055903260e7150996ea9f53d))
* update lock file maintenance ([d83e716](https://github.com/visulima/visulima/commit/d83e71697b75d24704185b66bb521a934d2db02d))
* visulima website ([#591](https://github.com/visulima/visulima/issues/591)) ([59ab2e2](https://github.com/visulima/visulima/commit/59ab2e2befb03e51cd2088956f83d9b87de6d033))
* year update ([47f4105](https://github.com/visulima/visulima/commit/47f410596ce7190cfea36a073db32e0cec50bbcd))

### Code Refactoring

* replace inline import() types with top-level imports ([4569a4c](https://github.com/visulima/visulima/commit/4569a4ca04723da069f985855dcfab292f7347e1))

### Tests

* **path:** cover barrel exports, cwd/delimiter fallbacks, and isWindows branches ([6a95447](https://github.com/visulima/visulima/commit/6a9544758ea74bc67e84f596365964406f55f536))
* **repo:** add dist runtime + types integration tests ([32ee300](https://github.com/visulima/visulima/commit/32ee300b7184117a0ddf9f9d390f75f8932d5ed9))

### Build System

* regenerate bundled-license manifests and types ordering ([af26588](https://github.com/visulima/visulima/commit/af26588d75aaa937fd4862800560bd4070a4878c))

### Continuous Integration

* **fallow:** make fallow:health advisory (--report-only) ([d57148e](https://github.com/visulima/visulima/commit/d57148ea0e3556b4c24d8d336b9fa14987f5dc7d))

## @visulima/path [3.0.0-alpha.13](https://github.com/visulima/visulima/compare/@visulima/path@3.0.0-alpha.12...@visulima/path@3.0.0-alpha.13) (2026-06-13)

### Bug Fixes

* **path:** fix basename ext, linearize relative ([6e3d160](https://github.com/visulima/visulima/commit/6e3d1608cb1927f98c78bdfcacf05c0124ccfe33))
* **path:** stop format leaking "undefined" and align delimiter to posix ([d37eb39](https://github.com/visulima/visulima/commit/d37eb3986f284f05f873009e035c2e6c8bccfff1))

### Build System

* regenerate bundled-license manifests and types ordering ([af26588](https://github.com/visulima/visulima/commit/af26588d75aaa937fd4862800560bd4070a4878c))

## @visulima/path [3.0.0-alpha.12](https://github.com/visulima/visulima/compare/@visulima/path@3.0.0-alpha.11...@visulima/path@3.0.0-alpha.12) (2026-06-04)

### Bug Fixes

* **path:** widen filename() return type to string | undefined ([f88109b](https://github.com/visulima/visulima/commit/f88109bfaf4d7f0e6fdebb3080cf0fd389aa4dcb))

### Miscellaneous Chores

* apply eslint + prettier autofixes across packages ([c1bb784](https://github.com/visulima/visulima/commit/c1bb7848a0d93d0dfe2960c77e3cda22239c79a0))

### Tests

* **path:** cover barrel exports, cwd/delimiter fallbacks, and isWindows branches ([6a95447](https://github.com/visulima/visulima/commit/6a9544758ea74bc67e84f596365964406f55f536))

## @visulima/path [3.0.0-alpha.11](https://github.com/visulima/visulima/compare/@visulima/path@3.0.0-alpha.10...@visulima/path@3.0.0-alpha.11) (2026-05-27)

### Bug Fixes

* **storage-client:** percent-encode user fields in defaultFingerprint ([7c78a0f](https://github.com/visulima/visulima/commit/7c78a0f9512e2a673b941d80839e9f1e86b7b5d0))

### Miscellaneous Chores

* **ci-stability:** green CI across vis, native, lint, tests, attw ([#651](https://github.com/visulima/visulima/issues/651)) ([d4eb684](https://github.com/visulima/visulima/commit/d4eb684b5f75c818c9251048c605a0ed54a268e3))
* **path:** clear lint warnings ([78132f0](https://github.com/visulima/visulima/commit/78132f056527960d3656bab418600961b384ad03))
* **path:** housekeeping cleanup ([0547959](https://github.com/visulima/visulima/commit/0547959fca0a257e1c97afea7dda5503bcce51fa))
* **path:** upgrade packem to 2.0.0-alpha.76 ([78dafcd](https://github.com/visulima/visulima/commit/78dafcd1ddab44d25298ebe13d235dedbc4f9829))
* re-sort workspace package.json files via vis sort-package-json ([f625696](https://github.com/visulima/visulima/commit/f625696cfac974325774b3243e1a83c3d23acbd7))
* **repo:** sort package.json keys across all packages ([e1fd9ab](https://github.com/visulima/visulima/commit/e1fd9ab467ef96a98c777da1572ff6a50fcf7e71))
* simplify pnpm-workspace packages list ([7cab221](https://github.com/visulima/visulima/commit/7cab221163632d9b7aa044a6f88c49083103a869))
* sorted package.json ([b47c545](https://github.com/visulima/visulima/commit/b47c545591600fdab17d5cd3a3fbc68b61e199da))

### Tests

* **repo:** add dist runtime + types integration tests ([32ee300](https://github.com/visulima/visulima/commit/32ee300b7184117a0ddf9f9d390f75f8932d5ed9))

## @visulima/path [3.0.0-alpha.10](https://github.com/visulima/visulima/compare/@visulima/path@3.0.0-alpha.9...@visulima/path@3.0.0-alpha.10) (2026-04-22)

### Bug Fixes

* Remove JSR configuration generation script and generated jsr.json files ([#616](https://github.com/visulima/visulima/issues/616)) ([533744b](https://github.com/visulima/visulima/commit/533744b103b74896941db5b727173e617a27a63b))

### Miscellaneous Chores

* bump engines.node to ^22.14.0 || >=24.10.0 ([c3d0931](https://github.com/visulima/visulima/commit/c3d0931d1504e4f21ebf50ea680cfa7ce4ba15ce))
* fixed jsr.json ([5d85e51](https://github.com/visulima/visulima/commit/5d85e5179de38e284ec433b14d77c71a1619c8d6))
* **path:** apply pending changes ([aa09bf2](https://github.com/visulima/visulima/commit/aa09bf22dc279a0cd780c40ddbb7ed13a1d66791))
* **path:** apply pending lint and source updates ([66822e8](https://github.com/visulima/visulima/commit/66822e83c73ea793200bd298cf7cfd191fc53927))

### Code Refactoring

* replace inline import() types with top-level imports ([4569a4c](https://github.com/visulima/visulima/commit/4569a4ca04723da069f985855dcfab292f7347e1))

## @visulima/path [3.0.0-alpha.9](https://github.com/visulima/visulima/compare/@visulima/path@3.0.0-alpha.8...@visulima/path@3.0.0-alpha.9) (2026-04-15)

### Bug Fixes

* **filesystem:** resolve eslint issues in fs, path, and find-cache-dir ([59ad5e3](https://github.com/visulima/visulima/commit/59ad5e3051e92365eb8b1fdd73d4f4fd1f4bb547))
* **path:** cast path module to Path type via unknown ([03954b4](https://github.com/visulima/visulima/commit/03954b4ae624724dc20ffde1f88cabe0e898e69d))
* **path:** resolve eslint and formatting issues ([cf04504](https://github.com/visulima/visulima/commit/cf0450412b448bf2c1a6ed19637510555028a80e))

## @visulima/path [3.0.0-alpha.8](https://github.com/visulima/visulima/compare/@visulima/path@3.0.0-alpha.7...@visulima/path@3.0.0-alpha.8) (2026-04-08)

### Bug Fixes

* **path:** resolve eslint errors ([51d88af](https://github.com/visulima/visulima/commit/51d88af7203408e9959cbcdadce0ffafe23074b4))

### Miscellaneous Chores

* apply linting and formatting fixes across packages ([5d150a5](https://github.com/visulima/visulima/commit/5d150a578f9ce861c791843c683deeb849b774a9))
* **filesystem:** remove empty dependency objects from package.json ([76ffc54](https://github.com/visulima/visulima/commit/76ffc545660695dde19130d1c01d9bd1aaf2ca98))
* **path:** add tsconfig.eslint.json for type-aware linting ([07195c0](https://github.com/visulima/visulima/commit/07195c08d7ce008a785ba819e77ce03e39b205e8))
* **path:** apply auto-fix formatting ([c81f1fa](https://github.com/visulima/visulima/commit/c81f1fadd66186b44a99b8e1a93d7776b55773f0))
* **path:** apply prettier formatting ([5938bf0](https://github.com/visulima/visulima/commit/5938bf0e16e92d419d141e9724214307be7bc5e7))
* **path:** migrate .prettierrc.cjs to prettier.config.js ([51caf05](https://github.com/visulima/visulima/commit/51caf05c0cf3a08f7e0233c8cdd0410b8cde1a85))

## @visulima/path [3.0.0-alpha.7](https://github.com/visulima/visulima/compare/@visulima/path@3.0.0-alpha.6...@visulima/path@3.0.0-alpha.7) (2026-03-26)

### Features

* **web:** auto-generate packages page from workspace metadata ([623e520](https://github.com/visulima/visulima/commit/623e5207693a7fe720f5f2f179593a3654c880e3))

## @visulima/path [3.0.0-alpha.6](https://github.com/visulima/visulima/compare/@visulima/path@3.0.0-alpha.5...@visulima/path@3.0.0-alpha.6) (2026-03-26)

### Bug Fixes

* **web:** improve build setup with incremental stats caching and prod install ([fe33e75](https://github.com/visulima/visulima/commit/fe33e75827586779b4b3a0c6d57b39f889ee6207))

### Miscellaneous Chores

* **path:** migrate deps to pnpm catalogs ([aced0d8](https://github.com/visulima/visulima/commit/aced0d88d37ff54859708e18d9ebe3f0af756c74))
* **path:** update dependencies ([f749b0c](https://github.com/visulima/visulima/commit/f749b0cdc4d9a1ba1ea4f25bfc3305c9368eea06))
* visulima website ([#591](https://github.com/visulima/visulima/issues/591)) ([59ab2e2](https://github.com/visulima/visulima/commit/59ab2e2befb03e51cd2088956f83d9b87de6d033))

## @visulima/path [3.0.0-alpha.5](https://github.com/visulima/visulima/compare/@visulima/path@3.0.0-alpha.4...@visulima/path@3.0.0-alpha.5) (2026-03-06)

### Bug Fixes

* **path:** update packem to 2.0.0-alpha.54 ([5962ac2](https://github.com/visulima/visulima/commit/5962ac23fc149e4b6c8032883a14b02b57e5e812))

### Documentation

* **object,redact,colorize,path,fs:** add comprehensive Fumadocs documentation ([19c3840](https://github.com/visulima/visulima/commit/19c384041db855e1c2de41ce2067458b39737565))

### Miscellaneous Chores

* **filesystem:** update dependencies ([d1a4591](https://github.com/visulima/visulima/commit/d1a45917ba9547a1d7f1b6f62d85ab99bc059dd4))
* **path:** update dependencies ([f181051](https://github.com/visulima/visulima/commit/f181051b127365af160e48af381f95fd6ff2d258))
* **path:** update dependencies ([c6a5899](https://github.com/visulima/visulima/commit/c6a5899f4fbf7fabf3d4bb9154e9db6c9eb33530))
* update lock file maintenance ([d83e716](https://github.com/visulima/visulima/commit/d83e71697b75d24704185b66bb521a934d2db02d))
* year update ([47f4105](https://github.com/visulima/visulima/commit/47f410596ce7190cfea36a073db32e0cec50bbcd))

## @visulima/path [3.0.0-alpha.4](https://github.com/visulima/visulima/compare/@visulima/path@3.0.0-alpha.3...@visulima/path@3.0.0-alpha.4) (2025-12-27)

### Bug Fixes

* **path:** update package files ([ec317d7](https://github.com/visulima/visulima/commit/ec317d77f3e54a320875130682c3db84f778448f))

### Miscellaneous Chores

* fixed project.json names and schema path ([964722f](https://github.com/visulima/visulima/commit/964722f691db205c7edb9aa6db29e849a647500b))

## @visulima/path [3.0.0-alpha.3](https://github.com/visulima/visulima/compare/@visulima/path@3.0.0-alpha.2...@visulima/path@3.0.0-alpha.3) (2025-12-11)

### Bug Fixes

* update package OG images across multiple packages ([f08e4dd](https://github.com/visulima/visulima/commit/f08e4dd2b105ccb29c8412020a9c2be36d6c1e9e))

## @visulima/path [3.0.0-alpha.2](https://github.com/visulima/visulima/compare/@visulima/path@3.0.0-alpha.1...@visulima/path@3.0.0-alpha.2) (2025-12-06)

### Bug Fixes

* add new package image, fixed readme rendering on npm, fixed building of packages ([b790ba2](https://github.com/visulima/visulima/commit/b790ba253ea07fef83528fd822a678facf021b5f))

### Miscellaneous Chores

* update @anolilab/semantic-release-pnpm and @anolilab/semantic-release-preset to versions 3.2.2 and 12.1.2 across multiple package.json files for improved compatibility ([3921626](https://github.com/visulima/visulima/commit/3921626141fe5da398749bf0ba675f1596f18afb))

## @visulima/path [3.0.0-alpha.1](https://github.com/visulima/visulima/compare/@visulima/path@2.0.5...@visulima/path@3.0.0-alpha.1) (2025-12-04)

### ⚠ BREAKING CHANGES

* change min node version to 22.13

### Bug Fixes

* update Node.js engine version requirement to >=22.13 in multiple package.json files for improved compatibility ([b828e9a](https://github.com/visulima/visulima/commit/b828e9aeaebfc798eecddccd90e6ec7560c6d36a))

### Miscellaneous Chores

* moved all packages into groups ([0615e9d](https://github.com/visulima/visulima/commit/0615e9d14a8a886e11da529ce150cf31ca973c10))
* update dependencies across multiple packages to improve compatibility and performance, including upgrading `@anolilab/semantic-release-pnpm` and `@anolilab/semantic-release-preset` to versions 3.2.0 and 12.1.0 respectively, and updating `react`, `react-dom`, and `next` versions to 19.2.1 and 16.0.7 in various package.json files ([aee8fcd](https://github.com/visulima/visulima/commit/aee8fcd796ae9b8d055903260e7150996ea9f53d))

## @visulima/path [2.0.5](https://github.com/visulima/visulima/compare/@visulima/path@2.0.4...@visulima/path@2.0.5) (2025-11-13)

### Bug Fixes

* bump packem, to fix minified version of the code ([2a36ceb](https://github.com/visulima/visulima/commit/2a36ceb09251b0ca1178701a26547a871ed717a7))

## @visulima/path [2.0.4](https://github.com/visulima/visulima/compare/@visulima/path@2.0.3...@visulima/path@2.0.4) (2025-11-12)

### Bug Fixes

* update package configurations and TypeScript definitions ([b59aa59](https://github.com/visulima/visulima/commit/b59aa59dac1508216b944f4b917fb4a7ab1f70a4))

### Miscellaneous Chores

* Add jsr file to all packages for release ([#565](https://github.com/visulima/visulima/issues/565)) ([ec91652](https://github.com/visulima/visulima/commit/ec91652b4e4112adf14ba152c1239a7703ba425a))
* update license files and clean up TypeScript definitions ([fe668cc](https://github.com/visulima/visulima/commit/fe668cc26de23591d4df54a0954455ebbe31b22d))

## @visulima/path [2.0.3](https://github.com/visulima/visulima/compare/@visulima/path@2.0.2...@visulima/path@2.0.3) (2025-11-07)

### Bug Fixes

* update TypeScript configurations and improve linting across multiple packages ([6f25ec7](https://github.com/visulima/visulima/commit/6f25ec7841da7246f8f9166efc5292a7089d37ee))

### Miscellaneous Chores

* update npm and pnpm configurations for monorepo optimization ([#564](https://github.com/visulima/visulima/issues/564)) ([5512b42](https://github.com/visulima/visulima/commit/5512b42f672c216b6a3c9e39035199a4ebd9a4b8))
* update package.json files and pnpm-lock.yaml ([95d9f5b](https://github.com/visulima/visulima/commit/95d9f5b607105d05a006deadb4379e89f06dfe99))

## @visulima/path [2.0.2](https://github.com/visulima/visulima/compare/@visulima/path@2.0.1...@visulima/path@2.0.2) (2025-11-05)

### Bug Fixes

* update dependencies across multiple packages ([36a47f2](https://github.com/visulima/visulima/commit/36a47f26d65d25a7b4d8371186710e7d0ab61a2b))

### Miscellaneous Chores

* update dependencies across multiple packages ([c526462](https://github.com/visulima/visulima/commit/c52646260c2ae8bbf85692e642f305f47a158d4e))
* update package dependencies and configurations ([7bfe7e7](https://github.com/visulima/visulima/commit/7bfe7e71869580900aab50efb064b4293994ed9a))

## @visulima/path [2.0.1](https://github.com/visulima/visulima/compare/@visulima/path@2.0.0...@visulima/path@2.0.1) (2025-10-21)

### Bug Fixes

* allow node v25 and updated dev deps ([8158cc5](https://github.com/visulima/visulima/commit/8158cc53ec92bd0331e8c6bd0fcbc8ab61b9320f))

### Miscellaneous Chores

* **deps:** update package versions and dependencies ([88d8d32](https://github.com/visulima/visulima/commit/88d8d32c4629a7a06c8770369191da2cc81087cc))
* update license years and add validation rules ([b97811e](https://github.com/visulima/visulima/commit/b97811ed2d253d908c0d86b4579a0a6bc33673a8))
* update package dependencies across multiple packages ([17e3f23](https://github.com/visulima/visulima/commit/17e3f2377c8a3f98e2eed2192c5adaf6e32558b5))

## @visulima/path [2.0.0](https://github.com/visulima/visulima/compare/@visulima/path@1.4.0...@visulima/path@2.0.0) (2025-10-15)

### ⚠ BREAKING CHANGES

* Adjusted the node engine requirement to support versions 20.19 and above

### Bug Fixes

* Adjusted the node engine requirement to support versions 20.19 and above ([ffeb2d4](https://github.com/visulima/visulima/commit/ffeb2d4ceff773f742c4f4f57b760588404e7434))
* allowed node 24 ([6397e2e](https://github.com/visulima/visulima/commit/6397e2e9a172a31d0983b0f34e9feabcc7bcf339))
* restore require exports in package.json for compatibility ([8b993fd](https://github.com/visulima/visulima/commit/8b993fd267cf4c02ef94420e520001076057c781))
* update @visulima/packem to 2.0.0-alpha.32 across multiple packages for improved compatibility ([27b346e](https://github.com/visulima/visulima/commit/27b346eaa1c0fb0e420d9a9824482028307f4249))

### Miscellaneous Chores

* **deps:** update build scripts and remove cross-env dependency ([7510e82](https://github.com/visulima/visulima/commit/7510e826b9235a0013fe61c82a7eb333bc4cbb78))
* remove unused helper test file to streamline codebase ([c096d97](https://github.com/visulima/visulima/commit/c096d97769814f9df16c1a39e41305ddb8358a3e))
* update package dependencies across multiple packages for improved compatibility and performance ([9567591](https://github.com/visulima/visulima/commit/9567591c415da3002f3a4fe08f8caf7ce01ca5f7))
* update package.json and pnpm-lock.yaml to include publint@0.3.12 and adjust build/test commands to exclude shared-utils ([1f7b3c0](https://github.com/visulima/visulima/commit/1f7b3c0381d77edfeec80ea1bf57b3469e929414))

## @visulima/path [1.4.0](https://github.com/visulima/visulima/compare/@visulima/path@1.3.6...@visulima/path@1.4.0) (2025-06-04)

### Features

* **path:** added isWindows helper function ([ba7ab7d](https://github.com/visulima/visulima/commit/ba7ab7dec78aec7ca08c221eba5b04e82a07bee5))

## @visulima/path [1.3.6](https://github.com/visulima/visulima/compare/@visulima/path@1.3.5...@visulima/path@1.3.6) (2025-05-30)

### Bug Fixes

* **path:** update dependencies ([d0e4c71](https://github.com/visulima/visulima/commit/d0e4c71ccfbc45701735a10e666c0af7860d0563))

### Miscellaneous Chores

* updated dev dependencies ([2433ed5](https://github.com/visulima/visulima/commit/2433ed5fb662e0303c37edee8ddc21b46c21263f))

## @visulima/path [1.3.5](https://github.com/visulima/visulima/compare/@visulima/path@1.3.4...@visulima/path@1.3.5) (2025-03-07)

### Bug Fixes

* updated @visulima/packem and other dev deps, for better bundling size ([e940581](https://github.com/visulima/visulima/commit/e9405812201594e54dd81d17ddb74177df5f3c24))

### Miscellaneous Chores

* fixed issue with pnpm audit, changed browser path ([67337cb](https://github.com/visulima/visulima/commit/67337cb0395442540e7701c4dc8a4fef8a3fe1a2))
* updated dev dependencies ([487a976](https://github.com/visulima/visulima/commit/487a976932dc7c39edfc19ffd3968960ff338066))

## @visulima/path [1.3.4](https://github.com/visulima/visulima/compare/@visulima/path@1.3.3...@visulima/path@1.3.4) (2025-01-25)

### Bug Fixes

* fixed wrong node version range in package.json ([4ae2929](https://github.com/visulima/visulima/commit/4ae292984681c71a770e4d4560432f7b7c5a141a))

### Miscellaneous Chores

* fixed typescript url ([fe65a8c](https://github.com/visulima/visulima/commit/fe65a8c0296ece7ee26474c70d065b06d4d0da89))
* lock file update, added dedupe lint command ([5ba7093](https://github.com/visulima/visulima/commit/5ba7093fefaca7ed2fce6b0cf6069a53c300456a))
* updated all dev dependencies ([37fb298](https://github.com/visulima/visulima/commit/37fb298b2af7c63be64252024e54bb3af6ddabec))
* updated all dev dependencies and all dependencies in the app folder ([87f4ccb](https://github.com/visulima/visulima/commit/87f4ccbf9f7900ec5b56f3c1477bc4a0ef571bcf))

## @visulima/path [1.3.3](https://github.com/visulima/visulima/compare/@visulima/path@1.3.2...@visulima/path@1.3.3) (2025-01-13)

### Bug Fixes

* **path:** fixed isRelative with ".." syntax ([67a63b5](https://github.com/visulima/visulima/commit/67a63b5c7044605b9a77b9f13cf6dc7ac37f376b))

## @visulima/path [1.3.2](https://github.com/visulima/visulima/compare/@visulima/path@1.3.1...@visulima/path@1.3.2) (2025-01-12)

### Bug Fixes

* updated @visulima/packem, and all other dev dependencies ([7797a1c](https://github.com/visulima/visulima/commit/7797a1c3e6f1fc532895247bd88285a8a9883c40))

## @visulima/path [1.3.1](https://github.com/visulima/visulima/compare/@visulima/path@1.3.0...@visulima/path@1.3.1) (2025-01-08)

### Bug Fixes

* **path:** switched minimatch to zeptomatch ([d10d466](https://github.com/visulima/visulima/commit/d10d4667094345693b554641522d1aeec86f2f56))

## @visulima/path [1.3.0](https://github.com/visulima/visulima/compare/@visulima/path@1.2.0...@visulima/path@1.3.0) (2025-01-08)

### Features

* **path:** preserve normalized unc paths in join ([316301d](https://github.com/visulima/visulima/commit/316301d1103f707953e7b4fc2df3d921d0120561))

## @visulima/path [1.2.0](https://github.com/visulima/visulima/compare/@visulima/path@1.1.2...@visulima/path@1.2.0) (2024-12-31)

### Features

* added matchesGlob export, added Path type, added posix and win32 exports ([2374dad](https://github.com/visulima/visulima/commit/2374dadf62026394df061c7bf8ce1e99ce0304c4))

### Miscellaneous Chores

* updated dev dependencies ([9de2eab](https://github.com/visulima/visulima/commit/9de2eab91e95c8b9289d12f863a5167218770650))

## @visulima/path [1.1.2](https://github.com/visulima/visulima/compare/@visulima/path@1.1.1...@visulima/path@1.1.2) (2024-12-12)

### Bug Fixes

* allow node v23 ([8ca929a](https://github.com/visulima/visulima/commit/8ca929af311ce8036cbbfde68b6db05381b860a5))
* allowed node 23, updated dev dependencies ([f99d34e](https://github.com/visulima/visulima/commit/f99d34e01f6b13be8586a1b5d37dc8b8df0a5817))
* updated packem to v1.8.2 ([23f869b](https://github.com/visulima/visulima/commit/23f869b4120856cc97e2bffa6d508e2ae30420ea))
* updated packem to v1.9.2 ([47bdc2d](https://github.com/visulima/visulima/commit/47bdc2dfaeca4e7014dbe7772eae2fdf8c8b35bb))

### Styles

* cs fixes ([46d31e0](https://github.com/visulima/visulima/commit/46d31e082e1865262bf380859c14fabd28ff456d))

### Miscellaneous Chores

* updated dev dependencies ([a916944](https://github.com/visulima/visulima/commit/a916944b888bb34c34b0c54328b38d29e4399857))

## @visulima/path [1.1.1](https://github.com/visulima/visulima/compare/@visulima/path@1.1.0...@visulima/path@1.1.1) (2024-10-05)

### Bug Fixes

* **path:** fixing wrong export of isAbsolute on utils ([92148a8](https://github.com/visulima/visulima/commit/92148a8dd7c986536aefdbc3d316d16f32239e57))

## @visulima/path [1.1.0](https://github.com/visulima/visulima/compare/@visulima/path@1.0.9...@visulima/path@1.1.0) (2024-10-05)

### Features

* **path:** added isAbsolute util ([57dac59](https://github.com/visulima/visulima/commit/57dac5933b454782eb61683bb60cc7fe9a7a1b62))

### Bug Fixes

* updated dev dependencies, updated packem to v1.0.7, fixed naming of some lint config files ([c071a9c](https://github.com/visulima/visulima/commit/c071a9c8e129014a962ff654a16f302ca18a5c67))

## @visulima/path [1.0.9](https://github.com/visulima/visulima/compare/@visulima/path@1.0.8...@visulima/path@1.0.9) (2024-09-24)

### Bug Fixes

* update packem to v1 ([05f3bc9](https://github.com/visulima/visulima/commit/05f3bc960df10a1602e24f9066e2b0117951a877))
* updated esbuild from v0.23 to v0.24 ([3793010](https://github.com/visulima/visulima/commit/3793010d0d549c0d41f85dea04b8436251be5fe8))

### Miscellaneous Chores

* updated dev dependencies ([05edb67](https://github.com/visulima/visulima/commit/05edb671285b1cc42875223314b24212e6a12588))

## @visulima/path [1.0.8](https://github.com/visulima/visulima/compare/@visulima/path@1.0.7...@visulima/path@1.0.8) (2024-09-11)

### Bug Fixes

* fixed node10 support ([f5e78d9](https://github.com/visulima/visulima/commit/f5e78d9bff8fd603967666598b34f9338a8726b5))

### Miscellaneous Chores

* updated dev dependencies ([28b5ee5](https://github.com/visulima/visulima/commit/28b5ee5c805ca8868536418829cde7ba8c5bb8dd))

## @visulima/path [1.0.7](https://github.com/visulima/visulima/compare/@visulima/path@1.0.6...@visulima/path@1.0.7) (2024-09-07)

### Bug Fixes

* fixed broken chunk splitting from packem ([1aaf277](https://github.com/visulima/visulima/commit/1aaf27779292d637923c5f8a220e18606e78caa2))

## @visulima/path [1.0.6](https://github.com/visulima/visulima/compare/@visulima/path@1.0.5...@visulima/path@1.0.6) (2024-09-07)

### Bug Fixes

* added types support for node10 ([604583f](https://github.com/visulima/visulima/commit/604583fa3c24b950fafad45d17e7a1333040fd76))

### Styles

* cs fixes ([f5c4af7](https://github.com/visulima/visulima/commit/f5c4af7cfa9fc79b6d3fa60c1e48d88bffab5a08))

### Miscellaneous Chores

* update dev dependencies ([0738f98](https://github.com/visulima/visulima/commit/0738f9810478bb215ce4b2571dc8874c4c503089))

## @visulima/path [1.0.5](https://github.com/visulima/visulima/compare/@visulima/path@1.0.4...@visulima/path@1.0.5) (2024-08-30)

### Bug Fixes

* updated license content ([63e34b3](https://github.com/visulima/visulima/commit/63e34b3a173d0b05b4eea97f85d37f08559559dd))

### Miscellaneous Chores

* updated dev dependencies ([45c2a76](https://github.com/visulima/visulima/commit/45c2a76bc974ecb2c6b172c3af03373d4cc6a5ce))

## @visulima/path [1.0.4](https://github.com/visulima/visulima/compare/@visulima/path@1.0.3...@visulima/path@1.0.4) (2024-08-04)

### Bug Fixes

* **path:** fixed delimiter return based on the platform ([967f221](https://github.com/visulima/visulima/commit/967f221b4cea689ab32e5f42fec37db5d413b61b))

## @visulima/path [1.0.3](https://github.com/visulima/visulima/compare/@visulima/path@1.0.2...@visulima/path@1.0.3) (2024-08-01)

### Bug Fixes

* **path:** switched to packem from tsup ([0bd94e5](https://github.com/visulima/visulima/commit/0bd94e5a977497864132f63678c5e09e059a46dc))

### Styles

* cs fixes ([ee5ed6f](https://github.com/visulima/visulima/commit/ee5ed6f31bdabcfacdb0d1abd1eff2cc6207cefc))

### Miscellaneous Chores

* added private true into fixture package.json files ([4a9494c](https://github.com/visulima/visulima/commit/4a9494c642fa98f224505a1d231b5af4e73d6c79))
* changed typescript version back to 5.4.5 ([55d28bb](https://github.com/visulima/visulima/commit/55d28bbdc103718d19f844034b38a0e8e5af798a))
* cs fixes ([ab59375](https://github.com/visulima/visulima/commit/ab59375452fa289aed240bfd0b54b76d0c6ee2b4))
* updated all dev deps ([ef143ce](https://github.com/visulima/visulima/commit/ef143ce2e15952a0910aa5c8bd78d25de9ebd7f3))
* updated dev dependencies ([ac67ec1](https://github.com/visulima/visulima/commit/ac67ec1bcba16175d225958e318199f60b10d179))
* updated dev dependencies ([34df456](https://github.com/visulima/visulima/commit/34df4569f2fc074823a406c44a131c8fbae2b147))
* updated dev dependencies and sorted the package.json ([9571572](https://github.com/visulima/visulima/commit/95715725a8ed053ca24fd1405a55205c79342ecb))

### Build System

* fixed found audit error, updated all dev package deps, updated deps in apps and examples ([4c51950](https://github.com/visulima/visulima/commit/4c519500dc5504579d35725572920658999885cb))

## @visulima/path [1.0.2](https://github.com/visulima/visulima/compare/@visulima/path@1.0.1...@visulima/path@1.0.2) (2024-06-06)


### Bug Fixes

* allow node v22 ([890d457](https://github.com/visulima/visulima/commit/890d4570f18428e2463944813c0c638b3f142803))


### Miscellaneous Chores

* updated dev dependencies ([a2e0504](https://github.com/visulima/visulima/commit/a2e0504dc239049434c2482756ff15bdbaac9b54))

## @visulima/path [1.0.1](https://github.com/visulima/visulima/compare/@visulima/path@1.0.0...@visulima/path@1.0.1) (2024-05-24)


### Bug Fixes

* changed pathe to @visulima/path ([#410](https://github.com/visulima/visulima/issues/410)) ([bfe1287](https://github.com/visulima/visulima/commit/bfe1287aff6d28d5dca302fd4d58c1f6234ce0bb))


### Styles

* cs fixes ([ed993a1](https://github.com/visulima/visulima/commit/ed993a1a3b4c963c3c8e3400278b4dbca5993e13))


### Miscellaneous Chores

* changed semantic-release-npm to pnpm ([b6d100a](https://github.com/visulima/visulima/commit/b6d100a2bf3fd026577be48726a37754947f0973))
* fixed wrong named folders to integration, added TEST_PROD_BUILD ([1b826f5](https://github.com/visulima/visulima/commit/1b826f5baf8285847199de9ede8fbdbadf201ad6))

## @visulima/path 1.0.0 (2024-05-14)


### Features

* **path:** new path component ([#409](https://github.com/visulima/visulima/issues/409)) ([e3fe6be](https://github.com/visulima/visulima/commit/e3fe6be7c79a791d028666a570199e6df1936482))
