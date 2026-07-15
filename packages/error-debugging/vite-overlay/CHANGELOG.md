## @visulima/vite-overlay [2.0.2](https://github.com/visulima/visulima/compare/%40visulima%2Fvite-overlay%402.0.1...%40visulima%2Fvite-overlay%402.0.2) (2026-07-15)

## @visulima/vite-overlay [2.0.1](https://github.com/visulima/visulima/compare/%40visulima%2Fvite-overlay%402.0.0...%40visulima%2Fvite-overlay%402.0.1) (2026-07-15)

## @visulima/vite-overlay [2.0.0](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@1.3.7...@visulima/vite-overlay@2.0.0) (2026-07-03)

### ⚠ BREAKING CHANGES

* change min node version to 22.13

### Features

* **dev-toolbar:** initialize dev-toolbar package  ([#586](https://github.com/visulima/visulima/issues/586)) ([a3ab9d6](https://github.com/visulima/visulima/commit/a3ab9d6e6c768853854b95fa8eee908b95235ea5))
* **web:** auto-generate packages page from workspace metadata ([623e520](https://github.com/visulima/visulima/commit/623e5207693a7fe720f5f2f179593a3654c880e3))

### Bug Fixes

* add new package image, fixed readme rendering on npm, fixed building of packages ([b790ba2](https://github.com/visulima/visulima/commit/b790ba253ea07fef83528fd822a678facf021b5f))
* added hint to the overlay back ([5df1227](https://github.com/visulima/visulima/commit/5df122779364090d10d60f440e61a595c7e1ee83))
* **error-debugging:** resolve eslint and formatting issues ([7d0ada8](https://github.com/visulima/visulima/commit/7d0ada8787bf624df5a7d504448a4d1b69165aba))
* **error-debugging:** resolve eslint and type-safety issues ([886dbff](https://github.com/visulima/visulima/commit/886dbffe3f744c9493fcc54e781de3fd21eebf78))
* **lint:** clear pre-existing eslint rot across packages ([#674](https://github.com/visulima/visulima/issues/674)) ([5354253](https://github.com/visulima/visulima/commit/5354253b163bd50bcefaf8a3fddf831bdb5df32b))
* remove deprecated baseUrl and downlevelIteration from tsconfigs ([a708366](https://github.com/visulima/visulima/commit/a708366b5c3bc73cfde480a712ed397bd921fb93))
* Remove JSR configuration generation script and generated jsr.json files ([#616](https://github.com/visulima/visulima/issues/616)) ([533744b](https://github.com/visulima/visulima/commit/533744b103b74896941db5b727173e617a27a63b))
* **storage-client:** percent-encode user fields in defaultFingerprint ([7c78a0f](https://github.com/visulima/visulima/commit/7c78a0f9512e2a673b941d80839e9f1e86b7b5d0))
* **tests:** revert unsafe vitest autofixes from the lint sweep ([378f27c](https://github.com/visulima/visulima/commit/378f27caa370f1d3188aef2ed36d46839abc88c4))
* update dependencies and improve error handling in error-debugging packages ([b95fea4](https://github.com/visulima/visulima/commit/b95fea4ef0e0a6777b3dd465603b1dd3c40aa4e8))
* update license information and add badges in README files ([340af5d](https://github.com/visulima/visulima/commit/340af5d227b3450a86da7861eeea5fee63ab4446))
* update Node.js engine version requirement to >=22.13 in multiple package.json files for improved compatibility ([b828e9a](https://github.com/visulima/visulima/commit/b828e9aeaebfc798eecddccd90e6ec7560c6d36a))
* update package OG images across multiple packages ([f08e4dd](https://github.com/visulima/visulima/commit/f08e4dd2b105ccb29c8412020a9c2be36d6c1e9e))
* **vite-overlay:** 3 bug fixes ([436844a](https://github.com/visulima/visulima/commit/436844a292272fe5b64442e2e638374e5d3df611))
* **vite-overlay:** cast function plugin through unknown for Plugin type ([4eeeb04](https://github.com/visulima/visulima/commit/4eeeb04a0e39fe9a5369daca5907bb96313f35ae))
* **vite-overlay:** clear balloon on HMR update and fix pre-existing TS errors ([6904661](https://github.com/visulima/visulima/commit/69046610f5a5c36ba68539ecb7a088cb767922ca))
* **vite-overlay:** explicitly override forms plugin background on editor select ([9614446](https://github.com/visulima/visulima/commit/96144461dd00fad5dad3dd1aa3976af1ec34a896)), closes [#fff](https://github.com/visulima/visulima/issues/fff) [select#editor-selector](https://github.com/visulima/select/issues/editor-selector)
* **vite-overlay:** fix all ESLint errors and prevent e2e specs from running in vitest ([c212416](https://github.com/visulima/visulima/commit/c212416be37c7bbe2276e440401103146838b8e5))
* **vite-overlay:** fix editor select chevron and options popup in dark/light mode ([69e3274](https://github.com/visulima/visulima/commit/69e327476990e4b37a300f6655bf73af0aba2060))
* **vite-overlay:** fix formatting and minor code style issues ([ec96733](https://github.com/visulima/visulima/commit/ec9673362fdf82ff4dacaf03aeb1c59250cd4eb0))
* **vite-overlay:** fix syntheticError typo, blank line lint error, and rewrite corrupted docs ([a990844](https://github.com/visulima/visulima/commit/a99084491d19f07704488d10ab4930c5b7b779d0))
* **vite-overlay:** harden xss/redos and fix suggestion ranking in overlay ([fa7d531](https://github.com/visulima/visulima/commit/fa7d531915bde1f0fe57226f4efdc1cc1fc00ec6))
* **vite-overlay:** properly fix eslint errors in code ([296daaa](https://github.com/visulima/visulima/commit/296daaa240daebe8b87f7706d07f9eb802106563))
* **vite-overlay:** remove remaining eslint suppressions with proper code fixes ([5d06168](https://github.com/visulima/visulima/commit/5d061688210a8c23a214f03407bcafb759b7656a))
* **vite-overlay:** replace rolldown-vite alias with vite@8 beta ([0596412](https://github.com/visulima/visulima/commit/0596412d437625183db5909d3b3ad1328293d8ef))
* **vite-overlay:** resolve 10 runtime bugs in error overlay ([da43fcb](https://github.com/visulima/visulima/commit/da43fcb1eeec62e7855c3bcbc9f365613fa9001c))
* **vite-overlay:** resolve eslint and formatting issues ([6d62d6e](https://github.com/visulima/visulima/commit/6d62d6efd40ffd2c7517ef404875dc80de662260))
* **vite-overlay:** resolve eslint errors ([816dd2b](https://github.com/visulima/visulima/commit/816dd2b55146247f56171854234b4e6e1f0bb2ed))
* **vite-overlay:** resolve ESLint errors and expand braceless if statements ([f837bcd](https://github.com/visulima/visulima/commit/f837bcd2a1a743290b63e7471d843a953fd75b54))
* **vite-overlay:** restore plugin-hint fallback, Svelte hint, and XSS escaping ([15a4162](https://github.com/visulima/visulima/commit/15a41624c7f9045cebbd246821fb4a5cab28b07c))
* **vite-overlay:** sanitize markdown, cache dir walk ([5430c78](https://github.com/visulima/visulima/commit/5430c780ab97b692d8e968900ba7b2564f19944a))
* **vite-overlay:** show balloon button alongside overlay for client errors ([6b9d8d4](https://github.com/visulima/visulima/commit/6b9d8d414ef1d21ab5ccee5f5a5aebb544d6f2c2))
* **vite-overlay:** update package files ([fd8f5c1](https://github.com/visulima/visulima/commit/fd8f5c13f384d945f3597b00cfdfaf615e100de9))
* **vite-overlay:** update packem to 2.0.0-alpha.54 ([73b70e3](https://github.com/visulima/visulima/commit/73b70e398cda6ee38aed18fa798bd2198b732024))
* **vite-overlay:** use workspace:* for internal [@visulima](https://github.com/visulima) deps ([cf5aedc](https://github.com/visulima/visulima/commit/cf5aedcc8621fedf4a1b4f39b574699292f85a5a))
* **web:** improve build setup with incremental stats caching and prod install ([fe33e75](https://github.com/visulima/visulima/commit/fe33e75827586779b4b3a0c6d57b39f889ee6207))

### Documentation

* **error,error-handler,ono,inspector,source-map,vite-overlay:** add comprehensive Fumadocs documentation ([a0c8c92](https://github.com/visulima/visulima/commit/a0c8c92949cff2730fc6122f717fe344c030f366))
* prettier-format agent instructions ([71b6414](https://github.com/visulima/visulima/commit/71b6414528780ac82c4e0bb25b5f4f11faba5549))
* **vite-overlay:** fix incorrect BalloonConfig properties and add client API docs ([6f045cf](https://github.com/visulima/visulima/commit/6f045cf186dc9ca7552e3cd21ff959414ddf2b13))

### Styles

* cs fixes ([2a960bb](https://github.com/visulima/visulima/commit/2a960bb1772c9dc70080e2d75d3a0d827034e294))

### Miscellaneous Chores

* add fallow code-intelligence across all packages ([a3b4821](https://github.com/visulima/visulima/commit/a3b48215002e86fed20f2973038b5d4a0aa1ce04))
* **api-platform:** apply pending lint and source updates ([3fb0043](https://github.com/visulima/visulima/commit/3fb0043a4cf35f752ca89a09a077100ae0142da8))
* apply eslint + prettier autofixes across packages ([c1bb784](https://github.com/visulima/visulima/commit/c1bb7848a0d93d0dfe2960c77e3cda22239c79a0))
* bump engines.node to ^22.14.0 || >=24.10.0 ([c3d0931](https://github.com/visulima/visulima/commit/c3d0931d1504e4f21ebf50ea680cfa7ce4ba15ce))
* **ci-stability:** green CI across vis, native, lint, tests, attw ([#651](https://github.com/visulima/visulima/issues/651)) ([d4eb684](https://github.com/visulima/visulima/commit/d4eb684b5f75c818c9251048c605a0ed54a268e3))
* **dependencies:** update msw to version 2.12.6, jsdom to version 27.4.0, and [@tanstack](https://github.com/tanstack) packages to version 1.144.0 in package.json files ([1aa0236](https://github.com/visulima/visulima/commit/1aa0236e1f8190eecf7526cf2dc0f369cac02d87))
* **error-debugging:** remove empty dependency objects from package.json ([7eb7c8e](https://github.com/visulima/visulima/commit/7eb7c8eba1394e515fa77c0f56baf41c0810de2e))
* **error-debugging:** update dependencies ([6002ece](https://github.com/visulima/visulima/commit/6002ece1803b2ba8261cff42a362dd6e8ddcc3ee))
* fixed jsr.json ([5d85e51](https://github.com/visulima/visulima/commit/5d85e5179de38e284ec433b14d77c71a1619c8d6))
* fixed project.json names and schema path ([964722f](https://github.com/visulima/visulima/commit/964722f691db205c7edb9aa6db29e849a647500b))
* jsr.json update and lock file ([73fce38](https://github.com/visulima/visulima/commit/73fce38c7cb4603f3fffb88609b1b18e2feb4937))
* moved all packages into groups ([0615e9d](https://github.com/visulima/visulima/commit/0615e9d14a8a886e11da529ce150cf31ca973c10))
* re-sort workspace package.json files via vis sort-package-json ([f625696](https://github.com/visulima/visulima/commit/f625696cfac974325774b3243e1a83c3d23acbd7))
* **release:** @visulima/vite-overlay@2.0.0-alpha.1 [skip ci]\n\n## @visulima/vite-overlay [2.0.0-alpha.1](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@1.3.7...@visulima/vite-overlay@2.0.0-alpha.1) (2025-12-07) ([ac14e1a](https://github.com/visulima/visulima/commit/ac14e1a324ab7459870b57a0e5009a0e79b2f543))
* **release:** @visulima/vite-overlay@2.0.0-alpha.10 [skip ci]\n\n## @visulima/vite-overlay [2.0.0-alpha.10](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@2.0.0-alpha.9...@visulima/vite-overlay@2.0.0-alpha.10) (2026-03-26) ([e6f78f2](https://github.com/visulima/visulima/commit/e6f78f2927372e49bf0d667b9fab5a8b9d36bbd0))
* **release:** @visulima/vite-overlay@2.0.0-alpha.11 [skip ci]\n\n## @visulima/vite-overlay [2.0.0-alpha.11](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@2.0.0-alpha.10...@visulima/vite-overlay@2.0.0-alpha.11) (2026-04-08) ([3e0f26b](https://github.com/visulima/visulima/commit/3e0f26b707c6eb15d159bc52ab37a5429e351560))
* **release:** @visulima/vite-overlay@2.0.0-alpha.12 [skip ci]\n\n## @visulima/vite-overlay [2.0.0-alpha.12](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@2.0.0-alpha.11...@visulima/vite-overlay@2.0.0-alpha.12) (2026-04-21) ([9e6e3eb](https://github.com/visulima/visulima/commit/9e6e3eb668145c2bf4351aca1fd9fe1d45db9d60))
* **release:** @visulima/vite-overlay@2.0.0-alpha.13 [skip ci]\n\n## @visulima/vite-overlay [2.0.0-alpha.13](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@2.0.0-alpha.12...@visulima/vite-overlay@2.0.0-alpha.13) (2026-04-21) ([6604823](https://github.com/visulima/visulima/commit/6604823bc6f61d249d6071cc3c88915ebeea7a04))
* **release:** @visulima/vite-overlay@2.0.0-alpha.14 [skip ci]\n\n## @visulima/vite-overlay [2.0.0-alpha.14](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@2.0.0-alpha.13...@visulima/vite-overlay@2.0.0-alpha.14) (2026-04-21) ([526170c](https://github.com/visulima/visulima/commit/526170c8b95fe7a19657cc5db2223efcc64a5f3c))
* **release:** @visulima/vite-overlay@2.0.0-alpha.15 [skip ci]\n\n## @visulima/vite-overlay [2.0.0-alpha.15](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@2.0.0-alpha.14...@visulima/vite-overlay@2.0.0-alpha.15) (2026-04-22) ([2d3ddc0](https://github.com/visulima/visulima/commit/2d3ddc03571a54fbe640e285ab385490a9b389aa))
* **release:** @visulima/vite-overlay@2.0.0-alpha.16 [skip ci]\n\n## @visulima/vite-overlay [2.0.0-alpha.16](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@2.0.0-alpha.15...@visulima/vite-overlay@2.0.0-alpha.16) (2026-04-30) ([b99051e](https://github.com/visulima/visulima/commit/b99051eee658030169f5aab7d06a1ada878c6ba8))
* **release:** @visulima/vite-overlay@2.0.0-alpha.17 [skip ci]\n\n## @visulima/vite-overlay [2.0.0-alpha.17](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@2.0.0-alpha.16...@visulima/vite-overlay@2.0.0-alpha.17) (2026-05-04) ([93cc19b](https://github.com/visulima/visulima/commit/93cc19b82dc3b06515cd86f535a449aa092c529f))
* **release:** @visulima/vite-overlay@2.0.0-alpha.18 [skip ci]\n\n## @visulima/vite-overlay [2.0.0-alpha.18](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@2.0.0-alpha.17...@visulima/vite-overlay@2.0.0-alpha.18) (2026-05-06) ([67d0701](https://github.com/visulima/visulima/commit/67d0701b1f104c81b64779f953377ebbe995292e))
* **release:** @visulima/vite-overlay@2.0.0-alpha.19 [skip ci]\n\n## @visulima/vite-overlay [2.0.0-alpha.19](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@2.0.0-alpha.18...@visulima/vite-overlay@2.0.0-alpha.19) (2026-05-06) ([e83fd12](https://github.com/visulima/visulima/commit/e83fd12d83921a0b52fd6057a140a0fbdeb745c6))
* **release:** @visulima/vite-overlay@2.0.0-alpha.2 [skip ci]\n\n## @visulima/vite-overlay [2.0.0-alpha.2](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@2.0.0-alpha.1...@visulima/vite-overlay@2.0.0-alpha.2) (2025-12-11) ([3beb7f8](https://github.com/visulima/visulima/commit/3beb7f87c10cc4caf5cb0ca72cb4a3588a1cf2bb))
* **release:** @visulima/vite-overlay@2.0.0-alpha.20 [skip ci]\n\n## @visulima/vite-overlay [2.0.0-alpha.20](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@2.0.0-alpha.19...@visulima/vite-overlay@2.0.0-alpha.20) (2026-05-07) ([dffa0bb](https://github.com/visulima/visulima/commit/dffa0bbbb0c575339d7db074e8d12010bad6fc92))
* **release:** @visulima/vite-overlay@2.0.0-alpha.21 [skip ci]\n\n## @visulima/vite-overlay [2.0.0-alpha.21](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@2.0.0-alpha.20...@visulima/vite-overlay@2.0.0-alpha.21) (2026-05-07) ([8ee73c1](https://github.com/visulima/visulima/commit/8ee73c155850463047482298624b98abd1bcee11))
* **release:** @visulima/vite-overlay@2.0.0-alpha.22 [skip ci]\n\n## @visulima/vite-overlay [2.0.0-alpha.22](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@2.0.0-alpha.21...@visulima/vite-overlay@2.0.0-alpha.22) (2026-05-10) ([f248c57](https://github.com/visulima/visulima/commit/f248c5749f8fb25843be8680959c621fd30b2480))
* **release:** @visulima/vite-overlay@2.0.0-alpha.23 [skip ci]\n\n## @visulima/vite-overlay [2.0.0-alpha.23](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@2.0.0-alpha.22...@visulima/vite-overlay@2.0.0-alpha.23) (2026-05-10) ([8347753](https://github.com/visulima/visulima/commit/8347753458ef595f827392aa1ccd3d7b37388328))
* **release:** @visulima/vite-overlay@2.0.0-alpha.24 [skip ci]\n\n## @visulima/vite-overlay [2.0.0-alpha.24](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@2.0.0-alpha.23...@visulima/vite-overlay@2.0.0-alpha.24) (2026-05-11) ([c4628eb](https://github.com/visulima/visulima/commit/c4628eb4e37d84831bb0c1a174085317fc58eba0))
* **release:** @visulima/vite-overlay@2.0.0-alpha.25 [skip ci]\n\n## @visulima/vite-overlay [2.0.0-alpha.25](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@2.0.0-alpha.24...@visulima/vite-overlay@2.0.0-alpha.25) (2026-05-11) ([6beeb13](https://github.com/visulima/visulima/commit/6beeb131e2df680360ebdc38aa4ede4253c6fbd3))
* **release:** @visulima/vite-overlay@2.0.0-alpha.26 [skip ci]\n\n## @visulima/vite-overlay [2.0.0-alpha.26](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@2.0.0-alpha.25...@visulima/vite-overlay@2.0.0-alpha.26) (2026-05-14) ([5ccac56](https://github.com/visulima/visulima/commit/5ccac569ee76c7b2c266f8ec160131c9f32e4090))
* **release:** @visulima/vite-overlay@2.0.0-alpha.27 [skip ci]\n\n## @visulima/vite-overlay [2.0.0-alpha.27](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@2.0.0-alpha.26...@visulima/vite-overlay@2.0.0-alpha.27) (2026-05-16) ([e7b9ad3](https://github.com/visulima/visulima/commit/e7b9ad3b56e67d512ed2e8eec7f6af9a34cc0150))
* **release:** @visulima/vite-overlay@2.0.0-alpha.28 [skip ci]\n\n## @visulima/vite-overlay [2.0.0-alpha.28](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@2.0.0-alpha.27...@visulima/vite-overlay@2.0.0-alpha.28) (2026-05-19) ([9af6205](https://github.com/visulima/visulima/commit/9af6205bf6753de4fd313f3957acff20a993526e))
* **release:** @visulima/vite-overlay@2.0.0-alpha.29 [skip ci]\n\n## @visulima/vite-overlay [2.0.0-alpha.29](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@2.0.0-alpha.28...@visulima/vite-overlay@2.0.0-alpha.29) (2026-05-20) ([26512ad](https://github.com/visulima/visulima/commit/26512ad39e3924f60a7f45c0c2cb1ddd9eb1c40b))
* **release:** @visulima/vite-overlay@2.0.0-alpha.3 [skip ci]\n\n## @visulima/vite-overlay [2.0.0-alpha.3](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@2.0.0-alpha.2...@visulima/vite-overlay@2.0.0-alpha.3) (2025-12-11) ([0b5492a](https://github.com/visulima/visulima/commit/0b5492a0fb5fb4789f78a151783c67810c8af7b7))
* **release:** @visulima/vite-overlay@2.0.0-alpha.30 [skip ci]\n\n## @visulima/vite-overlay [2.0.0-alpha.30](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@2.0.0-alpha.29...@visulima/vite-overlay@2.0.0-alpha.30) (2026-05-26) ([4cbd20f](https://github.com/visulima/visulima/commit/4cbd20fdcbcb64197bf44ea7505d3f3e01139650))
* **release:** @visulima/vite-overlay@2.0.0-alpha.31 [skip ci]\n\n## @visulima/vite-overlay [2.0.0-alpha.31](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@2.0.0-alpha.30...@visulima/vite-overlay@2.0.0-alpha.31) (2026-05-27) ([2f41bf5](https://github.com/visulima/visulima/commit/2f41bf5677d32d86498f3e63c99820e4634dbc02))
* **release:** @visulima/vite-overlay@2.0.0-alpha.32 [skip ci]\n\n## @visulima/vite-overlay [2.0.0-alpha.32](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@2.0.0-alpha.31...@visulima/vite-overlay@2.0.0-alpha.32) (2026-06-02) ([19edf9d](https://github.com/visulima/visulima/commit/19edf9d1b0dff2e21cee02f1a44a1476195c27d6))
* **release:** @visulima/vite-overlay@2.0.0-alpha.33 [skip ci]\n\n## @visulima/vite-overlay [2.0.0-alpha.33](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@2.0.0-alpha.32...@visulima/vite-overlay@2.0.0-alpha.33) (2026-06-04) ([b83b392](https://github.com/visulima/visulima/commit/b83b3926b4a4a9922ac643451552c4917c13c126))
* **release:** @visulima/vite-overlay@2.0.0-alpha.34 [skip ci]\n\n## @visulima/vite-overlay [2.0.0-alpha.34](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@2.0.0-alpha.33...@visulima/vite-overlay@2.0.0-alpha.34) (2026-06-13) ([5a07e84](https://github.com/visulima/visulima/commit/5a07e840d317339d8bf323cbb8ce244598317a9f))
* **release:** @visulima/vite-overlay@2.0.0-alpha.35 [skip ci]\n\n## @visulima/vite-overlay [2.0.0-alpha.35](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@2.0.0-alpha.34...@visulima/vite-overlay@2.0.0-alpha.35) (2026-06-19) ([ed3f2a5](https://github.com/visulima/visulima/commit/ed3f2a5092934c25ce938bd8bdc8a3309d1bc003))
* **release:** @visulima/vite-overlay@2.0.0-alpha.36 [skip ci]\n\n## @visulima/vite-overlay [2.0.0-alpha.36](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@2.0.0-alpha.35...@visulima/vite-overlay@2.0.0-alpha.36) (2026-06-30) ([fe5d37f](https://github.com/visulima/visulima/commit/fe5d37f8db5d9b59b3486b3178ab6ed972974e01))
* **release:** @visulima/vite-overlay@2.0.0-alpha.4 [skip ci]\n\n## @visulima/vite-overlay [2.0.0-alpha.4](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@2.0.0-alpha.3...@visulima/vite-overlay@2.0.0-alpha.4) (2025-12-27) ([0921e60](https://github.com/visulima/visulima/commit/0921e60c364425671a315efb0f5cafc5947e5899))
* **release:** @visulima/vite-overlay@2.0.0-alpha.5 [skip ci]\n\n## @visulima/vite-overlay [2.0.0-alpha.5](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@2.0.0-alpha.4...@visulima/vite-overlay@2.0.0-alpha.5) (2026-01-17) ([fd21d3f](https://github.com/visulima/visulima/commit/fd21d3f03eee50c99fdb2f64c0e61d59d6a65624))
* **release:** @visulima/vite-overlay@2.0.0-alpha.6 [skip ci]\n\n## @visulima/vite-overlay [2.0.0-alpha.6](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@2.0.0-alpha.5...@visulima/vite-overlay@2.0.0-alpha.6) (2026-02-28) ([c7631b2](https://github.com/visulima/visulima/commit/c7631b23538cac6fcfe6589f67a8a379393d2eef))
* **release:** @visulima/vite-overlay@2.0.0-alpha.7 [skip ci]\n\n## @visulima/vite-overlay [2.0.0-alpha.7](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@2.0.0-alpha.6...@visulima/vite-overlay@2.0.0-alpha.7) (2026-03-04) ([866c3ed](https://github.com/visulima/visulima/commit/866c3ed16ce04c3b6c3361d5e39f2f6723f55b8b))
* **release:** @visulima/vite-overlay@2.0.0-alpha.8 [skip ci]\n\n## @visulima/vite-overlay [2.0.0-alpha.8](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@2.0.0-alpha.7...@visulima/vite-overlay@2.0.0-alpha.8) (2026-03-06) ([924e305](https://github.com/visulima/visulima/commit/924e305c57130086f0c8edb6ad5ac1c757307320))
* **release:** @visulima/vite-overlay@2.0.0-alpha.9 [skip ci]\n\n## @visulima/vite-overlay [2.0.0-alpha.9](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@2.0.0-alpha.8...@visulima/vite-overlay@2.0.0-alpha.9) (2026-03-26) ([9a8860e](https://github.com/visulima/visulima/commit/9a8860e3c264b0c85f43ebbb2b247bd1c24d85db))
* remove unused deprecated aliases ([#612](https://github.com/visulima/visulima/issues/612)) ([24ee546](https://github.com/visulima/visulima/commit/24ee546bcb2c17b8915622e4878797c00aa1d813))
* **repo:** sort package.json keys across all packages ([e1fd9ab](https://github.com/visulima/visulima/commit/e1fd9ab467ef96a98c777da1572ff6a50fcf7e71))
* simplify pnpm-workspace packages list ([7cab221](https://github.com/visulima/visulima/commit/7cab221163632d9b7aa044a6f88c49083103a869))
* sorted package.json ([b47c545](https://github.com/visulima/visulima/commit/b47c545591600fdab17d5cd3a3fbc68b61e199da))
* update @anolilab/semantic-release-pnpm and @anolilab/semantic-release-preset to versions 3.2.2 and 12.1.2 across multiple package.json files for improved compatibility ([3921626](https://github.com/visulima/visulima/commit/3921626141fe5da398749bf0ba675f1596f18afb))
* update dependencies across multiple packages to improve compatibility and performance, including upgrading `@anolilab/semantic-release-pnpm` and `@anolilab/semantic-release-preset` to versions 3.2.0 and 12.1.0 respectively, and updating `react`, `react-dom`, and `next` versions to 19.2.1 and 16.0.7 in various package.json files ([aee8fcd](https://github.com/visulima/visulima/commit/aee8fcd796ae9b8d055903260e7150996ea9f53d))
* update lock file maintenance ([d83e716](https://github.com/visulima/visulima/commit/d83e71697b75d24704185b66bb521a934d2db02d))
* update package dependencies and improve configuration ([4ed22d6](https://github.com/visulima/visulima/commit/4ed22d6511aa8150dcd4ba7b9dccf05dbe2d6adc))
* update the jsr.json ([864ab7e](https://github.com/visulima/visulima/commit/864ab7e71c4b5ae82f64792d1ae8debfea2c539b))
* visulima website ([#591](https://github.com/visulima/visulima/issues/591)) ([59ab2e2](https://github.com/visulima/visulima/commit/59ab2e2befb03e51cd2088956f83d9b87de6d033))
* **vite-overlay:** add tsconfig.eslint.json for type-aware linting ([508f071](https://github.com/visulima/visulima/commit/508f071c3d6bdc3fc962899c102444d6d10e5932))
* **vite-overlay:** apply formatter and lint fixes ([bb14233](https://github.com/visulima/visulima/commit/bb142339d2a6dae661df8af1ae51d48dceaeb680))
* **vite-overlay:** apply pending changes ([82aa656](https://github.com/visulima/visulima/commit/82aa65600f7c178d0ab0c279b4dc2f08dffec6cd))
* **vite-overlay:** apply pending lint and source updates ([1b07e38](https://github.com/visulima/visulima/commit/1b07e381e4dbf9b4f8e0b3fa348e2dede8149cfe))
* **vite-overlay:** apply prettier and eslint formatting sweep ([21712b7](https://github.com/visulima/visulima/commit/21712b7acf46f2bef5b1b06c4087282267d9d433))
* **vite-overlay:** apply prettier and eslint quote-style auto-fix ([9778781](https://github.com/visulima/visulima/commit/9778781ec8e1542860cded3e7c05a3269345f5a3))
* **vite-overlay:** apply prettier formatting ([01e49b1](https://github.com/visulima/visulima/commit/01e49b1771db9b1158344ab6437dfba2b65f5c70))
* **vite-overlay:** apply prettier style cleanup to src and tests ([77f376b](https://github.com/visulima/visulima/commit/77f376bd9a04032af01ba53392882d2dc95e4619))
* **vite-overlay:** clean up unnecessary comments in CSS ([b073df9](https://github.com/visulima/visulima/commit/b073df90b6b664d2d5762d68ba93c52bba5f31b4))
* **vite-overlay:** enforce curly braces and apply lint fixes ([7345554](https://github.com/visulima/visulima/commit/7345554634876ddbd01a4fae2171113a04ab7f4a))
* **vite-overlay:** expand inline if-return to block syntax ([b41e0b4](https://github.com/visulima/visulima/commit/b41e0b417a5faf290df9c7c2d0e320929d43f56f))
* **vite-overlay:** expand inline if-return to block syntax ([786c763](https://github.com/visulima/visulima/commit/786c763420fcfc844d4b794eb9ede7d27c86d8ec))
* **vite-overlay:** housekeeping cleanup ([de2491d](https://github.com/visulima/visulima/commit/de2491d209965aa66c0752a2f55263f0d335eadd))
* **vite-overlay:** migrate .prettierrc.cjs to prettier.config.js ([d0446cb](https://github.com/visulima/visulima/commit/d0446cb30b01547f86781a5b6094fc449337d387))
* **vite-overlay:** migrate deps to pnpm catalogs ([7553183](https://github.com/visulima/visulima/commit/7553183ae573d60405ab9f5227106eca8073f85c))
* **vite-overlay:** regenerate tanstack hydration example route tree ([11ceaa0](https://github.com/visulima/visulima/commit/11ceaa09ded9ff1223f99646b477b00ceeffea40))
* **vite-overlay:** update dependencies ([d93e9e0](https://github.com/visulima/visulima/commit/d93e9e06cc4563c9c9a087515b6701598057b2b3))
* **vite-overlay:** update dependencies ([53e7915](https://github.com/visulima/visulima/commit/53e7915ce97385edce947318aac47602bb11c905))
* **vite-overlay:** update dependencies ([622d520](https://github.com/visulima/visulima/commit/622d5209d4afefc082cbb9eb294d6aeee6f25bcb))
* **vite-overlay:** upgrade packem to 2.0.0-alpha.76 ([1fc8dc0](https://github.com/visulima/visulima/commit/1fc8dc0746374f8c6de5645527945693c21bcd62))
* year update ([47f4105](https://github.com/visulima/visulima/commit/47f410596ce7190cfea36a073db32e0cec50bbcd))

### Code Refactoring

* improve stack trace viewer and resolve original location utilities ([c6ff5c8](https://github.com/visulima/visulima/commit/c6ff5c85714944f34cd3f758eb4fc1d16271f5b6))
* **overlay:** improve balloon count display with animation and update styles for consistency ([146c2a7](https://github.com/visulima/visulima/commit/146c2a77b96ce9c61f6ae2d3fb85990fc73eab6b))
* replace inline import() types with top-level imports ([4569a4c](https://github.com/visulima/visulima/commit/4569a4ca04723da069f985855dcfab292f7347e1))
* resolve fallow dead-code across 13 packages ([8c458d2](https://github.com/visulima/visulima/commit/8c458d2eb17225ed48fc4bee4569e522912e8c3d))
* **vite-overlay:** apply Nothing design system ([c0376e5](https://github.com/visulima/visulima/commit/c0376e5237667c03692cabb25006f3a86e396bde)), closes [#D71921](https://github.com/visulima/visulima/issues/D71921)
* **vite-overlay:** replace vite-tsconfig-paths with native Vite 8 resolve.tsconfigPaths ([3d1e454](https://github.com/visulima/visulima/commit/3d1e454fd7d2e7178df2c795d50ad93927635a74))

### Tests

* improve coverage across packages ([91bd6d3](https://github.com/visulima/visulima/commit/91bd6d3b61736e3c8bd1fc59b0b5955f76a5d323))
* **vite-overlay:** cover solution finder, diff transformer, esbuild and stack-trace utils ([54455cf](https://github.com/visulima/visulima/commit/54455cf70f407104907a731ae299d430f3d90e92))
* **vite-overlay:** loosen flaky ReDoS-guard timing bound to 5s ([eb5e492](https://github.com/visulima/visulima/commit/eb5e492f685d724248d2b329f1c7d1f7116cdee1))

### Continuous Integration

* **fallow:** make fallow:health advisory (--report-only) ([d57148e](https://github.com/visulima/visulima/commit/d57148ea0e3556b4c24d8d336b9fa14987f5dc7d))


### Dependencies

* **@visulima/error:** upgraded to 6.0.0
* **@visulima/path:** upgraded to 3.0.0

## @visulima/vite-overlay [2.0.0-alpha.36](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@2.0.0-alpha.35...@visulima/vite-overlay@2.0.0-alpha.36) (2026-06-30)

### Styles

* cs fixes ([2a960bb](https://github.com/visulima/visulima/commit/2a960bb1772c9dc70080e2d75d3a0d827034e294))

### Miscellaneous Chores

* add fallow code-intelligence across all packages ([a3b4821](https://github.com/visulima/visulima/commit/a3b48215002e86fed20f2973038b5d4a0aa1ce04))

### Code Refactoring

* resolve fallow dead-code across 13 packages ([8c458d2](https://github.com/visulima/visulima/commit/8c458d2eb17225ed48fc4bee4569e522912e8c3d))

### Continuous Integration

* **fallow:** make fallow:health advisory (--report-only) ([d57148e](https://github.com/visulima/visulima/commit/d57148ea0e3556b4c24d8d336b9fa14987f5dc7d))


### Dependencies

* **@visulima/error:** upgraded to 6.0.0-alpha.35

## @visulima/vite-overlay [2.0.0-alpha.35](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@2.0.0-alpha.34...@visulima/vite-overlay@2.0.0-alpha.35) (2026-06-19)


### Dependencies

* **@visulima/error:** upgraded to 6.0.0-alpha.34

## @visulima/vite-overlay [2.0.0-alpha.34](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@2.0.0-alpha.33...@visulima/vite-overlay@2.0.0-alpha.34) (2026-06-13)

### Bug Fixes

* **vite-overlay:** harden xss/redos and fix suggestion ranking in overlay ([fa7d531](https://github.com/visulima/visulima/commit/fa7d531915bde1f0fe57226f4efdc1cc1fc00ec6))
* **vite-overlay:** restore plugin-hint fallback, Svelte hint, and XSS escaping ([15a4162](https://github.com/visulima/visulima/commit/15a41624c7f9045cebbd246821fb4a5cab28b07c))
* **vite-overlay:** sanitize markdown, cache dir walk ([5430c78](https://github.com/visulima/visulima/commit/5430c780ab97b692d8e968900ba7b2564f19944a))

### Miscellaneous Chores

* **vite-overlay:** apply prettier style cleanup to src and tests ([77f376b](https://github.com/visulima/visulima/commit/77f376bd9a04032af01ba53392882d2dc95e4619))


### Dependencies

* **@visulima/error:** upgraded to 6.0.0-alpha.33
* **@visulima/path:** upgraded to 3.0.0-alpha.13

## @visulima/vite-overlay [2.0.0-alpha.33](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@2.0.0-alpha.32...@visulima/vite-overlay@2.0.0-alpha.33) (2026-06-04)

### Bug Fixes

* **lint:** clear pre-existing eslint rot across packages ([#674](https://github.com/visulima/visulima/issues/674)) ([5354253](https://github.com/visulima/visulima/commit/5354253b163bd50bcefaf8a3fddf831bdb5df32b))
* **vite-overlay:** 3 bug fixes ([436844a](https://github.com/visulima/visulima/commit/436844a292272fe5b64442e2e638374e5d3df611))


### Dependencies

* **@visulima/error:** upgraded to 6.0.0-alpha.32
* **@visulima/path:** upgraded to 3.0.0-alpha.12

## @visulima/vite-overlay [2.0.0-alpha.32](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@2.0.0-alpha.31...@visulima/vite-overlay@2.0.0-alpha.32) (2026-06-02)

### Bug Fixes

* **tests:** revert unsafe vitest autofixes from the lint sweep ([378f27c](https://github.com/visulima/visulima/commit/378f27caa370f1d3188aef2ed36d46839abc88c4))

### Miscellaneous Chores

* apply eslint + prettier autofixes across packages ([c1bb784](https://github.com/visulima/visulima/commit/c1bb7848a0d93d0dfe2960c77e3cda22239c79a0))

### Tests

* improve coverage across packages ([91bd6d3](https://github.com/visulima/visulima/commit/91bd6d3b61736e3c8bd1fc59b0b5955f76a5d323))
* **vite-overlay:** cover solution finder, diff transformer, esbuild and stack-trace utils ([54455cf](https://github.com/visulima/visulima/commit/54455cf70f407104907a731ae299d430f3d90e92))


### Dependencies

* **@visulima/error:** upgraded to 6.0.0-alpha.31

## @visulima/vite-overlay [2.0.0-alpha.31](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@2.0.0-alpha.30...@visulima/vite-overlay@2.0.0-alpha.31) (2026-05-27)

### Bug Fixes

* **storage-client:** percent-encode user fields in defaultFingerprint ([7c78a0f](https://github.com/visulima/visulima/commit/7c78a0f9512e2a673b941d80839e9f1e86b7b5d0))

### Documentation

* prettier-format agent instructions ([71b6414](https://github.com/visulima/visulima/commit/71b6414528780ac82c4e0bb25b5f4f11faba5549))

### Miscellaneous Chores

* sorted package.json ([b47c545](https://github.com/visulima/visulima/commit/b47c545591600fdab17d5cd3a3fbc68b61e199da))


### Dependencies

* **@visulima/error:** upgraded to 6.0.0-alpha.30
* **@visulima/path:** upgraded to 3.0.0-alpha.11

## @visulima/vite-overlay [2.0.0-alpha.30](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@2.0.0-alpha.29...@visulima/vite-overlay@2.0.0-alpha.30) (2026-05-26)

### Miscellaneous Chores

* **ci-stability:** green CI across vis, native, lint, tests, attw ([#651](https://github.com/visulima/visulima/issues/651)) ([d4eb684](https://github.com/visulima/visulima/commit/d4eb684b5f75c818c9251048c605a0ed54a268e3))
* **repo:** sort package.json keys across all packages ([e1fd9ab](https://github.com/visulima/visulima/commit/e1fd9ab467ef96a98c777da1572ff6a50fcf7e71))


### Dependencies

* **@visulima/error:** upgraded to 6.0.0-alpha.28

## @visulima/vite-overlay [2.0.0-alpha.29](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@2.0.0-alpha.28...@visulima/vite-overlay@2.0.0-alpha.29) (2026-05-20)


### Dependencies

* **@visulima/error:** upgraded to 6.0.0-alpha.27

## @visulima/vite-overlay [2.0.0-alpha.28](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@2.0.0-alpha.27...@visulima/vite-overlay@2.0.0-alpha.28) (2026-05-19)


### Dependencies

* **@visulima/error:** upgraded to 6.0.0-alpha.26

## @visulima/vite-overlay [2.0.0-alpha.27](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@2.0.0-alpha.26...@visulima/vite-overlay@2.0.0-alpha.27) (2026-05-16)


### Dependencies

* **@visulima/error:** upgraded to 6.0.0-alpha.25

## @visulima/vite-overlay [2.0.0-alpha.26](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@2.0.0-alpha.25...@visulima/vite-overlay@2.0.0-alpha.26) (2026-05-14)

### Miscellaneous Chores

* **vite-overlay:** apply prettier and eslint formatting sweep ([21712b7](https://github.com/visulima/visulima/commit/21712b7acf46f2bef5b1b06c4087282267d9d433))


### Dependencies

* **@visulima/error:** upgraded to 6.0.0-alpha.24

## @visulima/vite-overlay [2.0.0-alpha.25](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@2.0.0-alpha.24...@visulima/vite-overlay@2.0.0-alpha.25) (2026-05-11)


### Dependencies

* **@visulima/error:** upgraded to 6.0.0-alpha.23

## @visulima/vite-overlay [2.0.0-alpha.24](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@2.0.0-alpha.23...@visulima/vite-overlay@2.0.0-alpha.24) (2026-05-11)


### Dependencies

* **@visulima/error:** upgraded to 6.0.0-alpha.22

## @visulima/vite-overlay [2.0.0-alpha.23](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@2.0.0-alpha.22...@visulima/vite-overlay@2.0.0-alpha.23) (2026-05-10)


### Dependencies

* **@visulima/error:** upgraded to 6.0.0-alpha.21

## @visulima/vite-overlay [2.0.0-alpha.22](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@2.0.0-alpha.21...@visulima/vite-overlay@2.0.0-alpha.22) (2026-05-10)


### Dependencies

* **@visulima/error:** upgraded to 6.0.0-alpha.20

## @visulima/vite-overlay [2.0.0-alpha.21](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@2.0.0-alpha.20...@visulima/vite-overlay@2.0.0-alpha.21) (2026-05-07)


### Dependencies

* **@visulima/error:** upgraded to 6.0.0-alpha.19

## @visulima/vite-overlay [2.0.0-alpha.20](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@2.0.0-alpha.19...@visulima/vite-overlay@2.0.0-alpha.20) (2026-05-07)


### Dependencies

* **@visulima/error:** upgraded to 6.0.0-alpha.18

## @visulima/vite-overlay [2.0.0-alpha.19](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@2.0.0-alpha.18...@visulima/vite-overlay@2.0.0-alpha.19) (2026-05-06)


### Dependencies

* **@visulima/error:** upgraded to 6.0.0-alpha.17

## @visulima/vite-overlay [2.0.0-alpha.18](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@2.0.0-alpha.17...@visulima/vite-overlay@2.0.0-alpha.18) (2026-05-06)

### Miscellaneous Chores

* **vite-overlay:** apply prettier and eslint quote-style auto-fix ([9778781](https://github.com/visulima/visulima/commit/9778781ec8e1542860cded3e7c05a3269345f5a3))
* **vite-overlay:** housekeeping cleanup ([de2491d](https://github.com/visulima/visulima/commit/de2491d209965aa66c0752a2f55263f0d335eadd))


### Dependencies

* **@visulima/error:** upgraded to 6.0.0-alpha.16

## @visulima/vite-overlay [2.0.0-alpha.17](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@2.0.0-alpha.16...@visulima/vite-overlay@2.0.0-alpha.17) (2026-05-04)


### Dependencies

* **@visulima/error:** upgraded to 6.0.0-alpha.15

## @visulima/vite-overlay [2.0.0-alpha.16](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@2.0.0-alpha.15...@visulima/vite-overlay@2.0.0-alpha.16) (2026-04-30)

### Miscellaneous Chores

* re-sort workspace package.json files via vis sort-package-json ([f625696](https://github.com/visulima/visulima/commit/f625696cfac974325774b3243e1a83c3d23acbd7))
* simplify pnpm-workspace packages list ([7cab221](https://github.com/visulima/visulima/commit/7cab221163632d9b7aa044a6f88c49083103a869))
* **vite-overlay:** upgrade packem to 2.0.0-alpha.76 ([1fc8dc0](https://github.com/visulima/visulima/commit/1fc8dc0746374f8c6de5645527945693c21bcd62))


### Dependencies

* **@visulima/error:** upgraded to 6.0.0-alpha.14

## @visulima/vite-overlay [2.0.0-alpha.15](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@2.0.0-alpha.14...@visulima/vite-overlay@2.0.0-alpha.15) (2026-04-22)

### Bug Fixes

* Remove JSR configuration generation script and generated jsr.json files ([#616](https://github.com/visulima/visulima/issues/616)) ([533744b](https://github.com/visulima/visulima/commit/533744b103b74896941db5b727173e617a27a63b))


### Dependencies

* **@visulima/error:** upgraded to 6.0.0-alpha.13
* **@visulima/path:** upgraded to 3.0.0-alpha.10

## @visulima/vite-overlay [2.0.0-alpha.14](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@2.0.0-alpha.13...@visulima/vite-overlay@2.0.0-alpha.14) (2026-04-21)

### Miscellaneous Chores

* jsr.json update and lock file ([73fce38](https://github.com/visulima/visulima/commit/73fce38c7cb4603f3fffb88609b1b18e2feb4937))


### Dependencies

* **@visulima/error:** upgraded to 6.0.0-alpha.12

## @visulima/vite-overlay [2.0.0-alpha.13](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@2.0.0-alpha.12...@visulima/vite-overlay@2.0.0-alpha.13) (2026-04-21)

### Miscellaneous Chores

* update the jsr.json ([864ab7e](https://github.com/visulima/visulima/commit/864ab7e71c4b5ae82f64792d1ae8debfea2c539b))


### Dependencies

* **@visulima/error:** upgraded to 6.0.0-alpha.11

## @visulima/vite-overlay [2.0.0-alpha.12](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@2.0.0-alpha.11...@visulima/vite-overlay@2.0.0-alpha.12) (2026-04-21)

### Bug Fixes

* **error-debugging:** resolve eslint and formatting issues ([7d0ada8](https://github.com/visulima/visulima/commit/7d0ada8787bf624df5a7d504448a4d1b69165aba))
* **error-debugging:** resolve eslint and type-safety issues ([886dbff](https://github.com/visulima/visulima/commit/886dbffe3f744c9493fcc54e781de3fd21eebf78))
* **vite-overlay:** cast function plugin through unknown for Plugin type ([4eeeb04](https://github.com/visulima/visulima/commit/4eeeb04a0e39fe9a5369daca5907bb96313f35ae))
* **vite-overlay:** resolve eslint and formatting issues ([6d62d6e](https://github.com/visulima/visulima/commit/6d62d6efd40ffd2c7517ef404875dc80de662260))

### Miscellaneous Chores

* **api-platform:** apply pending lint and source updates ([3fb0043](https://github.com/visulima/visulima/commit/3fb0043a4cf35f752ca89a09a077100ae0142da8))
* bump engines.node to ^22.14.0 || >=24.10.0 ([c3d0931](https://github.com/visulima/visulima/commit/c3d0931d1504e4f21ebf50ea680cfa7ce4ba15ce))
* fixed jsr.json ([5d85e51](https://github.com/visulima/visulima/commit/5d85e5179de38e284ec433b14d77c71a1619c8d6))
* remove unused deprecated aliases ([#612](https://github.com/visulima/visulima/issues/612)) ([24ee546](https://github.com/visulima/visulima/commit/24ee546bcb2c17b8915622e4878797c00aa1d813))
* **vite-overlay:** apply formatter and lint fixes ([bb14233](https://github.com/visulima/visulima/commit/bb142339d2a6dae661df8af1ae51d48dceaeb680))
* **vite-overlay:** apply pending changes ([82aa656](https://github.com/visulima/visulima/commit/82aa65600f7c178d0ab0c279b4dc2f08dffec6cd))
* **vite-overlay:** apply pending lint and source updates ([1b07e38](https://github.com/visulima/visulima/commit/1b07e381e4dbf9b4f8e0b3fa348e2dede8149cfe))
* **vite-overlay:** enforce curly braces and apply lint fixes ([7345554](https://github.com/visulima/visulima/commit/7345554634876ddbd01a4fae2171113a04ab7f4a))

### Code Refactoring

* replace inline import() types with top-level imports ([4569a4c](https://github.com/visulima/visulima/commit/4569a4ca04723da069f985855dcfab292f7347e1))


### Dependencies

* **@visulima/error:** upgraded to 6.0.0-alpha.10

## @visulima/vite-overlay [2.0.0-alpha.11](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@2.0.0-alpha.10...@visulima/vite-overlay@2.0.0-alpha.11) (2026-04-08)

### Bug Fixes

* remove deprecated baseUrl and downlevelIteration from tsconfigs ([a708366](https://github.com/visulima/visulima/commit/a708366b5c3bc73cfde480a712ed397bd921fb93))
* **vite-overlay:** properly fix eslint errors in code ([296daaa](https://github.com/visulima/visulima/commit/296daaa240daebe8b87f7706d07f9eb802106563))
* **vite-overlay:** remove remaining eslint suppressions with proper code fixes ([5d06168](https://github.com/visulima/visulima/commit/5d061688210a8c23a214f03407bcafb759b7656a))
* **vite-overlay:** resolve eslint errors ([816dd2b](https://github.com/visulima/visulima/commit/816dd2b55146247f56171854234b4e6e1f0bb2ed))

### Miscellaneous Chores

* **error-debugging:** remove empty dependency objects from package.json ([7eb7c8e](https://github.com/visulima/visulima/commit/7eb7c8eba1394e515fa77c0f56baf41c0810de2e))
* **vite-overlay:** add tsconfig.eslint.json for type-aware linting ([508f071](https://github.com/visulima/visulima/commit/508f071c3d6bdc3fc962899c102444d6d10e5932))
* **vite-overlay:** apply prettier formatting ([01e49b1](https://github.com/visulima/visulima/commit/01e49b1771db9b1158344ab6437dfba2b65f5c70))
* **vite-overlay:** clean up unnecessary comments in CSS ([b073df9](https://github.com/visulima/visulima/commit/b073df90b6b664d2d5762d68ba93c52bba5f31b4))
* **vite-overlay:** expand inline if-return to block syntax ([b41e0b4](https://github.com/visulima/visulima/commit/b41e0b417a5faf290df9c7c2d0e320929d43f56f))
* **vite-overlay:** expand inline if-return to block syntax ([786c763](https://github.com/visulima/visulima/commit/786c763420fcfc844d4b794eb9ede7d27c86d8ec))
* **vite-overlay:** migrate .prettierrc.cjs to prettier.config.js ([d0446cb](https://github.com/visulima/visulima/commit/d0446cb30b01547f86781a5b6094fc449337d387))

### Code Refactoring

* **vite-overlay:** apply Nothing design system ([c0376e5](https://github.com/visulima/visulima/commit/c0376e5237667c03692cabb25006f3a86e396bde)), closes [#D71921](https://github.com/visulima/visulima/issues/D71921)


### Dependencies

* **@visulima/error:** upgraded to 6.0.0-alpha.8
* **@visulima/path:** upgraded to 3.0.0-alpha.8

## @visulima/vite-overlay [2.0.0-alpha.10](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@2.0.0-alpha.9...@visulima/vite-overlay@2.0.0-alpha.10) (2026-03-26)

### Features

* **web:** auto-generate packages page from workspace metadata ([623e520](https://github.com/visulima/visulima/commit/623e5207693a7fe720f5f2f179593a3654c880e3))


### Dependencies

* **@visulima/error:** upgraded to 6.0.0-alpha.7
* **@visulima/path:** upgraded to 3.0.0-alpha.7

## @visulima/vite-overlay [2.0.0-alpha.9](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@2.0.0-alpha.8...@visulima/vite-overlay@2.0.0-alpha.9) (2026-03-26)

### Bug Fixes

* **vite-overlay:** use workspace:* for internal [@visulima](https://github.com/visulima) deps ([cf5aedc](https://github.com/visulima/visulima/commit/cf5aedcc8621fedf4a1b4f39b574699292f85a5a))
* **web:** improve build setup with incremental stats caching and prod install ([fe33e75](https://github.com/visulima/visulima/commit/fe33e75827586779b4b3a0c6d57b39f889ee6207))

### Miscellaneous Chores

* visulima website ([#591](https://github.com/visulima/visulima/issues/591)) ([59ab2e2](https://github.com/visulima/visulima/commit/59ab2e2befb03e51cd2088956f83d9b87de6d033))
* **vite-overlay:** migrate deps to pnpm catalogs ([7553183](https://github.com/visulima/visulima/commit/7553183ae573d60405ab9f5227106eca8073f85c))
* **vite-overlay:** update dependencies ([d93e9e0](https://github.com/visulima/visulima/commit/d93e9e06cc4563c9c9a087515b6701598057b2b3))

### Code Refactoring

* **vite-overlay:** replace vite-tsconfig-paths with native Vite 8 resolve.tsconfigPaths ([3d1e454](https://github.com/visulima/visulima/commit/3d1e454fd7d2e7178df2c795d50ad93927635a74))


### Dependencies

* **@visulima/error:** upgraded to 6.0.0-alpha.6
* **@visulima/path:** upgraded to 3.0.0-alpha.6

## @visulima/vite-overlay [2.0.0-alpha.8](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@2.0.0-alpha.7...@visulima/vite-overlay@2.0.0-alpha.8) (2026-03-06)

### Bug Fixes

* **vite-overlay:** fix formatting and minor code style issues ([ec96733](https://github.com/visulima/visulima/commit/ec9673362fdf82ff4dacaf03aeb1c59250cd4eb0))
* **vite-overlay:** replace rolldown-vite alias with vite@8 beta ([0596412](https://github.com/visulima/visulima/commit/0596412d437625183db5909d3b3ad1328293d8ef))
* **vite-overlay:** resolve ESLint errors and expand braceless if statements ([f837bcd](https://github.com/visulima/visulima/commit/f837bcd2a1a743290b63e7471d843a953fd75b54))
* **vite-overlay:** show balloon button alongside overlay for client errors ([6b9d8d4](https://github.com/visulima/visulima/commit/6b9d8d414ef1d21ab5ccee5f5a5aebb544d6f2c2))
* **vite-overlay:** update packem to 2.0.0-alpha.54 ([73b70e3](https://github.com/visulima/visulima/commit/73b70e398cda6ee38aed18fa798bd2198b732024))

### Miscellaneous Chores

* **vite-overlay:** regenerate tanstack hydration example route tree ([11ceaa0](https://github.com/visulima/visulima/commit/11ceaa09ded9ff1223f99646b477b00ceeffea40))
* **vite-overlay:** update dependencies ([53e7915](https://github.com/visulima/visulima/commit/53e7915ce97385edce947318aac47602bb11c905))
* year update ([47f4105](https://github.com/visulima/visulima/commit/47f410596ce7190cfea36a073db32e0cec50bbcd))


### Dependencies

* **@visulima/error:** upgraded to 6.0.0-alpha.5
* **@visulima/path:** upgraded to 3.0.0-alpha.5

## @visulima/vite-overlay [2.0.0-alpha.7](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@2.0.0-alpha.6...@visulima/vite-overlay@2.0.0-alpha.7) (2026-03-04)

### Bug Fixes

* added hint to the overlay back ([5df1227](https://github.com/visulima/visulima/commit/5df122779364090d10d60f440e61a595c7e1ee83))
* **vite-overlay:** clear balloon on HMR update and fix pre-existing TS errors ([6904661](https://github.com/visulima/visulima/commit/69046610f5a5c36ba68539ecb7a088cb767922ca))
* **vite-overlay:** explicitly override forms plugin background on editor select ([9614446](https://github.com/visulima/visulima/commit/96144461dd00fad5dad3dd1aa3976af1ec34a896)), closes [#fff](https://github.com/visulima/visulima/issues/fff) [select#editor-selector](https://github.com/visulima/select/issues/editor-selector)
* **vite-overlay:** fix all ESLint errors and prevent e2e specs from running in vitest ([c212416](https://github.com/visulima/visulima/commit/c212416be37c7bbe2276e440401103146838b8e5))
* **vite-overlay:** fix editor select chevron and options popup in dark/light mode ([69e3274](https://github.com/visulima/visulima/commit/69e327476990e4b37a300f6655bf73af0aba2060))
* **vite-overlay:** fix syntheticError typo, blank line lint error, and rewrite corrupted docs ([a990844](https://github.com/visulima/visulima/commit/a99084491d19f07704488d10ab4930c5b7b779d0))
* **vite-overlay:** resolve 10 runtime bugs in error overlay ([da43fcb](https://github.com/visulima/visulima/commit/da43fcb1eeec62e7855c3bcbc9f365613fa9001c))

### Documentation

* **vite-overlay:** fix incorrect BalloonConfig properties and add client API docs ([6f045cf](https://github.com/visulima/visulima/commit/6f045cf186dc9ca7552e3cd21ff959414ddf2b13))

## @visulima/vite-overlay [2.0.0-alpha.6](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@2.0.0-alpha.5...@visulima/vite-overlay@2.0.0-alpha.6) (2026-02-28)

### Features

* **dev-toolbar:** initialize dev-toolbar package  ([#586](https://github.com/visulima/visulima/issues/586)) ([a3ab9d6](https://github.com/visulima/visulima/commit/a3ab9d6e6c768853854b95fa8eee908b95235ea5))

### Documentation

* **error,error-handler,ono,inspector,source-map,vite-overlay:** add comprehensive Fumadocs documentation ([a0c8c92](https://github.com/visulima/visulima/commit/a0c8c92949cff2730fc6122f717fe344c030f366))

### Miscellaneous Chores

* **error-debugging:** update dependencies ([6002ece](https://github.com/visulima/visulima/commit/6002ece1803b2ba8261cff42a362dd6e8ddcc3ee))
* update lock file maintenance ([d83e716](https://github.com/visulima/visulima/commit/d83e71697b75d24704185b66bb521a934d2db02d))

## @visulima/vite-overlay [2.0.0-alpha.5](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@2.0.0-alpha.4...@visulima/vite-overlay@2.0.0-alpha.5) (2026-01-17)

### Miscellaneous Chores

* **vite-overlay:** update dependencies ([622d520](https://github.com/visulima/visulima/commit/622d5209d4afefc082cbb9eb294d6aeee6f25bcb))


### Dependencies

* **@visulima/error:** upgraded to 6.0.0-alpha.4

## @visulima/vite-overlay [2.0.0-alpha.4](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@2.0.0-alpha.3...@visulima/vite-overlay@2.0.0-alpha.4) (2025-12-27)

### Bug Fixes

* **vite-overlay:** update package files ([fd8f5c1](https://github.com/visulima/visulima/commit/fd8f5c13f384d945f3597b00cfdfaf615e100de9))

### Miscellaneous Chores

* **dependencies:** update msw to version 2.12.6, jsdom to version 27.4.0, and [@tanstack](https://github.com/tanstack) packages to version 1.144.0 in package.json files ([1aa0236](https://github.com/visulima/visulima/commit/1aa0236e1f8190eecf7526cf2dc0f369cac02d87))
* fixed project.json names and schema path ([964722f](https://github.com/visulima/visulima/commit/964722f691db205c7edb9aa6db29e849a647500b))

### Code Refactoring

* **overlay:** improve balloon count display with animation and update styles for consistency ([146c2a7](https://github.com/visulima/visulima/commit/146c2a77b96ce9c61f6ae2d3fb85990fc73eab6b))


### Dependencies

* **@visulima/error:** upgraded to 6.0.0-alpha.3
* **@visulima/path:** upgraded to 3.0.0-alpha.4

## @visulima/vite-overlay [2.0.0-alpha.3](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@2.0.0-alpha.2...@visulima/vite-overlay@2.0.0-alpha.3) (2025-12-11)

### Bug Fixes

* update license information and add badges in README files ([340af5d](https://github.com/visulima/visulima/commit/340af5d227b3450a86da7861eeea5fee63ab4446))
* update package OG images across multiple packages ([f08e4dd](https://github.com/visulima/visulima/commit/f08e4dd2b105ccb29c8412020a9c2be36d6c1e9e))

### Miscellaneous Chores

* update package dependencies and improve configuration ([4ed22d6](https://github.com/visulima/visulima/commit/4ed22d6511aa8150dcd4ba7b9dccf05dbe2d6adc))

### Code Refactoring

* improve stack trace viewer and resolve original location utilities ([c6ff5c8](https://github.com/visulima/visulima/commit/c6ff5c85714944f34cd3f758eb4fc1d16271f5b6))


### Dependencies

* **@visulima/error:** upgraded to 6.0.0-alpha.2
* **@visulima/path:** upgraded to 3.0.0-alpha.3

## @visulima/vite-overlay [2.0.0-alpha.2](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@2.0.0-alpha.1...@visulima/vite-overlay@2.0.0-alpha.2) (2025-12-11)

### Bug Fixes

* update dependencies and improve error handling in error-debugging packages ([b95fea4](https://github.com/visulima/visulima/commit/b95fea4ef0e0a6777b3dd465603b1dd3c40aa4e8))

## @visulima/vite-overlay [2.0.0-alpha.1](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@1.3.7...@visulima/vite-overlay@2.0.0-alpha.1) (2025-12-07)

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

## @visulima/vite-overlay [1.3.7](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@1.3.6...@visulima/vite-overlay@1.3.7) (2025-11-13)

### Bug Fixes

* bump packem, to fix minified version of the code ([2a36ceb](https://github.com/visulima/visulima/commit/2a36ceb09251b0ca1178701a26547a871ed717a7))


### Dependencies

* **@visulima/error:** upgraded to 5.0.6
* **@visulima/path:** upgraded to 2.0.5

## @visulima/vite-overlay [1.3.6](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@1.3.5...@visulima/vite-overlay@1.3.6) (2025-11-12)

### Bug Fixes

* update package configurations and TypeScript definitions ([b59aa59](https://github.com/visulima/visulima/commit/b59aa59dac1508216b944f4b917fb4a7ab1f70a4))

### Miscellaneous Chores

* Add jsr file to all packages for release ([#565](https://github.com/visulima/visulima/issues/565)) ([ec91652](https://github.com/visulima/visulima/commit/ec91652b4e4112adf14ba152c1239a7703ba425a))


### Dependencies

* **@visulima/error:** upgraded to 5.0.5
* **@visulima/path:** upgraded to 2.0.4

## @visulima/vite-overlay [1.3.5](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@1.3.4...@visulima/vite-overlay@1.3.5) (2025-11-07)

### Bug Fixes

* update TypeScript configurations and improve linting across multiple packages ([6f25ec7](https://github.com/visulima/visulima/commit/6f25ec7841da7246f8f9166efc5292a7089d37ee))

### Miscellaneous Chores

* update npm and pnpm configurations for monorepo optimization ([#564](https://github.com/visulima/visulima/issues/564)) ([5512b42](https://github.com/visulima/visulima/commit/5512b42f672c216b6a3c9e39035199a4ebd9a4b8))


### Dependencies

* **@visulima/error:** upgraded to 5.0.4
* **@visulima/path:** upgraded to 2.0.3

## @visulima/vite-overlay [1.3.4](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@1.3.3...@visulima/vite-overlay@1.3.4) (2025-11-05)

### Bug Fixes

* update dependencies across multiple packages ([36a47f2](https://github.com/visulima/visulima/commit/36a47f26d65d25a7b4d8371186710e7d0ab61a2b))

### Miscellaneous Chores

* update dependencies across multiple packages ([c526462](https://github.com/visulima/visulima/commit/c52646260c2ae8bbf85692e642f305f47a158d4e))


### Dependencies

* **@visulima/error:** upgraded to 5.0.3
* **@visulima/path:** upgraded to 2.0.2

## @visulima/vite-overlay [1.3.3](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@1.3.2...@visulima/vite-overlay@1.3.3) (2025-10-22)

### Bug Fixes

* **vite-overlay:** fix [#556](https://github.com/visulima/visulima/issues/556) broken args split on the console overwrite ([6e68419](https://github.com/visulima/visulima/commit/6e684196e66e772ebb3f4d842cf2b97ffc211d29))

### Miscellaneous Chores

* update package dependencies and configurations ([7bfe7e7](https://github.com/visulima/visulima/commit/7bfe7e71869580900aab50efb064b4293994ed9a))

## @visulima/vite-overlay [1.3.2](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@1.3.1...@visulima/vite-overlay@1.3.2) (2025-10-21)

### Bug Fixes

* allowed node v25 ([ffaa4b1](https://github.com/visulima/visulima/commit/ffaa4b1ce46b7153594f051f08f9ab7b2686d6ee))


### Dependencies

* **@visulima/error:** upgraded to 5.0.2
* **@visulima/path:** upgraded to 2.0.1

## @visulima/vite-overlay [1.3.1](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@1.3.0...@visulima/vite-overlay@1.3.1) (2025-10-20)

### Miscellaneous Chores

* **deps:** update package versions and dependencies ([88d8d32](https://github.com/visulima/visulima/commit/88d8d32c4629a7a06c8770369191da2cc81087cc))
* update package dependencies across multiple packages ([17e3f23](https://github.com/visulima/visulima/commit/17e3f2377c8a3f98e2eed2192c5adaf6e32558b5))


### Dependencies

* **@visulima/error:** upgraded to 5.0.1

## @visulima/vite-overlay [1.3.0](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@1.2.1...@visulima/vite-overlay@1.3.0) (2025-10-15)

### Features

* enhance error overlay with location extraction and comprehensive docs ([13c6336](https://github.com/visulima/visulima/commit/13c63366c6e4a462f89da56fe10ad4f5d7cf875f))

### Bug Fixes

* enhance linting commands and update package dependencies for improved performance ([cdbda6b](https://github.com/visulima/visulima/commit/cdbda6bd693d0618b58525e8fe10eb45d90eb6f5))
* update @visulima/packem to 2.0.0-alpha.32 across multiple packages for improved compatibility ([27b346e](https://github.com/visulima/visulima/commit/27b346eaa1c0fb0e420d9a9824482028307f4249))
* update devDependencies and packem configuration ([db05ef1](https://github.com/visulima/visulima/commit/db05ef1f50c6efa73be2ab8f1362fa90587fafeb))

### Miscellaneous Chores

* update package dependencies across multiple packages for improved compatibility and performance ([9567591](https://github.com/visulima/visulima/commit/9567591c415da3002f3a4fe08f8caf7ce01ca5f7))
* update package versions in examples and pnpm-lock.yaml for improved compatibility ([af9b5b5](https://github.com/visulima/visulima/commit/af9b5b563c8bcff0ad8da3c51278a13b320cfe96))

### Code Refactoring

* rename forwardClientLogs to forwardConsole in error overlay configuration ([98389e7](https://github.com/visulima/visulima/commit/98389e7e7ef63d8fbbd48fb4595bdeb34c636b37))


### Dependencies

* **@visulima/error:** upgraded to 5.0.0
* **@visulima/path:** upgraded to 2.0.0

## @visulima/vite-overlay [1.2.1](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@1.2.0...@visulima/vite-overlay@1.2.1) (2025-10-02)

### Bug Fixes

* **vite-overlay:**  added missing default empty object ([f065c04](https://github.com/visulima/visulima/commit/f065c049f269613033284ea6b3ad08f66274f00d))

## @visulima/vite-overlay [1.2.0](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@1.1.1...@visulima/vite-overlay@1.2.0) (2025-10-01)

### Features

* **vite-overlay:** add client error history to vite overlay ([#528](https://github.com/visulima/visulima/issues/528)) ([29b7908](https://github.com/visulima/visulima/commit/29b79085f7ffe1b3c14f59f87ef76514eed8291c))

## @visulima/vite-overlay [1.1.1](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@1.1.0...@visulima/vite-overlay@1.1.1) (2025-09-24)

### Bug Fixes

* **vite-overlay:** improve error processing logic ([b03dffc](https://github.com/visulima/visulima/commit/b03dffc589b7aa6d26528ac001cd54d50cdbf7e8))

## @visulima/vite-overlay [1.1.0](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@1.0.2...@visulima/vite-overlay@1.1.0) (2025-09-24)

### Features

* **vite-overlay:** improve react hydration error handling ([#526](https://github.com/visulima/visulima/issues/526)) ([d82e0ad](https://github.com/visulima/visulima/commit/d82e0ad94bafc4c23af0e5d4745c3a23a8d4746f))

## @visulima/vite-overlay [1.0.2](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@1.0.1...@visulima/vite-overlay@1.0.2) (2025-09-23)


### Dependencies

* **@visulima/error:** upgraded to 4.6.2

## @visulima/vite-overlay [1.0.1](https://github.com/visulima/visulima/compare/@visulima/vite-overlay@1.0.0...@visulima/vite-overlay@1.0.1) (2025-09-20)

### Bug Fixes

* **vite-overlay:** correct import statement in README.md for errorOverlay ([8f4907d](https://github.com/visulima/visulima/commit/8f4907d176b05b549616e3b6df98147aea062ac3))
* **vite-overlay:** update dependencies and improve error handling ([7c58b6a](https://github.com/visulima/visulima/commit/7c58b6aca8a84dc2073ecb53dd0513b0f7cc8d60))

## @visulima/vite-overlay 1.0.0 (2025-09-20)

### Features

* **vite-overlay:** add initial implementation ([#517](https://github.com/visulima/visulima/issues/517)) ([2ff67ee](https://github.com/visulima/visulima/commit/2ff67ee316ee517f1c55b39b27a10aebb82dd4b9))
