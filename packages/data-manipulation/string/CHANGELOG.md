## @visulima/string [3.0.0-alpha.12](https://github.com/visulima/visulima/compare/@visulima/string@3.0.0-alpha.11...@visulima/string@3.0.0-alpha.12) (2026-05-07)

### Bug Fixes

* **string:** repair broken bench imports ([f077356](https://github.com/visulima/visulima/commit/f077356139dc4745c59ac286f5a0681918fbb366))

### Miscellaneous Chores

* re-sort workspace package.json files via vis sort-package-json ([f625696](https://github.com/visulima/visulima/commit/f625696cfac974325774b3243e1a83c3d23acbd7))
* simplify pnpm-workspace packages list ([7cab221](https://github.com/visulima/visulima/commit/7cab221163632d9b7aa044a6f88c49083103a869))
* **string:** apply prettier and eslint quote-style auto-fix ([db1d161](https://github.com/visulima/visulima/commit/db1d1615c7614fb537d53c458bdef3c38c6aab98))
* **string:** housekeeping cleanup ([ecb3058](https://github.com/visulima/visulima/commit/ecb3058b68c2ffae62d9b1d685fe606a605861cd))
* **string:** upgrade packem to 2.0.0-alpha.76 ([bcac381](https://github.com/visulima/visulima/commit/bcac381ead9c22befbc54cbd7ad67764e22140af))

### Continuous Integration

* integrate codspeed for benchmark tracking ([e758f3d](https://github.com/visulima/visulima/commit/e758f3da491cc00d3f8bbf10d7ba3fdf8deb5325))

## @visulima/string [3.0.0-alpha.11](https://github.com/visulima/visulima/compare/@visulima/string@3.0.0-alpha.10...@visulima/string@3.0.0-alpha.11) (2026-04-22)

### Bug Fixes

* Remove JSR configuration generation script and generated jsr.json files ([#616](https://github.com/visulima/visulima/issues/616)) ([533744b](https://github.com/visulima/visulima/commit/533744b103b74896941db5b727173e617a27a63b))

### Miscellaneous Chores

* update the jsr.json ([864ab7e](https://github.com/visulima/visulima/commit/864ab7e71c4b5ae82f64792d1ae8debfea2c539b))


### Dependencies

* **@visulima/colorize:** upgraded to 2.0.0-alpha.10

## @visulima/string [3.0.0-alpha.10](https://github.com/visulima/visulima/compare/@visulima/string@3.0.0-alpha.9...@visulima/string@3.0.0-alpha.10) (2026-04-21)

### Bug Fixes

* **data-manipulation:** resolve eslint and formatting issues ([3687b65](https://github.com/visulima/visulima/commit/3687b65d804abe316fad8c3a02ec659bf303332e))
* **data-manipulation:** resolve eslint and type-safety issues ([f1682c2](https://github.com/visulima/visulima/commit/f1682c2611cbcc6c85d4bbea520d43464b42e7ee))
* **string:** cast string result to branded case types ([295e613](https://github.com/visulima/visulima/commit/295e613abfe301ba8e1dc308f5a519bb58d22aff))
* **string:** resolve eslint and formatting issues ([1903c05](https://github.com/visulima/visulima/commit/1903c0531bd481e19488ad4aa7a186a95c181f15))
* **string:** resolve eslint and formatting issues ([c706cfb](https://github.com/visulima/visulima/commit/c706cfb0ebb8a21f287018d393b28f0aa4922601))

### Miscellaneous Chores

* bump engines.node to ^22.14.0 || >=24.10.0 ([c3d0931](https://github.com/visulima/visulima/commit/c3d0931d1504e4f21ebf50ea680cfa7ce4ba15ce))
* fixed jsr.json ([5d85e51](https://github.com/visulima/visulima/commit/5d85e5179de38e284ec433b14d77c71a1619c8d6))
* **string:** apply pending changes ([1d19db3](https://github.com/visulima/visulima/commit/1d19db3db45d060f22028692e677c935e8a36a2e))
* **string:** apply pending lint and source updates ([25b371c](https://github.com/visulima/visulima/commit/25b371c5026b200c87f88f7b424b6d8bd53f901a))

## @visulima/string [3.0.0-alpha.9](https://github.com/visulima/visulima/compare/@visulima/string@3.0.0-alpha.8...@visulima/string@3.0.0-alpha.9) (2026-04-08)

### Features

* **string): native indent implementation; refactor(tui:** replace indent-string and is-fullwidth-code-point ([1368488](https://github.com/visulima/visulima/commit/136848850242ddeae91320dd21d6fdeb0760768c))
* **string:** add east-asian-width, isFullwidthCodePoint exports and fix utilities ([b44e0c5](https://github.com/visulima/visulima/commit/b44e0c5b4e5cff7b39d9148516f7ed510bb35bb6))
* **string:** add indent, strip-indent, dedent, redent, isFullwidthCodePoint, and east-asian-width helpers ([5441f3c](https://github.com/visulima/visulima/commit/5441f3c883256165b36c0d9580bbb44cc36e9a62))

### Bug Fixes

* resolve failing tests across multiple packages ([2b4b6f0](https://github.com/visulima/visulima/commit/2b4b6f04169b60fdc4cf77b293015436a272c0fb))
* **string:** properly fix eslint errors in code ([184b6a3](https://github.com/visulima/visulima/commit/184b6a30bb3d49185f64a0a6d88f693bd61644f9))
* **string:** remove remaining eslint suppressions with proper code fixes ([c2e183e](https://github.com/visulima/visulima/commit/c2e183ed1cdb8fe54d46c5376eca0208a9b65b0f))
* **string:** resolve eslint errors ([18f4366](https://github.com/visulima/visulima/commit/18f43665e335b66f2960b4ebffc510efe9df9b6e))

### Miscellaneous Chores

* **data-manipulation:** remove empty dependency objects from package.json ([c0e8f76](https://github.com/visulima/visulima/commit/c0e8f7689a2da413f771494f6ecb07babc4b5e06))
* **string:** add tsconfig.eslint.json for type-aware linting ([b29661d](https://github.com/visulima/visulima/commit/b29661dc2cf32823f4aff40ac3c7b6a3e12b678e))
* **string:** apply prettier formatting ([ed0e3a1](https://github.com/visulima/visulima/commit/ed0e3a15ff5d387ae4897eb0d4ed8a0a864951c2))
* **string:** migrate .prettierrc.cjs to prettier.config.js ([750ddba](https://github.com/visulima/visulima/commit/750ddba531071ff5b4d74a5e13799630c8d55c27))
* update bundled dependency licenses ([6ace4c6](https://github.com/visulima/visulima/commit/6ace4c69d41fc1fd0a744fbca8ca219ba631b4ab))


### Dependencies

* **@visulima/colorize:** upgraded to 2.0.0-alpha.8

## @visulima/string [3.0.0-alpha.8](https://github.com/visulima/visulima/compare/@visulima/string@3.0.0-alpha.7...@visulima/string@3.0.0-alpha.8) (2026-03-26)

### Features

* **web:** auto-generate packages page from workspace metadata ([623e520](https://github.com/visulima/visulima/commit/623e5207693a7fe720f5f2f179593a3654c880e3))


### Dependencies

* **@visulima/colorize:** upgraded to 2.0.0-alpha.7

## @visulima/string [3.0.0-alpha.7](https://github.com/visulima/visulima/compare/@visulima/string@3.0.0-alpha.6...@visulima/string@3.0.0-alpha.7) (2026-03-26)

### Bug Fixes

* **docs:** correct code examples found during verification ([8e4f8c4](https://github.com/visulima/visulima/commit/8e4f8c4b0b1664c232fe5ae721b771c72d29a152))
* **string:** use workspace:* for internal [@visulima](https://github.com/visulima) deps ([767788d](https://github.com/visulima/visulima/commit/767788de6a58ab0d9980f295829de40a7d19bef8))
* **web:** improve build setup with incremental stats caching and prod install ([fe33e75](https://github.com/visulima/visulima/commit/fe33e75827586779b4b3a0c6d57b39f889ee6207))

### Documentation

* add missing documentation pages for email, string, and storage-client ([623f8af](https://github.com/visulima/visulima/commit/623f8afd2ea03dd2805fb2d7a9d10083571224bb))

### Miscellaneous Chores

* **string:** migrate deps to pnpm catalogs ([ae5e04a](https://github.com/visulima/visulima/commit/ae5e04a8823320f54dd0da351f9168a58fa5926c))
* **string:** update dependencies ([ac1b54e](https://github.com/visulima/visulima/commit/ac1b54e55d33bd1bd381a8d59f664cd7911a4fc3))
* visulima website ([#591](https://github.com/visulima/visulima/issues/591)) ([59ab2e2](https://github.com/visulima/visulima/commit/59ab2e2befb03e51cd2088956f83d9b87de6d033))

### Code Refactoring

* **docs:** migrate Nextra components to fumadocs-ui, remove Nextra stripping ([484878f](https://github.com/visulima/visulima/commit/484878f01879363ef5e9a0282904dc4627d6060c))


### Dependencies

* **@visulima/colorize:** upgraded to 2.0.0-alpha.6

## @visulima/string [3.0.0-alpha.6](https://github.com/visulima/visulima/compare/@visulima/string@3.0.0-alpha.5...@visulima/string@3.0.0-alpha.6) (2026-03-06)

### Bug Fixes

* **string:** update packem to 2.0.0-alpha.54 ([f144f53](https://github.com/visulima/visulima/commit/f144f53ffeddc9baf9dad5624f400ff4c90418a8))

### Miscellaneous Chores

* **data-manipulation:** update dependencies ([49458ab](https://github.com/visulima/visulima/commit/49458ab8f8e17d875840b1b4fe8b5efe12ff3513))
* **string:** update dependencies ([6282b31](https://github.com/visulima/visulima/commit/6282b310839ce1154133fe56468e9d52fc2feb91))
* **string:** update dependencies ([6ff101d](https://github.com/visulima/visulima/commit/6ff101df82e17d1673e47f1195e662b8eff4e04a))
* update lock file maintenance ([d83e716](https://github.com/visulima/visulima/commit/d83e71697b75d24704185b66bb521a934d2db02d))
* year update ([47f4105](https://github.com/visulima/visulima/commit/47f410596ce7190cfea36a073db32e0cec50bbcd))


### Dependencies

* **@visulima/colorize:** upgraded to 2.0.0-alpha.5

## @visulima/string [3.0.0-alpha.5](https://github.com/visulima/visulima/compare/@visulima/string@3.0.0-alpha.4...@visulima/string@3.0.0-alpha.5) (2025-12-27)

### Bug Fixes

* **string:** update package files ([ca22f2e](https://github.com/visulima/visulima/commit/ca22f2efdd044ae20d421f729d185e1e93747cd8))


### Dependencies

* **@visulima/colorize:** upgraded to 2.0.0-alpha.4

## @visulima/string [3.0.0-alpha.4](https://github.com/visulima/visulima/compare/@visulima/string@3.0.0-alpha.3...@visulima/string@3.0.0-alpha.4) (2025-12-13)

### Features

* add string analysis functions for counting occurrences and detecting text direction ([de84ab0](https://github.com/visulima/visulima/commit/de84ab072e36d3fc834dd8d971db46fd62be249a))

### Miscellaneous Chores

* fixed project.json names and schema path ([964722f](https://github.com/visulima/visulima/commit/964722f691db205c7edb9aa6db29e849a647500b))

## @visulima/string [3.0.0-alpha.3](https://github.com/visulima/visulima/compare/@visulima/string@3.0.0-alpha.2...@visulima/string@3.0.0-alpha.3) (2025-12-11)

### Bug Fixes

* update package OG images across multiple packages ([f08e4dd](https://github.com/visulima/visulima/commit/f08e4dd2b105ccb29c8412020a9c2be36d6c1e9e))


### Dependencies

* **@visulima/colorize:** upgraded to 2.0.0-alpha.3

## @visulima/string [3.0.0-alpha.2](https://github.com/visulima/visulima/compare/@visulima/string@3.0.0-alpha.1...@visulima/string@3.0.0-alpha.2) (2025-12-08)

### Features

* added new excerpt functions ([#582](https://github.com/visulima/visulima/issues/582)) ([1f2059f](https://github.com/visulima/visulima/commit/1f2059f79e8655d868cd9183d8645224c0af4fbb))

## @visulima/string [3.0.0-alpha.1](https://github.com/visulima/visulima/compare/@visulima/string@2.0.6...@visulima/string@3.0.0-alpha.1) (2025-12-07)

### ⚠ BREAKING CHANGES

* change min node version to 22.13

### Bug Fixes

* add new package image, fixed readme rendering on npm, fixed building of packages ([b790ba2](https://github.com/visulima/visulima/commit/b790ba253ea07fef83528fd822a678facf021b5f))
* update Node.js engine version requirement to >=22.13 in multiple package.json files for improved compatibility ([b828e9a](https://github.com/visulima/visulima/commit/b828e9aeaebfc798eecddccd90e6ec7560c6d36a))

### Miscellaneous Chores

* moved all packages into groups ([0615e9d](https://github.com/visulima/visulima/commit/0615e9d14a8a886e11da529ce150cf31ca973c10))
* update @anolilab/semantic-release-pnpm and @anolilab/semantic-release-preset to versions 3.2.2 and 12.1.2 across multiple package.json files for improved compatibility ([3921626](https://github.com/visulima/visulima/commit/3921626141fe5da398749bf0ba675f1596f18afb))
* update dependencies across multiple packages to improve compatibility and performance, including upgrading `@anolilab/semantic-release-pnpm` and `@anolilab/semantic-release-preset` to versions 3.2.0 and 12.1.0 respectively, and updating `react`, `react-dom`, and `next` versions to 19.2.1 and 16.0.7 in various package.json files ([aee8fcd](https://github.com/visulima/visulima/commit/aee8fcd796ae9b8d055903260e7150996ea9f53d))

## @visulima/string [2.0.6](https://github.com/visulima/visulima/compare/@visulima/string@2.0.5...@visulima/string@2.0.6) (2025-11-13)

### Bug Fixes

* bump packem, to fix minified version of the code ([2a36ceb](https://github.com/visulima/visulima/commit/2a36ceb09251b0ca1178701a26547a871ed717a7))


### Dependencies

* **@visulima/colorize:** upgraded to 1.4.29

## @visulima/string [2.0.5](https://github.com/visulima/visulima/compare/@visulima/string@2.0.4...@visulima/string@2.0.5) (2025-11-12)

### Bug Fixes

* update package configurations and TypeScript definitions ([b59aa59](https://github.com/visulima/visulima/commit/b59aa59dac1508216b944f4b917fb4a7ab1f70a4))

### Miscellaneous Chores

* Add jsr file to all packages for release ([#565](https://github.com/visulima/visulima/issues/565)) ([ec91652](https://github.com/visulima/visulima/commit/ec91652b4e4112adf14ba152c1239a7703ba425a))
* update license files and clean up TypeScript definitions ([fe668cc](https://github.com/visulima/visulima/commit/fe668cc26de23591d4df54a0954455ebbe31b22d))


### Dependencies

* **@visulima/colorize:** upgraded to 1.4.28

## @visulima/string [2.0.4](https://github.com/visulima/visulima/compare/@visulima/string@2.0.3...@visulima/string@2.0.4) (2025-11-07)

### Bug Fixes

* update TypeScript configurations and improve linting across multiple packages ([6f25ec7](https://github.com/visulima/visulima/commit/6f25ec7841da7246f8f9166efc5292a7089d37ee))

### Miscellaneous Chores

* update npm and pnpm configurations for monorepo optimization ([#564](https://github.com/visulima/visulima/issues/564)) ([5512b42](https://github.com/visulima/visulima/commit/5512b42f672c216b6a3c9e39035199a4ebd9a4b8))


### Dependencies

* **@visulima/colorize:** upgraded to 1.4.27

## @visulima/string [2.0.3](https://github.com/visulima/visulima/compare/@visulima/string@2.0.2...@visulima/string@2.0.3) (2025-11-05)

### Bug Fixes

* added new tests for handling Japanese text in word wrapping functionality. ([c4a7c00](https://github.com/visulima/visulima/commit/c4a7c00a5606e1ab80bdc22538e5a7ea6263250b))
* update dependencies across multiple packages ([36a47f2](https://github.com/visulima/visulima/commit/36a47f26d65d25a7b4d8371186710e7d0ab61a2b))

### Miscellaneous Chores

* update dependencies across multiple packages ([c526462](https://github.com/visulima/visulima/commit/c52646260c2ae8bbf85692e642f305f47a158d4e))


### Dependencies

* **@visulima/colorize:** upgraded to 1.4.26

## @visulima/string [2.0.2](https://github.com/visulima/visulima/compare/@visulima/string@2.0.1...@visulima/string@2.0.2) (2025-10-22)

### Bug Fixes

* **string/truncate:** don't replace single-character strings with the ellipsis ([#559](https://github.com/visulima/visulima/issues/559)) ([91f185d](https://github.com/visulima/visulima/commit/91f185d669240986da883035e59432050058272e))

### Miscellaneous Chores

* update package dependencies and configurations ([7bfe7e7](https://github.com/visulima/visulima/commit/7bfe7e71869580900aab50efb064b4293994ed9a))

## @visulima/string [2.0.1](https://github.com/visulima/visulima/compare/@visulima/string@2.0.0...@visulima/string@2.0.1) (2025-10-21)

### Bug Fixes

* allow node v25 and updated dev deps ([8158cc5](https://github.com/visulima/visulima/commit/8158cc53ec92bd0331e8c6bd0fcbc8ab61b9320f))

### Miscellaneous Chores

* **deps:** update package versions and dependencies ([88d8d32](https://github.com/visulima/visulima/commit/88d8d32c4629a7a06c8770369191da2cc81087cc))
* update package dependencies across multiple packages ([17e3f23](https://github.com/visulima/visulima/commit/17e3f2377c8a3f98e2eed2192c5adaf6e32558b5))


### Dependencies

* **@visulima/colorize:** upgraded to 1.4.25

## @visulima/string [2.0.0](https://github.com/visulima/visulima/compare/@visulima/string@1.5.2...@visulima/string@2.0.0) (2025-10-15)

### ⚠ BREAKING CHANGES

* Adjusted the node engine requirement to support versions 20.19 and above

### Bug Fixes

* Adjusted the node engine requirement to support versions 20.19 and above ([7a2a2c0](https://github.com/visulima/visulima/commit/7a2a2c003a3627ee3052095b5624e6bf20db28d9))
* update @visulima/packem to 2.0.0-alpha.32 across multiple packages for improved compatibility ([27b346e](https://github.com/visulima/visulima/commit/27b346eaa1c0fb0e420d9a9824482028307f4249))

### Miscellaneous Chores

* update linting commands and dependencies for improved performance ([73250f6](https://github.com/visulima/visulima/commit/73250f65dd2296ddfb39e12408009e7554b4f801))
* update package.json and pnpm-lock.yaml to include publint@0.3.12 and adjust build/test commands to exclude shared-utils ([1f7b3c0](https://github.com/visulima/visulima/commit/1f7b3c0381d77edfeec80ea1bf57b3469e929414))


### Dependencies

* **@visulima/colorize:** upgraded to 1.4.24

## @visulima/string [1.5.2](https://github.com/visulima/visulima/compare/@visulima/string@1.5.1...@visulima/string@1.5.2) (2025-09-12)

### Bug Fixes

* **tests:** update assertion count in TypeScript interface test to reflect expected behavior ([a45d095](https://github.com/visulima/visulima/commit/a45d095af4e4d4bcd84e56691315288ceb21896f))

### Miscellaneous Chores

* update dependencies and fix linting issues ([0e802fe](https://github.com/visulima/visulima/commit/0e802fe02bb9ed791659cb5f3c77605ae5b42ec8))

## @visulima/string [1.5.1](https://github.com/visulima/visulima/compare/@visulima/string@1.5.0...@visulima/string@1.5.1) (2025-06-04)


### Dependencies

* **@visulima/colorize:** upgraded to 1.4.23

## @visulima/string [1.5.0](https://github.com/visulima/visulima/compare/@visulima/string@1.4.1...@visulima/string@1.5.0) (2025-06-03)

### Features

* **string:** added new functions closestString, compareSimilarity and wordSimilaritySort, added new exports to the package.json ([4f01ec4](https://github.com/visulima/visulima/commit/4f01ec4b0cc8863c6bbb591ac14c895c143e65d2))

## @visulima/string [1.4.1](https://github.com/visulima/visulima/compare/@visulima/string@1.4.0...@visulima/string@1.4.1) (2025-05-31)

### Bug Fixes

* **string:** add align-text and word-wrap modules to package.json ([6c9db17](https://github.com/visulima/visulima/commit/6c9db174387e9da6bd5f99b6e4e48c12aa19b313))

## @visulima/string [1.4.0](https://github.com/visulima/visulima/compare/@visulima/string@1.3.0...@visulima/string@1.4.0) (2025-05-31)

### Features

* **string:** implement BREAK_WORDS wrap mode for word wrapping functionality ([996b9aa](https://github.com/visulima/visulima/commit/996b9aa1ed0b728534558bad5b88e6e1ea505a05))

## @visulima/string [1.3.0](https://github.com/visulima/visulima/compare/@visulima/string@1.2.3...@visulima/string@1.3.0) (2025-05-31)

### Features

* **string:** add alignText function for text alignment and create unit tests ([688d1c4](https://github.com/visulima/visulima/commit/688d1c4056f9ef93484f9780c02b83b4507241f7))

### Miscellaneous Chores

* **string:** update package.json to add new alignment keywords and modify build scripts ([03365cf](https://github.com/visulima/visulima/commit/03365cf3b1b533e9e0ba497b8e278b8065f7bca7))
* **string:** updated readme ([54dd1ff](https://github.com/visulima/visulima/commit/54dd1ff16a13bf1ed100b46b7c8628cbca152d96))

## @visulima/string [1.2.3](https://github.com/visulima/visulima/compare/@visulima/string@1.2.2...@visulima/string@1.2.3) (2025-05-30)

### Bug Fixes

* **string:** move postinstall scrip into a command ([af74390](https://github.com/visulima/visulima/commit/af743905042ece78028b2e2b1205898e4d8fc72d))
* **string:** update dependencies ([f19d726](https://github.com/visulima/visulima/commit/f19d7267f689c9e45064aacdd19033c19e9c3a5a))

### Styles

* cs fixes ([6570d56](https://github.com/visulima/visulima/commit/6570d568a80bd3fd4bfd73c824dc78f7e3a372f8))

### Miscellaneous Chores

* **string-bench:** update devDependencies ([e316f82](https://github.com/visulima/visulima/commit/e316f829b2e0917138cca678ecd2094fe7f8d532))
* **string:** update dependencies in package.json and adjust test cases for string width calculations ([96b28e4](https://github.com/visulima/visulima/commit/96b28e46eb977b5f11be0adf13116ef318fea022))


### Dependencies

* **@visulima/colorize:** upgraded to 1.4.22

## @visulima/string [1.2.2](https://github.com/visulima/visulima/compare/@visulima/string@1.2.1...@visulima/string@1.2.2) (2025-05-07)

### Bug Fixes

* **string:** add new keywords, extended slug benchmarks ([71c02b0](https://github.com/visulima/visulima/commit/71c02b047731694c6246a6365f061880c07d1071))

## @visulima/string [1.2.1](https://github.com/visulima/visulima/compare/@visulima/string@1.2.0...@visulima/string@1.2.1) (2025-05-07)

### Bug Fixes

* **string:** fixed Thai transliteration support ([84aab42](https://github.com/visulima/visulima/commit/84aab427a6248725d71f475bddb45dcbf64d470e))

## @visulima/string [1.2.0](https://github.com/visulima/visulima/compare/@visulima/string@1.1.0...@visulima/string@1.2.0) (2025-05-07)

### Features

* added transliterate, slugify and replaceString ([#502](https://github.com/visulima/visulima/issues/502)) ([d2b1918](https://github.com/visulima/visulima/commit/d2b1918dd9ed87584ed3c05b11aceca581437c89))

## @visulima/string [1.1.0](https://github.com/visulima/visulima/compare/@visulima/string@1.0.5...@visulima/string@1.1.0) (2025-05-04)

### Features

* **string:** enhance identifyCase function to support additional cases ([#501](https://github.com/visulima/visulima/issues/501)) ([8f8ecee](https://github.com/visulima/visulima/commit/8f8eceefef3f4ce332eb702979291a4db010256c))

## @visulima/string [1.0.5](https://github.com/visulima/visulima/compare/@visulima/string@1.0.4...@visulima/string@1.0.5) (2025-05-02)

### Bug Fixes

* **string:** update string width calculations for ellipsis and control characters, remove ambiguousWidth ([bf8a2de](https://github.com/visulima/visulima/commit/bf8a2de06429a229b5bdb17cadd8239243a55e0d))

## @visulima/string [1.0.4](https://github.com/visulima/visulima/compare/@visulima/string@1.0.3...@visulima/string@1.0.4) (2025-05-01)

### Bug Fixes

* **string:** enhance handling of box-drawing characters in string width calculations ([6d1d83a](https://github.com/visulima/visulima/commit/6d1d83a6823d90f9104363a91e8add7e0557fc27))

## @visulima/string [1.0.3](https://github.com/visulima/visulima/compare/@visulima/string@1.0.2...@visulima/string@1.0.3) (2025-04-29)

### Bug Fixes

* enhance string width calculations and handling of ANSI sequences ([#497](https://github.com/visulima/visulima/issues/497)) ([fb650f7](https://github.com/visulima/visulima/commit/fb650f7169d7e9a7aa79123282ff7f4ff5c6693c))

## @visulima/string [1.0.2](https://github.com/visulima/visulima/compare/@visulima/string@1.0.1...@visulima/string@1.0.2) (2025-03-22)

### Bug Fixes

* changed ellipsis size from 2 to 1, witch was wrong before ([3002cce](https://github.com/visulima/visulima/commit/3002cce3ba4b7702dab60db4bb15b1e1bbe5cf0f))

## @visulima/string [1.0.1](https://github.com/visulima/visulima/compare/@visulima/string@1.0.0...@visulima/string@1.0.1) (2025-03-21)

### Bug Fixes

* fixed forgotten test change after adjustment ([59b8953](https://github.com/visulima/visulima/commit/59b8953a2aefdb4b6f919039e67809146df6a22e))
* fixed handling of wrong width calc on the slice ([199c6dd](https://github.com/visulima/visulima/commit/199c6dd57b33b751c067e7a964406583ade5dd28))

## @visulima/string 1.0.0 (2025-03-21)

### Features

* adding new string lib ([#491](https://github.com/visulima/visulima/issues/491)) ([9d92c28](https://github.com/visulima/visulima/commit/9d92c282ca3f6ce198bbdff11e0ff50f58ae9c84))
