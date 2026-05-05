# vis ↔ syncpack — Deep Feature Gap Analysis

Cross-reference of every syncpack feature against the current `@visulima/vis` surface, with concrete port / extend / skip recommendations.

Sources:

- syncpack 14 README + docs (`syncpack.dev/`, `syncpack.dev/config/`, `syncpack.dev/version-groups/`, `syncpack.dev/semver-groups/`, `syncpack.dev/config/custom-types`).
- vis source as of `alpha` branch (file paths cited as `path:line`).
- Existing `competitive-analysis.md` Sections 7.2 Theme L, 8.3 #1, 8.4. Existing `priority-roadmap.md` (item 24 unrelated; syncpack is not yet ranked).

---

## Section 1 — syncpack feature surface (what we're measuring against)

### 1.1 Commands

| Command  | Purpose                                                                                                          |
| -------- | ---------------------------------------------------------------------------------------------------------------- |
| `lint`   | Detect cross-package version mismatches against configured policies. Errors carry codes; CI-friendly exit codes. |
| `fix`    | Apply autofixable changes from `lint` (rewrite package.json + pnpm-workspace.yaml).                              |
| `update` | Bump versions from npm registry, including pnpm/bun catalog entries. Preserves semver range characters.          |
| `format` | Sort + canonicalise package.json field order; expand/collapse `repository` and `bugs` shorthands.                |
| `list`   | Inspect every dep instance with rich filters. `--show instances/ignored/all/hints/statuses`.                     |
| `json`   | Stream every dep instance as NDJSON for `jq` post-processing.                                                    |

### 1.2 Filters (common to all commands)

- `--dependencies <glob>` — name pattern, supports `**eslint**`, `@types/**`, exact match.
- `--dependency-types <list>` — `prod`, `dev`, `peer`, `resolutions`, `overrides`, `pnpmOverrides`, `local`, `pnpmCatalog`, `pnpmCatalog:<name>`, plus negation: `!peer`.
- `--specifier-types <list>` — `exact`, `range`, `workspace-protocol`, etc.
- `--source <glob>` — restrict to specific package.json files.
- `--target <level>` — `latest` | `minor` | `patch` (update only).
- `--check` — dry run, exit non-zero on drift (lint/fix/format/update).
- `--sort count|name` — list/lint output ordering.
- `--show instances|ignored|all|hints|statuses` — list verbosity.

### 1.3 Top-level config keys (`.syncpackrc.json`)

| Key                     | Effect                                                                           |
| ----------------------- | -------------------------------------------------------------------------------- |
| `source`                | Globs of package.json files to discover.                                         |
| `indent`                | JSON indentation (number / string).                                              |
| `sortAz`                | List of fields sorted alphabetically by key.                                     |
| `sortFirst`             | Fields hoisted above the alphabetised block.                                     |
| `sortPackages`          | Sort top-level package.json fields (canonical schema).                           |
| `sortExports`           | Sort the `exports` map (conditional-export ordering rules).                      |
| `formatBugs`            | Collapse `bugs: { url: "..." }` to a string when only `url` is set.              |
| `formatRepository`      | Collapse `repository: { type, url }` to GitHub shorthand `"user/repo"`.          |
| `strict`                | Treat hint-level findings as errors.                                             |
| `maxConcurrentRequests` | Cap concurrent npm registry requests.                                            |
| `minimumReleaseAge`     | Skip versions published more recently than threshold (supply-chain mitigation).  |
| `dependencyGroups`      | Cluster deps for treat-as-one semantics.                                         |
| `customTypes`           | Make non-dep package.json fields participate (e.g. `engines`, `packageManager`). |
| `versionGroups`         | Multi-policy version constraints (see 1.4).                                      |
| `semverGroups`          | Range-style policies (see 1.5).                                                  |

### 1.4 Version-group types (selector field in **bold**)

