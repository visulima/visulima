## @visulima/vis [1.0.0-alpha.10](https://github.com/visulima/visulima/compare/@visulima/vis@1.0.0-alpha.9...@visulima/vis@1.0.0-alpha.10) (2026-04-30)

### Features

- **vis:** [@inherit](https://github.com/inherit) array merge sentinel ([c1334ab](https://github.com/visulima/visulima/commit/c1334ab75a84e12aa972aa1aba57ee74edbcc17d))
- **vis:** add manual typosquat list and scoped brand-jacks ([1eaef11](https://github.com/visulima/visulima/commit/1eaef1154bb3ca18f09cebee290a9857c5171339))
- **vis:** auto-recover orphaned runners via doctor --fix ([7c68a6e](https://github.com/visulima/visulima/commit/7c68a6e1fd163fdcfb2f4f663f78b5b81cf4df09))
- **vis:** cache diagnostics, retention, and quiet output style ([9ec307b](https://github.com/visulima/visulima/commit/9ec307b06cec5c3114a6e70abbf1f2346ce61910))
- **vis:** doctor checks for watch/signal runtime ([d7d53a7](https://github.com/visulima/visulima/commit/d7d53a7f520b64e72aa193e0beacf2722a82a6f4))
- **vis:** finish vis-side when:/always:/tokens migration ([3c3c759](https://github.com/visulima/visulima/commit/3c3c75946d716efa5971f6cf1fa9ae8d139d9652))
- **vis:** per-package vis.task.ts overlay ([14f6adf](https://github.com/visulima/visulima/commit/14f6adfc37b7ff552629309bd555d1fd3dd317f9)), closes [package.json#workspaces](https://github.com/visulima/package.json/issues/workspaces)
- **vis:** rewrite doctor with TUI store and live scan progress ([84f4923](https://github.com/visulima/visulima/commit/84f492376ef9129781464b26a50b1954b7e3b206))
- **vis:** secure-by-default install/add and lint cleanup ([28df4c4](https://github.com/visulima/visulima/commit/28df4c40504b7414460c57ef563593cfe14c5eeb))
- **vis:** split ai into nested subcommands, add discovery, unify cache type filter ([51d2b5e](https://github.com/visulima/visulima/commit/51d2b5ee9fdfcee0cbd4d5e5b9f2f1d08f9ef2ea))
- **vis:** support extends in vis.config.ts ([70d7b36](https://github.com/visulima/visulima/commit/70d7b36b362b0a7340e4717bdae12db355bf05e9))
- **vis:** typed errors for vis config loader ([0dce143](https://github.com/visulima/visulima/commit/0dce143247ba695eb7fa46f3b59c709c473bdc57))
- **vis:** watch keybinds and timeout escalation ([3181bb5](https://github.com/visulima/visulima/commit/3181bb50986b4d7e924a2d5b053a9883228ab08f))
- **vis:** worktree-aware shared task cache with --scope flag ([4328542](https://github.com/visulima/visulima/commit/4328542a9abfa16a40fa62cfe9e8d688eb0d9d81))

### Bug Fixes

- **vis:** address review findings on watch UX bundle ([edee703](https://github.com/visulima/visulima/commit/edee7038fe23a488791682dd8ce5c469b40a3e8c))
- **vis:** measure update list viewport for scrollbar ([4451cd3](https://github.com/visulima/visulima/commit/4451cd3726598ad1848c61800410f6d3146ec817))

### Documentation

- **vis:** document doctor command and Phase 2 watch/signal flow ([4e66350](https://github.com/visulima/visulima/commit/4e663505be135666757d9e90bbfd033f66466220)), closes [doctor#runtime](https://github.com/visulima/doctor/issues/runtime)
- **vis:** document layered configuration ([9a0f303](https://github.com/visulima/visulima/commit/9a0f3037f94992887e3551fbcd72f2dc73260305))
- **vis:** spec for layered configuration ([bcd830d](https://github.com/visulima/visulima/commit/bcd830dc9f1ed7e9dfc39f91649f839afe29bd87))

### Miscellaneous Chores

- **vis:** alphabetize VisConfig members in workspace.ts ([b7869a6](https://github.com/visulima/visulima/commit/b7869a650641a55d895dbf135bfec1a94f9f50e7))

### Code Refactoring

- **vis:** expose VisConfig types and move RFC under rfc/ ([3baa115](https://github.com/visulima/visulima/commit/3baa1151b6ec5d611135cc77e1b39911a4592470))
- **vis:** regroup src into folders and reuse visulima primitives ([18250d7](https://github.com/visulima/visulima/commit/18250d7bd39bccfdccc9737e13a8b0e7c28ffca2))

### Tests

- added more tests ([33f3f19](https://github.com/visulima/visulima/commit/33f3f191332ff9590d94ae543f3b7ef0b82de291))
- **vis:** scrub leaked GIT\_\* env vars in worktree fixture tests ([f066775](https://github.com/visulima/visulima/commit/f0667756c16cd3ad4e25541113e481966606fe62))

### Dependencies

- **@visulima/cerebro:** upgraded to 3.0.0-alpha.13
- **@visulima/task-runner:** upgraded to 1.0.0-alpha.8

## @visulima/vis [1.0.0-alpha.9](https://github.com/visulima/visulima/compare/@visulima/vis@1.0.0-alpha.8...@visulima/vis@1.0.0-alpha.9) (2026-04-28)

### Features

- Add toolchain management with version manager detection and delegation ([#617](https://github.com/visulima/visulima/issues/617)) ([548b0e8](https://github.com/visulima/visulima/commit/548b0e8f9d59743be25abb97b5de3fdbeb681bd6))
- **vis:** add aube as default installer with PM fallback ([79a9933](https://github.com/visulima/visulima/commit/79a99333c0e73e69f375b36c56e40b2693dc4c90))
- **vis:** add ignore/sortOrder/unsorted/finalNewline/lineEnding to sort-package-json ([50f68df](https://github.com/visulima/visulima/commit/50f68dfc2bc31c082ef98b3ddcf73d3dee0cc080))
- **vis:** interactive TUI for bare `vis migrate` ([2171441](https://github.com/visulima/visulima/commit/217144190520447ba9fbe66a9a8f0c452469151e))

### Bug Fixes

- fixed spacing ([1544af2](https://github.com/visulima/visulima/commit/1544af21294edaaf5799846e6c6063c86def3d29))
- **vis:** use default colorize import ([2b95ad2](https://github.com/visulima/visulima/commit/2b95ad28207e699161ed201a43f175a630a06c61))

### Miscellaneous Chores

- added missing version key ([036d86e](https://github.com/visulima/visulima/commit/036d86e6cfa078e4f651327f630cec721f1bbc47))
- **vis:** upgrade packem to 2.0.0-alpha.76 ([9753759](https://github.com/visulima/visulima/commit/97537598a23a4f680e332ca2ea73ad64f301252a))

### Code Refactoring

- **vis:** adopt cerebro lazy commands; split each command into folder ([e1efc0f](https://github.com/visulima/visulima/commit/e1efc0fe57e39433c33c50b1ad2c9e971ea596ba))
- **vis:** drop native-binding wrapper; preserve indent in sort-package-json ([efcccb8](https://github.com/visulima/visulima/commit/efcccb8bedac2f7e7e0819b8eb12277e5bf71312))

### Tests

- **vis:** isolate host env in toolchain tests, fix assertion count ([d472635](https://github.com/visulima/visulima/commit/d4726350c3a68d574b08aff88369751f07216137))
- **vis:** scope PATH in ensureToolchain engines-pnpm test ([ced1571](https://github.com/visulima/visulima/commit/ced157139ba8c6140b85a11d6c3655b2412620ac))

### Dependencies

- **@visulima/cerebro:** upgraded to 3.0.0-alpha.12
- **@visulima/tui:** upgraded to 1.0.0-alpha.5

## @visulima/vis [1.0.0-alpha.8](https://github.com/visulima/visulima/compare/@visulima/vis@1.0.0-alpha.7...@visulima/vis@1.0.0-alpha.8) (2026-04-22)

### Features

- **vis:** add --last-commit shortcut for hook run ([a841c8e](https://github.com/visulima/visulima/commit/a841c8ebfaf69d196cdc3115757c65705204d850))
- **vis:** migrate prek hooks to vis ([92fec22](https://github.com/visulima/visulima/commit/92fec22f61d1882eecd78ff139e4632f55ee3e00))
- **vis:** parse prek.toml via @visulima/fs/toml ([4599680](https://github.com/visulima/visulima/commit/459968089e8968f58edea35c5e2d801cdfbd2913))
- **vis:** translate remote prek hooks, file filters, and deps ([2705c8f](https://github.com/visulima/visulima/commit/2705c8f99e287bb93d0865361f376bafa8043736))
- **vis:** vis hook run/list/validate, migrate --dry-run, runner extras ([bce23d9](https://github.com/visulima/visulima/commit/bce23d912790f9fc2eafa7ce4596e66d0a70e97e))

### Bug Fixes

- added missing deps ([de0522f](https://github.com/visulima/visulima/commit/de0522f18286b23489cf6a51007ef3a4e7c5fd76))

### Documentation

- **vis:** document --last-commit and nested hook/migrate/cache commands ([a1f14d7](https://github.com/visulima/visulima/commit/a1f14d7ff5c1bfa2b038501f3c83c458746d3f31))

### Code Refactoring

- **vis:** split hook/migrate/cache into nested cerebro commands ([42c04fc](https://github.com/visulima/visulima/commit/42c04fc90b16b1538eddb77cf00b1d5d20372dba))

### Dependencies

- **@visulima/tui:** upgraded to 1.0.0-alpha.4

## @visulima/vis [1.0.0-alpha.7](https://github.com/visulima/visulima/compare/@visulima/vis@1.0.0-alpha.6...@visulima/vis@1.0.0-alpha.7) (2026-04-22)

### Bug Fixes

- added [@bomb](https://github.com/bomb).sh/tab ([8be4063](https://github.com/visulima/visulima/commit/8be40636caff4e7eb4776869bb71e11cc6c76298))

### Miscellaneous Chores

- added [@bomb](https://github.com/bomb).sh/tab to exclude ([6e3839e](https://github.com/visulima/visulima/commit/6e3839e5973bac479d6b2e0cb2c3d3c59db3d416))

## @visulima/vis [1.0.0-alpha.6](https://github.com/visulima/visulima/compare/@visulima/vis@1.0.0-alpha.5...@visulima/vis@1.0.0-alpha.6) (2026-04-22)

### Features

- Add comprehensive workspace configuration and command infrastructure ([#609](https://github.com/visulima/visulima/issues/609)) ([f4347bf](https://github.com/visulima/visulima/commit/f4347bfdcdd1b228cd9d842a927e446aaf23f035))
- Add CycloneDX 1.6 SBOM generation with `vis sbom` command ([#611](https://github.com/visulima/visulima/issues/611)) ([1e95276](https://github.com/visulima/visulima/commit/1e9527630958722a0f0f7e79d18bb23b5a57e0df))
- Add CycloneDX SBOM schema validation and TypeScript types ([#610](https://github.com/visulima/visulima/issues/610)) ([bd37e64](https://github.com/visulima/visulima/commit/bd37e6454f43116af94b5b6ae59d70d2cbe51d45))
- Migrate pnpm config from .npmrc to pnpm-workspace.yaml for v11 ([#608](https://github.com/visulima/visulima/issues/608)) ([af9321c](https://github.com/visulima/visulima/commit/af9321ccd2bacefbbda95248aea155c76c5d53ad))
- **secret-scanner:** regroup ScanOptions, add weak-passwords preset, polish SARIF ([1ddbfac](https://github.com/visulima/visulima/commit/1ddbfac6781408d750856003b5b5f53408afa5b3))
- **secret-scanner:** rust-native secret scanner with vis integration ([926a583](https://github.com/visulima/visulima/commit/926a5830efca68d9956f053496b0a5efb359eccd))
- **task-runner:** output globs, auto-writes, parallel cache IO ([137f53f](https://github.com/visulima/visulima/commit/137f53f7f5a4d8c16df511c9d145b2c158025a32))
- **vis, staged:** add env-var concurrency + fast-fail SIGKILL ([8fc5ae3](https://github.com/visulima/visulima/commit/8fc5ae3147901560f4b06848187da61d7a98819d))
- **vis, staged:** case-insensitive globs, auto-stage, parseConcurrent extraction ([671fa42](https://github.com/visulima/visulima/commit/671fa424f57cb1a94ef3d95be3d60b8632201675))
- **vis:** add `vis migrate kingfisher` for MongoDB Kingfisher users ([d7d8a5e](https://github.com/visulima/visulima/commit/d7d8a5e43c3d1d588180fcbe37e6789f68fa8d74))
- **vis:** add built-in staged-files workflow ([34c005a](https://github.com/visulima/visulima/commit/34c005a2fef371bda48139a5aba8c8858a1c8a42)), closes [#990](https://github.com/visulima/visulima/issues/990) [#1713](https://github.com/visulima/visulima/issues/1713) [#1722](https://github.com/visulima/visulima/issues/1722) [#33](https://github.com/visulima/visulima/issues/33)
- **vis:** add cache command for task runner cache ([#607](https://github.com/visulima/visulima/issues/607)) ([6752769](https://github.com/visulima/visulima/commit/67527692562b3dd9c03bb6a67c084ff1e694a560))
- **vis:** add info command for registry metadata lookup ([6e9c43d](https://github.com/visulima/visulima/commit/6e9c43d480445ff5b932193c44bbd9556cca3180))
- **vis:** add vis generate scaffolding command ([5e0bea1](https://github.com/visulima/visulima/commit/5e0bea179dd93bac8a5663e9d51a843c8f626c1b))
- **vis:** OTel plugin, --last-details, per-instance hook errors ([79c660f](https://github.com/visulima/visulima/commit/79c660f92e6982248dacd5e2bba0f113df338baf))
- **vis:** plugin API, task metadata, watch ergonomics, and run polish ([065c0dc](https://github.com/visulima/visulima/commit/065c0dc646f7e2769dcab9c01e0db52b401fcf99)), closes [#324](https://github.com/visulima/visulima/issues/324)
- **vis:** update secrets command for new scanner API + docs ([00bb0f0](https://github.com/visulima/visulima/commit/00bb0f057237e0ce88043f2c120d23b84f59d818))

### Bug Fixes

- **ci:** publish native addons via local semantic-release plugin ([974beb2](https://github.com/visulima/visulima/commit/974beb2d021e7b2afc86b958bd2137be88d2f464))
- **tooling:** resolve eslint and formatting issues ([399d292](https://github.com/visulima/visulima/commit/399d29282be5b29bb26b4e5b24d45e2a6cdeeca3))
- **tui:** inline component and hook barrel exports in ink entry ([1cf8dd2](https://github.com/visulima/visulima/commit/1cf8dd25c91a2001268fb9d964d95df649bf7832))
- **vis:** add missing space and drop extra line in update progress UI ([db1bac1](https://github.com/visulima/visulima/commit/db1bac1ecff50eac682a5cb33958cd30e4da2bf6))
- **vis:** filter truncated SBOM hashes that fail CycloneDX 1.6 schema validation ([34c7b22](https://github.com/visulima/visulima/commit/34c7b2268f68eac1095835aa65e21f998c3a63dc))
- **vis:** fixed types ([ff39190](https://github.com/visulima/visulima/commit/ff39190d92644bf592cbb1df81d69c224ede2bff))
- **vis:** harden vis generate edge cases and migrate moon templates ([ed37000](https://github.com/visulima/visulima/commit/ed3700059e34c2fb563890edf49fd6050ddfad37))
- **vis:** recover -- passthrough in generate and create commands ([688e6a9](https://github.com/visulima/visulima/commit/688e6a9b58766b341cc510d048669b753a30345a))
- **vis:** resolve type errors across commands, tui and utils ([187d460](https://github.com/visulima/visulima/commit/187d4607732799ac1711d2097f90666674850c75))

### Documentation

- **vis:** correct vis generate partial detection and lock CLI surface ([45b40a0](https://github.com/visulima/visulima/commit/45b40a072ffd61274309b3dbe63a3413e764cb9d))

### Miscellaneous Chores

- **api-platform:** apply pending lint and source updates ([3fb0043](https://github.com/visulima/visulima/commit/3fb0043a4cf35f752ca89a09a077100ae0142da8))
- bump engines.node to ^22.14.0 || >=24.10.0 ([c3d0931](https://github.com/visulima/visulima/commit/c3d0931d1504e4f21ebf50ea680cfa7ce4ba15ce))
- remove unused deprecated aliases ([#612](https://github.com/visulima/visulima/issues/612)) ([24ee546](https://github.com/visulima/visulima/commit/24ee546bcb2c17b8915622e4878797c00aa1d813))
- **vis:** apply pending lint and source updates ([f1f3a92](https://github.com/visulima/visulima/commit/f1f3a92c952d129cdcedae137de4b0e77ea787b4))
- **vis:** apply prettier and declare staged killSignal option ([23af135](https://github.com/visulima/visulima/commit/23af1357f19c22f3d4a67962ab2e28ac2ce64af1))
- **vis:** bump @eslint-react/eslint-plugin + fix revealed issues ([1c19670](https://github.com/visulima/visulima/commit/1c1967040e627d29857768150a992ff1e77fd3c1))
- **vis:** enforce curly braces and apply lint fixes ([9cf1d21](https://github.com/visulima/visulima/commit/9cf1d21f53bdb09fd93b30c7f9de758f16f8960d))
- **vis:** tighten toolbox, cache, and TUI typings ([a761ad7](https://github.com/visulima/visulima/commit/a761ad76d9200e1751e4ac1c7efd6619d1d1cde0))

### Code Refactoring

- replace inline import() types with top-level imports ([4569a4c](https://github.com/visulima/visulima/commit/4569a4ca04723da069f985855dcfab292f7347e1))
- **vis, staged:** move env-var concurrency fallback to the CLI layer ([31cb567](https://github.com/visulima/visulima/commit/31cb56767158e53f02ce2c5602a0221a774995b0))
- **vis:** read passthrough from toolbox.rawUnknown ([8d73d9c](https://github.com/visulima/visulima/commit/8d73d9c00924e02b98965d4cd89c8672a4fdffb8))
- **vis:** use @visulima/fs helpers, remove compiled artifacts from src ([dc03e7c](https://github.com/visulima/visulima/commit/dc03e7c053e8d7fb747cde38924efce6f489ca7f))

### Tests

- **vis:** add gated remote template integration test ([a626e56](https://github.com/visulima/visulima/commit/a626e5675630db044230400794a02d37ecbc0d31)), closes [visulima/visulima#alpha](https://github.com/visulima/visulima/issues/alpha)
- **vis:** remove native binding guard from tests ([40e8707](https://github.com/visulima/visulima/commit/40e870700930b1284701d0a33a72e589e1d3facd))

### Dependencies

- **@visulima/cerebro:** upgraded to 3.0.0-alpha.11
- **@visulima/secret-scanner:** upgraded to 1.0.0-alpha.1
- **@visulima/tui:** upgraded to 1.0.0-alpha.3

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
