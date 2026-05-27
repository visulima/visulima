## @visulima/fmt [2.0.0-alpha.11](https://github.com/visulima/visulima/compare/@visulima/fmt@2.0.0-alpha.10...@visulima/fmt@2.0.0-alpha.11) (2026-05-27)

### Bug Fixes

* **storage-client:** percent-encode user fields in defaultFingerprint ([7c78a0f](https://github.com/visulima/visulima/commit/7c78a0f9512e2a673b941d80839e9f1e86b7b5d0))

### Miscellaneous Chores

* **ci-stability:** green CI across vis, native, lint, tests, attw ([#651](https://github.com/visulima/visulima/issues/651)) ([d4eb684](https://github.com/visulima/visulima/commit/d4eb684b5f75c818c9251048c605a0ed54a268e3))
* **fmt:** housekeeping cleanup ([e7c78e7](https://github.com/visulima/visulima/commit/e7c78e769fac5174d21806a0a90fc816884fba24))
* **fmt:** upgrade packem to 2.0.0-alpha.76 ([a138bde](https://github.com/visulima/visulima/commit/a138bdedc81c831a1729ee412081e0dbce2df36f))
* sorted package.json ([b47c545](https://github.com/visulima/visulima/commit/b47c545591600fdab17d5cd3a3fbc68b61e199da))
* **terminal:** apply prettier and eslint formatting sweep ([15fd89c](https://github.com/visulima/visulima/commit/15fd89c677eea60866e08e4fd5f5a6bc8f3bd2e5))

### Tests

* **repo:** add dist runtime + types integration tests ([32ee300](https://github.com/visulima/visulima/commit/32ee300b7184117a0ddf9f9d390f75f8932d5ed9))

### Continuous Integration

* integrate codspeed for benchmark tracking ([e758f3d](https://github.com/visulima/visulima/commit/e758f3da491cc00d3f8bbf10d7ba3fdf8deb5325))

## @visulima/fmt [2.0.0-alpha.10](https://github.com/visulima/visulima/compare/@visulima/fmt@2.0.0-alpha.9...@visulima/fmt@2.0.0-alpha.10) (2026-04-22)

### Bug Fixes

* Remove JSR configuration generation script and generated jsr.json files ([#616](https://github.com/visulima/visulima/issues/616)) ([533744b](https://github.com/visulima/visulima/commit/533744b103b74896941db5b727173e617a27a63b))

### Miscellaneous Chores

* bump engines.node to ^22.14.0 || >=24.10.0 ([c3d0931](https://github.com/visulima/visulima/commit/c3d0931d1504e4f21ebf50ea680cfa7ce4ba15ce))
* fixed jsr.json ([5d85e51](https://github.com/visulima/visulima/commit/5d85e5179de38e284ec433b14d77c71a1619c8d6))
* **fmt:** apply pending changes ([587102a](https://github.com/visulima/visulima/commit/587102a3ebdfe4aaf965f4277c1bf7a9f96f6084))

## @visulima/fmt [2.0.0-alpha.9](https://github.com/visulima/visulima/compare/@visulima/fmt@2.0.0-alpha.8...@visulima/fmt@2.0.0-alpha.9) (2026-04-15)

### Bug Fixes

* **fmt:** export CssObject type and type previousCss explicitly ([e1e7e53](https://github.com/visulima/visulima/commit/e1e7e5357c9920945d3cbe49f073291f1f104208))
* **terminal:** resolve eslint and formatting issues ([8f30389](https://github.com/visulima/visulima/commit/8f30389deb9ff81e7afce0aa064ef11fcb179f23))

## @visulima/fmt [2.0.0-alpha.8](https://github.com/visulima/visulima/compare/@visulima/fmt@2.0.0-alpha.7...@visulima/fmt@2.0.0-alpha.8) (2026-04-08)

### Bug Fixes

* **fmt:** resolve eslint errors ([45181b2](https://github.com/visulima/visulima/commit/45181b24520bcb2ee766497e677f7fcd6f8182d8))

### Miscellaneous Chores

* **fmt:** add tsconfig.eslint.json for type-aware linting ([d47f7c0](https://github.com/visulima/visulima/commit/d47f7c0068c69d0f9de86c2d6653ba5d3b55ab48))
* **fmt:** apply prettier formatting ([1e9c241](https://github.com/visulima/visulima/commit/1e9c241d498a92740cb9d6b5ff040d200738669a))
* **fmt:** migrate .prettierrc.cjs to prettier.config.js ([c699d91](https://github.com/visulima/visulima/commit/c699d916dd5c9a00bcec10f2ae073774d932cb3d))
* **terminal:** remove empty dependency objects from package.json ([562c704](https://github.com/visulima/visulima/commit/562c704e5d90aa2d13eae942ebbdcfeb787c2b46))

## @visulima/fmt [2.0.0-alpha.7](https://github.com/visulima/visulima/compare/@visulima/fmt@2.0.0-alpha.6...@visulima/fmt@2.0.0-alpha.7) (2026-03-26)

### Features

* **web:** auto-generate packages page from workspace metadata ([623e520](https://github.com/visulima/visulima/commit/623e5207693a7fe720f5f2f179593a3654c880e3))

### Miscellaneous Chores

* update homepage URLs to visulima.com/packages/ format ([be42968](https://github.com/visulima/visulima/commit/be42968129df85fb074224435e33135ff44cab91))

## @visulima/fmt [2.0.0-alpha.6](https://github.com/visulima/visulima/compare/@visulima/fmt@2.0.0-alpha.5...@visulima/fmt@2.0.0-alpha.6) (2026-03-26)

### Bug Fixes

* **web:** improve build setup with incremental stats caching and prod install ([fe33e75](https://github.com/visulima/visulima/commit/fe33e75827586779b4b3a0c6d57b39f889ee6207))

### Miscellaneous Chores

* **fmt:** migrate deps to pnpm catalogs ([92bf4f0](https://github.com/visulima/visulima/commit/92bf4f07f6e64923f5739bd4cfe0d84349f17752))
* **fmt:** update dependencies ([3e7b109](https://github.com/visulima/visulima/commit/3e7b1098a0403211311e49bc9e22c7523c39cfc7))
* visulima website ([#591](https://github.com/visulima/visulima/issues/591)) ([59ab2e2](https://github.com/visulima/visulima/commit/59ab2e2befb03e51cd2088956f83d9b87de6d033))

### Code Refactoring

* **docs:** migrate Nextra components to fumadocs-ui, remove Nextra stripping ([484878f](https://github.com/visulima/visulima/commit/484878f01879363ef5e9a0282904dc4627d6060c))

## @visulima/fmt [2.0.0-alpha.5](https://github.com/visulima/visulima/compare/@visulima/fmt@2.0.0-alpha.4...@visulima/fmt@2.0.0-alpha.5) (2026-03-06)

### Bug Fixes

* **fmt:** update packem to 2.0.0-alpha.54 ([78a1680](https://github.com/visulima/visulima/commit/78a1680cde1175bd5867b21bda9b732a9acdc6aa))

### Documentation

* **bytes,deep-clone,ansi,fmt,find-cache-dir:** add comprehensive Fumadocs documentation ([dfe0116](https://github.com/visulima/visulima/commit/dfe0116ebd26fe38f94f77b8ed4dadc3ff45ba91))

### Miscellaneous Chores

* **fmt:** update dependencies ([4a8264c](https://github.com/visulima/visulima/commit/4a8264c88fb9dbb3c05044a1cb9e739e47b6d179))
* **fmt:** update dependencies ([17eded3](https://github.com/visulima/visulima/commit/17eded3dc12040ecfb92ad675f99d5eccee74245))
* **terminal:** update dependencies ([a5bb91a](https://github.com/visulima/visulima/commit/a5bb91a66f2be2ade485d586156a54c347a23cc9))
* update lock file maintenance ([d83e716](https://github.com/visulima/visulima/commit/d83e71697b75d24704185b66bb521a934d2db02d))
* year update ([47f4105](https://github.com/visulima/visulima/commit/47f410596ce7190cfea36a073db32e0cec50bbcd))

## @visulima/fmt [2.0.0-alpha.4](https://github.com/visulima/visulima/compare/@visulima/fmt@2.0.0-alpha.3...@visulima/fmt@2.0.0-alpha.4) (2025-12-27)

### Bug Fixes

* **fmt:** update package files ([d8a3655](https://github.com/visulima/visulima/commit/d8a36557d4a7ad72645d8ad96118ee0bd09ddd39))

### Miscellaneous Chores

* fixed project.json names and schema path ([964722f](https://github.com/visulima/visulima/commit/964722f691db205c7edb9aa6db29e849a647500b))

## @visulima/fmt [2.0.0-alpha.3](https://github.com/visulima/visulima/compare/@visulima/fmt@2.0.0-alpha.2...@visulima/fmt@2.0.0-alpha.3) (2025-12-11)

### Bug Fixes

* update package OG images across multiple packages ([f08e4dd](https://github.com/visulima/visulima/commit/f08e4dd2b105ccb29c8412020a9c2be36d6c1e9e))

## @visulima/fmt [2.0.0-alpha.2](https://github.com/visulima/visulima/compare/@visulima/fmt@2.0.0-alpha.1...@visulima/fmt@2.0.0-alpha.2) (2025-12-06)

### Bug Fixes

* add new package image, fixed readme rendering on npm, fixed building of packages ([b790ba2](https://github.com/visulima/visulima/commit/b790ba253ea07fef83528fd822a678facf021b5f))

### Miscellaneous Chores

* update @anolilab/semantic-release-pnpm and @anolilab/semantic-release-preset to versions 3.2.2 and 12.1.2 across multiple package.json files for improved compatibility ([3921626](https://github.com/visulima/visulima/commit/3921626141fe5da398749bf0ba675f1596f18afb))

## @visulima/fmt [2.0.0-alpha.1](https://github.com/visulima/visulima/compare/@visulima/fmt@1.1.21...@visulima/fmt@2.0.0-alpha.1) (2025-12-04)

### ⚠ BREAKING CHANGES

* change min node version to 22.13

### Bug Fixes

* update Node.js engine version requirement to >=22.13 in multiple package.json files for improved compatibility ([b828e9a](https://github.com/visulima/visulima/commit/b828e9aeaebfc798eecddccd90e6ec7560c6d36a))

### Miscellaneous Chores

* moved all packages into groups ([0615e9d](https://github.com/visulima/visulima/commit/0615e9d14a8a886e11da529ce150cf31ca973c10))
* update dependencies across multiple packages to improve compatibility and performance, including upgrading `@anolilab/semantic-release-pnpm` and `@anolilab/semantic-release-preset` to versions 3.2.0 and 12.1.0 respectively, and updating `react`, `react-dom`, and `next` versions to 19.2.1 and 16.0.7 in various package.json files ([aee8fcd](https://github.com/visulima/visulima/commit/aee8fcd796ae9b8d055903260e7150996ea9f53d))

## @visulima/fmt [1.1.21](https://github.com/visulima/visulima/compare/@visulima/fmt@1.1.20...@visulima/fmt@1.1.21) (2025-11-13)

### Bug Fixes

* bump packem, to fix minified version of the code ([2a36ceb](https://github.com/visulima/visulima/commit/2a36ceb09251b0ca1178701a26547a871ed717a7))

## @visulima/fmt [1.1.20](https://github.com/visulima/visulima/compare/@visulima/fmt@1.1.19...@visulima/fmt@1.1.20) (2025-11-12)

### Bug Fixes

* update package configurations and TypeScript definitions ([b59aa59](https://github.com/visulima/visulima/commit/b59aa59dac1508216b944f4b917fb4a7ab1f70a4))

### Miscellaneous Chores

* Add jsr file to all packages for release ([#565](https://github.com/visulima/visulima/issues/565)) ([ec91652](https://github.com/visulima/visulima/commit/ec91652b4e4112adf14ba152c1239a7703ba425a))
* update license files and clean up TypeScript definitions ([fe668cc](https://github.com/visulima/visulima/commit/fe668cc26de23591d4df54a0954455ebbe31b22d))

## @visulima/fmt [1.1.19](https://github.com/visulima/visulima/compare/@visulima/fmt@1.1.18...@visulima/fmt@1.1.19) (2025-11-07)

### Bug Fixes

* update TypeScript configurations and improve linting across multiple packages ([6f25ec7](https://github.com/visulima/visulima/commit/6f25ec7841da7246f8f9166efc5292a7089d37ee))

### Miscellaneous Chores

* update npm and pnpm configurations for monorepo optimization ([#564](https://github.com/visulima/visulima/issues/564)) ([5512b42](https://github.com/visulima/visulima/commit/5512b42f672c216b6a3c9e39035199a4ebd9a4b8))

## @visulima/fmt [1.1.18](https://github.com/visulima/visulima/compare/@visulima/fmt@1.1.17...@visulima/fmt@1.1.18) (2025-11-05)

### Bug Fixes

* update dependencies across multiple packages ([36a47f2](https://github.com/visulima/visulima/commit/36a47f26d65d25a7b4d8371186710e7d0ab61a2b))

### Miscellaneous Chores

* update dependencies across multiple packages ([c526462](https://github.com/visulima/visulima/commit/c52646260c2ae8bbf85692e642f305f47a158d4e))
* update package dependencies and configurations ([7bfe7e7](https://github.com/visulima/visulima/commit/7bfe7e71869580900aab50efb064b4293994ed9a))

## @visulima/fmt [1.1.17](https://github.com/visulima/visulima/compare/@visulima/fmt@1.1.16...@visulima/fmt@1.1.17) (2025-10-21)

### Bug Fixes

* allow node v25 and updated dev deps ([8158cc5](https://github.com/visulima/visulima/commit/8158cc53ec92bd0331e8c6bd0fcbc8ab61b9320f))

### Miscellaneous Chores

* **deps:** update package versions and dependencies ([88d8d32](https://github.com/visulima/visulima/commit/88d8d32c4629a7a06c8770369191da2cc81087cc))
* update license years and add validation rules ([b97811e](https://github.com/visulima/visulima/commit/b97811ed2d253d908c0d86b4579a0a6bc33673a8))
* update package dependencies across multiple packages ([17e3f23](https://github.com/visulima/visulima/commit/17e3f2377c8a3f98e2eed2192c5adaf6e32558b5))

## @visulima/fmt [1.1.16](https://github.com/visulima/visulima/compare/@visulima/fmt@1.1.15...@visulima/fmt@1.1.16) (2025-10-15)

### Bug Fixes

* streamline ESLint configuration and enhance code readability ([56ccf38](https://github.com/visulima/visulima/commit/56ccf3882ca6071bb258910b068ffc30ddd2ced3))
* update @visulima/packem to 2.0.0-alpha.32 across multiple packages for improved compatibility ([27b346e](https://github.com/visulima/visulima/commit/27b346eaa1c0fb0e420d9a9824482028307f4249))

### Miscellaneous Chores

* **deps:** update build scripts and remove cross-env dependency ([7510e82](https://github.com/visulima/visulima/commit/7510e826b9235a0013fe61c82a7eb333bc4cbb78))
* **fmt:** update devDependencies ([323c9c7](https://github.com/visulima/visulima/commit/323c9c71d667d8fad0a981bbcf7371efa0e53941))
* update package dependencies across multiple packages for improved compatibility and performance ([9567591](https://github.com/visulima/visulima/commit/9567591c415da3002f3a4fe08f8caf7ce01ca5f7))
* update package.json and pnpm-lock.yaml to include publint@0.3.12 and adjust build/test commands to exclude shared-utils ([1f7b3c0](https://github.com/visulima/visulima/commit/1f7b3c0381d77edfeec80ea1bf57b3469e929414))
* updated dev dependencies ([2433ed5](https://github.com/visulima/visulima/commit/2433ed5fb662e0303c37edee8ddc21b46c21263f))

## @visulima/fmt [1.1.15](https://github.com/visulima/visulima/compare/@visulima/fmt@1.1.14...@visulima/fmt@1.1.15) (2025-03-07)

### Bug Fixes

* updated @visulima/packem and other dev deps, for better bundling size ([e940581](https://github.com/visulima/visulima/commit/e9405812201594e54dd81d17ddb74177df5f3c24))

### Miscellaneous Chores

* updated dev dependencies ([487a976](https://github.com/visulima/visulima/commit/487a976932dc7c39edfc19ffd3968960ff338066))

## @visulima/fmt [1.1.14](https://github.com/visulima/visulima/compare/@visulima/fmt@1.1.13...@visulima/fmt@1.1.14) (2025-01-25)

### Bug Fixes

* fixed wrong node version range in package.json ([4ae2929](https://github.com/visulima/visulima/commit/4ae292984681c71a770e4d4560432f7b7c5a141a))

### Miscellaneous Chores

* fixed typescript url ([fe65a8c](https://github.com/visulima/visulima/commit/fe65a8c0296ece7ee26474c70d065b06d4d0da89))
* updated all dev dependencies ([37fb298](https://github.com/visulima/visulima/commit/37fb298b2af7c63be64252024e54bb3af6ddabec))
* updated all dev dependencies and all dependencies in the app folder ([87f4ccb](https://github.com/visulima/visulima/commit/87f4ccbf9f7900ec5b56f3c1477bc4a0ef571bcf))

## @visulima/fmt [1.1.13](https://github.com/visulima/visulima/compare/@visulima/fmt@1.1.12...@visulima/fmt@1.1.13) (2025-01-12)

### Bug Fixes

* updated @visulima/packem, and all other dev dependencies ([7797a1c](https://github.com/visulima/visulima/commit/7797a1c3e6f1fc532895247bd88285a8a9883c40))

### Miscellaneous Chores

* updated dev dependencies ([9de2eab](https://github.com/visulima/visulima/commit/9de2eab91e95c8b9289d12f863a5167218770650))

## @visulima/fmt [1.1.12](https://github.com/visulima/visulima/compare/@visulima/fmt@1.1.11...@visulima/fmt@1.1.12) (2024-12-12)

### Bug Fixes

* allow node v23 ([8ca929a](https://github.com/visulima/visulima/commit/8ca929af311ce8036cbbfde68b6db05381b860a5))
* allowed node 23, updated dev dependencies ([f99d34e](https://github.com/visulima/visulima/commit/f99d34e01f6b13be8586a1b5d37dc8b8df0a5817))
* updated packem to v1.8.2 ([23f869b](https://github.com/visulima/visulima/commit/23f869b4120856cc97e2bffa6d508e2ae30420ea))
* updated packem to v1.9.2 ([47bdc2d](https://github.com/visulima/visulima/commit/47bdc2dfaeca4e7014dbe7772eae2fdf8c8b35bb))

### Styles

* cs fixes ([46d31e0](https://github.com/visulima/visulima/commit/46d31e082e1865262bf380859c14fabd28ff456d))

### Miscellaneous Chores

* updated dev dependencies ([a916944](https://github.com/visulima/visulima/commit/a916944b888bb34c34b0c54328b38d29e4399857))

## @visulima/fmt [1.1.11](https://github.com/visulima/visulima/compare/@visulima/fmt@1.1.10...@visulima/fmt@1.1.11) (2024-10-05)

### Bug Fixes

* updated dev dependencies, updated packem to v1.0.7, fixed naming of some lint config files ([c071a9c](https://github.com/visulima/visulima/commit/c071a9c8e129014a962ff654a16f302ca18a5c67))

## @visulima/fmt [1.1.10](https://github.com/visulima/visulima/compare/@visulima/fmt@1.1.9...@visulima/fmt@1.1.10) (2024-09-24)

### Bug Fixes

* update packem to v1 ([05f3bc9](https://github.com/visulima/visulima/commit/05f3bc960df10a1602e24f9066e2b0117951a877))
* updated esbuild from v0.23 to v0.24 ([3793010](https://github.com/visulima/visulima/commit/3793010d0d549c0d41f85dea04b8436251be5fe8))

### Miscellaneous Chores

* updated dev dependencies ([05edb67](https://github.com/visulima/visulima/commit/05edb671285b1cc42875223314b24212e6a12588))

## @visulima/fmt [1.1.9](https://github.com/visulima/visulima/compare/@visulima/fmt@1.1.8...@visulima/fmt@1.1.9) (2024-09-11)

### Bug Fixes

* fixed node10 support ([f5e78d9](https://github.com/visulima/visulima/commit/f5e78d9bff8fd603967666598b34f9338a8726b5))

### Miscellaneous Chores

* updated dev dependencies ([28b5ee5](https://github.com/visulima/visulima/commit/28b5ee5c805ca8868536418829cde7ba8c5bb8dd))

## @visulima/fmt [1.1.8](https://github.com/visulima/visulima/compare/@visulima/fmt@1.1.7...@visulima/fmt@1.1.8) (2024-09-07)

### Bug Fixes

* fixed broken chunk splitting from packem ([1aaf277](https://github.com/visulima/visulima/commit/1aaf27779292d637923c5f8a220e18606e78caa2))

## @visulima/fmt [1.1.7](https://github.com/visulima/visulima/compare/@visulima/fmt@1.1.6...@visulima/fmt@1.1.7) (2024-09-07)

### Bug Fixes

* added types support for node10 ([604583f](https://github.com/visulima/visulima/commit/604583fa3c24b950fafad45d17e7a1333040fd76))

### Miscellaneous Chores

* update dev dependencies ([0738f98](https://github.com/visulima/visulima/commit/0738f9810478bb215ce4b2571dc8874c4c503089))
* updated dev dependencies ([45c2a76](https://github.com/visulima/visulima/commit/45c2a76bc974ecb2c6b172c3af03373d4cc6a5ce))

## @visulima/fmt [1.1.6](https://github.com/visulima/visulima/compare/@visulima/fmt@1.1.5...@visulima/fmt@1.1.6) (2024-08-01)

### Bug Fixes

* **fmt:** switched to packem from tsup ([24d86a9](https://github.com/visulima/visulima/commit/24d86a94cdc8d8130b5a95241a7cdc7e39f399cf))

### Miscellaneous Chores

* changed typescript version back to 5.4.5 ([55d28bb](https://github.com/visulima/visulima/commit/55d28bbdc103718d19f844034b38a0e8e5af798a))
* cs fixes ([ab59375](https://github.com/visulima/visulima/commit/ab59375452fa289aed240bfd0b54b76d0c6ee2b4))
* updated all dev deps ([ef143ce](https://github.com/visulima/visulima/commit/ef143ce2e15952a0910aa5c8bd78d25de9ebd7f3))
* updated dev dependencies ([ac67ec1](https://github.com/visulima/visulima/commit/ac67ec1bcba16175d225958e318199f60b10d179))
* updated dev dependencies and sorted the package.json ([9571572](https://github.com/visulima/visulima/commit/95715725a8ed053ca24fd1405a55205c79342ecb))

### Build System

* fixed found audit error, updated all dev package deps, updated deps in apps and examples ([4c51950](https://github.com/visulima/visulima/commit/4c519500dc5504579d35725572920658999885cb))

## @visulima/fmt [1.1.5](https://github.com/visulima/visulima/compare/@visulima/fmt@1.1.4...@visulima/fmt@1.1.5) (2024-06-06)


### Bug Fixes

* allow node v22 ([890d457](https://github.com/visulima/visulima/commit/890d4570f18428e2463944813c0c638b3f142803))


### Styles

* cs fixes on some package.json files ([12fc0f7](https://github.com/visulima/visulima/commit/12fc0f74e206cef77863b0b89ec41174ca9ff0bd))


### Miscellaneous Chores

* changed semantic-release-npm to pnpm ([b6d100a](https://github.com/visulima/visulima/commit/b6d100a2bf3fd026577be48726a37754947f0973))
* **deps:** updated dev deps ([d91ac38](https://github.com/visulima/visulima/commit/d91ac389cea85a6c6bdc8de97905252a6c467abc))
* downgrade eslint-plugin-vitest ([0162771](https://github.com/visulima/visulima/commit/0162771e6022e4594486a796bc41e91a2d87bcd8))
* update dev dependencies ([09c4854](https://github.com/visulima/visulima/commit/09c4854e221fa8b808dfe66d7196d8db2a39b366))
* updated dev dependencies ([a2e0504](https://github.com/visulima/visulima/commit/a2e0504dc239049434c2482756ff15bdbaac9b54))
* updated dev dependencies ([abd319c](https://github.com/visulima/visulima/commit/abd319c23576aa1dc751ac874e806bddbc977d51))
* updated dev dependencies ([0767afe](https://github.com/visulima/visulima/commit/0767afe9be83da6698c1343724400171f952599e))
* updated dev dependencies ([d7791e3](https://github.com/visulima/visulima/commit/d7791e327917e438757636573b1e5549a97bba7b))
* updated dev dependencies ([6005345](https://github.com/visulima/visulima/commit/60053456717a3889fc77b4fb5b05d50a662475b2))
* updated dev dependencies ([87dee15](https://github.com/visulima/visulima/commit/87dee156e797b5dee2557a09ad32c935d851847c))
* updated dev dependencies ([bf2c635](https://github.com/visulima/visulima/commit/bf2c635859601cc97858226e70f47219eabc213e))
* updated dev dependencies ([f67c7f1](https://github.com/visulima/visulima/commit/f67c7f14ecc328ed91d06d01ac6514e8bce72cb4))

## @visulima/fmt [1.1.4](https://github.com/visulima/visulima/compare/@visulima/fmt@1.1.3...@visulima/fmt@1.1.4) (2024-03-27)


### Bug Fixes

* added missing os key to package.json ([4ad1268](https://github.com/visulima/visulima/commit/4ad1268ed12cbdcf60aeb46d4c052ed1696bc150))

## @visulima/fmt [1.1.3](https://github.com/visulima/visulima/compare/@visulima/fmt@1.1.2...@visulima/fmt@1.1.3) (2024-03-04)


### Bug Fixes

* fixed all found type issues ([eaa40d1](https://github.com/visulima/visulima/commit/eaa40d11f3fc056dfddcc25404bf109587ef2862))
* minifyWhitespace on prod build, removed @tsconfig/* configs ([410cb73](https://github.com/visulima/visulima/commit/410cb737c44c445a0479bdd49b4100d5daf2d83d))

## @visulima/fmt [1.1.2](https://github.com/visulima/visulima/compare/@visulima/fmt@1.1.1...@visulima/fmt@1.1.2) (2024-02-26)


### Bug Fixes

* moved custom formatters into the default switch call ([eaf550b](https://github.com/visulima/visulima/commit/eaf550bd72f464e86a50e713410d41e068ebf953))

## @visulima/fmt [1.1.1](https://github.com/visulima/visulima/compare/@visulima/fmt@1.1.0...@visulima/fmt@1.1.1) (2024-02-19)


### Bug Fixes

* removed the deno check ([0563ab9](https://github.com/visulima/visulima/commit/0563ab993d1634dd64591b0ef6402a87bc84def9))

## @visulima/fmt [1.1.0](https://github.com/visulima/visulima/compare/@visulima/fmt@1.0.1...@visulima/fmt@1.1.0) (2024-02-19)


### Features

* added %c to ANSI transform ([dcf0bff](https://github.com/visulima/visulima/commit/dcf0bffdc591ccb60106fa03a99c2d16d11c5a23))

## @visulima/fmt [1.0.1](https://github.com/visulima/visulima/compare/@visulima/fmt@1.0.0...@visulima/fmt@1.0.1) (2024-01-19)


### Bug Fixes

* changed wrong typing ([e11089e](https://github.com/visulima/visulima/commit/e11089eba1045f0db46866a5093df3bd8b111aaf))
* updated all deps, updated test based on eslint errors ([909f8f3](https://github.com/visulima/visulima/commit/909f8f384804d7ef140354ab44f867532dbc9847))

## @visulima/fmt 1.0.0 (2023-12-13)


### Features

* new fmt package ([#276](https://github.com/visulima/visulima/issues/276)) ([9fb141e](https://github.com/visulima/visulima/commit/9fb141e31236a3ef7b9e8bc5623dc40d8dd194db))
