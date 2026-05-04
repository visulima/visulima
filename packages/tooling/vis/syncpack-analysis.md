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

| Key                     | Effect                                                                          |
| ----------------------- | ------------------------------------------------------------------------------- |
| `source`                | Globs of package.json files to discover.                                        |
| `indent`                | JSON indentation (number / string).                                             |
| `sortAz`                | List of fields sorted alphabetically by key.                                    |
| `sortFirst`             | Fields hoisted above the alphabetised block.                                    |
| `sortPackages`          | Sort top-level package.json fields (canonical schema).                          |
| `sortExports`           | Sort the `exports` map (conditional-export ordering rules).                     |
| `formatBugs`            | Collapse `bugs: { url: "..." }` to a string when only `url` is set.             |
| `formatRepository`      | Collapse `repository: { type, url }` to GitHub shorthand `"user/repo"`.         |
| `strict`                | Treat hint-level findings as errors.                                            |
| `maxConcurrentRequests` | Cap concurrent npm registry requests.                                           |
| `minimumReleaseAge`     | Skip versions published more recently than threshold (supply-chain mitigation). |
| `dependencyGroups`      | Cluster deps for treat-as-one semantics.                                        |
| `customTypes`           | Make non-dep package.json fields participate (e.g. `engines`, `packageManager`).|
| `versionGroups`         | Multi-policy version constraints (see 1.4).                                     |
| `semverGroups`          | Range-style policies (see 1.5).                                                 |

### 1.4 Version-group types (selector field in **bold**)

| Type             | Selector              | Behaviour                                                                                                                     |
| ---------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Highest semver   | (default)             | Pin every instance to the highest semver across the workspace.                                                                |
| Lowest semver    | **`isLowestSemver`**  | Pin every instance to the lowest semver across the workspace (used for "do not exceed" floors).                               |
| Same range       | **`isSameRange`**     | Every instance must use a range that overlaps every other; rejects strict-pin in one place and `^` in another.                |
| Same minor       | **`isSameMinor`**     | All instances must agree on `MAJOR.MINOR`; patch may drift.                                                                   |
| Pinned           | **`pinVersion`**      | Force a literal version (e.g. `pinVersion: "18.2.0"`).                                                                        |
| Banned           | **`isBanned`**        | Reject the dep entirely in matched scopes; `fix` removes it.                                                                  |
| Snapped to       | **`snapTo: [pkgs]`**  | Mirror whatever version the named source-of-truth packages declare.                                                           |
| Catalog          | **`isCatalog`**       | Migrate matched deps into pnpm/bun catalogs and rewrite specifiers to `catalog:` / `catalog:<name>`.                          |
| Ignored          | **`isIgnored`**       | Excluded from any check.                                                                                                      |

Common fields on every group: `dependencies`, `dependencyTypes`, `specifierTypes`, `packages`, `label`. First-match wins; declaration order matters.

### 1.5 Semver-group types

| Type         | Selector       | Behaviour                                                                                                          |
| ------------ | -------------- | ------------------------------------------------------------------------------------------------------------------ |
| With range   | **`range`**    | Force a range character: `""` (exact), `"~"`, `"^"`, `">="`, `"<="`, `">"`, `"<"`, `"*"`. `fix` rewrites in place. |
| Ignored      | **`isIgnored`**| Excluded from range enforcement.                                                                                   |

### 1.6 Custom types (the `engines: node` story)

Four strategies extend syncpack to package.json fields outside `dependencies`/`devDependencies`/`peerDependencies`/`optionalDependencies`:

| Strategy        | Schema                          | Example                                                            |
| --------------- | ------------------------------- | ------------------------------------------------------------------ |
| `name@version`  | `{ path }` to a string          | `"packageManager": "pnpm@9.0.0"`                                   |
| `name~version`  | `{ namePath, path }` to strings | `devEngines.runtime.{name,version}`                                |
| `version`       | `{ path }`                      | `engines.node: "22.11.0"` — the JSON key is the implicit dep name. |
| `versionsByName`| `{ path }` to an object         | A custom map identical in shape to `dependencies`.                 |

