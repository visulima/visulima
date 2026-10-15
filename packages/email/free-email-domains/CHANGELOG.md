## @visulima/free-email-domains [2.0.0](https://github.com/visulima/visulima/compare/@visulima/free-email-domains@1.0.2...@visulima/free-email-domains@2.0.0) (2026-10-15)

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

## @visulima/free-email-domains [1.0.2](https://github.com/visulima/visulima/compare/@visulima/free-email-domains@1.0.1...@visulima/free-email-domains@1.0.2) (2026-10-14)

### Bug Fixes

* **disposable-email-domains,free-email-domains:** resolve disk loaders lazily ([#962](https://github.com/visulima/visulima/issues/962)) ([0b5b734](https://github.com/visulima/visulima/commit/0b5b734e75877903993dc953df381fb5744835d4)), closes [#966](https://github.com/visulima/visulima/issues/966) [#968](https://github.com/visulima/visulima/issues/968)

### Miscellaneous Chores

* point every Discord link at the anolilab server ([#858](https://github.com/visulima/visulima/issues/858)) ([4002bfc](https://github.com/visulima/visulima/commit/4002bfcd8d3c748d7008efe208e6aaae7bd18753))

## @visulima/free-email-domains [1.0.1](https://github.com/visulima/visulima/compare/%40visulima%2Ffree-email-domains%401.0.0...%40visulima%2Ffree-email-domains%401.0.1) (2026-08-02)


### Dependencies

* **@visulima/tabular:** upgraded to 4.1.0

## @visulima/free-email-domains 1.0.0 (2026-07-03)

### Features

* **email:** emailable-parity verification & enrichment packages ([#718](https://github.com/visulima/visulima/issues/718)) ([e2d8c1e](https://github.com/visulima/visulima/commit/e2d8c1e78e3e0c2548ece87b20d730dab60f677a))

### Miscellaneous Chores

* **release:** @visulima/free-email-domains@1.0.0-alpha.1 [skip ci]\n\n## @visulima/free-email-domains 1.0.0-alpha.1 (2026-06-30) ([c6e28cd](https://github.com/visulima/visulima/commit/c6e28cd97f451b5fa7d048ba842965423d2931fd))


### Dependencies

* **@visulima/tabular:** upgraded to 4.0.0

## @visulima/free-email-domains 1.0.0-alpha.1 (2026-06-30)

### Features

* **email:** emailable-parity verification & enrichment packages ([#718](https://github.com/visulima/visulima/issues/718)) ([e2d8c1e](https://github.com/visulima/visulima/commit/e2d8c1e78e3e0c2548ece87b20d730dab60f677a))
