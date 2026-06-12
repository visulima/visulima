# Visulima Package Audit — DX, Optimizations, Feature Wishlist & Security

> Generated 2026-06-11 on branch `alpha` by a 53-agent parallel audit (one read-only agent per package). Every finding cites concrete files; line numbers reflect the state of the repo at audit time.

**Scope:** all 53 packages under `packages/` and `shared/`, each checked across four dimensions: developer experience, performance/bundle optimizations, feature gaps vs. well-known competitors in each niche, and concrete security issues.

**Totals:** 45 security findings (1 high, 14 medium, 30 low) plus per-package DX/perf/feature findings below.

> **Resolution status (verified against source on 2026-06-12):** 41 fixed ✅ (1 high, 12 medium, 28 low), 4 partial 🟡 (2 medium, 2 low — opt-in mitigation shipped, default still affected), 0 open. All 45 security findings are now resolved or have an opt-in mitigation. The final 14 lows were fixed on 2026-06-12 (some were already fixed in source and gained regression-test coverage); see the Status column in the Security overview below. Correctness bugs are marked inline in the package sections.

## Executive summary

**Fix first (security):** — _all five clusters are now resolved; details retained for history._

1. ✅ **`@visulima/email` — Bcc disclosure (high).** The Bcc header is left inside the raw MIME message sent over SMTP/Cloudflare, so every To/Cc recipient can read the full Bcc list. The companion finding: attachment `contentType`/`cid`/`disposition` values aren't CRLF-sanitized in MIME header construction. _(Both fixed.)_
2. ✅ **Prototype-pollution cluster (medium).** Several packages whose core job is handling untrusted data mishandle `__proto__`/prototype keys: `deep-clone` (loose-mode clone sets the clone's prototype), `error` (`deserializeError` applies an attacker-controlled `__proto__`), `command-line-args` (an option named `toString` throws, `__proto__` silently drops values), `inspector` (`Symbol.toStringTag: "valueOf"` crashes `inspect()` — and propagates into pail's logging path), and `jsdoc-open-api` (YAML merge assigns `__proto__` unguarded). _(All fixed.)_
3. 🟡 **`@visulima/crud` (medium ×2).** Mass assignment (raw request body straight into Prisma create/update) and unrestricted `select`/`include`/`where` from the query string let clients read or filter any column/relation; `?limit` is unbounded. _(Partial: `writableFields`, read-policy allowlists, and `maxPerPage` are now opt-in, but the defaults remain permissive.)_
4. ✅ **`@visulima/api-platform` rate limiter (medium).** Keys on client-spoofable `X-Forwarded-For`/`X-Real-IP`, so the brute-force protection it advertises is trivially bypassed; it also converts downstream errors into 429s because `await next()` sits inside the same try block. _(Both fixed.)_
5. ✅ **Tooling trust boundaries (medium).** `vis` joins repo-derived args unquoted in Windows `shell: true` spawns (command injection on win32); `vis-mcp` lets an LLM-supplied `--fix`/`--force` defeat `readOnlyHint` via argv flag injection; `find-ai-runner` hard-codes every provider to permission-bypass mode; `task-runner`'s remote-cache HMAC verification is opt-in, so a server can strip the signature header; `dev-toolbar`'s `readFile` RPC serves arbitrary project files to any WebSocket client when the dev server runs with `--host`. _(All fixed.)_

**Confirmed correctness bugs reachable from normal use** (full details in the package sections):

- ✅ `connect`: `.get("/path", middleware, handler)` registers only the middleware — every extra handler is silently dropped and the request hangs. _(Fixed.)_
- ⬜ `crud`: reads removed Prisma private internals (`_dmmf`) and pins peers to `^3 || ^4` — unusable with any current Prisma. _(Still open — not part of the verified fix set.)_
- ✅ `path`: `format({dir, name})` without `ext` returns `"…fooundefined"`. _(Fixed.)_
- ✅ `is-ansi-color-supported`: `proc.os.release()` always throws (masked by a catch), so real Windows terminals get no color; tests pass only because they mock a fake `process`. _(Fixed.)_
- ✅ `fs`: `walk`/`walkSync` with `followSymlinks` silently drops every symlink instead of following it. _(Fixed.)_
- ✅ `shared/xxh3`: JS fallback diverges from the native Rust addon for 1–3-byte inputs with a middle byte ≥ 0x80 — breaks the module's parity guarantee. _(Fixed.)_
- ✅ `humanizer`: `parseDuration` mishandles comma decimals after the first value. _(Fixed.)_
- ✅ `prisma-dmmf-transformer`: enum-list and optional-enum fields produce JSON Schema that rejects valid Prisma data. _(Fixed.)_
- ✅ `string`: the global char-width cache ignores width options, so one large call poisons widths for all later calls with different options. _(Fixed.)_
- ✅ `pail`: "warn" vs RFC5424 "warning" mismatch sends warning/critical/alert/emergency to stdout instead of stderr. _(Fixed: every server reporter routes through the shared `isStderrLevel` helper; `json-reporter.server.ts` no longer uses the `["error","warn"]` name.)_

**Cross-cutting themes:**

- **README drift.** The most common DX failure is docs contradicting code: `ansi` (nonexistent `clearScreen` import, CJS example for an ESM-only package), `tsconfig` (all three exported functions misdocumented), `dev-toolbar` ("enabled by default" is actually disabled), `fmt` (specifier table oversells `%o`/`%c`), `api-platform` (empty Features section), `connect` (headline zod feature undocumented).
- **Edge/browser portability.** `bytes` uses `Buffer` unconditionally (throws in browsers), `disposable-email-domains` does a runtime `readFileSync` (dead on Workers/Next middleware), `colorize`'s exports map orders `import` before `browser` so browser bundlers get the Node build.
- **Per-call work that should be cached.** `api-platform` rebuilds the entire swagger spec with sync I/O per request; `redact` re-walks the tree and re-runs NLP once per rule; `boxen` probes terminal size (sync child-process fallback) per render; `progress-bar`'s `fps` option doesn't actually throttle; `vite-overlay` appends duplicate solution finders on every error.
- **Shared infra gaps.** `shared/utils` isn't in the Nx dependency graph, so edits never trigger affected builds for its consumers (`ono`, `error-handler`, `vite-overlay`).

The two tables below give the security overview and the single most valuable improvement per package; full per-package findings (including the feature wishlist) follow, grouped by category.

## Security overview

Status legend: ✅ Fixed · 🟡 Partial (opt-in mitigation; default still affected) · ⬜ Open

| Status | Severity | Package                              | Finding                                                                                                                                                                                                     |
| ------ | -------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ✅     | high     | `@visulima/email`                    | Bcc recipients disclosed to all recipients via Bcc header in raw MIME sent over SMTP/Cloudflare                                                                                                             |
| ✅     | medium   | `@visulima/api-platform`             | Rate limiter keys on client-spoofable x-forwarded-for/x-real-ip headers, allowing trivial bypass                                                                                                            |
| 🟡     | medium   | `@visulima/crud`                     | Mass assignment: raw request body passed straight to Prisma create/update (writableFields opt-in added; default still permissive)                                                                           |
| 🟡     | medium   | `@visulima/crud`                     | Unrestricted select/include/where from query string allows reading/filtering any column or relation (read-policy allowlists opt-in added; default still permissive)                                         |
| ✅     | medium   | `@visulima/deep-clone`               | Own `__proto__` key in loose object clone sets the clone's prototype (klona-style prototype pollution of the cloned value)                                                                                  |
| ✅     | medium   | `@visulima/dev-toolbar`              | readFile RPC exposes arbitrary project-root files to any dev-server WebSocket client (LAN-reachable with --host)                                                                                            |
| ✅     | medium   | `@visulima/email`                    | Attachment contentType/cid/disposition/encoding not CRLF-sanitized in MIME header construction                                                                                                              |
| ✅     | medium   | `@visulima/error`                    | deserializeError assigns attacker-controlled **proto** key, swapping the returned error's prototype (verified: instanceof Error becomes false, injected inherited props appear)                             |
| ✅     | medium   | `@visulima/find-ai-runner`           | All providers hard-coded to permission-bypass mode; prompt injection escalates to autonomous tool execution                                                                                                 |
| ✅     | medium   | `@visulima/inspector`                | Type-dispatch maps inherit from Object.prototype — attacker-controlled Symbol.toStringTag crashes inspect()                                                                                                 |
| ✅     | medium   | `@visulima/ono`                      | Cookie values bypass sensitive-header masking in cURL command and Cookies panel                                                                                                                             |
| ✅     | medium   | `@visulima/redact`                   | ReDoS-prone default regex rules executed against untrusted input (url/creditcard patterns)                                                                                                                  |
| ✅     | medium   | `@visulima/task-runner`              | Remote-cache HMAC verification is opt-in: server can strip X-Artifact-Signature and serve unsigned artifacts unless verifyOnDownload is set                                                                 |
| ✅     | medium   | `@visulima/vis`                      | Windows shell:true spawns join repo-derived args unquoted (command injection on win32)                                                                                                                      |
| ✅     | medium   | `@visulima/vis-mcp`                  | Argv flag injection in describe_template name and lint/fmt files defeats the readOnlyHint contract                                                                                                          |
| ✅     | low      | `@shared/utils`                      | Stack-frame-derived http(s) URLs fetched without restriction in getFileSource (SSRF surface + unbounded cache)                                                                                              |
| ✅     | low      | `@visulima/ansi`                     | Polynomial ReDoS surface in strip() OSC regexes on untrusted terminal output                                                                                                                                |
| ✅     | low      | `@visulima/api-platform`             | Error handlers leak internal error.message to clients on unexposed 5xx errors                                                                                                                               |
| 🟡     | low      | `@visulima/bytes`                    | bufferToUint8Array exposes Node's shared Buffer pool via the returned view's .buffer ({copy:true} opt-in added; default view still aliases the pool)                                                        |
| ✅     | low      | `@visulima/command-line-args`        | Plain-object values/output store mishandles prototype-colliding option names (toString throws false AlreadySetError; **proto** definition silently drops values)                                            |
| ✅     | low      | `@visulima/connect`                  | Default Node 404 handler reflects raw request.url into the response body without escaping or an explicit Content-Type                                                                                       |
| ✅     | low      | `@visulima/connect`                  | withZod converts arbitrary non-zod errors into exposed 422 messages, leaking internal error text to clients                                                                                                 |
| 🟡     | low      | `@visulima/crud`                     | Unbounded ?limit allows full-table dumps and expensive-query DoS (maxPerPage opt-in added; default still unbounded)                                                                                         |
| ✅     | low      | `@visulima/dev-toolbar`              | inject-source / annotation JSON parsing trusts on-disk and client-supplied data with broad Babel parse surface (DoS on malformed input is swallowed, but unbounded annotation/thread growth is unvalidated) |
| ✅     | low      | `@visulima/disposable-email-domains` | Fail-open detection when dist/domains.json is missing or corrupt — all disposable emails pass with only a one-time console.warn                                                                             |
| ✅     | low      | `@visulima/error`                    | aiFinder cache lives in a fixed, predictable shared tmpdir path (/tmp/visulima-error-cache) writable by whoever creates it first — cache poisoning/symlink-follow on multi-user systems                     |
| ✅     | low      | `@visulima/error`                    | renderError reads and prints arbitrary local file contents based on paths in error.stack — local file disclosure when rendering untrusted/deserialized errors                                               |
| ✅     | low      | `@visulima/error-handler`            | Stack traces exposed by default (showTrace defaults to true, sets expose=true on plain errors)                                                                                                              |
| ✅     | low      | `@visulima/error-handler`            | JSONP responses lack X-Content-Type-Options: nosniff and /\*\*/ prologue hardening                                                                                                                          |
| ✅     | low      | `@visulima/fs`                       | Predictable temp/backup file names in writeFile enable symlink clobbering and concurrent-write corruption                                                                                                   |
| ✅     | low      | `@visulima/html`                     | html(string) returns untrusted input unescaped by default (escaping is opt-in)                                                                                                                              |
| ✅     | low      | `@visulima/jsdoc-open-api`           | objectMerge assigns **proto**/constructor keys from parsed YAML without guard                                                                                                                               |
| ✅     | low      | `@visulima/ono`                      | SSRF vector: server-side fetch() of http(s) stack-frame URLs when rendering code frames                                                                                                                     |
| ✅     | low      | `@visulima/ono`                      | Request bodies (up to 64KB, e.g. login passwords) rendered and embedded unredacted                                                                                                                          |
| ✅     | low      | `@visulima/package`                  | parsePackageJson(Sync) path-vs-content ambiguity allows local file read via existsSync dispatch                                                                                                             |
| ✅     | low      | `@visulima/package`                  | getPackageManagerVersion executes an arbitrary, unvalidated binary name (including relative paths)                                                                                                          |
| ✅     | low      | `@visulima/redact`                   | Infinite loop in processWithRegex when a custom rule pattern matches the empty string                                                                                                                       |
| ✅     | low      | `@visulima/secret-scanner`           | Validation stage can hang indefinitely: unbounded Retry-After pause and untimed response-body read (src/validator/http.ts:100,259-282; src/validator/per-host-limiter.ts:84-98)                             |
| ✅     | low      | `@visulima/secret-scanner`           | With validate:true, secrets are sent to URLs from user-loadable rule configs with no host allowlist — third-party configs become an exfiltration channel (src/validator/http.ts:194-246)                    |
| ✅     | low      | `@visulima/source-map`               | Quadratic backtracking in SOURCEMAP_REGEX block-comment branch (eslint-suppressed) when scanning untrusted file content                                                                                     |
| ✅     | low      | `@visulima/tabular`                  | ANSI escape injection via unsanitized href in OSC 8 hyperlink                                                                                                                                               |
| ✅     | low      | `@visulima/vis`                      | hadolint checksum sidecar fetched from same origin as binary — integrity check is self-attested                                                                                                             |
| ✅     | low      | `@visulima/vis`                      | Shell-history writer does not escape newlines for zsh/bash — repo-controlled task names can plant history entries                                                                                           |
| ✅     | low      | `@visulima/vite-overlay`             | Error-derived solution HTML rendered unsanitized via innerHTML (marked allows raw HTML)                                                                                                                     |
| ✅     | low      | `@visulima/vite-overlay`             | Backtracking-prone regexes (lint-suppressed) run on client-controlled stack strings                                                                                                                         |

## Top finding per package