Once registered, custom types appear in `--dependency-types` and in version/semver groups.

---

## Section 2 — vis surface (what already ships)

| Capability                                  | Where it lives                                                                                                  | Notes                                                                                                                |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Outdated check                              | `vis check`, `src/util/catalog.ts:checkOutdated`                                                                | Catalog-aware; pnpm/bun/npm; `--target latest|minor|patch`; `--include`/`--exclude`; AI analysis behind `--ai`.        |
| Outdated update                             | `vis update`, `src/util/catalog.ts:applyCatalogUpdates`, `src/commands/update/handler.ts`                       | Catalog mode + PM-native fallback; preserves range character; rollback flag.                                          |
| Audit / vulnerabilities                     | `vis audit`, `src/security/dependency-scan.ts`                                                                  | OSV.dev + Socket.dev; severity gating; `--sync` writes accepted-risk decisions back to pnpm-workspace.yaml.           |
| Doctor (multi-scan)                         | `vis doctor`, `src/commands/doctor/handler.ts`                                                                  | Outdated / security / optimization / runtime / duplicates fan-out. `--fix` autoremediation.                          |
| Lockfile-duplicate detection                | `findDuplicateDependencies` at `src/security/dependency-scan.ts:92`                                             | Reads PM lockfile, reports packages with `>1` resolved version. **Detection only — no autofix policy.**              |
| `add` with auto-conform to catalog/sibling  | `vis add --to <pkg>`, `src/util/conform-to-catalog.ts:131`                                                      | First catalog hit wins, else most-frequent sibling range. Single-shot at install time, not enforced after.            |
| Catalog as version-group substitute         | pnpm/bun catalogs, also npm `workspaces.catalog`                                                                | The only declarative pin vis understands; one entry pins many dependents.                                             |
| Minimum release age                         | `src/util/catalog.ts:1072` (`isTooNew`); `src/commands/update/handler.ts:48` (`readPmNativeMinimumReleaseAge`)  | Reads from `vis.config.yml#update.minimumReleaseAge`, falls back to pnpm-workspace.yaml or package.json. Excludes via `minimumReleaseAgeExclude`. |
| Typosquat + Socket.dev gating on `add`      | `src/security/typosquats.ts`, `src/security/socket-security.ts`                                                 | Refuses or prompts based on Socket score / typo distance.                                                             |
| `sort-package-json`                         | `vis sort-package-json`, native Rust binding via `#native`; handler at `src/commands/sort-package-json/handler.ts` | Field order, `--unsorted`, `--sort-order`, indent + line-ending detection. **No `formatBugs`/`formatRepository` shorthand collapse.** |
| `sync codeowners`                           | `vis sync codeowners`, `src/commands/sync/handler.ts`                                                            | The `sync` namespace exists but currently has exactly one kind. Anything else returns `Unknown sync kind`.            |
| `dedupe`                                    | `vis dedupe`, delegates to PM                                                                                    | No vis-side policy.                                                                                                   |
| `outdated` / `info`                         | Thin wrappers around `pnpm outdated` / `pnpm view`                                                               | Pass-through.                                                                                                         |
| `blockExoticSubdeps`                        | `src/config/types.ts:528`                                                                                        | Refuses git/tarball URLs in transitive deps. **Not a per-name banlist.**                                              |

### 2.1 Concepts that are **absent**

Verified by `grep -rn "versionGroup\|semverGroup\|isPinned\|isBanned\|snappedTo" packages/tooling/vis/src/` returning **zero hits**:

- Declarative version groups (highest/lowest/same-range/same-minor/pinned/banned/snapped-to/ignored).
- Declarative semver-range groups (force `^`, `~`, exact, etc. by scope).
- Per-name banlist (`blockExoticSubdeps` is URL-shape-based, not name-based).
- Custom types — making `engines.node`, `packageManager`, `volta.node`, `devEngines.*` participate in cross-workspace consistency.
- `format` for non-version fields: shorthand for `bugs.url`, `repository.{type,url}`; sort `exports` map; sort `imports`; `sortFirst` / `sortAz` overrides.
- Streaming `--json` of every dep instance for `jq`-style filtering.
- `--show instances/hints/statuses` verbosity tiers.

