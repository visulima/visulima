## @visulima/email [1.0.0-alpha.15](https://github.com/visulima/visulima/compare/@visulima/email@1.0.0-alpha.14...@visulima/email@1.0.0-alpha.15) (2026-04-22)

## @visulima/email [1.0.0-alpha.14](https://github.com/visulima/visulima/compare/@visulima/email@1.0.0-alpha.13...@visulima/email@1.0.0-alpha.14) (2026-04-22)

### Bug Fixes

* **email:** resolve eslint and formatting issues ([50c6fb1](https://github.com/visulima/visulima/commit/50c6fb14a6f72e40d168fcb57908fa9489417e9a))
* **email:** resolve eslint and formatting issues ([ad82020](https://github.com/visulima/visulima/commit/ad82020ded7fffdbba89b6befd2522a908cffe81))
* **email:** resolve eslint issues and format code ([8fd689c](https://github.com/visulima/visulima/commit/8fd689c12e9c21f7222597bbf99a6fe431b5f0d4))
* Remove JSR configuration generation script and generated jsr.json files ([#616](https://github.com/visulima/visulima/issues/616)) ([533744b](https://github.com/visulima/visulima/commit/533744b103b74896941db5b727173e617a27a63b))

### Miscellaneous Chores

* bump engines.node to ^22.14.0 || >=24.10.0 ([c3d0931](https://github.com/visulima/visulima/commit/c3d0931d1504e4f21ebf50ea680cfa7ce4ba15ce))
* **email:** apply formatter and lint fixes across providers ([addf346](https://github.com/visulima/visulima/commit/addf346653b0400de7a944b1d5573efc9654fe30))
* **email:** apply pending changes ([002c978](https://github.com/visulima/visulima/commit/002c9781033e9b2eae08257867b136dccdd11160))
* **email:** enforce curly braces and apply lint fixes ([2d82544](https://github.com/visulima/visulima/commit/2d82544bd769eef2935565a4df2c0c98b2cb8262))
* fixed jsr.json ([5d85e51](https://github.com/visulima/visulima/commit/5d85e5179de38e284ec433b14d77c71a1619c8d6))

### Code Refactoring

* replace inline import() types with top-level imports ([4569a4c](https://github.com/visulima/visulima/commit/4569a4ca04723da069f985855dcfab292f7347e1))


### Dependencies

* **@visulima/disposable-email-domains:** upgraded to 1.0.0-alpha.13

## @visulima/email [1.0.0-alpha.13](https://github.com/visulima/visulima/compare/@visulima/email@1.0.0-alpha.12...@visulima/email@1.0.0-alpha.13) (2026-04-08)

### Bug Fixes

* **email:** properly fix eslint errors in code ([ec1645b](https://github.com/visulima/visulima/commit/ec1645b3a4c7e471e7af74bac203ce34b950cdd3))
* **email:** remove remaining eslint suppressions with proper code fixes ([02367a9](https://github.com/visulima/visulima/commit/02367a9212ba72d90274b6e408e98a09ddb03b39))
* **email:** resolve eslint errors ([d35b6fe](https://github.com/visulima/visulima/commit/d35b6fe1e6ee4c19456b8428639529c75c0a97d3))

### Miscellaneous Chores

* **email:** add tsconfig.eslint.json for type-aware linting ([65a33f4](https://github.com/visulima/visulima/commit/65a33f4fa4b4771055a0267c679c62658813f746))
* **email:** apply prettier formatting ([362576d](https://github.com/visulima/visulima/commit/362576dd10e86707b0da2be7a27c7f6cb287e340))
* **email:** expand inline if-return to block syntax ([5e39aa0](https://github.com/visulima/visulima/commit/5e39aa0c563c1dd401337e485728635431f1da13))
* **email:** migrate .prettierrc.cjs to prettier.config.js ([f0caf3c](https://github.com/visulima/visulima/commit/f0caf3c1e2e5cc13a9a8bd5a14acc4f24e3f3a00))
* **email:** remove empty dependency objects from package.json ([0737b35](https://github.com/visulima/visulima/commit/0737b353aabceefe962dab9971ee0c09e9f055fe))


### Dependencies

* **@visulima/disposable-email-domains:** upgraded to 1.0.0-alpha.12
* **@visulima/error:** upgraded to 6.0.0-alpha.8
* **@visulima/fs:** upgraded to 5.0.0-alpha.7
* **@visulima/path:** upgraded to 3.0.0-alpha.8

## @visulima/email [1.0.0-alpha.12](https://github.com/visulima/visulima/compare/@visulima/email@1.0.0-alpha.11...@visulima/email@1.0.0-alpha.12) (2026-03-26)

### Features

* **web:** auto-generate packages page from workspace metadata ([623e520](https://github.com/visulima/visulima/commit/623e5207693a7fe720f5f2f179593a3654c880e3))


### Dependencies

* **@visulima/disposable-email-domains:** upgraded to 1.0.0-alpha.11
* **@visulima/error:** upgraded to 6.0.0-alpha.7
* **@visulima/fs:** upgraded to 5.0.0-alpha.6
* **@visulima/path:** upgraded to 3.0.0-alpha.7

## @visulima/email [1.0.0-alpha.11](https://github.com/visulima/visulima/compare/@visulima/email@1.0.0-alpha.10...@visulima/email@1.0.0-alpha.11) (2026-03-26)

### Bug Fixes

* **docs:** correct code examples found during verification ([8e4f8c4](https://github.com/visulima/visulima/commit/8e4f8c4b0b1664c232fe5ae721b771c72d29a152))
* **email:** use workspace:* for internal [@visulima](https://github.com/visulima) deps ([4c5c008](https://github.com/visulima/visulima/commit/4c5c008d5c65b3ee26225448eb0a7d6a90a47f5e))
* **web:** improve build setup with incremental stats caching and prod install ([fe33e75](https://github.com/visulima/visulima/commit/fe33e75827586779b4b3a0c6d57b39f889ee6207))

### Documentation

* add missing documentation pages for email, string, and storage-client ([623f8af](https://github.com/visulima/visulima/commit/623f8afd2ea03dd2805fb2d7a9d10083571224bb))

### Miscellaneous Chores

* **email:** migrate deps to pnpm catalogs ([487ca7a](https://github.com/visulima/visulima/commit/487ca7abb6db86498e4993afb0cd0113d005af23))
* **email:** update dependencies ([f7fb112](https://github.com/visulima/visulima/commit/f7fb1124a030474af12592992bbd95db29db53c1))
* visulima website ([#591](https://github.com/visulima/visulima/issues/591)) ([59ab2e2](https://github.com/visulima/visulima/commit/59ab2e2befb03e51cd2088956f83d9b87de6d033))


### Dependencies

* **@visulima/disposable-email-domains:** upgraded to 1.0.0-alpha.10
* **@visulima/error:** upgraded to 6.0.0-alpha.6
* **@visulima/fs:** upgraded to 5.0.0-alpha.5
* **@visulima/path:** upgraded to 3.0.0-alpha.6

## @visulima/email [1.0.0-alpha.10](https://github.com/visulima/visulima/compare/@visulima/email@1.0.0-alpha.9...@visulima/email@1.0.0-alpha.10) (2026-03-06)

### Bug Fixes

* **email:** update packem to 2.0.0-alpha.54 ([857a650](https://github.com/visulima/visulima/commit/857a650aea408e49c11f36ebe6e3a7f2e3560c82))

### Miscellaneous Chores

* **email:** update dependencies ([07a300d](https://github.com/visulima/visulima/commit/07a300dcb01259457a41ef3aaf8dd8038d7074ff))
* **email:** update dependencies ([0250461](https://github.com/visulima/visulima/commit/02504619e8e7ec6ef8e05f323674705656cde7de))
* update lock file maintenance ([d83e716](https://github.com/visulima/visulima/commit/d83e71697b75d24704185b66bb521a934d2db02d))
* year update ([47f4105](https://github.com/visulima/visulima/commit/47f410596ce7190cfea36a073db32e0cec50bbcd))


### Dependencies

* **@visulima/disposable-email-domains:** upgraded to 1.0.0-alpha.9
* **@visulima/error:** upgraded to 6.0.0-alpha.5
* **@visulima/fs:** upgraded to 5.0.0-alpha.4
* **@visulima/path:** upgraded to 3.0.0-alpha.5

## @visulima/email [1.0.0-alpha.9](https://github.com/visulima/visulima/compare/@visulima/email@1.0.0-alpha.8...@visulima/email@1.0.0-alpha.9) (2026-01-17)

### Bug Fixes

* **jsdoc-open-api:** combine name and description for path-based YAML parsing ([68e7d23](https://github.com/visulima/visulima/commit/68e7d2395ab97de3221892afe03da27688df7569))


### Dependencies

* **@visulima/disposable-email-domains:** upgraded to 1.0.0-alpha.8

## @visulima/email [1.0.0-alpha.8](https://github.com/visulima/visulima/compare/@visulima/email@1.0.0-alpha.7...@visulima/email@1.0.0-alpha.8) (2025-12-27)

### Bug Fixes

* **email:** update package files ([3e215cf](https://github.com/visulima/visulima/commit/3e215cf0ae366591dd1747a96a7275524e3f5501))


### Dependencies

* **@visulima/disposable-email-domains:** upgraded to 1.0.0-alpha.7
* **@visulima/error:** upgraded to 6.0.0-alpha.3
* **@visulima/fs:** upgraded to 5.0.0-alpha.3
* **@visulima/path:** upgraded to 3.0.0-alpha.4

## @visulima/email [1.0.0-alpha.7](https://github.com/visulima/visulima/compare/@visulima/email@1.0.0-alpha.6...@visulima/email@1.0.0-alpha.7) (2025-12-13)

### Miscellaneous Chores

* fixed project.json names and schema path ([964722f](https://github.com/visulima/visulima/commit/964722f691db205c7edb9aa6db29e849a647500b))


### Dependencies

* **@visulima/disposable-email-domains:** upgraded to 1.0.0-alpha.6

## @visulima/email [1.0.0-alpha.6](https://github.com/visulima/visulima/compare/@visulima/email@1.0.0-alpha.5...@visulima/email@1.0.0-alpha.6) (2025-12-11)

### Bug Fixes

* update package OG images across multiple packages ([f08e4dd](https://github.com/visulima/visulima/commit/f08e4dd2b105ccb29c8412020a9c2be36d6c1e9e))


### Dependencies

* **@visulima/disposable-email-domains:** upgraded to 1.0.0-alpha.5
* **@visulima/error:** upgraded to 6.0.0-alpha.2
* **@visulima/fs:** upgraded to 5.0.0-alpha.2
* **@visulima/path:** upgraded to 3.0.0-alpha.3

## @visulima/email [1.0.0-alpha.5](https://github.com/visulima/visulima/compare/@visulima/email@1.0.0-alpha.4...@visulima/email@1.0.0-alpha.5) (2025-12-10)


### Dependencies

* **@visulima/disposable-email-domains:** upgraded to 1.0.0-alpha.4

## @visulima/email [1.0.0-alpha.4](https://github.com/visulima/visulima/compare/@visulima/email@1.0.0-alpha.3...@visulima/email@1.0.0-alpha.4) (2025-12-08)


### Dependencies

* **@visulima/disposable-email-domains:** upgraded to 1.0.0-alpha.3

## @visulima/email [1.0.0-alpha.3](https://github.com/visulima/visulima/compare/@visulima/email@1.0.0-alpha.2...@visulima/email@1.0.0-alpha.3) (2025-12-07)

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

* **@visulima/disposable-email-domains:** upgraded to 1.0.0-alpha.2
* **@visulima/error:** upgraded to 6.0.0-alpha.1
* **@visulima/fs:** upgraded to 5.0.0-alpha.1

## @visulima/email [1.0.0-alpha.2](https://github.com/visulima/visulima/compare/@visulima/email@1.0.0-alpha.1...@visulima/email@1.0.0-alpha.2) (2025-12-02)

### Features

* add default email configuration options ([848d2fb](https://github.com/visulima/visulima/commit/848d2fb723634aa6e027be55fa479bfb99c6504c))
* add disposable email detection utility to email package ([59bebd4](https://github.com/visulima/visulima/commit/59bebd4114efc5f77740f458bef7bbe6e8bcfcee))
* add draft email functionality and enhance documentation ([3ea7e88](https://github.com/visulima/visulima/commit/3ea7e88f0af453709294802f50028b0ac4fb723e))
* add email alias normalization utility and documentation ([1efed30](https://github.com/visulima/visulima/commit/1efed309a833f122f2aa586e11c2622492e8580d))
* add email verification utilities and tests ([88079a7](https://github.com/visulima/visulima/commit/88079a7c718040fb6118991ea37d4da1d3668aef))
* enhance draft email functionality and update documentation ([25e153e](https://github.com/visulima/visulima/commit/25e153e1f6c2466f3c8246357cc31ed4dd8eb297))
* enhance email package with new utilities and updates ([e06baf0](https://github.com/visulima/visulima/commit/e06baf00a6dcbd78642fbd046801333236d7279e))
* initialize disposable email domains package with configuration and utilities ([ef671a1](https://github.com/visulima/visulima/commit/ef671a14492abae5bbf7324f36b49d24f3f5cf58))
* integrate disposable email domains into email package ([24b3d42](https://github.com/visulima/visulima/commit/24b3d425bb6e5a7da2fb3922f0d093dc271536fe))
* update disposable email domains package and enhance synchronization ([dd81823](https://github.com/visulima/visulima/commit/dd818230a2435568317fdb02728a96ec580962a3))

### Miscellaneous Chores

* update @visulima/packem version to 2.0.0-alpha.40 across multiple packages ([e5be373](https://github.com/visulima/visulima/commit/e5be373fef8f8dda20c1dee7a1ac30d9b7a7712e))
* update package dependencies and versions across multiple packages ([9a9ac80](https://github.com/visulima/visulima/commit/9a9ac8046f7138cf37bec9e2041bc2125e97f212))

### Code Refactoring

* enhance role account prefixes and update README ([b4f3a1f](https://github.com/visulima/visulima/commit/b4f3a1fdf43985f503aecf23b999e3443b52a403))
* simplify disposable email tests and remove unused functions ([c331ec5](https://github.com/visulima/visulima/commit/c331ec5d93df2b8b564733f2104c373a62fb87ee))
* update disposable email domains synchronization workflow and README ([c3b3291](https://github.com/visulima/visulima/commit/c3b3291c76a6e4bfa47788341cdf72c34a8987e0))


### Dependencies

* **@visulima/disposable-email-domains:** upgraded to 1.0.0-alpha.1

## @visulima/email 1.0.0-alpha.1 (2025-11-29)

### Features

* create new email package and providers ([#567](https://github.com/visulima/visulima/issues/567)) ([783cecf](https://github.com/visulima/visulima/commit/783cecf89fd772ae9caf679e0bca33ab4611216c))

### Bug Fixes

* enhance email package functionality and improve test coverage ([550c0ba](https://github.com/visulima/visulima/commit/550c0ba408afac52291c48ae503ca12c3fd57c3b))

### Miscellaneous Chores

* clean up pnpm-lock.yaml by removing unused dependencies ([57f3464](https://github.com/visulima/visulima/commit/57f3464e0b3910020b18c28cc194366601d1dd03))

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