| Status | Package                              | Most valuable improvement                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------ | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ✅     | `@visulima/api-platform`             | Fix the rate limiter middleware: stop trusting raw x-forwarded-for for the limit key (add a keyGenerator option) and move `await next()` out of the try block so downstream errors are not converted into 429s.                                                                                                                                                                                                                                                                                         |
| ✅     | `@visulima/connect`                  | Fix NodeRouter/EdgeRouter.add silently dropping all handlers after the first when a route pattern is given without a zod schema (e.g. `.get("/p", auth, handler)` registers only `auth`, so the request hangs).                                                                                                                                                                                                                                                                                         |
| ⬜     | `@visulima/crud`                     | Add Prisma 5/6 support: the adapter reads removed private client internals (`_dmmf`/`_getDmmf`) and pins peers to `^3 \|\| ^4`, making the package unusable with any current Prisma release.                                                                                                                                                                                                                                                                                                            |
| ⬜     | `@visulima/health-check`             | Add per-check timeout support (default AbortSignal.timeout for httpCheck plus a wrapper for custom checkers) so a single hung dependency cannot stall the entire /health endpoint and pile up in-flight requests across probe intervals.                                                                                                                                                                                                                                                                |
| ⬜     | `@visulima/jsdoc-open-api`           | Parse each source file once instead of twice — both CLI and webpack plugin call parseFile (readFileSync + comment-parser) twice per file for the two dialects, doubling I/O and parse work across whole codebases.                                                                                                                                                                                                                                                                                      |
| ⬜     | `@visulima/pagination`               | Replace the variadic `...rows` constructor/`push(...rows)` pattern with an array parameter (keeping `paginate` compatible) — it stack-overflows on large result sets and is the package's only real footgun.                                                                                                                                                                                                                                                                                            |
| ✅     | `@visulima/bytes`                    | Replace the unconditional Buffer.from calls in utf8ToUint8Array/toUint8Array with TextEncoder so the package actually works in browsers and edge runtimes instead of throwing ReferenceError when Buffer is absent.                                                                                                                                                                                                                                                                                     |
| ⬜     | `@visulima/content-safety`           | Add an options parameter to checkBannedWords (language filter, custom words, allowlist) — today every caller scans all 19 dictionaries with no way to fix cross-language or Scunthorpe-style false positives, which is the main real-world adoption blocker.                                                                                                                                                                                                                                            |
| ✅     | `@visulima/deep-clone`               | Guard the `__proto__` key in copyObjectLoose (use Object.defineProperty like the strict path), since cloning untrusted JSON is the package's most common use case.                                                                                                                                                                                                                                                                                                                                      |
| ⬜     | `@visulima/html`                     | Add subpath exports (e.g. ./escape, ./sanitize) so consumers of the tiny escapers don't eagerly load the entire sanitize-html/htmlparser2 dependency chain through the single barrel entry.                                                                                                                                                                                                                                                                                                             |
| ✅     | `@visulima/humanizer`                | Fix the parseDuration decimal-separator handling (src/parse-duration.ts:56 replaces only the first occurrence), which silently misparses multi-value comma-decimal inputs like "1,5 stunden 2,5 min" into wrong totals.                                                                                                                                                                                                                                                                                 |
| ⬜     | `@visulima/iso-locale`               | Derive literal union types (Alpha2Code, CurrencyCode, etc.) from the const datasets instead of casting them away with `as unknown as Country[]` — it's the single biggest DX differentiator vs i18n-iso-countries/countries-list and costs nothing at runtime.                                                                                                                                                                                                                                          |
| ✅     | `@visulima/object`                   | Move type-fest from devDependencies to dependencies — the published dist/index.d.ts imports and re-exports from "type-fest", so consumers without it hoisted get TS2307 on every typed call.                                                                                                                                                                                                                                                                                                            |
| ⬜     | `@visulima/redact`                   | Restructure the recursive filter to evaluate all rules in a single tree traversal (and parse each string with compromise once), instead of re-walking the whole tree and re-running NLP once per rule — this is the dominant cost for the package's primary use case (log scrubbing).                                                                                                                                                                                                                   |
| ✅     | `@visulima/string`                   | Fix the global charWidthCache in get-string-truncated-width.ts: it caches per-codePoint widths while ignoring the width config, so the first >10k-char call permanently poisons widths for all later calls with different options (ambiguousIsNarrow, wideWidth, etc.).                                                                                                                                                                                                                                 |
| ✅     | `@visulima/disposable-email-domains` | Make the package portable to edge/bundled runtimes (Cloudflare Workers, Next.js middleware) by replacing the runtime readFileSync of dist/domains.json with a statically importable module or documented JSON subpath, since signup-form validation is the package's prime use case.                                                                                                                                                                                                                    |
| ✅     | `@visulima/email`                    | Strip the Bcc header from the MIME message before sending it through the SMTP DATA / Cloudflare raw paths — currently every To/Cc recipient can read the full Bcc list.                                                                                                                                                                                                                                                                                                                                 |
| ⬜     | `@visulima/dev-toolbar`              | Fix the README's "all apps enabled by default" claim — the plugin actually defaults every app except settings/viteConfig to disabled, so users following the docs see an almost-empty toolbar.                                                                                                                                                                                                                                                                                                          |
| ✅     | `@visulima/error`                    | Guard deserializeError against the **proto**/constructor keys in serialized payloads (deserialize.ts restoreErrorProperties) — it is the package's designated untrusted-data entry point and currently lets a payload replace the returned error's prototype.                                                                                                                                                                                                                                           |
| ✅     | `@visulima/error-handler`            | Ship the youch/whoops-style HTML error inspector the package's keywords promise — htmlErrorHandler currently renders only a status code and reason phrase, with no stack, code frame, or solution hints even in dev mode, despite @visulima/error's renderError and solution finders already powering the CLI handler. _(Implemented in `36c198768`: renderHtmlErrorInspector gated on `expose`; production path leaks nothing beyond the status card; remote source fetch SSRF-gated off by default.)_ |
| ✅     | `@visulima/inspector`                | Switch baseTypesMap/stringTagMap to null-prototype objects (or Map) — today inspect({[Symbol.toStringTag]: "valueOf"}) throws an uncaught TypeError, a trivially triggerable crash that propagates into @visulima/pail's logging path.                                                                                                                                                                                                                                                                  |
| ⬜     | `@visulima/ono`                      | Plain absolute file paths (CJS stack traces) are rejected by the shared getFileSource helper, so every code frame silently degrades to "Unable to load source code" for CommonJS apps — fix the path check to also read non-URL absolute paths.                                                                                                                                                                                                                                                         |
| ✅     | `@visulima/pail`                     | Fix the "warn" vs RFC5424 "warning" level-name mismatch in stream/console routing so warning, critical, alert, and emergency logs go to stderr (and console.warn in browsers) instead of stdout. _(Fixed: all server reporters now route via the shared `isStderrLevel` helper, whose `STDERR_LOG_LEVELS` set includes `warning`/`critical`/`alert`/`emergency`/`trace`; json-reporter.server.ts no longer uses the `["error","warn"]` name array.)_                                                    |
| ✅     | `@visulima/source-map`               | Fix the file: sourceMappingURL path: load-source-map.ts:53-57 lets file:// URLs through the remote-URL guard but then path.resolve()s them into a garbage path like /dir/file:/abs/map, guaranteeing a misleading ENOENT — convert with fileURLToPath instead.                                                                                                                                                                                                                                          |
| ✅     | `@visulima/vite-overlay`             | findSolution mutates the long-lived solutionFinders array, appending 3 built-in finders on every error — unbounded growth that re-runs duplicate finders (including a sync fs walk) and degrades the dev server over a session (src/index.ts:158).                                                                                                                                                                                                                                                      |
| ⬜     | `@visulima/find-cache-dir`           | Make the async findCacheDir actually async (use ensureDir instead of ensureDirSync in the create path) and export the Options type with JSDoc so the public API is fully typed and non-blocking.                                                                                                                                                                                                                                                                                                        |
| ✅     | `@visulima/fs`                       | Fix walk/walkSync followSymlinks: after realpath() the code still type-checks the original symlink dirent (isDirectory()/isFile() both false), so every symlink is silently dropped instead of followed — re-stat the resolved path like the Deno original.                                                                                                                                                                                                                                             |
| ✅     | `@visulima/path`                     | Fix format() concatenating the literal string "undefined" when ext (or name) is missing — format({dir:"/a",name:"foo"}) returns "/a/fooundefined" instead of "/a/foo" (src/path.ts:337).                                                                                                                                                                                                                                                                                                                |
| 🟡     | `@visulima/storage`                  | Fix the dead getBaseUrl call path: Node TUS/REST/multipart handlers pass a headerless `{ url }` object, so with the default `useRelativeLocation: false` the Location header is silently always relative and the forwarded-host logic is unreachable. _(Fixed for base/multipart/REST; TUS-on-Node still relative, now documented.)_                                                                                                                                                                    |
| ⬜     | `@visulima/storage-client`           | Add a `headers` option (or `onBeforeRequest` hook) to the adapters and query-client fetch helpers — today there is no way to send an Authorization header, which blocks every authenticated deployment.                                                                                                                                                                                                                                                                                                 |
| ✅     | `@visulima/ansi`                     | Fix the README's broken contract (nonexistent `clearScreen` import and a CommonJS `require()` example for an ESM-only package) and add the missing `./progress` subpath export so the public surface matches the docs.                                                                                                                                                                                                                                                                                  |
| ✅     | `@visulima/boxen`                    | Add a `columns`/terminal-size override option (and cache the lookup) so boxen() stops doing a per-render synchronous terminal-size probe — which falls back to a sync child-process spawn in non-TTY/CI contexts — and becomes deterministic in tests. _(Implemented in `023a9c7ac`: the `terminalColumns`/`terminalRows` overrides already existed; added a module-level probe memo + exported `clearTerminalSizeCache()` so repeated renders reuse one probe.)_                                       |
| ✅     | `@visulima/cerebro`                  | Remove or raise the MAX_ARGS=100 / 10k-char argv caps in src/util/security.ts (applied to every run via cli.ts #getArgv) — any shell-glob invocation with >100 files makes the whole CLI throw "Too many arguments".                                                                                                                                                                                                                                                                                    |
| ✅     | `@visulima/colorize`                 | Reorder the root `exports` map so the `browser` condition precedes `import`/`require` — as published, browser-targeting ESM bundlers resolve the Node server build and the browser entry is dead code.                                                                                                                                                                                                                                                                                                  |
| ✅     | `@visulima/command-line-args`        | Use null-prototype objects for the values/output accumulators in src/resolve-args.ts and replace the `values[optionName] !== undefined` duplicate check — this fixes a confirmed bug where an option named `toString` throws AlreadySetError on first use and a `__proto__` definition silently loses all its values.                                                                                                                                                                                   |
| ⬜     | `@visulima/fmt`                      | Align the README specifier table with reality: %o/%O are plain JSON.stringify (no inspect-like or non-enumerable output) and %c color-disable is only a `globalThis.window` check, not actual color detection.                                                                                                                                                                                                                                                                                          |
| ⬜     | `@visulima/interactive-manager`      | Fix the erase bookkeeping in InteractiveManager.update(): wordWrap returns a single string with embedded newlines, so #lastLength counts logical rows, not visual lines — any row wider than the terminal leaves stale lines on the next redraw.                                                                                                                                                                                                                                                        |
| ✅     | `@visulima/is-ansi-color-supported`  | Fix `proc.os.release()` in src/is-color-supported.server.ts:136 — Node's `process` has no `os` property, so the call always throws, the catch swallows it, and real Windows terminals (cmd/PowerShell/Windows Terminal with no TERM/COLORTERM set) end up at level 0 (no color); tests pass only because they mock a fake process containing `os`.                                                                                                                                                      |
| ✅     | `@visulima/progress-bar`             | Implement the advertised `fps` option as an actual render throttle — today every update() rebuilds the frame and writes to the terminal, which is both a misleading API and the package's main performance issue (quadratic in multi-bar mode). _(Implemented in `9dc16bf5b`: multi-bar renderAll() is fps-gated via a lastRenderTime check; structural/completion/stop renders force a frame, and stop() always flushes the final frame.)_                                                             |
| ⬜     | `@visulima/spinner`                  | Make Spinner actually work standalone as its JSDoc promises — without an InteractiveManager, start() renders nothing while an un-unref'd setInterval silently keeps the process alive.                                                                                                                                                                                                                                                                                                                  |
| ✅     | `@visulima/tabular`                  | Replace the "**EMPTY**" string sentinel for empty cells with a Symbol or internal flag so user content that legitimately equals "**EMPTY**" is not silently dropped from the layout.                                                                                                                                                                                                                                                                                                                    |
| ✅     | `@visulima/tui`                      | Move the storage.write call in usePersistentState out of the setState updater (it performs sync full-file read-modify-write inside an updater that React may invoke twice or during render in the concurrent mode the package itself advertises).                                                                                                                                                                                                                                                       |
| ⬜     | `@visulima/find-ai-runner`           | Add an async, parallel detection API with opt-in version probing — detectAllProviders() currently spawns up to ~33 subprocesses synchronously and sequentially (which/where per command plus a cold-start `<cli> --version` per hit), making `list` and any detection-on-startup path needlessly slow.                                                                                                                                                                                                  |
| ✅     | `@visulima/package`                  | Unify bun lockfile support: `findPackageManager`/`findLockFile` only know legacy `bun.lockb` (src/package-manager.ts:10) while `parseLockFile` only knows modern `bun.lock` (src/lockfile.ts:800), so each half of the package fails on the other half's bun projects. _(Implemented in `71d777466`: both `bun.lock` and `bun.lockb` are now in LOCKFILE_CANDIDATES / inferLockFileType and the package-manager lockfile-name list; `bun.lockb` is documented as binary/unparseable.)_                  |
| ✅     | `@visulima/prisma-dmmf-transformer`  | Fix enum-list and optional-enum field output — both currently produce JSON Schema that rejects valid Prisma data (enum applied at array level with no items; null missing from enum list).                                                                                                                                                                                                                                                                                                              |
| ✅     | `@visulima/secret-scanner`           | Add git history / commit-range scanning (gitleaks `git` mode parity) — the flagship capability users migrating from gitleaks expect, currently impossible without hand-rolled git plumbing. _(Implemented in `fb78d2015`: `scanGitHistory()` walks rev-list → diff-tree → show via execFile (no shell, flag-injection guarded, git-control env scrubbed) and annotates each finding with its commit; wired into the CLI as `vis secrets --history` in `b8a33ced9`.)_                                    |
| ✅     | `@visulima/task-runner`              | Default `verifyOnDownload` to true whenever a signing secret is configured in HttpRemoteCache — today a compromised/MITM'd cache server can bypass artifact signing entirely by omitting the signature header, poisoning builds.                                                                                                                                                                                                                                                                        |
| ⬜     | `@visulima/task-runner-client`       | Resolve relative paths to absolute at emit time (and expose an isManaged() predicate + the HINTS_ENV constant), because the runner currently resolves hint paths against the child's initial cwd, silently mis-resolving hints from tools that call process.chdir().                                                                                                                                                                                                                                    |
| ⬜     | `@visulima/tsconfig`                 | Fix the stale README API section (wrong package name in imports, sync API shown as awaited, invalid tscCompatible value, undocumented typescriptVersion/cache/configFileName options) — it is the first thing every consumer hits and currently misleads on all three exported functions.                                                                                                                                                                                                               |
| ✅     | `@visulima/vis`                      | Stop passing `shell: true` to Windows spawns that carry repo-derived arguments (spawn-tee.ts:67, hadolint/index.ts:248) — quote/escape or drop the shell for non-shim binaries, since this is the one place vis's otherwise strong secure-by-default posture (checksum-verified downloads, --ignore-scripts plumbing) can be bypassed by a hostile repo on Windows.                                                                                                                                     |
| ✅     | `@visulima/vis-mcp`                  | Extend the leading-dash/positional-argument validation (already applied to taskId/runId in src/validation.ts) to describe_template's name and lint/fmt's files entries, since an LLM-supplied "--fix" or "--force" silently turns read-only tools into write operations.                                                                                                                                                                                                                                |
| ⬜     | `@shared/utils`                      | Wire shared/utils into the dependency graph — consumers import it via ../../../../../shared/utils/... without declaring shared-utils in implicitDependencies, so edits here never trigger affected builds/tests for ono, error-handler, or vite-overlay.                                                                                                                                                                                                                                                |
| ✅     | `@shared/xxh3`                       | Fix the int32 overflow in len1to3_128b (`readUInt8(len >> 1) << 24` at xxh3.ts:204) — verified against the native Rust addon, JS hashes diverge for 1-3 byte inputs whose middle byte is >= 0x80, breaking the module's core native/JS parity guarantee — and add reference test vectors so this class of bug can't recur.                                                                                                                                                                              |

---

# API

## @visulima/api-platform — `packages/api/api-platform`

> Umbrella API toolkit (connect router re-export, content-negotiating serializers, RFC7807/JSON:API error handlers, swagger handler, Next.js swagger/redoc pages, route-listing CLI) with broad test coverage and solid build hygiene, but a skeletal README, stale swagger-ui peer ranges, and a spoofable-IP rate limiter that also swallows downstream errors.

#### DX improvements

- **README documents almost none of the public API.** `packages/api/api-platform/README.md:37` has an empty `## Features` heading, and there are no usage sections for `swaggerHandler`, `serializersMiddleware`, `rateLimiterMiddleware`, `corsMiddleware`, the RFC7807/JSON:API error handling, or the `dateIn`/`dateOut` zod helpers — only the CLI and a single `createNodeRouter` snippet. The `docs/` mdx exists but npm users only see the README.
- **Stale swagger-ui peer ranges.** `package.json:278-279` pins peers `swagger-ui-dist`/`swagger-ui-react` at `^4.19.1` while devDeps use `^5.32.6` and the package was migrated to swagger-ui v5 — every consumer on v5 gets unmet-peer warnings. Bump peers to `^5`.
- **Error-handler building blocks are not exported.** `src/connect/handler.ts:6-8` consumes `problem-error-handler`/`jsonapi-error-handler` and the `ErrorHandler`/`ErrorHandlers` types, but `src/index-server.ts` exports none of them, so users cannot reuse the RFC7807 handler standalone or write a typed custom handler for `createNodeRouter`'s `errorHandlers` option.
- ✅ **[FIXED]** **`rateLimiterMiddleware` converts any downstream error into a 429.** `src/connect/middleware/rate-limiter-middleware.ts:37-54` wraps `await next()` inside the same `try` as `rateLimiter.consume()`, so a thrown `NotFound` or a genuine bug in a later handler surfaces as "Too Many Requests". Move `next()` after the try/catch.
- ✅ **[FIXED]** **Dead canonical-header exceptions.** `src/connect/middleware/http-header-normalizer.ts:23-25` keys `"sec-webSocket-key"`, `"sec-webSocket-protocol"`, `"sec-webSocket-version"` contain a capital `S`, but lookup happens on `key.toLowerCase()` (line 37-44), so these entries never match and canonical mode emits the wrong `Sec-Websocket-Key` casing.

#### Optimizations

- **`swaggerHandler` rebuilds the whole spec on every request with sync I/O.** `src/swagger/api/swagger-handler.ts:32-72` does `existsSync` + `readFileSync` + `JSON.parse` + `extendSwaggerSpec` + `modelsToOpenApi` + repeated `merge` per request inside the returned handler. The spec is static per process — assemble once (or memoize on file mtime) at factory time and serve the cached string with an ETag.
- **`schema-dts` is a runtime dependency that is never imported.** No file in `src/` references it (it is even suppressed in the unused-dep check at `packem.config.ts:27`), and it is a types-only package anyway — drop it from `dependencies` (`package.json:187`) to cut install weight.

#### Feature gaps

- **No Next.js App Router support.** All Next integrations target the pages router: `NextApiResponse` typings, `src/framework/next/routes/pages/{swagger,redoc}/index.tsx`, and `getStaticProps`-based spec loading. Users on Next 13+ `app/` directories (the default since 2023) cannot mount the swagger/redoc pages or the API route; competitors like `next-swagger-doc` and Hono's `@hono/zod-openapi` ship fetch-API `Request`/`Response` route handlers. User story: "drop `export const GET = swaggerRouteHandler()` into `app/api/docs/route.ts`".
- **Rate limiter lacks a key extractor and standards-track headers.** `src/connect/middleware/rate-limiter-middleware.ts:8-12` hardcodes IP derivation and lines 40-45 emit only legacy `X-RateLimit-*` headers. express-rate-limit offers `keyGenerator` (limit by API key/user id) and `standardHeaders` (`RateLimit-Limit/Remaining/Reset` per the IETF draft); both are natural additions and the keyGenerator also resolves the spoofable-IP issue below.

#### Security

- ✅ **[FIXED]** **Spoofable client headers control the rate-limit key (medium).** `src/connect/middleware/rate-limiter-middleware.ts:8-12` prefers `x-forwarded-for`/`x-real-ip` over `socket.remoteAddress` unconditionally. Any direct client can send a fresh forged `X-Forwarded-For` per request to bypass brute-force protection entirely (the package's advertised purpose — see "brute-force" keywords in `package.json:13-15`), and forged keys grow memory-backed limiter stores without bound. Only the rightmost untrusted hop should be used, and only behind a trusted proxy.
- ✅ **[FIXED]** **Internal error messages leak to clients (low).** `src/error-handler/problem-error-handler.ts:40,51` and `src/error-handler/jsonapi-error-handler.ts:39,53` always serialize `error.message` into `details`/`detail`, even for non-HttpError 500s where `expose` is false — `expose` only gates the stack trace. Uncaught exceptions (SQL errors, file paths) are reflected verbatim to API consumers; http-errors convention is to suppress the message when `expose` is false.

---

## @visulima/connect — `packages/api/connect`

> @visulima/connect is a minimal trouter-style async router/middleware layer for Node, Next.js, and Edge runtimes with a zod validation adapter; the core is small and well-tested (router/node/edge suites ~2200 lines), but it ships two real correctness bugs in handler registration and sub-router mounting, an undocumented headline feature (zod), and an unconditional runtime zod import that taxes every consumer.

#### DX improvements

- ✅ **[FIXED]** **Bug: extra handlers silently dropped in `.METHOD(route, fn1, fn2, ...)`** — in `packages/api/connect/src/node.ts:171-172` (and identically `src/edge.ts:169-170`), the branch `typeof routeOrFunction === "string" && typeof zodOrRouteOrFunction === "function"` sets `resolvedFns = [zodOrRouteOrFunction]` and discards the rest-`fns`. `.get("/p", auth, handler)` registers only `auth`; when `auth` calls `next()` the chain resolves to nothing and the Node response never ends. Same drop in the third branch (`node.ts:178-179`) for `.get(fn1, fn2, fn3)`. Should be `[zodOrRouteOrFunction, ...fns]`. No test covers route + multiple plain handlers.
- ✅ **[FIXED]** **Bug: sub-router mounted on a parameterized base strips the wrong prefix** — `src/router.ts:115-123` slices the runtime pathname by `base.length`, where `base` is the raw pattern string. `router.use("/users/:id", sub)` with `/users/4/posts` slices 10 chars from a 14-char path and yields garbage; the `"fix stripped pathname, not sure why this happens"` comment (router.ts:119) papers over it. Either resolve the matched prefix from the regex match or throw on param bases.
- **The headline zod feature is completely undocumented** — `package.json` description and `README.md:9` advertise "support for zod validation", but the 639-line README never mentions `withZod` or the `.get(route, schema, handler)` overload; `sendJson` and `clone()` are also undocumented. Also broken links: `README.md:41` points to `github.com/visulima/packages/connect/...` (nonexistent repo path) and `README.md:63` links `./examples/`, which doesn't exist in the package.
- **`withZod` replaces the request with the parse output** — `src/adapter/with-zod.ts:17,34` passes `schema.parseAsync(request)`'s result (a stripped plain object, per zod's default key-stripping — even asserted in `__tests__/with-zod.test.ts:25`) to the handler, so the handler loses the real `IncomingMessage` (no `req.pipe`, headers, etc.) unless the schema is loose. This footgun is undocumented, and the validated type is not propagated to the handler signature (`RouteShortcutMethod` in `src/types.d.ts:36-40` keeps handlers untyped).

#### Optimizations

- **zod is loaded at runtime by every consumer** — `src/index.ts:3` re-exports `withZod`, and `src/adapter/with-zod.ts:3` does a value import of `zod` (needed only for `instanceof z.ZodError`). With a single-entry `exports` map (`package.json:42-54`), every bundle — including Edge middleware — pays for zod even when validation is unused, and zod must be installed as a required peer. Duck-typing the error (`error.name === "ZodError"` / `issues` array) or adding `./zod`, `./node`, `./edge` subpath exports would make zod genuinely optional and shrink Edge bundles.
- **`sendJson` pretty-prints every response** — `src/utils/send-json.ts:14` uses `JSON.stringify(jsonBody, undefined, 2)`, inflating payload size and CPU on a hot path for no production benefit; drop the indent (or make it opt-in).
- **Edge `getPathname` allocates a full `URL` per request** — `src/edge.ts:28` falls back to `new URL(request.url)` when `nextUrl` is absent; a string scan past `://` to the next `/`/`?` (mirroring `node.ts:34-38`) avoids the parser on every request.

#### Feature gaps

- **Route params are never URL-decoded** — `src/router.ts:74-105` matches the raw pathname, so `/users/J%C3%BCrgen` yields `params.name === "J%C3%BCrgen"`. Express, find-my-way, and Hono all `decodeURIComponent` captures; consumers will hit this on any non-ASCII or slash-encoded segment.
- **No 405 Method Not Allowed support** — `find` (`src/router.ts:179-217`) only reports match/no-match, so `POST` to a GET-only route is a 404. find-my-way and Hono distinguish "path exists, method doesn't" and can emit 405 + `Allow` header; exposing this from `FindResult` would let `onNoMatch` do the right thing.
- **Validation is zod-only and whole-request-only** — competitors (`@hono/zod-validator`, zod-express-middleware) validate `body`/`query`/`params` separately with typed handler input, and the ecosystem is converging on Standard Schema (valibot/arktype/zod all implement it). Accepting any `~standard` schema in `src/adapter/with-zod.ts` would decouple the router from a single validator major version.

#### Security

- ✅ **[FIXED]** **Low: default 404 reflects `request.url` without escaping or Content-Type** — `src/node.ts:21-24` writes `` `Route ${method} ${url} not found` `` with no `Content-Type` header, leaving the body open to MIME sniffing of attacker-shaped request targets. Browsers percent-encode `<>` in URLs, so practical exploitability is very limited, but Express html-escapes here; setting `text/plain` (as the Edge default at `src/edge.ts:19-20` implicitly does) closes it.
- ✅ **[FIXED]** **Low: internal error messages exposed via 422** — `src/adapter/with-zod.ts:31` wraps any non-zod error in `createHttpError(422, error.message)`; http-errors marks 4xx messages `expose: true`, so an exception thrown inside a schema `transform`/`refine` (DB errors, etc.) leaks its message to the client.

---

## @visulima/crud — `packages/api/crud`

> @visulima/crud auto-generates RESTful CRUD handlers (plus OpenAPI docs) from Prisma models behind an adapter interface; the code is well-tested and cleanly layered, but it is pinned to obsolete Prisma 3/4 internals, its edge handler cannot actually return a response, and it exposes models with no field-level guardrails by default.

#### DX improvements

- **README has an empty `## Features` section and zero query-syntax docs** — `packages/api/crud/README.md:36` renders a bare heading; the package's main surface (`$eq/$cont/$in...` where operators, `select`/`include`/`orderBy`/`limit`/`page`/`cursor`/`distinct` params from `src/query-parser.ts` and `src/types.ts:113`) is undocumented in the README. The usage example also constructs the handler inside the request function (`await nodeHandler(...)` per request), which re-runs `adapter.init()`/DMMF mapping on every call — the README teaches a slow pattern.
- **Framework-agnostic core is not exported, and it secretly depends on Next** — root `src/index.ts` only exports `PrismaAdapter` + swagger helpers; `baseHandler` (the piece you'd need for Express/Fastify/Hono) is unreachable. Worse, `src/base-crud-handler.ts:5` deep-imports `ApiError` from `next/dist/server/api-utils` even though `next` is an optional peer — the "agnostic" core throws on import without Next installed, and dist-internal imports are fragile across Next majors.
- ✅ **[FIXED]** **Edge handler never returns its `Response`** — `src/next/api/edge/index.ts:10-16` builds `Response.json(...)`, but `ExecuteHandler` is `Promise<void>` (`src/types.ts:145`) and `src/base-crud-handler.ts:179` discards the executor's return value, so App Router / edge routes (which must `return` a `Response`) cannot use it. It also reads `request.headers.host` as a plain object property (`base-crud-handler.ts:119`), which a real Fetch `Request` (`Headers` instance) doesn't have; the test (`__tests__/next/api/edge/index.test.ts`) passes a fake plain-object request and never asserts the response.
- ✅ **[FIXED]** **UPDATE returns HTTP 201** — `src/handler/update.ts` responds `status: 201` (Created) for updates; REST convention is 200/204. Easy fix, breaking only for clients that hardcoded 201.
- ✅ **[FIXED]** **Silent date coercion in where filters** — `src/adapter/prisma/utils/parse-where.ts:24-29` converts any ISO-looking string value into a `Date` with no opt-out, so filtering a _string_ column whose values look like dates produces a Prisma validation error.

#### Optimizations

- **Prisma connection pool torn down on every request** — `src/base-crud-handler.ts:117` calls `adapter.connect()` and the `finally` block at `:188` calls `adapter.disconnect()` per request; for `PrismaAdapter` that is `$connect()`/`$disconnect()` (`src/adapter/prisma/index.ts:49-51,73-75`), destroying and re-establishing the connection pool each call. Connect once at handler-factory time instead.
- **`path-to-regexp` matchers recompiled per request** — `src/utils/get-route-type.ts:18-21` builds two `match()` compilers on every request for the same `resourceName`; they're pure and should be cached in the factory closure alongside `modelRoutes`.

#### Feature gaps

- **No Prisma 5/6 support** — peers pin `@prisma/client: ^3.0.0 || ^4.0.0` (`package.json:141`) and `getPrismaClientModels` depends on private internals `_dmmf`/`_getDmmf` (`src/adapter/prisma/index.ts:218-236`) that were removed in Prisma 5, so `init()` throws `"Couldn't get prisma client models"` on any modern client. Use `Prisma.dmmf` from the generated client (as the swagger adapter's DMMF transformer path already suggests) and widen the peer range.
- **No validation or policy hooks** — competitors in this niche (next-crud, @nestjsx/crud, ZenStack) support per-model body schemas (zod/class-validator) and row/field access policies. Here the only knob is route-level `only`/`exclude` (`src/utils/get-accessible-routes.ts`); there is no `onRequest`/`can` middleware, no per-model zod schema for create/update, and no allowlist for filterable/selectable fields. User story: "expose `User` CRUD but never let clients write `role` or read `passwordHash`" is currently impossible without forking the handlers.

#### Security

- 🟡 **[PARTIAL]** **Mass assignment (medium)** — _`writableFields` allowlist is now opt-in, but the default still passes the raw body through._ — `src/handler/create.ts:4` and `src/handler/update.ts:10` pass `request.body` verbatim to `adapter.create/update`, which hands it to Prisma `data:` (`src/adapter/prisma/index.ts:55,204`). Any client can set any column (`role`, `isAdmin`, foreign keys) on exposed models.
- 🟡 **[PARTIAL]** **Unrestricted read surface via query params (medium)** — _read-policy allowlists for `select`/`include`/`where` are now opt-in, but the default `exposeStrategy: "all"` remains permissive._ — `src/query-parser.ts:49-62` parses `select`/`include`/`where` straight from the query string and `PrismaAdapter.parseQuery` (`src/adapter/prisma/index.ts:164-200`) forwards them with no field allowlist: `?select=passwordHash` returns hidden columns, `?include=` walks arbitrary relations, and `$cont`/`$starts` filters on secret fields enable blind exfiltration oracles. Default `exposeStrategy: "all"` (`src/base-crud-handler.ts:108`) exposes every model.
- 🟡 **[PARTIAL]** **Unbounded `limit` (low)** — _a `maxPerPage` cap is now configurable, but the default remains unbounded._ — `src/query-parser.ts:65-67` accepts any finite number and `src/handler/list.ts:21` / `parseQuery` map it to `take` with no maximum, so `?limit=100000000` dumps entire tables and ties up the database. Add a configurable `maxPerPage` cap.

---

## @visulima/health-check — `packages/api/health-check`

> @visulima/health-check is a small, well-tested ESM library for registering async service health checks (dns/http/ping/node-env) with framework-agnostic Node HTTP handlers; the code is clean and the test breadth is good, but the README ships broken examples, checks have no timeout/caching story, and it lags competitors like terminus/lightship on liveness-vs-readiness semantics.

#### DX improvements

- ✅ **[FIXED]** **README examples reference exports that don't exist.** `README.md:54-60` imports `nodeEnvironmentCheck`, but `src/index.ts:3` exports it as `nodeEnvCheck`; `README.md:174-177` shows `handleHealthCheck()` (no such export, and called without the required `HealthCheck` instance — the real export is `healthCheckHandler`). Copy-pasting the README fails at import time. `healthReadyHandler` is exported but never documented.
- ✅ **[FIXED]** **Undocumented magic env vars in the handler payload.** `src/handler/healthcheck.ts:21-22` silently reads `process.env.APP_NAME` / `APP_VERSION` and falls back to `"unknown"`. Neither the README nor JSDoc mentions them; they should be handler options (`{ appName, appVersion }`) with env as fallback.
- ✅ **[FIXED]** **`meta?: any` weakens the public contract.** `src/types.ts:13` — make `HealthReportEntry<TMeta = unknown>` generic (or at least `unknown`) so custom checkers get type-safe metadata; `Checker` and `HealthReport` can thread the generic through.
- ✅ **[FIXED]** **Host normalization only strips the protocol.** `src/checks/dns-check.ts:24` and `src/checks/ping-check.ts:15` do `host.replace(/^https?:\/\//, "")`, so `dnsCheck("https://example.com:8080/path")` looks up `example.com:8080/path` and fails with a confusing resolver error. Parse via `new URL()` when the input looks like a URL.

#### Optimizations

- ✅ **[FIXED]** **Drop the `http-status-codes` dependency.** It is imported for exactly three constants (`OK`, `NO_CONTENT`, `SERVICE_UNAVAILABLE`) across `src/handler/healthcheck.ts:3,29` and `src/handler/readyhandler.ts:3,11`. Inlining `200/204/503` removes a runtime dep (~30 kB unpacked) from every consumer for zero readability cost.
- ✅ **[FIXED]** **`deepStrictEqual` to compare two strings.** `src/checks/http-check.ts:1,32` pulls in `node:assert` and a try/catch just to compare `textBody` with the expected string — `textBody !== options.expected.body` is equivalent and cheaper.
- ✅ **[FIXED]** **`httpCheck` has no default timeout.** `src/checks/http-check.ts:22` calls `fetch` with no `AbortSignal`; a stalled upstream keeps the whole `getReport()` `Promise.all` (`src/healthcheck.ts:20`) pending, and since orchestrators probe every few seconds, unfinished fetches accumulate. Default to `AbortSignal.timeout(n)` when the caller passes no signal.

#### Feature gaps

- **No per-check timeout or report caching/min-interval.** Competitors (`@godaddy/terminus`, `@cloudnative/health`) let you cap individual check duration and cache the last report so k8s probes every 2-5 s don't re-fire real HTTP/DNS/ping traffic at dependencies. Here every probe re-runs every checker (`src/healthcheck.ts:17-28`).
- **Liveness and readiness are the same check set.** `src/handler/readyhandler.ts:9` and `HealthCheck.isLive()` (`src/healthcheck.ts:30-34`) both run the full `getReport()`, while `README.md:75-77` explicitly says liveness should "immediately signal LIVE" independent of readiness. Users need tagged checkers (e.g. `addChecker(name, checker, { type: "readiness" | "liveness" })`) or two registries, plus a graceful-shutdown hook (terminus `onSignal`, lightship beacons).
- **No `removeChecker`, and no system built-ins.** The registry (`src/healthcheck.ts:9-11`) is add-only, and the built-in set (dns/http/ping/node-env) lacks the memory-usage, disk-space, and event-loop-lag checks that `@cloudnative/health` and similar packages ship — the README even advertises "Usage of memory, disk, and other server resources can be monitored" (`README.md:48`) but nothing implements it.

#### Security

- No concrete vulnerabilities found. `pingman` spawns `ping` with an argument array (no shell), check hosts are developer-supplied configuration, and the regexes are linear. The unauthenticated handler does expose internals (resolved IPs, `NODE_ENV`, raw error messages) by design — the README already warns to protect the endpoint; a built-in bearer-token option would still be a nice addition to the handler factories.

---

## @visulima/jsdoc-open-api — `packages/api/jsdoc-open-api`

> @visulima/jsdoc-open-api generates OpenAPI/Swagger specs from JSDoc comments (two dialects, CLI + webpack plugin); the architecture is clean and small, but the core comment parsers are untested, every file is parsed twice, and the CLI/webpack error paths hide root causes or kill the host process.

#### DX improvements

- ✅ **[FIXED]** **Config-load failure swallows the real error.** `src/cli/command/generate-command.ts:37-47` catches any `import()` failure and rethrows a flat `No config file found` message — a syntax error or bad export inside `.openapirc.js` is reported as a missing file. Distinguish `ERR_MODULE_NOT_FOUND` from evaluation errors and include the original message/stack.
- ✅ **[FIXED]** **Webpack plugin calls `process.exit(1)` inside the compiler hook.** `src/webpack/swagger-compiler-plugin.ts:101,119` (and `errorHandler` at :21-28) hard-kill the entire webpack/Next.js process on a parse or validation error instead of pushing to `compilation.errors` or invoking `callback(error)`. In `next dev` this nukes the dev server with no webpack-formatted diagnostics. It also logs unconditionally ("Build paused…", :63) with no way to silence.
- ✅ **[FIXED]** **The core parsers have zero direct tests.** `__tests__/` covers `parse-file`, `spec-builder`, `object-merge`, `yaml-loc`, `validate`, `load-definition` — but not `src/jsdoc/comments-to-open-api.ts` (410 lines, ~30 tag kinds) or `src/swagger-jsdoc/comments-to-open-api.ts` / `organize-swagger-object.ts`. The heart of the package is only exercised indirectly; regressions in tag handling would ship silently.
- ✅ **[FIXED]** **Dead and unwired modules.** `src/options.ts` (`DEFAULT_OPTIONS`) is imported nowhere; `src/util/load-definition.ts` is used only by its own test and never exported or wired into the CLI; `src/validate.ts` is not exported from `src/index.ts`, so programmatic users who build a spec via `SpecBuilder` cannot reuse the same validation the CLI runs. Export `validate`, wire or delete the rest.

#### Optimizations

- ✅ **[FIXED]** **Every file is read and comment-parsed twice.** `parseFile` (`src/parse-file.ts:20`) does `readFileSync` + (for code files) a full `comment-parser` pass per call, and both the CLI (`src/cli/command/generate-command.ts:111-117`) and the webpack plugin (`src/webpack/swagger-compiler-plugin.ts:90-96`) call it back-to-back for the jsdoc and swagger-jsdoc dialects. YAML files are even `yaml.parse`d twice. Read + `parseComments` once and feed both tag translators; also consider async reads with bounded concurrency instead of sync reads inside a `forEach`.
- ✅ **[FIXED]** **swagger-jsdoc dialect processes every JSDoc comment in a file.** `src/swagger-jsdoc/comments-to-open-api.ts:75-101` maps all parsed comments — including ordinary code docs — through `tagsToObjects`, `mergeWith`, and a `JSON.parse(JSON.stringify(...))` roundtrip, returning piles of `{ loc, spec: {} }` entries that `SpecBuilder.addData` then iterates. Pre-filter to comments containing an `@openapi`/`@swagger`/`@asyncapi` tag (mirroring the `OPEN_API_REGEX` filter the jsdoc dialect already has at `src/jsdoc/comments-to-open-api.ts:372`).

#### Feature gaps

- **No YAML output.** Output is always `JSON.stringify` to `swagger.json` (`src/cli/command/generate-command.ts:133,143`). swagger-jsdoc's CLI infers format from the output extension; teams that keep `openapi.yaml` in-repo must post-convert. The `yaml` dependency is already present — honor `-o openapi.yaml`.
- **No base-definition file option.** Competitors accept `-d definition.yaml` to seed info/servers/components from a standalone file. `src/util/load-definition.ts` already implements exactly this (YAML/JSON) but is dead code — wire it to a CLI flag and to `swaggerDefinition` in the config.
- **No watch mode or stdout output.** A `--watch` flag (re-generate on change) and `-o -` for piping into other tools are table stakes for spec-generation CLIs used in dev loops; today users must wrap the CLI in nodemon/chokidar.

#### Security

- ✅ **[FIXED]** **Low: `__proto__` keys from scanned YAML flow into merge sinks unguarded.** `src/util/object-merge.ts:9-15` does `(a[key])[subKey] = {...}` with `subKey` taken from user-authored YAML/JSDoc (the `yaml` package surfaces `__proto__` as an own key via defineProperty), and `SpecBuilder.addData` assigns arbitrary top-level keys onto `this` (`src/spec-builder.ts:68-71`). The reachable effect is prototype reassignment/corruption of the built spec object rather than global `Object.prototype` pollution (top-level YAML keys are gated by `ALLOWED_KEYS` in `src/parse-file.ts:30-38`), and inputs are the developer's own sources — but a `__proto__`/`constructor`/`prototype` denylist in `objectMerge` and `addData` is cheap insurance.

---

## @visulima/pagination — `packages/api/pagination`

> @visulima/pagination is a tiny zero-dependency offset/limit Paginator (Adonis-style) with OpenAPI schema helpers; the core is solid and tested, but the README is misleading, the OpenAPI schemas don't match the runtime null semantics, and the spread-based constructor breaks on large row sets.

#### DX improvements

- ✅ **[FIXED]** **README example output is wrong/misleading** — `packages/api/pagination/README.md:55-77` shows `paginate(1, 5, items.length, items)` producing `data: [1,2,3,4,5]`, but `Paginator` never slices rows (`src/paginator.ts:34-47`); passing all 10 items yields all 10 in `data`. Users must pre-slice with `offset/limit`, and nothing tells them. Also the printed shape is `toJSON()` output, not what `console.log(pagination)` (an Array subclass) actually prints.
- ✅ **[FIXED]** **Empty "Features" section and undocumented half of the API** — `README.md:37-38` has a `## Features` heading with no content; `createPaginationSchemaObject`/`createPaginationMetaSchemaObject`, `baseUrl()`, `queryString()`, and `getUrlsForRange()` are all absent from the README despite being the package's differentiators (they are covered in `docs/usage.mdx` only).
- ✅ **[FIXED]** **No input validation or clamping anywhere** — `paginate(0, -5, NaN, rows)` silently produces nonsense meta (`src/index.ts:7-8`, `src/paginator.ts:34-47`). Competitors (AdonisJS `SimplePaginator`, Laravel) clamp page >= 1 and validate perPage. A cheap guard or at least JSDoc `@throws` would prevent corrupt `lastPage`/URL math.
- ✅ **[FIXED]** **Type/runtime mismatches in the public surface** — `PaginationMeta.firstPageUrl`/`lastPageUrl` are typed `string | null` (`src/types.d.ts:3-5`) but `getUrl()` always returns `string`; and `Paginator.currentPage` is `readonly` in the interface (`src/types.d.ts:22`) but mutable `public currentPage` on the class (`src/paginator.ts:37`).

#### Optimizations

- ✅ **[FIXED]** **Double spread of rows stack-overflows on large datasets** — `paginate` does `new Paginator(total, perPage, page, ...rows)` (`src/index.ts:7-8`) and the constructor spreads again via `this.push(...rows)` (`src/paginator.ts:41`). Spreading as call arguments throws `RangeError: Maximum call stack size exceeded` around ~100k rows on V8. Accept `rows: T[]` and assign in a loop (or `this.length = rows.length` + index writes); keep the variadic signature only as a deprecated overload.
- ✅ **[FIXED]** **Rows are referenced twice per instance** — elements are stored both as the Array contents and as `this.rows` (`src/paginator.ts:30,45`). Since `Symbol.species` already returns plain `Array`, `all()` could return `[...this]` lazily or `rows` could be the single backing store; minor, but it doubles the per-instance slot count for an object created per request.
- ✅ **[FIXED]** **`getMeta()` rebuilds `URLSearchParams` four times** — `src/paginator.ts:68-80` calls `getUrl()` for first/last/next/previous, each re-iterating `this.qs` and re-serializing (`src/paginator.ts:110-123`). Precomputing the base query string once per `qs` assignment would make `getMeta()` (the per-response hot path in `@visulima/crud`) allocation-light.

#### Feature gaps

- **No cursor-based pagination** — the niche standard (Adonis discussions, Prisma, JSON:API `page[cursor]`) for stable infinite scroll. A `CursorPaginator` with `nextCursor`/`previousCursor` in meta would serve `@visulima/crud` list endpoints far better than offset for large tables. Today the package is offset-only (`src/paginator.ts`).
- **No windowed page-range helper ("elision")** — `getUrlsForRange(start, end)` (`src/paginator.ts:128-137`) requires callers to compute the window themselves. Laravel's `onEachSide(n)` / headless `links()` with ellipsis markers is the expected UI building block: e.g. `getUrlsForWindow({ eachSide: 2 })` returning `1 … 4 [5] 6 … 20`.
- **No naming-strategy / serialization customization** — AdonisJS lets you emit `snake_case` meta (`per_page`, `last_page`) via a naming strategy; consumers integrating with Laravel-style or JSON:API clients must hand-map `getMeta()` output (`src/paginator.ts:68-80`). A `meta` key-transform option (or JSON:API `links`/`meta` mode) would be a high-leverage addition.
- **OpenAPI nullability and `required` missing from generated schemas** — `nextPageUrl`/`previousPageUrl` (and the typed-nullable first/last URLs) are emitted as plain `type: "string"` with no `nullable: true` (`src/swagger.ts:25-28,39-42`), yet the runtime returns `null` (`src/paginator.ts:85-104`); strict validators (openapi-validator, typed clients) will reject real responses. The schemas also declare no `required` array, so every field is optional in generated clients. There is additionally no OpenAPI 3.1 variant (`type: ["string","null"]`).

---

# Data Manipulation

## @visulima/bytes — `packages/data-manipulation/bytes`

> @visulima/bytes is a tiny single-file Uint8Array utility package (5 local helpers plus a bundled re-export of Deno's @std/bytes) that is healthy and well-tested for its local helpers, but its Buffer-dependent string conversions break the claimed cross-runtime story and the re-exported API surface is untested.

#### DX improvements

- ✅ **[FIXED]** **`utf8ToUint8Array` crashes in non-Node runtimes despite the package's cross-runtime claims** — `src/index.ts:60` calls `Buffer.from(...)` unconditionally (no `typeof Buffer === "function"` guard like `isUint8Array`/`toUint8Array` have), so in a browser/edge runtime it throws `ReferenceError: Buffer is not defined`. `TextEncoder` is standard everywhere and would also let the module drop the `node:buffer` import (`src/index.ts:1`) for browser bundles.
- ✅ **[FIXED]** **Broken README structure** — `README.md:279` titles the local-helper API docs "## Related" (they are not related projects), and the `utf8ToUint8Array` example at `README.md:331-373` opens a 4-backtick fence that swallows the entire `toUint8Array` section (its heading, prose, and example render inside the code block). The `toUint8Array` docs are effectively invisible on npm/GitHub.
- ✅ **[FIXED]** **`toUint8Array` error is hard to handle programmatically** — `src/index.ts:103` throws a bare `Error` with a string-encoded code (`"UINT8ARRAY_INCOMPATIBLE: ..."`). Adding a `code` property (or custom class) and including the rejected value's type in the message would help users, without breaking the test-asserted message prefix.
- ✅ **[FIXED]** **`asciiToUint8Array` JSDoc misdescribes its behavior** — `src/index.ts:25` says out-of-range characters are "truncated", but `& 0xff` (`src/index.ts:41`) masks/wraps: U+0141 becomes 0x41 (`A`). The function is latin1-with-wraparound, not ASCII (which would be 0-127); the doc also claims a 0-255 "ASCII" range.
- ✅ **[FIXED]** **`isUint8Array` fails for cross-realm values** — the `instanceof`-based check (`src/index.ts:18-21`) returns `false` for `Uint8Array`s from another realm (vm, worker, iframe); `uint8array-extras` handles this via constructor-name/toString checks. Also, in Node the `Buffer.isBuffer` arm is redundant since `Buffer` subclasses `Uint8Array` in the same realm.

#### Optimizations

- ✅ **[FIXED]** **`toUint8Array` double-iterates number arrays** — `src/index.ts:86` runs an O(n) `.every()` type pre-pass before `new Uint8Array(data)` iterates again. A single manual loop (or skipping the pre-pass and documenting coercion) halves the work on large arrays.
- ✅ **[FIXED]** **`asciiToUint8Array` per-char JS loop** — for large inputs the loop at `src/index.ts:38-42` is notably slower than `Buffer.from(input, "latin1")` (Node) or a `TextEncoder`-based latin1 path; worth a runtime-conditional fast path given the function exists for performance-minded byte work.

#### Feature gaps

- **No bytes-to-string direction** — the package ships three string-to-bytes helpers but no `uint8ArrayToUtf8`/`uint8ArrayToAscii` decode counterpart (`src/index.ts` has no TextDecoder usage). Anyone round-tripping (parse a header, log a payload) must leave the package; `uint8array-extras` ships `uint8ArrayToString`.
- **No hex/base64 codecs** — `toHex`/`fromHex`/`toBase64`/`fromBase64` are table-stakes companions in this niche (`uint8array-extras`, `@std/encoding`); users doing hashing/IDs/data-URLs need them constantly. Natural fit next to the existing converters in `src/index.ts`.
- **The re-exported `@std/bytes` surface (most of the documented API) has zero direct tests** — `__tests__/unit/index.test.ts` covers only the 5 local helpers; the integration fixture (`__fixtures__/package/mjs/test.mjs`) merely asserts the export object is non-empty. A regression in the `export * from "@std/bytes"` bundling (`src/index.ts:107`, inlined into `dist/packem_shared/*`) — e.g. a missing chunk — would pass CI. A small smoke test importing `concat`/`equals`/`indexOfNeedle` from the built entry would close this.

#### Security

- 🟡 **[PARTIAL]** **Low: returned views can expose Node's shared Buffer pool** — _a `{copy:true}` opt-in plus docs were added, but the default view still aliases the pool._ — `bufferToUint8Array` (`src/index.ts:11`) returns `new Uint8Array(buf.buffer, ...)`; for pooled Buffers (any `Buffer.from` under 4 KiB) `.buffer` is the shared 8 KiB allocation slab. `utf8ToUint8Array` (`src/index.ts:60`) and `toUint8Array(string)` (`src/index.ts:96`) propagate this, so a consumer that slices, transfers, or `structuredClone`s `result.buffer` can read unrelated pooled data (potentially other secrets buffered in-process). The JSDoc advertises the view behavior but not the pool implication; copying (`Uint8Array.prototype.slice`) or documenting the hazard would address it.

---

## @visulima/content-safety — `packages/data-manipulation/content-safety`

> Zero-dependency multi-language (19 dictionaries, ~8.4k entries) banned-word detector with position reporting; the core matcher is clean, well-tested and fast for tokenized scripts, but the API is option-less, the word data is a monolithic ~300KB eager chunk, and the CJK path does a linear indexOf scan per dictionary entry.

#### DX improvements

- ✅ **[FIXED]** **Stale and contradictory docs: "17 languages" + "pre-compiled regex cache"** — `package.json:4` and the README h3 say 17 languages while the code and README feature list ship 19 (`src/banned-words.ts:52-91`); README "Key Features" still advertises a "Pre-compiled regex cache" but the implementation was rewritten to Map/Set lookups (`src/checker.ts:101-113`). Sync the description and feature copy with reality.
- ✅ **[FIXED]** **`checkBannedWords` takes no options** — `src/checker.ts:312` accepts only `text`. There is no way to restrict which languages are checked, so an English-only app is also matched against 18 other dictionaries, including Latin transliterations from the ru/ar/fa lists — a recipe for cross-language false positives with no escape hatch.
- ✅ **[FIXED]** **Mutating the exported `BANNED_WORDS` silently does nothing** — lookup tables are built once at module load (`src/checker.ts:168`), so a user who pushes extra words into `BANNED_WORDS.en` (the typed export invites it: `Record<string, ReadonlyArray<string>>`, `src/banned-words.ts:52`) sees no effect. Either `Object.freeze` the export and document immutability, or support runtime extension properly.

#### Optimizations

- 🟡 **[PARTIAL]** **~300KB word-data chunk is eagerly loaded by any import** _(`createChecker({ words })` factory added; per-language subpath exports / tree-shaking still pending)_ — `dist/packem_shared/BANNED_WORDS-*.js` is 308KB because `src/banned-words.ts:12-30` statically imports all 19 lists and the checker imports the whole object. No per-language subpath exports (`package.json:68-74` exposes only `.`), so browser/edge users (a headline claim) cannot tree-shake to just the languages they need. Per-language entry points plus a `createChecker(words)` factory would fix both this and the options gap.
- ✅ **[FIXED]** **CJK matching is O(entries × text)** — `findCjkMatches` (`src/checker.ts:237-256`) runs a full `indexOf` scan of the input for each of the roughly 2-3k CJK entries (zh/ja/ko lists total ~2,981 strings) on every call. A first-character index over `cjkEntries`, or an Aho-Corasick automaton, would reduce this to a single pass.
- ✅ **[FIXED]** **Per-token allocations in phrase matching** — `findPhraseMatches` (`src/checker.ts:215-219`) does `slice().map().join(" ")` for every token × every phrase length, allocating two arrays plus a string per probe. Building the phrase key incrementally (`phrase += " " + tokens[i].text`) removes the array churn from the hot loop.
- ✅ **[FIXED]** **Table build cost paid at import time** — `buildLookupTables()` runs at module top level (`src/checker.ts:168`), folding/tokenizing all ~8.4k entries even if `checkBannedWords` is never called. Lazy-initialize on first call to keep cold-start cheap for edge runtimes.

#### Feature gaps

- **No built-in censor/clean function** — competitors ship this as the primary API (`bad-words` `clean()`, `obscenity` censor strategies). The README (`README.md`, "Text Censoring") and JSDoc (`src/checker.ts:296-309`) document a manual reverse-iteration recipe instead; a `censorText(text, { replacement })` export would turn the most common user story into one line.
- **No custom dictionary or allowlist** — `bad-words` (`addWords`/`removeWords`) and `leo-profanity` both support runtime list editing. Users hitting a domain-specific false positive (the classic Scunthorpe problem) currently have no remedy at all given the frozen-at-load tables (`src/checker.ts:168`).
- **No obfuscation-resistant matching** — `obscenity` normalizes `f.u.c.k`, `fuuuck`, and homoglyphs before matching; here evasion handling is limited to hardcoded leet variants inside the word lists (e.g. `src/words/en.ts`), so trivial punctuation insertion defeats detection. A pre-match transformer pipeline (strip separators, collapse repeats, confusable mapping) is the standard answer in this niche.
- **No severity/category metadata** — entries are bare strings (`src/words/*.ts`), so a moderation app cannot distinguish a slur from mild profanity to apply thresholds (warn vs block). Tagging entries (`{ word, category, severity }`) and surfacing it on `BannedWordMatch` (`src/checker.ts:20-35`) would enable graduated policies.

#### Security

- No real findings. The package is pure computation on strings: no I/O, no eval/exec, no user-controlled regexes; all patterns (`src/checker.ts:73,82,91`) are linear-time character classes with no ReDoS-prone structure.

---

## @visulima/deep-clone — `packages/data-manipulation/deep-clone`

> @visulima/deep-clone is a zero-dependency, performance-oriented structured-clone implementation with loose/strict modes and pluggable per-type handlers; the core is solid and well-tested, but it has a prototype-assignment sink in loose object cloning, a browser-breaking module-scope Buffer reference, and a custom-handler options type that contradicts its own docs.

#### DX improvements

- ✅ **[FIXED]** **README quickstart is broken** — `README.md:56` shows `import deepClone from "@visulima/deep-clone"`, but `src/index.ts:65` only has the named export `deepClone` (no default). The `docs/usage.mdx` examples use the correct named import. README also documents the option as `handlers` (`README.md:85`) while the actual key is `handler` (`src/types.ts:10`).
- ✅ **[FIXED]** **`Options.handler` requires all 18 keys** — the handler object in `src/types.ts:10-32` is not `Partial`, so passing a single custom handler (`{ handler: { Date: myFn } }`) is a type error, contradicting the README's "custom handlers for specific types" pitch. Worse, the typed-array keys it declares (`Float32Array`…`Uint32Array`) are dead: the dispatch in `src/index.ts:126-149` hardwires `cloner.ArrayBuffer` and never consults them.
- ✅ **[FIXED]** **Module-scope `Buffer.from` breaks non-Node runtimes** — `src/handler/copy-array-buffer.ts:10` references the `Buffer` global at module evaluation; the main entry transitively imports this file, so importing the package in a browser/edge runtime without a Buffer polyfill throws `ReferenceError` at load time. Gate it with `typeof Buffer !== "undefined"`. (Also `new Ctor(...)` on `Buffer.from` only works via constructor-return-object semantics.)
- ✅ **[FIXED]** **JSDoc/typing polish** — `src/index.ts:62` has a literal `DeepReadwrite&lt;T>` HTML entity that renders raw in editor tooltips, and the `DeepReadwrite<T>` return type (`src/index.ts:50`) is not exported even though it appears in the public signature.

#### Optimizations

- ✅ **[FIXED]** **Per-call handler table and closure allocation** — every `deepClone()` call spreads the 14-key `handlers` object plus two conditional spreads and creates a fresh `clone` closure (`src/index.ts:70-80`), even in the common no-options case. Hoist a prebuilt default `cloner` (and one strict variant) to module scope, and/or expose a `createDeepClone(options)` factory like fast-copy's `createCopier` — this is pure overhead in hot loops that clone many small objects. The `cache = null` at `src/index.ts:191` is also a no-op (the eslint disable admits it); the WeakMap is already collectible.
- ✅ **[FIXED]** **`getCleanClone` stringifies the constructor per instance** — `src/utils/get-clean-clone.ts:17` runs `Function.prototype.toString.call(Constructor).includes("[native code]")` for every non-plain object cloned. Memoize the verdict per constructor in a `WeakMap` so cloning 10k class instances does one toString, not 10k.

#### Feature gaps

- **Map keys are never deep-cloned** — `src/handler/copy-map.ts:10-12` clones values only (`clone.set(key, state.clone(value, state))`), and `copyMapStrict` reuses the loose pass, so even strict mode shares key objects with the source. `structuredClone` clones keys; mutating a key object after cloning silently corrupts both maps.
- **`File` degrades to `Blob`** — `value instanceof Blob` catches `File`, but `blob.slice(0, size, type)` (`src/handler/copy-blob.ts:1`) returns a plain `Blob`, dropping `name` and `lastModified`. A dedicated `File` handler (`new File([file], file.name, { type, lastModified })`) matches `structuredClone` behavior.
- **No rfdc-style `circles: false` fast path, and duplicate-reference identity is lost for leaf types** — the WeakMap cache always runs, yet `copyDate`, `copyRegExpLoose`, `copyBlob`, and the typed-array branch (`src/index.ts:126-148`) never `cache.set`, so two references to the same `Date` become two distinct clones (unlike `structuredClone`). Offering a no-cycle mode is rfdc's headline perf win; conversely, caching leaf clones would restore identity semantics.

#### Security

- ✅ **[FIXED]** **Prototype assignment sink in `copyObjectLoose`** (`src/handler/copy-object.ts:29-35`) — the `for...in` loop assigns `clone[key] = state.clone(...)` without guarding `__proto__`. `JSON.parse('{"__proto__":{"isAdmin":true}}')` has an own enumerable `__proto__` key, so cloning attacker-controlled JSON triggers the `Object.prototype.__proto__` setter and replaces the clone's prototype with attacker data — the clone gains inherited properties the source never exposed and can shadow `hasOwnProperty`-style checks downstream. Scope is the cloned value only (not global `Object.prototype`), matching the moderate-severity klona advisory for the identical pattern; the strict path is safe because `copyOwnProperties` uses `Object.defineProperty` (`src/utils/copy-own-properties.ts:38`). Fix: special-case `__proto__` with `Object.defineProperty` in the loose loop. No test covers this (`grep __proto__` over `src/` and `__tests__/` is empty).

---

## @visulima/html — `packages/data-manipulation/html`

> @visulima/html is a one-stop HTML/CSS/JS escaping + sanitization toolkit (fast Svelte-derived escaper, html/css template tags, curated re-exports of sanitize-html, html-entities, string-strip-html, @std/html) that is well-tested and well-documented, but its single barrel entry eagerly drags in the heavy sanitize-html dependency chain and its `html()` string overload is unsafe by default.

#### DX improvements

- ✅ **[FIXED]** **`html(value)` silently returns raw HTML by default.** In `src/html.ts:48-56`, the string overload treats `shouldEscape === undefined` the same as `false` and returns the input untouched. For a package whose keywords include `xss`/`security`, a function named `html` that passes untrusted strings through unescaped by default is a footgun; either default to escaping or rename the passthrough path (e.g. `html.raw()`). The tri-state `boolean | undefined` also makes the JSDoc ("If false/undefined, returns HTML as-is") read like two distinct behaviors when they are identical.
- ✅ **[FIXED]** **Stale `repository.directory`.** `package.json:36` says `"directory": "packages/html"` but the package lives at `packages/data-manipulation/html` — breaks npm "code"/source links and provenance directory metadata.
- ✅ **[FIXED]** **`css` template tag mangles quoted CSS strings.** `src/css.ts:78` collapses all whitespace with `replaceAll(/\s+/g, " ")`, including inside quoted values like `content: "a   b"`. Worth a doc caveat or a quote-aware minifier.
- ✅ **[FIXED]** **Dead build plugin + devDep.** `packem.config.ts:19-24` registers `optimizeLodashImports()` but nothing in `src/` imports lodash; the `esbuild` devDep (`package.json:103`) is likewise unused boilerplate.

#### Optimizations

- ✅ **[FIXED]** **Barrel entry eagerly loads sanitize-html for everyone.** `src/index.ts:18` re-exports `sanitize-html` (a runtime dep, kept external — see `dist/index.js` line `export { default as sanitizeHtml } from 'sanitize-html';`). In plain Node ESM, `import { escapeHtml } from "@visulima/html"` therefore evaluates the whole sanitize-html → htmlparser2/parse5/postcss chain even when only the ~40-line escaper is needed, and makes the single entry effectively non-browser-safe. Add subpath exports (`./escape`, `./html`, `./css`, `./sanitize`, `./strip`) in `package.json:55-61`; `sideEffects: false` only rescues bundler users, not Node runtime imports.
- ✅ **[FIXED]** **Per-property closure in `cssObjectToString`.** `src/css.ts:23-29` allocates an IIFE per key for kebab-casing; a small module-level `toKebab` function (optionally with a memo `Map`, since CSS property names recur heavily) avoids the per-call closure and regex work in render hot paths.

#### Feature gaps

- **No fragment composition in the `html` tag.** Competitors in this niche (lit-html, `ghtml`, common-tags' `safeHtml`) support interpolating arrays and already-safe nested fragments. Here, `html\`<ul>${items.map((i) => html\`<li>${i}</li>\`)}</ul>\``double-escapes the nested markup and joins the array with commas, because`src/html.ts:37-40`blindly runs`escapeHtml(String(value))`on everything. User story: building a list or composing partials — the most common template-tag use case — currently produces broken output. Support arrays (join with "") and a`raw`/trusted-string marker that bypasses escaping.
- **No `isHtml` predicate despite the `validation` keyword.** `is-html` is already a devDependency (`package.json:107`, used only in tests); re-exporting it (or a tiny detector) would round out the "everything HTML" surface the README promises alongside `htmlTags`/`isValidCustomElementName`.

#### Security

- ✅ **[FIXED]** **Insecure-by-default `html()` string overload (low).** Same issue as the first DX item: `src/html.ts:48-56` makes non-escaping the default for the `html(string)` call form, while the template-tag form escapes — an inconsistent safety model that invites accidental XSS in a package marketed for XSS prevention. No other concrete issues: the escaping regexes (`src/escape-html.ts:27-28`, `src/css.ts:26,78`) are simple character classes with no ReDoS potential, and there is no I/O, deserialization, or dynamic execution in local code.

---

## @visulima/humanizer — `packages/data-manipulation/humanizer`

> @visulima/humanizer formats/parses byte sizes and durations with 60+ tree-shakeable locale packs; the code is clean and well-tested overall, but it carries a silent parseDuration decimal-separator misparse, an edge-case formatBytes crash, per-call Intl/validation overhead, and a dead public option.

#### DX improvements

- ✅ **[FIXED]** **parseDuration silently misparses multiple comma-decimal values** — `src/parse-duration.ts:56` uses `processedValue.replace(escapedDecimal, ".")`: a _string_ pattern that replaces only the **first** occurrence. With the German locale (`decimal: ","`), `"1,5 stunden 2,5 min"` becomes `"1.5 stunden 2,5 min"`, and since text _between_ matches is never validated (only leading/trailing noise, `src/parse-duration.ts:166-171`), it returns 1.5 h + 5 min instead of failing or returning 2.5 min — verified with a repro. Use `replaceAll` constrained to digit context, and validate inter-match noise.
- ✅ **[FIXED]** **`formatBytes` crashes with an opaque TypeError for 0 < |bytes| < 1** — `src/bytes.ts:308-309`: `Math.floor(Math.log(0.5)/Math.log(1024))` yields `-1`, so `referenceTable[-1]` is `undefined` and the `[long ? "long" : "short"]` access throws `Cannot read properties of undefined`. Clamp `level` to `>= 0`.
- ✅ **[FIXED]** **Dead public option `fallbacks`** — declared in `DurationOptions` (`src/types.ts:657`) and `InternalOptions` (`src/duration.ts:10`) but never read anywhere in `src/`. It's a vestige of humanize-duration's language-code fallbacks, which don't apply here since `language` is an object. Remove it or implement it; today users can set it and nothing happens.
- ✅ **[FIXED]** **Exported type name typo: `FormateByteOptions`** — `src/types.ts:675`, re-exported from `src/index.ts:12`. Public API surface with a misspelling; add a correctly-spelled `FormatBytesOptions` and deprecate the old alias before v3 stable.
- 🟡 **[PARTIAL]** **Inconsistent `parseBytes` error contract** _(SI/IEC + throw-vs-NaN contract now documented in README; throw/NaN behavior intentionally unchanged)_ — throws `TypeError` for non-string/over-100-chars input (`src/bytes.ts:225-231`) but returns `NaN` for unparseable strings/unknown units (`src/bytes.ts:238-257`). Also, default `base: 2` means `parseBytes("1 KB")` → `1024` even though "KB" is an SI unit — README shows this but never explains the SI/IEC mismatch; a short "why does KB mean 1024?" note would prevent confusion.

#### Optimizations

- ✅ **[FIXED]** **`Intl.NumberFormat` constructed on every call** — `formatBytes` builds one per invocation (`src/bytes.ts:313-319`), and `parseLocalizedNumber` builds **two** per `parseBytes` call just to sniff separators (`src/bytes.ts:189-190`). `Intl.NumberFormat` construction is among the most expensive standard-library operations; cache formatters keyed by locale+options and memoize the separator lookup per locale. This is the dominant cost in any loop over rows/files.
- ✅ **[FIXED]** **`validateDurationLanguage` runs on every `duration()`/`parseDuration()` call** — `src/duration.ts:333`, `src/parse-duration.ts:39`. The same language object is re-validated thousands of times in render loops. Cache validated objects in a `WeakSet` (the package already uses a `WeakMap` for the unit-regex cache at `src/parse-duration.ts:19`).
- ✅ **[FIXED]** **~570-member `IntlLocale` union** — `src/types.ts:21-592` inflates the published `.d.ts` and slows editor hover/autocomplete. Consider `KnownLocale | (string & {})` so users keep autocomplete without the giant closed union (which also wrongly rejects valid BCP-47 tags like `"de-DE"`).

#### Feature gaps

- **No bits output for byte formatting** — `pretty-bytes` offers `bits: true` (and `filesize` has `bits`); users formatting network throughput want `"12.5 Mbit"` rather than `"1.56 MB"`. The `BYTE_SIZES` table (`src/bytes.ts:15-168`) has no bit variants, and there's no `signed: true` (`+1.2 MB` for deltas/diff UIs) either.
- **ISO 8601 duration parsing is minimal** — `ISO_FORMAT` (`src/parse-duration.ts:20`) only accepts `PT<int>H<int>M<int>S`. No date part (`P3DT4H`, `P1Y2M`), no week form (`P2W`), no fractional seconds (`PT1.5S`). Anyone consuming YouTube/schema.org/OpenAPI durations hits this immediately.
- **No `humanizer()` factory** — humanize-duration's signature feature is creating a preconfigured instance (`const h = humanizer({ language: es, units: [...] })`). Here every call re-spreads defaults and re-validates the language; a factory would fix both ergonomics and the per-call overhead noted above.
- **No language lookup by code** — locales must be imported as objects (`@visulima/humanizer/language/de`); there's no `language: "de"` shorthand or `getLanguage(code)` helper. Tree-shaking justifies the per-file design, but an optional lazy `loadDurationLanguage("de")` (dynamic import over the existing `./language/*` subpath) would serve apps whose locale is only known at runtime — and would give the dead `fallbacks` option a real meaning.

#### Security

- No real findings. Dynamic regexes are built from escaped language-pack keys (`src/parse-duration.ts:107-112`), not raw user input; `parseBytes` caps input at 100 chars (`src/bytes.ts:229-231`); and the byte/duration regexes have no ambiguous nested quantifiers (`(?:[.,]\d+)*` requires a separator per repetition, so it's linear).

---

## @visulima/iso-locale — `packages/data-manipulation/iso-locale`

> Zero-dependency ISO 3166/4217/639 + IANA timezone + UN M.49 + BCP 47 lookup library with clean per-domain subpath entries and broad test coverage (~1,700 test lines incl. Wikipedia data validation) — healthy overall, with room for stronger typing, a few O(n) lookups, and competitor-parity features like localized names and timezone offsets.

#### DX improvements

- ✅ **[FIXED]** **Literal types are cast away** — `src/countries.ts:24` (`countriesData as unknown as ReadonlyArray<Country>`) and `src/currencies.ts:32` discard all literal information from the hand-authored `as const`-style datasets. Competitors (`countries-list`, `i18n-iso-countries`) ship `Alpha2Code`/`Alpha3Code` union types; deriving e.g. `type Alpha2Code = (typeof countriesData)[number]["alpha2"]` would give consumers autocomplete and compile-time validation for free.
- ✅ **[FIXED]** **No unified `getCountry()` export, 5x duplicated resolver** — `getEmoji`, `getCallingCode`, `getCallingCodes`, `getLanguages`, `getIOC` (`src/countries.ts:156-264`) each repeat the same 12-line alpha-2/alpha-3/numeric resolution block. Extracting it and exporting it as `getCountry(code: string | number)` removes ~60 lines and gives users the any-format lookup they'd reach for first.
- ✅ **[FIXED]** **Subpath exports undocumented** — `package.json` exposes `./countries`, `./currencies`, `./locale`, `./regions`, `./timezones`, `./types`, but `README.md` only ever shows the aggregate `@visulima/iso-locale` import. Documenting the focused entrypoints (and their bundle-size benefit) is a one-paragraph win.
- ✅ **[FIXED]** **`generateBCP47Tag` doesn't canonicalize script case** — `src/locale.ts:134-136` pushes the script subtag as-is, so `generateBCP47Tag("zh", "tw", "hant")` returns `"zh-hant-TW"` instead of the canonical `"zh-Hant-TW"`. One `charAt(0).toUpperCase()` fixes it.
- ✅ **[FIXED]** **Live network calls in the default test run** — `__tests__/validate-wikipedia.test.ts:36-49` fetches en.wikipedia.org during plain `vitest run`, making `pnpm test` flaky offline/in CI. Gate it behind an env var (e.g. `VALIDATE_ISO_DATA=1`) or move it to a scheduled data-freshness workflow.

#### Optimizations

- ✅ **[FIXED]** **O(n) country scan on the currency hot path** — `getByCountry` (`src/currencies.ts:80`) does `countriesAll.find(...)` per call even though `src/countries.ts` already builds and exports the frozen `byAlpha2` map. `getCurrency(locale)` (`src/locale.ts:56`) hits this on every invocation; switching to the map lookup is a one-line ~250x win.
- ✅ **[FIXED]** **`getCountriesForTimezone` re-scans everything per call** — `src/timezones.ts:25-28` runs `Object.entries(...).filter(includes)` on each lookup. A lazily-built reverse `Map<timezone, string[]>` (mirroring the existing `allTimezonesSet`) makes it O(1).
- ✅ **[FIXED]** **Repeated sort/Set rebuilds** — `timezones.all()` (`src/timezones.ts:34`), `getContinents`/`getSubregions`/`getIntermediaryRegions` (`src/regions.ts:45-87`) rebuild Sets and `toSorted(localeCompare)` on every call over static data; memoize once.

#### Feature gaps

- **Localized country/currency names** — only English `name` exists (`src/types.ts:20`). `i18n-iso-countries` supports ~100 locales; even a lightweight `getName(code, locale)` backed by `Intl.DisplayNames` would cover the "country dropdown in the user's language" story with zero data cost.
- **Timezone metadata** — `src/data/timezones.ts` is only country↔tz strings. `countries-and-timezones` ships UTC/DST offsets and aliases; users displaying "Europe/Berlin (GMT+2)" must pull a second package today.
- **Language data is one-way and nameless** — `src/data/iso-639-mapping.ts` only maps 639-3→639-1. No language display names and no `getCountriesByLanguage("de")` reverse lookup, which the existing `getLanguages(country)` makes an obvious sibling.
- **No ISO 3166-2 subdivisions** — state/province data (per `iso-3166-2`/`country-region-data`) is a natural extension for a package already covering ISO 3166-1, and a common need for address forms.

#### Security

No concrete issues found: zero runtime dependencies, no I/O or dynamic code, and all runtime regexes (`src/countries.ts:4`, `src/locale.ts:5-9`, `src/currencies.ts:6-7`) are anchored, bounded, and backtracking-safe. The unbounded `[\s\S]*?` HTML-scraping regexes exist only in the dev-time test file (`__tests__/validate-wikipedia.test.ts:11-15`) against trusted Wikipedia content and never ship.

---

## @visulima/object — `packages/data-manipulation/object`

> @visulima/object is a thin, well-tested facade bundling local deep pick/omit with inlined dot-prop/deeks re-exports; the code is healthy, but the published type surface is broken (type-fest missing from dependencies) and the README documents only 2 of its 10 exports.

#### DX improvements

- ✅ **[FIXED]** **`type-fest` is missing from `dependencies` — published types are broken.** `dist/index.d.ts:1-2` does `import { Paths, OmitDeep, PickDeep, Get } from 'type-fest'` and re-exports those types, but `packages/data-manipulation/object/package.json` has no `dependencies` field at all — `type-fest` sits in `devDependencies` (line 101, tellingly pinned to `catalog:prod`). `npm view @visulima/object@3.0.0-alpha.15 dependencies` confirms the published package ships none. Any consumer without a hoisted type-fest gets TS2307. The package CLAUDE.md even states "type-fest is a real runtime dep" — the manifest just doesn't match.
- ✅ **[FIXED]** **README has 8 empty API sections.** `README.md:53-67` lists `deleteProperty`, `escapePath`, `getProperty`, `hasProperty`, `setProperty`, `deepKeys`, `deepKeysFromList`, `isPlainObject` as bare headings with zero body text or examples — 80% of the public surface is undocumented.
- ✅ **[FIXED]** **Wildcard paths are a hidden feature.** `src/utils/paths-are-equal.ts:21` supports `*` segments (e.g. `omit(obj, ["items.*.secret"])`, tested at `__tests__/omit.test.ts:33,130`), but the README never mentions it. This is the package's main differentiator vs plain lodash pick/omit.
- ✅ **[FIXED]** **Generated d.ts loses key-based type inference.** `src/omit.ts:23` declares `<T, const K extends Paths<T>>(object: T, keys: K[])`, but `dist/index.d.ts` emits `<T, K extends string>(object: T, keys: Paths<T>[]) => OmitDeep<T, K>` — `K` no longer appears in any parameter, so it can never be inferred and the deep return type collapses (`pick` has the same problem). Looks like the oxc dts transform (`packem.config.ts:8-10`) drops the `const` modifier and rewrites the parameter type; worth verifying against a fresh prod build.
- ✅ **[FIXED]** **`omit([])` returns the original reference, `pick([])` returns `{}`.** `src/omit.ts:24-26` returns `object` itself when keys is empty, contradicting the JSDoc "returns a new object" and inconsistent with `src/pick.ts:24-26`. Mutating the result then mutates the input.

#### Optimizations

- ✅ **[FIXED]** **Per-node string re-splitting in `recursivePick`.** `src/utils/recursive-pick.ts:33-45` re-splits `path` and every picked key, then `slice().join(".")` twice per key — at every node of the recursion. `pathsAreEqual` (`src/utils/paths-are-equal.ts:16-27`) adds another split/reduce/join per comparison, and the `forEach` at line 36 never short-circuits where `some()` would. Pre-splitting the key list once at the `pick`/`omit` entry point and comparing segment arrays removes O(nodes × keys × depth) string allocations.
- ✅ **[FIXED]** **`Object.defineProperty` per copied key.** `src/utils/recursive-omit.ts:35,40` and `recursive-pick.ts:57,62` use `defineProperty` with a full descriptor object for every property — roughly an order of magnitude slower than assignment plus one allocation each. It's presumably there to dodge the `__proto__` setter (a legitimate concern), but building `carry` as `Object.create(null)` and assigning normally, or special-casing the single `"__proto__"` key, keeps the safety at a fraction of the cost.

#### Feature gaps

- **No escaped-dot support in `pick`/`omit` paths.** The package re-exports dot-prop's `escapePath` (`src/index.ts:9`), yet the local `pick`/`omit` blindly split on `"."` (`paths-are-equal.ts:16-18`), so a key literally named `"a.b"` can never be targeted and `escapePath` output is silently wrong for them. One package, two incompatible path dialects — filter-obj/lodash users will trip on this.
- **`pick`/`omit` don't traverse arrays.** `recursive-omit.ts:34` / `recursive-pick.ts:56` bail on anything that isn't a plain object, so `omit(data, ["users.0.password"])` or wildcard `"users.*.password"` over an array of objects is a no-op — exactly the shape (API response sanitizing) this package's keywords advertise. dot-prop's `getProperty` (re-exported next door) handles `users[0].name` fine, deepening the dialect split. Supporting arrays in the recursion (or documenting the limitation) is the biggest functional win.
- **Symbol-keyed properties are silently dropped.** `Object.entries` in both recursors (`recursive-omit.ts:20`, `recursive-pick.ts:20`) skips symbol keys, so they vanish from results even when never named in `keys`; lodash's omit preserves them. Worth a doc note at minimum.

#### Security

- No real findings. The local copy loop is pollution-safe by construction (`defineProperty` onto a fresh object avoids the `__proto__` setter, `recursive-omit.ts:35`), and the re-exported `setProperty` inherits dot-prop's own `__proto__`/`constructor` guards. Test breadth (`__tests__/`, ~490 lines incl. wildcard, nested, and integration export checks) is solid for the local code.

---

## @visulima/redact — `packages/data-manipulation/redact`

> @visulima/redact deep-copies objects/Maps/Sets/Errors/JSON-strings/URLs and masks sensitive values via key rules, regex rules, and compromise-powered NLP; the feature set is solid and well-tested (~1.2k test lines + benches), but the core traversal is O(rules × nodes) with per-rule NLP re-parsing, and the default regex rules carry real ReDoS/overmatch risk on untrusted input.

#### DX improvements

- ✅ **[FIXED]** **The six `redact` overloads are no-ops** — `src/index.ts:254-259` declares overloads that differ only in the generic _default_ (`<V = string>`, `<V = Error>`, …); since `V` is always inferred from `input`, callers see zero benefit. Replace with one signature plus real JSDoc (`@example`, `@param rules`) — the public API currently has no JSDoc at all.
- ✅ **[FIXED]** **README contradicts behavior on input mutation** — README claims "Does not modify input objects", but `redact` stamps `__redact_circular_reference__` onto every visited input object (`src/index.ts:275`). On frozen/sealed inputs this throws `TypeError` in strict-mode ESM, and if any rule throws mid-walk (e.g. a bad pattern), cleanup at `src/index.ts:321-324` never runs and the marker key leaks into caller data. Use a `WeakMap` instead of stamping.
- ✅ **[FIXED]** **Aggressive default rules need documentation/grouping** — `standardRules` includes `\b\d{9}\b` (id, routing), `\b\d{10,12}\b` (bankacc), weekday names, and zip codes (`src/rules.ts:14,46,55,79`), which will mangle ordinary numeric data. README lists rule names but never warns about overmatching or shows how to `exclude` groups; consider exporting themed subsets (`credentialRules`, `piiRules`, `dateTimeRules`).
- ✅ **[FIXED]** **Dead util** — `src/utils/is-json.ts` is exported and unit-tested but never imported by any `src/` module (index uses its own `JSON.parse` try/catch at `src/index.ts:181-192`). Delete it or wire it in.

#### Optimizations

- ✅ **[FIXED]** **O(rules × nodes) traversal with per-rule NLP re-parsing** — `recursivelyFilterAttributes` loops rules in the outer loop and recurses with a single-rule array `[modifier]` (`src/index.ts:27-45`), so the whole subtree is re-walked once per rule (~60 default rules), and every nested string hits `stringAnonymize` → `nlp(input)` per rule (`src/string-anonymizer.ts:120`). compromise parsing is by far the most expensive step; a single traversal evaluating all rules per node would be an order-of-magnitude win.
- 🟡 **[PARTIAL]** **`compromise` (~250 kB min) is always loaded** _(extractors now skip the `nlp()` parse when no NLP-type rules are requested; eager import / `/nlp` subpath still pending)_ — `src/string-anonymizer.ts:1` imports it eagerly even when users only do key-based object redaction and despite the `browser` export condition (`package.json:51-58`). Offer a lazy `import()` or a `@visulima/redact/nlp` subpath so the common case ships without an NLP engine; also skip `processTerms` entirely when no NLP-type rules (firstname/organization/…) are requested (`src/string-anonymizer.ts:122-129` always runs all six extractors).
- ✅ **[FIXED]** **No compiled/factory API for hot paths** — every `redact()` call re-lowercases keys and re-compiles `new RegExp(pattern, "giu")` per rule (`src/index.ts:285-317`). For the logger-scrubbing use case this package targets, a `createRedactor(rules)` that prepares once (fast-redact's whole value proposition) is both the biggest perf and DX win.

#### Feature gaps

- **No censor function / partial masking** — `replacement` is a static value only (`src/types.ts:2`). maskdata/fast-redact users expect `(value, path) => ...` so they can keep the last 4 digits of a card or mask emails as `t***@example.com`. User story: "redact card numbers in logs but keep enough to correlate support tickets."
- **No fast-redact-style path syntax or key removal** — wildcards exist, but there's no `a[*].b` array-element targeting and no `remove: true` to delete a key instead of replacing it (fast-redact supports both). Array targeting today requires stringly numeric keys (`src/index.ts:233-246`).
- **URL query redaction ignores wildcard and pattern rules** — `src/index.ts:204,212` only does exact `modifier.key ===` matches on parameter names, so a `*token*` rule that works on object keys silently fails on `?access_token=...` query strings.

#### Security

- ✅ **[FIXED]** **ReDoS-prone default patterns run with `g` over untrusted input (medium)** — the url rule `[-a-zA-Z0-9@:%._+~#=]{2,256}\.[a-z]{2,6}\b([...]*)` (`src/rules.ts:69`) has a character class containing `.` followed by a literal `\.`, a classic polynomial-backtracking shape, and the unanchored creditcard rule `(?:\d[ -]*?){13,16}` (`src/rules.ts:20`) combines a counted group with an unbounded lazy inner quantifier. These execute in a scan loop (`src/string-anonymizer.ts:101`) against exactly the kind of attacker-influenced strings (logs, request bodies) the package is built to process. Linearize or anchor these patterns (cf. the repo's prior CodeQL ANSI-regex fix).
- ✅ **[FIXED]** **Zero-width match hangs the process (low)** — `while ((match = rx.exec(input)) !== null)` at `src/string-anonymizer.ts:101-107` never advances `lastIndex` on empty matches, so a user-supplied rule pattern like `\d*` loops forever. Add the standard `if (match.index === rx.lastIndex) rx.lastIndex++` guard.

---

## @visulima/string — `packages/data-manipulation/string`

> @visulima/string is a broad Unicode-aware string toolkit (case conversion, slug/transliteration, width-aware wrap/truncate/slice, similarity) with excellent test and bench coverage, but it carries a real width-cache correctness bug and an eager 329KB transliteration chunk on the root entry.

#### DX improvements

- ✅ **[FIXED]** **Missing subpath exports for ~9 public modules.** `package.json` `exports` (lines 77–222) covers case/\*, slugify, truncate, etc., but omits `./transliterate`, `./excerpt`, `./direction`, `./count-occurrences`, `./levenshtein`, `./east-asian-width`, `./indent`, `./replace-string`, and `./is-fullwidth-code-point` — all exported from `src/index.ts`. The package's own CLAUDE.md convention says every function gets an exports entry; users who want only `transliterate` are forced through the root entry (see bundle finding below).
- ✅ **[FIXED]** **README skips the entire similarity API.** `closestString`, `compareSimilarity`, `wordSimilaritySort`, `distance`/`closest`/`closestN`, plus `excerpt`, `identifyCase`, and `flipCase` have zero mentions in `README.md` (verified by grep), despite being exported and having dedicated subpath exports. The 1205-line README documents everything else in depth, so these reads as missing, not minimal.
- ✅ **[FIXED]** **`slugify` resolves an invalid option combo with `console.warn`.** `src/slugify.ts:43-47` warns and silently flips `uppercase: false` when both `lowercase` and `uppercase` are true. A library shouldn't write to the console; throw a `TypeError` or document the precedence in `SlugifyOptions` JSDoc instead.
- ✅ **[FIXED]** **Deprecated `LRUCache` re-export still shipping.** `src/utilities.ts:105` re-exports it with `@deprecated This will be removed in the next major version` — v3 is in alpha now (`3.0.0-alpha.16`); this is the release to actually drop it from the public `./utils` surface.

#### Optimizations

- ✅ **[FIXED]** **Correctness bug: `charWidthCache` ignores the width config.** `src/get-string-truncated-width.ts:14` is a module-level cache keyed only by codePoint; `getCachedCharWidth` (lines 96–151) stores widths derived from `config.width.*` (including `ambiguousIsNarrow`, `wideWidth`, `fullWidth`). The cache path activates for inputs >10,000 chars (line ~493, used at line 716), so the first long-string call's options permanently poison results for all subsequent long-string calls with different options. Key the cache by a config signature or only enable it for the default config.
- 🟡 **[WON'T-FIX]** **Color bleed: `resetAnsiAtLineBreak` only knows two hardcoded codes.** _(generalizing it regressed `preserveAnsi` colored multi-line text; the deliberately-narrow form is documented as correct)_ `src/word-wrap.ts:15-32` resets only `[30m` (black fg) and `[42m` (green bg); red/blue/bold/etc. wrapped lines never get a reset appended (used at lines 405, 428, 446). wrap-ansi closes and reopens all active codes per line — the existing `AnsiStateTracker` could supply the full active-code set here.
- ✅ **[FIXED]** **Per-character `getStringWidth(char)` in the wrap hot loop.** `src/word-wrap.ts:120` (and the same pattern later in the file) calls `getStringWidth` per character, and each call spreads options into a fresh config plus a result object inside `getStringTruncatedWidth` (`src/get-string-width.ts:64-65`). For an N-char string that's 2N+ throwaway objects; hoist a codePoint→width helper that reuses one config.
- 🟡 **[PARTIAL]** **Eager 329KB transliterate chunk on the root entry.** _(`./transliterate` subpath added + charmap split into its own chunk; root still re-exports `slugify`/`transliterate` so the root entry keeps pulling the charmap)_ `dist/index.js` statically imports `packem_shared/transliterate-*.js` (329KB minified — the entire generated charmap) because root exports `slugify`/`transliterate`. In Node, `import { camelCase } from "@visulima/string"` pays that parse cost every time. Adding the missing `./transliterate` subpath and documenting subpath imports for server CLIs would mitigate; longer-term, lazy-load charmap blocks by Unicode range (the data is already split into 177 `src/charmap/block-*.ts` files).
- ✅ **[FIXED]** **Thai romanization recompiles and rescans per call.** `src/transliterate.ts:36-62` loops all 1654 `thaiReplacement` entries on every Thai-containing input, building `new RegExp(search, "g")` per `"r"` entry and running a linear `thaiReplacement.find(...)` inside each replace callback (O(entries × matches)). Precompile the regexes and build a consonant lookup `Map` at module init.

#### Feature gaps

- **`slugify` lacks locale-aware transliteration.** The npm `slugify` package's `locale: "de"` maps ö→oe / ä→ae; here the global charmap gives one fixed mapping (`src/slugify.ts`, `data/transliteration.json`). User story: a German shop wants "Käse-Spätzle" → `kaese-spaetzle`, a Turkish site needs ı/İ handled correctly — currently impossible without hand-writing `replaceBefore` pairs for every character.
- **No unique-slug helper or normalized similarity score.** @sindresorhus/slugify ships `slugifyWithCounter()` (CMS generating `my-post`, `my-post-2` for duplicate titles); string-similarity/didyoumean expose a 0–1 similarity ratio, while this package only offers raw Levenshtein `distance` (`src/levenshtein.ts`) and sort-based helpers — a `similarity(a, b): number` would round out `closest-string.ts`/`compare-similarity.ts` for threshold-based "did you mean" UX.

#### Security

- No concrete issues found. User-supplied fragments interpolated into regexes (`allowedChars`/`separator` in `src/slugify.ts:11-16,60-70`) are escaped via `escapeRegExp`, and the bounded ANSI patterns in `src/constants.ts:103-120` avoid the ambiguous-quantifier shapes that cause polynomial ReDoS.

---

# Email

## @visulima/disposable-email-domains — `packages/email/disposable-email-domains`

> Ships a 130k-entry, multi-source-aggregated disposable email domain list with a tiny Set-backed lookup runtime (isDisposableEmail/areDisposableEmails); the code is clean, tested, and zero-dependency, but the node:fs-based JSON loading locks it out of edge/bundled runtimes and the runtime API is thinner than the README implies.

#### DX improvements

- ✅ **[FIXED]** **`./domains` subpath export is completely undocumented.** `packages/email/disposable-email-domains/package.json:44-46` exposes the raw list as `./domains`, but `README.md` never mentions it, the export has no `types` condition, and Node ESM consumers need `import domains from "...domains" with { type: "json" }` — none of which is explained. The `## Related` section (`README.md:180-181`) is also an empty heading.
- ✅ **[FIXED]** **Domain-level check is not exported.** `isDisposableDomain` (`src/index.ts:103`) is internal, so users who already have a bare domain (from MX lookup, signup form parsing) must fabricate `x@domain` to use `isDisposableEmail`. Export it alongside `extractDomain`.
- ✅ **[FIXED]** **README oversells the runtime whitelist.** `README.md:102-116` says the package "automatically whitelists" Gmail/Yahoo/etc., but whitelisting only happens at list-generation time in `scripts/disposable-email-sync-manager.js:414-447` (`email-providers/common.json`); there is no runtime allowlist mechanism or parameter. The docs should say the whitelist is baked into the published list.

#### Optimizations

- ✅ **[FIXED]** **First call sync-parses a 2.27 MB JSON file on the request path.** `src/index.ts:29-57` does `readFileSync` + `JSON.parse` of `dist/domains.json` (130,211 entries) lazily inside the first `isDisposableEmail` call — a multi-tens-of-ms event-loop stall in the middle of handling a signup request. Eagerly loading at module init, or exposing an async `preload()`, would move the cost off the hot path.
- ✅ **[FIXED]** **Both the array and the Set of 130k domains stay resident.** `cachedDomains` (`src/index.ts:8`) is only ever used to build `cachedDomainSet` (`src/index.ts:64-72`) but is cached forever, keeping a redundant 130k-element array alive. Clear the array reference after the Set is built (or only cache the Set).

#### Feature gaps

- **No edge/browser/bundler support.** The runtime depends on `node:fs`/`node:path`/`node:url` and a dist-relative file path (`src/index.ts:1-3,32`), so it breaks in Cloudflare Workers, Next.js middleware/edge, and any bundle that relocates `index.js` away from `domains.json` — exactly where email validation usually runs. Competitors (`disposable-email-domains` npm, `mailchecker`) ship importable arrays that work everywhere. A statically-imported list (or a `./set` export) would fix this.
- **No runtime allowlist parameter.** `isDisposableEmail(email, customDomains)` only accepts extra _block_ domains (`src/index.ts:141`). A SaaS that finds a legitimate customer domain wrongly in the list has no escape hatch short of forking or PR-ing `scripts/config/blacklist.json`. Add an `allowDomains?: Set<string>` (checked before the list) — table stakes vs. validator-style competitors.
- **Custom domains don't get wildcard/subdomain matching.** The built-in list matches parent domains (`src/index.ts:124-130`), but `customDomains` is checked exact-only (`src/index.ts:111`) — `sub.custom-disposable.com` does not match a custom `custom-disposable.com` entry (asymmetry locked in by the test at `__tests__/index.test.ts` "wildcard ... is not implied"). Moving the custom check inside the parent-domain loop would make behavior consistent.

#### Security

- ✅ **[FIXED]** **Fail-open on data-load failure (low).** If `dist/domains.json` is missing or corrupt, `getDomains` warns once and returns `[]` (`src/index.ts:38-53`), silently disabling disposable-email detection for the process lifetime — a security control degrading to "allow everything" with no programmatic signal. Consider an opt-in strict mode (throw) or an exported `isListLoaded()` so callers can detect the degraded state. The sync pipeline itself (`scripts/disposable-email-sync-manager.js`) is sound: HTTPS-only configured sources, anchored + length-capped domain validation (`scripts/disposable-email-sync-manager.js:17,488-494`), no eval/exec/path-traversal sinks.

---

## @visulima/email — `packages/email/email`

> @visulima/email is a comprehensive multi-provider email library (25+ providers, template engines, crypto, webhooks, queue) with broad test coverage (107 test files) and generally careful security hygiene, but its hand-rolled MIME/SMTP path has a real Bcc-disclosure bug and lacks non-ASCII header encoding.

#### DX improvements

- ✅ **[FIXED]** **`DraftMailMessage` is unreachable from the public API.** `Mail.draft()` accepts it and `Mail.send()` throws `"Cannot send draft messages. Convert to MailMessage first"` (`src/mail.ts:442-444`), but the class is exported neither from `src/index.ts` nor any subpath in `package.json#exports` — users literally cannot construct the type the error message talks about. Export it from the root barrel.
- ✅ **[FIXED]** **README subsystem sections are stubs.** Seven newer subsystems (Middleware, Queue & Worker, Webhook Verification, Inbound Parsing, Deliverability, Events & Testing) each get ~4 lines at the bottom of the 1533-line `README.md` (lines 1439-1496), while per-provider config consumes ~900 lines; the `./crypto` module (DKIM/S-MIME/ARC signers) has no section at all. A short example per subsystem would materially improve discoverability.
- ✅ **[FIXED]** **`sendBatch` forces a throwaway `to` on the base message.** The JSDoc example even apologizes for the placeholder (`src/mail.ts:625`). Accept `Omit<EmailOptions, "to"> & { to?: ... }` (or a dedicated `BatchBase` type) so the type system stops demanding a field that is documented as ignored.

#### Optimizations

- ✅ **[FIXED]** **Root barrel eagerly loads `ical-generator` and `html-to-text`.** `src/mail-message.ts:4-10` statically imports both hard deps, and `MailMessage` is exported from `src/index.ts` — so every consumer bundles/loads them even when never using calendar events or auto-text. Both call sites (`addCalendarEvent`, the auto-text fallback at `src/mail-message.ts:750`/`1005`) are async-reachable; converting to lazy `await import()` would cut cold-start and bundle size for the common path, matching the package's own "tree-shaking honest" doctrine in `CLAUDE.md`.
- ✅ **[FIXED]** **`sendMany` is strictly serial with no concurrency option.** The loop in `src/mail.ts:521-596` awaits each `send()` before starting the next; large batches over HTTP providers are latency-bound. A `{ concurrency: n }` option with a small worker pool (yielding receipts as they settle) would be a big win and is what users of Resend/SendGrid batch APIs expect.

#### Feature gaps

- **No RFC 2047 encoded-word / quoted-printable support.** `buildMimeMessage` writes `Subject:` raw and labels UTF-8 text/html bodies `Content-Transfer-Encoding: 7bit` (`src/utils/build-mime-message.ts:47,64,68`). A subject like `"Grüße aus München"` produces a standards-violating message on the SMTP and Cloudflare raw-MIME paths; nodemailer encodes headers/bodies automatically. User story: any non-English product email.
- **DSN is implemented as a made-up header instead of RFC 3461.** The SMTP provider emits `X-DSN-NOTIFY: SUCCESS,FAILURE` into the message (`src/providers/smtp/provider.ts:813-831`) rather than appending `NOTIFY=...` to the `RCPT TO` command — servers ignore the header, so the `dsn` option silently does nothing on SMTP.
- **No EML/MIME parser, although `draft()` suggests one.** The JSDoc says "send later by parsing the EML back to EmailOptions" (`src/mail.ts:383`) and the inbound module only parses provider JSON payloads — a `parseEml()` (or documented mailparser recipe) would close the round-trip story.

#### Security

- ✅ **[FIXED]** **High — Bcc disclosure over raw-MIME transports.** `buildMimeMessage` writes a `Bcc:` header into the message (`src/utils/build-mime-message.ts:39-41`); the SMTP provider sends that exact message via `DATA` after issuing `RCPT TO` for bcc recipients (`src/providers/smtp/provider.ts:787-794,807,929`), and the Cloudflare provider does the same (`src/providers/cloudflare-email/provider.ts:73`). Every To/Cc recipient receives the full Bcc list in the delivered message — nodemailer strips Bcc from generated MIME for exactly this reason. Fix: omit `Bcc` when building for transport (keep it only for `Mail.draft()` EML output).
- ✅ **[FIXED]** **Medium — attachment metadata header injection.** `attachment.filename` is CRLF-sanitized, but `contentType`, `contentDisposition`, `cid`, and `encoding` are interpolated raw into MIME part headers (`src/utils/build-mime-message.ts:96-120`). Attachment content-types frequently flow from user uploads; a value containing `\r\n` injects arbitrary headers/parts. Run the same `sanitizeHeaderValue` over all metadata fields.

Positive security notes: webhook signature checks use `timingSafeEqual` with timestamp tolerance (`src/webhooks/utils.ts:38-47`), display names are quoted/escaped against recipient injection (`src/utils/format-email-address.ts:17-25`), SMTP DATA is dot-stuffed per RFC 5321 (`src/providers/smtp/provider.ts:927`), and address validation rejects whitespace, blocking CRLF in `MAIL FROM`/`RCPT TO`.

---

# Error & Debugging

## @visulima/dev-toolbar — `packages/error-debugging/dev-toolbar`

> A framework-agnostic Vite dev toolbar (Preact, Shadow DOM, type-safe RPC, 9 built-in apps + MCP server) that is well-architected and broadly tested, with solid path-traversal hardening but a couple of doc/code mismatches and dev-server file-read exposure worth tightening.

#### DX improvements

- ✅ **[FIXED]** **README contradicts actual app defaults.** `README.md:86` ("All apps are enabled by default") and the `apps` example at `README.md:101` ("all true by default") directly conflict with `src/vite-plugin.ts:385-397`, where only `settings` and `viteConfig` default to `true` and everything else (`a11y`, `inspector`, `performance`, `seo`, `tailwind`, `timeline`, `moduleGraph`, `assets`, `annotations`) defaults to `false`. The JSDoc at `src/vite-plugin.ts:62-65` and `CLAUDE.md` correctly say "disabled by default" — so the README is the outlier and will make new users think the toolbar is broken (empty). Highest-value fix.
- ✅ **[FIXED]** **Documented numeric ranges aren't enforced.** `height` (20–95, `src/vite-plugin.ts:111-115`) and `width` (`:199-204`) are passed straight into the options virtual module (`:404`, `:412`) with no clamp/validation. An out-of-range or negative value silently produces a broken panel rather than a helpful error or clamp.
- ✅ **[FIXED]** **RPC docs under-list built-ins.** `README.md:211` advertises only `getViteConfig/getModuleGraph/openInEditor`, but the server also ships `getAnnotations`, `createAnnotation`, `saveScreenshot`, `getStaticAssets`, `getTailwindConfig`, `readFile`, etc. (`src/rpc/server.ts:17-41`). Consumers writing custom apps can't discover the real RPC surface from the README.

#### Optimizations

- ✅ **[FIXED]** **Double Babel parse on the JSX hot path.** For every `.tsx/.jsx` module in dev, `injectSourcePlugin.transform` reads the file from disk (`src/vite-plugin.ts:545-550`) in addition to the in-memory `code`, then `addSourceToJsx` parses `code` (`src/vite/inject-source.ts:269`) and, when `originalCode` differs, parses+traverses a _second_ full AST via `buildPositionMap` (`:277`, `:75-105`) plus a `@babel/generator` pass with source maps. No content-hash cache, so unchanged files re-parse on every HMR trigger. A per-id+mtime memo would cut the common SSR case roughly in half.
- ✅ **[FIXED]** **glob regex recompiled per element.** `matcher` calls `globToRegex` for each string pattern on every invocation (`src/vite/matcher.ts:27-34`), and `transformJSX` invokes `matcher(ignoreComponents, …)` for every JSX opening element (`src/vite/inject-source.ts:144`). For a large component file with many elements this recompiles the same `ignore.components` globs hundreds of times — precompile patterns once per transform.

#### Feature gaps

- **No network/requests panel.** Nuxt DevTools and Vue DevTools both surface live fetch/XHR inspection; the app list (`src/apps/*`) has performance/timeline/module-graph but nothing for inspecting outgoing requests, a common ask for a Vite dev toolbar.
- **No master enable toggle via env.** There's `requireUrlFlag` (`src/vite-plugin.ts:180-197`) but no simple `enabled: false` / env gate to disable the whole plugin without removing it from `vite.config.ts` — competitors expose this for CI/preview builds beyond the production-strip path.

#### Security

- ✅ **[FIXED]** **`readFile` RPC returns any file under project root to any WS client** (`src/rpc/server.ts:27-38`). It validates only `isPathInsideBase(filePath, root)`, so `.env`, lockfiles, and source are all readable. The RPC handler (`:61-86`) has no origin/auth check; when the dev server is started with `--host` (routine for mobile testing) any device on the LAN can call it. Consider restricting to known safe roots/extensions or gating behind an explicit opt-in, and documenting the `--host` risk.
- Path-traversal handling elsewhere is solid: `sanitizeId` + `isPathInsideBase` guard screenshot writes/reads (`src/rpc/functions/assets.ts:165-205`, `src/store/annotation-store.ts:28-39`), symlink escapes are rejected in the asset walker (`src/rpc/functions/assets.ts:119-131`), and `openInEditor` confines paths to root (`src/rpc/functions/open-in-editor.ts:20-24`). No command injection (uses `launch-editor` API, not shell). Annotation create/update explicitly whitelist fields rather than spreading untrusted input (`src/rpc/functions/annotations.ts:34-62`).

---

## @visulima/error — `packages/error-debugging/error`

> @visulima/error is a well-tested, dependency-free error toolkit (VisulimaError, cross-browser stacktrace parser, code frames, serialize/deserialize, solution finders) in solid overall health, with one real deserialization security gap and a handful of correctness/portability nits.

#### DX improvements

- ✅ **[FIXED]** **Stacktrace parser uses bare global `process`, breaking non-Node runtimes** — `src/stacktrace/parse-stacktrace.ts:9-14` reads `process.env.DEBUG` directly, while the package already ships a cross-runtime shim (`src/util/process.ts`, used by `src/code-frame/index.ts:16`). The parser is the one module explicitly built for browser stack formats (Chromium/Gecko/Safari branches), yet it throws `ReferenceError: process is not defined` in an unshimmed browser/edge runtime. Switch to the shim.
- ✅ **[FIXED]** **`Trace.type === "internal"` is never set for modern Node frames** — the only internal check is `line.startsWith("internal")` in the React-style `in ... (at ...)` parser (`src/stacktrace/parse-stacktrace.ts:168`); `parseChromium` (which handles real Node `at ... (node:internal/...)` frames) only ever sets `eval`/`native` (line 265). The `"internal"` member of `TraceType` (`src/stacktrace/types.ts:1`) is effectively dead, so consumers can't filter Node internals by type.
- ✅ **[FIXED]** **`renderError` mangles backslashes in the whole output** — `src/error/render/error.ts:235` ends with `.replaceAll("\\", "/")` on the fully rendered string. That normalizes Windows paths, but also rewrites backslashes inside error messages and code-frame source lines (e.g. a displayed regex `\d` or `C:\` inside a string literal becomes `/d`, `C:/`). Path normalization should happen in `getRelativePath`/`getMainFrame`, not on the final output.
- ✅ **[FIXED]** **`aiFinder` caches failures for the full TTL** — on API error it builds a generic "Creation of a AI solution failed." solution and writes it to cache (`src/solution/ai/ai-finder.ts:172-185`), so one transient outage poisons the answer for 24h (default ttl). It also returns that placeholder instead of `undefined`, preventing lower-priority finders from supplying a real hint. Cache failures with a short TTL (or not at all) and return `undefined`.

#### Optimizations

- ✅ **[FIXED]** **Debug arguments are evaluated even when DEBUG is off** — every `debugLog(\`...\`, \`found: ${JSON.stringify(parts)}\`)` call (`src/stacktrace/parse-stacktrace.ts:141,159,184,287,354,375`) stringifies the regex match array per frame before `debugLog`checks`process.env.DEBUG`. For a 50-frame stack that's 50 wasted `JSON.stringify` + template allocations on the hot parse path; pass a lazy thunk or gate at the call site.
- ✅ **[FIXED]** **`codeFrame` processes the entire source for a ~6-line window** — `src/code-frame/index.ts:41-45` runs `normalizeLF` over the whole file and tab-expands every line before slicing to `[start, end)`. For large bundled files (the vite-overlay use case) this is O(file size) per render; normalize/expand only the visible slice after `getMarkerLines`.

#### Feature gaps

- **No source-map support** — competitors in this niche (youch v3/v4, Sentry's stack pipeline) resolve `*.js:line:col` back to original TS/JSX positions. `renderError`/`parseStacktrace` show compiled positions only, so code frames for transpiled apps point at bundle output. A pluggable `sourceMap` resolver hook on `renderError` (`src/error/render/error.ts`) would close the biggest gap vs youch.
- **No built-in stack-cleaning preset** — `parseStacktrace` exposes a raw `filter` callback (`src/stacktrace/parse-stacktrace.ts:390`), but users coming from `clean-stack`/youch expect one-liners: drop `node:internal`/`node_modules` frames, shorten paths relative to home/cwd. Ship `internals`/`nodeModules` filter presets (depends on fixing the `internal` type tagging above).
- **`serializeError` silently degrades Map/Set/RegExp/URL properties** — `serializeValue` (`src/error/serialize/serialize.ts:79-157`) special-cases Buffer/Stream/Date/Function/BigInt, but Maps/Sets fall through `isPlainObject` and are returned as-is, becoming `{}` after `JSON.stringify`. serialize-error-style placeholders (`[object Map]`) or structured conversion would make round-trips predictable.

#### Security

- ✅ **[FIXED]** **Prototype-replacement sink in `deserializeError` (medium)** — `restoreErrorProperties` does `errorCopy[key] = deserializeValue(...)` for every leftover key in the payload (`src/error/serialize/deserialize.ts:158-168`). A JSON payload containing an own `"__proto__"` key (which `JSON.parse` produces and `Object.entries` enumerates) triggers the `__proto__` setter, replacing the returned error's prototype with attacker-controlled data. Verified against `dist`: `deserializeError(JSON.parse('{"name":"Error","message":"x","__proto__":{"isAdmin":true}}'))` yields an object with `instanceof Error === false` and `err.isAdmin === true` (global `Object.prototype` is not polluted). Since deserialization of cross-boundary data is this API's stated purpose, skip `__proto__`/`constructor`/`prototype` keys (as serialize-error does) or use `Object.defineProperty`.
- ✅ **[FIXED]** **Predictable world-shared AI cache directory (low)** — `aiFinder` defaults to `join(tmpdir(), "visulima-error-cache")` (`src/solution/ai/ai-finder.ts:49-56`) and `writeFileSync`/`readFileSync` follow symlinks. On multi-user hosts, whoever creates the directory first can plant or read cache entries (poisoning "AI solutions" shown to other users). Use a per-user dir (e.g. `XDG_CACHE_HOME`) or `mkdtemp` + mode 0700.
- ✅ **[FIXED]** **Local file disclosure via untrusted stacks in `renderError` (low)** — `getCode` reads any path appearing in a stack frame and prints the surrounding lines (`src/error/render/error.ts:94-100`). Combined with `deserializeError` (attacker controls `stack`), rendering an untrusted error discloses arbitrary readable file contents at chosen line numbers. Acceptable for a dev-time renderer, but worth a README warning and/or an allowlist-root option since this package also targets server-side error handlers.

---

## @visulima/error-handler — `packages/error-debugging/error-handler`

> Content-negotiating HTTP/CLI error handlers (HTML, JSON, Problem-JSON, JSON:API, JSONP, XML, text) for Node and Fetch runtimes; small, well-tested codebase with solid formatter coverage, but the fetch path is built on heavy node-mocks, negotiation ignores q-values, and stack traces are exposed by default.

#### DX improvements

- ✅ **[FIXED]** **README documents a wrong signature and a per-error factory API.** `README.md:199` says `httpHandler(error, options?) => Promise<(req, res) => ...>` but `src/handler/http/node-handler.ts:8-28` is synchronous. Worse, the API takes the error at construction time, so every catch block rebuilds the whole pipeline (`htmlErrorHandler` + `createNegotiatedErrorHandler`) per request. An `(options) => (error, req, res)` form would match Express/Connect middleware shape and let users register it once.
- ✅ **[FIXED]** **`fetch-utils.ts` exports are unreachable.** `src/error-handler/fetch-utils.ts` re-exports `extractStatusCode` / `sendFetchJson`, but neither `src/index.ts` nor any `package.json` subpath exposes it — `sendFetchJson` is dead code (the fetch path never uses it either). Export it or delete it. The main index also omits all fetch-flavored APIs (`fetchHtmlErrorHandler`, the fetch negotiator), making the root export node-only without saying so.
- ✅ **[FIXED]** **The negotiator mutates the caller's error.** `src/error-handler/create-negotiated-error-handler.ts:91-97` (and the fetch twin at `fetch-create-negotiated-error-handler.ts:227-233`) writes `error.expose` onto the user's error object; the flag persists after handling and can leak into later logging or a second handler with different settings. Document it or set the flag on a wrapper.
- ✅ **[FIXED]** **JSON:API fallback hardcodes `code: "500"`.** `src/error-handler/jsonapi-error-handler.ts` uses string `"500"` in the generic branch even when `addStatusCodeToResponse` resolved a different 4xx/5xx, while the http-error branch emits `code` as a number — inconsistent shape and wrong code for non-500 plain errors.

#### Optimizations

- ✅ **[FIXED]** **Formatter factories are re-instantiated on every error.** `create-negotiated-error-handler.ts:39-67` calls `JsonpErrorHandler()`, `JsonErrorHandler()`, `XmlErrorHandler()`, `TextErrorHandler()` inside the per-request closure (same in `fetch-create-negotiated-error-handler.ts:177-202`, which additionally wraps each in a fresh `adaptErrorHandlerToFetch` closure). These are option-less defaults — hoist them to module-level singletons.
- 🟡 **[DEFERRED]** **The fetch path simulates Node instead of speaking Fetch.** _(Intentional large architectural rewrite — replacing both MockServerResponse stub classes with native Fetch formatters — left out of the minimal-change scope.)_ Two near-duplicate `MockServerResponse` classes (`fetch-create-negotiated-error-handler.ts:14-49`, `fetch-html-error-handler.ts:12-221` — the latter ~210 lines of stubs) exist solely to run node handlers in fetch runtimes. Native fetch formatters (the unused `sendFetchJson` was clearly the plan) would cut bundle size and indirection for edge/workers, the runtimes these subpaths advertise.
- ✅ **[FIXED]** **`ts-japi` and `jstoxml` load eagerly for every consumer.** `create-negotiated-error-handler.ts` statically imports all formatters, so a JSON-only API still parses the full JSON:API serializer and XML library at startup. Dynamic `import()` inside the matching `case` arms would shrink cold start on Cloudflare/Deno.

#### Feature gaps

- **No developer HTML error page (vs youch / whoops / Laravel Ignition).** Keywords claim `whoops`, `youch`, `code-frame`, `source-code-preview`, yet `src/error-handler/html-error-handler.ts:52-86` renders only `statusCode` + reason phrase — no stack, no code frame, no solution hints, even with `showTrace: true`. The CLI handler (`src/handler/cli-handler.ts` via `shared/utils/cli-error-builder`) already has `renderError` + solution finders; users hitting `/error` in a browser during development get a blank "500 Internal Server Error" card where youch shows a full inspector.
- **Fetch negotiation parses q-values but never uses them.** `fetch-create-negotiated-error-handler.ts:67-131` collects `quality` only to drop `q=0` entries; ordering is purely server preference, so `Accept: text/html;q=0.1, application/json` returns HTML. The node path (`@tinyhttp/accepts`) honors q-values, so the two runtimes negotiate differently for the same header — sort accepted types by quality before matching.
- **No one-line Express/Connect error-middleware adapter.** The README's Express example wraps every route in try/catch; competitors plug in once via `app.use((err, req, res, next) => ...)`. A `createErrorMiddleware(options)` export would remove the boilerplate users will otherwise hand-roll.

#### Security

- ✅ **[FIXED]** **Stack traces exposed by default (low).** `node-handler.ts:19` / `fetch-handler.ts:16` default `showTrace` to `true`, and `create-negotiated-error-handler.ts:94-97` then sets `expose = true` on any plain `Error`, so JSON/text/XML/JSONP bodies include `error.stack` unless the consumer remembers to opt out per environment. Production-leaning default (or `NODE_ENV`-derived) would be safer; it is documented, hence low.
- ✅ **[FIXED]** **JSONP hardening gaps (low).** `src/error-handler/jsonp-error-handler.ts:44-49` correctly restricts the callback to a 64-char identifier path (good), but unlike Express's `res.jsonp` it sends no `X-Content-Type-Options: nosniff` header and no `/**/` prologue on the `application/javascript` response.

---

## @visulima/inspector — `packages/error-debugging/inspector`

> @visulima/inspector is a loupe-style, cross-runtime (Node + browser) util.inspect replacement with solid per-type test coverage, but it ships four documented-yet-dead options, crashes on hostile `Symbol.toStringTag` values and throwing getters, and renders ArrayBuffer/DataView/Generator as empty strings.

#### DX improvements

- ✅ **[FIXED]** **Four options are typed, defaulted, and partially documented but never read.** `breakLength`, `maxArrayLength`, `showHidden`, `showProxy` exist in `src/types.ts:15-23` and get defaults in `src/index.ts:212-220`, but no code in `src/` ever reads them (verified by grep; `inspect([1..6], { maxArrayLength: 2 })` prints all 6 elements). `breakLength` is even documented in `README.md`. Either implement them (util.inspect parity) or delete them — silently ignored options are worse than missing ones.
- ✅ **[FIXED]** **README API section covers 4 of 11 options and omits the extension API.** `README.md` stops at `options.indent`; the working options `truncate`, `quoteStyle`, `numericSeparator`, `stylize` are undocumented, and the public exports `custom`, `registerConstructor`, `registerStringTag` (`src/index.ts:275-296`) — the package's headline extensibility feature per its own `CLAUDE.md` — appear nowhere in the README. `Options` fields in `src/types.ts` also lack JSDoc, so editor hover gives consumers nothing.

#### Optimizations

- ✅ **[FIXED]** **`inspect-list` allocates a throwaway truncation string per element, even when truncation is off.** `src/utils/inspect-list.ts:39` builds `` `${TRUNCATOR}(${String(list.length - index)})` `` on every iteration; with the default `truncate: Infinity` (the common path via pail), inspecting a 10k-element array allocates 10k strings that are always discarded. Hoist the computation behind a `Number.isFinite(originalLength)` check.
- ✅ **[FIXED]** **`inspectArray` materializes every index key just to find non-index props.** `src/types/array.ts:20` does `Object.keys(array).slice(array.length)` — for a large array this allocates the full string key list (N strings) and immediately slices them away. A reverse scan or `for...in` with an index check avoids the O(N) garbage.

#### Feature gaps

- **`ArrayBuffer`, `DataView`, and `Generator` render as empty string.** `src/index.ts:30,37,48` map them to `() => ""`, so `inspect(new ArrayBuffer(8))` returns `""` and `inspect({ buf: new ArrayBuffer(8) })` shows `{ buf:  }`. util.inspect prints `ArrayBuffer { [Uint8Contents]: ..., byteLength: 8 }`; object-inspect at least tags the type. User story: anyone logging binary/protocol objects via pail gets blank fields.
- ✅ **[FIXED]** **Getters are invoked unguarded, so a throwing getter crashes inspect.** `src/types/object.ts:57` (`object[key]` in the `.map()`) — verified `inspect({ get x() { throw new Error("boom") } })` throws. util.inspect prints `[Getter]` without invoking by default and offers `getters: 'get'` with `<Inspection threw>` fallback. For a library whose main consumer is a logger, the inspector must never throw on the value it is asked to render; wrap property reads in try/catch and emit a placeholder.

#### Security

- ✅ **[FIXED]** **Medium — type-dispatch maps inherit from `Object.prototype`, letting hostile `Symbol.toStringTag` values crash or corrupt output.** `baseTypesMap` (`src/index.ts:26`) and `stringTagMap` (`src/index.ts:23`) are plain object literals, and dispatch is an inherited-property lookup (`baseTypesMap[type]` at `src/index.ts:157`, `stringTagMap[type]` at `src/index.ts:115`). Verified against the built dist: `inspect({ [Symbol.toStringTag]: "valueOf" })` throws an uncaught `TypeError: Cannot convert undefined or null to object`, and `"toString"` yields the bogus output `[object Undefined]`. Since `@visulima/pail` uses this package to render arbitrary logged values, inspecting attacker-shaped input (e.g. a deserialized payload included in an error log) is a denial-of-service on the logging path. Fix: create both maps with `Object.create(null)` (or use `Map`) and guard lookups with `Object.hasOwn`; this also unblocks `registerStringTag("toString", ...)`, which currently returns `false` because the `in` check at `src/index.ts:289` sees inherited keys.

---

## @visulima/ono — `packages/error-debugging/ono`

> @visulima/ono renders Shiki-highlighted HTML error pages and ANSI terminal output from JS errors (a Youch/whoops competitor); the code is well-sanitized and broadly tested, but it ships a silent code-frame failure for CJS paths, cookie-masking gaps in the request-context panel, and stale README/peer-dependency metadata.

#### DX improvements

- ✅ **[FIXED]** **Code frames silently broken for CJS stack traces.** `shared/utils/get-file-source.ts:9` rejects anything not matching `^(?:http|https|file|data):`, but CommonJS Node stacks emit plain absolute paths (`/app/index.js`), so `packages/error-debugging/ono/src/error-inspector/components/stack-trace-viewer/index.ts:51` renders "Unable to load source code" for every frame in CJS apps. Accept plain absolute paths via `readFile` too.
- ✅ **[FIXED]** **README documents APIs that don't exist.** `README.md:498` describes `openInEditor(request, options)` "uses `open-editor` under the hood" — the actual exports are `createOpenInEditorMiddleware`/`createNodeHttpHandler`/`createExpressHandler` backed by `launch-editor-middleware` (`src/server/open-in-editor.ts:53,214,220`). `open-editor` only appears in `peerDependenciesMeta` (`package.json:165-167`) with no matching `peerDependencies` entry and is never imported.
- ✅ **[FIXED]** **Unused AI peer dependencies.** `ai` + five `@ai-sdk/*` packages are declared as optional peers (`package.json:138-145`) but nothing in `src/` imports them — the only AI touchpoint is `aiPrompt` from `@visulima/error/solution/ai/prompt`, a pure string builder. The AI finder peers belong to `@visulima/error`; dropping them here removes installer peer-resolution noise. Also `"ai": "^6.0.175"` is hard-pinned while every sibling uses `catalog:peer`.
- ✅ **[FIXED]** **Cloudflare Workers runtime detection is a broken find/replace.** `src/utils/runtimes.ts:17-19` checks `userAgent === "Cloudono-Workers"` (and links `developers.cloudono.com`) — should be `"Cloudflare-Workers"`, so the runtime badge never detects workerd.
- ✅ **[FIXED]** **Stateless class forces instantiation.** `Ono` has two methods both annotated `// eslint-disable-next-line class-methods-use-this` (`src/index.ts:19,31`); exporting standalone `renderHtml`/`renderAnsi` functions (or static methods) would be more ergonomic and tree-shake-friendly.

#### Optimizations

- ✅ **[FIXED]** **Per-frame source loading is fully sequential.** `src/error-inspector/components/stack-trace-viewer/index.ts:47-133` awaits `getFileSource` and `getHighlighter`/`codeToHtml` inside a `for` loop over all stack frames; a 30-frame stack pays serial disk reads + highlighting. Build the frames with `Promise.all` and join in order.
- ✅ **[FIXED]** **Duplicate client scripts shipped on every page.** `copyToClipboard`/`showCopySuccess` are defined twice verbatim (`src/error-inspector/index.ts:48-78` in `copyDropdownScript` and again at `:261-305` in `copyButtonScript`), plus leftover debug logging (`console.log('Copy dropdown: Click detected…')` at `:141`, `:196`) inflates the inlined HTML and noisily logs in consumer consoles.
- ✅ **[FIXED]** **First stack frame's source is fetched three times per render** — `error-card/index.ts:54`, `error-card/solutions.ts:55`, and the stack viewer all call `getFileSource` for the same file (the shared cache mitigates, but it's an unbounded module-level `Map` in `shared/utils/get-file-source.ts:4` that never evicts in long-running dev servers).

#### Feature gaps

- **No `toJSON()` output.** Youch (the closest competitor, listed in `package.json` keywords) ships `toJSON()` for SPA/REST error payloads; `Ono` only offers `toHTML`/`toANSI` (`src/index.ts:20,32`). User story: an API server wants the same parsed frames/causes/solutions as structured JSON for its error response when `Accept: application/json`.
- **No source-map resolution.** Frames pointing at built output (`dist/*.js`) render the transpiled code; Youch and modern overlays map back to original TS/JSX via sourcemaps. Nothing in `src/error-inspector/components/stack-trace-viewer/` consults sourcemaps.

#### Security

- ✅ **[FIXED]** **Cookie masking bypass (medium).** `SENSITIVE_HEADER_PATTERNS` masks `cookie` in the headers table (`src/error-inspector/page/create-request-context.ts:19`), but `buildCurl` re-injects the raw parsed cookie values: the guard `!headersForCurl["cookie"]` at `:340` is case-sensitive, so a `Cookie`-cased record header gets its `[masked]` value overwritten with real session tokens in the copyable cURL. Independently, the Cookies panel always embeds the full raw cookie jar in a hidden input (`:703`) regardless of `maskValue`/denylist — contradicting the README's "smart data sanitization and masking" claim for pages that may be reachable in staging.
- ✅ **[FIXED]** **SSRF via stack-frame URLs (low).** `shared/utils/get-file-source.ts:31` does a server-side `fetch(file)` for any `http(s):` frame path taken from the error's stack string. If an attacker can influence stack contents (re-thrown errors, eval'd code, client-reported errors), the renderer issues requests to arbitrary/internal URLs. Consider gating remote fetch behind an opt-in.
- ✅ **[FIXED]** **Unredacted request bodies (low).** `readRequestBody` captures up to 64KB of POST bodies (`src/error-inspector/page/create-request-context.ts:147-256`) and embeds them in the page and the cURL `--data` flag; header masking never applies to body fields, so login passwords/tokens in JSON bodies land verbatim in the rendered HTML.

---

## @visulima/pail — `packages/error-debugging/pail`

> @visulima/pail is a universal (Node/Edge/browser) logger with processors, reporters, middleware, and wide-events; it is feature-rich with broad test coverage, but ships two real correctness bugs (level-name mismatch in stream routing, scope() mutating instead of cloning) and a serious non-TTY hot-path cost in the pretty reporter.

#### DX improvements

- ✅ **[FIXED]** **Severity routing is broken by a level-name mismatch.** Reporters route on `["error", "trace", "warn"].includes(logLevel)`, but pail's levels are RFC 5424 names — `warning`, `critical`, `alert`, `emergency` (`src/constants.ts:17-27`); `"warn"` is a _type_, never a level. Result: warning/critical/alert/emergency output lands on **stdout**, and `"warn"` in the list is dead code. See `src/reporter/pretty/pretty-reporter.server.ts:305`, `src/reporter/simple/simple-reporter.server.ts:99`, and the browser equivalent `src/utils/write-console-log-based-on-level.ts:14` (`level === "warn"` is never true, so warnings use `console.log`).
- ✅ **[FIXED]** **`scope()` mutates the logger but is documented as returning a new instance.** `README.md` (Scoped Loggers, ~line 257) and the JSDoc promise "a new pail instance", but `src/pail.browser.ts:467-475` (and `src/pail.server.ts:138-146`) does `this.scopeName = name.flat()` and returns `this` — `const outer = global.scope("outer")` silently re-scopes `global`, and nested scopes replace rather than extend. The README's own example misbehaves. Either clone (like `child()`) or fix the docs; note `name.flat()` on a `string[]` is also a no-op.
- ✅ **[FIXED]** **`wrapException()` is irreversible and stacks listeners.** Each call adds new `uncaughtException`/`unhandledRejection` handlers with no stored references and no `restoreException()` counterpart (`src/pail.browser.ts:329-345`), unlike `wrapConsole()`/`restoreConsole()`.
- ✅ **[FIXED]** **Invalid log levels silently fall back to `debug` — the most verbose level.** `PAIL_LOG_LEVEL` is cast unchecked (`src/index.server.ts:79-81`) and `#normalizeLogLevel` returns `"debug"` for any unknown value (`src/pail.browser.ts:852-854`), so a typo like `PAIL_LOG_LEVEL=warn` floods output instead of warning the user (it also treats a custom level mapped to `0` as invalid via truthiness).
- ✅ **[FIXED]** **Duplicate integration test dirs, one a typo.** Both `__tests__/integration/package.test.ts` and `__tests__/intigration/package.test.ts` are git-tracked and have drifted apart (different helpers and assertions). Merge into `integration/` and delete the typo dir.

#### Optimizations

- ✅ **[FIXED]** **`terminalSize()` runs on every log line and can shell out synchronously.** `src/reporter/pretty/pretty-reporter.server.ts:150` calls `terminal-size` per `_formatMessage`; when stdout/stderr aren't TTYs and `COLUMNS`/`LINES` are unset (CI, pipes, Docker), the package falls back to `execFileSync("tput", ...)` twice per call with a 500 ms timeout — a sync child process per log line. Cache the size once and refresh on `process.stdout.on("resize")`.
- ✅ **[FIXED]** **Throttle dedup serializes the full payload twice per log call.** `src/pail.browser.ts:1023` builds a `JSON.stringify` signature of `[label, scope, type, message, prefix, suffix, context]` for comparison, then `resolveLog` re-stringifies the identical tuple at line 1005. Compute once per call; for large contexts this doubles a already-heavy hot-path cost.
- ✅ **[FIXED]** **Longest badge/label recomputed per message.** `getLongestBadge`/`getLongestLabel` iterate all logger types on every `_formatMessage` (`src/reporter/pretty/pretty-reporter.server.ts:179,186`); types are fixed after `setLoggerTypes`, so both can be cached there (the core logger already caches `longestLabel` — the reporter just doesn't use it).

#### Feature gaps

- **No `flush()`/`close()` lifecycle for buffered reporters.** `AbstractHttpReporter` batches up to 100 entries / 5 s (`src/reporter/http/abstract-http-reporter.ts:207-213,236-237`) but exposes no public flush or dispose, and `JsonFileReporter` never ends its stream (`src/reporter/file/json-file-reporter.ts`). On process exit the tail of the log batch is silently lost — pino (`flush`, transport `end`) and winston (`logger.end`) both solve this. User story: "my serverless function exits before the last batch ships."
- **HTTP batch queue is unbounded when the endpoint is down.** `batchQueue` grows without a cap or drop policy while retries back off (`src/reporter/http/abstract-http-reporter.ts:331-356`); long outages mean unbounded memory growth. Competitors (datadog/winston transports) cap buffer size with drop-oldest semantics.
- **`Retry-After` handling only supports the seconds form, uncapped.** `Number.parseInt(retryAfter, 10) * 1000` (`src/reporter/http/utils/retry.ts:126`) yields `NaN` for the HTTP-date form — `setTimeout(resolve, NaN)` fires immediately, defeating rate-limit respect — and a server-supplied huge value stalls the pipeline indefinitely. Parse both forms and clamp to a max delay.

---

## @visulima/source-map — `packages/error-debugging/source-map`

> Thin, well-tested wrapper around @jridgewell/trace-mapping whose only original code is the sync loadSourceMap() file loader; overall healthy, with one real correctness bug (file: URLs) and a few ergonomics/perf gaps.

#### DX improvements

- ✅ **[FIXED]** **`file:` sourceMappingURL is broken end-to-end** — `packages/error-debugging/source-map/src/load-source-map.ts:53-57` deliberately exempts `file:` URLs from the "remote URL → skip" guard, but then passes the URL string to `resolve(sourcePath, url)`, producing a mangled path like `/dir/file:/abs/map.js.map`. The subsequent `readFileSync` throws a misleading ENOENT. Convert with `fileURLToPath(url)` instead (the inverse, `pathToFileURL`, is already used at line 99). The test suite has no `file:` URL case, which is why this survives.
- ✅ **[FIXED]** **`enhanceError` destroys error identity** — `src/load-source-map.ts:16-21` rethrows a bare `new Error(message)`, discarding the original stack, the `cause`, and `err.code` (consumers can no longer do `code === "ENOENT"`), and read-vs-parse failures are only distinguishable by string-prefix matching. Use `new Error(msg, { cause: error })` or typed error classes.
- ✅ **[FIXED]** **Undocumented undefined/throw semantics + stale README** — `loadSourceMap` has zero JSDoc; nothing documents that it _throws_ on read/parse errors but _silently returns undefined_ for missing comments, `http(s)` maps, and non-base64 `data:` URLs (`src/load-source-map.ts:47-55`). The README usage example (`README.md:62-67`) shows `source: "your_path/src/index.js"`, but the package's own test (`__tests__/load-source-map.test.ts:64`) shows external maps resolve `source` to a `file://` URL. The `## Related` section (`README.md:74`) is empty, and the ~13 re-exported trace-mapping functions (`src/index.ts:27-41`) are never listed.

#### Optimizations

- ✅ **[FIXED]** **Full-file line split to find one trailing comment** — `src/load-source-map.ts:24-31` does `sourceFile.split(/\r?\n/)` (allocating an array of every line of a potentially multi-MB minified bundle) and then regex-execs _every_ line from the end; for files with no sourcemap comment that is a regex pass over the entire file. A `sourceFile.lastIndexOf("sourceMappingURL=")` pre-seek (or scanning only a trailing slice) avoids both the allocation and the per-line regex in the common cases.

#### Feature gaps

- **No in-memory input** — the only entry point takes a filesystem path (`src/load-source-map.ts:66`). Competing `convert-source-map` offers `fromSource` / `fromMapFileSource` / `fromObject`; bundler plugins and error overlays that already hold transformed code in memory must round-trip through disk here. A `loadSourceMapFromSource(code, sourceDir)` split of the existing logic would be nearly free.
- **Sync-only API** — `readFileSync` at `src/load-source-map.ts:70` and `:92`. Server-side stack remapping (the `@visulima/error` use case) blocks the event loop per frame file; a promise-based `loadSourceMap` twin using `fs/promises` is the expected modern shape.
- **Remote maps silently dropped with no escape hatch** — `src/load-source-map.ts:52-55` returns `undefined` for `http(s)` sourceMappingURLs. `source-map-support`-class tools let users fetch remote maps; an optional resolver/fetch hook parameter (or at minimum documenting the silent skip) would cover CDN-served bundles.

#### Security

- ✅ **[FIXED]** **Low — quadratic ReDoS in the block-comment branch of `SOURCEMAP_REGEX`** — `src/load-source-map.ts:10-11` carries explicit `regexp/no-super-linear-backtracking` / `sonarjs/slow-regex` suppressions. The `([^*]+?)[ \t]*\*\/[ \t]*$` portion is O(n²) on a line such as `/*# sourceMappingURL=` followed by thousands of spaces with no closing `*/`, because the lazy group and `[ \t]*` overlap on whitespace. Exposure is limited (input is a local file the consumer chooses to load), but error-tooling does get pointed at untrusted artifacts; a linear scan or non-overlapping rewrite (e.g. `([^*\s][^*]*?)`-style separation, or string search per the repo's prior CodeQL ANSI-regex fix) removes the suppressions entirely.

---

## @visulima/vite-overlay — `packages/error-debugging/vite-overlay`

> Vite dev-server plugin that replaces the built-in error overlay with a source-map-aware, solution-hinting UI; feature-rich and well-tested (unit + Playwright e2e) but carries a per-error memory/CPU leak in the solution-finder pipeline, an inverted ranking bug in its file-suggestion engine, and several DX rough edges (unexported option types, typo'd option name).

#### DX improvements

- ✅ **[FIXED]** **Public option types are not exported** — `OverlayConfig`, `BalloonConfig`, `BalloonPosition` live in `packages/error-debugging/vite-overlay/src/types.ts` but `src/index.ts` exports only the default plugin function; `dist/index.d.ts` declares `interface OverlayConfig` without `export`. Users cannot type a shared config object or a custom balloon helper. Export the options interface (currently an anonymous inline type on `errorOverlayPlugin`) plus the overlay/balloon types, and re-export `SolutionFinder`.
- ✅ **[FIXED]** **File-suggestion engine has two correctness bugs** — in `src/utils/create-vite-solution-finder.ts`: (1) line 199-204 computes `score = relevanceScore * 0.7 + pathDistance * 0.2 + nameDistance * 0.1` (relevance is higher-is-better, distances lower-is-better) then sorts **ascending**, so the most relevant candidates rank last; (2) `findSimilarFiles` always returns at least `<ul></ul>` (line 228-231), so the `if (suggestions)` guard at line 390 is always truthy and the "Missing React Plugin"/"Missing Vue Plugin" fallback hints (lines 397-409) are dead code.
- ✅ **[FIXED]** **Solution-finder failures are swallowed silently** — `src/index.ts:201-203` does `catch { continue; }` around custom finder execution; a buggy user-supplied finder just never fires with no diagnostic. Log the finder name + error via the dev logger (at least under `DEBUG`).
- ✅ **[FIXED]** **Typo'd public option `showBallonButton`** ("Ballon") — `src/index.ts:614,714`. It is the deprecated path, but the typo is still the documented working spelling; add a correctly-spelled alias before v2 stable locks it in.

#### Optimizations

- ✅ **[FIXED]** **`solutionFinders` array grows by 3 entries per error** — `findSolution` (`src/index.ts:158`) does `solutionFinders.push(errorHintFinder, createViteSolutionFinder(rootPath), ruleBasedFinder)` on the same array instance captured once in `setupWebSocketInterception`/`setupHMRHandler` (`src/index.ts:687-689`). Every displayed error permanently appends duplicates, so later errors iterate an ever-growing finder list (each duplicate vite finder can trigger a project-tree walk). Build the merged list once, or spread into a local array.
- ✅ **[FIXED]** **Sync recursive `readdirSync` walk on the dev-server event loop** — `collectFileCandidates` (`src/utils/create-vite-solution-finder.ts:133-177`) walks the project tree to depth 4 with sync fs calls inside `server.ws.send` interception; on large monorepos this blocks HMR for every import-resolution error. Use `fs.promises`/`opendir` and cache directory listings between errors.
- ✅ **[FIXED]** **Overlay fetches Google Fonts from the network** — `src/overlay/patch-overlay.ts:300-302` injects `fonts.googleapis.com` `<link>` tags into every dev page. Breaks the overlay typography offline/air-gapped and phones home from a dev tool; bundle a system font stack or inline the woff2 like the rest of the assets (icons/CSS are already inlined).

#### Feature gaps

- **Svelte/Preact/Solid framework detection missing** — only React and Vue plugins are auto-detected (`hasReactPlugin`/`hasVuePlugin`, `src/index.ts:558-590`), yet the package ships `examples/vite-svelte`, `vite-preact`, `vite-solidjs` and lists `svelte` in `package.json` keywords. Framework-aware hints (e.g. hydration messages routed by `framework`) silently degrade for those users; add detection for `vite-plugin-svelte`, `@preact/preset-vite`, `vite-plugin-solid` or accept a `framework` option.
- **Global `unhandledRejection` capture is not configurable** — `src/index.ts:693` registers a process-wide handler that converts every server-side unhandled rejection into an overlay payload, changing Node's default crash semantics for the whole dev process (including rejections from unrelated tooling). Competing overlays leave server faults alone; offer an `interceptUnhandledRejection?: boolean` opt-out.

#### Security

- ✅ **[FIXED]** **Low — unsanitized error-derived HTML reaches `innerHTML`** — solution bodies interpolate raw text from error messages, e.g. `` `The import path \`${importPath}\`...` `` (`src/utils/create-vite-solution-finder.ts:392`), are run through `marked` which preserves raw HTML (`src/index.ts:192-198`), then injected via `solutionsContainer.innerHTML = html` (`src/overlay/client/runtime.js:1114`). A crafted import specifier or error message can inject markup/script into the dev origin (which can reach `/@fs` URLs). Dev-only and attacker needs influence over compiled error text, hence low; escape interpolated values or sanitize the parsed HTML.
- ✅ **[FIXED]** **Low — backtracking-prone regexes on client-supplied stacks** — `AT_BARE_FRAME_RE` (`src/index.ts:31-32`) and the `LOC_*` patterns (`src/utils/stack-trace.ts:19-26`) carry explicit `sonarjs/slow-regex` / `regexp/no-super-linear-backtracking` suppressions and execute server-side on stack strings received verbatim from the browser via the HMR channel (`setupHMRHandler`). A pathological single-line "stack" (e.g. long `a:a:a:...`) can stall the dev server. Bound line length before matching or rewrite the patterns linearly (see the repo's prior CodeQL ReDoS guidance).

---

# Filesystem

## @visulima/find-cache-dir — `packages/filesystem/find-cache-dir`

> Tiny, well-tested utility that resolves node_modules/.cache/<name> (a fork of sindresorhus' find-cache-dir); code is healthy and simple, but the async API secretly does sync I/O, the Options type is not exported, and the README has several factual errors.

#### DX improvements

- ✅ **[FIXED]** **`Options` type is not exported** — `src/index.ts:10-14` declares `Options` locally; consumers wrapping `findCacheDir` cannot import the options shape and must re-type `{ create?, cwd?, throwError? }` by hand. Export it (and consider a named `FindCacheDirOptions`).
- ✅ **[FIXED]** **No JSDoc on the public API** — `src/index.ts:111-113` exports two bare typed consts with zero doc comments, so editors show no hover help for `name`, `create`, `throwError`, or the `CACHE_DIR` override behavior. The lookup-order rules (documented only in `CLAUDE.md`) belong on the functions.
- ✅ **[FIXED]** **README factual errors** (`README.md`):
    - Lines 58/62/72/76: example output is `'/Users/test/Library/node_mdules/.cache/my-app'` — typo (`node_mdules`) and an implausible path.
    - Line 70: the CJS example calls `findCacheDir("my-app")` without awaiting — it returns a `Promise<string | undefined>`, so the logged value would be a Promise.
    - Line 94: `cwd` is documented as `string` but the type accepts `URL | string` (`src/index.ts:12`).
    - Line 111: `throwError` says "if a `.cache` folder can't be found", but it actually throws only when no ancestor `package.json` exists (`src/index.ts:34-40`).
- ✅ **[FIXED]** **Unhelpful error message** — `src/index.ts:36/79` throws `NotFoundError("No such file or directory found.")` without saying what was searched for or from where. Something like `No package.json found upwards from '${cwd}'` would make failures self-explanatory.

#### Optimizations

- ✅ **[FIXED]** **Sync I/O inside the async API** — `useDirectory` (`src/index.ts:16-22`) calls `ensureDirSync` and is used by the async `findCacheDirectory` (lines 26, 64), blocking the event loop on `create: true`. `@visulima/fs` already exports an async `ensureDir`; the async path should use it.
- ✅ **[FIXED]** **Up to 6 sequential stat calls in the common case** — `src/index.ts:52-62` always probes all three levels with two `isAccessible` calls each, even when `node_modules/.cache/<name>` already exists and is writable (the by-far common warm-cache case, which could return after a single check). Reordering to "if target exists: return writable ? path : undefined" cuts the hot path to 1-2 fs calls and also fixes the edge case where a writable existing `<name>` dir is rejected because a parent lost the W_OK bit.

#### Feature gaps

- **No `thunk` option (upstream parity)** — sindresorhus' `find-cache-dir` supports `thunk: true`, returning `(...paths) => string` so tools can do `thunk('manifest.json')` without re-joining. This is the most used option in bundler-plugin code that this package targets; `src/index.ts` only returns a plain string.
- **No `files` option (upstream parity)** — upstream resolves the closest common ancestor of a set of files before walking up; useful for monorepo tools that want the cache near the workspace package owning the processed files, not near `process.cwd()`.
- **No global cache fallback** — when no writable `node_modules` exists (read-only installs, pnpm global tools, CI images), the package just returns `undefined`. An opt-in fallback to the OS user cache dir (XDG `$XDG_CACHE_HOME`, à la `cachedir`/`env-paths`) would make it strictly more useful than upstream rather than a re-implementation.

#### Security

- No findings. The only externally influenced inputs are `CACHE_DIR` (caller's own environment) and `name` (caller-supplied constant, joined unsanitized at `src/index.ts:26/46` — worth a note in JSDoc that `name` should not contain path separators, but it is not an exploitable boundary).

---

## @visulima/fs — `packages/filesystem/fs`

> @visulima/fs is a broad, well-tested (49 test files + benches) fs-extra-style toolkit with clean subpath exports and optional parser peers, but it ships one real correctness bug (followSymlinks drops all symlinks), several misleading error/option semantics, and a predictable temp-file write pattern.

#### DX improvements

- ✅ **[FIXED]** **`walk` `followSymlinks: true` silently drops every symlink (correctness bug).** In `src/find/walk.ts:119-144`, after `path = await realpath(path)` the code still branches on the original dirent's `entry.isDirectory()` / `entry.isFile()` — both `false` for a symlink — so symlinked directories are never recursed and symlinked files never yielded. The Deno source this was ported from re-stats the resolved path. Same bug in `src/find/walk-sync.ts:117`. Once fixed, also add cycle detection (visited realpath set) to avoid infinite recursion on self-referencing links.
- ✅ **[FIXED]** **`readFile` error semantics are inverted and misleading.** A nonexistent file throws `PermissionError("unable to read the non-accessible file")` (`src/read/read-file.ts:68-70`) while a genuinely unreadable file throws a bare `Error` (`:72-74`) — even though the package ships `NotFoundError` and `PermissionError` in `src/error/`. Missing file should be `NotFoundError`; permission denial should be `PermissionError`.
- ✅ **[FIXED]** **`WriteFileOptions.overwrite` docs and behavior disagree.** `src/types.ts:298` documents `Default: false`, but `src/write/write-file.ts:44-50` defaults it to `true`; and `overwrite: false` doesn't prevent overwriting — it renames the existing file to `${path}.bak` and writes anyway (`:75-82`). Either honor the name (throw `AlreadyExistsError`) or rename the option to `backup`.
- ✅ **[FIXED]** **`remove`/`removeSync` swallow every error.** Both the `unlink` and the `rm` call are wrapped in empty catches (`src/remove/remove.ts:39-49`, `src/remove/remove-sync.ts`), so `EACCES`/`EBUSY` failures look like success. `rm` already gets `force: true` (ENOENT-safe) from `src/remove/utils/build-rm-options.ts` — real errors should propagate like fs-extra's `remove`.
- ✅ **[FIXED]** **README is a 6,493-line generated API dump.** Curated usage ends around line 460 of `README.md`; the rest is concatenated typedoc. A short per-subpath quickstart (`/yaml`, `/jsonc`, `/glob`, `/size`) and an fs-extra migration table would serve consumers far better than the inline dump.

#### Optimizations

- ✅ **[FIXED]** **`size.ts` buffers whole files while claiming to stream.** `src/size.ts:117` does `Readable.from(await readFile(path))` under a comment saying "we create a readable stream to process them in chunks" — the entire file is loaded into memory before being re-chunked. Use `createReadStream(path)` for true O(chunk) memory on large files.
- ✅ **[FIXED]** **`readFile` issues two `access()` pre-flight syscalls per read.** `src/read/read-file.ts:68-74` calls `isAccessible` twice (F_OK then R_OK) before `nodeReadFile`, tripling syscalls on the hot path and introducing a TOCTOU window; the trailing `.catch((error) => { throw error; })` (`:91-93`) is a no-op. Just read and map the thrown errno to the right error class.
- ✅ **[FIXED]** **`remove` always runs both `unlink` and `rm`.** For a plain file the `rm` call is a wasted syscall (path already gone, `force: true` masks it); for a directory the `unlink` always fails first (`src/remove/remove.ts:39-49`). A single `rm` with `force + recursive` covers both cases.

#### Feature gaps

- **No `copy`/`copySync`.** The package mirrors fs-extra (`ensure*`, `move`, `remove`, `emptyDir`, `readJson`/`writeJson`) but lacks its single most-used API. User story: "I `move()`d my build output with @visulima/fs; now I need to copy a template dir with an overwrite flag and a filter callback and have to install fs-extra anyway." A `copy(src, dest, { overwrite, filter, dereference })` built on `node:fs.cp` would complete the parity story (`src/index.ts` has no copy export).

#### Security

- ✅ **[FIXED]** **Predictable temp/backup paths in atomic `writeFile`** (low). `src/write/write-file.ts:58` always writes to fixed `${path}.tmp` (and `:81` to `${path}.bak`). Two concurrent writers to the same target corrupt each other's temp file, and in a shared-writable directory an attacker can pre-create `${path}.tmp` as a symlink so the content is written through it (`nodeWriteFile` with flag `"w"` follows symlinks) before the rename. `write-file-atomic` solves this with per-pid/random temp suffixes plus `O_EXCL`-style creation; the same pattern applies here and in `write-file-sync.ts`.

---

## @visulima/path — `packages/filesystem/path`

> @visulima/path is a pathe-derived, always-POSIX drop-in replacement for node:path with zero runtime deps and a clever lazy-inlined zeptomatch for matchesGlob; the core is solid and well-tested (~950 test lines), but it has two confirmed behavioral divergences from node:path and a README that misdescribes the package.

#### Correctness / DX improvements

- ✅ **[FIXED]** **`format()` produces `"undefined"` in output** — `packages/filesystem/path/src/path.ts:337` builds `(pathObject.name as string) + (pathObject.ext as string)` with no `?? ""` fallback. Verified at runtime: `format({ dir: "/a", name: "foo" })` → `"/a/fooundefined"` (Node returns `/a/foo`). Tests only cover objects where both `name` and `ext` are present (`__tests__/unit/path.test.ts:135-145`). One-line fix: `(pathObject.name ?? "") + (pathObject.ext ?? "")`.
- ✅ **[FIXED]** **`basename(p, ext)` returns `""` when the extension equals the whole basename** — `packages/filesystem/path/src/path.ts:349-357`; `basename("test.html", "test.html")` → `""` while Node returns `"test.html"`. Inherited from pathe, but for a package marketed as "drop-in replacement" this divergence should be fixed or documented.
- ✅ **[FIXED]** **README contradicts the code in three places** — `packages/filesystem/path/README.md`: (1) shows CommonJS `require()` usage, but the package is ESM-only (`"type": "module"`, exports without `require`, attw run with `--profile esm-only`); (2) says "Note: path.win32 and path.posix are not exported" while `src/index.ts:26-27` exports both (aliased to the POSIX impl); (3) the Why section says "pathe is providing identical exports…" — leftover copy-paste naming the competitor instead of this package.
- ✅ **[FIXED]** **`delimiter` docs contradict implementation** — `packages/filesystem/path/CLAUDE.md` states "`delimiter` — it is the POSIX `:` everywhere", but `src/path.ts:54` makes it platform-dependent (`;` on Windows). One of the two is wrong; given downstream code (e.g. PATH splitting in this monorepo) relies on the documented invariant, this needs reconciling.
- ✅ **[FIXED]** **package.json keywords are wrong** — `packages/filesystem/path/package.json:5-15` lists `array`, `binary`, `json`, `list`, `extension(s)` — leftovers from another package; hurts npm discoverability. Should be `path`, `posix`, `windows`, `pathe`, `upath`, `normalize`, etc.

#### Optimizations

- ✅ **[FIXED]** **`basename`/`dirname` allocate a full segment array per call** — `src/path.ts:323-331` (`split("/").slice(0,-1).join("/")`) and `src/path.ts:350` (`split("/").pop()`). Node uses index scanning (`lastIndexOf`). These are the hottest functions in the package (`@visulima/fs` routes all path math through here); a `lastIndexOf("/")` rewrite removes 2–3 array allocations per call with no behavior change.
- ✅ **[FIXED]** **`relative()` is O(n²) on common-prefix length** — `src/path.ts:303-312` copies `splitFrom` then calls `splitFrom.shift()`/`splitTo.shift()` per shared segment (each shift is O(n)). A simple index counter plus `slice(i)` is linear and drops the `fromCopy` allocation.

#### Feature gaps

- **No extension-manipulation helpers** — upath (named in the README's own Related section) ships `changeExt`, `addExt`, `trimExt`, `removeExt`, `defaultExt`. User story: a build tool rewriting `foo.ts` → `foo.js` currently needs `join(dirname(p), basename(p, extname(p)) + ".js")`. These fit naturally in `@visulima/path/utils`.
- **No POSIX→Windows converter despite documenting the workaround as load-bearing** — the package's own `CLAUDE.md` tells consumers to hand-roll `posixPath.replace(/\//g, "\\")` to produce native Windows paths, and `normalizeWindowsPath` (`src/normalize-windows-path.ts`) is internal-only. Exporting `toWindowsPath()`/`toNativePath()` (and `normalizeWindowsPath`) from `/utils` would eliminate the most common foot-gun for users of an always-POSIX path lib.

#### Security

- No concrete issues found. All regexes (`src/path.ts:26-33`, `src/utils.ts:23,142,144`) are linear or bounded on path-shaped input; `normalizeAliases` builds objects via `Object.fromEntries` (own-property defines), so `__proto__` keys in user-supplied alias maps do not pollute the prototype.

---

# Storage

## @visulima/storage — `packages/storage/storage`

> Server-side file-storage abstraction (Files facade + BaseStorage adapters with TUS/multipart/REST handlers across 23 providers); architecture and test breadth (103 test files) are strong, but it ships a silent absolute-URL bug in Node handlers, a memory-hungry local ranged read, and a few facade gaps.

#### DX improvements

- 🟡 **[PARTIAL]** **`useRelativeLocation: false` never produces absolute URLs in Node handlers.** _Fixed for base/multipart/REST handlers; TUS-on-Node is still relative-only (now documented)._ `getBaseUrl()` derives host/proto from request headers (`src/utils/http.ts:177-203`), but every Node call site passes a headerless object — `getBaseUrl({ url: requestUrl } as IncomingMessage)` in `src/handler/base/base-handler-core.ts:175` and `src/handler/tus/tus.ts:279` (where `requestUrl` is just `request.originalUrl || request.url`, a path). `extractHost`/`extractForwarded` always return `""`, so the Location header is silently relative even though `useRelativeLocation` defaults to `false`. The fetch handler (`src/handler/tus/tus-fetch.ts:328`) does it correctly via `url.origin`. Either thread the real request through or document that Node handlers are relative-only. (Silver lining: this also makes host-header injection impossible today — keep an allowlist in mind if it's fixed.)
- ✅ **[FIXED]** **`Files.resolveKey` treats leading `/` inconsistently** (`src/files/index.ts:784-794`): leading slashes are stripped only when a `prefix` is configured; without one, the raw key is returned and `assertSafeId` then rejects it as absolute. `files.upload("/a.txt")` succeeds with a prefix and throws without one — return `normalized` in both branches.
- ✅ **[FIXED]** **Stale package metadata** (`packages/storage/storage/package.json`): `repository.directory` is `"packages/storage"` (actual: `packages/storage/storage`, breaks provenance/source links), `homepage` points to `/packages/uploads`, and the description still begins "Visulima upload -". Cheap fixes with outsized npm-page impact.

#### Optimizations

- ✅ **[FIXED]** **DiskStorage ranged `get()` buffers the whole file.** `src/storage/local/disk-storage.ts:338-391` does `readFile(..., { buffer: true })`, computes a full-content `etag(content)`, _then_ `subarray`s the requested range — a 1 KB range read of a 5 GB upload allocates 5 GB, despite the adapter advertising `supportsRange = true`. Use `createReadStream`/`fs.read` with `start`/`end` and a cheap stat-based ETag for ranged reads.
- ✅ **[FIXED]** **`BaseStorage.lock()` copies every lock key per acquisition** (`src/storage/storage.ts:1016-1027`): `[...this.locker.keys()]` + `includes(key)` is an O(n) allocation on the hot upload path; `this.locker.has(key)` and `this.locker.size` give the same answers for free.
- ✅ **[FIXED]** **OAuth refresh has no single-flight dedupe** (`src/utils/oauth-refresh.ts:61-94`): N concurrent calls on a cache miss fire N parallel token exchanges. Cache the in-flight promise. Related gap: the response's rotated `refresh_token` (Box/Dropbox rotate them) is ignored, so providers enforcing one-time refresh tokens will eventually fail.

#### Feature gaps

- **No streaming download on the `Files` facade.** `downloadOne` (`src/files/index.ts:1115-1136`) always returns `file.content` as a fully-buffered Buffer even though every adapter implements `getStream()`. flydrive's `getStream()`/`getArrayBuffer()` split is the expected ergonomics — add `files.downloadStream(key)` so serving large objects doesn't require the `.raw` escape hatch.
- **No signed URLs for local disk.** `DiskStorage` inherits the throwing `getReadUrl`/`getUploadUrl` (`src/storage/storage.ts:376-394`), so `files.url()` works on S3 but throws `METHOD_NOT_ALLOWED` in local dev — the exact env where people prototype. An HMAC-signed local URL helper (à la Laravel `temporaryUrl` + a verification handler) would keep one code path across environments.
- **`Files.upload` doesn't expose integrity checksums.** Adapters already verify `checksum`/`checksumAlgorithm` on `FilePart` (used by TUS, `src/storage/local/disk-storage.ts:606`), but the facade's `UploadOptions` has no checksum field — users who want end-to-end integrity (S3 `ChecksumSHA256`-style) must drop down to the adapter API.

#### Security

- No concrete issues found. The hardening is notably thorough: `assertSafeId` rejects traversal/absolute/drive-letter ids at every boundary (`src/storage/storage.ts:487-504`), `LocalMetaStorage.getMetaPath` re-verifies containment after normalize (`src/storage/local/local-meta-storage.ts:36-45`), `readBody` enforces byte-accurate limits (`src/utils/http.ts:44-76`), the uuid matcher is anchored (`src/utils/http.ts:246`), config logging redacts credentials (`src/storage/storage.ts:29-51`), and the `deepMerge` in `src/storage/utils/file/update-metadata.ts` copies rather than mutates, so `__proto__` payloads can't pollute `Object.prototype` (handlers also wrap user JSON under `{ metadata }`).

---

## @visulima/storage-client — `packages/storage/storage-client`

> Framework-agnostic upload client (multipart/TUS/chunked-REST with cross-process resume) for React/Vue/Solid/Svelte built on TanStack Query — well-tested and well-documented across all four frameworks, but missing auth-header support and carrying dead retry options on the batch Uploader.

#### DX improvements

- ✅ **[FIXED]** **Dead `retry`/`maxRetries` options on `Uploader`** — `UploaderOptions` declares both (`src/core/uploader.ts:83-87`) but the class never reads them; only manual `retryItem()`/`retryBatch()` exist. The README advertises "Retry Mechanism — Built-in retry with exponential backoff", which is true for the TUS/chunked-REST adapters but silently false for multipart batch uploads. Either wire them into `uploadFile()` or remove them from the type.
- ✅ **[FIXED]** **`core/` imports its public types from `../react/types`** — `src/core/uploader.ts:1`, `src/core/query-client.ts:1`, `src/core/tus-adapter.ts:2`, `src/core/chunked-rest-adapter.ts:2`, `src/core/multipart-adapter.ts:1` all pull `FileMeta`/`UploadResult` out of the React folder. The framework-agnostic root export's `.d.ts` is coupled to the React binding, and the AGENTS.md "keep upload logic in core" rule is inverted for types. Move shared types to `src/core/types.ts` and re-export from each framework folder.
- ✅ **[FIXED]** **No typed error class; API error `code` is discarded** — `parseApiError` (`src/core/query-client.ts:17-25`) collapses everything into a plain `Error`, dropping `errorData.error.code` and the HTTP status. Consumers can't distinguish 404 vs 413 vs network failure without string-matching messages. An `UploadError extends Error { status, code }` would fix this across all hooks.
- ✅ **[FIXED]** **TanStack Query abort signal never forwarded** — queryFns ignore the `signal` argument (e.g. `src/react/use-get-file-list.ts:59`), and `fetchJson`/`fetchFile`/`fetchHead` (`src/core/query-client.ts:72-112`) accept no `RequestInit`/signal, so unmounts and refetches leave requests in flight.

#### Optimizations

- ✅ **[FIXED]** **Pause is a 100 ms busy-poll** — both adapters wait out pauses with `setTimeout(100)` loops (`src/core/chunked-rest-adapter.ts:~364-372`, `src/core/tus-adapter.ts:410-420`). A promise that resolves on `resume()` would eliminate the polling wake-ups and make resume instantaneous.
- ✅ **[FIXED]** **No concurrency cap in `Uploader.addBatch`** — `add()` fires the XHR immediately (`src/core/uploader.ts:185-189`), so a 200-file drop opens 200 parallel multipart requests. The chunked-REST adapter already has a `CONCURRENCY = 4` worker pool (`src/core/chunked-rest-adapter.ts:359`); the batch uploader needs the same (cf. Uppy `limit`, react-uploady `concurrent.maxConcurrent`).

#### Feature gaps

- **No custom headers / auth hook anywhere** — adapters hard-code their header sets (`src/core/chunked-rest-adapter.ts:195-207`, `src/core/tus-adapter.ts:250-265`) and the fetch helpers take only a URL (`src/core/query-client.ts`). tus-js-client offers `headers` + `onBeforeRequest`; without an equivalent, users behind any token-authenticated endpoint cannot use this client at all. User story: "attach my session JWT to every upload and file-management request."
- **Chunk checksum plumbing is dangling** — `patchChunk` accepts a `checksum` and sends `X-Chunk-Checksum` (`src/core/query-client.ts:180-188`), but the chunked-REST adapter never computes one, so integrity verification only works if users hand-roll chunking via `usePatchChunk`. Computing a SHA-256/CRC via `crypto.subtle.digest` per chunk (opt-in) would complete the feature.
- **No upload restrictions** — there are no `maxFileSize` / `allowedFileTypes` / `maxNumberOfFiles` options on `useUpload`, `useBatchUpload`, or the `Uploader`; only the raw `accept` attribute on `use-file-input.ts:5`. Uppy's `restrictions` block is the table-stakes comparison; today every consumer re-implements client-side validation and gets server 413s instead of friendly errors.
- **`Content-Disposition` filename is naively quoted** — `src/core/chunked-rest-adapter.ts:206` builds `attachment; filename="${file.name}"`; a `"` or non-ASCII character in the filename malforms the header (fetch rejects CR/LF, so this is correctness, not injection). Use RFC 5987 `filename*=UTF-8''...` encoding.

#### Security

- No concrete security issues found. Header values are user-self-controlled client-side, `fetch` rejects CR/LF in header values, JSON parsing targets are plain typed objects with no merge/assign sinks, and resume tokens stored in `localStorage` (`src/core/url-storage.ts`) contain only endpoint/fingerprint/upload-URL data.

---

# Terminal

## @visulima/ansi — `packages/terminal/ansi`

> @visulima/ansi is a zero-dependency ESM catalog of ANSI/VT100/xterm escape-sequence constants and builders (cursor, erase, modes, mouse, iTerm2 images, passthrough, strip) in solid health: clean module-per-concern layout, per-module subpath exports, sanitized OSC inputs, and a test file for every source module — the main blemishes are a stale README, one missing subpath export, and a redundant regex pass in strip().

#### DX improvements

- ✅ **[FIXED]** **README examples are wrong for the current API.** `packages/terminal/ansi/README.md:113-116` imports and writes `clearScreen`, which does not exist anywhere in `src/` (the real exports are `clearScreenAndHomeCursor` / `clearScreenFromTopLeft` in `src/clear.ts`). Copy-pasting the first screen-clearing example throws at import time.
- ✅ **[FIXED]** **README claims CommonJS support that the package no longer has.** `README.md:86-90` shows `const { cursorUp } = require("@visulima/ansi")`, but the package is ESM-only (`"type": "module"`, exports map with no `require` condition, `lint:attw --profile esm-only` in `package.json:159`). Remove or replace with a dynamic-`import()` note.
- ✅ **[FIXED]** **`./progress` subpath export is missing.** `src/progress.ts` (Windows Terminal OSC 9;4 progress bars) is re-exported from the barrel (`src/index.ts:141`) but absent from the `exports` map (`package.json:66-147`) — every sibling module has a deep import; `@visulima/ansi/progress` fails to resolve and no `dist/progress.js` entry is built.
- ✅ **[FIXED]** **Sequence primitives in `src/constants.ts` (ESC/CSI/OSC/DCS/ST/BEL/APC…) are not exported at all** — neither via the barrel nor a subpath. For a package positioned as the low-level building block (per its own CLAUDE.md), consumers composing custom sequences (e.g. `@visulima/tui`) must redefine these; a `@visulima/ansi/constants` entry would be cheap and natural. Also, `image()`'s JSDoc at `src/image.ts:48` claims it "returns an empty string if data is null", but no such guard exists in the implementation (`src/image.ts:81-103`) — stale doc.

#### Optimizations

- ✅ **[FIXED]** **`strip()` does a redundant full-string regex pass on every call.** `src/strip.ts:34-36` first replaces `OSC_TITLE_REGEX` (`ESC ]0; … BEL`), then runs `ansi-regex` — whose OSC alternative `(?:\][\s\S]*?ST)` (visible in `dist/strip.js`) already matches everything the title regex matches, with more terminators (BEL, `ESC \`, ``). The first `.replace` is a strict subset and pure overhead on a hot path used by rendering layers; drop it.
- ✅ **[FIXED]** **`tmuxPassthrough` escapes ESC char-by-char with string concatenation** (`src/passthrough.ts:103-111`). For TUI repaint frames passed through tmux this is the hot path; `sequence.replaceAll(ESC, ESC + ESC)` is both simpler and significantly faster on large sequences.
- ✅ **[FIXED]** **`image()` hard-imports `node:buffer`** (`src/image.ts:1`, used at line 100) solely for base64. Since the barrel re-exports `image`, this makes the root entry Node-only despite the package otherwise being runtime-agnostic (browser detection even exists in `src/helpers.ts:6-9`). A feature-detected `Uint8Array.prototype.toBase64` (Node ≥24) with a small fallback would keep xterm.js/browser consumers on the barrel.

#### Feature gaps

- **No OSC 52 clipboard sequences.** The "write to system clipboard over the wire" escape (`OSC 52 ; c ; <base64> ST`) is table stakes in this niche (charmbracelet/x/ansi has it) and is the only clipboard mechanism that works over SSH/tmux. Nothing in `src/` emits it (`src/title.ts:8` even mentions clipboard writes only as an injection risk). User story: a CLI copies a generated token to the user's local clipboard from a remote session.
- **No Kitty keyboard protocol (progressive enhancement, `CSI > flags u` push/pop/query).** `src/xterm.ts` covers legacy `modifyOtherKeys` only; modern TUI frameworks (crossterm, charmbracelet/x) expose Kitty keyboard flags to get key-release and disambiguated modifiers — directly relevant to `@visulima/tui` sitting on top of this package.
- **Inline images are iTerm2-only.** `src/image.ts` / `src/iterm2/` emit OSC 1337; there are no Kitty graphics protocol (`APC G`) or Sixel builders (sixel appears only as a DA1 capability comment, `src/status.ts:282`), so images don't work in kitty, ghostty, or foot.

#### Security

- ✅ **[FIXED]** **Low — polynomial ReDoS in `strip()` on adversarial input.** Both the local `OSC_TITLE_REGEX` (`src/strip.ts:34`, `/\x1b\]0;[\s\S]*?\x07/g`) and the inlined `ansi-regex` OSC pattern (`src/strip.ts:10`) use lazy `[\s\S]*?` scans to a terminator; input consisting of many unterminated `ESC ]` prefixes degrades to O(n²) backtracking. `strip()` is the function most likely to receive untrusted subprocess/log output. This matches the structural CodeQL finding already fixed elsewhere in this repo with a linear scanner — same fix applies here.

---

## @visulima/boxen — `packages/terminal/boxen`

> @visulima/boxen renders styled terminal boxes (a zero-runtime-dep fork of sindresorhus/boxen with header/footer and function-based colors); it is healthy and well-tested (~112 test cases plus benches), with a few doc/API contract mismatches and avoidable per-render work.

#### DX improvements

- ✅ **[FIXED]** **README `fullscreen` docs contradict the implementation** — `README.md` (~lines 421–433) documents `fullscreen: (width, height) => [width, height - 1]` returning a tuple, but the code expects an object: `src/types.ts:10` types it as `(width, height) => { columns: number; rows: number }` and `src/index.ts:341–349` reads `newDimensions.columns`/`.rows`. Users following the README get `undefined` width/height silently (the `??=` fallbacks just never fire). Fix the README example and consider a runtime shape check.
- ✅ **[FIXED]** **Dead `dimBorder` option** — `src/index.ts:474` sets `dimBorder: false` as a default, but it is absent from `Options` in `src/types.ts` and never read anywhere. Either implement it (upstream boxen parity) or delete the dead default.
- ✅ **[FIXED]** **Inconsistent runtime validation and unhelpful error wording** — `src/index.ts:463–470` validates only `borderColor` and `textColor`; `headerTextColor`, `footerTextColor`, and `fullscreen` get no checks. The message `"borderColor" is not a valid function` is also misphrased — "must be a function, got <type>" would help more.
- ✅ **[FIXED]** **No JSDoc on the public API** — the exported `boxen` (`src/index.ts:463`) and every field of `Options`/`BaseOptions` (`src/types.ts`) lack JSDoc, so editor hover/IntelliSense shows nothing; the good docs live only in `docs/*.mdx`. Porting the option descriptions into JSDoc is cheap and high-leverage.
- ✅ **[FIXED]** **Border catalog not exported** — users who want to tweak a built-in style must copy box-drawing characters by hand. Exporting the vendored catalog (`src/vendor/cli-boxes/boxes.ts`) and a `BorderStyleName` union from `src/index.ts` would make custom borders ergonomic.

#### Optimizations

- ✅ **[FIXED]** **Per-render synchronous terminal-size probe with no override** — `boxen()` calls `terminalSize()` on every invocation (`src/index.ts:492`). The package's own bench notes (`__bench__/terminal-size.bench.ts:13–18`) that in non-TTY contexts (piped output/CI) terminal-size@4 falls back to a synchronous child-process spawn (`tput`/`stty`/PowerShell), blocking the event loop once per box. Add a `columns`/`terminalSize` option to skip the probe (also fixes snapshot determinism) and/or memoize the lookup.
- ✅ **[FIXED]** **Wasted full-text wrap when `width` is fixed** — `determineDimensions` computes `widest` by word-wrapping the entire text and measuring every line (`src/index.ts:389–392`) even when `options.width` is provided, in which case `widest` is dead (`src/index.ts:422` resolves to the user width). The text is then wrapped a second time in `makeContentText` (`src/index.ts:186`); skip the measurement pass when `width` is set.
- ✅ **[FIXED]** **Invariant width computations inside the per-line map** — `boxContent` recomputes `getStringWidth(chars.left)` and `getStringWidth(chars.right)` for every content line (`src/index.ts:302–310`); both are loop-invariant. For an N-line box that is 2N redundant ANSI-aware width scans — hoist them above the `.map()`.

#### Feature gaps

- **No `backgroundColor`** — upstream `boxen` supports `backgroundColor` to fill the box interior. Here the only hook is `textColor` per content line (`src/index.ts:260, 307`), which makes colored-fill status banners (a very common boxen use case) awkward. A `(line) => string` background hook or built-in fill would close the gap.
- **No vertical alignment for fixed-height boxes** — when `height` exceeds the content, filler rows are only appended at the bottom (`src/index.ts:244–246`). Ink's `<Box>` and similar layout tools offer `verticalAlignment: top|center|bottom`; users building dashboards with fixed-size panels would expect the same here.

#### Security

- No findings. The package takes a string in and returns a string, has zero runtime dependencies (hot-path deps are bundler-inlined per `CLAUDE.md`), no I/O beyond the terminal-size read, and no dynamic regex over user input. The `execSync` string interpolation in `__tests__/helpers.ts:10–12` is test-only scaffolding with test-controlled inputs, not shipped code.

---

## @visulima/cerebro — `packages/terminal/cerebro`

> Cross-runtime CLI framework (foundation for @visulima/vis) with a well-designed injectable toolbox, broad test coverage (~55 test files), and a thorough README — overall healthy, but it ships an argv hard-cap that breaks real-world invocations and an update notifier that blocks command startup on an un-timed network request.

#### DX improvements

- ✅ **[FIXED]** **Hard argv caps break legitimate invocations.** `src/util/security.ts:8-13` sets `MAX_ARGS = 100` and `MAX_ARGUMENT_LENGTH = 10_000`, and `sanitizeArguments` is applied to every run in `src/cli.ts:223` and `src/cli.ts:1156`. A shell glob expanding to >100 paths (`mycli fmt src/**/*.ts`) throws `Too many arguments (maximum 100)` with no workaround or config knob. `sanitizeArgument` also silently `.trim()`s every argv token (`security.ts:49`), mutating intentional values. Both call sites pass `checkDangerousChars=false`, so the char-blocklist half of the module is effectively dead — the remaining caps are pure downside. Make limits configurable via `CliOptions` or drop them.
- ✅ **[FIXED]** **Built-in commands violate the package's own `toolbox.fs` convention.** `src/commands/readme-command.ts:2-3` imports `node:fs`/`node:fs/promises` directly and writes via `resolve(getCwd(), filePath)` (`readme-command.ts:231,371`), and `src/plugins/update-notifier/cache.ts:1` uses sync `node:fs`. The v5 injectable-runtime story (MCP/sandboxed) breaks for exactly these built-ins; they should consume `toolbox.fs`.
- ✅ **[FIXED]** **Verbosity is global mutable state, defeating `clone()` isolation.** The constructor (`src/cli.ts:419-421`) and `#setVerbosityLevel` (`src/cli.ts:239-264`) write `CEREBRO_OUTPUT_LEVEL` into the _live_ process env via `getEnv()`, even when a `CliOptions.env` override is supplied. Two `Cli` instances (or a clone with different `--verbose` argv — the documented MCP/test use case) stomp each other's verbosity. Store the level per-instance and only fall back to env.
- ✅ **[FIXED]** **Dead "security" exports.** `RateLimiter` and `validateSafePath` in `src/util/security.ts:78-174` are referenced only by their own tests — nothing in `src/` uses them. Remove or move to a consumer; right now they read as security theater in a CLI framework.

#### Optimizations

- ✅ **[FIXED]** **Update notifier blocks every command start on an un-timed HTTPS request.** `src/plugins/update-notifier/update-notifier-plugin.ts:53-57` `await`s `hasNewVersion()` inside `beforeCommand`, and `src/plugins/update-notifier/get-distribution-version.ts:12` calls `https.get` with no timeout/`AbortSignal` — a slow or blackholed registry hangs the user's command indefinitely. It also prints `"Checking for updates..."` on every check (line 53), polluting scriptable output, and renders the update box via `logger.error` (line 65). Adopt the `update-notifier` npm pattern: fire-and-forget with a short timeout, persist the result, and notify on the _next_ run.
- ✅ **[FIXED]** **Eager debug-string construction on the hot path.** `src/cli.ts:309` and `src/cli.ts:933-935` build template strings with `.join()` for `logger.debug` on every command execution regardless of verbosity; only the default logger gates inside `debug`, custom loggers pay full cost. Gate on `CEREBRO_OUTPUT_LEVEL` first (as `src/cli.ts:368-375` already does).

#### Feature gaps

- **Unknown options are silently swallowed.** The parser runs with `partial: true, stopAtFirstUnknown: true` (`src/util/command-processing/command-processor.ts:190-195`), so a typo like `--produciton` lands unnoticed in `toolbox.rawUnknown`. `src/errors/unknown-option-error.ts` exists but is never thrown anywhere in `src/`. Commander and yargs error by default with a did-you-mean suggestion (the package already has `findAlternatives`). Add a strict mode that rejects unknown options outside the post-`--` tail.
- **No `choices`/enum constraint on options.** `src/types/command.ts` has `hidden`, `conflicts`, `implies`, `required` — but nothing like commander's `.choices()` / yargs `choices`. User story: `--format <json|yaml|table>` validated at parse time and rendered in help/completions instead of hand-rolled checks in every `execute`.

#### Security

- No real findings. The npm-registry fetch URL is built from the CLI author's own `packageName` (not end-user input), the update cache writes a fixed filename under a found cache dir, and argv never reaches a shell. The `DANGEROUS_CHARS` blocklist is disabled at both call sites, but nothing downstream relies on it.

---

## @visulima/colorize — `packages/terminal/colorize`

> Chalk-compatible terminal string-styling library (named imports, chained syntax, tagged templates, gradients) with a triple-platform build; code quality and test breadth are strong, but a root-exports condition-ordering bug makes the browser build effectively unreachable for ESM bundlers, and the API lacks chalk-style per-instance color-level control.

#### DX improvements

- ✅ **[FIXED]** **`browser` export condition is unreachable for ESM bundlers** — in `packages/terminal/colorize/package.json:82-99` the root export lists `import` and `require` before `browser`. Bundlers resolve conditions in key order, and a browser-targeting ESM bundler (webpack/vite with `["browser","import"]`) matches `import` first, shipping `index.server.mjs` instead of the browser build. The `browser` key must come first. Relatedly, the `./browser` subpath (`package.json:100-105`) only declares `import` — no `require`/`default` fallback, so CJS consumers and non-condition-aware tools get nothing.
- ✅ **[FIXED]** **Browser `strip()` is a silent no-op** — `packages/terminal/colorize/src/colorize.browser.ts:96` defines `self.strip = (value) => value`. The server build strips ANSI codes; the browser build returns input unchanged with no documentation of the divergence (README's Strip section doesn't mention it). Either strip ANSI there too (the regex is already bundled for the server) or document it.
- ✅ **[FIXED]** **Zero JSDoc on the public API** — `packages/terminal/colorize/src/index.server.mts` exports ~60 symbols (`red`, `hex`, `strip`, …) with no doc comments, so IDE hover/autocomplete shows nothing despite a 945-line README. Even one-liners with an `@example` on `hex`/`rgb`/`strip`/`ansi256` would lift the experience.
- ✅ **[FIXED]** **Invalid hex input silently renders black** — `packages/terminal/colorize/src/util/convert-hex-to-rgb.ts:37-38` returns `[0,0,0]` when the regex doesn't match, so `hex("#GGG")` or `hex("96C9")` paints text black with no signal. A dev-time warning or documented behavior would save debugging time; this also feeds `gradient` stop parsing (`gradient-builder.ts:57,83`).

#### Optimizations

- ✅ **[FIXED]** **O(n²) per-character `shift()` in gradient hot path** — `packages/terminal/colorize/src/gradient.ts:43-54` copies the cached color array (`[...cached]`) then calls `colors.shift()` for every non-whitespace character; `multilineGradient` repeats this per line (`gradient.ts:98-103`). `Array.prototype.shift` is O(n), making long-string gradients quadratic. An index cursor removes both the copy and the shifts.
- ✅ **[FIXED]** **Each gradient character pays full `wrapText` cost** — every 1-char call routes through `wrapText` in `packages/terminal/colorize/src/colorize.server.ts:21-53`, doing `includes("")` and `includes("\n")` scans per character. Since gradient colors are plain single-level `rgb()` styles, concatenating `style.open + ch + style.close` directly would skip the machinery.
- ✅ **[FIXED]** **Module-level `styles`/`stylePrototype` rebuilt on every `new Colorize()`** — `packages/terminal/colorize/src/colorize.server.ts:16-19` holds shared mutable module state, and the constructor (`:88-116`) re-creates all ~50 property descriptors and swaps the shared prototype on each instantiation. The package itself constructs two instances (`index.server.mts:5` and `gradient.ts:5`), and any user-created instance mutates state shared with all others — wasted work today and a latent correctness hazard.

#### Feature gaps

- **No per-instance color level / force option** — the support level is frozen at import time (`packages/terminal/colorize/src/ansi-codes.ts:21`, `isStdoutColorSupported()` evaluated once at module load). Chalk offers `new Chalk({ level })` and ansis exposes a settable `.level`; here `new Colorize()` takes no options, so users can't force truecolor for snapshot tests, disable color when piping to a file, or render at a chosen level at runtime — only via env vars set before import.
- **No stderr-aware instance** — chalk ships `chalkStderr` because stdout and stderr can have different TTY capabilities (e.g. `node app > out.txt`). The sole runtime dependency already exports `isStderrColorSupported` (`packages/terminal/is-ansi-color-supported/src/is-color-supported.server.ts:232`), but colorize only consumes the stdout variant (`ansi-codes.ts:10,21`). A `colorizeStderr` export would be nearly free and matters for CLI error output (the package's main consumers: cerebro, pail).

#### Security

- No concrete issues found. The `sonarjs/slow-regex`-suppressed patterns in `src/template/make-template.ts:14-23` and `src/colorize.browser.ts:13` operate on developer-authored template/CSS strings, not untrusted input, and `strip()` delegates to the linear-time-vetted `ansi-regex`.

---

## @visulima/command-line-args — `packages/terminal/command-line-args`

> A strict-by-default, TypeScript-first argv parser (modern replacement for command-line-args, used by cerebro) in very good health: clean 3-stage pipeline, class-based errors with hints, 30+ focused test files and a bench suite; main weaknesses are a confirmed plain-object key-collision bug, a parseArgs type signature that contradicts the README, and no typed-result generics.

#### DX improvements

- ✅ **[FIXED]** **`parseArgs` type signature makes `options` required, contradicting the README** — `src/index.ts:103` annotates the alias as `(defs, options: ParseOptions) => CommandLineOptions` (no `?`, no default), so the README's recommended basic example `parseArgs(definitions)` (`README.md:64-69`) is a TypeScript error. Make the parameter optional (`options?: ParseOptions`) or drop the explicit annotation so the default-parameter signature of `commandLineArgs` flows through.
- ✅ **[FIXED]** **No default export despite the "full backward compatibility" claim** — the original `command-line-args` is consumed via `import commandLineArgs from "command-line-args"`, but `src/index.ts` only has named exports. Adding `export default commandLineArgs` would make migration a one-line specifier change instead of an import rewrite.
- ✅ **[FIXED]** **Untyped parse result** — `CommandLineOptions` is just `[propName: string]: any` (`src/types.ts:4-12`). For a TS-first package, a generic `parseArgs<const T extends ReadonlyArray<OptionDefinition>>` that infers `{ file?: string; verbose?: boolean }` from `type`/`multiple`/`defaultValue` (the way `arg` and `meow` type their results) — or at minimum `parseArgs<T = CommandLineOptions>()` — would be a major consumer win.

#### Optimizations

- ✅ **[FIXED]** **O(n²) tokenizer on large argv** — `src/tokenizer.ts:116-121,199` drains a copied `remainings` array via `shift()` (O(n) each) and re-`unshift()`s expanded short-option groups. An index-pointer walk with a small pending-queue for group expansion makes tokenization linear; relevant since this sits under cerebro on every CLI invocation.
- ✅ **[FIXED]** **`stopAtFirstUnknown` runs the same unknown-option scan twice** — `src/resolve-args.ts:350-363` computes `stopAtUnknownArgvIndex` and `src/resolve-args.ts:433-440` re-runs an identical predicate via `findIndex`; the second pass can reuse the first result. Also `definitions.find((d) => d.type === Number)` at `src/resolve-args.ts:183` re-scans definitions per numeric token — precompute it next to `hasNumberType` (`src/resolve-args.ts:164`).

#### Feature gaps

- **No `--no-<flag>` boolean negation** — minimist, yargs, and Node's `util.parseArgs` (via `allowNegative`) all support `--no-verbose` → `verbose: false`. Here it throws `UnknownOptionError` unless the developer defines a separate `no-verbose` option. User story: a CLI with `verbose: { type: Boolean, defaultValue: true }` has no idiomatic way for users to turn it off. Tokenizer + resolver (`src/resolve-args.ts:179`) would need a negation-aware lookup.
- **`type: Number` silently produces `NaN`** — `Number("abc")` at `src/utils/convert-value.ts:59-61` propagates `NaN` into results with no error (`--port abc` → `{ port: NaN }`). Parity with the original package, but a strict opt-in (e.g. `strictTypes: true` throwing an `InvalidValueError`) would catch a whole class of user typos that today surface as downstream `NaN` bugs.

#### Security

- ✅ **[FIXED]** **(low) Prototype-key collisions in the plain-object accumulators** — `src/resolve-args.ts:154-156` uses `{}` for `values`/`output`, and the duplicate check at `src/resolve-args.ts:196` is `values[optionName] !== undefined`. Verified against `dist/`: a defined option named `toString` throws `AlreadySetError` on its _first_ use (inherited `Object.prototype.toString` is `!== undefined`), and a definition named `__proto__` silently loses all values (the assignment rewrites the local prototype; result is `{}`). No global prototype pollution is reachable — unknown `--__proto__` argv throws or lands in `_unknown`, and the `isUnsafeKey` guard (`src/resolve-args.ts:45`) already covers group names — but switching to `Object.create(null)` plus `Object.hasOwn` checks closes the gap and fixes the correctness bug at the same time.

---

## @visulima/fmt — `packages/terminal/fmt`

> @visulima/fmt is a zero-dependency util.format-style string formatter (printf specifiers plus Deno-style %c CSS-to-ANSI) that is well-tested and structurally healthy, but its README overpromises behavior the code does not implement.

#### DX improvements

- ✅ **[FIXED]** **README specifier table overpromises** — `README.md:113-115` claims `%o` adds an inspect-style object representation and `%O` includes non-enumerable properties, but `%j`/`%o`/`%O` share one code path that just calls `stringify` (`src/index.ts:148-186`). It also says "If color is disabled, %c is ignored", yet the only gate is `globalThis.window === undefined` (`src/index.ts:87`) — there is no NO_COLOR/FORCE_COLOR/TTY detection. Either implement or correct the docs.
- ✅ **[FIXED]** **No JSDoc on the public API** — `format`, `build`, `Options`, `FormatterFunction` (`src/index.ts:31, 253, 289-296`) have zero doc comments, so editors show nothing on hover. The object-as-first-argument mode (`format({a:1})` returns joined JSON, `src/index.ts:41-57`) is entirely undocumented in both JSDoc and README.
- ✅ **[FIXED]** **Unknown specifiers silently consume an argument** — the `default` case does nothing when no custom formatter matches, but `a += 1` still runs (`src/index.ts:217-232`), so `format("%x %s", ["hello"])` yields `"%x %s"` instead of util.format's `"%x hello"`; every later specifier is off by one. Fix or document the divergence.

#### Optimizations

- ✅ **[FIXED]** **`build()` allocates a fresh options object on every call** — the returned closure spreads `{ ...formatOptions, formatters }` per invocation (`src/index.ts:284-285`), even though `build` exists to be the pre-optimized hot path for loggers. Pre-build a frozen `{ formatters }` and only spread when callers actually pass `formatOptions`.
- ✅ **[FIXED]** **Repeated indexed argument reads in the hot loop** — e.g. the `%s` case reads `arguments_[a]` three times (`src/index.ts:208-211`), and `%d`/`%i` twice each; hoisting to a local matches the micro-optimized style the package already aims for (codepoint constants).
- ✅ **[FIXED]** **148-entry `colorKeywords` Map built at module load** — `src/inspect-colors.ts:14-163` constructs the full CSS keyword map even when `%c` is never used (the common case for log formatting); lazy-init on first `parseCssColor` call would shrink startup cost for every consumer (pail et al.).
- ✅ **[FIXED]** **Dead branch** — `c === undefined` after `fmt.codePointAt(index + 1)` is unreachable because the loop already guards `index + 1 < fmt.length` (`src/index.ts:71-79`); removable along with its lint suppressions.

#### Feature gaps

- **Excess arguments are silently dropped** — Node's `util.format("hi", err)` appends leftover args space-separated; here `format("hi", [err])` returns `"hi"` because unconsumed args are discarded (`src/index.ts:238-240`). Logger users porting from `console.log`/pino-style call sites lose data with no signal. An opt-in `appendExtraArguments` option would close the biggest interop gap.
- **No width/precision support** — printf-style competitors (and users coming from `printf`) expect `%5d` / `%.2f` padding and precision; the parser only handles single-character specifiers (`src/index.ts:74-230`). Even documenting the non-goal would help.
- **%c emits truecolor unconditionally** — `cssToAnsi` always produces `38;2;R;G;B` sequences (`src/inspect-colors.ts:480-557`) with no downsampling to 256/16 colors and no NO_COLOR/level detection, unlike Deno/Chrome whose behavior it borrows. A `colorLevel` option (or integration point for `@visulima/is-ansi-color-supported`) would make `%c` safe on dumb terminals and CI logs.

#### Security

- No findings. The CSS parser is a linear character scan (`src/inspect-colors.ts:295-336`), all regexes are anchored with no ambiguous nested quantifiers (`src/inspect-colors.ts:166-174`), and `CssObject` is created with `__proto__: null` so `%c` input cannot pollute prototypes (`src/inspect-colors.ts:177-188`).

---

## @visulima/interactive-manager — `packages/terminal/interactive-manager`

> @visulima/interactive-manager is the shared stdout/stderr hooking + redraw substrate used by @visulima/spinner and @visulima/progress-bar; the code is small, tested, and dependency-free at runtime, but it has a real line-counting bug with wrapped rows, no non-TTY fallback, and a thin README.

#### DX improvements

- ✅ **[FIXED]** **Wrapped rows break erase bookkeeping (correctness bug)** — In `packages/terminal/interactive-manager/src/interactive-manager.ts:191-211`, `wordWrap(...)` returns a _string with embedded `\n`_ when a row exceeds terminal width (`packages/data-manipulation/string/src/word-wrap.ts:516` returns `string`), but `update()` sets `#lastLength = output.length`, i.e. the count of input rows, not visual lines. The next `update()`/`erase()` then erases too few lines, leaving stale artifacts. Split each wrapped result on `\n` (or sum visual lines) before computing `lastLength`/`outside`. Tests in `__tests__/interactive-manager-overflow.test.ts` only use short `"row N"` strings, so the wrap path is uncovered.
- ✅ **[FIXED]** **README documents ~30% of the API** — `README.md:49-66` shows only hook/update/unhook. `suspend()`/`resume()` (the whole point of coordinating external `console.log` output), `erase()`, the `from` parameter of `update()`, and history-replay semantics of `InteractiveStreamHook.inactive()` are undocumented outside JSDoc. The `docs/*.mdx` files exist but the npm-facing README is the first touchpoint.
- ✅ **[FIXED]** **Dead/confusing branch in position clamping** — `packages/terminal/interactive-manager/src/interactive-manager.ts:187`: `from > height ? height - 1 : Math.max(0, Math.min(height - 1, from))` — both branches produce the same value for `from > height`. Simplify to one `Math.max/Math.min` expression.
- ✅ **[FIXED]** **`update(stream, [])` silently no-ops** — `interactive-manager.ts:183` guards on `rows.length > 0`, so there is no way to clear the interactive region through the main API; consumers must know `lastLength` and call `erase()` themselves. Either treat an empty array as "clear" or document the `erase()` idiom.

#### Optimizations

- ✅ **[FIXED]** **`terminalSize()` called on every frame** — `interactive-manager.ts:185` queries terminal dimensions inside `update()`, which spinners call ~12 times/sec per stream. Cache the size and invalidate on `process.stdout.on("resize")` instead of an ioctl round-trip per redraw.
- ✅ **[FIXED]** **Unbounded `#history` buffer while hooked** — `packages/terminal/interactive-manager/src/interactive-stream-hook.ts:29,57` accumulates every intercepted write in an array for the lifetime of the hook. A long-running spinner around a chatty subprocess (e.g. piped build logs) grows memory without bound and then replays everything at once in `inactive()`. Consider a max-buffer threshold with early flush via suspend/replay.

#### Feature gaps

- **No non-TTY fallback** — `interactive-stream-hook.ts:51` writes `cursorHide` and `interactive-stream-hook.ts:79-83` writes `eraseLines` unconditionally. When output is piped (CI logs, `> file.txt`), the escape sequences garble output. Competitor `log-update` checks `stream.isTTY` and degrades to plain sequential writes; this package should too — user story: "my spinner-using CLI produces readable CI logs without me branching on `isTTY` myself."
- **No resize handling** — there is no `resize` listener anywhere in `src/`; a terminal narrowed mid-render leaves torn frames because old frames were wrapped at the previous width and erase counts no longer match. `log-update` recomputes width per render and Ink redraws on resize.
- **No `clear()`/`done()` convenience API** — `log-update` ships `clear()` (wipe the region) and `done()` (persist current frame and reset). Here the equivalent requires the consumer to combine `erase()` + internal counters or `unhook()`. Since `InteractiveManager` already tracks `lastLength`, exposing `clear(stream)` is nearly free and would simplify both in-repo consumers (`packages/terminal/spinner/src/spinner.ts`, `packages/terminal/progress-bar/src/progress-bar.ts`).
- **Hook restore stomps third-party patches** — `interactive-stream-hook.ts:40` captures `stream.write` at construction and `renew()` (`:116-119`) blindly reassigns it. If anything else patched `write` after construction (a second hook instance, `patch-console`, a logger), unhooking silently removes their patch. Restoring only when `stream.write` is still the hook's own function (and warning otherwise) is the standard defensive pattern.

#### Security

- No findings. The package performs no I/O beyond the streams it is handed, takes no user-controlled paths/URLs/commands, and has zero runtime dependencies (`@visulima/ansi`, `@visulima/string`, `terminal-size` are bundled devDependencies per `packem.config.ts`).

---

## @visulima/is-ansi-color-supported — `packages/terminal/is-ansi-color-supported`

> Zero-dependency, tri-runtime (server/browser/edge) ANSI color-depth detector underpinning @visulima/colorize; small and well-tested overall, but it ships a real Windows-detection bug and dead root-export conditions.

#### DX improvements

- ✅ **[FIXED]** **Windows detection is broken in real Node (correctness bug)** — `src/is-color-supported.server.ts:136` calls `proc.os.release()`, but Node's `process` object has no `os` property (only Deno's branch is valid). The `TypeError` is swallowed by the surrounding `try/catch` (lines 129–148), so the win32 branch never returns; on real Windows with no `TERM`/`COLORTERM` (cmd, PowerShell, Windows Terminal) detection falls through to `minColorLevel` = 0 — colors fully disabled. Tests pass because `__tests__/is-color-supported.server.test.ts:701` mocks a fake process with an `os: { release }` property. Fix: import `release` from `node:os` (like upstream supports-color) and/or add a `WT_SESSION`/`ANSICON` env fallback.
- ✅ **[FIXED]** **Root export's `browser`/`edge-light` conditions are unreachable** — in `package.json:59-77`, the `"."` export lists `import`/`require` _before_ `edge-light`/`browser`. Export conditions match in key order, and browser/edge bundlers also have `import` active, so they always resolve the server entry; the dedicated browser/edge builds are only reachable via the explicit `./browser` and `./edge-light` subpaths. Reorder so `edge-light`/`browser` come first.
- ✅ **[FIXED]** **Inconsistent NO_COLOR vs FORCE_COLOR precedence** — `src/is-color-supported.server.ts:85-93`: `FORCE_COLOR=1` early-returns before the `NO_COLOR` check, but `FORCE_COLOR=true` (also level 1) is excluded from the early return and then loses to `NO_COLOR`. So `FORCE_COLOR=true NO_COLOR=1` → 0 while `FORCE_COLOR=1 NO_COLOR=1` → 1. README.md:151 claims "FORCE_COLOR overrides all other color support checks" — code and docs disagree.
- ✅ **[FIXED]** **`os` allowlist blocks installs on valid platforms** — `package.json:167-171` restricts to darwin/linux/win32, but the code is pure JS with runtime guards; FreeBSD/Android/AIX users get an install error for no reason. Drop the field.
- ✅ **[FIXED]** **README copy-paste leftovers and no JSDoc** — README.md:70 says "Ansis automatically detects…" (wrong package name, inherited from ansis). The two public functions (`src/is-color-supported.server.ts:230-232`) have no JSDoc, so editors show nothing on hover; the level semantics live only in the `ColorSupportLevel` type.

#### Optimizations

- 🟡 **[WON'T-FIX]** **No memoization — full detection re-runs on every call** _(The two named micro-opts — single `--` lookup + `typeof` instead of `Object.prototype.toString().slice()` — are already done; full result memoization is intentionally not applied because the API is configurable per-call and env/argv legitimately change between calls, so an env-keyed cache would cost more than the detection it replaces.)_ — `src/is-color-supported.server.ts:27-60` rebuilds everything per call: on Deno, `proc.env.toObject()` (line 57) snapshots the entire environment each time, and each `oneOfFlags` call rescans `argv` twice (`indexOf` + `findIndex`, lines 43-49). supports-color computes once at import. Cache the result (env-keyed or compute-once) since callers like colorize may probe repeatedly. Also `Object.prototype.toString.call(...).slice(8,-1) === "String"` (line 65) is an allocation-y stand-in for `typeof forceColorValue === "string"`.

#### Feature gaps

- **No `createSupportsColor(stream, options)` equivalent** — supports-color lets users test an arbitrary stream and pass `sniffFlags: false`; here argv sniffing (`src/is-color-supported.server.ts:43-49`) is unconditional, which is wrong for library consumers whose CLIs define their own `--color=...` flags with different meanings, and only process stdout/stderr can be queried (lines 230-232). User story: a CLI framework wants to compute color support for a log-file stream or with flag-sniffing disabled.
- **`TERM=*-256color` returns level 2 even when piped (no TTY gate)** — `src/is-color-supported.server.ts:202-204` returns 256-color before the `isTTY` check (lines 206-217), so `myapp > log.txt` under a 256-color TERM still reports level 2, diverging from supports-color's TTY-first behavior. If intentional (ansis-style), document it; otherwise gate on TTY.

#### Security

- No real findings. The regexes (`src/is-color-supported.server.ts:9-21`) are linear and run only against short env/argv strings; there is no I/O, deserialization, or user-controlled path handling.

---

## @visulima/progress-bar — `packages/terminal/progress-bar`

> Single and multi terminal progress bars with style presets, gradients, peak markers, and composite stacking on top of @visulima/interactive-manager; the code is clean and well-tested for its size, but the advertised fps throttle is unimplemented and it trails cli-progress on ETA/formatting/per-bar options.

#### DX improvements

- ✅ **[FIXED]** **README contradicts package.json on `@visulima/interactive-manager`** — `packages/terminal/progress-bar/README.md:97-101` tells users to "install as an additional dependency", but it is a hard runtime dependency (`packages/terminal/progress-bar/package.json:65-67`). Either demote it to an optional peerDependency (it is only needed for live rendering; `render()` works without it) or fix the README. Demoting would also shrink the install for users who only want `render()` strings.
- ✅ **[FIXED]** **Composite mode is completely undocumented** — `composite: true` and `setBarColor()` (`packages/terminal/progress-bar/src/multi-progress-bar.ts:144-159, 161-173`) appear nowhere in the README. Worse, composite rendering silently degrades to the first bar's output if the format string lacks `[...]` brackets, because it depends on `BAR_REGEX` matching (`src/multi-progress-bar.ts:8, 199-203`) — a doc note or a warning would save users confusion.
- ✅ **[FIXED]** **`fps` option exists in types but is never used** — declared and defaulted (`src/types.ts:9`, `src/progress-bar.ts:47`) yet no code throttles by it. Users coming from cli-progress will set `fps: 30` and get no effect.
- ✅ **[FIXED]** **No JSDoc on public methods and no in-code list of format tokens** — `update`/`increment`/`start`/`stop`/`setPeak` (`src/progress-bar.ts:68-219`) are undocumented, and the supported tokens (`{bar}`, `{percentage}`, `{value}`, `{total}`, `{eta}` plus payload keys) are only discoverable by reading `render()` (`src/progress-bar.ts:173-192`).

#### Optimizations

- ✅ **[FIXED]** **No render throttling on the hot path** — every `update()` call rebuilds the full bar string (char-by-char loops, spread `[...bar]`, 5+ `replaceAll` passes) and writes to the terminal (`src/progress-bar.ts:75-79, 91-193`). A tight loop calling `update(i)` per item renders thousands of frames. Implementing the dead `fps` option fixes this.
- ✅ **[FIXED]** **Multi-bar updates are O(bars²) and composite is O(width x bars²)** — each `MultiBarInstance.update()` triggers `renderAll()` which re-renders every bar (`src/multi-progress-bar.ts:27-30, 137-159`); in composite mode `getCompositeChar` re-calls `getBarState()` for every stack entry of every column (`src/multi-progress-bar.ts:225-261`) instead of computing bar percentages once per frame.

#### Feature gaps

- **ETA is a whole-run average with no formatted output** — `calculateETA()` (`src/progress-bar.ts:237-252`) divides total elapsed by total progress, so variable-rate tasks (downloads, network) show wildly wrong ETAs. cli-progress uses a sliding `etaBuffer`; it also offers `{eta_formatted}`, `{duration}`, and `{rate}`/speed tokens that users of this niche expect.
- **`MultiProgressBar.create()` accepts no per-bar options** — width is hardcoded to 40 and format/style cannot differ per bar (`src/multi-progress-bar.ts:85-101`); cli-progress's `multibar.create(total, start, payload, options)` is the reference UX. Note also that `MultiBarOptions.style` and `barGlue` are accepted but never forwarded to created bars, so e.g. braille rounded caps never trigger in multi mode.
- **No `stopOnComplete` / `clearOnComplete` / final render** — `stop()` just unhooks (`src/progress-bar.ts:213-219`); there is no auto-stop at 100%, no option to clear the bar, and no guaranteed final frame — all standard cli-progress options.
- **No color/formatter hooks for single bars** — coloring exists only via `setBarColor` on composite multi-bars (`src/multi-progress-bar.ts:161`); a `formatBar`/`format` function option (cli-progress `options.format` as callback) would let users colorize the filled segment without post-processing the rendered string.

#### Security

- No real findings. The only regex (`BAR_REGEX`, `src/multi-progress-bar.ts:8`) is linear, there is no I/O, no deserialization, and payload interpolation uses plain `replaceAll` on developer-supplied data.

---

## @visulima/spinner — `packages/terminal/spinner`

> @visulima/spinner is a small, well-tested terminal spinner library (Spinner + MultiSpinner over @visulima/interactive-manager with a bundled cli-spinners/Rattles frame catalog) that is structurally healthy but has a misleading "standalone" story, an O(N²) MultiSpinner render loop, and several table-stakes feature gaps vs ora.

#### DX improvements

- ✅ **[FIXED]** **Standalone use renders nothing but keeps the process alive.** The class JSDoc (`packages/terminal/spinner/src/spinner.ts:66`) claims "Works standalone with direct stream output", but with no `InteractiveManager` the interval callback (`src/spinner.ts:260-270`) has no render path — nothing is ever written — and the timer is never `.unref()`'d, so a forgotten spinner holds the event loop open. Either add a direct `process.stderr` fallback or throw/document clearly; unref the interval regardless.
- ✅ **[FIXED]** **`getSpinner` return type lies, and unknown names crash cryptically.** JSDoc says "or undefined if not found" while the signature is non-optional `SpinnerFrame` (`packages/terminal/spinner/src/spinners.ts:163-167`). In plain JS an unknown name surfaces inside `start()` as `TypeError: Cannot read properties of undefined (reading 'frames')` (`src/spinner.ts:258-262`). Validate in the constructor and throw an error that lists valid names.
- ✅ **[FIXED]** **README "Basic Example" demands manager boilerplate.** `packages/terminal/spinner/README.md:55-71` requires constructing two `InteractiveStreamHook`s plus an `InteractiveManager` just to spin — compare ora's one-liner. A `createSpinner()` convenience factory (or documented zero-config path) would remove the biggest adoption hurdle.
- ✅ **[FIXED]** **Deprecated aliases shipping in a 1.0.0-alpha.** `getText`/`getPrefixText` getters (`src/spinner.ts:152,179`) are marked `@deprecated` before any stable release — drop them now instead of carrying API debt into 1.0.

#### Optimizations

- ✅ **[FIXED]** **MultiSpinner runs N timers that each re-render all N spinners.** Every child `Spinner.start()` creates its own `setInterval` calling `multiSpinner.renderAll()` (`src/spinner.ts:260-270`), which redraws every line (`src/spinner.ts:511-531`). With N spinners that's N uncoordinated timers × N-line redraws per tick — O(N²) work, N× the needed redraw rate, and flicker from interleaved phases. A single shared timer owned by `MultiSpinner` is the standard design.
- ✅ **[FIXED]** **Per-frame catalog lookup and duplicated interval code.** `getFrameOutput()` re-resolves `getSpinner(this.#spinnerName)` on every frame (`src/spinner.ts:353`); cache the `SpinnerFrame` in the constructor. `start()` and `resume()` also duplicate the identical interval body (`src/spinner.ts:260-270` vs `331-341`) — extract one private helper. Minor.

#### Feature gaps

- **No plain `stop()` / `stopAndPersist()`.** Only `succeed`/`failed`/`warn`/`info` exist (`src/spinner.ts:279-305`); there is no way to clear a spinner without printing a status icon (e.g., before showing a prompt) — ora and nanospinner both have this. Worse, `MultiSpinner.stop()` and `clear()` force-`succeed()` every child (`src/spinner.ts:489-508`), so stopping a group visually marks failed tasks as successful.
- **No custom frame sets.** `SpinnerOptions.name` only accepts the bundled catalog union (`packages/terminal/spinner/src/types.ts:87`); ora accepts `spinner: { frames, interval }`. User story: a CLI wants a brand-specific animation without forking the catalog.
- **No TTY/CI awareness.** Nothing in `src/spinner.ts` checks `isTTY` or CI env; ora auto-disables animation in non-interactive contexts so CI logs aren't spammed one line per frame. Today consumers must wire `verbose: false` manually.
- **No promise helper.** An `oraPromise`-style API (`spinnerPromise(fn, { text, successText, failText })`) is the most common consumption pattern for this package class and is absent from `src/index.ts`.

#### Security

- No real findings. The package does no I/O beyond the injected `InteractiveManager`, has a single workspace runtime dep, no regex on user input, no exec/spawn, and `cli-spinners` is correctly inlined at build time (verified: no `cli-spinners` import remains in `dist/`).

---

## @visulima/tabular — `packages/terminal/tabular`

> @visulima/tabular renders Unicode/ANSI-aware ASCII tables and grids with span support and zero runtime deps; overall healthy with broad test coverage, but it has a content-sentinel collision bug risk, console-logging diagnostics, and an unsanitized OSC 8 hyperlink sink.

#### DX improvements

- ✅ **[FIXED]** **`"__EMPTY__"` string sentinel can collide with user content** — `normalizeGridCell` maps `null`/`undefined` to the literal string `"__EMPTY__"` (`packages/terminal/tabular/src/utils/normalize-cell.ts:3,22`), and `placeItems` skips layout placement for any cell whose content equals that string (`packages/terminal/tabular/src/grid.ts:283`). A user cell legitimately containing `"__EMPTY__"` is silently treated as an empty cell. Use a `Symbol` or an internal `isEmpty` flag on `InternalGridItem` instead.
- ✅ **[FIXED]** **Library logs diagnostics to the console instead of surfacing errors** — `console.error`/`console.warn` in `packages/terminal/tabular/src/table.ts:151,259` and `packages/terminal/tabular/src/grid.ts:395,459,548,1194`. For a library that renders to stdout, stray stderr noise pollutes consumer CLIs and gives no programmatic signal (e.g. "could not place item" silently drops a cell). Throw, or accept an injectable warn handler.
- ✅ **[FIXED]** **Double-extension source file** — `packages/terminal/tabular/src/utils/border-utilities.ts.ts` is imported as `"./utils/border-utilities.ts"` (`src/grid.ts:19`), the only `.ts`-suffixed import in the package. It works by accident of the bundler resolution but confuses contributors, editors, and grep; rename to `border-utilities.ts` and drop the extension from the import.
- ✅ **[FIXED]** **`Table` is write-only** — no `getRows()`/`clear()`/`removeRow()` accessors (`packages/terminal/tabular/src/table.ts`); cli-table3 exposes rows as an array. Consumers (e.g. live dashboards) must keep a shadow copy of their data to re-render with changes.
- ✅ **[FIXED]** **`GridItem.width` is silently ignored by `Grid`** — documented only in a comment (`packages/terminal/tabular/src/types.ts:68-75`). Either honor it in `calculateColumnWidths` or emit a dev-time warning; a doc comment is easy to miss.

#### Optimizations

- ✅ **[FIXED]** **`terminalSize()` queried on every render** — `Grid`'s constructor calls `terminalSize()` whenever `terminalWidth` is unset (`packages/terminal/tabular/src/grid.ts:138-146`), and `Table.toString()` constructs a fresh `Grid` per render (`src/table.ts:250`), so each uncached table render re-probes the TTY. Cache the lookup module-level (with optional invalidation) or only resolve it lazily when a width constraint is actually needed.
- ✅ **[FIXED]** **Redundant width passes with quadratic first-occurrence scans** — column sizing splits and measures every cell's content in two separate passes (`calculateColumnWidths` `src/grid.ts:1019-1124` and `calculateMinimumColumnWidthsWithGrowableInfo` `src/grid.ts:837-935`), each guarded by `findFirstOccurrenceRow` which walks upward per cell (`src/utils/find-first-occurrence-row.ts`) — O(rows² × cols) for tall span-heavy grids, with `getStringWidth` recomputed on the same lines per pass. Memoize per-cell `{lines, maxLineWidth}` once per render.
- ✅ **[FIXED]** **Unused `ansi-regex` devDependency** — declared in `packages/terminal/tabular/package.json:93` but not referenced anywhere in `src/` or `__tests__/`; drop it.

#### Feature gaps

- **No table-level per-column defaults** — alignment/padding must be set on every cell (`TableOptions` in `packages/terminal/tabular/src/types.ts:177-202` has only `columnWidths`/`rowHeights`). cli-table3's `colAligns` and `table`'s `columns: { alignment }` cover the common "right-align this numeric column" story in one option.
- **No streaming/incremental rendering** — `table` npm offers `createStream` for appending rows without re-printing; `examples/streaming.js` works around it by re-rendering the whole table and rewinding the cursor. A `renderRow()`/stream API would suit log-tailing CLIs and pairs naturally with the existing per-cell caches.
- **Hardcoded width heuristics surprise users** — `computeWrappedContentWidth` bakes in magic constants (20-char threshold, +4/+12 buffers, 12-char floor) for wrap/no-wrap sizing (`packages/terminal/tabular/src/grid.ts:486-526`) with no way to opt out, so measured column widths can differ from `getStringWidth(content)` even with truncation disabled. Expose these as options or document the behavior in the README's "Padding and Width Calculations" section.

#### Security

- ✅ **[FIXED]** **ANSI escape injection via unsanitized `href` (low)** — `packages/terminal/tabular/src/table.ts:279` interpolates the cell's `href` directly into an OSC 8 sequence: `` `]8;;${href}\\...` ``. An attacker-controlled href containing an ST (`\\`) or BEL terminator breaks out of the hyperlink and injects arbitrary escape sequences (cursor movement, screen clearing, fake output) into the consumer's terminal. Strip C0/C1 control characters (or validate URL scheme) before embedding.

---

## @visulima/tui — `packages/terminal/tui`

> @visulima/tui is a React-based, Ink-compatible terminal UI framework with a native Rust diff engine, ~90 subpath-exported components, and broad test coverage (195 test files) — a polished, performance-conscious package whose few real issues are a side-effectful usePersistentState updater, over-broad sideEffects, and some export-map/ergonomics drift.

#### DX improvements

- ✅ **[FIXED]** **Mouse hooks have no `./hooks/*` subpaths.** Every other hook is exposed as `@visulima/tui/hooks/use-*`, but `useMouse`, `useOnMouseClick`, `useMousePosition`, `useElementPosition`, etc. are only re-exported from the bare entry (`packages/terminal/tui/src/ink/index.ts:92-97`). Combined with `dist/ink/**` being marked side-effectful, importing one mouse hook drags in the whole ink barrel. Add matching `./hooks/use-mouse*` subpath exports for consistency with the README's "hooks live at subpaths" story.
- ✅ **[FIXED]** **Dead component barrel with stale guidance.** `packages/terminal/tui/src/components/index.ts` is imported by nothing and exposed by no subpath, and its doc comment says "Consumers should import from `@visulima/tui` (the ink barrel)" — which is no longer true (the ink entry explicitly states components moved to subpaths). Delete the barrel or fix the comment; today it actively misleads contributors.
- ✅ **[FIXED]** **560-line hand-maintained exports map with validation switched off.** `packem.config.ts:21-24` sets `validation.packageJson.exports: false`, so nothing checks that `package.json` exports stay in sync with `src/components/` (~90 entries today). A wildcard `"./components/*"` export or a small generation/validation script would remove an entire class of "forgot to add the subpath" release bugs.
- ✅ **[FIXED]** **README has no component catalog.** The package ships ~90 components and a rich `docs/` set (`docs/components.mdx`, `docs/hooks.mdx`, `docs/ink-compat.mdx`), but `README.md` shows only a handful of hooks and components and never links the docs pages. A one-line component index (or a link to the published docs) is the cheapest discoverability win for a library this large.

#### Optimizations

- ✅ **[FIXED]** **`usePersistentState` runs sync file I/O inside the setState updater.** `packages/terminal/tui/src/ink/hooks/use-persistent-state.ts:155-167` calls `storage.write(...)` from within the `setValue((previous) => ...)` updater. Updaters must be pure: under StrictMode they are double-invoked (double disk writes) and under the concurrent mode this package advertises they can run and be discarded, persisting state that never commits. Each write is also a full synchronous read-modify-write of the whole namespace file (`readFileSync` + `writeFileSync` + `renameSync`, lines 90-117), re-parsing the file from disk on every update. Move persistence into an effect (or post-set callback), keep the parsed object in memory, and consider debouncing writes.
- ✅ **[FIXED]** **`sideEffects` is far broader than the side effect it protects.** `package.json:37-42` marks all of `./dist/components/**`, `./dist/ink/**`, and `./dist/react/**` as side-effectful, but per the package's own docs the only thing that must survive tree-shaking is the native binding loader (`index.js`, loaded via `src/core/native-binding.ts:8`). Components and the ink barrel are pure modules; the current setting prevents bundling consumers (esbuild/rollup-built CLIs) from shaking unused re-exports out of the large `dist/ink` entry. Narrow the list to `index.js` (and any genuinely side-effectful core module).

#### Feature gaps

- **No terminal image support.** There is no sixel, kitty graphics (`_Gf=`), or iTerm2 inline-image (`1337;File`) code anywhere in `src/` (Canvas at `src/components/canvas.tsx` is cell-based drawing only). Ink users reach for `ink-image`, and ratatui ships `ratatui-image`; an `<Image>` component (lazy optional peer, like the existing shiki/marked pattern) would cover "show the logo / render a chart PNG / preview a screenshot in my CLI."
- **No theming system.** With ~90 components, styling is per-prop plus a fixed `VARIANT_CONFIG` (`src/components/variant-config.ts` consumed by `alert.tsx:16-17`, `status-message.tsx`, etc.); there is no `ThemeProvider`/`useTheme` anywhere in `src/`. `@inkjs/ui` ships exactly this. User story: "set my brand colors / a light-vs-dark palette once and have Alert, Badge, Button, Spinner all follow it" — currently impossible without wrapping every component.

#### Security

- No concrete security issues found. Regexes in the input path are anchored and linear (`src/ink/parse-keypress.ts:7-136`, `src/ink/sanitize-ansi.ts:3`), OSC 52 clipboard writes validate targets and base64-encode payloads (`src/ink/clipboard.ts:70-80`), and the React DevTools websocket connects to localhost only, opt-in behind `DEV=true` plus an installed optional peer (`src/ink/reconciler.ts:35-44`, `src/ink/devtools.ts:11`). One robustness nit, not a vulnerability: `createFileStorage` interpolates the developer-supplied `namespace` into a path under `~/.cache` without sanitization (`src/ink/hooks/use-persistent-state.ts:60`) — worth rejecting path separators defensively.

---

# Tooling

## @visulima/find-ai-runner — `packages/tooling/find-ai-runner`

> Detects and invokes 11 AI coding CLIs (Claude, Gemini, Codex, etc.) via env-var/which/known-path lookup plus a non-interactive runner and small CLI; the package is clean, well-tested and well-documented, but detection is slow-by-design (sync sequential subprocess spawning), Windows invocation of .cmd shims is likely broken on the required Node versions, and all providers are hard-coded to run in permission-bypass ("YOLO") mode.

#### DX improvements

- ✅ **[FIXED]** **Windows runs of `.cmd` shims will throw EINVAL** — npm-installed CLIs on Windows resolve to `.cmd` files (`src/index.ts:74,78`, and `where` typically returns the `.cmd` shim), but `runProvider` spawns them without `shell: true` (`src/index.ts:205`) and `detectVersion` uses `execFileSync` the same way (`src/index.ts:94`). Since the CVE-2024-27980 fix (Node >= 20.12 / 22), spawning `.cmd`/`.bat` without `shell: true` throws `EINVAL` — and this package requires Node ^22.14. Detection will report providers as available whose execution then fails.
- ✅ **[FIXED]** **`maxTokens` and `model` are silently ignored by most providers** — `AiRunOptions.maxTokens` (`src/types.ts:35`, "Defaults to 4096") is only consumed by `src/providers/gemini.ts` and `src/providers/codex.ts`; `model` is ignored by `src/providers/amp.ts` and `src/providers/qwen.ts`. Document per-provider option support (a column in the README table) or surface a warning, otherwise callers believe they capped output when they didn't.
- ✅ **[FIXED]** **Timeout error discards captured output; result lacks exit metadata** — on timeout the promise rejects with only the elapsed ms (`src/index.ts:215-220`), throwing away the partial `stdout`/`stderr` already buffered, which is exactly what a user needs to debug a hung agent. Attach partial output to the timeout error, and add `exitCode`/`durationMs` to `AiRunResult` (`src/types.ts:43-50`).
- ✅ **[FIXED]** **CLI accepts mistyped flags silently** — `parseArgs` runs with `strict: false` (`src/cli.ts:27`), so `--mdoel x` or `--max_tokens` are dropped without any diagnostic and the run proceeds with defaults.

#### Optimizations

- ✅ **[FIXED]** **Detection is fully synchronous and sequential** — `detectProvider` shells out to `which`/`where` per command and alternate (`src/index.ts:46-62`), then cold-starts the actual AI CLI for `--version` (`src/index.ts:92-106`, up to 10 s timeout each); `detectAllProviders` maps this serially over 11 providers (`src/index.ts:156`). Real-world `list` pays ~0.5-2 s per installed Node-based CLI just for version banners. Add an async `detectAllProviders` variant that runs providers in parallel, and make version probing opt-in (`{ version: false }`), since most callers only need availability + path.

#### Feature gaps

- **No preference-ordered "find first" helper** — the obvious user story ("give me whatever AI CLI this machine has, preferring claude, then codex...") forces callers to write their own ordering, and the naive `detectAvailableProviders()[0]` returns alphabetical order so `amp` wins by accident (`src/constants.ts:25`, `src/index.ts:162`). Add `findRunner(preference?: AiProviderName[])` that stops at the first hit (also faster than detecting all 11).
- **`runProvider` has no `cwd`, `env`, `AbortSignal`, or streaming** — these agent CLIs operate on a working directory, yet spawn options are fixed to the parent process cwd/env (`src/index.ts:200-205`), so you cannot point a provider at a target repo, pass provider API keys per-run, cancel programmatically, or stream progress (`onStdout` callback) during the up-to-5-minute default run.
- **Codex provider targets the deprecated CLI; default models are stale** — `src/providers/codex.ts:4` builds `<prompt> --approval-mode full-auto --quiet --model o3 --max-tokens N`, which is the retired TypeScript codex CLI surface; the current Rust Codex CLI uses `codex exec "<prompt>"` and rejects `--approval-mode`/`--max-tokens`, so `runProvider("codex")` likely exits non-zero on modern installs. Similarly `claude-sonnet-4-20250514` (`src/providers/claude.ts`) and `anthropic/claude-sonnet-4` (`src/providers/opencode.ts`) are a generation behind; consider defaulting to provider-default (empty model) like the other configs.

#### Security

- ✅ **[FIXED]** **Permission-bypass flags are hard-coded into every provider invocation (medium)** — `--dangerously-skip-permissions` (`src/providers/claude.ts:5`), `--dangerously-allow-all` (`src/providers/amp.ts:6`), `--allow-all-tools` (`src/providers/copilot.ts:7`), `--yolo` (`src/providers/crush.ts:7`, `src/providers/qwen.ts:6`), `--skip-permissions-unsafe` (`src/providers/droid.ts:7`), `--force` (`src/providers/cursor.ts:7`), `--approval-mode full-auto` (`src/providers/codex.ts:4`). There is no opt-out: any prompt run through `runProvider` grants the agent unattended tool/file/shell access on the host, so untrusted content embedded in a prompt (log excerpts, diffs, issue text) that prompt-injects the agent executes with all safety rails disabled. Make bypass opt-in (e.g. `dangerous: true` in `AiRunOptions`) or at minimum call this out prominently in the README beyond the flags table (`README.md` "Supported Providers").

---

## @visulima/package — `packages/tooling/package`

> @visulima/package is a package-resolution and manifest utility (find package.json/monorepo root, detect package manager, parse all four lockfile formats, resolve pnpm catalogs) that is well-structured and well-tested, but has cross-module inconsistencies (bun lockfile naming split, fragile monorepo detection) and an undocumented lockfile API surface.

#### DX improvements

- ✅ **[FIXED]** **Entire `./lockfile` and `./pnpm` modules are undocumented in the README** — `packages/tooling/package/README.md` covers monorepo/package/package-manager/package.json APIs but never mentions `parseLockFile`, `decodeSriIntegrity`, the per-PM parsers, `readPnpmCatalogs`, `isPackageInWorkspace`, `identifyInitiatingPackageManager`, or `generateMissingPackagesInstallMessage`. The subpath exports (`@visulima/package/lockfile`, `/pnpm`, etc. in `package.json` exports map) are also unadvertised, so consumers import everything from the root and lose tree-shaking granularity. The excellent doc comments in `src/lockfile.ts:3-26` would translate almost verbatim.
- ✅ **[FIXED]** **`findPackageJson` shadowing + redundant tree walks** — `src/package-json.ts:227-234` runs a _separate_ full ancestor walk per pattern, so a `package.json` in any ancestor wins over a `package.yaml` sitting right in `cwd`. Passing the pattern array to a single `findUp` call (as `src/lockfile.ts:812` already does) gives correct nearest-directory-wins semantics and cuts up to 4 filesystem walks to 1.
- ✅ **[FIXED]** **Options objects are mutated** — `ensurePackages` rewrites the caller's `options.confirm.message` in place (`src/package-json.ts:655-668`) and `generateMissingPackagesInstallMessage` assigns `options.packageManagers` (`src/package-manager.ts:229`). Reusing the same options object across calls yields surprising behavior; both should copy.
- ✅ **[FIXED]** **No cache invalidation story** — module-level `PackageJsonFileCache`/`PackageJsonParseCache` (`src/package-json.ts:24,35`) never expire, and `writePackageJson` (`src/package-json.ts:358`) doesn't evict the written path, so `cache: true` reads return stale data after a write. Export a `clearPackageJsonCache()` or invalidate on write.

#### Optimizations

- ✅ **[FIXED]** **Package-manager walk-up runs full `normalize-package-data` per directory** — `packageMangerFindUpMatcher` calls `parsePackageJsonSync` (which normalizes) at every ancestor level just to check the `packageManager` field (`src/package-manager.ts:28`), and `resolvePackageManagerFromFile` then re-parses the same file a second time (`src/package-manager.ts:44`). A bare `JSON.parse` + field check in the matcher removes both the normalization cost and the double parse.
- ✅ **[FIXED]** **Quadratic regex on npm lockfile keys** — `NPM_NODE_MODULES_PATH = /.*node_modules\/((?:@[^/]+\/)?[^/]+)$/` (`src/lockfile.ts:101`, `sonarjs/slow-regex` suppressed) backtracks polynomially on deeply nested `node_modules/` paths in attacker-supplied lockfiles (the SBOM use case scans untrusted repos). A `path.lastIndexOf("node_modules/")` slice is linear and simpler — same pattern this repo already adopted for the ANSI-strip ReDoS fix.

#### Feature gaps

- **bun lockfile naming split (correctness bug)** — `lockFileNames` in `src/package-manager.ts:10` lists only legacy `bun.lockb`, while `LOCKFILE_CANDIDATES` in `src/lockfile.ts:800` lists only modern `bun.lock`. Result: `findPackageManager`/`findLockFile`/`findPackageRoot` miss bun ≥1.2 projects (text lockfile is the default now), and `parseLockFile` can't locate legacy projects. Also `npm-shrinkwrap.json` is findable (`package-manager.ts:10`) and parseable by `parseNpmLockFile`, yet absent from `LOCKFILE_CANDIDATES`.
- **Monorepo detection uses a substring check** — `packageJson.includes("workspaces")` (`src/monorepo.ts:58,123`) false-positives on any package.json whose description, script, or dependency name contains the word "workspaces". Parse and check the actual key (the file is already read).
- **No `devEngines.packageManager` support or yarn classic/berry distinction** — competitors (`package-manager-detector`, nypm) detect the newer `devEngines.packageManager` field and report yarn@1 vs berry, which callers need to choose CLI syntax (`--dev` vs `-D`, `yarn add` semantics). `findPackageManager` (`src/package-manager.ts:141`) reads only `packageManager` and lockfile names.
- **pnpm `importers:` edges dropped** — the lockfile parser reads `packages:`/`snapshots:` but skips the workspace `importers:` section (`src/lockfile.ts:431-482`), so SBOM builders get no root-project → direct-dependency edges and cannot tell direct from transitive deps.

#### Security

- ✅ **[FIXED]** **Low — path/content ambiguity in `parsePackageJson(Sync)`** — a string argument is treated as a file path whenever `existsSync(packageFile)` is true (`src/package-json.ts:410,494`); untrusted "JSON content" that happens to name an existing file (e.g. `/etc/hostname`, a relative path inside a scanned repo) is silently read and parsed from disk instead. Separate explicit `content` vs `path` inputs, or only treat strings starting with `{` as content.
- ✅ **[FIXED]** **Low — `getPackageManagerVersion` executes an unvalidated binary** — `execFileSync(name, ["--version"])` (`src/package-manager.ts:173`) accepts any string, including relative/absolute paths (`./node_modules/.bin/evil`); tools that feed it a `packageManager`-derived value from an untrusted repo execute attacker-controlled files. Constrain `name` to the known `PackageManager` union.

---

## @visulima/prisma-dmmf-transformer — `packages/tooling/prisma-dmmf-transformer`

> Converts a Prisma DMMF document into a JSON Schema v7 document (transformDMMF + getJSONSchemaProperty); the package is small, well-tested for the happy path, and healthy overall, but has two real schema-correctness gaps (enum lists, optional enums) and a misleading README example.

#### DX improvements

- ✅ **[FIXED]** **README usage example calls a non-existent private API.** `packages/tooling/prisma-dmmf-transformer/README.md:57` shows `await prismaClient._getDmmf()` — not a public Prisma Client method in any supported major (3–6). Tests use `@prisma/internals` `getDMMF`; the README should show that (it's already a devDependency) or `Prisma.dmmf`.
- ✅ **[FIXED]** **Stringly-typed boolean options.** `TransformOptions` in `src/types.ts:20-25` takes `"true" | "false"` strings (`includeRequiredFields?: "false" | "true"` etc.). That convention leaks from Prisma generator-config (where values are strings) into the programmatic API; callers writing `{ includeRequiredFields: true }` get silently ignored options. Accept `boolean | "true" | "false"` and normalize.
- ✅ **[FIXED]** **`getJSONSchemaProperty` is exported but undocumented and awkward.** `src/index.ts:1` re-exports a curried `(modelMetaData, transformOptions) => (field) => PropertyMap` returning a `[name, definition, metadata]` tuple (`src/get-json-schema-property.ts:181-195`). The README imports it in the example but never uses it, and neither export carries JSDoc.

#### Optimizations

- ✅ **[FIXED]** **Drop `node:assert` for a dead assertion.** `src/get-json-schema-property.ts:1` imports `node:assert` solely for `assert.equal(typeof field.type, "string")` at line 117 — `DMMF.Field["type"]` is always `string` per the types, so the assert can never fire. Removing it makes the package free of Node builtins (it's otherwise pure data transformation), enabling browser/edge use and shrinking the CJS/ESM bundles.
- ✅ **[FIXED]** **Per-field linear scans.** `getEnumListByDMMFType` runs `enums.find(...)` for every field (`src/get-json-schema-property.ts:149`), and `get-json-schema-model.ts:16` does `relationScalarFields.includes(...)` per property — O(models × fields × enums). Building a `Map`/`Set` once in `transformDmmf` is a one-liner; only matters for very large schemas, but it's free.

#### Feature gaps

- ✅ **[FIXED]** **Enum list fields produce wrong schema.** For `Role[]`, `getJSONSchemaType` returns `"array"` but `getItemsByDMMFType` returns `undefined` for any `kind === "enum"` field (`src/get-json-schema-property.ts:133-135`), while the enum list is still attached at the top level (`:176`). Result: `{ type: "array", enum: ["USER","ADMIN"] }` — no `items`, and the `enum` keyword would require the _array itself_ to equal `"USER"`. Valid data like `["ADMIN"]` fails validation. No test covers enum lists.
- ✅ **[FIXED]** **Optional enum fields can never be null.** An optional enum gets `type: ["string","null"]` (`src/get-json-schema-property.ts:48-63`) but the `enum` list contains only the member names (`:146-156`), so `null` fails the `enum` keyword despite the type allowing it. Needs `null` appended to the enum list when the field is optional.
- **BigInt schema contradicts its own default.** BigInt maps to `type: "integer"` (`src/get-json-schema-property.ts:13-15`) while DMMF delivers BigInt defaults as strings, emitted verbatim (`:83-87`) — snapshot-confirmed at `__tests__/transform-dmmf.test.ts:115-118`: `{ default: "34534535435353", type: "integer" }`, which fails self-validation. An option to map BigInt to `type: "string"` (the common JSON practice for >2^53 values) would fix both.
- **No native-type/attribute enrichment.** Users of this niche (prisma-json-schema-generator lineage) increasingly expect `@db.VarChar(255)` → `maxLength`, `@default(uuid())`/`cuid()` → `format`/`pattern`, and `Bytes` → `contentEncoding: "base64"` instead of bare `type: "string"` (`src/get-json-schema-property.ts:20-23`). DMMF exposes `nativeType` and default names, so this is feasible.
- **No OpenAPI 3.0-compatible output mode.** Nullability is expressed as type arrays and `anyOf` with `{ type: "null" }` (`src/get-json-schema-property.ts:63,125`), which OpenAPI 3.0 rejects. A `nullableMode: "openapi"` option emitting `nullable: true` is a frequent downstream request for this kind of transformer.

#### Security

- No real findings. The only shell usage is the test-only helper `execSync` with interpolated fixture paths (`__tests__/helpers.ts:8-14`), which never ships and takes no external input. Shipped code performs pure in-memory transformation with no I/O, no dynamic property writes on user-controlled keys, and no regex risks.

---

## @visulima/secret-scanner — `packages/tooling/secret-scanner`

> Rust/NAPI secret scanner with 1,058 bundled gitleaks+Kingfisher rules and a thin, well-tested TypeScript orchestration layer — overall in excellent health, with gaps mainly in cancellation, repeated-scan caching, and gitleaks feature parity (git history, SARIF).

#### DX improvements

- ✅ **[FIXED]** **No cancellation surface on public scan APIs.** `validateFinding` already accepts an `AbortSignal` (`src/validator/index.ts:37-43`), but the pipeline hardcodes `undefined` (`src/pipeline.ts:156`) and `ScanOptions` (`src/types.ts:35`) has no `signal` field. With `config.validate: true` a scan can fire hundreds of HTTP requests (plus DB-driver connections) with no way for a CLI/editor host to abort mid-flight. Threading one option through `postProcess` would finish plumbing that already exists.
- ✅ **[FIXED]** **Baseline is file-path-only.** `ScanOptions.baseline` (`src/types.ts:37`) only accepts a path; `loadBaselineSet` (`src/baseline.ts:32`) reads from disk. Editor/library consumers using `scanString` must round-trip suppressions through a file. Accepting an inline `Finding[]` or pre-computed fingerprint set — and shipping a `createBaseline(findings)` writer to pair with the exported `fingerprint` — would close the loop.
- ✅ **[FIXED]** **No programmatic tag/preset discovery.** `tag:` selectors throw with a known-tags hint only on a miss (`src/config-loader.ts:138-141`); there is no `listTags()` so consumers must call `listRules()` and aggregate `tags[]` themselves to build a `--list-presets` UX.

#### Optimizations

- ✅ **[FIXED]** **Repeated scans redo all JS-side preparation.** Every `scan`/`scanFiles`/`scanString` call re-runs `resolveConfig` + `gateOptInRules` + `buildRuleMeta` over ~1,058 rules (`src/prepare-scan.ts:117-148`) and re-reads + re-hashes the baseline file (`src/pipeline.ts:252`, `src/baseline.ts:32`). The Rust side caches compiled rulesets, but an editor integration calling `scanString` per save pays the full O(rules) + baseline-IO cost each time. Memoize `PreparedScan` by config identity and the baseline `Set` by path+mtime.
- ✅ **[FIXED]** **Validation pool copies every finding even when validation is impossible.** With `validate: true`, findings whose rule has no validation block still flow through the worker pool and get `{ ...finding, validation: "skipped" }` spreads (`src/pipeline.ts:137-139, 197-213`). Pre-partitioning by `ruleMeta.has(ruleId)` would skip the pool and the per-finding clone for the common no-validator majority.

#### Feature gaps

- **No git history scanning (gitleaks `git` mode).** Public surface is `scan`/`scanFiles`/`scanString` only (`src/index.ts`); nothing reads git revisions. The flagship gitleaks/trufflehog use case — "audit the full history before open-sourcing" or "scan this commit range in CI" with commit/author attribution on findings — requires consumers to hand-roll `git diff --name-only` plumbing (as `vis` does) and loses deleted-but-still-in-history secrets entirely.
- **No report-format helpers.** Findings come back as `Finding[]` with no serializers; gitleaks ships SARIF/JUnit/CSV. A pure `toSarif(findings)` helper would let CI users feed GitHub code scanning directly — `Finding` already carries everything SARIF needs (`src/types.ts:152-180`).
- **No async text scan.** `scanString` runs detection synchronously on the calling thread by design (`src/index.ts:93-102` documents the ~11 ms/550 KB cost and tells users to chunk or use a worker). An async `scanText` on the Rust thread pool — which `scan`/`scanFiles` already use — would make the documented workaround unnecessary for editor/server hosts.

#### Security

- ✅ **[FIXED]** **Validation can hang on hostile or misbehaving endpoints (low).** The 5 s timeout is cleared as soon as the fetch resolves (`src/validator/http.ts:259`), but the body read happens after that with no bound (`src/validator/http.ts:268-282`) — a slow-loris server trickling a body stalls a worker indefinitely. Separately, `observeRateLimit` trusts `Retry-After` with no cap (`src/validator/http.ts:100`), and `PerHostLimiter.acquire` sleeps until that deadline (`src/validator/per-host-limiter.ts:84-98`) — a single `429` with `Retry-After: 86400` pauses all validation for that host for a day. Cap the pause (e.g. 5 min) and keep the abort timer alive through the body read.
- ✅ **[FIXED]** **Opt-in validation sends secrets to URLs defined by rule configs (low).** `runHttpValidation` fetches whatever URL the rule's template renders (`src/validator/http.ts:194-246`). The bundled ruleset is trusted, but a shared/third-party config loaded via `config.path` can add a rule whose `validation.url` points at an attacker host, exfiltrating every matching secret when `validate: true`. The `ScanOptions.validate` JSDoc warns about sending secrets to providers (`src/types.ts:100-104`), but a host allowlist or a "validate bundled rules only" mode would close the untrusted-config channel.

---

## @visulima/task-runner — `packages/tooling/task-runner`

> @visulima/task-runner is a Rust-accelerated monorepo task runner (caching, scheduling, affected detection, Turbo/REAPI remote caches) with unusually thorough tests and defensive code; overall health is strong, with the main gaps in remote-cache verification defaults, archive memory behavior, and a silently-broken Windows shell-detection path.

#### DX improvements

- ✅ **[FIXED]** **`detectScriptShell` silently never works on Windows** — `src/detect-shell.ts:37` calls `execFileSync("npm", ...)` without `shell: true` or a `.cmd` fallback; since Node's CVE-2024-27980 hardening, spawning `npm` (a `.cmd` shim) this way throws ENOENT, which the `catch` swallows. The README explicitly advertises "Honors `npm config set script-shell` (Git Bash, etc.)" — the Git Bash use case is Windows-only, so the advertised feature degrades to platform default exactly where it matters. Use `npm.cmd` + `shell: true` on win32, or read `.npmrc` directly.
- ✅ **[FIXED]** **README API section is thin relative to a 100+ export surface** — `README.md:250-307` documents `defaultTaskRunner` in one sentence and lists exports as bare names. Security-relevant `RemoteCacheOptions` (`signing`, `attestation`, `compression`, `mode`) defined in `src/backends/types.ts` are absent from the README entirely, and the REAPI backend's optional-peer requirement (`@grpc/grpc-js`) is only discoverable via install errors. The `docs/` folder exists but isn't linked from the README.
- ✅ **[FIXED]** **No subpath exports** — `package.json:38-44` exposes only the barrel. Consumers wanting just the lightweight concurrent runner (`runConcurrently`, a concurrently/vite-task replacement) load the full ~850 KB chunked dist including cache, CAS, graph, and backend code in Node (no tree-shaking at require time). Subpaths like `./concurrent`, `./cache`, `./graph` would match how the README itself segments the feature set.

#### Optimizations

- 🟡 **[DEFERRED]** **Archive create/extract buffers entire trees in memory** — `src/archive.ts:43-85` (`collectEntries`) `readFile`s every output file into `TarFileInput[]`, then `nanoCreateTar` materializes the full tar buffer on top (entries + tar bytes live simultaneously, contradicting the comment at lines 219-223). Extract side (`decompressBuffer`, lines 174-185) likewise accumulates the whole decompressed tar. A 1 GB `dist/` cache entry costs ≥2 GB RSS. Streaming tar (or chunked entry feeding) would cap memory for large artifacts that the HTTP backend already streams "for multi-hundred-MB tarballs".
- ✅ **[FIXED]** **`HttpRemoteCache.retrieveAction` reads the downloaded tarball up to 4 times** — `src/backends/http.ts:265-324`: pipeline to disk, `stat`, full HMAC stream (`computeArtifactSignatureStream`), full sha256 stream (`digestFile`), then `putBlobFromFile` copies it again. Folding sha256 + HMAC into the download `pipeline` via PassThrough taps would make hydration single-pass.
- ✅ **[FIXED]** **`TerminalBuffer.#putChar` is O(line²)** — `src/terminal-buffer.ts:185-225` re-walks the line from index 0 (skipping ANSI runs) for every printable character, and `write` calls it per char. PTY-heavy output with long lines (progress bars, webpack stats) goes quadratic. Batch consecutive printable runs and track the last string-index/column pair between calls.

#### Feature gaps

- **No watch mode / daemon** — competitors ship `turbo watch` and the Nx daemon + `nx watch`; `src/incremental-hasher.ts` is even documented as "mtime-based, daemon-compatible", but nothing watches. User story: "save a file, affected tasks re-run automatically" — the affected detection (`src/affected.ts`) and incremental hasher are 80% of the machinery already.
- **Smart lockfile hashing skips Bun and modern pnpm/yarn protocols** — `src/lockfile-hasher.ts` parses npm/pnpm/yarn only; `bun.lock` (JSONC, text format since Bun 1.2) is unsupported, so Bun workspaces silently lose per-package invalidation. The regex parsers also have no handling for `catalog:`, `workspace:`, or `patch:` specifiers (no matches in the file), which this very monorepo uses — catalog-pinned deps can resolve to wrong/missing versions in the hash.

#### Security

- ✅ **[FIXED]** **Signature verification can be bypassed by omitting the header (medium)** — `src/backends/http.ts:157` defaults `verifyOnDownload` to `false`, and lines 257-263 + 292-298 only verify when the server _sends_ `X-Artifact-Signature`. With signing configured (the user's clear intent to authenticate artifacts), a compromised cache server or MITM simply strips the header and unsigned artifacts are extracted into the workspace and replayed as build outputs — remote-cache poisoning is arbitrary code execution in consumers' builds. Turborepo's equivalent (`signature: true`) always verifies. Default `verifyOnDownload` to `true` when `signing.secret` is present.

---

## @visulima/task-runner-client — `packages/tooling/task-runner-client`

> Zero-dependency, 137-line NDJSON hint emitter that lets tools give @visulima/task-runner cache-correctness hints (ignore inputs/outputs, disable caching, track env vars); the package is healthy, well-documented, and tested for both runner/no-runner modes, with only ergonomic and protocol-completeness gaps.

#### DX improvements

- ✅ **[FIXED]** **Export `HINTS_ENV` and an `isManaged()` predicate.** The env-var name is a private literal in `packages/tooling/task-runner-client/src/index.ts:13`. Tools that want to branch ("only compute expensive hint paths when actually under the runner") or write integration tests must hardcode `"TASK_RUNNER_HINTS"` — the package's own test does exactly that (`__tests__/index.test.ts:9`). A one-line `export const isManaged = (): boolean => Boolean(process.env.TASK_RUNNER_HINTS)` plus the constant closes this.
- ✅ **[FIXED]** **Export a named options type.** `getEnv`/`getEnvs` take an inline `{ tracked?: boolean }` (`src/index.ts:113,130`); wrapper authors can't reference it. Export `interface TrackOptions { tracked?: boolean }`.
- ✅ **[FIXED]** **Test gaps for the glob engine and pollution defense.** `__tests__/index.test.ts` covers both modes well, but `matchEnv`'s regex escaping (`src/index.ts:39-53`) has no test that `A.B*` doesn't match `AXB...`, and the deliberate `__proto__` defense (`src/index.ts:57-69`) has no regression test pinning it.

#### Optimizations

- ✅ **[FIXED]** **Dedupe repeated hints before writing.** `emit` runs `appendFileSync` — an open/write/close syscall trio — per call (`src/index.ts:29`), and ops are idempotent: a tool calling `getEnv("CI")` inside a per-file loop appends thousands of identical `trackEnv` lines the runner just aggregates (`packages/tooling/task-runner/src/cache-hints.ts:133-136`). A module-level `Set<string>` keyed on the serialized hint (reset when `TASK_RUNNER_HINTS` changes) makes repeat calls free without sacrificing the crash-durability of the first write.

#### Feature gaps

- **Resolve relative paths client-side.** `ignoreInput`/`ignoreOutput` ship the raw string (`src/index.ts:79-91`), and the runner resolves it against the child's _initial_ cwd (`packages/tooling/task-runner/src/cache-hints.ts:95-128`). A tool that calls `process.chdir()` before hinting gets silently wrong ignore roots, contradicting the README's "resolved against the task's working directory" promise (`README.md:69`). Resolving with `node:path.resolve()` at emit time keeps zero deps and removes the ambiguity.
- **Client never reads the protocol-version handshake.** The runner exports `TASK_RUNNER_PROTOCOL` / version `"1"` explicitly so clients can degrade across breaking wire changes (`packages/tooling/task-runner/src/cache-hints.ts:13-22`), but the client never consults it (`src/index.ts` has no reference). Reading it now — even just to gate future v2 ops — is what makes the escape hatch actually usable later.
- **No positive hints: `trackInput(path)` / `trackOutput(path)`.** The API can only _subtract_ from inferred inputs/outputs. Tools often know inputs the tracer can't see — files read by an untracked grandchild process or network-derived state (known tracer gaps on macOS/Windows child propagation). vite-task-style hint APIs gain a lot from the additive direction; the runner's `Hint` union (`cache-hints.ts:32-37`) skips unknown ops, so this is forward-compatible to add.
- **`disableCache()` carries no reason.** The runner reports only `disabled-by-task` in the run summary (`packages/tooling/task-runner/src/run-summary.ts:25`). `disableCache(reason?: string)` would make "why did my cache stop hitting?" debugging tractable, and an extra JSON field is ignored by current runners, so it's wire-safe.
- **No custom cache-key input.** A `trackValue(key, value)` op (Gradle/Bazel-style custom inputs) would cover non-file, non-env determinism inputs — DB schema revision, remote API version, tool flags computed at runtime — that today force a blunt `disableCache()`.

#### Security

No findings. The two obvious risk spots are already handled correctly: `matchEnv` escapes every regex metacharacter except `*` before compiling (`src/index.ts:53`), and the `__proto__`/`constructor` prototype-pollution vector is explicitly neutralized via the Map + `Object.fromEntries` materialization (`src/index.ts:57-69`). The append target comes from the runner-controlled environment, and all write failures are swallowed by design.

---

## @visulima/tsconfig — `packages/tooling/tsconfig`

> @visulima/tsconfig is a get-tsconfig-derived library that finds, parses (with extends/JSONC/${configDir} resolution), and writes tsconfig.json files; the core is solid and well-tested (~3000 test lines, live-tsc parity), but the README is stale/incorrect and a few real behavioral inconsistencies remain (PnP issuer, silent no-op tscCompatible value, unvalidated JSONC).

#### DX improvements

- ✅ **[FIXED]** **README usage examples are wrong on every API** — `packages/tooling/tsconfig/README.md` (~lines 70–90): `writeTsConfig` and `readTsConfig` examples import from `@visulima/package` instead of `@visulima/tsconfig`; `readTsConfig` is shown with `await` but is synchronous; the example shows `tscCompatible: false`, which is not in the option's type. The `typescriptVersion`, `cache`, and `configFileName` options, plus `findTsConfigSync`/`writeTsConfigSync`, are undocumented.
- ✅ **[FIXED]** **README claims "Validates and throws parsing errors" but malformed JSONC is silently tolerated** — `src/read-tsconfig.ts:19` and `src/utils/resolve-extends-path.ts:19` call jsonc-parser's `parse()` without an `errors` array, so broken tsconfigs yield a silently partial config; only a non-object root throws (`read-tsconfig.ts:155-157`). Collect `ParseError[]` and throw with position info, or correct the README.
- ✅ **[FIXED]** **`tscCompatible: "5.3"` is a silent no-op** — accepted by the type at `src/read-tsconfig.ts:697`, but absent from every version gate (`:421`, `:503`, `:562`, `:570`), so passing it applies nothing version-specific. Either add it to the gates or drop it from the union.
- ✅ **[FIXED]** **`configDirectoryPlaceholder` is not re-exported** — exported in `src/read-tsconfig.ts:736` but missing from `src/index.ts`, so consumers who need to detect un-interpolated `${configDir}` values must deep-import from dist internals.
- ✅ **[FIXED]** **Original parse error is swallowed** — `src/read-tsconfig.ts:147-153` catches and rethrows `Cannot resolve tsconfig at path` with no `{ cause }`, hiding whether the failure was ENOENT, EACCES, or a read error.

#### Optimizations

- ✅ **[FIXED]** **Async `findTsConfig` does all I/O synchronously after findUp** — `src/find-tsconfig.ts:54` calls the sync `readTsConfig`, whose whole `extends` chain uses `readFileSync`/`statSync` (`src/read-tsconfig.ts:19`, `src/utils/resolve-extends-path.ts:86`). For deep extends chains the async API blocks the event loop; an async parse path (or documenting the limitation) would make the `await findTsConfig()` signature honest.
- ✅ **[FIXED]** **Shared global cache never invalidates** — `src/find-tsconfig.ts:8` module-level `TsConfigFileCache` is used whenever `cache: true`; keys are path+options with no mtime component, so a long-lived process (dev server, language tool) serves stale configs after a tsconfig edit, and the map grows unbounded.
- ✅ **[FIXED]** **Dead/suspicious `outDir` replace** — `src/read-tsconfig.ts:791-793` strips `${configDir}` from `outDir` _after_ the interpolation loop at `:756-764` has already rewritten any placeholder-prefixed value; if it ever fires (mid-string placeholder) it produces a mangled path. Remove or add a test that justifies it.

#### Feature gaps

- **No paths/files matcher utilities (vs get-tsconfig)** — `get-tsconfig` ships `createPathsMatcher` and `createFilesMatcher`, the two features most consumers of a tsconfig parser need next (resolving `paths` aliases; checking whether a file is covered by `include`/`exclude`). This package exposes only find/read/write (`src/index.ts`), so bundler/tool authors must reimplement matching on top of the parsed output.
- **jsconfig fallback search order differs from tsconfig precedent** — `src/find-tsconfig.ts:32-40` runs a full upward walk for `tsconfig.json` first, then a second full walk for `jsconfig.json`, so a `tsconfig.json` several directories up beats a `jsconfig.json` sitting in `cwd`; get-tsconfig checks both names per directory. The fallback also still applies when a custom `configFileName` is supplied, which is surprising.

#### Notable bug (cross-cutting)

- ✅ **[FIXED]** **Yarn PnP issuer inconsistency in extends resolution** — `src/utils/resolve-extends-path.ts:25-31` defines a duplicate local `getPnpApi` hard-coded to `process.cwd()`, while `src/utils/pnp.ts:22` correctly accepts the config directory as issuer (and `typescript-version.ts:33` uses it). Under PnP, `extends` package resolution breaks when the process cwd is outside the workspace containing the tsconfig; reuse `utils/pnp.ts` with `directoryPath`.

---

## @visulima/vis — `packages/tooling/vis`

> @visulima/vis is a sprawling but unusually mature monorepo dev-toolkit CLI (task running, caching, audit/SBOM, secrets, AI integrations) with ~350 test files, lazy-loaded command handlers, and careful supply-chain hygiene — overall healthy, with a handful of Windows-specific spawn hardening issues as the only real security exposure.

#### DX improvements

- ✅ **[FIXED]** **`readJsonFile` errors lose the file path** — `packages/tooling/vis/src/util/toolbox-fs.ts:12-13` does a bare `JSON.parse(await fs.readFile(path))`; a malformed JSON file surfaces as `Unexpected token …` with no indication of _which_ file. Since this is the pilot helper for the toolbox.fs handler migration, wrap the parse and rethrow with the path — every migrated command inherits the fix.
- ✅ **[FIXED]** **README under-documents the programmatic surface** — the `./config` subpath export (`packages/tooling/vis/src/config/index.ts`) ships 15+ symbols (`definePlugin`, `otelPlugin`, `SECURITY_DEFAULTS`, `loadVisConfig`, `defineTaskConfig`, …) and `./generate` exists too, but `README.md` only shows `defineConfig` once in passing (line ~175, installer-backend example). A short "Configuration API" section linking `docs/configuration.mdx` / `docs/guides/plugins.mdx` would make the plugin system discoverable from npm.
- ✅ **[FIXED]** **Greedy `v` bin name** — `package.json:63` claims the global `v` binary, which collides with the V language compiler and a very common shell alias. Worth a README note (or demoting to docs-recommended alias like the existing `docs/guides/shell-alias.mdx`). Related nit: `EXCLUDED_COMMANDS` in `src/util/upgrade-check.ts:36` lists `self-update`, which is not a registered command under `src/commands/`.

#### Optimizations

- ✅ **[FIXED]** **Head-of-line blocking in registry version fetches** — `packages/tooling/vis/src/util/catalog.ts:1486-1503` processes packages in fixed chunks of `concurrency` via `await Promise.allSettled(batch)` per iteration: one slow registry response (timeout is 15 s, `catalog.ts:1068`) stalls the entire next batch. A sliding worker pool (N in flight, refill on settle) would meaningfully cut `vis check` wall time on large catalogs with a flaky private registry.
- ✅ **[FIXED]** **`spawnTee` cap counts UTF-16 code units, not bytes** — `packages/tooling/vis/src/util/spawn-tee.ts:77-88` documents a 256 KiB byte cap but measures `output.length + text.length` on decoded strings, and rebuilds `output + text` before slicing once over the cap. Harmless functionally, but tracking byte length (or slicing the incoming chunk first) avoids the repeated full-buffer concat per chunk on chatty installs.

#### Feature gaps

- **No `vis release`** — Nx (`nx release`) and moon both ship version-bump + changelog + publish orchestration; vis covers everything around it (affected detection, attest, audit, hooks) but has no release command under `src/commands/`. The prior attempt (PR #620) never landed in installable form, so this remains the most-asked-for capability gap vs. Nx for teams not already on semantic-release.
- **Shell-history integration skips Windows entirely** — `packages/tooling/vis/src/util/shell-history.ts:26-28` returns early on win32, but PowerShell's PSReadLine history is a plain append-only text file (`ConsoleHost_history.txt`), so the interactive-picker → up-arrow replay story (a nice differentiator) could work for the large Windows audience with ~10 lines.

#### Security

- ✅ **[FIXED]** **[medium] `shell: true` on Windows joins repo-derived args unquoted** — `packages/tooling/vis/src/util/spawn-tee.ts:67` and `packages/tooling/vis/src/util/hadolint/index.ts:248` set `shell: process.platform === "win32"`, so Node concatenates the args array into a cmd.exe line without quoting. For hadolint the args are Dockerfile paths discovered in the repo (`runHadolint`, `hadolint/index.ts:244`); a directory legally named `app & calc` in a cloned untrusted repo executes on `vis docker lint` under Windows. The hadolint binary is a real `.exe` (not a `.cmd` shim), so the shell flag is unnecessary there; for the PM shim case in `spawnTee`, quote args or resolve the shim path explicitly.
- ✅ **[FIXED]** **[low] hadolint download verifies a same-origin checksum** — `packages/tooling/vis/src/util/hadolint/index.ts:114-127` fetches the `.sha256` sidecar from the same GitHub release as the binary, so a compromised release (or successful MITM of one origin) defeats verification. The version is already pinned (`HADOLINT_VERSION`, line 32); pin the per-asset digests in source too, making the check attacker-independent.
- ✅ **[FIXED]** **[low] zsh/bash history writers don't escape newlines** — `packages/tooling/vis/src/util/shell-history.ts:62,70` append the picked command line verbatim; only the fish writer (line 76) escapes `\n`. A task name containing a newline (repo-controlled via vis config) injects an arbitrary extra entry into `~/.zsh_history` / `~/.bash_history` that the user may later re-execute via up-arrow or Ctrl-R. Strip/escape control characters like the fish path does.

---

## @visulima/vis-mcp — `packages/tooling/vis-mcp`

> @visulima/vis-mcp is a thin, well-tested MCP stdio server that exposes 12 read-only vis CLI tools to AI agents; the code is clean and disciplined (single exec boundary, canonical response shape, ~90 tests), but the README is stale and the newer tools skip the argv-injection guards the older ones pioneered.

#### DX improvements

- ✅ **[FIXED]** **README documents 8 tools but the server registers 12** — `README.md` (tool table, ~lines 95–107) omits `audit`, `advisory_status`, `lint`, and `fmt`, and still says "All eight tools are read-only." The empty `## Related` section (line ~109) renders as a dangling heading. The package CLAUDE.md public-surface list is similarly stale (omits `registerLint`/`registerFmt`/`registerAudit`/`registerAdvisoryStatus`/template registrars). For an agent-facing package whose README is how humans decide what to expose, this is the highest-value doc fix.
- ✅ **[FIXED]** **No `structuredContent`/`outputSchema` on tool results** — `src/response.ts:17-26` serializes every payload to a JSON string in a `text` block. The MCP SDK supports `outputSchema` + `structuredContent`, which lets clients (Claude, Cursor) validate and render typed results instead of re-parsing strings — and the zod schemas already exist in `src/tools/lint.ts:32`, `src/tools/audit.ts:27`, `src/tools/advisory-status.ts:18`; they're just not registered.
- ✅ **[FIXED]** **No version-compatibility check on the resolved vis CLI** — `src/server.ts:38-80` resolves whatever `@visulima/vis` is installed, but the peer dep is pinned exact (`package.json:105`). An older vis without `--format json` on `lint`/`fmt` produces opaque "no JSON output" errors (`src/tools/lint.ts:96`) instead of "vis X.Y is too old, vis-mcp requires Z".

#### Optimizations

- ✅ **[FIXED]** **`describe_project` and `list_targets` respawn the full `vis list` subprocess per call and filter in JS** — `src/tools/describe-project.ts:25` runs `vis list --json` (full workspace graph, fresh Node boot each time) just to `.find()` one project; `src/tools/list-targets.ts:27-28` does the same with `.filter()`. Either forward a `--query name=<x>` filter to the CLI, or add a short-TTL memo of the list payload keyed on workspaceRoot — agents commonly call `list_projects` then `describe_project` back-to-back, paying double subprocess cost (typically hundreds of ms each).
- ✅ **[FIXED]** **Unbounded stdout accumulation in the exec layer** — `src/exec.ts:50-73` concatenates child stdout/stderr with no size cap (no `maxBuffer` equivalent). A misbehaving vis subcommand streaming gigabytes would balloon the MCP server's memory before the 120s timeout fires. A simple byte ceiling that kills the child and errors would bound it.

#### Feature gaps

- **No run-discovery tool** — `get_run_logs` (`src/tools/get-run-logs.ts:25`) accepts a `runId` but there is no `list_runs` tool, so an agent can only ever read "latest" or guess IDs. A tool that lists `.task-runner/runs/*.json` with timestamps/status would unlock "compare this run to the one before lunch" workflows (nx-console's MCP exposes run history for exactly this).
- **No `affected` tool** — agents scoping work want "which projects changed since `main`" before deciding what to lint/build. `lint`/`fmt` already forward `--since` (`src/tools/lint.ts:77`), so the CLI plumbing exists; a read-only `list_affected(since)` tool is the natural companion and a staple of comparable monorepo MCP servers.
- **Tools only — no MCP resources or prompts** — run summaries and project metadata are natural MCP _resources_ (URI-addressable, client-cacheable, subscribable) rather than tool calls; `src/server.ts:108-121` registers only tools. Exposing `vis://runs/{runId}` and `vis://projects/{name}` resources would let clients embed workspace state in context without burning tool-call round-trips.

#### Security

- ✅ **[FIXED]** **Argv flag injection bypasses the read-only contract (medium)** — `src/validation.ts:18-20` documents the exact threat ("a leading `-` would be parsed as a CLI flag by the vis CLI") and gates `taskId`/`runId` accordingly, but the newer tools skip the guard: `src/tools/describe-template.ts:41` passes `name` as a bare positional to `vis generate <name> --describe`, and `src/tools/lint.ts:81` / `src/tools/fmt.ts:75` splat user-supplied `files` entries directly into argv. An LLM-supplied `files: ["--fix"]` turns the lint tool — annotated `readOnlyHint: true` and described as "never applies fixes" — into a write operation; a `name: "--force"`-style value reaches `vis generate`'s flag parser. Spawn is argv-form (no shell), so this is flag injection rather than command injection, but it breaks the security annotation clients rely on for auto-approval. Fix: reject leading-`-` values (reuse the `isValidRunId`-style guard) or insert a `--` separator before positionals.

---

# Shared

## @shared/utils — `shared/utils`

> @shared/utils is a private, source-only helper library (CLI error rendering, shiki highlighting, language/editor maps) inlined by the error-debugging packages; it works but has zero tests, no README, and is invisible to the Nx affected graph because consumers import it via deep relative paths.

#### DX improvements

- ✅ **[FIXED]** **Package is invisible to the Nx affected graph.** Consumers import via deep relative paths (`packages/error-debugging/error-handler/src/handler/cli-handler.ts:1` uses `../../../../../shared/utils/cli-error-builder`; same pattern in `packages/error-debugging/ono/src/index.ts:3` and `packages/error-debugging/vite-overlay/src/index.ts:12`), and none of the three consumers list `shared-utils` in `implicitDependencies` (`packages/error-debugging/error-handler/project.json:7` is `[]`). Changes to these helpers won't trigger affected builds/tests for any consumer. Either import via the `@shared/utils` workspace name (it's declared in `shared/utils/package.json` but never used anywhere) or add the implicit dep to all three consumers.
- ✅ **[FIXED]** **No index.ts, no `exports` field, no README, no `__tests__/`.** Six modules sit at the directory root with no entry point or docs; `shared/utils/project.json:4` declares `"sourceRoot": "shared/utils/src"`, a directory that does not exist. Contrast with sibling `shared/xxh3`. The `cli-error-builder` snippet/solution pipeline is completely untested despite backing the public `cliHandler` export of `@visulima/error-handler`.
- ✅ **[FIXED]** **`debug` option is a silent no-op.** `shared/utils/cli-error-builder.ts:26-28` accepts `debug` through `BaseCliOptions` and then does nothing with it (empty if-block with a comment). Users setting `debug: true` on `cliHandler` get no extra output; either log via the injected `logger` or drop the option.

#### Optimizations

- ✅ **[FIXED]** **Unbounded module-level cache of full file contents.** `shared/utils/get-file-source.ts:4` caches every fetched/read source string forever in a module `Map`. In a long-running server (ono inspector, error-handler in prod) every distinct stack-frame URL adds an entry that is never evicted; `clearFileSourceCache` exists but no consumer calls it. Use an LRU cap (even a simple max-size check) or cache only the last N files.
- ✅ **[FIXED]** **Dead/duplicated branches in language detection.** `shared/utils/find-language-based-on-extension.ts:14-16` handles `cjs`/`mjs` via `ALTERNATIVE_JS_EXTS`, making the identical `case "cjs"/"mjs"` arms at lines 24-25 unreachable; same pattern for `mdoc` vs the markdown case. Also `shared/utils/cli-error-builder.ts:23` uses `for await` over a plain sorted array, forcing a microtask per iteration — a plain `for...of` with `await` inside is equivalent and clearer.

#### Feature gaps

- **Plain absolute paths never get a snippet.** `shared/utils/get-file-source.ts:9-11` returns `undefined` unless the frame starts with `http|https|file|data:` — but CJS and many Node/V8 stack frames are bare paths (`/home/user/app/index.js`), so solution finders receive `snippet: ""` for the most common case (`cli-error-builder.ts:38`). Adding a `path.isAbsolute(file)` branch that reads from disk would make hints dramatically better for ordinary Node errors.
- **Language map covers only web languages.** `shared/utils/get-language-import.ts:7-31` and the extension switch omit `yaml`, `toml`, `py`, `go`, `rs`, `rb`, `php`, `graphql`, `dockerfile` — all plausible in stack traces of polyglot/monorepo tooling. Worse, the `default` arm at `find-language-based-on-extension.ts:90-92` returns `"javascript"` for unknown extensions, so a `.py` frame gets mis-highlighted as JS; falling back to `"text"` would be honest.
- **Editor map is missing current editors.** `shared/utils/editors.ts` includes Zed and Cursor but not Windsurf, JetBrains Fleet, Helix, or Kiro — relevant since ono's editor-selector (`packages/error-debugging/ono/src/error-inspector/components/header-bar/editor-selector.ts`) is driven by this enum.

#### Security

- ✅ **[FIXED]** **[low] Stack-frame URLs are fetched without an allowlist.** `shared/utils/get-file-source.ts:31` does `fetch(file)` for any `http(s):`/`data:` string appearing as a stack-frame path. `error.stack` is just a string and can be attacker-influenced when servers render errors derived from untrusted input (the ono inspector serves this over HTTP), making this a server-side request forgery surface; combined with the unbounded cache (line 4/37) it also stores arbitrary remote response bodies in memory indefinitely. Consider restricting remote fetches to `file:` URLs by default and gating http(s) behind an opt-in.

---

## @shared/xxh3 — `shared/xxh3`

> Private shared pure-BigInt xxh3-128 implementation (vendored from xxh3-ts) used as the JS fallback for task-runner's native Rust hasher; small and well-structured, but it has a verified parity bug for 1-3 byte inputs and its tests check only output format, not correctness.

#### Correctness (verified bug)

- ✅ **[FIXED]** **Hash diverges from the native Rust addon for 1–3 byte inputs with a high middle byte** — `shared/xxh3/xxh3.ts:204`: `BigInt(data.readUInt8(len >> 1) << 24)` overflows JS int32 when the byte is >= 0x80 (e.g. `0xbf << 24` is negative), producing a negative BigInt that corrupts the low-64 lane of `combined`. Verified empirically against `task-runner-native.linux-x64-gnu.node`: `[0x80]` → JS `…66abb704c2b94dbe` vs native `…6b148c0872500941`; `[0x01,0xbf]` also mismatches, while `[0x01,0x7f,0x02]` and every other length class (4–8, 9–16, 17–128, 129–240, >240 bytes) match exactly. This breaks the module's stated guarantee ("identical hash output regardless of execution mode") and means task-runner cache keys differ between native and JS fallback modes for tiny non-ASCII inputs (e.g. hashing `"é"`). Fix: `(BigInt(data.readUInt8(len >> 1)) << 24n)`.

#### DX improvements

- ✅ **[FIXED]** **Tests never assert correctness, only shape** — every assertion in `shared/xxh3/__tests__/xxh3.test.ts` is either `/^[\da-f]{32}$/` or self-consistency; the line-204 bug passes all 15 tests. Add known-answer vectors per length class (empty input is `99aa06d3014798d86001c324468d497f`, confirmed against the Rust addon) including bytes >= 0x80, and a parity test against the native binding when it is present locally.
- ✅ **[FIXED]** **No README** — the directory has no README documenting the parity contract with the Rust addon, the vendoring provenance (xxh3-ts v2.0.1), or how to regenerate/verify test vectors. For a module whose whole purpose is bit-exact parity, that contract should be written down (`shared/xxh3/`).
- ✅ **[FIXED]** **`xxh3Hash` accepts only `Buffer` while `Xxh3Hasher.update` accepts `string | Buffer`** — `shared/xxh3/xxh3.ts:366` vs `:378`. Consumers like `packages/tooling/task-runner/src/utils.ts` mirror the native `hashString(string)`; accepting `string | Buffer` in `xxh3Hash` would remove `Buffer.from()` boilerplate at every call site.

#### Optimizations

- ✅ **[FIXED]** **Per-stripe Buffer view allocations on the long-hash hot path** — `getView` (`shared/xxh3/xxh3.ts:42`) allocates a fresh `Buffer` object per call; `accumulate` (`:111-117`) creates two views per 64-byte stripe, so hashing a 1 MB file allocates ~32k throwaway Buffers. Threading an integer offset through `accumulate512`/`accumulate`/`scrambleAcc` instead would eliminate nearly all GC pressure in the path task-runner uses for file hashing.
- ✅ **[FIXED]** **`bswap64` allocates a scratch Buffer per call** — `shared/xxh3/xxh3.ts:44-50` uses `Buffer.allocUnsafe(8)` + write/read; a pure BigInt shift/mask swap (like `bswap32` at `:52-59`) is allocation-free.
- ✅ **[FIXED]** **`mergeAccs` allocates four `BigUint64Array` copies per merge** — `shared/xxh3/xxh3.ts:141-144` (`acc.slice(0/2/4/6)`), and `hashLong128b` calls it twice per hash; `mix2Accs` could take a start index instead.

#### Feature gaps

- **Seed is implemented but not exposed** — `xxh3_128` accepts a `seed` parameter (`shared/xxh3/xxh3.ts:329`) yet the public `xxh3Hash`/`createXxh3Hasher` hardcode seed 0. If exposed, note that `hashLong128b` (`:344`) ignores the seed entirely (reference XXH3 derives a custom secret for seeded long inputs), so seeded hashes > 240 bytes would silently be wrong today — either wire it through correctly or remove the dead parameter.
- **`Xxh3Hasher` has no `reset()` and `digest()` is not terminal** — `shared/xxh3/xxh3.ts:375-391`: chunks keep accumulating after `digest()`, unlike `node:crypto` hashers which throw. Either document the reusable semantics or add `reset()` and a post-digest guard to prevent silent misuse.

---
