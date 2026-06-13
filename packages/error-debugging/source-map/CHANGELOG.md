## @visulima/source-map [3.0.0-alpha.12](https://github.com/visulima/visulima/compare/@visulima/source-map@3.0.0-alpha.11...@visulima/source-map@3.0.0-alpha.12) (2026-06-13)

### Features

* **source-map:** fix file: urls, add async/in-memory loaders ([3b3a19e](https://github.com/visulima/visulima/commit/3b3a19ee8345d5423ba52c25628d2c7d8f6ed436))

### Bug Fixes

* **source-map:** add missing SourceMapParseError export ([43f7abf](https://github.com/visulima/visulima/commit/43f7abf628e867ca017142dca6eae68590587e5f))
* **source-map:** import SourceMapParseError from its own module and name source file in errors ([cbebbf1](https://github.com/visulima/visulima/commit/cbebbf191b689ded2d2db4e5b0e5c96542f7bed6))

### Code Refactoring

* **source-map:** extract module-level regex constants and tidy docs ([fccd07e](https://github.com/visulima/visulima/commit/fccd07e3dcc1e66c8833b4e204b076ecda7f2c47))

### Tests

* **source-map:** extend load-source-map coverage ([33b2c27](https://github.com/visulima/visulima/commit/33b2c2780b35499a894218618fa9eda4312a5634))


### Dependencies

* **@visulima/path:** upgraded to 3.0.0-alpha.13

## @visulima/source-map [3.0.0-alpha.11](https://github.com/visulima/visulima/compare/@visulima/source-map@3.0.0-alpha.10...@visulima/source-map@3.0.0-alpha.11) (2026-06-04)

### Bug Fixes

* **source-map:** 2 bug fixes ([9319e40](https://github.com/visulima/visulima/commit/9319e403dd8170127c1b3f2fbddb27af98dfb308))

### Miscellaneous Chores

* apply eslint + prettier autofixes across packages ([c1bb784](https://github.com/visulima/visulima/commit/c1bb7848a0d93d0dfe2960c77e3cda22239c79a0))

### Tests

* **source-map:** cover block-comment url and non-error throw branches ([892f351](https://github.com/visulima/visulima/commit/892f3511c0a010ff87fd156b0866f4219eec1391))


### Dependencies

* **@visulima/path:** upgraded to 3.0.0-alpha.12

## @visulima/source-map [3.0.0-alpha.10](https://github.com/visulima/visulima/compare/@visulima/source-map@3.0.0-alpha.9...@visulima/source-map@3.0.0-alpha.10) (2026-05-27)

### Bug Fixes

* **storage-client:** percent-encode user fields in defaultFingerprint ([7c78a0f](https://github.com/visulima/visulima/commit/7c78a0f9512e2a673b941d80839e9f1e86b7b5d0))

### Miscellaneous Chores

* **ci-stability:** green CI across vis, native, lint, tests, attw ([#651](https://github.com/visulima/visulima/issues/651)) ([d4eb684](https://github.com/visulima/visulima/commit/d4eb684b5f75c818c9251048c605a0ed54a268e3))
* re-sort workspace package.json files via vis sort-package-json ([f625696](https://github.com/visulima/visulima/commit/f625696cfac974325774b3243e1a83c3d23acbd7))
* **repo:** sort package.json keys across all packages ([e1fd9ab](https://github.com/visulima/visulima/commit/e1fd9ab467ef96a98c777da1572ff6a50fcf7e71))
* sorted package.json ([b47c545](https://github.com/visulima/visulima/commit/b47c545591600fdab17d5cd3a3fbc68b61e199da))
* **source-map:** housekeeping cleanup ([2be93ee](https://github.com/visulima/visulima/commit/2be93eec2f355935a4d7a7495f4e0994c94e8e72))
* **source-map:** upgrade packem to 2.0.0-alpha.76 ([ba43a91](https://github.com/visulima/visulima/commit/ba43a91e3252d43547e72905fc6dc32143a3eae9))

### Tests

* **repo:** add dist runtime + types integration tests ([32ee300](https://github.com/visulima/visulima/commit/32ee300b7184117a0ddf9f9d390f75f8932d5ed9))


### Dependencies

* **@visulima/path:** upgraded to 3.0.0-alpha.11

## @visulima/source-map [3.0.0-alpha.9](https://github.com/visulima/visulima/compare/@visulima/source-map@3.0.0-alpha.8...@visulima/source-map@3.0.0-alpha.9) (2026-04-22)

### Bug Fixes

* Remove JSR configuration generation script and generated jsr.json files ([#616](https://github.com/visulima/visulima/issues/616)) ([533744b](https://github.com/visulima/visulima/commit/533744b103b74896941db5b727173e617a27a63b))

### Miscellaneous Chores

* update the jsr.json ([864ab7e](https://github.com/visulima/visulima/commit/864ab7e71c4b5ae82f64792d1ae8debfea2c539b))


### Dependencies

* **@visulima/path:** upgraded to 3.0.0-alpha.10

## @visulima/source-map [3.0.0-alpha.8](https://github.com/visulima/visulima/compare/@visulima/source-map@3.0.0-alpha.7...@visulima/source-map@3.0.0-alpha.8) (2026-04-21)

### Bug Fixes

* **error-debugging:** resolve eslint and type-safety issues ([886dbff](https://github.com/visulima/visulima/commit/886dbffe3f744c9493fcc54e781de3fd21eebf78))

### Miscellaneous Chores

* bump engines.node to ^22.14.0 || >=24.10.0 ([c3d0931](https://github.com/visulima/visulima/commit/c3d0931d1504e4f21ebf50ea680cfa7ce4ba15ce))
* fixed jsr.json ([5d85e51](https://github.com/visulima/visulima/commit/5d85e5179de38e284ec433b14d77c71a1619c8d6))

## @visulima/source-map [3.0.0-alpha.7](https://github.com/visulima/visulima/compare/@visulima/source-map@3.0.0-alpha.6...@visulima/source-map@3.0.0-alpha.7) (2026-04-08)

### Bug Fixes

* **source-map:** resolve eslint errors ([ba54d04](https://github.com/visulima/visulima/commit/ba54d04e342fd90abfe70d1db6d519da93652ba2))

### Miscellaneous Chores

* **error-debugging:** remove empty dependency objects from package.json ([7eb7c8e](https://github.com/visulima/visulima/commit/7eb7c8eba1394e515fa77c0f56baf41c0810de2e))
* **source-map:** add tsconfig.eslint.json for type-aware linting ([36a8bef](https://github.com/visulima/visulima/commit/36a8bef2a415dc595a96c7e55f25cbce34e395da))
* **source-map:** apply auto-fix formatting ([351d57d](https://github.com/visulima/visulima/commit/351d57df78f87c6179d6092ebf4d7526d49b6de4))
* **source-map:** apply prettier formatting ([64ac891](https://github.com/visulima/visulima/commit/64ac89101c12da54dc00553bcd4c28ecc22c2dc7))
* **source-map:** migrate .prettierrc.cjs to prettier.config.js ([2a814e1](https://github.com/visulima/visulima/commit/2a814e1cd4deeae251c9150b64860d407490eafd))


### Dependencies

* **@visulima/path:** upgraded to 3.0.0-alpha.8

## @visulima/source-map [3.0.0-alpha.6](https://github.com/visulima/visulima/compare/@visulima/source-map@3.0.0-alpha.5...@visulima/source-map@3.0.0-alpha.6) (2026-03-26)

### Features

* **web:** auto-generate packages page from workspace metadata ([623e520](https://github.com/visulima/visulima/commit/623e5207693a7fe720f5f2f179593a3654c880e3))


### Dependencies

* **@visulima/path:** upgraded to 3.0.0-alpha.7

## @visulima/source-map [3.0.0-alpha.5](https://github.com/visulima/visulima/compare/@visulima/source-map@3.0.0-alpha.4...@visulima/source-map@3.0.0-alpha.5) (2026-03-26)

### Bug Fixes

* **source-map:** use workspace:* for internal [@visulima](https://github.com/visulima) deps ([7e284d9](https://github.com/visulima/visulima/commit/7e284d9aee4c2e739fe18ec189a98fa7f9df4dde))
* **web:** improve build setup with incremental stats caching and prod install ([fe33e75](https://github.com/visulima/visulima/commit/fe33e75827586779b4b3a0c6d57b39f889ee6207))

### Miscellaneous Chores

* **source-map:** migrate deps to pnpm catalogs ([6385d4e](https://github.com/visulima/visulima/commit/6385d4e5f9d888ec5d7e4c95612867b33aa2dae7))
* **source-map:** update dependencies ([d9f3e0e](https://github.com/visulima/visulima/commit/d9f3e0e2fa055e7340a8cfaf4600573e15b5be29))
* visulima website ([#591](https://github.com/visulima/visulima/issues/591)) ([59ab2e2](https://github.com/visulima/visulima/commit/59ab2e2befb03e51cd2088956f83d9b87de6d033))


### Dependencies

* **@visulima/path:** upgraded to 3.0.0-alpha.6

## @visulima/source-map [3.0.0-alpha.4](https://github.com/visulima/visulima/compare/@visulima/source-map@3.0.0-alpha.3...@visulima/source-map@3.0.0-alpha.4) (2026-03-06)

### Bug Fixes

* **source-map:** update packem to 2.0.0-alpha.54 ([b18abf9](https://github.com/visulima/visulima/commit/b18abf9866e8ee1f4622b15e5290d90d1baf02ed))

### Documentation

* **error,error-handler,ono,inspector,source-map,vite-overlay:** add comprehensive Fumadocs documentation ([a0c8c92](https://github.com/visulima/visulima/commit/a0c8c92949cff2730fc6122f717fe344c030f366))

### Miscellaneous Chores

* **error-debugging:** update dependencies ([6002ece](https://github.com/visulima/visulima/commit/6002ece1803b2ba8261cff42a362dd6e8ddcc3ee))
* **source-map:** update dependencies ([607bef6](https://github.com/visulima/visulima/commit/607bef66893cde90ae6bda8e6559326d76b5f919))
* **source-map:** update dependencies ([3f232b2](https://github.com/visulima/visulima/commit/3f232b2cca39aac871729caff0c505fe7570c90b))
* update lock file maintenance ([d83e716](https://github.com/visulima/visulima/commit/d83e71697b75d24704185b66bb521a934d2db02d))
* year update ([47f4105](https://github.com/visulima/visulima/commit/47f410596ce7190cfea36a073db32e0cec50bbcd))


### Dependencies

* **@visulima/path:** upgraded to 3.0.0-alpha.5

## @visulima/source-map [3.0.0-alpha.3](https://github.com/visulima/visulima/compare/@visulima/source-map@3.0.0-alpha.2...@visulima/source-map@3.0.0-alpha.3) (2025-12-27)

### Bug Fixes

* **source-map:** update package files ([781c52c](https://github.com/visulima/visulima/commit/781c52c6b6de73115fa6186e9e3169642a683d96))

### Miscellaneous Chores

* fixed project.json names and schema path ([964722f](https://github.com/visulima/visulima/commit/964722f691db205c7edb9aa6db29e849a647500b))


### Dependencies

* **@visulima/path:** upgraded to 3.0.0-alpha.4

## @visulima/source-map [3.0.0-alpha.2](https://github.com/visulima/visulima/compare/@visulima/source-map@3.0.0-alpha.1...@visulima/source-map@3.0.0-alpha.2) (2025-12-11)

### Bug Fixes

* update package OG images across multiple packages ([f08e4dd](https://github.com/visulima/visulima/commit/f08e4dd2b105ccb29c8412020a9c2be36d6c1e9e))


### Dependencies

* **@visulima/path:** upgraded to 3.0.0-alpha.3

## @visulima/source-map [3.0.0-alpha.1](https://github.com/visulima/visulima/compare/@visulima/source-map@2.0.5...@visulima/source-map@3.0.0-alpha.1) (2025-12-07)

### ⚠ BREAKING CHANGES

* change min node version to 22.13

### Bug Fixes

* add new package image, fixed readme rendering on npm, fixed building of packages ([b790ba2](https://github.com/visulima/visulima/commit/b790ba253ea07fef83528fd822a678facf021b5f))
* update Node.js engine version requirement to >=22.13 in multiple package.json files for improved compatibility ([b828e9a](https://github.com/visulima/visulima/commit/b828e9aeaebfc798eecddccd90e6ec7560c6d36a))

### Miscellaneous Chores

* moved all packages into groups ([0615e9d](https://github.com/visulima/visulima/commit/0615e9d14a8a886e11da529ce150cf31ca973c10))
* update @anolilab/semantic-release-pnpm and @anolilab/semantic-release-preset to versions 3.2.2 and 12.1.2 across multiple package.json files for improved compatibility ([3921626](https://github.com/visulima/visulima/commit/3921626141fe5da398749bf0ba675f1596f18afb))
* update dependencies across multiple packages to improve compatibility and performance, including upgrading `@anolilab/semantic-release-pnpm` and `@anolilab/semantic-release-preset` to versions 3.2.0 and 12.1.0 respectively, and updating `react`, `react-dom`, and `next` versions to 19.2.1 and 16.0.7 in various package.json files ([aee8fcd](https://github.com/visulima/visulima/commit/aee8fcd796ae9b8d055903260e7150996ea9f53d))

## @visulima/source-map [2.0.5](https://github.com/visulima/visulima/compare/@visulima/source-map@2.0.4...@visulima/source-map@2.0.5) (2025-11-13)

### Bug Fixes

* bump packem, to fix minified version of the code ([2a36ceb](https://github.com/visulima/visulima/commit/2a36ceb09251b0ca1178701a26547a871ed717a7))


### Dependencies

* **@visulima/path:** upgraded to 2.0.5

## @visulima/source-map [2.0.4](https://github.com/visulima/visulima/compare/@visulima/source-map@2.0.3...@visulima/source-map@2.0.4) (2025-11-12)

### Bug Fixes

* update package configurations and TypeScript definitions ([b59aa59](https://github.com/visulima/visulima/commit/b59aa59dac1508216b944f4b917fb4a7ab1f70a4))

### Miscellaneous Chores

* Add jsr file to all packages for release ([#565](https://github.com/visulima/visulima/issues/565)) ([ec91652](https://github.com/visulima/visulima/commit/ec91652b4e4112adf14ba152c1239a7703ba425a))


### Dependencies

* **@visulima/path:** upgraded to 2.0.4

## @visulima/source-map [2.0.3](https://github.com/visulima/visulima/compare/@visulima/source-map@2.0.2...@visulima/source-map@2.0.3) (2025-11-07)

### Bug Fixes

* update TypeScript configurations and improve linting across multiple packages ([6f25ec7](https://github.com/visulima/visulima/commit/6f25ec7841da7246f8f9166efc5292a7089d37ee))

### Miscellaneous Chores

* update npm and pnpm configurations for monorepo optimization ([#564](https://github.com/visulima/visulima/issues/564)) ([5512b42](https://github.com/visulima/visulima/commit/5512b42f672c216b6a3c9e39035199a4ebd9a4b8))


### Dependencies

* **@visulima/path:** upgraded to 2.0.3

## @visulima/source-map [2.0.2](https://github.com/visulima/visulima/compare/@visulima/source-map@2.0.1...@visulima/source-map@2.0.2) (2025-11-05)

### Bug Fixes

* update dependencies across multiple packages ([36a47f2](https://github.com/visulima/visulima/commit/36a47f26d65d25a7b4d8371186710e7d0ab61a2b))

### Miscellaneous Chores

* update dependencies across multiple packages ([c526462](https://github.com/visulima/visulima/commit/c52646260c2ae8bbf85692e642f305f47a158d4e))
* update package dependencies and configurations ([7bfe7e7](https://github.com/visulima/visulima/commit/7bfe7e71869580900aab50efb064b4293994ed9a))


### Dependencies

* **@visulima/path:** upgraded to 2.0.2

## @visulima/source-map [2.0.1](https://github.com/visulima/visulima/compare/@visulima/source-map@2.0.0...@visulima/source-map@2.0.1) (2025-10-21)

### Bug Fixes

* allow node v25 and updated dev deps ([8158cc5](https://github.com/visulima/visulima/commit/8158cc53ec92bd0331e8c6bd0fcbc8ab61b9320f))

### Miscellaneous Chores

* **deps:** update package versions and dependencies ([88d8d32](https://github.com/visulima/visulima/commit/88d8d32c4629a7a06c8770369191da2cc81087cc))
* update copyright year in LICENSE.md files ([c46a28d](https://github.com/visulima/visulima/commit/c46a28d2afb4cc7d73a7edde9a271a7156f87eae))
* update license years and add validation rules ([b97811e](https://github.com/visulima/visulima/commit/b97811ed2d253d908c0d86b4579a0a6bc33673a8))
* update package dependencies across multiple packages ([17e3f23](https://github.com/visulima/visulima/commit/17e3f2377c8a3f98e2eed2192c5adaf6e32558b5))


### Dependencies

* **@visulima/path:** upgraded to 2.0.1

## @visulima/source-map [2.0.0](https://github.com/visulima/visulima/compare/@visulima/source-map@1.0.20...@visulima/source-map@2.0.0) (2025-10-15)

### ⚠ BREAKING CHANGES

* Adjusted the node engine requirement to support versions 20.19 and above

### Bug Fixes

* Adjusted the node engine requirement to support versions 20.19 and above ([c228384](https://github.com/visulima/visulima/commit/c2283844343b9bc832899d604358cb80b2cf259f))
* update @visulima/packem to 2.0.0-alpha.32 across multiple packages for improved compatibility ([27b346e](https://github.com/visulima/visulima/commit/27b346eaa1c0fb0e420d9a9824482028307f4249))

### Miscellaneous Chores

* add new ESLint configuration for improved linting management ([f72f758](https://github.com/visulima/visulima/commit/f72f7587fa40cd3f9bb4abdb64d524ce2219fecd))
* **deps:** update build scripts and remove cross-env dependency ([7510e82](https://github.com/visulima/visulima/commit/7510e826b9235a0013fe61c82a7eb333bc4cbb78))
* refine linting commands and update configuration files ([4bd9176](https://github.com/visulima/visulima/commit/4bd91765fd6db61a50c054bd2384264d6c43110b))
* remove legacy ESLint configuration files ([141bd15](https://github.com/visulima/visulima/commit/141bd15907350687dd70eb4eccdc4adac5ef2350))
* update package dependencies across multiple packages for improved compatibility and performance ([9567591](https://github.com/visulima/visulima/commit/9567591c415da3002f3a4fe08f8caf7ce01ca5f7))
* update package.json and pnpm-lock.yaml to include publint@0.3.12 and adjust build/test commands to exclude shared-utils ([1f7b3c0](https://github.com/visulima/visulima/commit/1f7b3c0381d77edfeec80ea1bf57b3469e929414))


### Dependencies

* **@visulima/path:** upgraded to 2.0.0

## @visulima/source-map [1.0.20](https://github.com/visulima/visulima/compare/@visulima/source-map@1.0.19...@visulima/source-map@1.0.20) (2025-06-04)


### Dependencies

* **@visulima/path:** upgraded to 1.4.0

## @visulima/source-map [1.0.19](https://github.com/visulima/visulima/compare/@visulima/source-map@1.0.18...@visulima/source-map@1.0.19) (2025-05-30)

### Bug Fixes

* **source-map:** update dependencies ([814dbff](https://github.com/visulima/visulima/commit/814dbff80c70fab4c7f94fdcfcecbaa5d504ddbd))

### Miscellaneous Chores

* updated dev dependencies ([2433ed5](https://github.com/visulima/visulima/commit/2433ed5fb662e0303c37edee8ddc21b46c21263f))


### Dependencies

* **@visulima/path:** upgraded to 1.3.6

## @visulima/source-map [1.0.18](https://github.com/visulima/visulima/compare/@visulima/source-map@1.0.17...@visulima/source-map@1.0.18) (2025-03-07)

### Bug Fixes

* updated @visulima/packem and other dev deps, for better bundling size ([e940581](https://github.com/visulima/visulima/commit/e9405812201594e54dd81d17ddb74177df5f3c24))

### Miscellaneous Chores

* updated dev dependencies ([487a976](https://github.com/visulima/visulima/commit/487a976932dc7c39edfc19ffd3968960ff338066))


### Dependencies

* **@visulima/path:** upgraded to 1.3.5

## @visulima/source-map [1.0.17](https://github.com/visulima/visulima/compare/@visulima/source-map@1.0.16...@visulima/source-map@1.0.17) (2025-01-25)

### Bug Fixes

* fixed wrong node version range in package.json ([4ae2929](https://github.com/visulima/visulima/commit/4ae292984681c71a770e4d4560432f7b7c5a141a))

### Miscellaneous Chores

* fixed typescript url ([fe65a8c](https://github.com/visulima/visulima/commit/fe65a8c0296ece7ee26474c70d065b06d4d0da89))
* updated all dev dependencies ([37fb298](https://github.com/visulima/visulima/commit/37fb298b2af7c63be64252024e54bb3af6ddabec))
* updated all dev dependencies and all dependencies in the app folder ([87f4ccb](https://github.com/visulima/visulima/commit/87f4ccbf9f7900ec5b56f3c1477bc4a0ef571bcf))


### Dependencies

* **@visulima/path:** upgraded to 1.3.4

## @visulima/source-map [1.0.16](https://github.com/visulima/visulima/compare/@visulima/source-map@1.0.15...@visulima/source-map@1.0.16) (2025-01-13)


### Dependencies

* **@visulima/path:** upgraded to 1.3.3

## @visulima/source-map [1.0.15](https://github.com/visulima/visulima/compare/@visulima/source-map@1.0.14...@visulima/source-map@1.0.15) (2025-01-12)

### Bug Fixes

* updated @visulima/packem, and all other dev dependencies ([7797a1c](https://github.com/visulima/visulima/commit/7797a1c3e6f1fc532895247bd88285a8a9883c40))


### Dependencies

* **@visulima/path:** upgraded to 1.3.2

## @visulima/source-map [1.0.14](https://github.com/visulima/visulima/compare/@visulima/source-map@1.0.13...@visulima/source-map@1.0.14) (2025-01-08)


### Dependencies

* **@visulima/path:** upgraded to 1.3.1

## @visulima/source-map [1.0.13](https://github.com/visulima/visulima/compare/@visulima/source-map@1.0.12...@visulima/source-map@1.0.13) (2025-01-08)


### Dependencies

* **@visulima/path:** upgraded to 1.3.0

## @visulima/source-map [1.0.12](https://github.com/visulima/visulima/compare/@visulima/source-map@1.0.11...@visulima/source-map@1.0.12) (2024-12-31)

### Miscellaneous Chores

* updated dev dependencies ([9de2eab](https://github.com/visulima/visulima/commit/9de2eab91e95c8b9289d12f863a5167218770650))


### Dependencies

* **@visulima/path:** upgraded to 1.2.0

## @visulima/source-map [1.0.11](https://github.com/visulima/visulima/compare/@visulima/source-map@1.0.10...@visulima/source-map@1.0.11) (2024-12-12)

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

## @visulima/source-map [1.0.10](https://github.com/visulima/visulima/compare/@visulima/source-map@1.0.9...@visulima/source-map@1.0.10) (2024-10-22)

### Bug Fixes

* **source-map:** added all exports from @jridgewell/trace-mapping ([af4551a](https://github.com/visulima/visulima/commit/af4551af01347a1ea92d7237cb349951712b26dd))

## @visulima/source-map [1.0.9](https://github.com/visulima/visulima/compare/@visulima/source-map@1.0.8...@visulima/source-map@1.0.9) (2024-10-05)


### Dependencies

* **@visulima/path:** upgraded to 1.1.1

## @visulima/source-map [1.0.8](https://github.com/visulima/visulima/compare/@visulima/source-map@1.0.7...@visulima/source-map@1.0.8) (2024-10-05)

### Bug Fixes

* updated dev dependencies, updated packem to v1.0.7, fixed naming of some lint config files ([c071a9c](https://github.com/visulima/visulima/commit/c071a9c8e129014a962ff654a16f302ca18a5c67))

### Miscellaneous Chores

* updated dev dependencies ([736c6ce](https://github.com/visulima/visulima/commit/736c6ce7270b3e525a8ea9f79646a2a3fde47d4e))


### Dependencies

* **@visulima/path:** upgraded to 1.1.0

## @visulima/source-map [1.0.7](https://github.com/visulima/visulima/compare/@visulima/source-map@1.0.6...@visulima/source-map@1.0.7) (2024-09-24)

### Bug Fixes

* update packem to v1 ([05f3bc9](https://github.com/visulima/visulima/commit/05f3bc960df10a1602e24f9066e2b0117951a877))
* updated esbuild from v0.23 to v0.24 ([3793010](https://github.com/visulima/visulima/commit/3793010d0d549c0d41f85dea04b8436251be5fe8))

### Miscellaneous Chores

* updated dev dependencies ([05edb67](https://github.com/visulima/visulima/commit/05edb671285b1cc42875223314b24212e6a12588))


### Dependencies

* **@visulima/path:** upgraded to 1.0.9

## @visulima/source-map [1.0.6](https://github.com/visulima/visulima/compare/@visulima/source-map@1.0.5...@visulima/source-map@1.0.6) (2024-09-11)

### Bug Fixes

* fixed node10 support ([f5e78d9](https://github.com/visulima/visulima/commit/f5e78d9bff8fd603967666598b34f9338a8726b5))

### Miscellaneous Chores

* updated dev dependencies ([28b5ee5](https://github.com/visulima/visulima/commit/28b5ee5c805ca8868536418829cde7ba8c5bb8dd))


### Dependencies

* **@visulima/path:** upgraded to 1.0.8

## @visulima/source-map [1.0.5](https://github.com/visulima/visulima/compare/@visulima/source-map@1.0.4...@visulima/source-map@1.0.5) (2024-09-07)

### Bug Fixes

* fixed broken chunk splitting from packem ([1aaf277](https://github.com/visulima/visulima/commit/1aaf27779292d637923c5f8a220e18606e78caa2))


### Dependencies

* **@visulima/path:** upgraded to 1.0.7

## @visulima/source-map [1.0.4](https://github.com/visulima/visulima/compare/@visulima/source-map@1.0.3...@visulima/source-map@1.0.4) (2024-09-07)

### Bug Fixes

* added types support for node10 ([604583f](https://github.com/visulima/visulima/commit/604583fa3c24b950fafad45d17e7a1333040fd76))

### Miscellaneous Chores

* update dev dependencies ([0738f98](https://github.com/visulima/visulima/commit/0738f9810478bb215ce4b2571dc8874c4c503089))


### Dependencies

* **@visulima/path:** upgraded to 1.0.6

## @visulima/source-map [1.0.3](https://github.com/visulima/visulima/compare/@visulima/source-map@1.0.2...@visulima/source-map@1.0.3) (2024-08-30)

### Miscellaneous Chores

* updated dev dependencies ([45c2a76](https://github.com/visulima/visulima/commit/45c2a76bc974ecb2c6b172c3af03373d4cc6a5ce))


### Dependencies

* **@visulima/path:** upgraded to 1.0.5

## @visulima/source-map [1.0.2](https://github.com/visulima/visulima/compare/@visulima/source-map@1.0.1...@visulima/source-map@1.0.2) (2024-08-04)


### Dependencies

* **@visulima/path:** upgraded to 1.0.4

## @visulima/source-map [1.0.1](https://github.com/visulima/visulima/compare/@visulima/source-map@1.0.0...@visulima/source-map@1.0.1) (2024-08-01)

### Bug Fixes

* upgraded @visulima/packem ([dc0cb57](https://github.com/visulima/visulima/commit/dc0cb5701b30f3f81404346c909fd4daf891b894))

### Miscellaneous Chores

* changed typescript version back to 5.4.5 ([55d28bb](https://github.com/visulima/visulima/commit/55d28bbdc103718d19f844034b38a0e8e5af798a))
* updated dev dependencies ([ac67ec1](https://github.com/visulima/visulima/commit/ac67ec1bcba16175d225958e318199f60b10d179))
* updated dev dependencies ([34df456](https://github.com/visulima/visulima/commit/34df4569f2fc074823a406c44a131c8fbae2b147))
* updated dev dependencies ([c889486](https://github.com/visulima/visulima/commit/c889486f8980741f459b993648c1b6d0815e3d66))
* updated dev dependencies and sorted the package.json ([9571572](https://github.com/visulima/visulima/commit/95715725a8ed053ca24fd1405a55205c79342ecb))


### Dependencies

* **@visulima/path:** upgraded to 1.0.3

## @visulima/source-map 1.0.0 (2024-06-16)

### ⚠ BREAKING CHANGES

* **error:** moved source-map handling into a new package @visulima/source-map
Signed-off-by: prisis <d.bannert@anolilab.de>

Signed-off-by: prisis <d.bannert@anolilab.de>

### Features

* **error:** removed source-map handling ([716ef11](https://github.com/visulima/visulima/commit/716ef11a054fd9405f58ba448a868054b5368b50))
* **source-map:** new source-map package ([d4114c6](https://github.com/visulima/visulima/commit/d4114c6e7cd73bacf14ba7d8df509507d8daa3ee))

### Styles

* **source-map:** fixed found eslint issues ([2db7d96](https://github.com/visulima/visulima/commit/2db7d9673a64c17756ea9886463503396966c385))

### Miscellaneous Chores

* **source-map:** fixed broken test on windows ([0a4523f](https://github.com/visulima/visulima/commit/0a4523f0ce5924ad52acf334945e4a91a960c7fa))
* **source-map:** moved fixtures from error to source-map ([664b287](https://github.com/visulima/visulima/commit/664b2870d4405fb27b65f7dc264b89f1bf29306d))
