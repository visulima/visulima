## @visulima/dev-toolbar 1.0.0 (2026-07-03)

### Features

* **dev-toolbar:** add accessibility info capture to inspector ([2b98ee6](https://github.com/visulima/visulima/commit/2b98ee6249759d1d2c42504354ebf3a92db4a6e6))
* **dev-toolbar:** add assets app export and make axe-core an optional peer dependency ([812bc8d](https://github.com/visulima/visulima/commit/812bc8d45ef760862d43f59665e1f86c7d4a5008))
* **dev-toolbar:** add custom Select component replacing native <select> ([c9c8685](https://github.com/visulima/visulima/commit/c9c8685ea3a05c28ea89d5f5d852d56bc8cbcad0))
* **dev-toolbar:** add editor option to configure launch-editor per project ([2003693](https://github.com/visulima/visulima/commit/200369383470a835c5312b8af7b11e4d4183c369))
* **dev-toolbar:** add JSX source injection Vite plugin for inspector click-to-source ([2c5c5a6](https://github.com/visulima/visulima/commit/2c5c5a65399cd8cb14b10c83a9346364e7ca3ecd))
* **dev-toolbar:** add light/dark theme awareness to inspector overlays ([2bd30ee](https://github.com/visulima/visulima/commit/2bd30eeb9e7047894d8287a63b4719873df22375))
* **dev-toolbar:** add open-in-editor, copy HTML, and copy path to inspector ([f88e9b0](https://github.com/visulima/visulima/commit/f88e9b0d21979dd1214c511a9474b0204bb16191))
* **dev-toolbar:** add Preact-native UI kit and migrate apps to use it ([2fced8e](https://github.com/visulima/visulima/commit/2fced8e8547409ad9d39fd9af2a81010a5fd1999))
* **dev-toolbar:** add removeDevtoolsOnBuild option to Vite plugin ([d8d1d67](https://github.com/visulima/visulima/commit/d8d1d67a20747df23da60e4d81a2acd89516dc48))
* **dev-toolbar:** add singleton guard, SEO JSON-LD validation, editor preference, and tests ([7584425](https://github.com/visulima/visulima/commit/758442518f8390b1faa0fd553d7ed1aaa4d9c037))
* **dev-toolbar:** add viewport rulers with draggable guidelines to inspector ([9df079a](https://github.com/visulima/visulima/commit/9df079a83563b1afc617d76df78259082ea98817))
* **dev-toolbar:** add visual annotation system with MCP agent integration ([be88cfe](https://github.com/visulima/visulima/commit/be88cfe30f3f624075167762e9c9780653dd34e9))
* **dev-toolbar:** implement iframe app rendering and custom app registration ([a1585a8](https://github.com/visulima/visulima/commit/a1585a8bd3624ae13b40fa386cd66b62c29ca08f))
* **dev-toolbar:** implement timeline event capture for HMR, network and JS errors ([9851ac7](https://github.com/visulima/visulima/commit/9851ac7a12a3b72d52b4f705c2afa7ecbfdf3cc0))
* **dev-toolbar:** initialize dev-toolbar package  ([#586](https://github.com/visulima/visulima/issues/586)) ([a3ab9d6](https://github.com/visulima/visulima/commit/a3ab9d6e6c768853854b95fa8eee908b95235ea5))
* **dev-toolbar:** keep inspector active after element click and fix UX issues ([8f7e88a](https://github.com/visulima/visulima/commit/8f7e88a874f6412a15bf2adde9ddd95948b07c22))
* **dev-toolbar:** overhaul vite config app UI with env masking and improved layout ([7cfee9d](https://github.com/visulima/visulima/commit/7cfee9da5957fb9ffbcc940d9948909c4677efb6))
* **dev-toolbar:** redesign annotation popups, add toast notifications, improve docs ([cca080f](https://github.com/visulima/visulima/commit/cca080fc6098a692e681ee5b140f8c5c3a810a2c))
* **dev-toolbar:** redesign vite config app with tabbed interface ([087df63](https://github.com/visulima/visulima/commit/087df630dc378933e54d1587d40c99f19fca0df0))
* **dev-toolbar:** remove more overflow app ([cd3f369](https://github.com/visulima/visulima/commit/cd3f369c176c598d2e9a2bcdef194b7d457d343f))
* **web:** auto-generate packages page from workspace metadata ([623e520](https://github.com/visulima/visulima/commit/623e5207693a7fe720f5f2f179593a3654c880e3))

### Bug Fixes

* allowed vite 8 ([807071e](https://github.com/visulima/visulima/commit/807071ea041e1beaf7e773ac6bbd23efa9f33b32))
* **api-platform:** use workspace:* for internal [@visulima](https://github.com/visulima) deps ([daa2b0b](https://github.com/visulima/visulima/commit/daa2b0bfb491b42bc83c369fec2dcd7950f082b0))
* **dev-toolbar:** 3 bug fixes ([ff28161](https://github.com/visulima/visulima/commit/ff281617a8346dcfae90db522507b8a7c0c94c61))
* **dev-toolbar:** add missing DOM property types and tighten getOptionValue fallback ([55326d0](https://github.com/visulima/visulima/commit/55326d02b173211608aefa994aa0e5f54705120d))
* **dev-toolbar:** add suppressHydrationWarning to prevent SSR hydration mismatch ([3c5d8e0](https://github.com/visulima/visulima/commit/3c5d8e0eb7eaf786dbe029598f50dfb2b5ce68a6))
* **dev-toolbar:** address code review findings across toolbar components ([449a300](https://github.com/visulima/visulima/commit/449a300226e4ccaee52ad258d5eccf6f77a72343))
* **dev-toolbar:** align inspector floating badge with main toolbar styling ([8ea1814](https://github.com/visulima/visulima/commit/8ea1814b596126b71231fd124c036f1e450275ef))
* **dev-toolbar:** align UI components and inspector with design system ([93ff58b](https://github.com/visulima/visulima/commit/93ff58b88e61d2eab8b3289cf3ad76028380a45f))
* **dev-toolbar:** audit Select component, add tests, fix pre-existing type error ([c8452d3](https://github.com/visulima/visulima/commit/c8452d3b495e9707579490155e6689c40cff9568))
* **dev-toolbar:** auto-detect TanStack Start and shield Preact from React Compiler ([6e9fa57](https://github.com/visulima/visulima/commit/6e9fa571ded1ff53d8809cee47fb404897320e9f))
* **dev-toolbar:** bound annotation and thread growth ([c07b6f1](https://github.com/visulima/visulima/commit/c07b6f1f7994d4160977bc286acc5b5b7d68d249))
* **dev-toolbar:** bump @babel/parser to v8 and fix vite 8 source-map type ([eb8a111](https://github.com/visulima/visulima/commit/eb8a1110eb9a5ae6acedc55d970d10e896a16950))
* **dev-toolbar:** cast form element to AnnotationElement shape ([618e91e](https://github.com/visulima/visulima/commit/618e91e5535a75f1d2d0132e0f7085987af79b34))
* **dev-toolbar:** correct broken test assertions for settings, button, input, and textarea ([770100f](https://github.com/visulima/visulima/commit/770100f5a73b634e65373fb2b2e344a353a0978c))
* **dev-toolbar:** correct Tailwind v4 PostCSS setup in TanStack Start examples ([090da58](https://github.com/visulima/visulima/commit/090da58cbbd87695c238dfd1f7371a6f06b9ef80))
* **dev-toolbar:** dismiss tooltip on button click ([0ed60af](https://github.com/visulima/visulima/commit/0ed60af72f2390f8fcebde063d35e45e6f7fe9b8))
* **dev-toolbar:** exclude inspector and tailwind from More "Additional Apps" ([812252a](https://github.com/visulima/visulima/commit/812252a96916ac346765631a0997ff2150e54e40))
* **dev-toolbar:** fix coordinate bugs, orphaned elements, and doc inaccuracies ([efa9c54](https://github.com/visulima/visulima/commit/efa9c544c9a8591c6efe6fd4a9995b411c054f54))
* **dev-toolbar:** fix inspector by closing panel during inspection and move settings to bottom ([575e79c](https://github.com/visulima/visulima/commit/575e79ce2c581c0f48eae55589c83d9dbb30b6f1))
* **dev-toolbar:** handle CJS/ESM interop for axe-core dynamic import ([7a86907](https://github.com/visulima/visulima/commit/7a8690730b7c7858beb635dc1d66869d5b5e19e2))
* **dev-toolbar:** harden readFile rpc and fix dev-toolbar docs/perf ([385f279](https://github.com/visulima/visulima/commit/385f279d911d5f9df9290b33151fb62411bdd5b9))
* **dev-toolbar:** hide action-only apps (e.g. Inspector) from canvas sidebar ([9fcf7e1](https://github.com/visulima/visulima/commit/9fcf7e1786ec4b7c1666da6500f011eff13a2fd2))
* **dev-toolbar:** move removePopupOutsideHandler declaration before first use ([d734a84](https://github.com/visulima/visulima/commit/d734a847b7f0b4574f081b9b78b2fce3d2b0e698))
* **dev-toolbar:** open inspector popup at click point and add visible drag handle ([c012aed](https://github.com/visulima/visulima/commit/c012aed47eeabf2047d5a7a7e46cab807de902f3))
* **dev-toolbar:** prevent action buttons from opening the canvas panel ([113e540](https://github.com/visulima/visulima/commit/113e540bb19d5dbedc6fbef9138bf04d2434b7f1))
* **dev-toolbar:** prevent hydration mismatch from data-vdt-source in SSR apps ([231ecc7](https://github.com/visulima/visulima/commit/231ecc73f70a49da4a6cd0b584760d12369bd8f0))
* **dev-toolbar:** prevent querySelector crash on area selection element paths ([ecd64d4](https://github.com/visulima/visulima/commit/ecd64d4b418e74cc582da0cd5efdb9f5e8e95d2b))
* **dev-toolbar:** remove redundant server arg from RPC function dispatch ([a941dc7](https://github.com/visulima/visulima/commit/a941dc7e593d3681bed61b374262abb8a476392b))
* **dev-toolbar:** replace bogus .toBe(true) assertions with proper matchers ([e672ca4](https://github.com/visulima/visulima/commit/e672ca459bf8d3e9141e277755bc35f2b59dac07))
* **dev-toolbar:** replace require() with dynamic import() in openInEditor ([3fede74](https://github.com/visulima/visulima/commit/3fede740db2c431c6bb62897d13a0d9afb8cc65a))
* **dev-toolbar:** resolve all ESLint errors across src files ([165b471](https://github.com/visulima/visulima/commit/165b471c95099bff76ba78d054664e79cfcdcb9a))
* **dev-toolbar:** resolve all TypeScript, ESLint, and Prettier errors in annotation system ([2fae465](https://github.com/visulima/visulima/commit/2fae4658017d61262293a41bef13348bbfc70e41))
* **dev-toolbar:** resolve eslint errors ([225128a](https://github.com/visulima/visulima/commit/225128ab192d318b9d997ad793c7c43384e2431e))
* **dev-toolbar:** resolve ESLint errors in test files and config ([ea7e46c](https://github.com/visulima/visulima/commit/ea7e46c13db73431738a8f75febb847f3e7e530b))
* **dev-toolbar:** resolve ESLint errors in vite-config app and RPC function ([fedce68](https://github.com/visulima/visulima/commit/fedce686ca59ba5d5b82cd10abfffa8d91a738c1))
* **dev-toolbar:** resolve import/no-named-as-default eslint error ([#686](https://github.com/visulima/visulima/issues/686)) ([87964f5](https://github.com/visulima/visulima/commit/87964f587e9b13fff0ea8b7ea8f058e847d7c015))
* **dev-toolbar:** resolve type errors in annotation overlay and perf monitor ([b201aa6](https://github.com/visulima/visulima/commit/b201aa6605a9fa030ce74f58743e10a042183156))
* **dev-toolbar:** scope JSX inject to enclosing function ([1b7e82a](https://github.com/visulima/visulima/commit/1b7e82af78cd599bd35b58a2f3e232c25b7e5192))
* **dev-toolbar:** silence unnecessary-type-assertion on form element cast ([86282de](https://github.com/visulima/visulima/commit/86282de06a3581be69210a12f12e307ac6ca99c8))
* **dev-toolbar:** split RPC barrel and fix open-in-editor with launch-editor ([28e079a](https://github.com/visulima/visulima/commit/28e079afa10ac4ed2e729205f8bdf9405d33c1c2))
* **dev-toolbar:** split single-line mock factories to satisfy max-statements-per-line ([025b972](https://github.com/visulima/visulima/commit/025b9722b6e854cf1ae53694597e64c63493f730))
* **dev-toolbar:** update packem to 2.0.0-alpha.54 ([f9779c9](https://github.com/visulima/visulima/commit/f9779c9e8dc7637db3bfef341cb66233469f653f))
* **dev-toolbar:** use appendTo in TanStack Start examples for SSR ([0844250](https://github.com/visulima/visulima/commit/0844250edbeeda1dfdc28058316bb6303e91fda6))
* **dev-toolbar:** use correct ARIA role in select search tests ([2e1ddfe](https://github.com/visulima/visulima/commit/2e1ddfed1b49697a2d772c5a6b61bf3b6538a43b))
* **dev-toolbar:** use HMR WebSocket RPC to open files in editor ([a63cdab](https://github.com/visulima/visulima/commit/a63cdab1c30f9f73eb6b5f59f7c1ee4143135eba))
* **dev-toolbar:** use original file positions to prevent SSR hydration mismatch ([a40edd5](https://github.com/visulima/visulima/commit/a40edd5fb1a11a5208182dd71627b472f64db6c5))
* **dev-toolbar:** use workspace:* for internal [@visulima](https://github.com/visulima) deps ([26ea008](https://github.com/visulima/visulima/commit/26ea00878218a34f89587fb9a2157cb379e98733))
* **error-debugging:** resolve eslint and type-safety issues ([886dbff](https://github.com/visulima/visulima/commit/886dbffe3f744c9493fcc54e781de3fd21eebf78))
* remove deprecated baseUrl and downlevelIteration from tsconfigs ([a708366](https://github.com/visulima/visulima/commit/a708366b5c3bc73cfde480a712ed397bd921fb93))
* Remove JSR configuration generation script and generated jsr.json files ([#616](https://github.com/visulima/visulima/issues/616)) ([533744b](https://github.com/visulima/visulima/commit/533744b103b74896941db5b727173e617a27a63b))
* removed old test ([bfa9e78](https://github.com/visulima/visulima/commit/bfa9e784b2e183ed481d432290070ee554b357ac))
* resolve failing tests across multiple packages ([2b4b6f0](https://github.com/visulima/visulima/commit/2b4b6f04169b60fdc4cf77b293015436a272c0fb))
* **security:** address codeql findings across packages ([3366f9c](https://github.com/visulima/visulima/commit/3366f9c07d54bdde5242fbd90780baa4634de179))
* **storage-client:** percent-encode user fields in defaultFingerprint ([7c78a0f](https://github.com/visulima/visulima/commit/7c78a0f9512e2a673b941d80839e9f1e86b7b5d0))
* **tui:** inline component and hook barrel exports in ink entry ([1cf8dd2](https://github.com/visulima/visulima/commit/1cf8dd25c91a2001268fb9d964d95df649bf7832))
* **web:** improve build setup with incremental stats caching and prod install ([fe33e75](https://github.com/visulima/visulima/commit/fe33e75827586779b4b3a0c6d57b39f889ee6207))

### Performance Improvements

* **dev-toolbar:** replace tailwind-merge with clsx in cn() utility ([6c4740c](https://github.com/visulima/visulima/commit/6c4740c8ce890d955cecbf634dada65fd8a99769))

### Documentation

* **dev-toolbar:** add assets app documentation ([bea25b9](https://github.com/visulima/visulima/commit/bea25b96f7f7dbb2f3952b6c04d38d032569760d))
* **dev-toolbar:** add iframe app documentation and remove more app references ([03dab85](https://github.com/visulima/visulima/commit/03dab85a92c5ee27b18db018c9dc263a1a3f1ea4))
* **dev-toolbar:** add vite-overlay integration guide ([8f6f25a](https://github.com/visulima/visulima/commit/8f6f25aae43f0c32380ede56a93915897a4a939f))
* **dev-toolbar:** document appendTo for SSR frameworks (TanStack Start) ([eba507e](https://github.com/visulima/visulima/commit/eba507eba8d0b705f23f32e7c08dc40fca87473a))
* **dev-toolbar:** document removeDevtoolsOnBuild option ([00955b2](https://github.com/visulima/visulima/commit/00955b2a484df78f66b4c58babbeb514d4943285))
* **dev-toolbar:** update a11y docs to reflect optional axe-core peer dependency ([50396e8](https://github.com/visulima/visulima/commit/50396e8b18c56e716d119a468fa0b1219e789dff))
* **dev-toolbar:** update built-in app docs for opt-in defaults and add SEO structured data section ([e95050a](https://github.com/visulima/visulima/commit/e95050aa419fe1a85664ccd5c88a3967de70b113))
* **dev-toolbar:** update docs for all recent feature additions ([b204e0f](https://github.com/visulima/visulima/commit/b204e0f8956cafb6967363fa0cc2b01c435cdedc))
* **dev-toolbar:** update examples to use native Vite 8 resolve.tsconfigPaths ([d54d3f7](https://github.com/visulima/visulima/commit/d54d3f71714fc600e4b965e1ab2bdbe0cc442ba6))
* prettier-format agent instructions ([71b6414](https://github.com/visulima/visulima/commit/71b6414528780ac82c4e0bb25b5f4f11faba5549))

### Styles

* cs fixes ([2a960bb](https://github.com/visulima/visulima/commit/2a960bb1772c9dc70080e2d75d3a0d827034e294))

### Miscellaneous Chores

* add fallow code-intelligence across all packages ([a3b4821](https://github.com/visulima/visulima/commit/a3b48215002e86fed20f2973038b5d4a0aa1ce04))
* added og images ([02d9d1e](https://github.com/visulima/visulima/commit/02d9d1e47be3ce75679ea89e857dc4e4bfe4946b))
* **api-platform:** apply pending lint and source updates ([3fb0043](https://github.com/visulima/visulima/commit/3fb0043a4cf35f752ca89a09a077100ae0142da8))
* apply eslint + prettier autofixes across packages ([c1bb784](https://github.com/visulima/visulima/commit/c1bb7848a0d93d0dfe2960c77e3cda22239c79a0))
* apply linting and formatting fixes across packages ([5d150a5](https://github.com/visulima/visulima/commit/5d150a578f9ce861c791843c683deeb849b774a9))
* apply safe prettier and eslint formatting ([05120af](https://github.com/visulima/visulima/commit/05120af8c898d18c495575680f01134681e29b65))
* bump engines.node to ^22.14.0 || >=24.10.0 ([c3d0931](https://github.com/visulima/visulima/commit/c3d0931d1504e4f21ebf50ea680cfa7ce4ba15ce))
* **ci-stability:** green CI across vis, native, lint, tests, attw ([#651](https://github.com/visulima/visulima/issues/651)) ([d4eb684](https://github.com/visulima/visulima/commit/d4eb684b5f75c818c9251048c605a0ed54a268e3))
* deps update ([9be09e9](https://github.com/visulima/visulima/commit/9be09e95e2bce8fe52e88b186c43b8cc6bae865c))
* **dev-toolbar:** add framework examples for six setups ([38117c1](https://github.com/visulima/visulima/commit/38117c1e0d6d8d3abb94785d95780482f5870d5c))
* **dev-toolbar:** add TanStack Start + Cloudflare Pages example ([1463ef8](https://github.com/visulima/visulima/commit/1463ef892669215bdc71fe90048e40cfbb4907c0))
* **dev-toolbar:** add TanStack Start and Cloudflare examples ([ddfe175](https://github.com/visulima/visulima/commit/ddfe17571bb416712eb02f4ae0222d182bdc2844))
* **dev-toolbar:** add tsconfig.eslint.json for type-aware linting ([d2c864a](https://github.com/visulima/visulima/commit/d2c864a01f9c4805975596c9de8af4a04ac4beaa))
* **dev-toolbar:** allow zod v4 and align eslint-plugin-zod with catalog ([70733ad](https://github.com/visulima/visulima/commit/70733ad6155c3bc460d2bc0943f88af59b7b6725))
* **dev-toolbar:** apply auto-fix formatting ([3a80a7d](https://github.com/visulima/visulima/commit/3a80a7daaadcc9705ebb153bfea617e4a5029379))
* **dev-toolbar:** apply formatter and type refinements ([167c654](https://github.com/visulima/visulima/commit/167c654ae2f7c57a4ff7d0c84f5196de4a72c8d7))
* **dev-toolbar:** apply lint-driven style cleanup across src and tests ([b1f004d](https://github.com/visulima/visulima/commit/b1f004d661a6b41184e1dab57d291045e6908f72))
* **dev-toolbar:** apply pending changes ([e16638c](https://github.com/visulima/visulima/commit/e16638c00907a4612fa53f74f141bd3aac9f6ca9))
* **dev-toolbar:** apply pending lint and source updates ([ece08e1](https://github.com/visulima/visulima/commit/ece08e16c85e927d1eead02eea69f15d5ea1a3dc))
* **dev-toolbar:** apply prettier and eslint quote-style auto-fix ([3bb9b50](https://github.com/visulima/visulima/commit/3bb9b50337d5bbc0e3a1bd372a69ceebad1fb188))
* **dev-toolbar:** apply prettier formatting ([a6d5528](https://github.com/visulima/visulima/commit/a6d5528602966810f03eb30c7883b8fd53088d40))
* **dev-toolbar:** bump peer ranges for @modelcontextprotocol/sdk and vite ([b6bbb40](https://github.com/visulima/visulima/commit/b6bbb406766e74f822ffe9956e85acf5feaa1ded))
* **dev-toolbar:** enable a11y in tanstack-start-cloudflare example and fix LICENSE whitespace ([e02cd3e](https://github.com/visulima/visulima/commit/e02cd3edf2426c709d8247cc77f999f56315438e))
* **dev-toolbar:** enforce curly braces and apply lint fixes ([1b6797e](https://github.com/visulima/visulima/commit/1b6797ec1844979a7bb3ac3aa094e42a4fe3a68b))
* **dev-toolbar:** expand braceless if statements to block syntax ([b059279](https://github.com/visulima/visulima/commit/b059279c444036b52c94515d852ec20cd782692e))
* **dev-toolbar:** expand inline if-return to block syntax ([db834ab](https://github.com/visulima/visulima/commit/db834ab5b42ff3dca9ef90e478c690e8367d4df8))
* **dev-toolbar:** expand inline if-return to block syntax ([90ffee8](https://github.com/visulima/visulima/commit/90ffee895f5fa746932e6a4e2a3323b621af763f))
* **dev-toolbar:** fix all ESLint errors and warnings across src and tests ([a14d2ed](https://github.com/visulima/visulima/commit/a14d2ed116b23ff1c61db28324b76aa55931919c))
* **dev-toolbar:** housekeeping cleanup ([d7c5ed5](https://github.com/visulima/visulima/commit/d7c5ed5518069405476212d8a9814af50cf2ef15))
* **dev-toolbar:** migrate .prettierrc.cjs to prettier.config.js ([1cd3cc7](https://github.com/visulima/visulima/commit/1cd3cc72156127384babc0238cfe90b328683cf3))
* **dev-toolbar:** migrate deps to pnpm catalogs ([a43badc](https://github.com/visulima/visulima/commit/a43badcc8cd19d9c3c9cda4b2d75e272d76d51c8))
* **dev-toolbar:** remove external Google Fonts dependency ([2e81646](https://github.com/visulima/visulima/commit/2e81646f49a886d8ef9df7f9c951c87363f9b50d))
* **dev-toolbar:** update dependencies ([8cac2a2](https://github.com/visulima/visulima/commit/8cac2a2068d902ee8196f8e1f50d658644be7e70))
* **dev-toolbar:** update dependencies ([1be313b](https://github.com/visulima/visulima/commit/1be313bf37cd32739ddbb275e1af58dcf029e9a1))
* **dev-toolbar:** update examples to enable assets and inspector apps ([b3dc74d](https://github.com/visulima/visulima/commit/b3dc74d999acbfe4ee564a141dea47cf5ea2f71a))
* **dev-toolbar:** upgrade packem to 2.0.0-alpha.76 ([4a496ed](https://github.com/visulima/visulima/commit/4a496edb863ecd414c34ff043d49ba3171538ccd))
* **error:** apply prettier and eslint formatting sweep ([25c5eaf](https://github.com/visulima/visulima/commit/25c5eaf4989bddfe860b52aea113b3e229fea84f))
* **fallow:** resolve dead-code findings ([c4125d5](https://github.com/visulima/visulima/commit/c4125d53e03ac9d90115399634535991927a96cc))
* fixed jsr.json ([5d85e51](https://github.com/visulima/visulima/commit/5d85e5179de38e284ec433b14d77c71a1619c8d6))
* jsr.json update and lock file ([73fce38](https://github.com/visulima/visulima/commit/73fce38c7cb4603f3fffb88609b1b18e2feb4937))
* re-sort workspace package.json files via vis sort-package-json ([f625696](https://github.com/visulima/visulima/commit/f625696cfac974325774b3243e1a83c3d23acbd7))
* **release:** @visulima/dev-toolbar@1.0.0-alpha.1 [skip ci]\n\n## @visulima/dev-toolbar 1.0.0-alpha.1 (2026-02-28) ([610c297](https://github.com/visulima/visulima/commit/610c297781638efa8f157ca78e0fee219b04195c))
* **release:** @visulima/dev-toolbar@1.0.0-alpha.10 [skip ci]\n\n## @visulima/dev-toolbar [1.0.0-alpha.10](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.9...@visulima/dev-toolbar@1.0.0-alpha.10) (2026-04-21) ([db2191e](https://github.com/visulima/visulima/commit/db2191ebbe164652ea84e057e7fa554681559a4c))
* **release:** @visulima/dev-toolbar@1.0.0-alpha.11 [skip ci]\n\n## @visulima/dev-toolbar [1.0.0-alpha.11](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.10...@visulima/dev-toolbar@1.0.0-alpha.11) (2026-04-21) ([cb4edfe](https://github.com/visulima/visulima/commit/cb4edfeb35c5a158a8a4b2b81b4391d32907a0ad))
* **release:** @visulima/dev-toolbar@1.0.0-alpha.12 [skip ci]\n\n## @visulima/dev-toolbar [1.0.0-alpha.12](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.11...@visulima/dev-toolbar@1.0.0-alpha.12) (2026-04-21) ([5b91db2](https://github.com/visulima/visulima/commit/5b91db21a13436bb01e9f4bec56007e44d9ef021))
* **release:** @visulima/dev-toolbar@1.0.0-alpha.13 [skip ci]\n\n## @visulima/dev-toolbar [1.0.0-alpha.13](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.12...@visulima/dev-toolbar@1.0.0-alpha.13) (2026-04-22) ([b5ee6c6](https://github.com/visulima/visulima/commit/b5ee6c6f2f0a0d5fb0c158003f95d377a74b9aed))
* **release:** @visulima/dev-toolbar@1.0.0-alpha.14 [skip ci]\n\n## @visulima/dev-toolbar [1.0.0-alpha.14](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.13...@visulima/dev-toolbar@1.0.0-alpha.14) (2026-04-30) ([5c14f5c](https://github.com/visulima/visulima/commit/5c14f5c3af89bb5f5cd1e2a94157644221ad9243))
* **release:** @visulima/dev-toolbar@1.0.0-alpha.15 [skip ci]\n\n## @visulima/dev-toolbar [1.0.0-alpha.15](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.14...@visulima/dev-toolbar@1.0.0-alpha.15) (2026-05-04) ([fe4c574](https://github.com/visulima/visulima/commit/fe4c574998d70c6b0f237017449af7d5d2ec4192))
* **release:** @visulima/dev-toolbar@1.0.0-alpha.16 [skip ci]\n\n## @visulima/dev-toolbar [1.0.0-alpha.16](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.15...@visulima/dev-toolbar@1.0.0-alpha.16) (2026-05-06) ([fd477b0](https://github.com/visulima/visulima/commit/fd477b06758d0d7e47f098a40f05a33e5cf95959))
* **release:** @visulima/dev-toolbar@1.0.0-alpha.17 [skip ci]\n\n## @visulima/dev-toolbar [1.0.0-alpha.17](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.16...@visulima/dev-toolbar@1.0.0-alpha.17) (2026-05-06) ([7ecc54f](https://github.com/visulima/visulima/commit/7ecc54fe9d950fb490af7a10371215b22fe6d0fd))
* **release:** @visulima/dev-toolbar@1.0.0-alpha.18 [skip ci]\n\n## @visulima/dev-toolbar [1.0.0-alpha.18](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.17...@visulima/dev-toolbar@1.0.0-alpha.18) (2026-05-07) ([31bcb5d](https://github.com/visulima/visulima/commit/31bcb5d8abd594627bf4518e88e2e8fb13a5cf98))
* **release:** @visulima/dev-toolbar@1.0.0-alpha.19 [skip ci]\n\n## @visulima/dev-toolbar [1.0.0-alpha.19](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.18...@visulima/dev-toolbar@1.0.0-alpha.19) (2026-05-07) ([a8bedd8](https://github.com/visulima/visulima/commit/a8bedd84965c177be3030e7a9442f337e7f17891))
* **release:** @visulima/dev-toolbar@1.0.0-alpha.2 [skip ci]\n\n## @visulima/dev-toolbar [1.0.0-alpha.2](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.1...@visulima/dev-toolbar@1.0.0-alpha.2) (2026-03-01) ([a9bcac7](https://github.com/visulima/visulima/commit/a9bcac756906fa7d81f8d1db9aad516ac807cf77))
* **release:** @visulima/dev-toolbar@1.0.0-alpha.20 [skip ci]\n\n## @visulima/dev-toolbar [1.0.0-alpha.20](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.19...@visulima/dev-toolbar@1.0.0-alpha.20) (2026-05-10) ([d128234](https://github.com/visulima/visulima/commit/d128234f6599976c3b9c8af40527a75fca4dcb4b))
* **release:** @visulima/dev-toolbar@1.0.0-alpha.21 [skip ci]\n\n## @visulima/dev-toolbar [1.0.0-alpha.21](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.20...@visulima/dev-toolbar@1.0.0-alpha.21) (2026-05-10) ([b0b7d14](https://github.com/visulima/visulima/commit/b0b7d148991ce0f4fe730c0e3a653c03ed7458c1))
* **release:** @visulima/dev-toolbar@1.0.0-alpha.22 [skip ci]\n\n## @visulima/dev-toolbar [1.0.0-alpha.22](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.21...@visulima/dev-toolbar@1.0.0-alpha.22) (2026-05-11) ([587e66d](https://github.com/visulima/visulima/commit/587e66d771ad7fee85bf71180aa1a2bba466e603))
* **release:** @visulima/dev-toolbar@1.0.0-alpha.23 [skip ci]\n\n## @visulima/dev-toolbar [1.0.0-alpha.23](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.22...@visulima/dev-toolbar@1.0.0-alpha.23) (2026-05-11) ([0fa9442](https://github.com/visulima/visulima/commit/0fa9442fdb8a436d8d1bd2f5fad894ef5ff2605e))
* **release:** @visulima/dev-toolbar@1.0.0-alpha.24 [skip ci]\n\n## @visulima/dev-toolbar [1.0.0-alpha.24](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.23...@visulima/dev-toolbar@1.0.0-alpha.24) (2026-05-14) ([829736a](https://github.com/visulima/visulima/commit/829736a8713bb87d2e8a940e6a135f9143ef872a))
* **release:** @visulima/dev-toolbar@1.0.0-alpha.25 [skip ci]\n\n## @visulima/dev-toolbar [1.0.0-alpha.25](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.24...@visulima/dev-toolbar@1.0.0-alpha.25) (2026-05-16) ([59228c7](https://github.com/visulima/visulima/commit/59228c77b397c0b9fb8274fe225bcd19cf55a413))
* **release:** @visulima/dev-toolbar@1.0.0-alpha.26 [skip ci]\n\n## @visulima/dev-toolbar [1.0.0-alpha.26](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.25...@visulima/dev-toolbar@1.0.0-alpha.26) (2026-05-19) ([15d5671](https://github.com/visulima/visulima/commit/15d5671731da65161e0248cd7c55f0d354533a68))
* **release:** @visulima/dev-toolbar@1.0.0-alpha.27 [skip ci]\n\n## @visulima/dev-toolbar [1.0.0-alpha.27](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.26...@visulima/dev-toolbar@1.0.0-alpha.27) (2026-05-20) ([adfa404](https://github.com/visulima/visulima/commit/adfa404b2c43b9b80734c464e28607687b5b5589))
* **release:** @visulima/dev-toolbar@1.0.0-alpha.28 [skip ci]\n\n## @visulima/dev-toolbar [1.0.0-alpha.28](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.27...@visulima/dev-toolbar@1.0.0-alpha.28) (2026-05-26) ([5807ecd](https://github.com/visulima/visulima/commit/5807ecd329f021f1fba3fcc629fd168ee9c67182))
* **release:** @visulima/dev-toolbar@1.0.0-alpha.29 [skip ci]\n\n## @visulima/dev-toolbar [1.0.0-alpha.29](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.28...@visulima/dev-toolbar@1.0.0-alpha.29) (2026-05-26) ([b6a1df2](https://github.com/visulima/visulima/commit/b6a1df2c0428645c74041a984cf6df67bf1d3cb8))
* **release:** @visulima/dev-toolbar@1.0.0-alpha.3 [skip ci]\n\n## @visulima/dev-toolbar [1.0.0-alpha.3](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.2...@visulima/dev-toolbar@1.0.0-alpha.3) (2026-03-03) ([301ba44](https://github.com/visulima/visulima/commit/301ba44e4d9fef613d80a6a19726e41596ec5154))
* **release:** @visulima/dev-toolbar@1.0.0-alpha.30 [skip ci]\n\n## @visulima/dev-toolbar [1.0.0-alpha.30](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.29...@visulima/dev-toolbar@1.0.0-alpha.30) (2026-05-27) ([92df2f5](https://github.com/visulima/visulima/commit/92df2f533e27ce607ab505c75b43ab1e4eab2cff))
* **release:** @visulima/dev-toolbar@1.0.0-alpha.31 [skip ci]\n\n## @visulima/dev-toolbar [1.0.0-alpha.31](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.30...@visulima/dev-toolbar@1.0.0-alpha.31) (2026-05-27) ([3802c09](https://github.com/visulima/visulima/commit/3802c09b188f1649e17bd338531b445090a9956b))
* **release:** @visulima/dev-toolbar@1.0.0-alpha.32 [skip ci]\n\n## @visulima/dev-toolbar [1.0.0-alpha.32](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.31...@visulima/dev-toolbar@1.0.0-alpha.32) (2026-06-04) ([83b06cc](https://github.com/visulima/visulima/commit/83b06ccf49815a005f5962982e307503aff84193))
* **release:** @visulima/dev-toolbar@1.0.0-alpha.33 [skip ci]\n\n## @visulima/dev-toolbar [1.0.0-alpha.33](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.32...@visulima/dev-toolbar@1.0.0-alpha.33) (2026-06-13) ([103aeac](https://github.com/visulima/visulima/commit/103aeac6dabc03e5236fba8ac98ece53ca9f1d42))
* **release:** @visulima/dev-toolbar@1.0.0-alpha.34 [skip ci]\n\n## @visulima/dev-toolbar [1.0.0-alpha.34](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.33...@visulima/dev-toolbar@1.0.0-alpha.34) (2026-06-19) ([3ca99e1](https://github.com/visulima/visulima/commit/3ca99e1bd9c0986621cc29f8c75cc32de4a3fde5))
* **release:** @visulima/dev-toolbar@1.0.0-alpha.35 [skip ci]\n\n## @visulima/dev-toolbar [1.0.0-alpha.35](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.34...@visulima/dev-toolbar@1.0.0-alpha.35) (2026-06-19) ([164defd](https://github.com/visulima/visulima/commit/164defd54eaa52e392f828f5ea4e41d252787261))
* **release:** @visulima/dev-toolbar@1.0.0-alpha.36 [skip ci]\n\n## @visulima/dev-toolbar [1.0.0-alpha.36](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.35...@visulima/dev-toolbar@1.0.0-alpha.36) (2026-06-19) ([26516e5](https://github.com/visulima/visulima/commit/26516e59ed0a160f501d8252391a6576e9c9c889))
* **release:** @visulima/dev-toolbar@1.0.0-alpha.37 [skip ci]\n\n## @visulima/dev-toolbar [1.0.0-alpha.37](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.36...@visulima/dev-toolbar@1.0.0-alpha.37) (2026-06-20) ([1683c3b](https://github.com/visulima/visulima/commit/1683c3b3d4a45f76b1d2b8a0ef8b63e05e507130))
* **release:** @visulima/dev-toolbar@1.0.0-alpha.38 [skip ci]\n\n## @visulima/dev-toolbar [1.0.0-alpha.38](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.37...@visulima/dev-toolbar@1.0.0-alpha.38) (2026-06-20) ([7ab20b6](https://github.com/visulima/visulima/commit/7ab20b67aa6cf7625283a7d62a1f40fa5bbce094))
* **release:** @visulima/dev-toolbar@1.0.0-alpha.39 [skip ci]\n\n## @visulima/dev-toolbar [1.0.0-alpha.39](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.38...@visulima/dev-toolbar@1.0.0-alpha.39) (2026-06-21) ([3265a79](https://github.com/visulima/visulima/commit/3265a79a3ee749e75b758b56bf3acfd0d9f5c636))
* **release:** @visulima/dev-toolbar@1.0.0-alpha.4 [skip ci]\n\n## @visulima/dev-toolbar [1.0.0-alpha.4](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.3...@visulima/dev-toolbar@1.0.0-alpha.4) (2026-03-04) ([29e682c](https://github.com/visulima/visulima/commit/29e682cbc56b240926860b9593b0a7c3d64b8661))
* **release:** @visulima/dev-toolbar@1.0.0-alpha.40 [skip ci]\n\n## @visulima/dev-toolbar [1.0.0-alpha.40](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.39...@visulima/dev-toolbar@1.0.0-alpha.40) (2026-06-21) ([38b030a](https://github.com/visulima/visulima/commit/38b030a436077af352242ac261dd6be996a83e07))
* **release:** @visulima/dev-toolbar@1.0.0-alpha.41 [skip ci]\n\n## @visulima/dev-toolbar [1.0.0-alpha.41](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.40...@visulima/dev-toolbar@1.0.0-alpha.41) (2026-06-22) ([0ae61c1](https://github.com/visulima/visulima/commit/0ae61c112add1d5d85416c65a15858f2a1c3ae5a))
* **release:** @visulima/dev-toolbar@1.0.0-alpha.42 [skip ci]\n\n## @visulima/dev-toolbar [1.0.0-alpha.42](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.41...@visulima/dev-toolbar@1.0.0-alpha.42) (2026-06-22) ([0db88ff](https://github.com/visulima/visulima/commit/0db88ff27b11a827066b9049e998ea9afb51450d))
* **release:** @visulima/dev-toolbar@1.0.0-alpha.43 [skip ci]\n\n## @visulima/dev-toolbar [1.0.0-alpha.43](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.42...@visulima/dev-toolbar@1.0.0-alpha.43) (2026-06-23) ([2aa0bc4](https://github.com/visulima/visulima/commit/2aa0bc41fdb71adb2cb25d7cddc85fe8ffcb51a3))
* **release:** @visulima/dev-toolbar@1.0.0-alpha.44 [skip ci]\n\n## @visulima/dev-toolbar [1.0.0-alpha.44](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.43...@visulima/dev-toolbar@1.0.0-alpha.44) (2026-06-23) ([56990e0](https://github.com/visulima/visulima/commit/56990e058a4b9e4092db7529f0a99ab92d28e4bf))
* **release:** @visulima/dev-toolbar@1.0.0-alpha.45 [skip ci]\n\n## @visulima/dev-toolbar [1.0.0-alpha.45](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.44...@visulima/dev-toolbar@1.0.0-alpha.45) (2026-06-30) ([09bfcde](https://github.com/visulima/visulima/commit/09bfcdeb8113a5fc076d38ba0fd8f852e59ad782))
* **release:** @visulima/dev-toolbar@1.0.0-alpha.46 [skip ci]\n\n## @visulima/dev-toolbar [1.0.0-alpha.46](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.45...@visulima/dev-toolbar@1.0.0-alpha.46) (2026-07-01) ([cfc4928](https://github.com/visulima/visulima/commit/cfc4928b31f331e3bcec178de2dd02a243e53ea2))
* **release:** @visulima/dev-toolbar@1.0.0-alpha.47 [skip ci]\n\n## @visulima/dev-toolbar [1.0.0-alpha.47](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.46...@visulima/dev-toolbar@1.0.0-alpha.47) (2026-07-03) ([eb37180](https://github.com/visulima/visulima/commit/eb371806d90f65f1f1c6f4c0a09fe2e04daf0fc8))
* **release:** @visulima/dev-toolbar@1.0.0-alpha.48 [skip ci]\n\n## @visulima/dev-toolbar [1.0.0-alpha.48](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.47...@visulima/dev-toolbar@1.0.0-alpha.48) (2026-07-03) ([3f1c144](https://github.com/visulima/visulima/commit/3f1c1447ccfb7d00473278cd4f35cd57371edf19))
* **release:** @visulima/dev-toolbar@1.0.0-alpha.5 [skip ci]\n\n## @visulima/dev-toolbar [1.0.0-alpha.5](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.4...@visulima/dev-toolbar@1.0.0-alpha.5) (2026-03-06) ([9f996e8](https://github.com/visulima/visulima/commit/9f996e87a307013544d8a65fbf484fc8dac3d3a7))
* **release:** @visulima/dev-toolbar@1.0.0-alpha.6 [skip ci]\n\n## @visulima/dev-toolbar [1.0.0-alpha.6](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.5...@visulima/dev-toolbar@1.0.0-alpha.6) (2026-03-26) ([7762915](https://github.com/visulima/visulima/commit/776291577bfc42f9e022503fd0af62c1d0c378e4))
* **release:** @visulima/dev-toolbar@1.0.0-alpha.7 [skip ci]\n\n## @visulima/dev-toolbar [1.0.0-alpha.7](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.6...@visulima/dev-toolbar@1.0.0-alpha.7) (2026-03-26) ([febce22](https://github.com/visulima/visulima/commit/febce224ca142e3e5520fb1b79212fca4f7e9d17))
* **release:** @visulima/dev-toolbar@1.0.0-alpha.8 [skip ci]\n\n## @visulima/dev-toolbar [1.0.0-alpha.8](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.7...@visulima/dev-toolbar@1.0.0-alpha.8) (2026-04-08) ([83d3439](https://github.com/visulima/visulima/commit/83d3439ac20233b24813e3e6cfaeefecf790a703))
* **release:** @visulima/dev-toolbar@1.0.0-alpha.9 [skip ci]\n\n## @visulima/dev-toolbar [1.0.0-alpha.9](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.8...@visulima/dev-toolbar@1.0.0-alpha.9) (2026-04-15) ([c3cf2ed](https://github.com/visulima/visulima/commit/c3cf2ed96c646431df57859ac8fd6ef27242cbb0))
* remove IDE configs, memory-bank, and stale lint script ([3a1100e](https://github.com/visulima/visulima/commit/3a1100e1f9e5dae6fb6fefd486195e8cc80fc578))
* **repo:** apply eslint --fix and prettier --fix across packages ([#650](https://github.com/visulima/visulima/issues/650)) ([2e26a84](https://github.com/visulima/visulima/commit/2e26a84774f218f21345e9a8ecd68236b6542743)), closes [#620](https://github.com/visulima/visulima/issues/620)
* **repo:** sort package.json keys across all packages ([e1fd9ab](https://github.com/visulima/visulima/commit/e1fd9ab467ef96a98c777da1572ff6a50fcf7e71))
* simplify pnpm-workspace packages list ([7cab221](https://github.com/visulima/visulima/commit/7cab221163632d9b7aa044a6f88c49083103a869))
* sorted package.json ([b47c545](https://github.com/visulima/visulima/commit/b47c545591600fdab17d5cd3a3fbc68b61e199da))
* update bundled dependency licenses ([6ace4c6](https://github.com/visulima/visulima/commit/6ace4c69d41fc1fd0a744fbca8ca219ba631b4ab))
* update dependencies and fix vite-react-rolldown example ([8811909](https://github.com/visulima/visulima/commit/8811909e90877b0041e4b08cdd797d58749464e9))
* update gen file ([8794258](https://github.com/visulima/visulima/commit/87942584bc22cab96a14094d2ec46ec667179490))
* update the jsr.json ([864ab7e](https://github.com/visulima/visulima/commit/864ab7e71c4b5ae82f64792d1ae8debfea2c539b))
* visulima website ([#591](https://github.com/visulima/visulima/issues/591)) ([59ab2e2](https://github.com/visulima/visulima/commit/59ab2e2befb03e51cd2088956f83d9b87de6d033))
* year update ([47f4105](https://github.com/visulima/visulima/commit/47f410596ce7190cfea36a073db32e0cec50bbcd))

### Code Refactoring

* **dev-toolbar:** convert inspector to toolbar action button ([0d0b682](https://github.com/visulima/visulima/commit/0d0b682e65511c158baa29134a8c50e7db459284))
* **dev-toolbar:** replace cn wrapper with direct clsx imports ([6ac069b](https://github.com/visulima/visulima/commit/6ac069bf0f2e772f0a5626a47d9034b824a5b23a))
* **dev-toolbar:** replace cn() wrapper with clsx() directly ([e774b36](https://github.com/visulima/visulima/commit/e774b367f9270dd9e43fcf0b7147a8cd23a1734a))
* **dev-toolbar:** use native Vite 8 tsconfigPaths in cloudflare example ([fb15d1d](https://github.com/visulima/visulima/commit/fb15d1df62040853a36e7926382765e902380d3a))
* **dev-toolbar:** use native Vite 8 tsconfigPaths in tanstack-start example ([d89aef7](https://github.com/visulima/visulima/commit/d89aef7c2ba4a8443897d3f7cb9ada494d38d2c4))
* **docs:** migrate Nextra components to fumadocs-ui, remove Nextra stripping ([484878f](https://github.com/visulima/visulima/commit/484878f01879363ef5e9a0282904dc4627d6060c))
* replace inline import() types with top-level imports ([4569a4c](https://github.com/visulima/visulima/commit/4569a4ca04723da069f985855dcfab292f7347e1))
* resolve fallow dead-code across 13 packages ([8c458d2](https://github.com/visulima/visulima/commit/8c458d2eb17225ed48fc4bee4569e522912e8c3d))

### Tests

* **dev-toolbar:** cover rpc functions/server/client, timeline, hooks, messaging presets and vite matcher ([16f7dd8](https://github.com/visulima/visulima/commit/16f7dd85180082d48016193255b4d251f4d145ea))
* **dev-toolbar:** cover vite-config rpc function branches ([1c66865](https://github.com/visulima/visulima/commit/1c668656af8b595c1bb7ac37f6249eb3d21feecc))
* **dev-toolbar:** cover vite-plugin, global API, hook events, helpers ([c402e62](https://github.com/visulima/visulima/commit/c402e625e6db180767dc2336f28faf4c1c45ce7f))
* **dev-toolbar:** rebind localStorage globals for Node 25 ([ee5e1f8](https://github.com/visulima/visulima/commit/ee5e1f8774cce170c95248d9c4d74d91fafe90e7))
* fix platform-specific path assertions ([a74080a](https://github.com/visulima/visulima/commit/a74080ab1adc4227af3d7d9c302547167cca7f16))
* **repo:** add dist runtime + types integration tests ([32ee300](https://github.com/visulima/visulima/commit/32ee300b7184117a0ddf9f9d390f75f8932d5ed9))
* **repo:** cover bin entry points in dist integration suite ([7479ef1](https://github.com/visulima/visulima/commit/7479ef113cf5ccef25692619082afb1b6a0eecab))
* **tui, dev-toolbar:** fix expect.assertions counts on looped assertions ([898bc59](https://github.com/visulima/visulima/commit/898bc59ef217f7c8ee2aa7fdf7da3d355c028b13))

### Build System

* regenerate bundled-license manifests and types ordering ([af26588](https://github.com/visulima/visulima/commit/af26588d75aaa937fd4862800560bd4070a4878c))

### Continuous Integration

* **fallow:** make fallow:health advisory (--report-only) ([d57148e](https://github.com/visulima/visulima/commit/d57148ea0e3556b4c24d8d336b9fa14987f5dc7d))
* **lint:** raise eslint job timeout and cache slow per-package eslint runs ([#717](https://github.com/visulima/visulima/issues/717)) ([c93878d](https://github.com/visulima/visulima/commit/c93878dbfa1888cc834704448ae6eefd3098597e)), closes [#713](https://github.com/visulima/visulima/issues/713)

## @visulima/dev-toolbar [1.0.0-alpha.48](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.47...@visulima/dev-toolbar@1.0.0-alpha.48) (2026-07-03)

## @visulima/dev-toolbar [1.0.0-alpha.47](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.46...@visulima/dev-toolbar@1.0.0-alpha.47) (2026-07-03)

## @visulima/dev-toolbar [1.0.0-alpha.46](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.45...@visulima/dev-toolbar@1.0.0-alpha.46) (2026-07-01)

## @visulima/dev-toolbar [1.0.0-alpha.45](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.44...@visulima/dev-toolbar@1.0.0-alpha.45) (2026-06-30)

### Styles

* cs fixes ([2a960bb](https://github.com/visulima/visulima/commit/2a960bb1772c9dc70080e2d75d3a0d827034e294))

### Miscellaneous Chores

* add fallow code-intelligence across all packages ([a3b4821](https://github.com/visulima/visulima/commit/a3b48215002e86fed20f2973038b5d4a0aa1ce04))
* **fallow:** resolve dead-code findings ([c4125d5](https://github.com/visulima/visulima/commit/c4125d53e03ac9d90115399634535991927a96cc))

### Code Refactoring

* resolve fallow dead-code across 13 packages ([8c458d2](https://github.com/visulima/visulima/commit/8c458d2eb17225ed48fc4bee4569e522912e8c3d))

### Continuous Integration

* **fallow:** make fallow:health advisory (--report-only) ([d57148e](https://github.com/visulima/visulima/commit/d57148ea0e3556b4c24d8d336b9fa14987f5dc7d))
* **lint:** raise eslint job timeout and cache slow per-package eslint runs ([#717](https://github.com/visulima/visulima/issues/717)) ([c93878d](https://github.com/visulima/visulima/commit/c93878dbfa1888cc834704448ae6eefd3098597e)), closes [#713](https://github.com/visulima/visulima/issues/713)

## @visulima/dev-toolbar [1.0.0-alpha.44](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.43...@visulima/dev-toolbar@1.0.0-alpha.44) (2026-06-23)

## @visulima/dev-toolbar [1.0.0-alpha.43](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.42...@visulima/dev-toolbar@1.0.0-alpha.43) (2026-06-23)

## @visulima/dev-toolbar [1.0.0-alpha.42](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.41...@visulima/dev-toolbar@1.0.0-alpha.42) (2026-06-22)

## @visulima/dev-toolbar [1.0.0-alpha.41](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.40...@visulima/dev-toolbar@1.0.0-alpha.41) (2026-06-22)

## @visulima/dev-toolbar [1.0.0-alpha.40](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.39...@visulima/dev-toolbar@1.0.0-alpha.40) (2026-06-21)

## @visulima/dev-toolbar [1.0.0-alpha.39](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.38...@visulima/dev-toolbar@1.0.0-alpha.39) (2026-06-21)

## @visulima/dev-toolbar [1.0.0-alpha.38](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.37...@visulima/dev-toolbar@1.0.0-alpha.38) (2026-06-20)

## @visulima/dev-toolbar [1.0.0-alpha.37](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.36...@visulima/dev-toolbar@1.0.0-alpha.37) (2026-06-20)

### Bug Fixes

* **dev-toolbar:** bump @babel/parser to v8 and fix vite 8 source-map type ([eb8a111](https://github.com/visulima/visulima/commit/eb8a1110eb9a5ae6acedc55d970d10e896a16950))

## @visulima/dev-toolbar [1.0.0-alpha.36](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.35...@visulima/dev-toolbar@1.0.0-alpha.36) (2026-06-19)

## @visulima/dev-toolbar [1.0.0-alpha.35](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.34...@visulima/dev-toolbar@1.0.0-alpha.35) (2026-06-19)

### Bug Fixes

* **dev-toolbar:** resolve import/no-named-as-default eslint error ([#686](https://github.com/visulima/visulima/issues/686)) ([87964f5](https://github.com/visulima/visulima/commit/87964f587e9b13fff0ea8b7ea8f058e847d7c015))

## @visulima/dev-toolbar [1.0.0-alpha.34](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.33...@visulima/dev-toolbar@1.0.0-alpha.34) (2026-06-19)

## @visulima/dev-toolbar [1.0.0-alpha.33](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.32...@visulima/dev-toolbar@1.0.0-alpha.33) (2026-06-13)

### Bug Fixes

* **dev-toolbar:** bound annotation and thread growth ([c07b6f1](https://github.com/visulima/visulima/commit/c07b6f1f7994d4160977bc286acc5b5b7d68d249))
* **dev-toolbar:** harden readFile rpc and fix dev-toolbar docs/perf ([385f279](https://github.com/visulima/visulima/commit/385f279d911d5f9df9290b33151fb62411bdd5b9))

### Miscellaneous Chores

* apply safe prettier and eslint formatting ([05120af](https://github.com/visulima/visulima/commit/05120af8c898d18c495575680f01134681e29b65))
* **dev-toolbar:** apply lint-driven style cleanup across src and tests ([b1f004d](https://github.com/visulima/visulima/commit/b1f004d661a6b41184e1dab57d291045e6908f72))

### Tests

* **dev-toolbar:** cover vite-plugin, global API, hook events, helpers ([c402e62](https://github.com/visulima/visulima/commit/c402e625e6db180767dc2336f28faf4c1c45ce7f))
* fix platform-specific path assertions ([a74080a](https://github.com/visulima/visulima/commit/a74080ab1adc4227af3d7d9c302547167cca7f16))

### Build System

* regenerate bundled-license manifests and types ordering ([af26588](https://github.com/visulima/visulima/commit/af26588d75aaa937fd4862800560bd4070a4878c))

## @visulima/dev-toolbar [1.0.0-alpha.32](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.31...@visulima/dev-toolbar@1.0.0-alpha.32) (2026-06-04)

### Bug Fixes

* **dev-toolbar:** 3 bug fixes ([ff28161](https://github.com/visulima/visulima/commit/ff281617a8346dcfae90db522507b8a7c0c94c61))

### Miscellaneous Chores

* apply eslint + prettier autofixes across packages ([c1bb784](https://github.com/visulima/visulima/commit/c1bb7848a0d93d0dfe2960c77e3cda22239c79a0))

### Tests

* **dev-toolbar:** cover rpc functions/server/client, timeline, hooks, messaging presets and vite matcher ([16f7dd8](https://github.com/visulima/visulima/commit/16f7dd85180082d48016193255b4d251f4d145ea))
* **dev-toolbar:** cover vite-config rpc function branches ([1c66865](https://github.com/visulima/visulima/commit/1c668656af8b595c1bb7ac37f6249eb3d21feecc))

## @visulima/dev-toolbar [1.0.0-alpha.31](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.30...@visulima/dev-toolbar@1.0.0-alpha.31) (2026-05-27)

### Bug Fixes

* **storage-client:** percent-encode user fields in defaultFingerprint ([7c78a0f](https://github.com/visulima/visulima/commit/7c78a0f9512e2a673b941d80839e9f1e86b7b5d0))

### Documentation

* prettier-format agent instructions ([71b6414](https://github.com/visulima/visulima/commit/71b6414528780ac82c4e0bb25b5f4f11faba5549))

## @visulima/dev-toolbar [1.0.0-alpha.30](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.29...@visulima/dev-toolbar@1.0.0-alpha.30) (2026-05-27)

## @visulima/dev-toolbar [1.0.0-alpha.29](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.28...@visulima/dev-toolbar@1.0.0-alpha.29) (2026-05-26)

### Miscellaneous Chores

* sorted package.json ([b47c545](https://github.com/visulima/visulima/commit/b47c545591600fdab17d5cd3a3fbc68b61e199da))

## @visulima/dev-toolbar [1.0.0-alpha.28](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.27...@visulima/dev-toolbar@1.0.0-alpha.28) (2026-05-26)

### Bug Fixes

* **security:** address codeql findings across packages ([3366f9c](https://github.com/visulima/visulima/commit/3366f9c07d54bdde5242fbd90780baa4634de179))

### Miscellaneous Chores

* **ci-stability:** green CI across vis, native, lint, tests, attw ([#651](https://github.com/visulima/visulima/issues/651)) ([d4eb684](https://github.com/visulima/visulima/commit/d4eb684b5f75c818c9251048c605a0ed54a268e3))
* **repo:** apply eslint --fix and prettier --fix across packages ([#650](https://github.com/visulima/visulima/issues/650)) ([2e26a84](https://github.com/visulima/visulima/commit/2e26a84774f218f21345e9a8ecd68236b6542743)), closes [#620](https://github.com/visulima/visulima/issues/620)
* **repo:** sort package.json keys across all packages ([e1fd9ab](https://github.com/visulima/visulima/commit/e1fd9ab467ef96a98c777da1572ff6a50fcf7e71))

### Tests

* **repo:** add dist runtime + types integration tests ([32ee300](https://github.com/visulima/visulima/commit/32ee300b7184117a0ddf9f9d390f75f8932d5ed9))
* **repo:** cover bin entry points in dist integration suite ([7479ef1](https://github.com/visulima/visulima/commit/7479ef113cf5ccef25692619082afb1b6a0eecab))

## @visulima/dev-toolbar [1.0.0-alpha.27](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.26...@visulima/dev-toolbar@1.0.0-alpha.27) (2026-05-20)

### Tests

* **dev-toolbar:** rebind localStorage globals for Node 25 ([ee5e1f8](https://github.com/visulima/visulima/commit/ee5e1f8774cce170c95248d9c4d74d91fafe90e7))

## @visulima/dev-toolbar [1.0.0-alpha.26](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.25...@visulima/dev-toolbar@1.0.0-alpha.26) (2026-05-19)

## @visulima/dev-toolbar [1.0.0-alpha.25](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.24...@visulima/dev-toolbar@1.0.0-alpha.25) (2026-05-16)

## @visulima/dev-toolbar [1.0.0-alpha.24](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.23...@visulima/dev-toolbar@1.0.0-alpha.24) (2026-05-14)

### Bug Fixes

* **dev-toolbar:** cast form element to AnnotationElement shape ([618e91e](https://github.com/visulima/visulima/commit/618e91e5535a75f1d2d0132e0f7085987af79b34))
* **dev-toolbar:** scope JSX inject to enclosing function ([1b7e82a](https://github.com/visulima/visulima/commit/1b7e82af78cd599bd35b58a2f3e232c25b7e5192))
* **dev-toolbar:** silence unnecessary-type-assertion on form element cast ([86282de](https://github.com/visulima/visulima/commit/86282de06a3581be69210a12f12e307ac6ca99c8))

### Miscellaneous Chores

* **error:** apply prettier and eslint formatting sweep ([25c5eaf](https://github.com/visulima/visulima/commit/25c5eaf4989bddfe860b52aea113b3e229fea84f))

## @visulima/dev-toolbar [1.0.0-alpha.23](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.22...@visulima/dev-toolbar@1.0.0-alpha.23) (2026-05-11)

## @visulima/dev-toolbar [1.0.0-alpha.22](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.21...@visulima/dev-toolbar@1.0.0-alpha.22) (2026-05-11)

## @visulima/dev-toolbar [1.0.0-alpha.21](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.20...@visulima/dev-toolbar@1.0.0-alpha.21) (2026-05-10)

## @visulima/dev-toolbar [1.0.0-alpha.20](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.19...@visulima/dev-toolbar@1.0.0-alpha.20) (2026-05-10)

## @visulima/dev-toolbar [1.0.0-alpha.19](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.18...@visulima/dev-toolbar@1.0.0-alpha.19) (2026-05-07)

## @visulima/dev-toolbar [1.0.0-alpha.18](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.17...@visulima/dev-toolbar@1.0.0-alpha.18) (2026-05-07)

### Miscellaneous Chores

* **dev-toolbar:** bump peer ranges for @modelcontextprotocol/sdk and vite ([b6bbb40](https://github.com/visulima/visulima/commit/b6bbb406766e74f822ffe9956e85acf5feaa1ded))

## @visulima/dev-toolbar [1.0.0-alpha.17](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.16...@visulima/dev-toolbar@1.0.0-alpha.17) (2026-05-06)

## @visulima/dev-toolbar [1.0.0-alpha.16](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.15...@visulima/dev-toolbar@1.0.0-alpha.16) (2026-05-06)

### Miscellaneous Chores

* **dev-toolbar:** apply prettier and eslint quote-style auto-fix ([3bb9b50](https://github.com/visulima/visulima/commit/3bb9b50337d5bbc0e3a1bd372a69ceebad1fb188))
* **dev-toolbar:** housekeeping cleanup ([d7c5ed5](https://github.com/visulima/visulima/commit/d7c5ed5518069405476212d8a9814af50cf2ef15))

## @visulima/dev-toolbar [1.0.0-alpha.15](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.14...@visulima/dev-toolbar@1.0.0-alpha.15) (2026-05-04)

### Miscellaneous Chores

* **dev-toolbar:** allow zod v4 and align eslint-plugin-zod with catalog ([70733ad](https://github.com/visulima/visulima/commit/70733ad6155c3bc460d2bc0943f88af59b7b6725))

## @visulima/dev-toolbar [1.0.0-alpha.14](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.13...@visulima/dev-toolbar@1.0.0-alpha.14) (2026-04-30)

### Miscellaneous Chores

* **dev-toolbar:** upgrade packem to 2.0.0-alpha.76 ([4a496ed](https://github.com/visulima/visulima/commit/4a496edb863ecd414c34ff043d49ba3171538ccd))
* re-sort workspace package.json files via vis sort-package-json ([f625696](https://github.com/visulima/visulima/commit/f625696cfac974325774b3243e1a83c3d23acbd7))
* simplify pnpm-workspace packages list ([7cab221](https://github.com/visulima/visulima/commit/7cab221163632d9b7aa044a6f88c49083103a869))

## @visulima/dev-toolbar [1.0.0-alpha.13](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.12...@visulima/dev-toolbar@1.0.0-alpha.13) (2026-04-22)

### Bug Fixes

* Remove JSR configuration generation script and generated jsr.json files ([#616](https://github.com/visulima/visulima/issues/616)) ([533744b](https://github.com/visulima/visulima/commit/533744b103b74896941db5b727173e617a27a63b))

## @visulima/dev-toolbar [1.0.0-alpha.12](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.11...@visulima/dev-toolbar@1.0.0-alpha.12) (2026-04-21)

### Miscellaneous Chores

* jsr.json update and lock file ([73fce38](https://github.com/visulima/visulima/commit/73fce38c7cb4603f3fffb88609b1b18e2feb4937))

## @visulima/dev-toolbar [1.0.0-alpha.11](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.10...@visulima/dev-toolbar@1.0.0-alpha.11) (2026-04-21)

### Miscellaneous Chores

* update the jsr.json ([864ab7e](https://github.com/visulima/visulima/commit/864ab7e71c4b5ae82f64792d1ae8debfea2c539b))

## @visulima/dev-toolbar [1.0.0-alpha.10](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.9...@visulima/dev-toolbar@1.0.0-alpha.10) (2026-04-21)

### Bug Fixes

* **dev-toolbar:** resolve type errors in annotation overlay and perf monitor ([b201aa6](https://github.com/visulima/visulima/commit/b201aa6605a9fa030ce74f58743e10a042183156))
* **tui:** inline component and hook barrel exports in ink entry ([1cf8dd2](https://github.com/visulima/visulima/commit/1cf8dd25c91a2001268fb9d964d95df649bf7832))

### Miscellaneous Chores

* **api-platform:** apply pending lint and source updates ([3fb0043](https://github.com/visulima/visulima/commit/3fb0043a4cf35f752ca89a09a077100ae0142da8))
* bump engines.node to ^22.14.0 || >=24.10.0 ([c3d0931](https://github.com/visulima/visulima/commit/c3d0931d1504e4f21ebf50ea680cfa7ce4ba15ce))
* **dev-toolbar:** apply formatter and type refinements ([167c654](https://github.com/visulima/visulima/commit/167c654ae2f7c57a4ff7d0c84f5196de4a72c8d7))
* **dev-toolbar:** apply pending changes ([e16638c](https://github.com/visulima/visulima/commit/e16638c00907a4612fa53f74f141bd3aac9f6ca9))
* **dev-toolbar:** apply pending lint and source updates ([ece08e1](https://github.com/visulima/visulima/commit/ece08e16c85e927d1eead02eea69f15d5ea1a3dc))
* **dev-toolbar:** enforce curly braces and apply lint fixes ([1b6797e](https://github.com/visulima/visulima/commit/1b6797ec1844979a7bb3ac3aa094e42a4fe3a68b))
* fixed jsr.json ([5d85e51](https://github.com/visulima/visulima/commit/5d85e5179de38e284ec433b14d77c71a1619c8d6))

### Code Refactoring

* replace inline import() types with top-level imports ([4569a4c](https://github.com/visulima/visulima/commit/4569a4ca04723da069f985855dcfab292f7347e1))

### Tests

* **tui, dev-toolbar:** fix expect.assertions counts on looped assertions ([898bc59](https://github.com/visulima/visulima/commit/898bc59ef217f7c8ee2aa7fdf7da3d355c028b13))

## @visulima/dev-toolbar [1.0.0-alpha.9](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.8...@visulima/dev-toolbar@1.0.0-alpha.9) (2026-04-15)

### Bug Fixes

* **dev-toolbar:** add missing DOM property types and tighten getOptionValue fallback ([55326d0](https://github.com/visulima/visulima/commit/55326d02b173211608aefa994aa0e5f54705120d))
* **dev-toolbar:** replace bogus .toBe(true) assertions with proper matchers ([e672ca4](https://github.com/visulima/visulima/commit/e672ca459bf8d3e9141e277755bc35f2b59dac07))
* **error-debugging:** resolve eslint and type-safety issues ([886dbff](https://github.com/visulima/visulima/commit/886dbffe3f744c9493fcc54e781de3fd21eebf78))

## @visulima/dev-toolbar [1.0.0-alpha.8](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.7...@visulima/dev-toolbar@1.0.0-alpha.8) (2026-04-08)

### Bug Fixes

* **dev-toolbar:** resolve eslint errors ([225128a](https://github.com/visulima/visulima/commit/225128ab192d318b9d997ad793c7c43384e2431e))
* remove deprecated baseUrl and downlevelIteration from tsconfigs ([a708366](https://github.com/visulima/visulima/commit/a708366b5c3bc73cfde480a712ed397bd921fb93))
* resolve failing tests across multiple packages ([2b4b6f0](https://github.com/visulima/visulima/commit/2b4b6f04169b60fdc4cf77b293015436a272c0fb))

### Miscellaneous Chores

* added og images ([02d9d1e](https://github.com/visulima/visulima/commit/02d9d1e47be3ce75679ea89e857dc4e4bfe4946b))
* apply linting and formatting fixes across packages ([5d150a5](https://github.com/visulima/visulima/commit/5d150a578f9ce861c791843c683deeb849b774a9))
* **dev-toolbar:** add tsconfig.eslint.json for type-aware linting ([d2c864a](https://github.com/visulima/visulima/commit/d2c864a01f9c4805975596c9de8af4a04ac4beaa))
* **dev-toolbar:** apply auto-fix formatting ([3a80a7d](https://github.com/visulima/visulima/commit/3a80a7daaadcc9705ebb153bfea617e4a5029379))
* **dev-toolbar:** apply prettier formatting ([a6d5528](https://github.com/visulima/visulima/commit/a6d5528602966810f03eb30c7883b8fd53088d40))
* **dev-toolbar:** expand braceless if statements to block syntax ([b059279](https://github.com/visulima/visulima/commit/b059279c444036b52c94515d852ec20cd782692e))
* **dev-toolbar:** expand inline if-return to block syntax ([db834ab](https://github.com/visulima/visulima/commit/db834ab5b42ff3dca9ef90e478c690e8367d4df8))
* **dev-toolbar:** expand inline if-return to block syntax ([90ffee8](https://github.com/visulima/visulima/commit/90ffee895f5fa746932e6a4e2a3323b621af763f))
* **dev-toolbar:** migrate .prettierrc.cjs to prettier.config.js ([1cd3cc7](https://github.com/visulima/visulima/commit/1cd3cc72156127384babc0238cfe90b328683cf3))
* update bundled dependency licenses ([6ace4c6](https://github.com/visulima/visulima/commit/6ace4c69d41fc1fd0a744fbca8ca219ba631b4ab))

## @visulima/dev-toolbar [1.0.0-alpha.7](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.6...@visulima/dev-toolbar@1.0.0-alpha.7) (2026-03-26)

### Features

* **web:** auto-generate packages page from workspace metadata ([623e520](https://github.com/visulima/visulima/commit/623e5207693a7fe720f5f2f179593a3654c880e3))

## @visulima/dev-toolbar [1.0.0-alpha.6](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.5...@visulima/dev-toolbar@1.0.0-alpha.6) (2026-03-26)

### Features

* **dev-toolbar:** add accessibility info capture to inspector ([2b98ee6](https://github.com/visulima/visulima/commit/2b98ee6249759d1d2c42504354ebf3a92db4a6e6))
* **dev-toolbar:** add custom Select component replacing native <select> ([c9c8685](https://github.com/visulima/visulima/commit/c9c8685ea3a05c28ea89d5f5d852d56bc8cbcad0))
* **dev-toolbar:** add viewport rulers with draggable guidelines to inspector ([9df079a](https://github.com/visulima/visulima/commit/9df079a83563b1afc617d76df78259082ea98817))
* **dev-toolbar:** add visual annotation system with MCP agent integration ([be88cfe](https://github.com/visulima/visulima/commit/be88cfe30f3f624075167762e9c9780653dd34e9))
* **dev-toolbar:** redesign annotation popups, add toast notifications, improve docs ([cca080f](https://github.com/visulima/visulima/commit/cca080fc6098a692e681ee5b140f8c5c3a810a2c))

### Bug Fixes

* **api-platform:** use workspace:* for internal [@visulima](https://github.com/visulima) deps ([daa2b0b](https://github.com/visulima/visulima/commit/daa2b0bfb491b42bc83c369fec2dcd7950f082b0))
* **dev-toolbar:** address code review findings across toolbar components ([449a300](https://github.com/visulima/visulima/commit/449a300226e4ccaee52ad258d5eccf6f77a72343))
* **dev-toolbar:** align inspector floating badge with main toolbar styling ([8ea1814](https://github.com/visulima/visulima/commit/8ea1814b596126b71231fd124c036f1e450275ef))
* **dev-toolbar:** audit Select component, add tests, fix pre-existing type error ([c8452d3](https://github.com/visulima/visulima/commit/c8452d3b495e9707579490155e6689c40cff9568))
* **dev-toolbar:** auto-detect TanStack Start and shield Preact from React Compiler ([6e9fa57](https://github.com/visulima/visulima/commit/6e9fa571ded1ff53d8809cee47fb404897320e9f))
* **dev-toolbar:** fix coordinate bugs, orphaned elements, and doc inaccuracies ([efa9c54](https://github.com/visulima/visulima/commit/efa9c544c9a8591c6efe6fd4a9995b411c054f54))
* **dev-toolbar:** open inspector popup at click point and add visible drag handle ([c012aed](https://github.com/visulima/visulima/commit/c012aed47eeabf2047d5a7a7e46cab807de902f3))
* **dev-toolbar:** prevent querySelector crash on area selection element paths ([ecd64d4](https://github.com/visulima/visulima/commit/ecd64d4b418e74cc582da0cd5efdb9f5e8e95d2b))
* **dev-toolbar:** resolve all TypeScript, ESLint, and Prettier errors in annotation system ([2fae465](https://github.com/visulima/visulima/commit/2fae4658017d61262293a41bef13348bbfc70e41))
* **dev-toolbar:** use correct ARIA role in select search tests ([2e1ddfe](https://github.com/visulima/visulima/commit/2e1ddfed1b49697a2d772c5a6b61bf3b6538a43b))
* **dev-toolbar:** use workspace:* for internal [@visulima](https://github.com/visulima) deps ([26ea008](https://github.com/visulima/visulima/commit/26ea00878218a34f89587fb9a2157cb379e98733))
* **web:** improve build setup with incremental stats caching and prod install ([fe33e75](https://github.com/visulima/visulima/commit/fe33e75827586779b4b3a0c6d57b39f889ee6207))

### Documentation

* **dev-toolbar:** update examples to use native Vite 8 resolve.tsconfigPaths ([d54d3f7](https://github.com/visulima/visulima/commit/d54d3f71714fc600e4b965e1ab2bdbe0cc442ba6))

### Miscellaneous Chores

* **dev-toolbar:** migrate deps to pnpm catalogs ([a43badc](https://github.com/visulima/visulima/commit/a43badcc8cd19d9c3c9cda4b2d75e272d76d51c8))
* **dev-toolbar:** update dependencies ([8cac2a2](https://github.com/visulima/visulima/commit/8cac2a2068d902ee8196f8e1f50d658644be7e70))
* update gen file ([8794258](https://github.com/visulima/visulima/commit/87942584bc22cab96a14094d2ec46ec667179490))
* visulima website ([#591](https://github.com/visulima/visulima/issues/591)) ([59ab2e2](https://github.com/visulima/visulima/commit/59ab2e2befb03e51cd2088956f83d9b87de6d033))

### Code Refactoring

* **dev-toolbar:** use native Vite 8 tsconfigPaths in cloudflare example ([fb15d1d](https://github.com/visulima/visulima/commit/fb15d1df62040853a36e7926382765e902380d3a))
* **dev-toolbar:** use native Vite 8 tsconfigPaths in tanstack-start example ([d89aef7](https://github.com/visulima/visulima/commit/d89aef7c2ba4a8443897d3f7cb9ada494d38d2c4))
* **docs:** migrate Nextra components to fumadocs-ui, remove Nextra stripping ([484878f](https://github.com/visulima/visulima/commit/484878f01879363ef5e9a0282904dc4627d6060c))

## @visulima/dev-toolbar [1.0.0-alpha.5](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.4...@visulima/dev-toolbar@1.0.0-alpha.5) (2026-03-06)

### Features

* **dev-toolbar:** add assets app export and make axe-core an optional peer dependency ([812bc8d](https://github.com/visulima/visulima/commit/812bc8d45ef760862d43f59665e1f86c7d4a5008))
* **dev-toolbar:** add singleton guard, SEO JSON-LD validation, editor preference, and tests ([7584425](https://github.com/visulima/visulima/commit/758442518f8390b1faa0fd553d7ed1aaa4d9c037))
* **dev-toolbar:** implement iframe app rendering and custom app registration ([a1585a8](https://github.com/visulima/visulima/commit/a1585a8bd3624ae13b40fa386cd66b62c29ca08f))
* **dev-toolbar:** keep inspector active after element click and fix UX issues ([8f7e88a](https://github.com/visulima/visulima/commit/8f7e88a874f6412a15bf2adde9ddd95948b07c22))
* **dev-toolbar:** overhaul vite config app UI with env masking and improved layout ([7cfee9d](https://github.com/visulima/visulima/commit/7cfee9da5957fb9ffbcc940d9948909c4677efb6))
* **dev-toolbar:** redesign vite config app with tabbed interface ([087df63](https://github.com/visulima/visulima/commit/087df630dc378933e54d1587d40c99f19fca0df0))
* **dev-toolbar:** remove more overflow app ([cd3f369](https://github.com/visulima/visulima/commit/cd3f369c176c598d2e9a2bcdef194b7d457d343f))

### Bug Fixes

* **dev-toolbar:** move removePopupOutsideHandler declaration before first use ([d734a84](https://github.com/visulima/visulima/commit/d734a847b7f0b4574f081b9b78b2fce3d2b0e698))
* **dev-toolbar:** resolve all ESLint errors across src files ([165b471](https://github.com/visulima/visulima/commit/165b471c95099bff76ba78d054664e79cfcdcb9a))
* **dev-toolbar:** resolve ESLint errors in test files and config ([ea7e46c](https://github.com/visulima/visulima/commit/ea7e46c13db73431738a8f75febb847f3e7e530b))
* **dev-toolbar:** resolve ESLint errors in vite-config app and RPC function ([fedce68](https://github.com/visulima/visulima/commit/fedce686ca59ba5d5b82cd10abfffa8d91a738c1))
* **dev-toolbar:** split single-line mock factories to satisfy max-statements-per-line ([025b972](https://github.com/visulima/visulima/commit/025b9722b6e854cf1ae53694597e64c63493f730))
* **dev-toolbar:** update packem to 2.0.0-alpha.54 ([f9779c9](https://github.com/visulima/visulima/commit/f9779c9e8dc7637db3bfef341cb66233469f653f))
* removed old test ([bfa9e78](https://github.com/visulima/visulima/commit/bfa9e784b2e183ed481d432290070ee554b357ac))

### Performance Improvements

* **dev-toolbar:** replace tailwind-merge with clsx in cn() utility ([6c4740c](https://github.com/visulima/visulima/commit/6c4740c8ce890d955cecbf634dada65fd8a99769))

### Documentation

* **dev-toolbar:** add assets app documentation ([bea25b9](https://github.com/visulima/visulima/commit/bea25b96f7f7dbb2f3952b6c04d38d032569760d))
* **dev-toolbar:** add iframe app documentation and remove more app references ([03dab85](https://github.com/visulima/visulima/commit/03dab85a92c5ee27b18db018c9dc263a1a3f1ea4))
* **dev-toolbar:** add vite-overlay integration guide ([8f6f25a](https://github.com/visulima/visulima/commit/8f6f25aae43f0c32380ede56a93915897a4a939f))
* **dev-toolbar:** update a11y docs to reflect optional axe-core peer dependency ([50396e8](https://github.com/visulima/visulima/commit/50396e8b18c56e716d119a468fa0b1219e789dff))
* **dev-toolbar:** update built-in app docs for opt-in defaults and add SEO structured data section ([e95050a](https://github.com/visulima/visulima/commit/e95050aa419fe1a85664ccd5c88a3967de70b113))

### Miscellaneous Chores

* **dev-toolbar:** enable a11y in tanstack-start-cloudflare example and fix LICENSE whitespace ([e02cd3e](https://github.com/visulima/visulima/commit/e02cd3edf2426c709d8247cc77f999f56315438e))
* **dev-toolbar:** update dependencies ([1be313b](https://github.com/visulima/visulima/commit/1be313bf37cd32739ddbb275e1af58dcf029e9a1))
* **dev-toolbar:** update examples to enable assets and inspector apps ([b3dc74d](https://github.com/visulima/visulima/commit/b3dc74d999acbfe4ee564a141dea47cf5ea2f71a))
* update dependencies and fix vite-react-rolldown example ([8811909](https://github.com/visulima/visulima/commit/8811909e90877b0041e4b08cdd797d58749464e9))
* year update ([47f4105](https://github.com/visulima/visulima/commit/47f410596ce7190cfea36a073db32e0cec50bbcd))

### Code Refactoring

* **dev-toolbar:** replace cn wrapper with direct clsx imports ([6ac069b](https://github.com/visulima/visulima/commit/6ac069bf0f2e772f0a5626a47d9034b824a5b23a))
* **dev-toolbar:** replace cn() wrapper with clsx() directly ([e774b36](https://github.com/visulima/visulima/commit/e774b367f9270dd9e43fcf0b7147a8cd23a1734a))

## @visulima/dev-toolbar [1.0.0-alpha.4](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.3...@visulima/dev-toolbar@1.0.0-alpha.4) (2026-03-04)

### Bug Fixes

* allowed vite 8 ([807071e](https://github.com/visulima/visulima/commit/807071ea041e1beaf7e773ac6bbd23efa9f33b32))
* **dev-toolbar:** exclude inspector and tailwind from More "Additional Apps" ([812252a](https://github.com/visulima/visulima/commit/812252a96916ac346765631a0997ff2150e54e40))

### Miscellaneous Chores

* deps update ([9be09e9](https://github.com/visulima/visulima/commit/9be09e95e2bce8fe52e88b186c43b8cc6bae865c))
* **dev-toolbar:** fix all ESLint errors and warnings across src and tests ([a14d2ed](https://github.com/visulima/visulima/commit/a14d2ed116b23ff1c61db28324b76aa55931919c))
* **dev-toolbar:** remove external Google Fonts dependency ([2e81646](https://github.com/visulima/visulima/commit/2e81646f49a886d8ef9df7f9c951c87363f9b50d))

## @visulima/dev-toolbar [1.0.0-alpha.3](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.2...@visulima/dev-toolbar@1.0.0-alpha.3) (2026-03-03)

### Features

* **dev-toolbar:** add editor option to configure launch-editor per project ([2003693](https://github.com/visulima/visulima/commit/200369383470a835c5312b8af7b11e4d4183c369))
* **dev-toolbar:** add JSX source injection Vite plugin for inspector click-to-source ([2c5c5a6](https://github.com/visulima/visulima/commit/2c5c5a65399cd8cb14b10c83a9346364e7ca3ecd))
* **dev-toolbar:** add light/dark theme awareness to inspector overlays ([2bd30ee](https://github.com/visulima/visulima/commit/2bd30eeb9e7047894d8287a63b4719873df22375))
* **dev-toolbar:** add open-in-editor, copy HTML, and copy path to inspector ([f88e9b0](https://github.com/visulima/visulima/commit/f88e9b0d21979dd1214c511a9474b0204bb16191))
* **dev-toolbar:** add Preact-native UI kit and migrate apps to use it ([2fced8e](https://github.com/visulima/visulima/commit/2fced8e8547409ad9d39fd9af2a81010a5fd1999))
* **dev-toolbar:** add removeDevtoolsOnBuild option to Vite plugin ([d8d1d67](https://github.com/visulima/visulima/commit/d8d1d67a20747df23da60e4d81a2acd89516dc48))
* **dev-toolbar:** implement timeline event capture for HMR, network and JS errors ([9851ac7](https://github.com/visulima/visulima/commit/9851ac7a12a3b72d52b4f705c2afa7ecbfdf3cc0))

### Bug Fixes

* **dev-toolbar:** add suppressHydrationWarning to prevent SSR hydration mismatch ([3c5d8e0](https://github.com/visulima/visulima/commit/3c5d8e0eb7eaf786dbe029598f50dfb2b5ce68a6))
* **dev-toolbar:** align UI components and inspector with design system ([93ff58b](https://github.com/visulima/visulima/commit/93ff58b88e61d2eab8b3289cf3ad76028380a45f))
* **dev-toolbar:** correct broken test assertions for settings, button, input, and textarea ([770100f](https://github.com/visulima/visulima/commit/770100f5a73b634e65373fb2b2e344a353a0978c))
* **dev-toolbar:** fix inspector by closing panel during inspection and move settings to bottom ([575e79c](https://github.com/visulima/visulima/commit/575e79ce2c581c0f48eae55589c83d9dbb30b6f1))
* **dev-toolbar:** hide action-only apps (e.g. Inspector) from canvas sidebar ([9fcf7e1](https://github.com/visulima/visulima/commit/9fcf7e1786ec4b7c1666da6500f011eff13a2fd2))
* **dev-toolbar:** prevent action buttons from opening the canvas panel ([113e540](https://github.com/visulima/visulima/commit/113e540bb19d5dbedc6fbef9138bf04d2434b7f1))
* **dev-toolbar:** prevent hydration mismatch from data-vdt-source in SSR apps ([231ecc7](https://github.com/visulima/visulima/commit/231ecc73f70a49da4a6cd0b584760d12369bd8f0))
* **dev-toolbar:** remove redundant server arg from RPC function dispatch ([a941dc7](https://github.com/visulima/visulima/commit/a941dc7e593d3681bed61b374262abb8a476392b))
* **dev-toolbar:** replace require() with dynamic import() in openInEditor ([3fede74](https://github.com/visulima/visulima/commit/3fede740db2c431c6bb62897d13a0d9afb8cc65a))
* **dev-toolbar:** split RPC barrel and fix open-in-editor with launch-editor ([28e079a](https://github.com/visulima/visulima/commit/28e079afa10ac4ed2e729205f8bdf9405d33c1c2))
* **dev-toolbar:** use HMR WebSocket RPC to open files in editor ([a63cdab](https://github.com/visulima/visulima/commit/a63cdab1c30f9f73eb6b5f59f7c1ee4143135eba))
* **dev-toolbar:** use original file positions to prevent SSR hydration mismatch ([a40edd5](https://github.com/visulima/visulima/commit/a40edd5fb1a11a5208182dd71627b472f64db6c5))

### Documentation

* **dev-toolbar:** document removeDevtoolsOnBuild option ([00955b2](https://github.com/visulima/visulima/commit/00955b2a484df78f66b4c58babbeb514d4943285))
* **dev-toolbar:** update docs for all recent feature additions ([b204e0f](https://github.com/visulima/visulima/commit/b204e0f8956cafb6967363fa0cc2b01c435cdedc))

### Code Refactoring

* **dev-toolbar:** convert inspector to toolbar action button ([0d0b682](https://github.com/visulima/visulima/commit/0d0b682e65511c158baa29134a8c50e7db459284))

## @visulima/dev-toolbar [1.0.0-alpha.2](https://github.com/visulima/visulima/compare/@visulima/dev-toolbar@1.0.0-alpha.1...@visulima/dev-toolbar@1.0.0-alpha.2) (2026-03-01)

### Bug Fixes

* **dev-toolbar:** correct Tailwind v4 PostCSS setup in TanStack Start examples ([090da58](https://github.com/visulima/visulima/commit/090da58cbbd87695c238dfd1f7371a6f06b9ef80))
* **dev-toolbar:** dismiss tooltip on button click ([0ed60af](https://github.com/visulima/visulima/commit/0ed60af72f2390f8fcebde063d35e45e6f7fe9b8))
* **dev-toolbar:** handle CJS/ESM interop for axe-core dynamic import ([7a86907](https://github.com/visulima/visulima/commit/7a8690730b7c7858beb635dc1d66869d5b5e19e2))
* **dev-toolbar:** use appendTo in TanStack Start examples for SSR ([0844250](https://github.com/visulima/visulima/commit/0844250edbeeda1dfdc28058316bb6303e91fda6))

### Documentation

* **dev-toolbar:** document appendTo for SSR frameworks (TanStack Start) ([eba507e](https://github.com/visulima/visulima/commit/eba507eba8d0b705f23f32e7c08dc40fca87473a))

### Miscellaneous Chores

* **dev-toolbar:** add framework examples for six setups ([38117c1](https://github.com/visulima/visulima/commit/38117c1e0d6d8d3abb94785d95780482f5870d5c))
* **dev-toolbar:** add TanStack Start + Cloudflare Pages example ([1463ef8](https://github.com/visulima/visulima/commit/1463ef892669215bdc71fe90048e40cfbb4907c0))
* **dev-toolbar:** add TanStack Start and Cloudflare examples ([ddfe175](https://github.com/visulima/visulima/commit/ddfe17571bb416712eb02f4ae0222d182bdc2844))
* remove IDE configs, memory-bank, and stale lint script ([3a1100e](https://github.com/visulima/visulima/commit/3a1100e1f9e5dae6fb6fefd486195e8cc80fc578))

## @visulima/dev-toolbar 1.0.0-alpha.1 (2026-02-28)

### Features

* **dev-toolbar:** initialize dev-toolbar package  ([#586](https://github.com/visulima/visulima/issues/586)) ([a3ab9d6](https://github.com/visulima/visulima/commit/a3ab9d6e6c768853854b95fa8eee908b95235ea5))
