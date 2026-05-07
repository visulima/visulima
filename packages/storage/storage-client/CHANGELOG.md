## @visulima/storage-client [1.0.0-alpha.13](https://github.com/visulima/visulima/compare/@visulima/storage-client@1.0.0-alpha.12...@visulima/storage-client@1.0.0-alpha.13) (2026-05-07)

### Bug Fixes

* **storage-client:** guard chunked upload interval against post-teardown ticks ([25e42f7](https://github.com/visulima/visulima/commit/25e42f79184e079b26c0cd49662794f13d4157e4))

### Miscellaneous Chores

* re-sort workspace package.json files via vis sort-package-json ([f625696](https://github.com/visulima/visulima/commit/f625696cfac974325774b3243e1a83c3d23acbd7))
* simplify pnpm-workspace packages list ([7cab221](https://github.com/visulima/visulima/commit/7cab221163632d9b7aa044a6f88c49083103a869))
* **storage-client:** apply error/template fixes to svelte primitives ([2d67f0f](https://github.com/visulima/visulima/commit/2d67f0fd678f9504ddab68544ed759564f9fd95f))
* **storage-client:** apply partial lint cleanup from agent batch ([cea27fc](https://github.com/visulima/visulima/commit/cea27fc10dd09bcf9ce1089d4f70a0305b52afb1))
* **storage-client:** apply prettier and eslint quote-style auto-fix ([bbbe262](https://github.com/visulima/visulima/commit/bbbe262f98472b84b7e43f0d17ce7b5bc8e4bfb4))
* **storage-client:** bump @tanstack/* and solid-js peer ranges ([5669c5d](https://github.com/visulima/visulima/commit/5669c5d37640441a685f177613e3a396675ff59d))
* **storage-client:** clean up lint errors in core adapters ([7b50237](https://github.com/visulima/visulima/commit/7b5023727639bb65f2fc0f36cdd447345ab70fbd))
* **storage-client:** clean up svelte primitive lint warnings ([0dd6fd5](https://github.com/visulima/visulima/commit/0dd6fd56b68b62496b9ee50e55bc9df9ddcde7ef))
* **storage-client:** clear remaining lint errors in tests ([edda1fa](https://github.com/visulima/visulima/commit/edda1faf39234dad14e86683236d7473820f111c))
* **storage-client:** clear remaining solid lint warnings ([23620d6](https://github.com/visulima/visulima/commit/23620d6610cc51a911ae0be2f1f84b460db1492c))
* **storage-client:** finish lint cleanup across framework hooks ([fc2c2bf](https://github.com/visulima/visulima/commit/fc2c2bf66191083cc401fd896a99af2ec61589d3))
* **storage-client:** fix lint in react query hooks ([d471f00](https://github.com/visulima/visulima/commit/d471f00eccaec04d0a5b103958d0965ca008747a))
* **storage-client:** fix lint in solid query primitives ([15f094d](https://github.com/visulima/visulima/commit/15f094d038f9fdcf666e436c58a22ad6ef0b7c7b))
* **storage-client:** fix lint in use-batch-delete-files ([d212548](https://github.com/visulima/visulima/commit/d212548838e006864d2af0083950d8b63a618f73))
* **storage-client:** fix lint in vue query composables ([e39d6d3](https://github.com/visulima/visulima/commit/e39d6d30eca3e4daef6d6b3fad975bc333561be6))
* **storage-client:** refactor svelte create-upload picker logic ([ccd096b](https://github.com/visulima/visulima/commit/ccd096b18a821a2b0589e9d56b1802e202056cd2))
* **storage-client:** simplify svelte error/data store derivations ([ee6dcbf](https://github.com/visulima/visulima/commit/ee6dcbf53d692d183b3f6a41d2d69065d6112159))
* **storage-client:** upgrade packem to 2.0.0-alpha.76 ([4963a7d](https://github.com/visulima/visulima/commit/4963a7d640d82f8733fb54a947fcf3e7395b5bbf))

## @visulima/storage-client [1.0.0-alpha.12](https://github.com/visulima/visulima/compare/@visulima/storage-client@1.0.0-alpha.11...@visulima/storage-client@1.0.0-alpha.12) (2026-04-22)

### Bug Fixes

* Remove JSR configuration generation script and generated jsr.json files ([#616](https://github.com/visulima/visulima/issues/616)) ([533744b](https://github.com/visulima/visulima/commit/533744b103b74896941db5b727173e617a27a63b))

### Miscellaneous Chores

* bump engines.node to ^22.14.0 || >=24.10.0 ([c3d0931](https://github.com/visulima/visulima/commit/c3d0931d1504e4f21ebf50ea680cfa7ce4ba15ce))
* fixed jsr.json ([5d85e51](https://github.com/visulima/visulima/commit/5d85e5179de38e284ec433b14d77c71a1619c8d6))

## @visulima/storage-client [1.0.0-alpha.11](https://github.com/visulima/visulima/compare/@visulima/storage-client@1.0.0-alpha.10...@visulima/storage-client@1.0.0-alpha.11) (2026-04-15)

### Bug Fixes

* **storage-client:** exclude tests from tsconfig include ([438ab1d](https://github.com/visulima/visulima/commit/438ab1d8da0407e9dfa8010a7ce3446a9c402ba1))

### Code Refactoring

* **storage:** format code with prettier ([21477ce](https://github.com/visulima/visulima/commit/21477ce4354f83f68fbcbd11e07621e3329357e2))

## @visulima/storage-client [1.0.0-alpha.10](https://github.com/visulima/visulima/compare/@visulima/storage-client@1.0.0-alpha.9...@visulima/storage-client@1.0.0-alpha.10) (2026-04-08)

### Bug Fixes

* remove deprecated baseUrl and downlevelIteration from tsconfigs ([a708366](https://github.com/visulima/visulima/commit/a708366b5c3bc73cfde480a712ed397bd921fb93))

### Miscellaneous Chores

* **storage-client:** add tsconfig.eslint.json for type-aware linting ([1186874](https://github.com/visulima/visulima/commit/1186874ad63ee5425715cc4d3b6478f0ea0a40a9))
* **storage-client:** apply prettier formatting ([276d731](https://github.com/visulima/visulima/commit/276d731dc9a4acc60522c65dc8cf4ec6095beaa5))
* **storage-client:** migrate .prettierrc.cjs to prettier.config.js ([e4e463b](https://github.com/visulima/visulima/commit/e4e463b3a2246062891db1a4bcbc967781e0e14f))
* **storage:** remove empty dependency objects from package.json ([ddfeb08](https://github.com/visulima/visulima/commit/ddfeb08fd392ad2553a1ce833dd331540ecc8b09))

## @visulima/storage-client [1.0.0-alpha.9](https://github.com/visulima/visulima/compare/@visulima/storage-client@1.0.0-alpha.8...@visulima/storage-client@1.0.0-alpha.9) (2026-03-26)

### Features

* **web:** auto-generate packages page from workspace metadata ([623e520](https://github.com/visulima/visulima/commit/623e5207693a7fe720f5f2f179593a3654c880e3))

## @visulima/storage-client [1.0.0-alpha.8](https://github.com/visulima/visulima/compare/@visulima/storage-client@1.0.0-alpha.7...@visulima/storage-client@1.0.0-alpha.8) (2026-03-26)

### Bug Fixes

* **docs:** correct code examples found during verification ([8e4f8c4](https://github.com/visulima/visulima/commit/8e4f8c4b0b1664c232fe5ae721b771c72d29a152))
* **storage-client:** guard setInterval against unmounted component and migrate deps to pnpm catalogs ([a6618bc](https://github.com/visulima/visulima/commit/a6618bc7b3f866592a73ba79bf310ffe272f253a))
* **storage-client:** resolve TanStack Query v5.94+ source-only packages in tests ([1c1b39f](https://github.com/visulima/visulima/commit/1c1b39fd4b259768ffd5b18eb676a146ce5bfb40))
* updated deps and migrated web app build deps to pnpm catalog ([dd4f515](https://github.com/visulima/visulima/commit/dd4f5153a07d0e46de0b3fc091878d66bb70f2d3))
* **web:** improve build setup with incremental stats caching and prod install ([fe33e75](https://github.com/visulima/visulima/commit/fe33e75827586779b4b3a0c6d57b39f889ee6207))

### Documentation

* add missing documentation pages for email, string, and storage-client ([623f8af](https://github.com/visulima/visulima/commit/623f8afd2ea03dd2805fb2d7a9d10083571224bb))

### Miscellaneous Chores

* **storage-client:** update dependencies ([7976708](https://github.com/visulima/visulima/commit/7976708758d06d3424a0a659b7f074cd25f9b1b9))
* visulima website ([#591](https://github.com/visulima/visulima/issues/591)) ([59ab2e2](https://github.com/visulima/visulima/commit/59ab2e2befb03e51cd2088956f83d9b87de6d033))

### Code Refactoring

* **storage-client:** replace vite-tsconfig-paths with native Vite 8 resolve.tsconfigPaths ([7d528f1](https://github.com/visulima/visulima/commit/7d528f1a6d3b1b9ec93c891e89af7bdbf78d090c))

## @visulima/storage-client [1.0.0-alpha.7](https://github.com/visulima/visulima/compare/@visulima/storage-client@1.0.0-alpha.6...@visulima/storage-client@1.0.0-alpha.7) (2026-03-06)

### Bug Fixes

* **storage-client:** update packem to 2.0.0-alpha.54 ([98984dd](https://github.com/visulima/visulima/commit/98984dd6f3c9d7b007a4ae723d80f27cd1cce1cc))

### Miscellaneous Chores

* **storage-client:** update dependencies ([df3b47d](https://github.com/visulima/visulima/commit/df3b47dc7d961dd242b460384cbb26f91048548f))
* year update ([47f4105](https://github.com/visulima/visulima/commit/47f410596ce7190cfea36a073db32e0cec50bbcd))

## @visulima/storage-client [1.0.0-alpha.6](https://github.com/visulima/visulima/compare/@visulima/storage-client@1.0.0-alpha.5...@visulima/storage-client@1.0.0-alpha.6) (2026-02-16)

### Bug Fixes

* **storage-client:** prevent state updates after component unmount in useTusUpload ([e40716e](https://github.com/visulima/visulima/commit/e40716e3389c63c609b9f0464e1fad6959d69e20))

### Miscellaneous Chores

* **storage:** update dependencies ([f591768](https://github.com/visulima/visulima/commit/f591768de337c1b201191e4b78dd7e3fb79ca42b))
* update lock file maintenance ([d83e716](https://github.com/visulima/visulima/commit/d83e71697b75d24704185b66bb521a934d2db02d))

## @visulima/storage-client [1.0.0-alpha.5](https://github.com/visulima/visulima/compare/@visulima/storage-client@1.0.0-alpha.4...@visulima/storage-client@1.0.0-alpha.5) (2026-01-17)

### Bug Fixes

* added removed Svelte ([d78857a](https://github.com/visulima/visulima/commit/d78857a4b62020a38db38db568ebe54fc9bf7b05))

### Miscellaneous Chores

* **storage-client:** update dependencies ([733b7b3](https://github.com/visulima/visulima/commit/733b7b3f929114e769436633ceb9b4923a289257))

## @visulima/storage-client [1.0.0-alpha.4](https://github.com/visulima/visulima/compare/@visulima/storage-client@1.0.0-alpha.3...@visulima/storage-client@1.0.0-alpha.4) (2025-12-27)

### Bug Fixes

* **storage-client:** update @testing-library/svelte to version 5.3.1 and improve README for Svelte support ([43e8ea5](https://github.com/visulima/visulima/commit/43e8ea5b01399d5dd0f98882629bceedd411e710))
* **storage-client:** update package files ([ba9d079](https://github.com/visulima/visulima/commit/ba9d079a5b25169e88836fd23af13796250452b1))

### Miscellaneous Chores

* **dependencies:** update file-type to version 21.2.0, hono to version 4.11.3, and improve README for storage-client with detailed usage examples ([90bebfa](https://github.com/visulima/visulima/commit/90bebfa9b732afd8d80c133ca0636192b8496801))
* fixed project.json names and schema path ([964722f](https://github.com/visulima/visulima/commit/964722f691db205c7edb9aa6db29e849a647500b))

## @visulima/storage-client [1.0.0-alpha.3](https://github.com/visulima/visulima/compare/@visulima/storage-client@1.0.0-alpha.2...@visulima/storage-client@1.0.0-alpha.3) (2025-12-11)

### Bug Fixes

* update package OG images across multiple packages ([f08e4dd](https://github.com/visulima/visulima/commit/f08e4dd2b105ccb29c8412020a9c2be36d6c1e9e))

## @visulima/storage-client [1.0.0-alpha.2](https://github.com/visulima/visulima/compare/@visulima/storage-client@1.0.0-alpha.1...@visulima/storage-client@1.0.0-alpha.2) (2025-12-06)

### Bug Fixes

* add new package image, fixed readme rendering on npm, fixed building of packages ([b790ba2](https://github.com/visulima/visulima/commit/b790ba253ea07fef83528fd822a678facf021b5f))

### Miscellaneous Chores

* **release:** @visulima/storage-client@1.0.0-alpha.1 [skip ci]\n\n## @visulima/storage-client 1.0.0-alpha.1 (2025-12-05) ([9145099](https://github.com/visulima/visulima/commit/9145099002a34b52837b39172507108ebe7a8756))
* **release:** @visulima/storage-client@1.0.0-alpha.1 [skip ci]\n\n## @visulima/storage-client 1.0.0-alpha.1 (2025-12-05) ([719c655](https://github.com/visulima/visulima/commit/719c655552f3543f7cf787f676043efec314692a))
* update @anolilab/semantic-release-pnpm and @anolilab/semantic-release-preset to versions 3.2.2 and 12.1.2 across multiple package.json files for improved compatibility ([3921626](https://github.com/visulima/visulima/commit/3921626141fe5da398749bf0ba675f1596f18afb))
* update CHANGELOG.md to remove duplicate entries and streamline release notes for @visulima/storage-client ([3358ac0](https://github.com/visulima/visulima/commit/3358ac0199534efdebf5b86faa1852bd064f362f))

## @visulima/storage-client 1.0.0-alpha.1 (2025-12-05)

### ⚠ BREAKING CHANGES

* change min node version to 22.13

### Bug Fixes

* update Node.js engine version requirement to >=22.13 in multiple package.json files for improved compatibility ([b828e9a](https://github.com/visulima/visulima/commit/b828e9aeaebfc798eecddccd90e6ec7560c6d36a))

### Miscellaneous Chores

* moved all packages into groups ([0615e9d](https://github.com/visulima/visulima/commit/0615e9d14a8a886e11da529ce150cf31ca973c10))
* **release:** @visulima/storage-client@1.0.0-alpha.1 [skip ci]\n\n## @visulima/storage-client 1.0.0-alpha.1 (2025-12-04) ([d2baf1c](https://github.com/visulima/visulima/commit/d2baf1cb65b9c3bc2b892c91eb25f2097a8b52b9))
* **release:** @visulima/storage-client@1.0.0-alpha.1 [skip ci]\n\n## @visulima/storage-client 1.0.0-alpha.1 (2025-12-05) ([719c655](https://github.com/visulima/visulima/commit/719c655552f3543f7cf787f676043efec314692a))
* update dependencies across multiple packages to improve compatibility and performance, including upgrading `@anolilab/semantic-release-pnpm` and `@anolilab/semantic-release-preset` to versions 3.2.0 and 12.1.0 respectively, and updating `react`, `react-dom`, and `next` versions to 19.2.1 and 16.0.7 in various package.json files ([aee8fcd](https://github.com/visulima/visulima/commit/aee8fcd796ae9b8d055903260e7150996ea9f53d))
* update @visulima/packem version to 2.0.0-alpha.40 across multiple packages ([e5be373](https://github.com/visulima/visulima/commit/e5be373fef8f8dda20c1dee7a1ac30d9b7a7712e))
* update package dependencies and versions across multiple packages ([9a9ac80](https://github.com/visulima/visulima/commit/9a9ac8046f7138cf37bec9e2041bc2125e97f212))
