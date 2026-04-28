## @visulima/tui [1.0.0-alpha.5](https://github.com/visulima/visulima/compare/@visulima/tui@1.0.0-alpha.4...@visulima/tui@1.0.0-alpha.5) (2026-04-28)

### Bug Fixes

* **tui:** annotate Array.from element type in histogram ([8f94a52](https://github.com/visulima/visulima/commit/8f94a52e775430c1336a3b24e9d7a30b59afb3f9))

### Miscellaneous Chores

* re-sort workspace package.json files via vis sort-package-json ([f625696](https://github.com/visulima/visulima/commit/f625696cfac974325774b3243e1a83c3d23acbd7))
* **tui:** upgrade packem to 2.0.0-alpha.76 ([12e76e0](https://github.com/visulima/visulima/commit/12e76e05c3c7f2656af061a058f6812c7c45d1e4))

### Tests

* **tui:** use runtime expect in LineChart empty-series test ([0a6e167](https://github.com/visulima/visulima/commit/0a6e167a332cf35b21391f325ab0ce29591a8ece))

## @visulima/tui [1.0.0-alpha.4](https://github.com/visulima/visulima/compare/@visulima/tui@1.0.0-alpha.3...@visulima/tui@1.0.0-alpha.4) (2026-04-22)

### Bug Fixes

* updated install script ([bdeaece](https://github.com/visulima/visulima/commit/bdeaeced0357901dfd92cf1e5a4345cc8924ad65))

## @visulima/tui [1.0.0-alpha.3](https://github.com/visulima/visulima/compare/@visulima/tui@1.0.0-alpha.2...@visulima/tui@1.0.0-alpha.3) (2026-04-22)

### Features

* Add comprehensive Ink UI component library with 40+ components ([#614](https://github.com/visulima/visulima/issues/614)) ([24b00a8](https://github.com/visulima/visulima/commit/24b00a8855b1ddb509b85c4a3e0f9f3d76323f76))
* **tui:** port ink upstream PR 115/119/123/125 ([2232485](https://github.com/visulima/visulima/commit/22324855fbcca38bc263d46194ccf30522ecc599))

### Bug Fixes

* **ci:** always run native build job so artifacts are available ([51f3428](https://github.com/visulima/visulima/commit/51f34285bc04a0f6347609db240814862646c1cc))
* **ci:** publish native addons via local semantic-release plugin ([974beb2](https://github.com/visulima/visulima/commit/974beb2d021e7b2afc86b958bd2137be88d2f464))
* Remove JSR configuration generation script and generated jsr.json files ([#616](https://github.com/visulima/visulima/issues/616)) ([533744b](https://github.com/visulima/visulima/commit/533744b103b74896941db5b727173e617a27a63b))
* Replace resetTerminal with clearScreenAndHomeCursor to preserve scrollback ([#605](https://github.com/visulima/visulima/issues/605)) ([6a79e4d](https://github.com/visulima/visulima/commit/6a79e4d8350b90ec553ad5fbcf825d9ac30ece66))
* **terminal:** resolve eslint and formatting issues ([8f30389](https://github.com/visulima/visulima/commit/8f30389deb9ff81e7afce0aa064ef11fcb179f23))
* **tui:** declare static props on Form/Transition for isolatedDeclarations ([c30b9f1](https://github.com/visulima/visulima/commit/c30b9f148cf4ea75e54a9e358fea085a34f680e8))
* **tui:** fixed types ([abe7106](https://github.com/visulima/visulima/commit/abe7106aa1f55340d1b218f4b338709a0317c671))
* **tui:** floor text node width when calling wrapOrTruncateStyledChars ([1d06086](https://github.com/visulima/visulima/commit/1d06086404c54b46baec8f688fc1e39228a0ab75))
* **tui:** inline component and hook barrel exports in ink entry ([1cf8dd2](https://github.com/visulima/visulima/commit/1cf8dd25c91a2001268fb9d964d95df649bf7832))
* **tui:** narrow ANSI_CODES type and cast yoga Node remove call ([87b2c67](https://github.com/visulima/visulima/commit/87b2c6787d44ae630a0eece56b3b2df395a7c63b))
* **tui:** rename components to kebab-case, fix broken test assertions, protect fixtures from auto-format ([caa2e86](https://github.com/visulima/visulima/commit/caa2e86f7500467e56c89b3671d0e33b6b5d0173))
* **tui:** type histogram bucket counts as number[] ([883eca4](https://github.com/visulima/visulima/commit/883eca42cf74df3db8409a5f921d75371ba79070))

### Miscellaneous Chores

* bump engines.node to ^22.14.0 || >=24.10.0 ([c3d0931](https://github.com/visulima/visulima/commit/c3d0931d1504e4f21ebf50ea680cfa7ce4ba15ce))
* fixed jsr.json ([5d85e51](https://github.com/visulima/visulima/commit/5d85e5179de38e284ec433b14d77c71a1619c8d6))
* remove unused deprecated aliases ([#612](https://github.com/visulima/visulima/issues/612)) ([24ee546](https://github.com/visulima/visulima/commit/24ee546bcb2c17b8915622e4878797c00aa1d813))
* **tui:** apply formatter and lint fixes ([e70da36](https://github.com/visulima/visulima/commit/e70da3672d1c06cbbe2a6294c86535d770dc04bf))
* **tui:** apply pending changes ([f432dc8](https://github.com/visulima/visulima/commit/f432dc8aae2c4f26b43132d956067b770d4a9548))
* **tui:** apply pending lint and source updates ([7fe85fe](https://github.com/visulima/visulima/commit/7fe85fe0261d2d792762971c56a98fe1c03040a6))
* **tui:** enforce curly braces and apply lint fixes ([ffab48f](https://github.com/visulima/visulima/commit/ffab48f89720a8e906d863bb3539c86bee9783a5))

### Code Refactoring

* replace inline import() types with top-level imports ([4569a4c](https://github.com/visulima/visulima/commit/4569a4ca04723da069f985855dcfab292f7347e1))
* **tui:** switch spinner to @visulima/spinner ([0c2e2f4](https://github.com/visulima/visulima/commit/0c2e2f498e8c2f4bee46b257dfc1f61d5924a012))

### Tests

* **secret-scanner:** add per-file JIT warmup and extended timeouts ([3255e63](https://github.com/visulima/visulima/commit/3255e636cb554e3bfb40e8c4cafd6108034f9acf))
* **tui, dev-toolbar:** fix expect.assertions counts on looped assertions ([898bc59](https://github.com/visulima/visulima/commit/898bc59ef217f7c8ee2aa7fdf7da3d355c028b13))
* **tui:** fix 15 broken ink component tests ([c1e25a0](https://github.com/visulima/visulima/commit/c1e25a00d0fbd4532df0802a07452dc803e93f79))
* **tui:** move expect.assertions past platform-guard early returns ([f3ce2e3](https://github.com/visulima/visulima/commit/f3ce2e3eecac57192f4b91582ca990e4256b4538))
* **tui:** move remaining expect.assertions past platform guards ([c227075](https://github.com/visulima/visulima/commit/c2270756cfdc87fa083ea1f8f90d6ece76951540))
* **tui:** stabilize flaky ink input and chart tests ([183be7b](https://github.com/visulima/visulima/commit/183be7b2a1cfcdf4fa6f57f6ee02b5b8d62b29a4))
* **tui:** stabilize flaky ink input tests and remove native guard ([445abd8](https://github.com/visulima/visulima/commit/445abd85a0b44707f28122e8b1921564af728f33))


### Dependencies

* **@visulima/boxen:** upgraded to 3.0.0-alpha.10
* **@visulima/spinner:** upgraded to 1.0.0-alpha.1

## @visulima/tui [1.0.0-alpha.2](https://github.com/visulima/visulima/compare/@visulima/tui@1.0.0-alpha.1...@visulima/tui@1.0.0-alpha.2) (2026-04-09)

### Features

* **tui:** add controlled value prop to Tabs component ([df1158d](https://github.com/visulima/visulima/commit/df1158dc036f7159ef909f497453e2e5dd1058df))

## @visulima/tui 1.0.0-alpha.1 (2026-04-08)

### Features

* Add screen, keys, and waitFor helpers to TUI testing API ([#604](https://github.com/visulima/visulima/issues/604)) ([a98c6a1](https://github.com/visulima/visulima/commit/a98c6a18421ee4a1f23f57bbe3eb39b5ba6c6788))
* **string): native indent implementation; refactor(tui:** replace indent-string and is-fullwidth-code-point ([1368488](https://github.com/visulima/visulima/commit/136848850242ddeae91320dd21d6fdeb0760768c))
* **tui:** add @visulima/tui package with native Rust diff engine ([85fa477](https://github.com/visulima/visulima/commit/85fa477cf7060dcec51e252afee17e655fa53ace))
* **tui:** add Badge, StatusMessage, Alert, UnorderedList, and OrderedList components ([142fbae](https://github.com/visulima/visulima/commit/142fbae1700088f2bb676b594607afcc04157174))
* **tui:** add BigText component ported from ink-big-text ([6af0bf3](https://github.com/visulima/visulima/commit/6af0bf38d334734b0e2d4a45d1ce8c1e25cfeb45))
* **tui:** add border title support to Box component ([e9f35dc](https://github.com/visulima/visulima/commit/e9f35dc37c9ebb624ca370b54504695103fd8cbb))
* **tui:** add Code, Markdown, and DiffView components with syntax highlighting ([7bd6b51](https://github.com/visulima/visulima/commit/7bd6b517f490a31f052cc513e045cbf8b6bf2f6d))
* **tui:** add Cursor component with inline mode and fix incremental rendering ([9899187](https://github.com/visulima/visulima/commit/98991878cf3222e86e853dbb173b92f1902aa622))
* **tui:** add cursor-input example entry point ([5f4342c](https://github.com/visulima/visulima/commit/5f4342c18412006efc81165b74ebb2172b98cdb2))
* **tui:** add getBackgroundColorEscape helper and background cache test ([889e314](https://github.com/visulima/visulima/commit/889e3148c7f827302ee77f8f2bbb0e270be1d6c1))
* **tui:** add Gradient component ported from ink-gradient ([92e0113](https://github.com/visulima/visulima/commit/92e0113f67fe14e3a44929ffe5269ab5b091c3ff))
* **tui:** add Link component ported from ink-link, fix screen reader docs ([86f3f40](https://github.com/visulima/visulima/commit/86f3f400820b0996dca4c46fbb557688bc962fa7))
* **tui:** add mouse support for ink layer, ported from @zenobius/ink-mouse ([a25352d](https://github.com/visulima/visulima/commit/a25352d569afa181002ff5ee98dbdac03a9b5cec))
* **tui:** add native Rust renderer bridge, audit fixes, and selection pipeline ([afc8743](https://github.com/visulima/visulima/commit/afc8743cc5561d4948abaa02610f10557c327ab6))
* **tui:** add ProgressBar component ported from ink-progress-bar ([4c7a648](https://github.com/visulima/visulima/commit/4c7a6489c40f4901536782a1a6ad0d3cfb810b69))
* **tui:** add scroll acceleration, color blindness, terminal palette, and console overlay ([27d478d](https://github.com/visulima/visulima/commit/27d478dd8655d8943b03101aebf59a847dadd176))
* **tui:** add scrollbar prop to ScrollView and document scroll approaches ([eb78557](https://github.com/visulima/visulima/commit/eb785578ad4f1e7bb1648872e5f3ec1254219113))
* **tui:** add SelectInput component ported from ink-select-input ([0d2a7fc](https://github.com/visulima/visulima/commit/0d2a7fc06126a899884a556e1cd42693264fd3f4)), closes [#13](https://github.com/visulima/visulima/issues/13) [#13](https://github.com/visulima/visulima/issues/13) [#38](https://github.com/visulima/visulima/issues/38) [#39](https://github.com/visulima/visulima/issues/39) [#22](https://github.com/visulima/visulima/issues/22) [#22](https://github.com/visulima/visulima/issues/22) [#3](https://github.com/visulima/visulima/issues/3) [#4](https://github.com/visulima/visulima/issues/4)
* **tui:** add Slider, Textarea, clipboard, and text selection primitives ([eb0edfb](https://github.com/visulima/visulima/commit/eb0edfbe72d0f6b6bfc5b80104b6124d2688f9da))
* **tui:** add Spinner component, IME tests, and migrate deps to pnpm catalogs ([e117ba6](https://github.com/visulima/visulima/commit/e117ba6c93881d2bd1fb395d2c7405c09b90bcff))
* **tui:** add StyledChar text pipeline, Selection API, and examples ([b7d6fa8](https://github.com/visulima/visulima/commit/b7d6fa8e38a57648f3c57169c1286a9e8c9f341d))
* **tui:** add StyledLine columnar data structure and migrate Output grid ([b497554](https://github.com/visulima/visulima/commit/b49755438290600f3b483e10dfcff2ad991b849f))
* **tui:** add StyledLine.writeFrom() bulk write method ([8accc25](https://github.com/visulima/visulima/commit/8accc25505c82322aa0d31580048a38e4a4b9849))
* **tui:** add Tab and Tabs components ported from ink-tab ([5d4c439](https://github.com/visulima/visulima/commit/5d4c439dc26fabf8a68cc99d3ae795e035fdc37f))
* **tui:** add Table component ported from ink-table ([f1bb95c](https://github.com/visulima/visulima/commit/f1bb95c2dc5599f9f22eb585573aac52423fb50f))
* **tui:** add TextInput, ConfirmInput, and MultiSelect components ([00fa435](https://github.com/visulima/visulima/commit/00fa4356a9309e49ba752a9bdfb244241b16eecb))
* **tui:** add Timer, Stopwatch, Help, Paginator, FilePicker components and consolidate exports ([4b2a98f](https://github.com/visulima/visulima/commit/4b2a98f8b6a882763cae4980db402438785cd455))
* **tui:** add TreeView component with keyboard navigation and selection ([f3421e3](https://github.com/visulima/visulima/commit/f3421e36540f8c7a229e0176c683cb94c0d46e0f))
* **tui:** add useAnimation hook with shared-timer architecture ([129c036](https://github.com/visulima/visulima/commit/129c036cf1debc76650d97ad5da00ee5a03d5fc1))
* **tui:** add wrap-anywhere, wrap-preserve-words, and wrap-strict text wrap modes ([e850c12](https://github.com/visulima/visulima/commit/e850c12e866d11ab1a20ec39f7e0c2f624c87d41))
* **tui:** apply StaticRender render-function pattern from jacob314/ink[#99](https://github.com/visulima/visulima/issues/99) ([d8f03ce](https://github.com/visulima/visulima/commit/d8f03ce3f4b5be784b5993bd28458cd24a8e6830))
* **tui:** native StyledLine word-wrapping in text-wrap.ts ([187daf5](https://github.com/visulima/visulima/commit/187daf51a5d9ae0441968712661aaffe46cc4936))
* **tui:** Phase 6 — addRegionTree() and cachedRender activation ([6eedf67](https://github.com/visulima/visulima/commit/6eedf6798ce6b30c8766a6b545fe210933969961))
* **tui:** Phase 6 complete — Region-based Output with startChildRegion/endChildRegion ([f7d5e3c](https://github.com/visulima/visulima/commit/f7d5e3c59f029dd58cabee901c23b61c84721bbd))
* **tui:** Phase 6 scaffolding — Region type, setCachedRender, render-cached ([417ede8](https://github.com/visulima/visulima/commit/417ede80e707a925e34b6ff2c0830a6999d7d49e))
* **tui:** Phase 7 complete — Render caching with StaticRender component ([64cb21f](https://github.com/visulima/visulima/commit/64cb21fbae6f27ed5f4d1df1535ffdd3ee9bae65))
* **tui:** port scroll, sticky headers, and ResizeObserver from jacob314/ink ([7676c7c](https://github.com/visulima/visulima/commit/7676c7c2d446f3d288e8ab6515059fbd0e2b82e2))
* **tui:** re-export ink-scroll-view, ink-scroll-bar, and ink-scroll-list ([67e6cae](https://github.com/visulima/visulima/commit/67e6caef326ae0f7b9d540ab0b976ad3fa750545))
* **tui:** support nested StaticRender and cache trimmed length ([05ec31c](https://github.com/visulima/visulima/commit/05ec31c5b9b02e9cb5e658b0ec077a7c1feec66f))
* **vis:** add interactive progress bar and replace CI detection with is-in-ci ([255a1b1](https://github.com/visulima/visulima/commit/255a1b100d0dd4bc614094f292b61fc88bc4ad62))
* **vis:** expand devcontainer command with templates, validation, and config properties ([807e730](https://github.com/visulima/visulima/commit/807e730a43f0ea644d016b4f5506706972d2ff41))
* **vis:** replace inline TUI with full-screen Nx-style interactive task runner ([1409aad](https://github.com/visulima/visulima/commit/1409aad879c713051bba12298a3feb1d5ba852f2))
* **vis:** set terminal title to project name on startup ([204622a](https://github.com/visulima/visulima/commit/204622acd943ccad738b33f5e945190e38f5839f))

### Bug Fixes

* **ci:** make native-binding tests work with and without compiled binary ([9a40fb4](https://github.com/visulima/visulima/commit/9a40fb40d5cba9fcd2e0176eea8b7bf8d9792c7d))
* remove deprecated baseUrl and downlevelIteration from tsconfigs ([a708366](https://github.com/visulima/visulima/commit/a708366b5c3bc73cfde480a712ed397bd921fb93))
* **task-runner,tui:** guard null native events and increase CI test timeout ([e76a791](https://github.com/visulima/visulima/commit/e76a791d90043537e08be0545f706e35acaa555d))
* **task-runner:** use JS fallback for onEvent streaming, fix StaticRender ref ([1a7165c](https://github.com/visulima/visulima/commit/1a7165cd9eb71472895cd08682983fa25703dc93))
* **tsconfig:** add node types and fix implicit any parameter ([1744d82](https://github.com/visulima/visulima/commit/1744d82a07fca03f2e6ff660b918e9b2623acf69))
* **tui:** add explicit return type to useStateRef for isolatedDeclarations ([cf17127](https://github.com/visulima/visulima/commit/cf1712704faea841b8503b02420bad42519badde))
* **tui:** add missing arrow in bench file arrow functions ([a1b524f](https://github.com/visulima/visulima/commit/a1b524ff44db381d573c3967d5b2e2674ae72564))
* **tui:** address code review findings ([d4e02c3](https://github.com/visulima/visulima/commit/d4e02c373736b77779021a394c41c573291c2abd))
* **tui:** address review findings across ported components ([cb727de](https://github.com/visulima/visulima/commit/cb727dec62ad67a16b279bdee96b6e8d48f11b62))
* **tui:** address SelectInput code review findings ([5a7cf1c](https://github.com/visulima/visulima/commit/5a7cf1ceb4080701d3576aa7b13060b176b380ee))
* **tui:** apply upstream ResizeObserver NaN guard and measurement extraction ([bcd4fd1](https://github.com/visulima/visulima/commit/bcd4fd16e7e0fda7d3de09657dfe76ce46fa370a))
* **tui:** benchmarks now use production dist/ build, not tsx source ([b84eb43](https://github.com/visulima/visulima/commit/b84eb436793a0e0e89d406215ef28a20885eb754))
* **tui:** calculate scroll state in renderToString and add Box scroll tests ([888f8e1](https://github.com/visulima/visulima/commit/888f8e10044073c3558bf4b947f341515c66fba2))
* **tui:** filter ctrl/meta chord characters in TextInput insertion ([3531b35](https://github.com/visulima/visulima/commit/3531b35dcc79e7a1954136b37f0a6220c8856eee))
* **tui:** fix alternate-screen tests in CI and increase retry count ([1330266](https://github.com/visulima/visulima/commit/13302665d2c0f1c7ade0f7c73d52db8ca206f384))
* **tui:** fix beforeExit handler and output clipping for wide content ([1752ed3](https://github.com/visulima/visulima/commit/1752ed3088af025d0a271a97ce1180882f8abd93))
* **tui:** fix cursor suspense test failing in CI ([14372c7](https://github.com/visulima/visulima/commit/14372c7b0a102eb20c8da4870b3c0bc899e2c08c))
* **tui:** fix flaky useInput discrete-priority test race condition ([4221e96](https://github.com/visulima/visulima/commit/4221e96dd33fe5a4e0c00939ed1a83853be499ec))
* **tui:** fix remaining test lint issues ([74c5ec0](https://github.com/visulima/visulima/commit/74c5ec0afb6a108c86fcb22b21bf4d3f8143cd90))
* **tui:** fix rendering bugs, add edge-case tests and layout snapshots ([ecaff75](https://github.com/visulima/visulima/commit/ecaff75ea6c7d2c41c8c84eeaa1870d1d6cf83d7)), closes [#RGB](https://github.com/visulima/visulima/issues/RGB)
* **tui:** fix Select All keybinding, scroll double-emit, and type safety issues ([234a164](https://github.com/visulima/visulima/commit/234a1641956693870de4d8e116bd3ed535fd59f4))
* **tui:** fix StaticRender isolatedDeclarations error ([5a156d1](https://github.com/visulima/visulima/commit/5a156d18e662e9a7123b27fb40f0847e67af91c0))
* **tui:** fix StyledLine serializer escape code ordering and dim/bold interaction ([434bb42](https://github.com/visulima/visulima/commit/434bb428f6cafa6cb6bf2781c255fd4f4c5c3a25))
* **tui:** fix test failures and add missing ime-utils module ([6d20130](https://github.com/visulima/visulima/commit/6d201304274c48380895706abfc2cef2e350dbdf))
* **tui:** fix test mock stdin setup and incorrect assertions ([4f6d877](https://github.com/visulima/visulima/commit/4f6d8774e37e3fc276f1163e00d464908115e9b3))
* **tui:** improve test reliability for PTY and timing-sensitive tests ([d66d68e](https://github.com/visulima/visulima/commit/d66d68eb48ecb93adb8c00b1e9247c2a474d3d76))
* **tui:** make interactive tests CI-safe by setting interactive: true ([477b003](https://github.com/visulima/visulima/commit/477b00334e6722e1f2de1bf8149d7000a0be93c3))
* **tui:** map 0x7F to backspace instead of delete in key parser ([bd111a5](https://github.com/visulima/visulima/commit/bd111a5884758317b4bd6ca6a7b87e2b182f2590)), closes [ink-rs/ink#634](https://github.com/ink-rs/ink/issues/634)
* **tui:** prevent interactive apps from exiting on beforeExit ([449e84c](https://github.com/visulima/visulima/commit/449e84ca739d9dd48728f40ad9514359306f9527))
* **tui:** properly fix eslint errors in code ([6fc67aa](https://github.com/visulima/visulima/commit/6fc67aa9d6381e7d8763e0dab8acec272f16f763))
* **tui:** remove 16-bit offset limit from StyledLine and guard negative border sizes ([526bd35](https://github.com/visulima/visulima/commit/526bd357b4ec2512271612bdcc0e24d5da9ebc7c))
* **tui:** resolve all StyledLine serializer edge cases ([445d798](https://github.com/visulima/visulima/commit/445d7983f791593507c70a70314a3ea658cb780e))
* **tui:** resolve all TypeScript and ESLint errors ([c623c2a](https://github.com/visulima/visulima/commit/c623c2a17842a7bea29c1cac4daa770cda87dc4a))
* **tui:** resolve isolatedDeclarations build errors and runtime bugs ([2c0f2bb](https://github.com/visulima/visulima/commit/2c0f2bba384e50ddca975ea5df83149585fbd016))
* **tui:** resolve remaining ESLint errors across all source files ([4f996cb](https://github.com/visulima/visulima/commit/4f996cb546f81d2925a71b5c04d0f85dbc5d3a9c))
* **tui:** revert write-path slice+combine optimization ([56a2e63](https://github.com/visulima/visulima/commit/56a2e63bce941d70823a105bbd7e30411d89461f))
* **tui:** skip flaky IME flush test on Linux PTY ([9dec064](https://github.com/visulima/visulima/commit/9dec064ac7795341abd0e34200791c2a60a56fb7))
* **vis,tui:** fix 10 code review issues across TUI components ([3410347](https://github.com/visulima/visulima/commit/34103473cb661cca4187661e59b396eecff1bdec))
* **vis,tui:** validate directory in detectPm and use useLayoutEffect in StaticRender ([de53e9b](https://github.com/visulima/visulima/commit/de53e9b7a944a3778f0d10f1daa1653a1063d9b3))

### Performance Improvements

* **tui:** add setCharFast() to StyledLine and use in Output hot path ([61e507f](https://github.com/visulima/visulima/commit/61e507f3a5e3a0d852e4c18fc68d87d7aa8d5188))
* **tui:** batch StyledChar-to-StyledLine conversion in processStyledWriteOperation ([6035dbc](https://github.com/visulima/visulima/commit/6035dbc2e68085f4f2fa1022fd3a34fa0ce1a03d))
* **tui:** optimize ink components for re-render performance and fix pre-existing type errors ([8803a2f](https://github.com/visulima/visulima/commit/8803a2f4e3c705b93266d9814744c06412e6f1a2))
* **tui:** optimize render pipeline and defer kitty keyboard auto-detection ([946ab50](https://github.com/visulima/visulima/commit/946ab5058bfeb49daabe0f56fa1f9ffacf3c9a70))
* **tui:** Phase 4 — StyledLine fast path in text pipeline ([7c36e92](https://github.com/visulima/visulima/commit/7c36e929a5c0c5dd4526e6934df43cfe551a01ab))
* **tui:** port jacob314/ink micro-optimizations ([cc0131d](https://github.com/visulima/visulima/commit/cc0131d3efa832330e6eb129ec3d61e0d8be3887))
* **tui:** remove autoBind overhead and optimize App component ([b0c4f36](https://github.com/visulima/visulima/commit/b0c4f36e0f0ac44a11942973c6cca9c3e3faa72e))
* **tui:** remove autoBind overhead and optimize App component ([d2adf6b](https://github.com/visulima/visulima/commit/d2adf6bdac1a8f5316bdd0aa6b402ddd054f2146))
* **tui:** remove callBeforeRender tree walk from hot path ([0c18e06](https://github.com/visulima/visulima/commit/0c18e0681091ec13fa904bdafe6aba8c6ca6483f))
* **tui:** remove performance.now() from render hot path ([acb4150](https://github.com/visulima/visulima/commit/acb4150c117677c9634bda7e482da126ed3ec73d))
* **tui:** revert ref-caching in App back to ink's direct dependency pattern ([073f3ef](https://github.com/visulima/visulima/commit/073f3efffb63f52c4b53b92e57977e87dcbb3ea9))
* **tui:** rewrite wrapStyledLine with index-based tracking ([8de898e](https://github.com/visulima/visulima/commit/8de898e9ca429a15e258137d791391100613006e))
* **tui:** simplify and optimize hot path after code review ([b937d4e](https://github.com/visulima/visulima/commit/b937d4efdca0d7691ccacc59afbf67c21d255cb5))
* **tui:** span-walk serializer with getTextRange for O(spans) output ([d5c5e0d](https://github.com/visulima/visulima/commit/d5c5e0d80733edd1a7a5f07432860e390d8d690f))
* **vis:** wrap immutable TUI components with StaticRender ([00e47e9](https://github.com/visulima/visulima/commit/00e47e9f7a6c562570e0b090b7940389451aa1ef))

### Documentation

* **tui:** add ink-ui component examples, media, and examples.mdx updates ([926ca3e](https://github.com/visulima/visulima/commit/926ca3e5b8ce0d0907f0ace22f93e184d6ef9993))
* **tui:** add performance visuals and media from ratatat ([6868e6c](https://github.com/visulima/visulima/commit/6868e6c55b03cad968efd9d67b88b8fc8a009d4e))
* **tui:** add TODO for StyledLine-native measureTextNode ([e5d0407](https://github.com/visulima/visulima/commit/e5d04076cac7244538f88f84ac196e0d575bdf7a))
* **tui:** all 7 phases complete ([a463916](https://github.com/visulima/visulima/commit/a4639169b7efb199d8b4685ba5a3c6ea907c2641))
* **tui:** document border background color support and fix table formatting ([a12cb57](https://github.com/visulima/visulima/commit/a12cb5786fb5885ea7a747fc254528f08a6cbb93))
* **tui:** document Cursor component and useCursor hook ([67606c5](https://github.com/visulima/visulima/commit/67606c5fc93c15f0c20c1c6290d3dfa51f566d81))
* **tui:** restructure README, link to visulima.com for full docs ([00e0de1](https://github.com/visulima/visulima/commit/00e0de199b0f6d496ccd3db27d12d839bfa361db))
* **tui:** update LICENSE.md with complete attribution ([b89b9bd](https://github.com/visulima/visulima/commit/b89b9bd368a7c52458a584787bb4b5bfadc342b3))
* **tui:** update migration plan — Phase 6 scaffolding done ([8b7ca9c](https://github.com/visulima/visulima/commit/8b7ca9c05abf9d3a5836856844b1de3eaf50d612))
* **tui:** update StyledLine migration plan with completion status ([db6b452](https://github.com/visulima/visulima/commit/db6b452622f1bc8e97a1c4878732652ead1f5106))

### Styles

* cs fixs ([0666662](https://github.com/visulima/visulima/commit/066666293c50cde41c796dc38b4b62c48531a3c0))

### Miscellaneous Chores

* added og images ([02d9d1e](https://github.com/visulima/visulima/commit/02d9d1e47be3ce75679ea89e857dc4e4bfe4946b))
* clean up ([c9f395a](https://github.com/visulima/visulima/commit/c9f395a1c80877f5dfa40eefc2fda58837244668))
* path update ([42f4097](https://github.com/visulima/visulima/commit/42f4097b9287be1e70dbfb348626ec21f599fd70))
* remove not needed file ([1944cee](https://github.com/visulima/visulima/commit/1944cee9e6b8083acc728ed69ee2ca2b2a240bc3))
* **tui:** apply linter auto-fixes and formatting ([18b2361](https://github.com/visulima/visulima/commit/18b23617980b889c9bc2568c95de8d863411805d))
* **tui:** apply prettier formatting ([586f156](https://github.com/visulima/visulima/commit/586f1564befa31ce55948836bf9cf504bbfb58a0))
* **tui:** clean up ink.tsx — document React.memo limitation ([55bf3f0](https://github.com/visulima/visulima/commit/55bf3f09e21730e0ccd0c9825edb8c0a8b333880))
* **tui:** configure eslint defaultProject for tsconfig resolution ([a5996e7](https://github.com/visulima/visulima/commit/a5996e7cdbfd9d67b9a56baac1cbb7fb62eeb66a))
* **tui:** configure eslint with typescript-aware linting ([dfeacdb](https://github.com/visulima/visulima/commit/dfeacdb5f546174c419dbad77438ca6be6135005))
* **tui:** expand inline if-return to block syntax ([a89cda6](https://github.com/visulima/visulima/commit/a89cda6171bd53e99bd623e96b56d901d75dae3c))
* **tui:** expand inline if-return to block syntax ([20f1494](https://github.com/visulima/visulima/commit/20f1494b88a22f519cc9d09e955b463dd5dec0cc))
* **tui:** fix all remaining eslint code errors (709 → 218) ([84ad020](https://github.com/visulima/visulima/commit/84ad02027383fc90c10074dbcc8a9b57fe2d64cb))
* **tui:** fix eslint errors and add eslint-disable directives ([d72a525](https://github.com/visulima/visulima/commit/d72a525114502053f059c614c3e82da3c0abd2c0))
* **tui:** migrate .prettierrc.cjs to prettier.config.js ([bbcc819](https://github.com/visulima/visulima/commit/bbcc8193a672a2df80ba3bf5cedadf716db04636))
* **tui:** move scroll media to docs/media, update lockfile and snapshots ([2b30bde](https://github.com/visulima/visulima/commit/2b30bde2e126febdc669fd5dc6d98dbddc6aef99))
* **tui:** remove stale migration comments from styled-line-bridge ([0f371c2](https://github.com/visulima/visulima/commit/0f371c2b97e541e9ef2f18c37f95c5af934a7f16))
* **tui:** resolve TODOs and update migration plan ([5795d2b](https://github.com/visulima/visulima/commit/5795d2ba7038c307ef01a834ca636a09e9cba9b6))
* **tui:** update bundled dependency license formatting ([78637fd](https://github.com/visulima/visulima/commit/78637fd2dd415cc34283f6eab8efa7836f920149))
* update examples ([431fadc](https://github.com/visulima/visulima/commit/431fadc784b9099aa019f15da0dc564eb34f31b4))
* update examples ([51c37c2](https://github.com/visulima/visulima/commit/51c37c2d14e864cb91cf82c6cc59df55ef7c9191))
* update license ([ee53d3f](https://github.com/visulima/visulima/commit/ee53d3f42d0952a793acac0bbe933cc8a4212e05))

### Code Refactoring

* **tui:** apply linting and formatting fixes ([db8f922](https://github.com/visulima/visulima/commit/db8f9226b35a629ef403ac9c0800469bd08a1d08))
* **tui:** apply Vercel React best practices to App component ([f36f02b](https://github.com/visulima/visulima/commit/f36f02b3e0b8b2b8e3c65e661cfb0ddb1a218e6b))
* **tui:** convert Output from operation queue to immediate writes ([cce0a90](https://github.com/visulima/visulima/commit/cce0a90b61b14e43f42cc628340462e107ac7ff4))
* **tui:** extract shared color-utils and unify span mutation ([291a81f](https://github.com/visulima/visulima/commit/291a81fcfb0c14e5c2ee394b25495c6b0a8f2726))
* **tui:** fix additional test lint issues from background agent ([b733b5b](https://github.com/visulima/visulima/commit/b733b5b3449038e5a338f7ddee3277fa6a03b4f0))
* **tui:** fix eslint errors in source files ([69daaa6](https://github.com/visulima/visulima/commit/69daaa66ff53893ac21ca5bfac3f77cd286d173c))
* **tui:** fix eslint errors in test and example files ([11d07ce](https://github.com/visulima/visulima/commit/11d07ce4ff5fd99dd5e3bdd1ea749e372e126464))
* **tui:** fix lint issues in fixtures, tests, and source files ([1935312](https://github.com/visulima/visulima/commit/19353126a86ed8f48e9275c5c69dd2a5b3b31c73))
* **tui:** merge examples-raw/ into examples/raw/ ([180ea9c](https://github.com/visulima/visulima/commit/180ea9c76e2919286c5c8138461aaead29e44d58))
* **tui:** port scroll components, remove ink peer dep ([d8acb7c](https://github.com/visulima/visulima/commit/d8acb7ceb5725ccff96ce20afef928209698db5f))
* **tui:** remove @alcalzone/ansi-tokenize dependency ([dab87d8](https://github.com/visulima/visulima/commit/dab87d8c4d0b2168d0028f8065b1bce5af703a18))
* **tui:** replace chalk and boxen with visulima packages ([a5fb042](https://github.com/visulima/visulima/commit/a5fb0421333840f6e1a823b3d708a2741a059845))
* **tui:** replace external deps with visulima packages ([5a6ecf8](https://github.com/visulima/visulima/commit/5a6ecf8a1c63d44c59756e9ba8053c85de68a2a1))
* **tui:** revert Output from region stack to flat clip model ([d2b13aa](https://github.com/visulima/visulima/commit/d2b13aa3ef53bdc75b9cca4cda780ff149aa71be))
* **tui:** simplify code, add missing tests, improve type safety ([d1035ce](https://github.com/visulima/visulima/commit/d1035ceea25d0778be576bf0c8dc06b26b44a0ad))
* **vis:** unify TUI style across run and update commands ([2c85520](https://github.com/visulima/visulima/commit/2c855204a1972596e079a42e12b3a79aba6c657c))

### Tests

* adjusted test ([7b734cb](https://github.com/visulima/visulima/commit/7b734cbaf684acb38332adf7d6e6ed5cb585a5fb))
* **tui, find-ai-runner:** fix CI-flaky tests with polling and retry ([8f574f5](https://github.com/visulima/visulima/commit/8f574f5cac421fdd7090eb059d4c1d82af3c1f6a))
* **tui:** add @jrichman/ink render benchmark comparison ([0cd8576](https://github.com/visulima/visulima/commit/0cd85769ce51490a4bfe1b2cca39226009b3512e))
* **tui:** add benchmarks for new components and utilities ([dac6310](https://github.com/visulima/visulima/commit/dac63103fe08fc23542ab0331e895c3062a8b96a))
* **tui:** add border background color example and tests ([6b6ee05](https://github.com/visulima/visulima/commit/6b6ee052c1de8e1fdb3522141bd7e7cf6c088eac))
* **tui:** add CJK text truncation tests from ink upstream ([#598](https://github.com/visulima/visulima/issues/598)) ([e8e5002](https://github.com/visulima/visulima/commit/e8e5002b278dc337b280ba8f470c0e4c6223a822))
* **tui:** add ink v6.8.0 test suite converted from Ava to Vitest ([60c9679](https://github.com/visulima/visulima/commit/60c9679fd7e326203f94857cb8a97cb54a460725))
* **tui:** add native-binding test for CI build-native workflow ([b3bffc4](https://github.com/visulima/visulima/commit/b3bffc4f0a5892e2219dc9fe7e395ac761249640))
* **tui:** add scroll component tests and docs with demo SVGs ([2a86ee1](https://github.com/visulima/visulima/commit/2a86ee15a8498e8032ccb187fa18bb654afa547b))
* **tui:** replace expect.hasAssertions with exact expect.assertions counts ([d3fe122](https://github.com/visulima/visulima/commit/d3fe1228e40ee7d030edef7168c49b50c1d780fd))

### Build System

* regenerate NAPI-RS bindings as ESM ([f202caf](https://github.com/visulima/visulima/commit/f202caf3dc383a2ec24815c4935d8d68c29f33d0))
* switch NAPI-RS native builds to ESM output ([3d7cd61](https://github.com/visulima/visulima/commit/3d7cd615ad830392005915735c11771e0247ef3f))


### Dependencies

* **@visulima/ansi:** upgraded to 4.0.0-alpha.8
* **@visulima/colorize:** upgraded to 2.0.0-alpha.8
* **@visulima/string:** upgraded to 3.0.0-alpha.9
* **@visulima/tabular:** upgraded to 4.0.0-alpha.9
* **@visulima/boxen:** upgraded to 3.0.0-alpha.9
