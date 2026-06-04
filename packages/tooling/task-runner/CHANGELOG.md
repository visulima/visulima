## @visulima/task-runner [1.0.0-alpha.19](https://github.com/visulima/visulima/compare/@visulima/task-runner@1.0.0-alpha.18...@visulima/task-runner@1.0.0-alpha.19) (2026-06-04)

### Bug Fixes

* **task-runner:** 3 bug fixes ([ccf08a1](https://github.com/visulima/visulima/commit/ccf08a1faed664d4545b7594bba9afade782b2e5))


### Dependencies

* **@visulima/humanizer:** upgraded to 3.0.0-alpha.13
* **@visulima/path:** upgraded to 3.0.0-alpha.12

## @visulima/task-runner [1.0.0-alpha.18](https://github.com/visulima/visulima/compare/@visulima/task-runner@1.0.0-alpha.17...@visulima/task-runner@1.0.0-alpha.18) (2026-06-02)

### Features

* **task-runner,vis:** per-task pty + concurrency weight, abort cache gate, fspy scaffolds ([#656](https://github.com/visulima/visulima/issues/656)) ([ca64010](https://github.com/visulima/visulima/commit/ca64010b236903e08273680ea65dec7046fcd18b))

### Bug Fixes

* **task-runner:** atomic restoreOutputs and graceful REAPI shutdown ([a3f7088](https://github.com/visulima/visulima/commit/a3f7088c58560f9c98d9d68914ebaf0a458e319d)), closes [#inflightRpcs](https://github.com/visulima/visulima/issues/inflightRpcs) [#closeQuiescenceTimeoutMs](https://github.com/visulima/visulima/issues/closeQuiescenceTimeoutMs)
* **task-runner:** bound fspy drains so a lingering child can't hang the run ([#666](https://github.com/visulima/visulima/issues/666)) ([3f56348](https://github.com/visulima/visulima/commit/3f56348e1998b50e3b8496ce5f97a9a34932946d)), closes [vite-task#396](https://github.com/visulima/vite-task/issues/396) [vite-task#396](https://github.com/visulima/vite-task/issues/396) [vite-task#396](https://github.com/visulima/vite-task/issues/396) [vite-task#396](https://github.com/visulima/vite-task/issues/396) [vite-task#396](https://github.com/visulima/vite-task/issues/396)
* **task-runner:** close remaining audit findings ([28c5870](https://github.com/visulima/visulima/commit/28c587008a7f4be73c0e4695f443eccf1a9ed264)), closes [vite-task#358](https://github.com/visulima/vite-task/issues/358)
* **task-runner:** harden native runner and respect caller FORCE_COLOR ([d1e7231](https://github.com/visulima/visulima/commit/d1e72317428501c1221ffb3c1a4a0e0c5bcfafc0))
* **task-runner:** harden scheduler, cache, and remote backends ([ce94b16](https://github.com/visulima/visulima/commit/ce94b16c7600967e2d47b1e18975a904f8aef779))
* **task-runner:** tolerate dev-only dependency cycles ([#664](https://github.com/visulima/visulima/issues/664)) ([9ad384e](https://github.com/visulima/visulima/commit/9ad384e34927b40823ae104d6b05a581dcd05705)), closes [#411](https://github.com/visulima/visulima/issues/411)

### Miscellaneous Chores

* cs fixes ([#659](https://github.com/visulima/visulima/issues/659)) ([61f8912](https://github.com/visulima/visulima/commit/61f891274c1de22a36af256fc981b585b9ec6a6a))
* **task-runner:** track fspy_macos Cargo.lock ([7a69ff9](https://github.com/visulima/visulima/commit/7a69ff9bcbc25b2c6d8f249c66b135d1ff9a1577))

### Tests

* **task-runner:** regression guard for vite-task[#411](https://github.com/visulima/visulima/issues/411) (peer-dep cycle) ([#665](https://github.com/visulima/visulima/issues/665)) ([41ed071](https://github.com/visulima/visulima/commit/41ed0710d103647137f0448d999f355451f80df4))

## @visulima/task-runner [1.0.0-alpha.17](https://github.com/visulima/visulima/compare/@visulima/task-runner@1.0.0-alpha.16...@visulima/task-runner@1.0.0-alpha.17) (2026-05-29)

### Bug Fixes

* **task-runner:** flush partial output lines on idle, not at EOF ([5912661](https://github.com/visulima/visulima/commit/59126614ab5e07d3085a4194a360bd72437eceea))

## @visulima/task-runner [1.0.0-alpha.16](https://github.com/visulima/visulima/compare/@visulima/task-runner@1.0.0-alpha.15...@visulima/task-runner@1.0.0-alpha.16) (2026-05-27)

### Bug Fixes

* **storage-client:** percent-encode user fields in defaultFingerprint ([7c78a0f](https://github.com/visulima/visulima/commit/7c78a0f9512e2a673b941d80839e9f1e86b7b5d0))
* **task-runner:** resolve workspace .bin binaries in spawned tasks ([69bd30c](https://github.com/visulima/visulima/commit/69bd30c95fb1e70aba1f7c5b4d3d17b8f0465c11))
* **vis:** enhance PATH inside ephemeral service bootstrap config ([30c6364](https://github.com/visulima/visulima/commit/30c6364cceff0d3c48fe5e7e4a996b77a1ed224c))

### Miscellaneous Chores

* **ci-stability:** green CI across vis, native, lint, tests, attw ([#651](https://github.com/visulima/visulima/issues/651)) ([d4eb684](https://github.com/visulima/visulima/commit/d4eb684b5f75c818c9251048c605a0ed54a268e3))
* **repo:** apply eslint --fix and prettier --fix across packages ([#650](https://github.com/visulima/visulima/issues/650)) ([2e26a84](https://github.com/visulima/visulima/commit/2e26a84774f218f21345e9a8ecd68236b6542743)), closes [#620](https://github.com/visulima/visulima/issues/620)
* **repo:** sort package.json keys across all packages ([e1fd9ab](https://github.com/visulima/visulima/commit/e1fd9ab467ef96a98c777da1572ff6a50fcf7e71))
* sorted package.json ([b47c545](https://github.com/visulima/visulima/commit/b47c545591600fdab17d5cd3a3fbc68b61e199da))

### Continuous Integration

* pin macos to 15, fix task-runner indent + backbuffer flake ([61cbf4f](https://github.com/visulima/visulima/commit/61cbf4fb09be40c567a4e0d2d4349ad24ea91afb))


### Dependencies

* **@visulima/path:** upgraded to 3.0.0-alpha.11

## @visulima/task-runner [1.0.0-alpha.15](https://github.com/visulima/visulima/compare/@visulima/task-runner@1.0.0-alpha.14...@visulima/task-runner@1.0.0-alpha.15) (2026-05-19)

### Features

* **task-runner:** auto-capture outputs for compound build scripts ([e084434](https://github.com/visulima/visulima/commit/e0844344cf184177999a82b708299f08fbfd31ec))
* **task-runner:** per-target hashMode "trace" opt-in ([#643](https://github.com/visulima/visulima/issues/643)) ([32353ff](https://github.com/visulima/visulima/commit/32353ff7a760ae9486e23cc4042fab46a2f2cc11))
* **vis:** attested keyless-signed remote cache (Sigstore) ([4732610](https://github.com/visulima/visulima/commit/47326103a668ab99fcfc4e21f2c9efeaa5892944))

## @visulima/task-runner [1.0.0-alpha.14](https://github.com/visulima/visulima/compare/@visulima/task-runner@1.0.0-alpha.13...@visulima/task-runner@1.0.0-alpha.14) (2026-05-14)

### Bug Fixes

* **release:** patch NAPI version-check string and ship fresh loader on release ([0676e33](https://github.com/visulima/visulima/commit/0676e336f453c9ae38c9f3a5fbbb675f9bff7ea0))

### Miscellaneous Chores

* **tooling:** apply prettier and eslint formatting sweep ([c2c641d](https://github.com/visulima/visulima/commit/c2c641d40242e99030cb990fa01039db5e267667))

### Tests

* fixed count ([6fdd45e](https://github.com/visulima/visulima/commit/6fdd45e3855b619d09d3f33ec7c4277e59ef84da))

## @visulima/task-runner [1.0.0-alpha.13](https://github.com/visulima/visulima/compare/@visulima/task-runner@1.0.0-alpha.12...@visulima/task-runner@1.0.0-alpha.13) (2026-05-11)

### Features

* **task-runner:** add resolveTurboEnvCompat helper ([a8e73ef](https://github.com/visulima/visulima/commit/a8e73ef324dd8d1bc1f1f471f59f9292f9f01745))
* **task-runner:** surface retryAttempts on TaskResult and TaskSummary ([f74e278](https://github.com/visulima/visulima/commit/f74e278fc98052398d46a064ad11e1c9956c9cfd))

## @visulima/task-runner [1.0.0-alpha.12](https://github.com/visulima/visulima/compare/@visulima/task-runner@1.0.0-alpha.11...@visulima/task-runner@1.0.0-alpha.12) (2026-05-10)

### Features

* **task-runner:** add onRetry + onFingerprint hooks ([7e9dadf](https://github.com/visulima/visulima/commit/7e9dadfbe7101fd9b2878eb881d16c3ff5d766ac))

## @visulima/task-runner [1.0.0-alpha.11](https://github.com/visulima/visulima/compare/@visulima/task-runner@1.0.0-alpha.10...@visulima/task-runner@1.0.0-alpha.11) (2026-05-10)

### Features

* add service and tool projectType variants ([61858ad](https://github.com/visulima/visulima/commit/61858ad4c044b5f30318f282615c83f716667053)), closes [#21](https://github.com/visulima/visulima/issues/21)
* **task-runner:** allow embedders to override the data directory ([904875a](https://github.com/visulima/visulima/commit/904875a15751c57ebafa9c137fd11c2ade1a4b6a))
* **task-runner:** surface native child pids for sigint cleanup ([3790bbd](https://github.com/visulima/visulima/commit/3790bbd5f88485f6c67c28548faf7a2a3791216c))

### Miscellaneous Chores

* **task-runner:** bump protobufjs to 8.0.3 ([cfbd5e7](https://github.com/visulima/visulima/commit/cfbd5e783e8773db790223f7dd8baea56685c1ca))

## @visulima/task-runner [1.0.0-alpha.10](https://github.com/visulima/visulima/compare/@visulima/task-runner@1.0.0-alpha.9...@visulima/task-runner@1.0.0-alpha.10) (2026-05-06)

### Features

* **task-runner:** add per-target maxConcurrent and workspace concurrencyGroups ([985d5d1](https://github.com/visulima/visulima/commit/985d5d1d3a594f3b42cfa3f7735bc1bb8055563e))

### Miscellaneous Chores

* **task-runner:** clear lint warnings ([05fa2b6](https://github.com/visulima/visulima/commit/05fa2b6fa259607933fc709dc871b5ef52294721))
* **task-runner:** fix lint errors ([0f5a6d0](https://github.com/visulima/visulima/commit/0f5a6d00bd321b98f9b4289923e151c59a5b7e58))
* **task-runner:** fix lint errors in test files ([5e7dc4f](https://github.com/visulima/visulima/commit/5e7dc4fcee277691034666a252d97503aa7be0a4))
* **task-runner:** housekeeping cleanup ([e837f11](https://github.com/visulima/visulima/commit/e837f1166b43bcfbccfdffe693248db498c0fe1d))

### Continuous Integration

* integrate codspeed for benchmark tracking ([e758f3d](https://github.com/visulima/visulima/commit/e758f3da491cc00d3f8bbf10d7ba3fdf8deb5325))

## @visulima/task-runner [1.0.0-alpha.9](https://github.com/visulima/visulima/compare/@visulima/task-runner@1.0.0-alpha.8...@visulima/task-runner@1.0.0-alpha.9) (2026-05-04)

### Features

* **task-runner,vis:** cache restoration fidelity ([a15cb22](https://github.com/visulima/visulima/commit/a15cb22bde832cfe76ee017722b8b9f9102dac8f))
* **task-runner:** add REAPI gRPC backend, cacheMode, and cache doctor ([03e6da9](https://github.com/visulima/visulima/commit/03e6da97beb84f6adc4a07a1c7ca4acf28be3b33))
* **task-runner:** add URI-based input format ([050b583](https://github.com/visulima/visulima/commit/050b5838c15590a3ccba0ca99ad585cbabc36d99))
* **task-runner:** skip-on-warning incrementality ([2c79ab3](https://github.com/visulima/visulima/commit/2c79ab35d0513bf4e60f87d1ac3bc4e99296cb62)), closes [#22](https://github.com/visulima/visulima/issues/22) [rushstack#1402](https://github.com/visulima/rushstack/issues/1402)

### Bug Fixes

* **vis:** preserve probe error on close failure and clamp formatAge ([f1d71d6](https://github.com/visulima/visulima/commit/f1d71d63a5432fc2ed8c09c9a0a87e4e59b83b0b))

### Documentation

* **task-runner:** cover when/always, tokens, REAPI, hooks ([1515cd3](https://github.com/visulima/visulima/commit/1515cd349db41fcfe83ae86ed4d52df8dccbf985))

### Miscellaneous Chores

* catalog refresh + task-runner binding bump to 1.0.0-alpha.8 ([ff4548a](https://github.com/visulima/visulima/commit/ff4548a5678c992048a57e73c310757733c04756))
* **deps:** bump rust crates to current majors ([3a1d9bb](https://github.com/visulima/visulima/commit/3a1d9bb7f6e2c6b2d3862e212ae62707d60815cc))

### Code Refactoring

* **task-runner,vis:** consolidate helpers and tighten branches ([d1290d1](https://github.com/visulima/visulima/commit/d1290d1f614036902c6803d8ff51df100fdd07ab))
* **task-runner,vis:** expose worktree helpers from task-runner ([12468d7](https://github.com/visulima/visulima/commit/12468d76bb03278ec56691ba0c6d9821c9482f94))

### Tests

* **task-runner:** split tests into unit/integration mirroring src layout ([ae78f99](https://github.com/visulima/visulima/commit/ae78f992d24626f3b23de56fa735aced47b1220e))

## @visulima/task-runner [1.0.0-alpha.8](https://github.com/visulima/visulima/compare/@visulima/task-runner@1.0.0-alpha.7...@visulima/task-runner@1.0.0-alpha.8) (2026-04-30)

### Features

* **task-runner:** expose worktree detection napi bindings ([3d67028](https://github.com/visulima/visulima/commit/3d670284090010616956a024a4e5465ee91bbcd4))
* **task-runner:** graceful Ctrl+Break on Windows SIGINT ([ae44b1c](https://github.com/visulima/visulima/commit/ae44b1c855839746092a91430eb49b216d1172ec))
* **task-runner:** tokens, when, and always tasks ([5ae6505](https://github.com/visulima/visulima/commit/5ae65055d97e97d7ad7ff9088996da37d964da3f))

### Bug Fixes

* **vis:** address review findings on watch UX bundle ([edee703](https://github.com/visulima/visulima/commit/edee7038fe23a488791682dd8ce5c469b40a3e8c))

### Miscellaneous Chores

* re-sort workspace package.json files via vis sort-package-json ([f625696](https://github.com/visulima/visulima/commit/f625696cfac974325774b3243e1a83c3d23acbd7))
* **task-runner:** upgrade packem to 2.0.0-alpha.76 ([5f59c41](https://github.com/visulima/visulima/commit/5f59c4140f89019cc3756ac917e1bda7ded0beec))

## @visulima/task-runner [1.0.0-alpha.7](https://github.com/visulima/visulima/compare/@visulima/task-runner@1.0.0-alpha.6...@visulima/task-runner@1.0.0-alpha.7) (2026-04-22)

### Bug Fixes

* **ci:** publish native addons via local semantic-release plugin ([974beb2](https://github.com/visulima/visulima/commit/974beb2d021e7b2afc86b958bd2137be88d2f464))
* Remove JSR configuration generation script and generated jsr.json files ([#616](https://github.com/visulima/visulima/issues/616)) ([533744b](https://github.com/visulima/visulima/commit/533744b103b74896941db5b727173e617a27a63b))

### Miscellaneous Chores

* update the jsr.json ([864ab7e](https://github.com/visulima/visulima/commit/864ab7e71c4b5ae82f64792d1ae8debfea2c539b))


### Dependencies

* **@visulima/humanizer:** upgraded to 3.0.0-alpha.11
* **@visulima/path:** upgraded to 3.0.0-alpha.10

## @visulima/task-runner [1.0.0-alpha.6](https://github.com/visulima/visulima/compare/@visulima/task-runner@1.0.0-alpha.5...@visulima/task-runner@1.0.0-alpha.6) (2026-04-21)

### Features

* **task-runner:** output globs, auto-writes, parallel cache IO ([137f53f](https://github.com/visulima/visulima/commit/137f53f7f5a4d8c16df511c9d145b2c158025a32))
* **task-runner:** vite-task parity + plugin-ready lifecycle hooks ([cfc7360](https://github.com/visulima/visulima/commit/cfc7360abf00524fbfc37b60df27970c325f91e1)), closes [pkg#task](https://github.com/visulima/pkg/issues/task)

### Bug Fixes

* **task-runner:** resolve eslint errors in chrome-trace and task-hasher ([2cf6266](https://github.com/visulima/visulima/commit/2cf6266b8252bc24a6d900f49f97611d4d629ff3))

### Miscellaneous Chores

* **api-platform:** apply pending lint and source updates ([3fb0043](https://github.com/visulima/visulima/commit/3fb0043a4cf35f752ca89a09a077100ae0142da8))
* bump engines.node to ^22.14.0 || >=24.10.0 ([c3d0931](https://github.com/visulima/visulima/commit/c3d0931d1504e4f21ebf50ea680cfa7ce4ba15ce))
* fixed jsr.json ([5d85e51](https://github.com/visulima/visulima/commit/5d85e5179de38e284ec433b14d77c71a1619c8d6))
* **task-runner:** apply formatter and lint fixes ([70b4641](https://github.com/visulima/visulima/commit/70b4641b394897ebfc021425b992db936e320d8a))
* **task-runner:** apply formatter and lint fixes ([aee664f](https://github.com/visulima/visulima/commit/aee664f0a03ed9c1eb8bf7a6a91e62f601a3d5ff))
* **task-runner:** apply pending changes ([9d92517](https://github.com/visulima/visulima/commit/9d92517f1a54bc28a19cb8cbdb937cdc234e152d))
* **task-runner:** apply pending lint and source updates ([c01eb39](https://github.com/visulima/visulima/commit/c01eb393f991d8fc96f8ed87bfc71d90902ee659))
* **task-runner:** enforce curly braces and apply lint fixes ([4fbd8ee](https://github.com/visulima/visulima/commit/4fbd8eefa1b56f428528b495b074d5c266fb6733))

### Code Refactoring

* replace inline import() types with top-level imports ([4569a4c](https://github.com/visulima/visulima/commit/4569a4ca04723da069f985855dcfab292f7347e1))

### Tests

* **task-runner:** remove native binding guard from tests ([90f0dff](https://github.com/visulima/visulima/commit/90f0dffe85f4b83e76905a26d53b917365116b45))
* **task-runner:** skip default excludes for tmpdir-backed tracker tests ([0db0620](https://github.com/visulima/visulima/commit/0db06206173f0799244fafcc578b9fb0be9d2fb6))

## @visulima/task-runner [1.0.0-alpha.5](https://github.com/visulima/visulima/compare/@visulima/task-runner@1.0.0-alpha.4...@visulima/task-runner@1.0.0-alpha.5) (2026-04-15)

### Features

* Add comprehensive workspace configuration and command infrastructure ([#609](https://github.com/visulima/visulima/issues/609)) ([f4347bf](https://github.com/visulima/visulima/commit/f4347bfdcdd1b228cd9d842a927e446aaf23f035))
* **vis:** add cache command for task runner cache ([#607](https://github.com/visulima/visulima/issues/607)) ([6752769](https://github.com/visulima/visulima/commit/67527692562b3dd9c03bb6a67c084ff1e694a560))

### Bug Fixes

* **tooling:** resolve eslint and formatting issues ([399d292](https://github.com/visulima/visulima/commit/399d29282be5b29bb26b4e5b24d45e2a6cdeeca3))


### Dependencies

* **@visulima/humanizer:** upgraded to 3.0.0-alpha.10
* **@visulima/path:** upgraded to 3.0.0-alpha.9

## @visulima/task-runner [1.0.0-alpha.4](https://github.com/visulima/visulima/compare/@visulima/task-runner@1.0.0-alpha.3...@visulima/task-runner@1.0.0-alpha.4) (2026-04-08)

### Features

* Add native Rust bindings for package manager operations ([#596](https://github.com/visulima/visulima/issues/596)) ([2ec22d0](https://github.com/visulima/visulima/commit/2ec22d023eade3fed67fb811696fbd8f7b52569d))
* **task-runner, vis:** project constraints, CI partitioning, affected scopes ([29295e9](https://github.com/visulima/visulima/commit/29295e989ecdfe2019469d1917a6c90a92e17bcf))
* **task-runner:** add concurrent process runner with Rust NAPI bindings ([c4f5d93](https://github.com/visulima/visulima/commit/c4f5d930e81a5eb641ceb3ab925c3b10a885bb6a))
* **vis:** expand devcontainer command with templates, validation, and config properties ([807e730](https://github.com/visulima/visulima/commit/807e730a43f0ea644d016b4f5506706972d2ff41))
* **vis:** group CLI commands into logical categories for help output ([0a4cac8](https://github.com/visulima/visulima/commit/0a4cac859c8edf7aacdacca7b9a03219967d525a))
* **vis:** replace inline TUI with full-screen Nx-style interactive task runner ([1409aad](https://github.com/visulima/visulima/commit/1409aad879c713051bba12298a3feb1d5ba852f2))

### Bug Fixes

* **ci:** make native-binding tests work with and without compiled binary ([9a40fb4](https://github.com/visulima/visulima/commit/9a40fb40d5cba9fcd2e0176eea8b7bf8d9792c7d))
* **task-runner,tui:** guard null native events and increase CI test timeout ([e76a791](https://github.com/visulima/visulima/commit/e76a791d90043537e08be0545f706e35acaa555d))
* **task-runner:** deno.json support, Windows Job Objects, docs, and review fixes ([4fb27f0](https://github.com/visulima/visulima/commit/4fb27f081b4b50b41dbb86b5b1a962b63f7a6df3))
* **task-runner:** fix Windows cross-compilation by upgrading windows-sys to 0.61 ([b56b95e](https://github.com/visulima/visulima/commit/b56b95e2a39ca972398859e6eb87e528f4463d97))
* **task-runner:** resolve eslint errors ([f0a21a6](https://github.com/visulima/visulima/commit/f0a21a689bc9e1d8b091a513e21cb11b77103ba4))
* **task-runner:** use JS fallback for onEvent streaming, fix StaticRender ref ([1a7165c](https://github.com/visulima/visulima/commit/1a7165cd9eb71472895cd08682983fa25703dc93))
* **tsconfig:** add node types and fix implicit any parameter ([1744d82](https://github.com/visulima/visulima/commit/1744d82a07fca03f2e6ff660b918e9b2623acf69))

### Miscellaneous Chores

* added og images ([02d9d1e](https://github.com/visulima/visulima/commit/02d9d1e47be3ce75679ea89e857dc4e4bfe4946b))
* **task-runner:** add tsconfig.eslint.json for type-aware linting ([83e0bf2](https://github.com/visulima/visulima/commit/83e0bf23511a169b801f6edf652a8be7ee968c24))
* **task-runner:** apply prettier formatting ([521afc2](https://github.com/visulima/visulima/commit/521afc22d94a2626c7246062cecfc0627f929ee4))
* **task-runner:** expand inline if-return to block syntax ([0f48a96](https://github.com/visulima/visulima/commit/0f48a96ed11d7339c62f3f147c7b2c8fcc605b03))
* **task-runner:** migrate .prettierrc.cjs to prettier.config.js ([cd1c045](https://github.com/visulima/visulima/commit/cd1c045e133f685a274924034ec70cf374edd5ba))

### Build System

* regenerate NAPI-RS bindings as ESM ([f202caf](https://github.com/visulima/visulima/commit/f202caf3dc383a2ec24815c4935d8d68c29f33d0))
* switch NAPI-RS native builds to ESM output ([3d7cd61](https://github.com/visulima/visulima/commit/3d7cd615ad830392005915735c11771e0247ef3f))
* **task-runner:** move publish-native-addons to shared scripts/ ([73b5482](https://github.com/visulima/visulima/commit/73b5482e1ca0707aa8f191429deffbd7324a632d))


### Dependencies

* **@visulima/humanizer:** upgraded to 3.0.0-alpha.9
* **@visulima/path:** upgraded to 3.0.0-alpha.8

## @visulima/task-runner [1.0.0-alpha.3](https://github.com/visulima/visulima/compare/@visulima/task-runner@1.0.0-alpha.2...@visulima/task-runner@1.0.0-alpha.3) (2026-03-26)

### Features

* **web:** auto-generate packages page from workspace metadata ([623e520](https://github.com/visulima/visulima/commit/623e5207693a7fe720f5f2f179593a3654c880e3))

### Miscellaneous Chores

* **task-runner:** remove redundant extends from .releaserc.json ([8969dfa](https://github.com/visulima/visulima/commit/8969dfaeccf3a36e40ecb9ba659187f81dda4ce1))

### Continuous Integration

* **task-runner:** use escaped newlines in git commit message template ([b3045b6](https://github.com/visulima/visulima/commit/b3045b6c2c5afc641c699932fbf90effe7c31563))


### Dependencies

* **@visulima/humanizer:** upgraded to 3.0.0-alpha.8
* **@visulima/path:** upgraded to 3.0.0-alpha.7

## @visulima/task-runner [1.0.0-alpha.2](https://github.com/visulima/visulima/compare/@visulima/task-runner@1.0.0-alpha.1...@visulima/task-runner@1.0.0-alpha.2) (2026-03-26)

### Bug Fixes

* **task-runner:** publish native binding packages with version lockstep via exec plugin ([12e342f](https://github.com/visulima/visulima/commit/12e342f1656ad0b595eaff627d3407c61c4ea7b6))

### Miscellaneous Chores

* **task-runner:** add project.json for all native binding packages ([eb48812](https://github.com/visulima/visulima/commit/eb48812cb87c0990b9822d9314ccc0081e41d11f))

## @visulima/task-runner 1.0.0-alpha.1 (2026-03-26)

### Features

* Add @visulima/task-runner , vis and find-ai-runner ([#594](https://github.com/visulima/visulima/issues/594)) ([034b5db](https://github.com/visulima/visulima/commit/034b5db8aadcc02e23abe007208c5196859c7755))


### Dependencies

* **@visulima/humanizer:** upgraded to 3.0.0-alpha.7
* **@visulima/path:** upgraded to 3.0.0-alpha.6
