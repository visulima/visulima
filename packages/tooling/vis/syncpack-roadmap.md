# vis — syncpack Absorption Roadmap

Derived from `syncpack-analysis.md`. Nine items ordered by leverage × effort × demand, scoped specifically to the syncpack feature surface vis is missing.

Demand grade matches `priority-roadmap.md`: **★★★** = 3+ competitor signals, **★★** = 2, **★** = 1 strong signal or novel. None of these items are shipped yet — all are derived from `competitive-analysis.md` Section 7.2 Theme L, 8.3 #1, 8.4, plus the syncpack feature audit in `syncpack-analysis.md` §3.

---

## Top items — ranked

### 1. Workspace-protocol enforcement (`vis check --workspace-protocol`)

**Leverage:** Correctness foundation. **Effort:** S (1–2 days). **Demand:** ★★

Every internal dep — i.e. one whose name matches a workspace package — must use `workspace:*` (or `workspace:^` / `workspace:~` / exact). Today vis catches this only when an install fails or audit notices, and never lints from package.json source-of-truth.

Validates the cross-package dep iterator that items 2 and 4 will reuse, so it ships first as a low-risk warm-up. Trivial implementation: iterate every `dependencies`/`devDependencies`/`peerDependencies` entry, intersect against the workspace-package-name set built by `discoverWorkspace` (`src/config/workspace.ts`). Misses get a one-line auto-fix that rewrites to `workspace:*` (preserving the leading range char if non-empty).

**Wire shape:**

```bash
vis check --workspace-protocol             # report drift, exit 1 on miss
vis check --workspace-protocol --fix       # rewrite in place
```

Folds into the existing `vis check` flag set; not a new top-level command.

**Sources:** `competitive-analysis.md` 7.2 Theme L; manypkg's `INTERNAL_MISMATCH` rule.

---

### 2. Workspace-version drift (`vis check --workspace-versions`)

**Leverage:** Flagship port. **Effort:** M (1–2 weeks). **Demand:** ★★

The single biggest syncpack capability vis is missing: detect "the same dep declared at different versions across packages" by reading every package.json — distinct from `vis doctor`'s `findDuplicateDependencies` (`src/security/dependency-scan.ts:92`), which fires post-install on transitive duplication via the lockfile.

Default policy is highest-semver-wins per dep across `dependencies` ∪ `devDependencies` ∪ `peerDependencies`, reusing `compareVersions` already in `src/util/catalog.ts`. Ignored deps inherit the existing `vis check --exclude` filter so the surface compounds rather than competes.

The `--fix` pass mutates package.json (and `pnpm-workspace.yaml` catalog entries when `--resolve catalog` is set) rather than calling `pnpm dedupe`. Reuse `applyCatalogUpdates` (`src/util/catalog.ts`) for the catalog branch and `readPackageJsonDeps` (`src/util/conform-to-catalog.ts`) for the iterator.

**Wire shape:**

```bash
vis check --workspace-versions                         # report; exit 1 on drift
vis check --workspace-versions --fix                   # rewrite package.jsons
vis check --workspace-versions --dep react             # scope to one name
vis check --workspace-versions --resolve highest|lowest|catalog
```

`--resolve catalog`: when a sibling catalog already pins the dep, rewrite the offending instances to `catalog:`. Migration aid; folds in item 7.

**Why first among the ports:** this is the feature people leave vis for syncpack to get. Item 1 exists to validate the iterator; everything else extends it.

