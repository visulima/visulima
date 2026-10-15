## @visulima/workflow [4.0.0](https://github.com/visulima/visulima/compare/@visulima/workflow@3.0.0...@visulima/workflow@4.0.0) (2026-10-15)

### ⚠ BREAKING CHANGES

* Deno is no longer a supported runtime or package manager.
vis targets node/bun runtimes and aube/npm/pnpm/yarn package managers; the
deno-lint/deno-fmt adapters and deno inference targets are removed.

* fix: resolve eslint errors after deno removal

- vis: use a block body for applyIgnoreScripts (arrow-body-style)
- is-ansi-color-supported: drop stale eslint-disable directives and
  replace the raw-release if/else with a ternary (unicorn/prefer-ternary)

* docs(cron-parser): remove remaining deno runtime mentions

These doc/config files arrived with main's dialect-gating commit after this
branch's base, so they still listed Deno as a supported runtime.

* feat!: remove deno runtime and tooling support

Deno is being wound down: Cloudflare is acquiring the Deno team, the runtime
gets one more year of monthly maintenance before development ends, and Deno
Deploy shuts down. Drop Deno as a supported runtime, package manager, and
lint/fmt/inference target across the monorepo.

- vis: remove the deno runtime path, deno-lint/deno-fmt adapters, the
  deno.json inference detector, Deno PM handling (TypeScript + Rust native
  resolver), and the devcontainer deno mount; regenerate the JSON schemas.
- libraries: drop Deno runtime detection from cerebro, ono,
  is-ansi-color-supported, and task-runner command parsing; remove Deno
  wording from package docs and READMEs.
- delete the examples/deno directories (ono, pail, storage) and Deno docs.
- keep JSR publishing (registry usable from Node), license/attribution
  comments, the secret-scanner Deno-token rule, and the historical RFCs.
* Deno is no longer a supported runtime or package manager.
vis targets node/bun runtimes and aube/npm/pnpm/yarn package managers; the
deno-lint/deno-fmt adapters and deno inference targets are removed.

* fix: resolve eslint errors after deno removal

- vis: use a block body for applyIgnoreScripts (arrow-body-style)
- is-ansi-color-supported: drop stale eslint-disable directives and
  replace the raw-release if/else with a ternary (unicorn/prefer-ternary)

* chore(vis): tidy deno-removal leftovers from review

* fix(vis): drop unused logger from x handler, restore bun typing

Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>

* docs: add migration notes for removed deno exports

Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>

* feat(vis): warn on stale adapter ids and deno-only projects

Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>

* refactor(vis): derive runtime ids and reuse bun detection

Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>

* refactor(vis): drop jsr deno option and deno auth reference

Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>

* fix(vis): restore runtime id schema description

Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>

* refactor(vis): remove jsr publishing support

Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>

* feat(bytes): port @std/bytes helpers back in

Carries the Uint8Array helpers from @std/bytes@1.0.6 (MIT, Copyright the Deno authors)
into src/std-bytes.ts and re-exports them from the package entry. Keeps the public API that
the Deno-removal commit dropped, without the jsr: devDependency. Docs and AGENTS notes are
restored to describe the ported functions.

Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>

* docs(bytes): attribute ported @std/bytes source

The license file still listed @jsr/std__bytes as a bundled dependency.
Replace it with the MIT notice for the ported src/std-bytes.ts, placed outside
the generated dependency blocks.

Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>

* fix(cron-parser): keep reviewed docs and 1.1.0 version

The rebase onto the remote branch dropped the reviewed dialect sentence in the README and
the installation table row, and the release commit's 1.1.0 version bump.

### Features

