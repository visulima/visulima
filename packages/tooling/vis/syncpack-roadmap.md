# vis — syncpack Absorption Roadmap

Derived from `syncpack-analysis.md`. Nine items ordered by leverage × effort × demand, scoped specifically to the syncpack feature surface vis was missing.

Demand grade matches `priority-roadmap.md`: **★★★** = 3+ competitor signals, **★★** = 2, **★** = 1 strong signal or novel. Sources: `competitive-analysis.md` Section 7.2 Theme L, 8.3 #1, 8.4, plus the syncpack feature audit in `syncpack-analysis.md` §3.

**Status snapshot:** items 1, 2, 3, 4, 6, 7, 8, 9 ✅ shipped (under `vis lint`, `vis sync package-json-fields`, `vis json deps`, and `vis sort-package-json` flags). Item 5 (full versionGroups/semverGroups DSL) remains deferred. Bonus `vis lint --redefine-root` shipped outside the original 9. The original recommendation to fold lint flags into `vis check` was reversed during implementation in favour of a dedicated `vis lint` command — see analysis §5.

---

## Top items — ranked

### 1. Workspace-protocol enforcement ✅ shipped

**Leverage:** Correctness foundation. **Effort:** S (1–2 days). **Demand:** ★★

Every internal dep — i.e. one whose name matches a workspace package — must use `workspace:*` (or `workspace:^` / `workspace:~` / exact).

Shipped as `vis lint --workspace-protocol` (not the originally proposed `vis check --workspace-protocol` — the namespace decision was reversed; see top status snapshot). Validated the cross-package dep iterator that items 2, 4, 6, 7, 8 reuse. Implementation: `src/util/workspace-protocol-lint.ts`, iterates every `dependencies`/`devDependencies`/`peerDependencies` entry, intersects against the workspace-package-name set built by `discoverWorkspace` (`src/config/workspace.ts`). Misses get a one-line auto-fix; the fix specifier is configurable via `--fix-specifier`.

**Shipped wire shape:**

```bash
vis lint --workspace-protocol                              # report drift, exit 1 on miss
vis lint --workspace-protocol --fix                        # rewrite to workspace:*
vis lint --workspace-protocol --fix --fix-specifier=^      # use workspace:^ instead
```

**Sources:** `competitive-analysis.md` 7.2 Theme L; manypkg's `INTERNAL_MISMATCH` rule.

---

### 2. Workspace-version drift ✅ shipped

**Leverage:** Flagship port. **Effort:** M (1–2 weeks). **Demand:** ★★

The single biggest syncpack capability vis was missing: detect "the same dep declared at different versions across packages" by reading every package.json — distinct from `vis doctor`'s `findDuplicateDependencies` (`src/security/dependency-scan.ts:92`), which fires post-install on transitive duplication via the lockfile.

Shipped as `vis lint --workspace-versions`. Default policy is highest-semver-wins per dep across `dependencies` ∪ `devDependencies` ∪ `peerDependencies`. The `--fix` pass mutates package.json (and `pnpm-workspace.yaml` catalog entries when `--resolve catalog` is set) rather than calling `pnpm dedupe`. Catalog migration (item 7) and `--propose-min` shipped in the same release. Implementation: `src/util/workspace-versions-lint.ts` plus the shared iterator in `src/util/workspace-deps.ts`.

**Shipped wire shape:**

```bash
vis lint --workspace-versions                                          # report; exit 1 on drift
vis lint --workspace-versions --fix                                    # rewrite package.jsons
vis lint --workspace-versions --dep react                              # scope to one name
vis lint --workspace-versions --resolve highest|lowest|catalog
vis lint --workspace-versions --resolve catalog --propose-min 3        # propose new catalog entries
vis lint --pin react@18.2.0                                            # one-off pin (auto-enables this lint)
```

`--resolve catalog`: when a sibling catalog already pins the dep, rewrite the offending instances to `catalog:`. With `--propose-min N`, propose new catalog entries when ≥N packages declare the same range outside the catalog.

