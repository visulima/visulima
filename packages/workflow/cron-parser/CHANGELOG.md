## @visulima/cron-parser [2.0.0](https://github.com/visulima/visulima/compare/@visulima/cron-parser@1.1.0...@visulima/cron-parser@2.0.0) (2026-10-15)

### ⚠ BREAKING CHANGES

* **cron-parser:** CronExpressionParser and its default export are removed;
use parse. CronFileParser is removed; use parseFile and parseFileSync. The
expression option is removed. See docs/migration.mdx.

Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>

* fix(cron-parser): address review findings on the parse rewrite

The helper JSDoc had been left in one stack, so it documented nothing and
parse lost its editor docs. Each block now sits above the function it
documents. The README migration list names the CronExpressionParser
change, the smoke script drops an unused import, and the lint fixes cover
JSDoc tags that repeated their names or described a return that does not
exist.

Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>

* fix(cron-parser): reject partial steps and inherited nickname names

A step token such as 2-3 was read as 2 because parseInt stops at the
first non-digit, so */2-3 parsed without error. The whole token must now
be an integer, or INVALID_STEP is thrown.

Nickname lookup used a plain property read, so names inherited from
Object.prototype (constructor, toString, __proto__) were treated as
nicknames and failed with a TypeError. The lookup now checks own
properties only.

Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>
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

* **cron-parser:** make parse a function ([#974](https://github.com/visulima/visulima/issues/974)) ([87921bc](https://github.com/visulima/visulima/commit/87921bc448760f18660fd27e0cc8d3a191428adf))
* remove deno runtime and tooling support ([#973](https://github.com/visulima/visulima/issues/973)) ([26fada1](https://github.com/visulima/visulima/commit/26fada1ac04731cba9db8f74fe20849c0a15db74))

## @visulima/cron-parser [1.1.0](https://github.com/visulima/visulima/compare/@visulima/cron-parser@1.0.0...@visulima/cron-parser@1.1.0) (2026-10-15)

### Features

* **cron-parser:** add dialect gating, typed errors, fix .d.ts ([#972](https://github.com/visulima/visulima/issues/972)) ([72d2562](https://github.com/visulima/visulima/commit/72d25620752c946136dcf040cd752421c01ef776))

## @visulima/cron-parser 1.0.0 (2026-10-15)

### Features

* **cron-parser:** add cron expression parser ([#970](https://github.com/visulima/visulima/issues/970)) ([1330534](https://github.com/visulima/visulima/commit/1330534e690c3855d345cdb398472952bbb40b0a))
