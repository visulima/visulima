## @visulima/bytes [3.0.0-alpha.11](https://github.com/visulima/visulima/compare/@visulima/bytes@3.0.0-alpha.10...@visulima/bytes@3.0.0-alpha.11) (2026-05-27)

### Bug Fixes

* **storage-client:** percent-encode user fields in defaultFingerprint ([7c78a0f](https://github.com/visulima/visulima/commit/7c78a0f9512e2a673b941d80839e9f1e86b7b5d0))

### Miscellaneous Chores

* **bytes:** housekeeping cleanup ([4ad5c1c](https://github.com/visulima/visulima/commit/4ad5c1ced5bba1b0f176d2d3f8a37cf2942308a7))
* **bytes:** post-hook formatter cleanup ([6c431fa](https://github.com/visulima/visulima/commit/6c431fa2cf50c923a6df2bec549951fa71b73579))
* **bytes:** upgrade packem to 2.0.0-alpha.76 ([844c33e](https://github.com/visulima/visulima/commit/844c33e7ec97c4db91d67f33564dddea4d4d1e6c))
* **ci-stability:** green CI across vis, native, lint, tests, attw ([#651](https://github.com/visulima/visulima/issues/651)) ([d4eb684](https://github.com/visulima/visulima/commit/d4eb684b5f75c818c9251048c605a0ed54a268e3))
* re-sort workspace package.json files via vis sort-package-json ([f625696](https://github.com/visulima/visulima/commit/f625696cfac974325774b3243e1a83c3d23acbd7))
* **repo:** sort package.json keys across all packages ([e1fd9ab](https://github.com/visulima/visulima/commit/e1fd9ab467ef96a98c777da1572ff6a50fcf7e71))
* sorted package.json ([b47c545](https://github.com/visulima/visulima/commit/b47c545591600fdab17d5cd3a3fbc68b61e199da))

### Tests

* **repo:** add dist runtime + types integration tests ([32ee300](https://github.com/visulima/visulima/commit/32ee300b7184117a0ddf9f9d390f75f8932d5ed9))

## @visulima/bytes [3.0.0-alpha.10](https://github.com/visulima/visulima/compare/@visulima/bytes@3.0.0-alpha.9...@visulima/bytes@3.0.0-alpha.10) (2026-04-22)

### Bug Fixes

* Remove JSR configuration generation script and generated jsr.json files ([#616](https://github.com/visulima/visulima/issues/616)) ([533744b](https://github.com/visulima/visulima/commit/533744b103b74896941db5b727173e617a27a63b))

### Miscellaneous Chores

* bump engines.node to ^22.14.0 || >=24.10.0 ([c3d0931](https://github.com/visulima/visulima/commit/c3d0931d1504e4f21ebf50ea680cfa7ce4ba15ce))
* **bytes:** apply pending changes ([6dd9d3d](https://github.com/visulima/visulima/commit/6dd9d3d625daca8973b453a37de7b428f933c70b))
* **bytes:** apply pending lint and source updates ([4d74f0f](https://github.com/visulima/visulima/commit/4d74f0f1e0ed5cfd74e973f9ba5dc6492cd94f5e))
* fixed jsr.json ([5d85e51](https://github.com/visulima/visulima/commit/5d85e5179de38e284ec433b14d77c71a1619c8d6))

## @visulima/bytes [3.0.0-alpha.9](https://github.com/visulima/visulima/compare/@visulima/bytes@3.0.0-alpha.8...@visulima/bytes@3.0.0-alpha.9) (2026-04-15)

### Bug Fixes

* **bytes:** resolve eslint and formatting issues ([26422b2](https://github.com/visulima/visulima/commit/26422b27e876c64bb37183b24c69fc9f8591716f))
* **data-manipulation:** resolve eslint and formatting issues ([3687b65](https://github.com/visulima/visulima/commit/3687b65d804abe316fad8c3a02ec659bf303332e))
* **data-manipulation:** resolve eslint and type-safety issues ([f1682c2](https://github.com/visulima/visulima/commit/f1682c2611cbcc6c85d4bbea520d43464b42e7ee))

## @visulima/bytes [3.0.0-alpha.8](https://github.com/visulima/visulima/compare/@visulima/bytes@3.0.0-alpha.7...@visulima/bytes@3.0.0-alpha.8) (2026-04-08)

### Bug Fixes

* **bytes:** add eslint-disable for runtime Buffer availability checks ([c579fd4](https://github.com/visulima/visulima/commit/c579fd4be50eaa152e82ab54a698d47dda9997c6))

### Miscellaneous Chores

* **bytes:** add tsconfig.eslint.json for type-aware linting ([b000842](https://github.com/visulima/visulima/commit/b000842b06c549d9336dbb95cd9dd2ed56749a00))
* **bytes:** apply auto-fix formatting ([b007819](https://github.com/visulima/visulima/commit/b007819d9e4a4bb08cb802b16a0f6cc330fb1102))
* **bytes:** apply prettier formatting ([9d2226c](https://github.com/visulima/visulima/commit/9d2226c2b7ec9b4631444f956ff047cfa1b32526))
* **bytes:** expand inline if-return to block syntax ([4388518](https://github.com/visulima/visulima/commit/43885187afac28f0de8b56f42c5a601f095bcc3b))
* **bytes:** expand inline if-return to block syntax ([5b313f2](https://github.com/visulima/visulima/commit/5b313f240f3161893100dcc35858ebd1630d7765))
* **bytes:** migrate .prettierrc.cjs to prettier.config.js ([ddc08da](https://github.com/visulima/visulima/commit/ddc08da039cb51a296147514d5683b5340051a98))
* **data-manipulation:** remove empty dependency objects from package.json ([c0e8f76](https://github.com/visulima/visulima/commit/c0e8f7689a2da413f771494f6ecb07babc4b5e06))

## @visulima/bytes [3.0.0-alpha.7](https://github.com/visulima/visulima/compare/@visulima/bytes@3.0.0-alpha.6...@visulima/bytes@3.0.0-alpha.7) (2026-03-26)

### Features

* **web:** auto-generate packages page from workspace metadata ([623e520](https://github.com/visulima/visulima/commit/623e5207693a7fe720f5f2f179593a3654c880e3))

## @visulima/bytes [3.0.0-alpha.6](https://github.com/visulima/visulima/compare/@visulima/bytes@3.0.0-alpha.5...@visulima/bytes@3.0.0-alpha.6) (2026-03-26)

### Bug Fixes

* move JSR dependencies from catalog to package.json ([579468b](https://github.com/visulima/visulima/commit/579468bc7c1e0980b8dae413fa44cf56b9073b6f))
* **web:** improve build setup with incremental stats caching and prod install ([fe33e75](https://github.com/visulima/visulima/commit/fe33e75827586779b4b3a0c6d57b39f889ee6207))

### Miscellaneous Chores

* **bytes:** migrate deps to pnpm catalogs ([1eeed04](https://github.com/visulima/visulima/commit/1eeed04471f41e15943a6d17a301f060da1adaf0))
* **bytes:** update dependencies ([9cab689](https://github.com/visulima/visulima/commit/9cab689e5b93267cd4c23dc07e9e107a9524b41e))
* visulima website ([#591](https://github.com/visulima/visulima/issues/591)) ([59ab2e2](https://github.com/visulima/visulima/commit/59ab2e2befb03e51cd2088956f83d9b87de6d033))

### Code Refactoring

* **docs:** migrate Nextra components to fumadocs-ui, remove Nextra stripping ([484878f](https://github.com/visulima/visulima/commit/484878f01879363ef5e9a0282904dc4627d6060c))

## @visulima/bytes [3.0.0-alpha.5](https://github.com/visulima/visulima/compare/@visulima/bytes@3.0.0-alpha.4...@visulima/bytes@3.0.0-alpha.5) (2026-03-06)

### Bug Fixes

* **bytes:** update packem to 2.0.0-alpha.54 ([8776983](https://github.com/visulima/visulima/commit/87769832884658689f67288457c8b0a8664fde08))

### Documentation

* **bytes,deep-clone,ansi,fmt,find-cache-dir:** add comprehensive Fumadocs documentation ([dfe0116](https://github.com/visulima/visulima/commit/dfe0116ebd26fe38f94f77b8ed4dadc3ff45ba91))

### Miscellaneous Chores

* **bytes:** update dependencies ([9d38aaf](https://github.com/visulima/visulima/commit/9d38aaf38e38d37e9e67d4134b3a22a49a274686))
* **bytes:** update dependencies ([82fadc4](https://github.com/visulima/visulima/commit/82fadc4d001ff898f97abc6a7165983432ec8991))
* **data-manipulation:** update dependencies ([49458ab](https://github.com/visulima/visulima/commit/49458ab8f8e17d875840b1b4fe8b5efe12ff3513))
* update lock file maintenance ([d83e716](https://github.com/visulima/visulima/commit/d83e71697b75d24704185b66bb521a934d2db02d))
* year update ([47f4105](https://github.com/visulima/visulima/commit/47f410596ce7190cfea36a073db32e0cec50bbcd))

## @visulima/bytes [3.0.0-alpha.4](https://github.com/visulima/visulima/compare/@visulima/bytes@3.0.0-alpha.3...@visulima/bytes@3.0.0-alpha.4) (2025-12-27)

### Bug Fixes

* **bytes:** update package files ([546cc78](https://github.com/visulima/visulima/commit/546cc780cc19968962d633e2a38fe5c6fa58b497))

### Miscellaneous Chores

* fixed project.json names and schema path ([964722f](https://github.com/visulima/visulima/commit/964722f691db205c7edb9aa6db29e849a647500b))

## @visulima/bytes [3.0.0-alpha.3](https://github.com/visulima/visulima/compare/@visulima/bytes@3.0.0-alpha.2...@visulima/bytes@3.0.0-alpha.3) (2025-12-11)

### Bug Fixes

* update package OG images across multiple packages ([f08e4dd](https://github.com/visulima/visulima/commit/f08e4dd2b105ccb29c8412020a9c2be36d6c1e9e))

## @visulima/bytes [3.0.0-alpha.2](https://github.com/visulima/visulima/compare/@visulima/bytes@3.0.0-alpha.1...@visulima/bytes@3.0.0-alpha.2) (2025-12-06)

### Bug Fixes

* add new package image, fixed readme rendering on npm, fixed building of packages ([b790ba2](https://github.com/visulima/visulima/commit/b790ba253ea07fef83528fd822a678facf021b5f))
* update package.json description and keywords ([#578](https://github.com/visulima/visulima/issues/578)) ([154709c](https://github.com/visulima/visulima/commit/154709c05e71d1ffd3e360b27e12febd817912f0))

### Miscellaneous Chores

* **release:** @visulima/bytes@3.0.0-alpha.1 [skip ci]\n\n## @visulima/bytes [3.0.0-alpha.1](https://github.com/visulima/visulima/compare/@visulima/bytes@2.0.5...@visulima/bytes@3.0.0-alpha.1) (2025-12-04) ([232ad90](https://github.com/visulima/visulima/commit/232ad9054f90459296f3988a2bbb6bd0e7e9d722))
* update @anolilab/semantic-release-pnpm and @anolilab/semantic-release-preset to versions 3.2.2 and 12.1.2 across multiple package.json files for improved compatibility ([3921626](https://github.com/visulima/visulima/commit/3921626141fe5da398749bf0ba675f1596f18afb))

## @visulima/bytes [3.0.0-alpha.1](https://github.com/visulima/visulima/compare/@visulima/bytes@2.0.5...@visulima/bytes@3.0.0-alpha.1) (2025-12-04)

### ⚠ BREAKING CHANGES

* change min node version to 22.13

### Bug Fixes

* update Node.js engine version requirement to >=22.13 in multiple package.json files for improved compatibility ([b828e9a](https://github.com/visulima/visulima/commit/b828e9aeaebfc798eecddccd90e6ec7560c6d36a))

### Miscellaneous Chores

* moved all packages into groups ([0615e9d](https://github.com/visulima/visulima/commit/0615e9d14a8a886e11da529ce150cf31ca973c10))
* **release:** @visulima/bytes@3.0.0-alpha.1 [skip ci]\n\n## @visulima/bytes [3.0.0-alpha.1](https://github.com/visulima/visulima/compare/@visulima/bytes@2.0.5...@visulima/bytes@3.0.0-alpha.1) (2025-12-04) ([302f285](https://github.com/visulima/visulima/commit/302f285520f09b1c2864e3151e08e2b4b7903b51))
* update dependencies across multiple packages to improve compatibility and performance, including upgrading `@anolilab/semantic-release-pnpm` and `@anolilab/semantic-release-preset` to versions 3.2.0 and 12.1.0 respectively, and updating `react`, `react-dom`, and `next` versions to 19.2.1 and 16.0.7 in various package.json files ([aee8fcd](https://github.com/visulima/visulima/commit/aee8fcd796ae9b8d055903260e7150996ea9f53d))

## @visulima/bytes [3.0.0-alpha.1](https://github.com/visulima/visulima/compare/@visulima/bytes@2.0.5...@visulima/bytes@3.0.0-alpha.1) (2025-12-04)

### ⚠ BREAKING CHANGES

* change min node version to 22.13

### Bug Fixes

* update Node.js engine version requirement to >=22.13 in multiple package.json files for improved compatibility ([b828e9a](https://github.com/visulima/visulima/commit/b828e9aeaebfc798eecddccd90e6ec7560c6d36a))

### Miscellaneous Chores

* moved all packages into groups ([0615e9d](https://github.com/visulima/visulima/commit/0615e9d14a8a886e11da529ce150cf31ca973c10))
* update dependencies across multiple packages to improve compatibility and performance, including upgrading `@anolilab/semantic-release-pnpm` and `@anolilab/semantic-release-preset` to versions 3.2.0 and 12.1.0 respectively, and updating `react`, `react-dom`, and `next` versions to 19.2.1 and 16.0.7 in various package.json files ([aee8fcd](https://github.com/visulima/visulima/commit/aee8fcd796ae9b8d055903260e7150996ea9f53d))

## @visulima/bytes [2.0.5](https://github.com/visulima/visulima/compare/@visulima/bytes@2.0.4...@visulima/bytes@2.0.5) (2025-11-13)

### Bug Fixes

* bump packem, to fix minified version of the code ([2a36ceb](https://github.com/visulima/visulima/commit/2a36ceb09251b0ca1178701a26547a871ed717a7))

## @visulima/bytes [2.0.4](https://github.com/visulima/visulima/compare/@visulima/bytes@2.0.3...@visulima/bytes@2.0.4) (2025-11-12)

### Bug Fixes

* update package configurations and TypeScript definitions ([b59aa59](https://github.com/visulima/visulima/commit/b59aa59dac1508216b944f4b917fb4a7ab1f70a4))

### Miscellaneous Chores

* Add jsr file to all packages for release ([#565](https://github.com/visulima/visulima/issues/565)) ([ec91652](https://github.com/visulima/visulima/commit/ec91652b4e4112adf14ba152c1239a7703ba425a))
* update license files and clean up TypeScript definitions ([fe668cc](https://github.com/visulima/visulima/commit/fe668cc26de23591d4df54a0954455ebbe31b22d))

## @visulima/bytes [2.0.3](https://github.com/visulima/visulima/compare/@visulima/bytes@2.0.2...@visulima/bytes@2.0.3) (2025-11-07)

### Bug Fixes

* update TypeScript configurations and improve linting across multiple packages ([6f25ec7](https://github.com/visulima/visulima/commit/6f25ec7841da7246f8f9166efc5292a7089d37ee))

## @visulima/bytes [2.0.2](https://github.com/visulima/visulima/compare/@visulima/bytes@2.0.1...@visulima/bytes@2.0.2) (2025-11-05)

### Bug Fixes

* update dependencies across multiple packages ([36a47f2](https://github.com/visulima/visulima/commit/36a47f26d65d25a7b4d8371186710e7d0ab61a2b))

### Miscellaneous Chores

* update dependencies across multiple packages ([c526462](https://github.com/visulima/visulima/commit/c52646260c2ae8bbf85692e642f305f47a158d4e))
* update package dependencies and configurations ([7bfe7e7](https://github.com/visulima/visulima/commit/7bfe7e71869580900aab50efb064b4293994ed9a))

## @visulima/bytes [2.0.1](https://github.com/visulima/visulima/compare/@visulima/bytes@2.0.0...@visulima/bytes@2.0.1) (2025-10-21)

### Bug Fixes

* allow node v25 and updated dev deps ([8158cc5](https://github.com/visulima/visulima/commit/8158cc53ec92bd0331e8c6bd0fcbc8ab61b9320f))

### Miscellaneous Chores

* **deps:** update package versions and dependencies ([88d8d32](https://github.com/visulima/visulima/commit/88d8d32c4629a7a06c8770369191da2cc81087cc))
* update package dependencies across multiple packages ([17e3f23](https://github.com/visulima/visulima/commit/17e3f2377c8a3f98e2eed2192c5adaf6e32558b5))

## @visulima/bytes [2.0.0](https://github.com/visulima/visulima/compare/@visulima/bytes@1.0.1...@visulima/bytes@2.0.0) (2025-10-15)

### ⚠ BREAKING CHANGES

* Adjusted the node engine requirement to support versions 20.19 and above

### Bug Fixes

* Adjusted the node engine requirement to support versions 20.19 and above ([e07d813](https://github.com/visulima/visulima/commit/e07d813093c1d731fc775cfecb6c19868c08671f))
* update @visulima/packem to 2.0.0-alpha.32 across multiple packages for improved compatibility ([27b346e](https://github.com/visulima/visulima/commit/27b346eaa1c0fb0e420d9a9824482028307f4249))

### Miscellaneous Chores

* add Prettier configuration and update ESLint ignore patterns ([a9ba959](https://github.com/visulima/visulima/commit/a9ba959fae02a08b158b3b81a634a8fba8326b92))
* **deps:** update build scripts and remove cross-env dependency ([7510e82](https://github.com/visulima/visulima/commit/7510e826b9235a0013fe61c82a7eb333bc4cbb78))
* update package dependencies across multiple packages for improved compatibility and performance ([9567591](https://github.com/visulima/visulima/commit/9567591c415da3002f3a4fe08f8caf7ce01ca5f7))
* update package.json and pnpm-lock.yaml to include publint@0.3.12 and adjust build/test commands to exclude shared-utils ([1f7b3c0](https://github.com/visulima/visulima/commit/1f7b3c0381d77edfeec80ea1bf57b3469e929414))

## @visulima/bytes [1.0.1](https://github.com/visulima/visulima/compare/@visulima/bytes@1.0.0...@visulima/bytes@1.0.1) (2025-09-10)

### Bug Fixes

* **bytes:** restore require exports in package.json and add validation to packem.config.ts ([762b1f5](https://github.com/visulima/visulima/commit/762b1f5789398617032ef23f06763c4fd9f41eda))

## @visulima/bytes 1.0.0 (2025-06-03)

### Features

* **bytes:** add utility functions for Uint8Array manipulation ([#507](https://github.com/visulima/visulima/issues/507)) ([07f43a0](https://github.com/visulima/visulima/commit/07f43a001a4f33a3ebcce9072d404a8975539608))