**Sources:** `competitive-analysis.md` 7.2 Theme L (rushstack#1454, syncpack core); `syncpack-analysis.md` §4 A1.

---

### 3. `vis sync package-json-fields` ✅ shipped (syncpack#168)

**Leverage:** Real-world papercut killer. **Effort:** S (3–5 days). **Demand:** ★★

Shipped as a second kind on the existing `vis sync` argument-router. Aggregates metadata fields from each package.json and enforces consistency vs the root.

Default fields: `engines`, `license`, `author`, `repository.{type,url,directory}`, `bugs.url`, `homepage`, `funding`. Headline behaviour: `repository.directory` is set to each package's path relative to the workspace root automatically — single most common drift in real monorepos and a Lerna-era footgun.

The repository-shorthand collapse (`formatBugs` / `formatRepository`) didn't land here as originally proposed; it lives on `vis sort-package-json` instead (item 9), which is the right home — sync stores canonical object form, sort-package-json renders shorthand on write.

**Shipped wire shape:**

```bash
vis sync package-json-fields                          # write
vis sync package-json-fields --check                  # exit 1 on drift
vis sync package-json-fields --fields engines,license # subset (note plural --fields)
```

**Naming caveat:** the option flag shipped as `--fields` (plural), not `--field` as originally proposed. `vis sync package-json-fields` still reads ambiguously vs syncpack's verb (a user might expect _outbound_ version sync); watch for confusion in user feedback. Documented in `--help`.

**Sources:** syncpack#168 (open ask, 5+ years); manypkg metadata checks.

---

### 4. Banned-deps policy ✅ shipped

**Leverage:** Cheap CI gate. **Effort:** S (1 day). **Demand:** ★

Shipped as `vis lint --banned-deps`. Reads a list of forbidden dep names from `policy.bannedDeps`; reports any package.json containing one; `--fix` removes the entry. Glob support (`legacy-*`, `**deprecated**`). One-off `--ban left-pad --ban request` ad-hoc form for CI gates without touching config.

Stops short of full `versionGroups[].isBanned` semantics (with `dependencies` + `dependencyTypes` + `packages` matchers — see item 5).

Distinct from the existing `blockExoticSubdeps` (`src/config/types.ts:528`), which blocks URL-shape (`git+`, `file:`); this is name-based. Both ship.

**Shipped wire shape:**

```bash
vis lint --banned-deps                              # config-driven
vis lint --banned-deps --fix                        # remove matches from package.json
vis lint --ban left-pad --ban request               # one-off, no config needed
```

**Sources:** syncpack `isBanned`; observed in real monorepos as a custom ESLint rule today.

---

### 5. Full `versionGroups` + `semverGroups` DSL — file but defer

**Leverage:** Power-user moat. **Effort:** L (1–2 months). **Demand:** ★

Port the whole policy DSL: highest/lowest/same-range/same-minor/pinned/banned/snapped-to/ignored × `dependencies` × `dependencyTypes` × `specifierTypes` × `packages` × `label`. Plus the semver-range counterpart (force `^`, `~`, exact, `>=`, etc. by scope).

Defer until items 1–4 surface real demand for cases the simple defaults can't express. When it lands, fits into `vis-config.ts` as `dependencyPolicy: { versionGroups: [...], semverGroups: [...] }` rather than a parallel `.syncpackrc` — Zod schemas, declaration-order-wins evaluator, fix planner with overlap resolution. Cost: schema, validator, evaluator, fix-ordering, docs, tests — most of a quarter for one engineer.

**Why defer:** the catalog story already covers the 90% case. Items 1–4 close the _missing 10%_ with sensible defaults. Add the DSL only when users file specific issues that 1–4 can't express.

**Sources:** syncpack core; `syncpack-analysis.md` §4 B1.

---

### 6. Custom types — `engines.node`, `packageManager`, `devEngines.*` ✅ shipped

**Leverage:** Closes the engines-drift footgun. **Effort:** M (2–3 weeks). **Demand:** ★★

Shipped as `vis lint --custom-types` (parallel pipeline to `--workspace-versions`). Five built-in customTypes: `engines.X`, `volta.X`, `packageManager` (parses `name@version[+sha512.<hash>]`), `devEngines.runtime`, `devEngines.packageManager`. Each `(customType × depName)` cluster is tracked independently — `engines.node` and `volta.node` do not cross-couple. `--fix` rewrites in place; the `+sha512` content-integrity hash on `packageManager` is dropped on bump (it's tied to a specific package, not version, so users must regenerate via Corepack).

Configuration lives in `policy.customTypes` with the same three-state autofix dial (`true | false | "prompt"`) as items 1, 2, and the catalog work. Users opt out at the rule level; CI still fails on drift.

**Overlap with `vis doctor`:** doctor verifies the _installed_ runtime matches `engines.node` (machine-side); `vis lint --custom-types` verifies all packages _declare_ the same `engines.node` (workspace-side). Both ship; documented in `docs/commands/lint.mdx`.

**Sources:** syncpack `customTypes`; user-validated demand in 7.2 Theme L.

---

### 7. Catalog auto-migration ✅ shipped (folded into item 2)

**Leverage:** Cleanup automation. **Effort:** S on top of item 2 (1–2 days). **Demand:** ★

Shipped as part of item 2 rather than as a follow-up. Two-mode behaviour:

- **Rewrite mode**: when ≥1 sibling already uses `catalog:` for a dep, rewrite the holdouts to match.
- **Propose mode**: when ≥ N (configurable, default 3) packages declare the same range _outside_ the catalog, propose adding a catalog entry.

Reuses `applyCatalogUpdates` (`src/util/catalog.ts`).

**Shipped wire shape:**

```bash
vis lint --workspace-versions --resolve catalog                 # rewrite holdouts
vis lint --workspace-versions --resolve catalog --propose-min 3 # also propose new entries
```

**Sources:** syncpack `isCatalog` versionGroup; vis already catalog-native, so this is the natural promotion path.

---

### 8. `vis json deps` ✅ shipped — per-instance NDJSON streaming

**Leverage:** Scriptability story. **Effort:** S (1–2 days). **Demand:** ★

Shipped. Emits one JSON object per dep instance: `{ packageName, depName, depType, specifier, location }`. Targets the `jq | sort | uniq -c` workflow syncpack documents under its `json` command. Reuses the iterator built in item 2 (`src/util/workspace-deps.ts`).

Distinct from `vis check --format=json` (single object). Power-user surface; doesn't compete with `vis list` (which is project/target-shaped).

**Shipped wire shape:**

```bash
vis json deps                                      # NDJSON, every instance
vis json deps --dep react                          # filtered
vis json deps | jq -r '.depName' | sort -u         # unique deps
```

**Sources:** syncpack `json` command.

---

### 9. `formatBugs` / `formatRepository` / `sortExports` ✅ shipped

**Leverage:** Cosmetic but expected. **Effort:** S (3–5 days). **Demand:** ★

Shipped as flags on `vis sort-package-json`. The native Rust sorter only handles field order; content normalisation lives in `src/util/format-package-json-fields.ts`:

- `formatBugs` — collapse `bugs: { url: "..." }` → string when `url` is the only field.
- `formatRepository` — collapse `repository: { type: "git", url: "..." }` → `"user/repo"` when the URL is a GitHub canonical (`https://github.com/user/repo` or `git+ssh://git@github.com/user/repo.git`). Default-on; falls back to non-collapse on ambiguous (e.g. self-hosted GitHub Enterprise) URLs.
- `sortExports` — sort the `exports` map: `"."` first, then alphabetised; per-condition order `types > import > require > default`.

All three default-on; opt out with `--no-format-bugs` / `--no-format-repository` / `--no-sort-exports` or the matching config keys. Item 3 stores canonical object form; this layer renders shorthand on write — interactions resolved as predicted.

**Sources:** syncpack `formatBugs` / `formatRepository` / `sortExports`.

---

### Bonus — `vis lint --redefine-root` ✅ shipped (not in original 9)

A check that emerged during implementation: flag deps duplicated between the workspace root and child packages — i.e. a child re-declares a dep already pinned in root. Not on syncpack's surface; novel to vis. Configurable exemption list via `policy.redefineRoot.exempt`.

```bash
vis lint --redefine-root
vis lint --redefine-root --fix
```

---

## Tier C — explicitly out of scope

Not on the roadmap; either too costly or wrong product surface. Same call as `priority-roadmap.md`'s Tier C — list them so future contributors don't re-relitigate.

| Item                                                   | Why skip                                                                                                                            |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `.syncpackrc.json` config file                         | vis owns config via `vis-config.ts`. A separate file fragments the surface; nest under `policy:`.                                   |
| `dependencyGroups` (cluster deps as one for reporting) | Cosmetic in syncpack output; doesn't change behaviour. vis groups by package, not by virtual cluster.                               |
| `maxConcurrentRequests`                                | Already covered by `vis check`'s registry pool; no new knob needed.                                                                 |
| `strict` config flag                                   | vis already has `--exit-code` per command; conflating "strict warnings" with "exit non-zero" is the syncpack lesson — don't repeat. |
| `list --show instances/hints/statuses`                 | vis `list` is project/target-shaped; reshaping for dep-instances confuses UX. NDJSON in item 8 covers scriptable cases.             |
| pnpm/bun overrides query language (syncpack#231)       | Needs its own evaluator; `pnpm.overrides` is a wider problem (resolution diamonds, peer-dep coercion). Out of scope for v1.         |
| Standalone `format` command                            | `vis sort-package-json` is the existing entry point; extend it (item 9) rather than fork.                                           |

> **Removed from Tier C:** "Standalone `vis lint` namespace" was in the original out-of-scope list with the rationale that two top-level commands for the same thing was a trap. In practice `vis check` (outdated/security) and policy lint are different verbs over different inputs — the namespace split shipped and reads cleanly. Items 1, 2, 4, 6 plus the bonus `--redefine-root` all live under `vis lint`.

---

## Execution post-mortem

What actually shipped, vs the originally suggested phasing:

**Phase 1 — Iterator + low-risk lints ✅** (items 1, 4)
Landed as planned. Item 1 (`vis lint --workspace-protocol`) shipped first to validate the cross-package dep iterator; item 4 (`vis lint --banned-deps` + one-off `--ban`) joined it.

**Phase 2 — Flagship drift detection ✅** (item 2)
Shipped as `vis lint --workspace-versions` with `--resolve highest|lowest|catalog`, `--propose-min`, and `--pin` one-off form. Item 7 (catalog auto-migration) folded in here rather than waiting for a follow-up phase, since the `--resolve catalog` plumbing was already in place.

**Phase 3 — Field sync + format polish ✅** (items 3, 9)
Item 3 shipped as `vis sync package-json-fields` with `--fields` (plural) override. Item 9 shipped as default-on flags (`formatBugs` / `formatRepository` / `sortExports`) on `vis sort-package-json`, with content normalisation in `src/util/format-package-json-fields.ts`.

**Phase 4 — Power-user surface ✅** (item 8; item 7 already in Phase 2)
`vis json deps` shipped as planned, reusing the iterator from item 2.

**Phase 5 — Custom types ✅; DSL still deferred** (items 6, 5)
Item 6 (`vis lint --custom-types`) shipped — the engines-drift footgun was real enough to justify pulling it forward. Item 5 (full versionGroups/semverGroups DSL) remains deferred. Litmus test for de-deferring: count GitHub issues filed in the year after items 1–4 + custom types ship that explicitly need a feature only the DSL can express (per-scope range character, `snapTo`, declarative `pinVersion` outside catalogs).

**Bonus — `vis lint --redefine-root` ✅**
Not in the original 9; emerged during implementation. Catches a pattern (child packages re-declaring deps already pinned at root) that's common enough to warrant its own check.

**The biggest call that got reversed:** the "keep policy behind `vis check` flags, don't add a `vis lint` namespace" guidance from the original Tier C. In practice, `vis check` (outdated, security audit) and policy lint are different verbs over different inputs — folding them into one command made the flag space muddy. A dedicated `vis lint` was the right call. Tier C entry removed.

---

## Effort legend

- **S** — days, single contributor
- **M** — 1–4 weeks, single contributor
- **L** — 1–2 months, may need 2 contributors

## Assumptions, resolved

- **Item 2 default = highest-semver-wins.** ✅ Confirmed in implementation. `--resolve lowest|catalog` available as escape hatches.
- **Item 2's `--fix` is destructive.** ✅ Shipped behind explicit `--fix` flag. Matches the broader `vis lint --fix` ergonomics.
- **Item 3's "sync" naming.** ⚠ Still ambiguous vs syncpack's verb. Watch for user-feedback confusion; renaming the kind to `package-json-metadata` is the obvious fallback.
- **Item 3 should write root → packages.** ✅ Shipped that way. `--skip` glob and `policy.sync.packageJson.skip` cover the mixed-license edge case.
- **Item 6 overlaps with `vis doctor`.** ✅ Both shipped; doctor is machine-side, lint is workspace-side. Documented in `docs/commands/lint.mdx`.
- **Item 5 may be unnecessary forever.** Open question. Items 1–4 + custom types are now in users' hands; the litmus test (issue traffic that only the full DSL can address) needs a year of signal before reopening B1.
- **Item 9's GitHub-shorthand collapse.** ✅ Heuristic-based; defaults to non-collapse on ambiguous (e.g. GitHub Enterprise) URLs. `--no-format-repository` for full opt-out.

---

## Cross-references

- Deep analysis with the full feature inventory: `syncpack-analysis.md`.
- Existing top-level vis roadmap (other axes — caching, AI, watch UX, etc.): `priority-roadmap.md`.
- Competitor-issue mining that produced the demand grades: `competitive-analysis.md` Section 7.2 Theme L, 8.3 #1, 8.4.