| Type           | Selector             | Behaviour                                                                                                      |
| -------------- | -------------------- | -------------------------------------------------------------------------------------------------------------- |
| Highest semver | (default)            | Pin every instance to the highest semver across the workspace.                                                 |
| Lowest semver  | **`isLowestSemver`** | Pin every instance to the lowest semver across the workspace (used for "do not exceed" floors).                |
| Same range     | **`isSameRange`**    | Every instance must use a range that overlaps every other; rejects strict-pin in one place and `^` in another. |
| Same minor     | **`isSameMinor`**    | All instances must agree on `MAJOR.MINOR`; patch may drift.                                                    |
| Pinned         | **`pinVersion`**     | Force a literal version (e.g. `pinVersion: "18.2.0"`).                                                         |
| Banned         | **`isBanned`**       | Reject the dep entirely in matched scopes; `fix` removes it.                                                   |
| Snapped to     | **`snapTo: [pkgs]`** | Mirror whatever version the named source-of-truth packages declare.                                            |
| Catalog        | **`isCatalog`**      | Migrate matched deps into pnpm/bun catalogs and rewrite specifiers to `catalog:` / `catalog:<name>`.           |
| Ignored        | **`isIgnored`**      | Excluded from any check.                                                                                       |

Common fields on every group: `dependencies`, `dependencyTypes`, `specifierTypes`, `packages`, `label`. First-match wins; declaration order matters.

### 1.5 Semver-group types

| Type       | Selector        | Behaviour                                                                                                          |
| ---------- | --------------- | ------------------------------------------------------------------------------------------------------------------ |
| With range | **`range`**     | Force a range character: `""` (exact), `"~"`, `"^"`, `">="`, `"<="`, `">"`, `"<"`, `"*"`. `fix` rewrites in place. |
| Ignored    | **`isIgnored`** | Excluded from range enforcement.                                                                                   |

### 1.6 Custom types (the `engines: node` story)

Four strategies extend syncpack to package.json fields outside `dependencies`/`devDependencies`/`peerDependencies`/`optionalDependencies`:

| Strategy         | Schema                          | Example                                                            |
| ---------------- | ------------------------------- | ------------------------------------------------------------------ |
| `name@version`   | `{ path }` to a string          | `"packageManager": "pnpm@9.0.0"`                                   |
| `name~version`   | `{ namePath, path }` to strings | `devEngines.runtime.{name,version}`                                |
| `version`        | `{ path }`                      | `engines.node: "22.11.0"` — the JSON key is the implicit dep name. |
| `versionsByName` | `{ path }` to an object         | A custom map identical in shape to `dependencies`.                 |

Once registered, custom types appear in `--dependency-types` and in version/semver groups.

---

## Section 2 — vis surface (what already ships)

| Capability                                 | Where it lives                                                                                                     | Notes                                                                                                                                             |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----------------------------------------------------------- |
| Outdated check                             | `vis check`, `src/util/catalog.ts:checkOutdated`                                                                   | Catalog-aware; pnpm/bun/npm; `--target latest                                                                                                     | minor | patch`; `--include`/`--exclude`; AI analysis behind `--ai`. |
| Outdated update                            | `vis update`, `src/util/catalog.ts:applyCatalogUpdates`, `src/commands/update/handler.ts`                          | Catalog mode + PM-native fallback; preserves range character; rollback flag.                                                                      |
| Audit / vulnerabilities                    | `vis audit`, `src/security/dependency-scan.ts`                                                                     | OSV.dev + Socket.dev; severity gating; `--sync` writes accepted-risk decisions back to pnpm-workspace.yaml.                                       |
| Doctor (multi-scan)                        | `vis doctor`, `src/commands/doctor/handler.ts`                                                                     | Outdated / security / optimization / runtime / duplicates fan-out. `--fix` autoremediation.                                                       |
| Lockfile-duplicate detection               | `findDuplicateDependencies` at `src/security/dependency-scan.ts:92`                                                | Reads PM lockfile, reports packages with `>1` resolved version. **Detection only — no autofix policy.**                                           |
| `add` with auto-conform to catalog/sibling | `vis add --to <pkg>`, `src/util/conform-to-catalog.ts:131`                                                         | First catalog hit wins, else most-frequent sibling range. Single-shot at install time, not enforced after.                                        |
| Catalog as version-group substitute        | pnpm/bun catalogs, also npm `workspaces.catalog`                                                                   | The only declarative pin vis understands; one entry pins many dependents.                                                                         |
| Minimum release age                        | `src/util/catalog.ts:1072` (`isTooNew`); `src/commands/update/handler.ts:48` (`readPmNativeMinimumReleaseAge`)     | Reads from `vis.config.yml#update.minimumReleaseAge`, falls back to pnpm-workspace.yaml or package.json. Excludes via `minimumReleaseAgeExclude`. |
| Typosquat + Socket.dev gating on `add`     | `src/security/typosquats.ts`, `src/security/socket-security.ts`                                                    | Refuses or prompts based on Socket score / typo distance.                                                                                         |
| `sort-package-json`                        | `vis sort-package-json`, native Rust binding via `#native`; handler at `src/commands/sort-package-json/handler.ts` | Field order, `--unsorted`, `--sort-order`, indent + line-ending detection. **No `formatBugs`/`formatRepository` shorthand collapse.**             |
| `sync codeowners`                          | `vis sync codeowners`, `src/commands/sync/handler.ts`                                                              | The `sync` namespace exists but currently has exactly one kind. Anything else returns `Unknown sync kind`.                                        |
| `dedupe`                                   | `vis dedupe`, delegates to PM                                                                                      | No vis-side policy.                                                                                                                               |
| `outdated` / `info`                        | Thin wrappers around `pnpm outdated` / `pnpm view`                                                                 | Pass-through.                                                                                                                                     |
| `blockExoticSubdeps`                       | `src/config/types.ts:528`                                                                                          | Refuses git/tarball URLs in transitive deps. **Not a per-name banlist.**                                                                          |

