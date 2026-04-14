## @visulima/vis [1.0.0-alpha.5](https://github.com/visulima/visulima/compare/@visulima/vis@1.0.0-alpha.4...@visulima/vis@1.0.0-alpha.5) (2026-04-09)

### Features

- **vis:** add includeLocked, packageMode, depFields, maturity period to update command ([4cf85e1](https://github.com/visulima/visulima/commit/4cf85e163e392d9dd48c3119c13d3e7a7c9a782e))

### Bug Fixes

- **vis:** use camelCase option names for cerebro CLI flags ([7f187a5](https://github.com/visulima/visulima/commit/7f187a557eb85ced5e2995b4e1a7cebc61484c45))

### Documentation

- **vis:** document new update command options and configuration ([3e72240](https://github.com/visulima/visulima/commit/3e72240dbddebb3abf896a6c941e713ba460a73d))

### Tests

- **vis:** add tests for update command features and fix config tests ([52635db](https://github.com/visulima/visulima/commit/52635db43243e47f781bc8bd3e79d620b72ecfb5))

### Dependencies

- **@visulima/tui:** upgraded to 1.0.0-alpha.2

## @visulima/vis [1.0.0-alpha.4](https://github.com/visulima/visulima/compare/@visulima/vis@1.0.0-alpha.3...@visulima/vis@1.0.0-alpha.4) (2026-04-08)

### Features

- add comprehensive `vis create` scaffolding command ([#602](https://github.com/visulima/visulima/issues/602)) ([e029146](https://github.com/visulima/visulima/commit/e0291469fc8c55e76721333a20753c802820d3de))
- Add native Rust bindings for package manager operations ([#596](https://github.com/visulima/visulima/issues/596)) ([2ec22d0](https://github.com/visulima/visulima/commit/2ec22d023eade3fed67fb811696fbd8f7b52569d))
- Add Socket.dev security intelligence integration ([#599](https://github.com/visulima/visulima/issues/599)) ([c2e2b8a](https://github.com/visulima/visulima/commit/c2e2b8a55d1688c43b1deed82b8d954bc294fa11))
- Add sort-package-json command with native Rust implementation ([#601](https://github.com/visulima/visulima/issues/601)) ([8c5d2c3](https://github.com/visulima/visulima/commit/8c5d2c311d30077384df1b9194a870ac6687a0a4))
- Add typosquat detection for package names ([#603](https://github.com/visulima/visulima/issues/603)) ([16ef5e8](https://github.com/visulima/visulima/commit/16ef5e8acc3670cf1bf883f7a5d9483f331b6133))
- **cerebro:** add addGlobalOption API for CLI-wide options ([ccc1cc0](https://github.com/visulima/visulima/commit/ccc1cc085ed0189be49ab8da7d9dbbc69ba07c72))
- **task-runner, vis:** project constraints, CI partitioning, affected scopes ([29295e9](https://github.com/visulima/visulima/commit/29295e989ecdfe2019469d1917a6c90a92e17bcf))
- **tui:** add TreeView component with keyboard navigation and selection ([f3421e3](https://github.com/visulima/visulima/commit/f3421e36540f8c7a229e0176c683cb94c0d46e0f))
- **vis:** add ignore option to update config and check non-catalog package.json deps ([27e22dd](https://github.com/visulima/visulima/commit/27e22dd7efa30b7d77b8360b9eac9c7245de92a7))
- **vis:** add interactive devcontainer command for creating/editing .devcontainer/devcontainer.json ([9e1665f](https://github.com/visulima/visulima/commit/9e1665fb5a8cee7979a15d6b0a4ba7fa10cfe27c))
- **vis:** add interactive progress bar and replace CI detection with is-in-ci ([255a1b1](https://github.com/visulima/visulima/commit/255a1b100d0dd4bc614094f292b61fc88bc4ad62))
- **vis:** add interactive TUI for update and check commands ([3e96e7e](https://github.com/visulima/visulima/commit/3e96e7e68c444368ed91bc0654bbbfb9b857e7c5))
- **vis:** add navigation and scrollbar to run command task list ([83abf11](https://github.com/visulima/visulima/commit/83abf11670ea924e9df0a966bd9ce1049dcdcb5e))
- **vis:** add terminal links, use cerebro performance helpers ([abc7f89](https://github.com/visulima/visulima/commit/abc7f8937ce43c8446e422f48e5e307b7d0843b0))
- **vis:** add TUI lifecycles with dynamic and static terminal output ([d7eeae1](https://github.com/visulima/visulima/commit/d7eeae1e51c4ffa707f7506ef0ed2f7860f37faf))
- **vis:** expand devcontainer command with templates, validation, and config properties ([807e730](https://github.com/visulima/visulima/commit/807e730a43f0ea644d016b4f5506706972d2ff41))
- **vis:** group CLI commands into logical categories for help output ([0a4cac8](https://github.com/visulima/visulima/commit/0a4cac859c8edf7aacdacca7b9a03219967d525a))
- **vis:** interactive TUI graph viewer, enriched sample workspace ([b821f34](https://github.com/visulima/visulima/commit/b821f34b5b125aef107c7bca1b2aab7d84826651))
- **vis:** redesign TUI with 3-view architecture and NX-style layout ([72da46f](https://github.com/visulima/visulima/commit/72da46fd9dac1227c0abc80709196e7c9b89c017))
- **vis:** replace inline TUI with full-screen Nx-style interactive task runner ([1409aad](https://github.com/visulima/visulima/commit/1409aad879c713051bba12298a3feb1d5ba852f2))
- **vis:** set terminal title to project name on startup ([204622a](https://github.com/visulima/visulima/commit/204622acd943ccad738b33f5e945190e38f5839f))
- **vis:** use concurrent process runner with bounded output buffering ([901c02f](https://github.com/visulima/visulima/commit/901c02fc5a5e131c1d3316c869b321390de901a4))

### Bug Fixes

- resolve failing tests across multiple packages ([2b4b6f0](https://github.com/visulima/visulima/commit/2b4b6f04169b60fdc4cf77b293015436a272c0fb))
- **tsconfig:** add node types and fix implicit any parameter ([1744d82](https://github.com/visulima/visulima/commit/1744d82a07fca03f2e6ff660b918e9b2623acf69))
- **tui:** apply upstream ResizeObserver NaN guard and measurement extraction ([bcd4fd1](https://github.com/visulima/visulima/commit/bcd4fd16e7e0fda7d3de09657dfe76ce46fa370a))
- **tui:** prevent interactive apps from exiting on beforeExit ([449e84c](https://github.com/visulima/visulima/commit/449e84ca739d9dd48728f40ad9514359306f9527))
- **vis,tui:** fix 10 code review issues across TUI components ([3410347](https://github.com/visulima/visulima/commit/34103473cb661cca4187661e59b396eecff1bdec))
- **vis,tui:** validate directory in detectPm and use useLayoutEffect in StaticRender ([de53e9b](https://github.com/visulima/visulima/commit/de53e9b7a944a3778f0d10f1daa1653a1063d9b3))
- **vis:** add explicit type annotation for isolatedDeclarations compatibility ([235d389](https://github.com/visulima/visulima/commit/235d389f8fd3ffa4de2d867eaff781dccd99be20))
- **vis:** add explicit type annotations for isolatedDeclarations compatibility ([5a5f35c](https://github.com/visulima/visulima/commit/5a5f35cd0e92aff38f4c7bd8f31dda5e813ff568))
- **vis:** exclude native binding deps from unused dependency check ([0e8409e](https://github.com/visulima/visulima/commit/0e8409e66676803fb1494fa32df64cdc44969966))
- **vis:** expand StagedConfig type and support Bun object-form workspaces ([af810bc](https://github.com/visulima/visulima/commit/af810bc10a512ec0ed390152e9d59ece681f7360))
- **vis:** fix broken lib-a dep in sample workspace example ([538b7d4](https://github.com/visulima/visulima/commit/538b7d42d0b09313ff87342143f0c7502788092b))
- **vis:** fix failing tests across tui, catalog, and pm-runner modules ([1c29189](https://github.com/visulima/visulima/commit/1c29189ad39061085cc10ca316d1128d52e88811))
- **vis:** fix tips CI test by resetting modules before doMock ([c578ef5](https://github.com/visulima/visulima/commit/c578ef55c1176397448136c8e190992cdf50eb08))
- **vis:** improve devcontainer TUI scrolling, mount suggestions, and review fixes ([6bb03da](https://github.com/visulima/visulima/commit/6bb03dae9f48d9a6461bdfce2ad29da3f16c4ecf))
- **vis:** overhaul TUI with pail InteractiveManager and tabular layout ([ecab9ff](https://github.com/visulima/visulima/commit/ecab9ffc61531b76a58b89202401f1266a5decea))
- **vis:** resolve eslint errors ([b9ee58b](https://github.com/visulima/visulima/commit/b9ee58b179588fa9f3c08178f26dac7cc8e7f6c5))
- **vis:** resolve test failures across multiple modules ([5728d8a](https://github.com/visulima/visulima/commit/5728d8aabae0fb0bb8c64527f61b8663b73148f2))
- **vis:** support Bun object-form workspaces in migration catalog handling ([f44a17f](https://github.com/visulima/visulima/commit/f44a17fe7836febfac4012f744438df70f36af6b))
- **vis:** TUI polish - compact split, responsive layout, double output fix ([e0487ea](https://github.com/visulima/visulima/commit/e0487ea735ecc2734046ccaedc9588a8ca165674)), closes [#1e1e1e](https://github.com/visulima/visulima/issues/1e1e1e)

### Performance Improvements

- **vis:** wrap immutable TUI components with StaticRender ([00e47e9](https://github.com/visulima/visulima/commit/00e47e9f7a6c562570e0b090b7940389451aa1ef))

### Styles

- cs fixs ([0666662](https://github.com/visulima/visulima/commit/066666293c50cde41c796dc38b4b62c48531a3c0))

### Miscellaneous Chores

- added og images ([02d9d1e](https://github.com/visulima/visulima/commit/02d9d1e47be3ce75679ea89e857dc4e4bfe4946b))
- apply linting and formatting fixes across packages ([5d150a5](https://github.com/visulima/visulima/commit/5d150a578f9ce861c791843c683deeb849b774a9))
- update git ignore ([67ac9cf](https://github.com/visulima/visulima/commit/67ac9cfd5969f54fbbbb426b3277472f75b0d520))
- update license.md ([d4fb70e](https://github.com/visulima/visulima/commit/d4fb70ec954722345967ef2c607322402d25f2d9))
- update lock file ([e58ef7c](https://github.com/visulima/visulima/commit/e58ef7c5764fc262e72504f31b4d97def449ee89))
- **vis:** add .gitignore for cache, update changelog and lint fixes ([32d5ae8](https://github.com/visulima/visulima/commit/32d5ae841e79cb436273a73003ca42e610e912a5))
- **vis:** apply auto-fix formatting ([098aa0f](https://github.com/visulima/visulima/commit/098aa0fabf17efee373987006a9ed9bad150f69d))
- **vis:** apply linter auto-fixes ([c6ca2aa](https://github.com/visulima/visulima/commit/c6ca2aa6b648fcb90ef16a24502bbc753cdce712))
- **vis:** apply prettier formatting ([05476bc](https://github.com/visulima/visulima/commit/05476bc9d9c1fd8a34423081159558576bfa6490))
- **vis:** expand braceless if/else statements to block syntax ([85f2595](https://github.com/visulima/visulima/commit/85f259532872b6d478e96a42b8122db6730ef280))
- **vis:** expand inline if-return to block syntax ([69a6c77](https://github.com/visulima/visulima/commit/69a6c7778eb40c33fd945e85a1c11607ae8c62c5))
- **vis:** migrate .prettierrc.cjs to prettier.config.js ([2caed59](https://github.com/visulima/visulima/commit/2caed5911cd31a89f4db68c570a11cc74080820a))

### Code Refactoring

- **vis:** address review findings across optimize and audit ([317dca8](https://github.com/visulima/visulima/commit/317dca88a16f6604c267f9240556d7e15a563a95))
- **vis:** apply Nothing design system to TUI components ([3d0517d](https://github.com/visulima/visulima/commit/3d0517d6225f75ea2e2ccf6170efdfa7911bf0c2))
- **vis:** unify TUI style across run and update commands ([2c85520](https://github.com/visulima/visulima/commit/2c855204a1972596e079a42e12b3a79aba6c657c))
- **vis:** update commands, TUI components, and project scaffolding ([26b40fb](https://github.com/visulima/visulima/commit/26b40fb3521411f750d176ad638c353bd7e36f44))

### Tests

- **vis:** add 50 sample workspace packages for TUI testing ([579d05b](https://github.com/visulima/visulima/commit/579d05b46e2f5bad73297dfab823016663d3041e))

### Build System

- regenerate NAPI-RS bindings as ESM ([f202caf](https://github.com/visulima/visulima/commit/f202caf3dc383a2ec24815c4935d8d68c29f33d0))
- switch NAPI-RS native builds to ESM output ([3d7cd61](https://github.com/visulima/visulima/commit/3d7cd615ad830392005915735c11771e0247ef3f))

### Continuous Integration

- distribute native artifacts for all three packages (task-runner, tui, vis) ([78760ec](https://github.com/visulima/visulima/commit/78760ec805ee4ed38a134ab18fa39b398527cef9))

### Dependencies

- **@visulima/ansi:** upgraded to 4.0.0-alpha.8
- **@visulima/cerebro:** upgraded to 3.0.0-alpha.10
- **@visulima/colorize:** upgraded to 2.0.0-alpha.8
- **@visulima/find-ai-runner:** upgraded to 1.0.0-alpha.3
- **@visulima/find-cache-dir:** upgraded to 3.0.0-alpha.7
- **@visulima/fs:** upgraded to 5.0.0-alpha.7
- **@visulima/humanizer:** upgraded to 3.0.0-alpha.9
- **@visulima/package:** upgraded to 5.0.0-alpha.7
- **@visulima/path:** upgraded to 3.0.0-alpha.8
- **@visulima/task-runner:** upgraded to 1.0.0-alpha.4
- **@visulima/tui:** upgraded to 1.0.0-alpha.1

## @visulima/vis [1.0.0-alpha.3](https://github.com/visulima/visulima/compare/@visulima/vis@1.0.0-alpha.2...@visulima/vis@1.0.0-alpha.3) (2026-03-26)

### Features

- **web:** auto-generate packages page from workspace metadata ([623e520](https://github.com/visulima/visulima/commit/623e5207693a7fe720f5f2f179593a3654c880e3))

### Dependencies

- **@visulima/boxen:** upgraded to 3.0.0-alpha.8
- **@visulima/cerebro:** upgraded to 3.0.0-alpha.9
- **@visulima/find-ai-runner:** upgraded to 1.0.0-alpha.2
- **@visulima/fs:** upgraded to 5.0.0-alpha.6
- **@visulima/package:** upgraded to 5.0.0-alpha.6
- **@visulima/path:** upgraded to 3.0.0-alpha.7
- **@visulima/tabular:** upgraded to 4.0.0-alpha.8
- **@visulima/task-runner:** upgraded to 1.0.0-alpha.3

## @visulima/vis [1.0.0-alpha.2](https://github.com/visulima/visulima/compare/@visulima/vis@1.0.0-alpha.1...@visulima/vis@1.0.0-alpha.2) (2026-03-26)

### Dependencies

- **@visulima/task-runner:** upgraded to 1.0.0-alpha.2

## @visulima/vis 1.0.0-alpha.1 (2026-03-26)

### Features

- Add @visulima/task-runner , vis and find-ai-runner ([#594](https://github.com/visulima/visulima/issues/594)) ([034b5db](https://github.com/visulima/visulima/commit/034b5db8aadcc02e23abe007208c5196859c7755))

### Bug Fixes

- **vis:** fall back to package.json deps when pnpm/bun have no catalogs ([8da8e19](https://github.com/visulima/visulima/commit/8da8e190a40abc22e18e3af740a594edc8cc382d))
- **vis:** isolate loadNpmrc test from host ~/.npmrc ([a7016d6](https://github.com/visulima/visulima/commit/a7016d6ce8770c1d462ebfb9b2dab530fcedac5d))

### Dependencies

- **@visulima/boxen:** upgraded to 3.0.0-alpha.7
- **@visulima/cerebro:** upgraded to 3.0.0-alpha.8
- **@visulima/find-ai-runner:** upgraded to 1.0.0-alpha.1
- **@visulima/fs:** upgraded to 5.0.0-alpha.5
- **@visulima/package:** upgraded to 5.0.0-alpha.5
- **@visulima/path:** upgraded to 3.0.0-alpha.6
- **@visulima/tabular:** upgraded to 4.0.0-alpha.7
- **@visulima/task-runner:** upgraded to 1.0.0-alpha.1