---

## Section 3 — Capability matrix

Legend: ✓ shipped · ~ partial · — absent

| Capability                                         | syncpack | vis | Notes                                                                                                                                                 |
| -------------------------------------------------- | -------- | --- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Detect "same dep, different version" across pkgs   | ✓ lint   | ~   | `vis doctor` reports it from lockfile, but only at install-time. Not lintable from package.json source-of-truth, no fix path beyond `dedupe`.         |
| Force a specific range char by scope (`^`, `~`, `=`) | ✓ semverGroups | — | The whole "exact in deps, ^ in devDeps" idiom is unexpressible in vis.                                                                                |
| Pin a literal version across workspace             | ~        | ~   | Both can pin via catalog; syncpack also has `pinVersion` outside catalogs.                                                                            |
| Ban a dep by name                                  | ✓        | —   | vis can `--exclude` from reports; cannot reject install or fail CI.                                                                                   |
| Snap-to source-of-truth package                    | ✓        | —   | "Whatever app/foo declares, every other package must match." vis has no equivalent.                                                                   |
| Highest / lowest semver auto-converge              | ✓        | —   | `conformToCatalog` picks "first catalog else most-frequent sibling" — neither highest nor lowest, and only at `add` time.                             |
| Catalog migration (auto-promote dep into catalog)  | ✓ via versionGroup `isCatalog` | ~ | vis honours catalogs once they exist, doesn't migrate matching deps in.                                                                               |
| Custom types (engines, packageManager, devEngines) | ✓        | —   | None of these participate in vis consistency checks today.                                                                                            |
| package.json field-order format                    | ✓        | ✓   | `vis sort-package-json` — Rust-native; comparable.                                                                                                    |
| `formatBugs` / `formatRepository` shorthand        | ✓        | —   | Absent.                                                                                                                                               |
| Sort `exports` map                                 | ✓        | —   | sort-package-json doesn't reorder `exports` conditional keys.                                                                                         |
| Outdated bump with range preservation              | ✓        | ✓   | Parity.                                                                                                                                               |
| `--target latest|minor|patch`                      | ✓        | ✓   | Parity.                                                                                                                                               |
| pnpm/bun catalog awareness                         | ✓        | ✓   | Parity. vis is more catalog-native (catalog-first rather than catalog-as-an-afterthought).                                                            |
| Minimum release age                                | ✓        | ✓   | Parity, plus vis cross-reads pnpm-workspace.yaml + bun config.                                                                                        |
| Audit / vulnerabilities / supply chain             | —        | ✓   | vis is ahead — OSV + Socket + typosquat + accept-risk workflow.                                                                                       |
| AI / fix-on-failure                                | —        | ✓   | vis is ahead — `vis ai heal` for failing tasks; arguably extensible to lint findings.                                                                 |
| `vis add --to <pkg>` (syncpack#285)                | —        | ✓   | vis is ahead — already absorbed.                                                                                                                      |
| Streaming `json` per-instance NDJSON               | ✓        | —   | `vis check --format=json` is a single object, not per-instance NDJSON.                                                                                |
| `list --show instances/hints/statuses`             | ✓        | —   | Different model entirely; vis lists projects/targets, not dep instances.                                                                              |

**Net:** syncpack is ahead on declarative *policy* (groups, custom types, range enforcement); vis is ahead on *security* (audit, Socket, typosquats), AI, catalog-native UX, supply-chain freshness gating. Roughly orthogonal.

---

## Section 4 — Gap-by-gap port recommendations

Effort scale (matches priority-roadmap.md): **S** = days, **M** = 1–4 weeks, **L** = 1–2 months. Demand grade matches Sections 7/8 of `competitive-analysis.md`: ★★★ ≥ 3 competitor signals, ★★ = 2, ★ = novel/inferred.

### Tier A — Ports with strong leverage

#### A1. `vis check --workspace-versions` + `vis check --workspace-versions --fix`

**Effort:** M. **Demand:** ★★ (sherif/manypkg overlap; multiple GH issues per `competitive-analysis.md` 7.2 Theme L, 8.3 #1).

The single biggest syncpack capability vis is missing: detect "the same dep declared at different versions across workspace packages" by reading every package.json, not by inspecting the installed lockfile. Differs from `vis doctor`'s `findDuplicateDependencies` because:

- Lockfile-based detection runs after install and fires on transitive duplication; this is package-author-facing and runs from source.
- A fix pass mutates package.json (and `pnpm-workspace.yaml` catalog entries) rather than calling `pnpm dedupe`.

**Default policy (zero config):** highest-semver wins per dep across `dependencies` ∪ `devDependencies` ∪ `peerDependencies`. Reuses `compareVersions` already in `src/util/catalog.ts`. Ignored deps inherit from `vis check --exclude`.

**Wire shape:**

```bash
vis check --workspace-versions             # report; exit 1 on drift
vis check --workspace-versions --fix       # rewrite package.jsons in place
vis check --workspace-versions --dep react # scope to one name
vis check --workspace-versions --resolve highest|lowest|catalog
```

`--resolve catalog` is the migration aid: when a sibling catalog already pins the dep, rewrite the offending instances to `catalog:`.

**Implementation:** new `src/util/version-drift.ts` over the workspace iterator already in `src/util/catalog.ts`. Reuse `applyCatalogUpdates` for the catalog branch; reuse `readPackageJsonDeps` from `conform-to-catalog.ts`. Tests under `__tests__/util/version-drift.test.ts` with the existing `__fixtures__/` shape.

**Why not a new top-level command:** vis already has `check` for cross-workspace consistency; adding a flag keeps the surface area small. Existing `--include`/`--exclude` filters compose. This matches the "one command, several modes via flags" pattern of `vis sync` and `vis check --security-config`.

#### A2. `vis sync package-json-fields` (syncpack#168 — sync non-version values)

**Effort:** S. **Demand:** ★★ (syncpack#168 has user demand; manypkg has the workspace-protocol variant; Lerna had this).

Extend the existing `vis sync` argument-router with a second kind: `package-json-fields`. Aggregates a small set of metadata fields from each package.json and enforces consistency vs the root.

**Default fields** (configurable via `vis-config.ts#sync.packageJson.fields`): `engines`, `license`, `author`, `repository.{type,url,directory}`, `bugs.url`, `homepage`, `funding`. Critically: `repository.directory` is set to the package's path relative to the workspace root automatically — this is the single most common drift in real monorepos and a Lerna-era footgun.

**Wire shape:**

```bash
vis sync package-json-fields              # write
vis sync package-json-fields --check      # exit 1 on drift, no write
vis sync package-json-fields --field engines,license   # subset
```

**Reuse:** the same `discoverWorkspace` / `loadVisTaskConfigs` plumbing the codeowners path uses. Repository-shorthand collapse from syncpack (`formatBugs`/`formatRepository`) lands here too — store as canonical object form, render as shorthand on write only when fields exactly match the GitHub heuristic.

#### A3. Workspace-protocol enforcement (manypkg parity)

**Effort:** S. **Demand:** ★★ (manypkg's `INTERNAL_MISMATCH` rule has wide adoption; vis's competitive analysis flags it).

Add a check inside A1 (or as `vis check --workspace-protocol`): every internal dep — i.e. one whose name matches a workspace package — must use `workspace:*` (or `workspace:^`/`workspace:~`/exact). Today vis catches this only when an install fails or audit notices.

**Implementation:** trivial — iterate every `dependencies`/`devDependencies` entry, intersect against the workspace-package-name set built by `discoverWorkspace`. Misses get a one-line auto-fix: rewrite to `workspace:*` (or the pre-existing range char if non-empty).

#### A4. `--banned-deps` policy (subset of syncpack `isBanned`)

**Effort:** S. **Demand:** ★ (less broad than A1–A3; teams that want it really want it).

Read a list of forbidden dep names from `vis-config.ts#policy.banned: string[]`. `vis check` reports any package.json containing one; `--fix` removes the entry. Glob support (`legacy-*`, `**deprecated**`).

Stop short of full `versionGroups[].isBanned` with `dependencies` + `dependencyTypes` + `packages` matching for v1. The 90/10 case is "we replaced X with Y; nobody is allowed to add X back."

### Tier B — File but defer

#### B1. Full `versionGroups` + `semverGroups` DSL

**Effort:** L. **Demand:** ★ (heavy users love it; nobody else asks).

Porting the whole policy DSL is the single largest piece of syncpack. Rich (highest/lowest/same-range/same-minor/pinned/banned/snapped-to/ignored × dependencies × dependencyTypes × specifierTypes × packages × label) but expensive: schema, validator, evaluator, fix planner, `--fix` ordering when groups overlap. Defer until A1–A4 surface real demand for cases the simple defaults can't express.

When it lands, fit it into `vis-config.ts` as `dependencyPolicy: { versionGroups: [...], semverGroups: [...] }` rather than a parallel `.syncpackrc`. Reuse Zod schema patterns vis already uses for `vis-config`.

#### B2. Custom types (`engines.node`, `packageManager`, `devEngines.*`)

**Effort:** M. **Demand:** ★★ (most users hit "node engines drift" once and remember it).

Once A2 ships `vis sync package-json-fields` for engines, the next ask is "make `engines.node` participate in `vis check --workspace-versions` so a stale 18.x in one package fails CI." Adopt syncpack's four strategies (`name@version` / `name~version` / `version` / `versionsByName`) but lift them to a typed `vis-config.ts` registry instead of a string-DSL.

Likely useful built-ins to ship as presets, not configuration: `engines`, `packageManager` (parses `pnpm@9.x.y`), `volta.{node,pnpm,yarn}`, `devEngines.{runtime,packageManager}`. Users add custom types only for niche cases.

#### B3. `formatBugs` / `formatRepository` / `sortExports`

**Effort:** S. **Demand:** ★ (cosmetic; matters mostly for npm-published packages).

Extend `sort-package-json` (or its native binding) to:

- Collapse `bugs: { url: "..." }` → string when `url` is the only field.
- Collapse `repository: { type: "git", url: "..." }` → `"user/repo"` when the URL parses cleanly to a GitHub canonical (`https://github.com/user/repo` or `git+ssh://git@github.com/user/repo.git`).
- Sort the `exports` map: `"."` first, then alphabetised; per-condition order `types > import > require > default`.

The bugs/repository case interacts with A2 — pick canonical object form for storage, render shorthand on write only.

#### B4. `vis json` — per-instance NDJSON streaming

**Effort:** S. **Demand:** ★ (power-user; scriptability story).

`vis json deps` would emit one JSON object per dep instance: `{ packageName, depName, depType, specifier, location }`. Targets the `jq | sort | uniq -c` workflow syncpack documents. Cheap once A1 has built the dep-instance iterator.

#### B5. `vis check --workspace-versions --resolve catalog` (auto-migrate)

**Effort:** S on top of A1. **Demand:** ★ (reuses existing catalog UX).

When most siblings already use `catalog:` for a dep, rewrite the holdouts. When ≥ N (configurable; default 3) packages declare the same range outside the catalog, _propose_ adding a catalog entry. Differs from vanilla A1 by being a migration aid rather than a drift-fix.

### Tier C — Don't port

| Item                                                         | Why skip                                                                                                                                                                          |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `syncpack list --show instances/hints/statuses`              | vis `list` is project/target-shaped; reshaping it for dep-instances confuses the UX. NDJSON in B4 covers the scriptable cases.                                                    |
| Standalone `.syncpackrc.json` config file                    | vis owns config via `vis-config.ts`. A separate file fragments the surface; nest under `dependencyPolicy:`.                                                                       |
| `dependencyGroups` (cluster deps as one for reporting)       | Cosmetic in syncpack output; doesn't change behaviour. vis groups by package, not by virtual cluster.                                                                             |
| `maxConcurrentRequests`                                      | Already covered by `vis check`'s registry pool; no new knob needed.                                                                                                               |
| `strict` config flag                                         | vis already has `--exit-code` per command; conflating "strict warnings" with "exit non-zero" is the syncpack lesson — don't repeat.                                               |
| Standalone `vis lint` namespace                              | Two top-level commands for the same thing (`check` + `lint`) is the trap turbo fell into. Keep policy behind `check` flags.                                                       |
| pnpm/bun-specific overrides linting (syncpack#231 query lang)| Would need its own evaluator; pnpm.overrides is a wider problem (resolution diamonds, peer-dep coercion). Out of scope for v1.                                                    |

---

## Section 5 — Suggested execution order

Pulling from Tier A in order, fits into the existing roadmap as one item per quarter rather than a single mega-feature:

1. **A3 (workspace-protocol enforcement)** — smallest patch, highest correctness payoff. ~1 day. Lands as a check inside `vis check`. Validates the dep-iterator before A1 adds drift detection.
2. **A1 (`vis check --workspace-versions`)** — flagship port. The one feature people leave vis for syncpack to get.
3. **A2 (`vis sync package-json-fields`)** — slot in next; the `vis sync` machinery is already half-built and underused. Pairs naturally with A1 since both touch package.json.
4. **A4 (banned deps)** — trivial once A1's iterator exists; ship together if scope allows.

After Tier A lands and produces real-world signal, revisit B1/B2. The order is intentionally inverted from syncpack's own (which puts version-groups front-and-centre): vis's existing catalog story already covers the 90% case, so the *secondary* features (drift detection, field sync, workspace protocol) are the actual gaps.

---

## Section 6 — Assumptions worth challenging

- **A1 default policy = highest-semver-wins.** syncpack's default. The competing pick is "catalog if one exists, else highest." Worth checking against a real failing case before settling.
- **A2 should write to root, not project-by-project.** Assumes the root `package.json` is the source of truth for `engines`/`license`/`repository.type`. If teams already own per-package licenses (e.g. mixed-license monorepo), the default needs an opt-out per package.
- **Reusing `vis sync` for A2 is not a new namespace.** Conflicts with reading "sync" as the syncpack verb; they don't mean the same thing. A user typing `vis sync package-json-fields` may reasonably expect *outbound* sync of their package versions, not metadata. Worth a docs callout.
- **A1's `--fix` is destructive.** Writing to N package.jsons should require either `--fix` explicitly or a confirmation in TTY. Match the `vis cache clean` precedent (out-of-workspace prompt).
- **Custom types (B2) overlap with `vis doctor` runtime checks.** Doctor already verifies Node/pnpm versions match `engines.node` / `packageManager`. The overlap is that doctor is *machine-side* (does my installed Node match?) while custom types are *workspace-side* (do all packages declare the same `engines.node`?). Both useful, both should ship; needs a docs section to disambiguate.
- **Banlist (A4) and `blockExoticSubdeps` are not the same thing.** Existing `blockExoticSubdeps` blocks URL-shape (`git+`, `file:`); A4 blocks by name. Both wanted.

---

## Section 7 — Sources

- syncpack 14: github.com/JamieMason/syncpack, syncpack.dev, syncpack.dev/config/, syncpack.dev/version-groups/, syncpack.dev/semver-groups/, syncpack.dev/config/custom-types
- syncpack open issues mined in `competitive-analysis.md` Section 7.2 Theme L, 8.3
- vis source paths inline (verified `alpha` branch).
- Adjacent tools for context: github.com/Thinkmill/manypkg (workspace-protocol enforcement), github.com/QuiiBz/sherif (zero-config monorepo lint).