**Sources:** `competitive-analysis.md` 7.2 Theme L (rushstack#1454, syncpack core); `syncpack-analysis.md` §4 A1.

---

### 3. `vis sync package-json-fields` — non-version field sync (syncpack#168)

**Leverage:** Real-world papercut killer. **Effort:** S (3–5 days). **Demand:** ★★

Extend the existing `vis sync` argument-router with a second kind: `package-json-fields`. Aggregates a small set of metadata fields from each package.json and enforces consistency vs the root.

Default fields (configurable via `vis-config.ts#sync.packageJson.fields`): `engines`, `license`, `author`, `repository.{type,url,directory}`, `bugs.url`, `homepage`, `funding`. The headline behaviour: `repository.directory` is set to each package's path relative to the workspace root automatically — single most common drift in real monorepos and a Lerna-era footgun.

Reuses `discoverWorkspace` and the codeowners path's `--check` flag in `src/commands/sync/handler.ts`. Repository-shorthand collapse from syncpack (`formatBugs` / `formatRepository`) lands here too: store as canonical object form, render shorthand only when fields exactly match the GitHub heuristic.

**Wire shape:**

```bash
vis sync package-json-fields                           # write
vis sync package-json-fields --check                   # exit 1 on drift
vis sync package-json-fields --field engines,license   # subset
```

**Naming caveat (from §6 of the analysis):** `vis sync package-json-fields` reads ambiguously — users may expect *outbound* sync of versions, not metadata. Document the distinction in `--help`.

**Sources:** syncpack#168 (open ask, 5+ years); manypkg metadata checks.

---

### 4. Banned-deps policy (`vis check --banned-deps`)

**Leverage:** Cheap CI gate. **Effort:** S (1 day). **Demand:** ★

Read a list of forbidden dep names from `vis-config.ts#policy.banned: string[]`. `vis check` reports any package.json containing one; `--fix` removes the entry. Glob support (`legacy-*`, `**deprecated**`).

Stops short of full `versionGroups[].isBanned` semantics (with `dependencies` + `dependencyTypes` + `packages` matchers — see item 5). The 90/10 case is "we replaced X with Y; nobody is allowed to add X back," which doesn't need the matrix.

Distinct from the existing `blockExoticSubdeps` (`src/config/types.ts:528`), which blocks URL-shape (`git+`, `file:`); this is name-based. Both wanted.

**Wire shape:**

```bash
vis check --banned-deps              # warn on every match
vis check --banned-deps --fix        # remove from package.json
```

**Sources:** syncpack `isBanned`; observed in real monorepos as a custom ESLint rule today.

---

### 5. Full `versionGroups` + `semverGroups` DSL — file but defer

**Leverage:** Power-user moat. **Effort:** L (1–2 months). **Demand:** ★

Port the whole policy DSL: highest/lowest/same-range/same-minor/pinned/banned/snapped-to/ignored × `dependencies` × `dependencyTypes` × `specifierTypes` × `packages` × `label`. Plus the semver-range counterpart (force `^`, `~`, exact, `>=`, etc. by scope).

Defer until items 1–4 surface real demand for cases the simple defaults can't express. When it lands, fits into `vis-config.ts` as `dependencyPolicy: { versionGroups: [...], semverGroups: [...] }` rather than a parallel `.syncpackrc` — Zod schemas, declaration-order-wins evaluator, fix planner with overlap resolution. Cost: schema, validator, evaluator, fix-ordering, docs, tests — most of a quarter for one engineer.

**Why defer:** the catalog story already covers the 90% case. Items 1–4 close the *missing 10%* with sensible defaults. Add the DSL only when users file specific issues that 1–4 can't express.

**Sources:** syncpack core; `syncpack-analysis.md` §4 B1.

---

### 6. Custom types — `engines.node`, `packageManager`, `devEngines.*` ✅ shipped

**Leverage:** Closes the engines-drift footgun. **Effort:** M (2–3 weeks). **Demand:** ★★

Shipped as `vis lint --custom-types` (parallel pipeline to `--workspace-versions`). Five built-in customTypes: `engines.X`, `volta.X`, `packageManager` (parses `name@version[+sha512.<hash>]`), `devEngines.runtime`, `devEngines.packageManager`. Each `(customType × depName)` cluster is tracked independently — `engines.node` and `volta.node` do not cross-couple. `--fix` rewrites in place; the `+sha512` content-integrity hash on `packageManager` is dropped on bump (it's tied to a specific package, not version, so users must regenerate via Corepack).

Configuration lives in `policy.customTypes` with the same three-state autofix dial (`true | false | "prompt"`) as items 1, 2, and the catalog work. Users opt out at the rule level; CI still fails on drift.

**Overlap with `vis doctor`:** doctor verifies the *installed* runtime matches `engines.node` (machine-side); `vis lint --custom-types` verifies all packages *declare* the same `engines.node` (workspace-side). Both ship; documented in `docs/commands/lint.mdx`.

**Sources:** syncpack `customTypes`; user-validated demand in 7.2 Theme L.

---

### 7. Catalog auto-migration (`--resolve catalog` + propose)

**Leverage:** Cleanup automation. **Effort:** S on top of item 2 (1–2 days). **Demand:** ★

Two-mode behaviour layered on item 2's `--resolve catalog`:

- **Rewrite mode**: when ≥1 sibling already uses `catalog:` for a dep, rewrite the holdouts to match.
- **Propose mode**: when ≥ N (configurable, default 3) packages declare the same range *outside* the catalog, propose adding a catalog entry. Outputs a unified diff against `pnpm-workspace.yaml` for human review. `--fix` applies.

Differs from item 2 by being a migration aid rather than a drift-fix. Reuses `applyCatalogUpdates` (`src/util/catalog.ts`).

**Wire shape:**

```bash
vis check --workspace-versions --resolve catalog --propose-min 3
```

**Sources:** syncpack `isCatalog` versionGroup; vis already catalog-native, so this is the natural promotion path.

---

### 8. `vis json deps` — per-instance NDJSON streaming

**Leverage:** Scriptability story. **Effort:** S (1–2 days). **Demand:** ★

Emit one JSON object per dep instance: `{ packageName, depName, depType, specifier, location }`. Targets the `jq | sort | uniq -c` workflow syncpack documents under its `json` command. Cheap once item 2 has built the dep-instance iterator.

Distinct from `vis check --format=json` (single object today). Power-user surface; doesn't compete with `vis list` (which is project/target-shaped).

**Wire shape:**

```bash
vis json deps                                      # NDJSON, every instance
vis json deps --dep react                          # filtered
vis json deps | jq -r '.depName' | sort -u         # unique deps
```

**Sources:** syncpack `json` command.

---

### 9. `formatBugs` / `formatRepository` / `sortExports` for sort-package-json

**Leverage:** Cosmetic but expected. **Effort:** S (3–5 days). **Demand:** ★

Extend `sort-package-json` (or its native binding under `native/`) to:

- Collapse `bugs: { url: "..." }` → string when `url` is the only field.
- Collapse `repository: { type: "git", url: "..." }` → `"user/repo"` when the URL parses cleanly to a GitHub canonical (`https://github.com/user/repo` or `git+ssh://git@github.com/user/repo.git`).
- Sort the `exports` map: `"."` first, then alphabetised; per-condition order `types > import > require > default`.

Bugs/repository shorthand interacts with item 3: pick canonical *object* form for storage and render shorthand only on write. Mostly matters for npm-published packages — vis already publishes so eat your own dogfood.

**Sources:** syncpack `formatBugs` / `formatRepository` / `sortExports`.

---

## Tier C — explicitly out of scope

Not on the roadmap; either too costly or wrong product surface. Same call as `priority-roadmap.md`'s Tier C — list them so future contributors don't re-relitigate.

| Item                                                  | Why skip                                                                                                                             |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Standalone `vis lint` namespace                       | Two top-level commands for the same thing (`check` + `lint`) is the trap turbo fell into. Keep policy behind `check` flags.          |
| `.syncpackrc.json` config file                        | vis owns config via `vis-config.ts`. A separate file fragments the surface; nest under `dependencyPolicy:`.                          |
| `dependencyGroups` (cluster deps as one for reporting)| Cosmetic in syncpack output; doesn't change behaviour. vis groups by package, not by virtual cluster.                                |
| `maxConcurrentRequests`                               | Already covered by `vis check`'s registry pool; no new knob needed.                                                                  |
| `strict` config flag                                  | vis already has `--exit-code` per command; conflating "strict warnings" with "exit non-zero" is the syncpack lesson — don't repeat.  |
| `list --show instances/hints/statuses`                | vis `list` is project/target-shaped; reshaping for dep-instances confuses UX. NDJSON in item 8 covers scriptable cases.              |
| pnpm/bun overrides query language (syncpack#231)      | Needs its own evaluator; `pnpm.overrides` is a wider problem (resolution diamonds, peer-dep coercion). Out of scope for v1.          |
| Standalone `format` command                           | `vis sort-package-json` is the existing entry point; extend it (item 9) rather than fork.                                            |

---

## Suggested execution order

Mirrors `priority-roadmap.md`'s phasing — small group of related items per quarter rather than a single mega-feature. All items below assume nothing else from `priority-roadmap.md` is co-scheduled in the same window.

**Phase 1: Iterator + low-risk lints (items 1, 4)**
~3 days total. Item 1 ships the cross-package dep iterator and the workspace-protocol check on top; item 4 is a one-flag addition that reuses the same iterator. Both land before item 2 so the iterator is exercised against real workspaces under low-risk lint paths first.

**Phase 2: Flagship drift detection (item 2)**
Single-engineer M-block. Defines the policy schema, `--fix` semantics, and the `--resolve` mode that items 6 and 7 hook into. Lands with comprehensive tests; this is the high-blast-radius command since `--fix` rewrites N package.jsons.

**Phase 3: Field sync + format polish (items 3, 9)**
~1.5 weeks combined. Item 3 extends the underused `vis sync` namespace; item 9 rounds out `sort-package-json` so vis no longer hands a partial-format experience. These pair naturally — both touch package.json metadata, both ship without a `--fix` blast-radius concern (sync is opt-in by `kind`, sort by command).

**Phase 4: Power-user surface (items 7, 8)**
~1 week combined. Both depend on item 2's iterator. NDJSON (item 8) costs nothing on top of the iterator; catalog auto-migration (item 7) is the natural follow-up to drift detection.

**Phase 5: DSL + custom types (items 5, 6)**
Item 6 shipped early — the `policy.customTypes` configuration was cheap on top of the workspace-versions iterator and the engines-drift footgun was real enough to justify pulling it forward. Item 5 (full versionGroups DSL) remains deferred pending real-world signal that items 1–4 + customTypes can't express; the litmus test stands ("count GitHub issues filed in the year after items 1–4 ship that explicitly need a feature only the DSL can express").

---

## Effort legend

- **S** — days, single contributor
- **M** — 1–4 weeks, single contributor
- **L** — 1–2 months, may need 2 contributors

## Assumptions worth challenging

- **Item 2 default = highest-semver-wins.** Matches syncpack's default. The competing pick is "catalog if one exists, else highest." Validate against a real failing case before settling.
- **Item 2's `--fix` is destructive.** Writing N package.jsons should require either explicit `--fix` or a TTY confirmation. Match the `vis cache clean` precedent (out-of-workspace prompt).
- **Item 3's "sync" naming.** Reads ambiguously vs. syncpack's verb. Worth a docs callout; consider renaming the kind to `package-json-metadata` if user testing surfaces confusion.
- **Item 3 should write to root, not project-by-project.** Assumes root `package.json` is source of truth for `engines`/`license`/`repository.type`. Mixed-license monorepos need an opt-out per package.
- **Item 6 overlaps with `vis doctor`.** Doctor is machine-side ("does my installed Node match `engines.node`?"); custom types are workspace-side ("do all packages declare the same `engines.node`?"). Both should ship; needs disambiguation in docs.
- **Item 5 may be unnecessary forever.** If items 1–4 + the existing catalog story cover real demand, the full DSL stays deferred. The litmus test: count GitHub issues filed in the year after items 1–4 ship that explicitly need a feature only the DSL can express.
- **Item 9's GitHub-shorthand collapse.** Heuristic-based; will misfire on self-hosted GitHub Enterprise URLs that don't match the canonical pattern. Default to non-collapse on ambiguity.

---

## Cross-references

- Deep analysis with the full feature inventory: `syncpack-analysis.md`.
- Existing top-level vis roadmap (other axes — caching, AI, watch UX, etc.): `priority-roadmap.md`.
- Competitor-issue mining that produced the demand grades: `competitive-analysis.md` Section 7.2 Theme L, 8.3 #1, 8.4.