### 2.1 Concepts that have **shipped since this analysis**

Most of the original "absent" list closed under a dedicated `vis lint` command (plus `vis sync package-json-fields`, `vis json deps`, and `vis sort-package-json` flags). The original recommendation was to fold drift checks into `vis check --…` flags; the implementation reversed that call and gave them a separate command. See Section 4 Tier A/B for per-item shipped status and the post-mortem note in Section 5.

Still absent:

- Declarative version groups (highest/lowest/same-range/same-minor/pinned/banned/snapped-to/ignored × dependencies × dependencyTypes × specifierTypes × packages × label).
- Declarative semver-range groups (force `^`, `~`, exact, etc. by scope).
- `--show instances/hints/statuses` verbosity tiers (intentional — vis `list` is project-shaped).

---

## Section 3 — Capability matrix

Legend: ✓ shipped · ~ partial · — absent

| Capability                                                  | syncpack                       | vis | Notes                                                                                                                          |
| ----------------------------------------------------------- | ------------------------------ | --- | ------------------------------------------------------------------------------------------------------------------------------ |
| Detect "same dep, different version" across pkgs            | ✓ lint                         | ✓   | `vis lint --workspace-versions` (shipped). `vis doctor`'s lockfile-based check still complements it post-install.              |
| Force a specific range char by scope (`^`, `~`, `=`)        | ✓ semverGroups                 | —   | Still absent. The "exact in deps, ^ in devDeps" idiom is the main piece the deferred versionGroups DSL would unlock.           |
| Pin a literal version across workspace                      | ~                              | ~   | Both can pin via catalog; syncpack also has `pinVersion`. vis has one-off `vis lint --pin react@18.2.0`; no declarative form.  |
| Ban a dep by name                                            | ✓                              | ✓   | `vis lint --banned-deps` (config-driven) plus one-off `--ban left-pad` (shipped).                                              |
| Snap-to source-of-truth package                             | ✓                              | —   | "Whatever app/foo declares, every other package must match." Still absent; lives in deferred DSL.                              |
| Highest / lowest semver auto-converge                       | ✓                              | ✓   | `vis lint --workspace-versions --resolve highest\|lowest --fix` (shipped).                                                     |
| Catalog migration (auto-promote dep into catalog)           | ✓ via versionGroup `isCatalog` | ✓   | `vis lint --workspace-versions --resolve catalog --propose-min N` (shipped).                                                   |
| Custom types (engines, packageManager, devEngines)          | ✓                              | ✓   | `vis lint --custom-types` (shipped). Five built-in types; user-declared `extraTypes` via `policy.customTypes`.                 |
| package.json field-order format                             | ✓                              | ✓   | `vis sort-package-json` — Rust-native; comparable.                                                                             |
| `formatBugs` / `formatRepository` shorthand                 | ✓                              | ✓   | Shipped via `vis sort-package-json` (`formatBugs` / `formatRepository` config flags).                                          |
| Sort `exports` map                                          | ✓                              | ✓   | Shipped via `vis sort-package-json` (`sortExports` flag).                                                                      |
| Outdated bump with range preservation                       | ✓                              | ✓   | Parity.                                                                                                                        |
| `--target latest` / `minor` / `patch`                       | ✓                              | ✓   | Parity.                                                                                                                        |
| pnpm/bun catalog awareness                                  | ✓                              | ✓   | Parity. vis is more catalog-native (catalog-first rather than catalog-as-an-afterthought).                                     |
| Minimum release age                                          | ✓                              | ✓   | Parity, plus vis cross-reads pnpm-workspace.yaml + bun config.                                                                 |
| Audit / vulnerabilities / supply chain                      | —                              | ✓   | vis is ahead — OSV + Socket + typosquat + accept-risk workflow.                                                                |
| AI / fix-on-failure                                          | —                              | ✓   | vis is ahead — `vis ai heal` for failing tasks; arguably extensible to lint findings.                                          |
| `vis add --to <pkg>` (syncpack#285)                         | —                              | ✓   | vis is ahead — already absorbed.                                                                                               |
| Streaming `json` per-instance NDJSON                        | ✓                              | ✓   | `vis json deps` (shipped) emits one object per dep instance.                                                                   |
| Redefine-root (child re-declares root-pinned dep)           | —                              | ✓   | vis is ahead — `vis lint --redefine-root`. Not on syncpack's surface.                                                          |
| `list --show instances/hints/statuses`                      | ✓                              | —   | Different model; vis lists projects/targets, not dep instances. NDJSON via `vis json deps` covers the scriptable use.          |

**Net:** vis closed almost the entire syncpack gap. Remaining absences are the full versionGroups/semverGroups DSL (per-scope range enforcement, snap-to, pinVersion-outside-catalog) — deferred under item 5. vis remains ahead on security (audit, Socket, typosquats), AI, catalog-native UX, supply-chain freshness gating, and `redefine-root`.

---

## Section 4 — Gap-by-gap port recommendations

Effort scale (matches priority-roadmap.md): **S** = days, **M** = 1–4 weeks, **L** = 1–2 months. Demand grade matches Sections 7/8 of `competitive-analysis.md`: ★★★ ≥ 3 competitor signals, ★★ = 2, ★ = novel/inferred.

### Tier A — Ports with strong leverage

> **Status:** Tier A shipped under `vis lint` (workspace-protocol, workspace-versions, banned-deps) and `vis sync package-json-fields`, not the originally proposed `vis check --…` flags. The recommendation to keep policy behind `vis check` flags was reversed during implementation — see Section 5 for the post-mortem.

#### A1. `vis lint --workspace-versions` ✅ shipped

**Effort:** M. **Demand:** ★★ (sherif/manypkg overlap; multiple GH issues per `competitive-analysis.md` 7.2 Theme L, 8.3 #1).

The single biggest syncpack capability vis was missing: detect "the same dep declared at different versions across workspace packages" by reading every package.json, not by inspecting the installed lockfile. Distinct from `vis doctor`'s `findDuplicateDependencies` (lockfile-based, post-install, transitive); this is package-author-facing and runs from source.

**Default policy:** highest-semver wins per dep across `dependencies` ∪ `devDependencies` ∪ `peerDependencies`. Reuses `compareVersions` from `src/util/catalog.ts`. Configurable via `policy` in `vis-config.ts`.

**Shipped wire shape:**

```bash
vis lint --workspace-versions                                          # report; exit 1 on drift
vis lint --workspace-versions --fix                                    # rewrite package.jsons in place
vis lint --workspace-versions --dep react                              # scope to one name
vis lint --workspace-versions --resolve highest|lowest|catalog
vis lint --workspace-versions --resolve catalog --propose-min 3        # also folds in B5 / item 7
vis lint --pin react@18.2.0                                            # one-off pin (auto-enables this lint)
```

**Implementation:** `src/util/workspace-versions-lint.ts` plus the shared iterator in `src/util/workspace-deps.ts`.

#### A2. `vis sync package-json-fields` ✅ shipped (syncpack#168)

**Effort:** S. **Demand:** ★★ (syncpack#168 user demand; manypkg has the workspace-protocol variant; Lerna had this).

Shipped as a second kind on the existing `vis sync` argument-router. Aggregates a small set of metadata fields from each package.json and enforces consistency vs the root.

**Default fields:** `engines`, `license`, `author`, `repository.{type,url,directory}`, `bugs.url`, `homepage`, `funding`. `repository.directory` is set to each package's path relative to the workspace root automatically — single most common drift in real monorepos and a Lerna-era footgun.

**Shipped wire shape:**

```bash
vis sync package-json-fields                          # write
vis sync package-json-fields --check                  # exit 1 on drift, no write
vis sync package-json-fields --fields engines,license # subset (note plural, not --field)
```

**Reuse:** same `discoverWorkspace` plumbing as the codeowners path. Repository-shorthand collapse landed in `vis sort-package-json` instead (item B3 / item 9) — see below.

#### A3. `vis lint --workspace-protocol` ✅ shipped (manypkg parity)

**Effort:** S. **Demand:** ★★ (manypkg's `INTERNAL_MISMATCH` rule has wide adoption).

Every internal dep — i.e. one whose name matches a workspace package — must use `workspace:*` (or `workspace:^` / `workspace:~` / exact). Iterates every dep entry, intersects against the workspace-package-name set built by `discoverWorkspace`. Misses get a one-line auto-fix that rewrites to `workspace:*` (configurable via `--fix-specifier`).

```bash
vis lint --workspace-protocol                              # report
vis lint --workspace-protocol --fix                        # rewrite
vis lint --workspace-protocol --fix --fix-specifier=^      # use workspace:^ instead of workspace:*
```

**Implementation:** `src/util/workspace-protocol-lint.ts`.

#### A4. `vis lint --banned-deps` ✅ shipped (subset of syncpack `isBanned`)

**Effort:** S. **Demand:** ★ (less broad than A1–A3; teams that want it really want it).

Reads a list of forbidden dep names from `policy.bannedDeps` in vis config; `vis lint --banned-deps` reports any package.json containing one; `--fix` removes the entry. Glob support (`legacy-*`, `**deprecated**`). One-off `--ban left-pad --ban request` for ad-hoc CI gates without touching config.

Stops short of full `versionGroups[].isBanned` (with `dependencies` + `dependencyTypes` + `packages` matchers); that lives in deferred item 5. The 90/10 case ("we replaced X with Y; nobody is allowed to add X back") doesn't need the matrix.

```bash
vis lint --banned-deps                              # config-driven
vis lint --ban left-pad --ban request               # one-off
```

#### A5. `vis lint --redefine-root` ✅ shipped (bonus, not in original analysis)

A check that emerged during implementation but wasn't in the original roadmap: flag deps duplicated between the workspace root and child packages — i.e. a child re-declares a dep already pinned in root. Not a syncpack feature; novel to vis. Configurable exemption list via `policy.redefineRoot.exempt`.

```bash
vis lint --redefine-root
vis lint --redefine-root --fix
```

### Tier B — File but defer

> **Status:** B2, B3, B4, B5 all shipped. Only B1 (full versionGroups/semverGroups DSL) remains deferred.

#### B1. Full `versionGroups` + `semverGroups` DSL — still deferred

**Effort:** L. **Demand:** ★ (heavy users love it; nobody else asks).

Porting the whole policy DSL is the single largest piece of syncpack. Rich (highest/lowest/same-range/same-minor/pinned/banned/snapped-to/ignored × dependencies × dependencyTypes × specifierTypes × packages × label) but expensive: schema, validator, evaluator, fix planner, `--fix` ordering when groups overlap.

When it lands, fit it into `vis-config.ts` as `dependencyPolicy: { versionGroups: [...], semverGroups: [...] }` rather than a parallel `.syncpackrc`. Reuse Zod schema patterns vis already uses for `vis-config`. Litmus test for de-deferring: count GitHub issues filed in the year after Tier A shipped that explicitly need a feature only the DSL can express (per-scope range character, snap-to, declarative pinVersion-outside-catalog).

#### B2. Custom types ✅ shipped

**Effort:** M. **Demand:** ★★ (most users hit "node engines drift" once and remember it).

Shipped as `vis lint --custom-types`. Five built-in customTypes: `engines.X`, `volta.X`, `packageManager` (parses `name@version[+sha512.<hash>]`), `devEngines.runtime`, `devEngines.packageManager`. Each `(customType × depName)` cluster is tracked independently — `engines.node` and `volta.node` do not cross-couple. `--fix` rewrites in place; the `+sha512` content-integrity hash on `packageManager` is dropped on bump (tied to a specific package, not version, so users regenerate via Corepack).

Configuration lives in `policy.customTypes` with the three-state autofix dial (`true | false | "prompt"`). User-declared `policy.customTypes.extraTypes` covers niche cases beyond the five built-ins. Implementation in `src/util/custom-types.ts`.

**Overlap with `vis doctor`:** doctor verifies the _installed_ runtime matches `engines.node` (machine-side); `vis lint --custom-types` verifies all packages _declare_ the same `engines.node` (workspace-side). Both ship; documented in `docs/commands/lint.mdx`.

#### B3. `formatBugs` / `formatRepository` / `sortExports` ✅ shipped

**Effort:** S. **Demand:** ★ (cosmetic; matters mostly for npm-published packages).

Shipped as flags on `vis sort-package-json`, with implementation in `src/util/format-package-json-fields.ts` (the native Rust sorter only handles field order; this layer handles content normalisation):

- `formatBugs` — collapse `bugs: { url: "..." }` → string when `url` is the only field.
- `formatRepository` — collapse `repository: { type: "git", url: "..." }` → `"user/repo"` when the URL is a GitHub canonical (`https://github.com/user/repo` or `git+ssh://git@github.com/user/repo.git`).
- `sortExports` — sort the `exports` map: `"."` first, then alphabetised; per-condition order `types > import > require > default`.

The bugs/repository case interacts with A2: A2 stores canonical object form, sort-package-json renders shorthand on write.

#### B4. `vis json deps` ✅ shipped — per-instance NDJSON streaming

**Effort:** S. **Demand:** ★ (power-user; scriptability story).

Shipped as `vis json deps`. Emits one JSON object per dep instance: `{ packageName, depName, depType, specifier, location }`. Targets the `jq | sort | uniq -c` workflow syncpack documents. Reuses the iterator built for A1.

#### B5. Catalog auto-migrate ✅ shipped (folded into A1)

**Effort:** S on top of A1. **Demand:** ★ (reuses existing catalog UX).

Shipped as `vis lint --workspace-versions --resolve catalog [--propose-min N]`:

- **Rewrite mode** — when ≥1 sibling already uses `catalog:` for a dep, rewrite the holdouts to match.
- **Propose mode** — when ≥ N (default 3, configurable) packages declare the same range _outside_ the catalog, propose adding a catalog entry.

Differs from vanilla A1 by being a migration aid rather than a drift-fix.

### Tier C — Don't port

| Item                                                          | Why skip                                                                                                                            |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `syncpack list --show instances/hints/statuses`               | vis `list` is project/target-shaped; reshaping it for dep-instances confuses the UX. NDJSON in B4 covers the scriptable cases.      |
| Standalone `.syncpackrc.json` config file                     | vis owns config via `vis-config.ts`. A separate file fragments the surface; nest under `policy:`.                                   |
| `dependencyGroups` (cluster deps as one for reporting)        | Cosmetic in syncpack output; doesn't change behaviour. vis groups by package, not by virtual cluster.                               |
| `maxConcurrentRequests`                                       | Already covered by `vis check`'s registry pool; no new knob needed.                                                                 |
| `strict` config flag                                          | vis already has `--exit-code` per command; conflating "strict warnings" with "exit non-zero" is the syncpack lesson — don't repeat. |
| pnpm/bun-specific overrides linting (syncpack#231 query lang) | Would need its own evaluator; pnpm.overrides is a wider problem (resolution diamonds, peer-dep coercion). Out of scope for v1.      |

> **Removed from Tier C:** "Standalone `vis lint` namespace." The original recommendation was to keep policy behind `vis check` flags; in practice, conflating outdated/security checks (`vis check`) with package.json policy lint (`vis lint`) made flag namespaces unwieldy and the verbs read wrong (you _check_ for outdated deps, you _lint_ a policy violation). The dedicated `vis lint` command shipped for items A1–A4 and B2.

---

## Section 5 — Execution post-mortem

What actually shipped, vs the originally suggested order:

1. **A3 (workspace-protocol)** — landed first as planned, validated the cross-package dep iterator.
2. **A1 (workspace-versions)** — flagship port, landed under `vis lint --workspace-versions`. `--resolve highest|lowest|catalog` and `--propose-min` (B5) shipped in the same release rather than as a follow-up.
3. **A4 (banned-deps)** — landed as `vis lint --banned-deps` (config-driven) plus one-off `--ban`. Same release as A1.
4. **B2 (custom types)** — pulled forward from Tier B; the engines-drift footgun was real and the iterator from A1 was already sitting there. Shipped as `vis lint --custom-types`.
5. **A2 (sync package-json-fields)** — separate command surface (`vis sync package-json-fields`), as planned.
6. **B3 (formatBugs / formatRepository / sortExports)** — flags on `vis sort-package-json` rather than its own command.
7. **B4 (`vis json deps`)** — NDJSON dep-instance stream, cheap once the iterator existed.
8. **`vis lint --redefine-root`** — bonus check not in this analysis; flags child packages re-declaring deps already pinned at the workspace root. Novel to vis (no syncpack equivalent).

Still open: **B1** — the full versionGroups/semverGroups DSL. Per-scope range character (`^` in deps, `=` in devDeps), declarative `pinVersion` outside catalogs, and `snapTo` source-of-truth packages remain unexpressible. De-defer once issue traffic shows the simple A1–A4 + B2 surface can't cover real cases.

**The biggest call that got reversed:** the "keep policy behind `vis check` flags, don't add a `vis lint` namespace" guidance from the original Tier C. In practice, `vis check` (outdated, security audit) and policy lint are different verbs over different inputs — folding them into one command made the flag space muddy. A dedicated `vis lint` was the right call. Tier C entry removed.

---

## Section 6 — Assumptions, resolved

- **A1 default = highest-semver-wins.** ✅ Confirmed in implementation. `--resolve lowest|catalog` available as escape hatches.
- **A2 should write root → packages.** ✅ Shipped that way. Per-package skip via `--skip` glob and `policy.sync.packageJson.skip` covers the mixed-license edge case.
- **`vis sync` namespace is overloaded.** ⚠ Still true. `package-json-fields` reads ambiguously vs syncpack's verb — a user might expect _outbound_ version sync. Watch for confusion in user feedback; renaming the kind to `package-json-metadata` is the obvious fallback.
- **A1's `--fix` is destructive.** ✅ Shipped behind explicit `--fix` flag (no implicit fix, no confirmation prompt). Matches `vis lint --fix` ergonomics across the rest of the lint family.
- **Custom types overlap with `vis doctor`.** ✅ Both shipped; doctor is machine-side, lint is workspace-side. Documented in `docs/commands/lint.mdx`.
- **Banlist vs `blockExoticSubdeps`.** ✅ Both shipped; orthogonal as expected (URL-shape vs name-based).

---

## Section 7 — Sources

- syncpack 14: github.com/JamieMason/syncpack, syncpack.dev, syncpack.dev/config/, syncpack.dev/version-groups/, syncpack.dev/semver-groups/, syncpack.dev/config/custom-types
- syncpack open issues mined in `competitive-analysis.md` Section 7.2 Theme L, 8.3
- vis source paths inline (verified `alpha` branch).
- Adjacent tools for context: github.com/Thinkmill/manypkg (workspace-protocol enforcement), github.com/QuiiBz/sherif (zero-config monorepo lint).
