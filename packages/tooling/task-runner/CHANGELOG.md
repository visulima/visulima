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