* remove deno runtime and tooling support ([#973](https://github.com/visulima/visulima/issues/973)) ([26fada1](https://github.com/visulima/visulima/commit/26fada1ac04731cba9db8f74fe20849c0a15db74))

### Miscellaneous Chores

* point every Discord link at the anolilab server ([#858](https://github.com/visulima/visulima/issues/858)) ([a1008ad](https://github.com/visulima/visulima/commit/a1008adea7b0be4a59ce545b143ee1cfb8b94ec9))

### Build System

* **deps:** refresh catalog and package manifests ([#832](https://github.com/visulima/visulima/issues/832)) ([842cbd0](https://github.com/visulima/visulima/commit/842cbd00adac37146664f28bec74c91aa12bb464))

## @visulima/workflow [3.0.0](https://github.com/visulima/visulima/compare/%40visulima%2Fworkflow%402.0.0...%40visulima%2Fworkflow%403.0.0) (2026-08-08)

## @visulima/workflow [2.0.0](https://github.com/visulima/visulima/compare/%40visulima%2Fworkflow%401.0.0...%40visulima%2Fworkflow%402.0.0) (2026-08-02)

## @visulima/workflow 1.0.0 (2026-07-03)

### Features

- **workflow:** add @visulima/workflow durable engine package ([5f0036f](https://github.com/visulima/visulima/commit/5f0036f620606a51fe9cdfd246929271f82dabb3))
- **workflow:** add SQL (postgres/mysql) and Redis store adapters ([b9c407d](https://github.com/visulima/visulima/commit/b9c407ddb3f7b6c2ebb58c4ee1c837bb2f1177b4))
- **workflow:** Durable Object store (Cloudflare) ([#710](https://github.com/visulima/visulima/issues/710)) ([2f39968](https://github.com/visulima/visulima/commit/2f399682f40c7b6f6639a49183c150b1d695635f))

### Bug Fixes

- **vis:** stop Windows test hangs; start fallow dead-code cleanup ([e87ca70](https://github.com/visulima/visulima/commit/e87ca708223560775c2bd9ec7a59e1aa5853b5de))
- **workflow:** address review feedback and skip MySQL test on Windows ([e302909](https://github.com/visulima/visulima/commit/e302909e06a9a8fd367cf1ecfe2ec5f7704af959))
- **workflow:** trigger release ([8d6f137](https://github.com/visulima/visulima/commit/8d6f137c1e8c9fcb39ac1fe471a3ca093962ba52))

### Documentation

- **workflow:** add documentation pages ([0edd248](https://github.com/visulima/visulima/commit/0edd248299dde30dc3eb742059321b3555f03c19))

### Styles

- cs fixes ([2a960bb](https://github.com/visulima/visulima/commit/2a960bb1772c9dc70080e2d75d3a0d827034e294))

### Miscellaneous Chores

- add fallow code-intelligence across all packages ([a3b4821](https://github.com/visulima/visulima/commit/a3b48215002e86fed20f2973038b5d4a0aa1ce04))
- **release:** @visulima/workflow@1.0.0-alpha.1 [skip ci]\n\n## @visulima/workflow 1.0.0-alpha.1 (2026-06-23) ([7feb050](https://github.com/visulima/visulima/commit/7feb050ecaddb0f6cab416c61ec740abe245a255))
- **release:** @visulima/workflow@1.0.0-alpha.2 [skip ci]\n\n## @visulima/workflow [1.0.0-alpha.2](https://github.com/visulima/visulima/compare/@visulima/workflow@1.0.0-alpha.1...@visulima/workflow@1.0.0-alpha.2) (2026-06-30) ([ca0eba5](https://github.com/visulima/visulima/commit/ca0eba5cda03203ef0a60ec06e27dc2f45496bc3))

### Continuous Integration

- **fallow:** make fallow:health advisory (--report-only) ([d57148e](https://github.com/visulima/visulima/commit/d57148ea0e3556b4c24d8d336b9fa14987f5dc7d))
- **lint:** raise eslint job timeout and cache slow per-package eslint runs ([#717](https://github.com/visulima/visulima/issues/717)) ([c93878d](https://github.com/visulima/visulima/commit/c93878dbfa1888cc834704448ae6eefd3098597e)), closes [#713](https://github.com/visulima/visulima/issues/713)

## @visulima/workflow [1.0.0-alpha.2](https://github.com/visulima/visulima/compare/@visulima/workflow@1.0.0-alpha.1...@visulima/workflow@1.0.0-alpha.2) (2026-06-30)

### Bug Fixes

- **vis:** stop Windows test hangs; start fallow dead-code cleanup ([e87ca70](https://github.com/visulima/visulima/commit/e87ca708223560775c2bd9ec7a59e1aa5853b5de))

### Styles

- cs fixes ([2a960bb](https://github.com/visulima/visulima/commit/2a960bb1772c9dc70080e2d75d3a0d827034e294))

### Miscellaneous Chores

- add fallow code-intelligence across all packages ([a3b4821](https://github.com/visulima/visulima/commit/a3b48215002e86fed20f2973038b5d4a0aa1ce04))

### Continuous Integration

- **fallow:** make fallow:health advisory (--report-only) ([d57148e](https://github.com/visulima/visulima/commit/d57148ea0e3556b4c24d8d336b9fa14987f5dc7d))
- **lint:** raise eslint job timeout and cache slow per-package eslint runs ([#717](https://github.com/visulima/visulima/issues/717)) ([c93878d](https://github.com/visulima/visulima/commit/c93878dbfa1888cc834704448ae6eefd3098597e)), closes [#713](https://github.com/visulima/visulima/issues/713)

## @visulima/workflow 1.0.0-alpha.1 (2026-06-23)

### Features

- **workflow:** add @visulima/workflow durable engine package ([5f0036f](https://github.com/visulima/visulima/commit/5f0036f620606a51fe9cdfd246929271f82dabb3))
- **workflow:** add SQL (postgres/mysql) and Redis store adapters ([b9c407d](https://github.com/visulima/visulima/commit/b9c407ddb3f7b6c2ebb58c4ee1c837bb2f1177b4))
- **workflow:** Durable Object store (Cloudflare) ([#710](https://github.com/visulima/visulima/issues/710)) ([2f39968](https://github.com/visulima/visulima/commit/2f399682f40c7b6f6639a49183c150b1d695635f))

### Bug Fixes

- **workflow:** address review feedback and skip MySQL test on Windows ([e302909](https://github.com/visulima/visulima/commit/e302909e06a9a8fd367cf1ecfe2ec5f7704af959))
- **workflow:** trigger release ([8d6f137](https://github.com/visulima/visulima/commit/8d6f137c1e8c9fcb39ac1fe471a3ca093962ba52))

### Documentation

- **workflow:** add documentation pages ([0edd248](https://github.com/visulima/visulima/commit/0edd248299dde30dc3eb742059321b3555f03c19))
