# Design — Offline-first OSV vulnerability scanner via `vis-native` SQLite

Spec for adding the missing pieces to `vis audit`: an offline OSV advisory database (synced into SQLite by the existing `vis-native` Rust crate), true `--fix` (apply + rescan), `--prod-only`, `--fail-on <sev>`, reachability filter (`--usage` / `--only-used`), HTML report, and SARIF output.

Two roadmap themes converge here: the "Security & Health" command group (`vis audit`, `vis check`, OSV.dev) called out in `competitive-analysis.md`, and the "no-network developer loop" pain that the Tier-B air-gapped story has skirted so far.

## Why

Three pains, one shape:

1. **Online-only audit is brittle.** `src/util/catalog.ts:fetchVulnerabilities` `POST`s to `api.osv.dev/v1/querybatch` with a 10 s timeout and a `catch → empty map` fallback. On a flaky network, every `vis audit` silently degrades to "no vulnerabilities found." Worse for CI on locked-down runners that block `api.osv.dev` outright — the failure is invisible. An offline `advisories sync` + `--offline` is the obvious fix; air-gapped enterprise + bullet-proof CI are the consumers.
2. **`vis audit --fix` lies a little.** Today the flag prints `Fix: update to <version>` lines and stops. The actual workflow users want is an autopilot loop (apply via PM, rescan, exit clean) that competitor tooling (`npm audit fix`, `pnpm audit --fix`) trains them to expect.
3. **No report surface.** vis emits table + JSON. Engineering managers, security reviewers, and PR reviewers ask for a dashboard — a self-contained HTML file with severity buckets, copy-ready remediation commands, and breaking-change markers.

Everywhere the data already exists in vis we extend instead of duplicate.

## Current state

| Capability                                             | Module                                                      | Today                                                                                                                    |
| ------------------------------------------------------ | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| OSV `querybatch` (online)                              | `src/util/catalog.ts:1191` `fetchVulnerabilities`           | exists                                                                                                                   |
| Lockfile discovery                                     | `src/security/dependency-scan.ts` `lockedPackages`          | exists                                                                                                                   |
| Audit CLI                                              | `src/commands/audit/{index,handler}.ts`                     | exists; flags: `--severity / --format / --fix (suggest-only) / --exit-code / --show-accepted / --sync`                   |
| Native PM exclusions                                   | `src/config/audit-config.ts` `readNativeAuditExclusions`    | exists                                                                                                                   |
| Accepted-risks → native PM config sync                 | same file, `syncAcceptedRisksToNativeConfig`                | exists                                                                                                                   |
| Socket.dev supply-chain layer                          | `src/security/socket-security.ts`                           | exists                                                                                                                   |
| Duplicate-dep detection                                | `src/security/dependency-scan.ts:findDuplicateDependencies` | exists                                                                                                                   |
| Live scan progress                                     | `src/scan/scan-progress.ts`                                 | exists                                                                                                                   |
| SBOM (CycloneDX 1.7)                                   | `src/sbom/`                                                 | exists                                                                                                                   |
| `vis-native` Rust crate (8 NAPI targets)               | `native/`                                                   | exists; ABI version 3, deps: `napi`, `napi-derive`, `ec4rs`, `prek-identify`, `serde_json`, `sort-package-json`, `which` |
| MCP server + Claude Skill                              | `@visulima/vis-mcp`, `skills/`                              | shipped                                                                                                                  |
| Offline OSV DB                                         | —                                                           | **missing**                                                                                                              |
| Apply-fix loop (direct)                                | —                                                           | **missing**                                                                                                              |
| Apply-fix loop (transitive overrides)                  | —                                                           | **missing**                                                                                                              |
| HTML report                                            | —                                                           | **missing**                                                                                                              |
| Reachability filter                                    | —                                                           | **missing**                                                                                                              |
| SARIF / CSAF / CycloneDX-VEX output                    | —                                                           | **missing**                                                                                                              |
| `--prod-only`                                          | —                                                           | **missing**                                                                                                              |
| Multi-ecosystem (PyPI / Cargo / Maven / Go / RubyGems) | —                                                           | **missing**                                                                                                              |
| Signed advisory bundles (Sigstore)                     | —                                                           | **missing**                                                                                                              |

## Proposed surface

### A. New: `vis advisories` subcommand group

```bash
vis advisories sync              # Pull OSV npm dump → ~/.cache/vis/advisories/db.sqlite
vis advisories sync --ecosystem npm,pypi   # Future-proof; npm only at launch
vis advisories sync --force      # Re-download even if cache is fresh
vis advisories status            # Print db path, ecosystem(s), row counts, last-sync, freshness
vis advisories prune             # Delete the local DB
```

`advisories` lives at `src/commands/advisories/{index,handler.ts,sync.ts,status.ts,prune.ts}`. Read-only paths (`status`) are pure-JS; mutating paths (`sync`, `prune`) call into the native crate.

### B. New flags on `vis audit`

```text
--offline                    Use the local DB; error if not synced
--db <path>                  Override the default cache location
--ecosystem <e1,e2,...>      Scan against these ecosystems (default: auto-detect from lockfiles)
--prod-only                  Filter out devDependencies before scan
--fail-on <severity>         Exit 1 if any finding is >= severity (alias for --severity+--exit-code semantically;
                             differs because --severity also filters display, --fail-on only affects exit code)
--report [path]              Emit HTML report (default: ./vis-audit-report.html)
--no-open                    Don't auto-open the browser after --report
--format <fmt>               table | json | sarif | csaf | cyclonedx-vex
--usage                      Run reachability pass (static + light dynamic import detection)
--only-used                  With --usage: hide findings in unimported packages
--apply                      Autofix direct deps: apply upgrades via the active PM, then rescan
--apply-transitive           Autofix transitives via PM override mechanism (pnpm overrides, npm overrides, yarn resolutions, bun overrides)
```

`--apply` is the renamed, behavior-changing successor to today's `--fix`. To keep the existing UX working, `--fix` becomes an alias for `--apply` and the historical "show fix suggestions" behavior moves under `--show-fixes` (default-on so existing scripts that read the output see no change). Migration note in the changelog.

`--fail-on` is a different mental model than `--severity`. `--severity high` _filters_ the report down to high+; `--fail-on high` _gates CI_ on findings ≥ high regardless of what's displayed. Both flags coexist.

### C. New config block

```ts
// vis.config.ts
import { defineConfig } from "@visulima/vis/config";

export default defineConfig({
    security: {
        audit: {
            offline: true, // default --offline for `vis audit`
            failOn: "high", // default --fail-on
            advisories: {
                ecosystems: ["npm", "pypi"], // ecosystems to sync; auto-detected if omitted
                refreshIntervalHours: 24, // warn-only freshness gate (not auto-pull)
                source: "https://osv-vulnerabilities.storage.googleapis.com",
                allowedHosts: [], // extra hostnames permitted as `source`; built-ins auto-allowed
                verify: {
                    enabled: false, // off until OSV publishes upstream signatures or user is on a mirror
                    expectedIssuer: "https://accounts.google.com",
                    expectedSubject: "release@osv.dev",
                },
            },
            usage: {
                enabled: false, // turn on --usage by default
                onlyUsed: false, // gate findings to imported packages (requires enabled = true)
                dynamic: true, // detect import() / require(literal); off → static-only
                alwaysAssumeUsed: ["esbuild", "webpack-cli"],
                // packages forced to "imported"; only consulted when
                // enabled = true. Inert (warn-only at config-load) otherwise.
            },
            apply: {
                transitive: {
                    enabled: false, // gate --apply-transitive in CI behind a config opt-in
                    strategy: "minimum-fix", // "minimum-fix" | "latest"; minimum-fix bumps to the lowest fixed version
                },
            },
            report: {
                outputPath: "./reports/audit.html",
                autoOpen: false, // off in CI either way
            },
        },
    },
});
```

Lives next to existing `security` keys (`allowBuilds`, `socket`, etc.) — no new top-level surface.

## Architecture

### A. Native SQLite via `rusqlite` in `vis-native`

```toml
# native/Cargo.toml
[dependencies]
rusqlite     = { version = "0.32", features = ["bundled", "blob"] }
zip          = { version = "2", default-features = false, features = ["deflate"] }
serde        = { version = "1", features = ["derive"] }
serde_json   = "1"                                     # already a dep
semver       = "1"                                     # range matching at ingest time
sigstore     = { version = "0.10", optional = true }   # signed-bundle verification, feature-gated
```

Why each:

- **`rusqlite` with `bundled`** — ships SQLite source statically compiled into the `.node` binary. No system dependency, no `better-sqlite3`-class install break, identical behavior across all 8 NAPI targets. Adds ~1.2 MB compressed per platform binary, acceptable; the crate already pre-builds on CI for every target via `.github/workflows/build-native.yml`.
- **`zip`** — OSV ships dumps as `.zip` (one JSON per advisory). The zip format keeps its central directory at the tail of the file, so the reader needs `Seek` — we buffer the download to a temp file (in Node) and hand the path to Rust. `default-features = false` drops bzip2/deflate64/lzma we don't need.
- **`semver`** — `affected[]` ranges in OSV are open-form (`introduced` / `fixed` events on a number line). We expand them into `(introduced, fixed)` pairs at ingest and run the comparison at query time. Pulls one well-audited crate; no ecosystem-specific range dialects beyond npm SemVer for the MVP.
- **`sigstore`** (optional, feature `verify-signatures`) — gated behind a Cargo feature so users who don't need signature verification don't pay the dep cost. See §I.

The HTTPS client moves to JS (Node `fetch`); see Decision #3 for the why. The native crate has no network surface at all — Rust only ever reads a local zip path that Node provided.

License check vs `native/deny.toml`: `rusqlite` is MIT; `libsqlite3-sys` (the `bundled` backend) carries the SQLite public-domain notice plus an `MIT` Cargo manifest license string. `zip` is MIT, `serde` is MIT/Apache-2.0, `semver` is MIT/Apache-2.0, `sigstore` is Apache-2.0. The `bundled-sqlite3` package's license string in some versions is `blessing` (the SQLite "blessing" notice) — `deny.toml` needs `blessing` added to `allow = [...]`. Flagged in §Decisions.

### B. NAPI surface

New functions (bump `NATIVE_BINDING_VERSION` to **4**):

```ts
// index.d.ts (auto-generated by NAPI-RS; shown here for design clarity)
export interface AdvisoryIngestOptions {
    /** Path to a previously-downloaded OSV dump zip on disk. Node downloads, Rust ingests. */
    zipPath: string;
    dbPath: string;
    ecosystem: string; // "npm" | "pypi" | "cargo" | "maven" | "go" | ...
    /** Opaque token to write into meta.manifest_etag (HTTP ETag header). */
    manifestEtag: string | null;
}

export interface AdvisoryIngestResult {
    advisoriesIngested: number;
    durationMs: number;
}

export declare function advisoriesIngest(options: AdvisoryIngestOptions, onProgress: (current: number, total: number) => void): Promise<AdvisoryIngestResult>;

export interface AdvisoryQuery {
    ecosystem: string;
    name: string;
    version: string; // exact installed version, semver-validated upstream in JS
}

export interface NativeVulnerability {
    id: string; // OSV id (e.g. "GHSA-xxxx" or "PYSEC-...")
    aliases: Array<string>; // CVE-*, GHSA-*, MAL-*, ...
    severity: "CRITICAL" | "HIGH" | "MODERATE" | "LOW" | "UNKNOWN";
    summary: string;
    fixedVersions: Array<string>; // empty array if none
    cvssScore: number | null;
}

export interface AdvisoryQueryResult {
    name: string;
    version: string;
    vulnerabilities: Array<NativeVulnerability>;
}

export declare function advisoriesQuery(dbPath: string, queries: Array<AdvisoryQuery>): Array<AdvisoryQueryResult>;

export interface AdvisoryDbStatus {
    exists: boolean;
    ecosystems: Array<{ name: string; advisoryCount: number; lastSyncIso: string }>;
    sizeBytes: number;
    schemaVersion: number;
}

export declare function advisoriesStatus(dbPath: string): AdvisoryDbStatus;

/** Verify a Sigstore signature bundle against a downloaded zip. Gated by the `verify-signatures` cargo feature. */
export interface VerifySignatureOptions {
    zipPath: string;
    signaturePath: string; // path to .sig file (Sigstore bundle JSON)
    /** Trust policy: identity must match this OIDC issuer / subject. */
    expectedIssuer: string; // e.g. "https://accounts.google.com"
    expectedSubject: string; // e.g. "release@osv.dev"
}

export declare function verifyAdvisorySignature(options: VerifySignatureOptions): { valid: boolean; certificateSubject: string | null };
```

`advisoriesIngest` is `async` because ingest can take seconds; we don't block the libuv pool. `advisoriesQuery` is synchronous: the working set for a JS-monorepo audit is 1k–10k rows, and a prepared `SELECT … WHERE name = ? AND ecosystem = ?` followed by an in-Rust semver match returns in low milliseconds. `verifyAdvisorySignature` is also synchronous — Sigstore bundle verification is bounded crypto work (~10 ms for an OSV-sized blob) and the caller is already off the hot path (it runs once per sync, before ingest, not per query).

### C. SQLite schema (v1)

```sql
CREATE TABLE meta (
    ecosystem TEXT NOT NULL,                  -- ecosystem scope; '' (empty) for DB-wide rows
    key       TEXT NOT NULL,
    value     TEXT NOT NULL,
    PRIMARY KEY (ecosystem, key)
);
-- DB-wide rows (ecosystem = ''):    schema_version
-- Per-ecosystem rows (e.g. 'npm'):  last_sync_iso, manifest_etag, advisory_count

CREATE TABLE advisory (
    id           TEXT PRIMARY KEY,            -- OSV id
    summary      TEXT NOT NULL,
    severity     TEXT NOT NULL,               -- normalized: CRITICAL / HIGH / MODERATE / LOW / UNKNOWN
    cvss_score   REAL,                        -- nullable
    published    TEXT NOT NULL,               -- ISO-8601
    modified     TEXT NOT NULL                -- ISO-8601, for sorting / freshness
);

CREATE TABLE advisory_alias (
    advisory_id TEXT NOT NULL REFERENCES advisory(id) ON DELETE CASCADE,
    alias       TEXT NOT NULL,                -- CVE-2024-xxxxx, GHSA-xxxx, etc.
    PRIMARY KEY (advisory_id, alias)
);
CREATE INDEX idx_alias_value ON advisory_alias(alias);

CREATE TABLE affected (
    advisory_id TEXT NOT NULL REFERENCES advisory(id) ON DELETE CASCADE,
    ecosystem   TEXT NOT NULL,                -- "npm", "PyPI", "crates.io", ...
    package     TEXT NOT NULL,                -- normalized lower-case (where applicable per ecosystem)
    introduced  TEXT NOT NULL,                -- semver "0" if open-low
    fixed       TEXT,                         -- nullable; nullable = "no fix yet"
    range_index INTEGER NOT NULL,             -- monotonic index of this range within (advisory, package)
                                              -- distinguishes overlapping ranges from the same advisory
    PRIMARY KEY (advisory_id, ecosystem, package, introduced, range_index)
);
CREATE INDEX idx_affected_package ON affected(ecosystem, package);
```

Query path: `JOIN affected USING(advisory_id)` filtered on `(ecosystem, package)`, semver-range match done in Rust (the `semver` crate, MIT/Apache-2.0). We deliberately do not store rendered semver ranges as strings — we expand to `(introduced, fixed)` pairs at ingest so the hot path is two indexed-lookups + a comparison. `range_index` exists because real OSV records carry overlapping `(introduced, fixed)` pairs per `(package, ecosystem)` (multiple branches patched at different versions) — the index is monotonic in ingest order, so collisions only happen on actual duplicates, which we want to dedupe anyway.

Schema version is the DB-wide `meta` row `(ecosystem='', key='schema_version')`. On query, Rust validates `schema_version >= MIN_SUPPORTED && schema_version <= NATIVE_KNOWN`; a newer DB than the native code (a future vis wrote it) errors with a "downgrade vis" hint, an older DB triggers `vis advisories sync --force` to rebuild. This keeps a forward-compat shim possible (additive columns at v2 can stay readable from v1 code) without inviting silent empty-result regressions.

### D. Sync flow

```text
   ┌────────────────────────────────────────────┐
   │  vis advisories sync [--ecosystem npm,...]  │
   └────┬───────────────────────────────────────┘
        │  JS, per ecosystem:
        │ 1. resolve dbPath via @visulima/find-cache-dir → <cache>/vis/advisories/db.sqlite
        │ 2. HEAD <source>/<ecosystem>/all.zip (Node fetch)
        │    → if ETag == meta(ecosystem=?, key='manifest_etag').value && !force, skip
        │ 3. GET <source>/<ecosystem>/all.zip, stream-pipe to <cache>/vis/advisories/<eco>.zip.tmp
        │    → progress UI driven from JS (existing scan-progress)
        │    → enforce response Content-Length cap (MAX_ZIP_BYTES, see §Security)
        │ 4. (optional) GET <source>/<ecosystem>/all.zip.sig if security.audit.advisories.verify=true
        │    → call native verifyAdvisorySignature(); abort + delete tmp on mismatch
        │ 5. rename .zip.tmp → <eco>.zip
        │ 6. call native advisoriesIngest({ zipPath, dbPath, ecosystem, manifestEtag }, onProgress)
        ▼
   ┌────────────────────────────────────────────┐
   │  Rust: advisoriesIngest                     │
   │  a. open new DB connection on dbPath        │
   │  b. PRAGMA journal_mode=WAL; synchronous=NORMAL; foreign_keys=ON    (concurrent reader-safe)
   │  c. BEGIN IMMEDIATE                                                  (writer lock, fail fast)
   │  d. DELETE FROM affected WHERE ecosystem = ?;                        -- only this ecosystem's rows
   │     DELETE FROM advisory WHERE id NOT IN (SELECT advisory_id FROM affected);
   │                                                                      -- GC advisories with no affected rows
   │                                                                      -- left in any ecosystem; aliases cascade.
   │     -- Order matters: deleting `advisory` first would cascade-drop other
   │     -- ecosystems' `affected` rows for the same advisory id.
   │  e. zip::ZipArchive::new(File::open(zipPath))                        -- needs Seek
   │     -- enforce per-entry uncompressed cap MAX_ENTRY_BYTES and total cap MAX_TOTAL_BYTES (zip-bomb guard)
   │  f. for each entry: serde_json::from_slice → expand affected[].ranges to (introduced, fixed) pairs → INSERT
   │     (range_index = running counter scoped to (advisory, ecosystem, package))
   │     flush + emit progress(n, total) every 5k rows
   │  g. INSERT/UPDATE meta rows for (ecosystem=?, key in {last_sync_iso, manifest_etag, advisory_count})
   │  h. COMMIT
   │  i. ANALYZE (separate transaction)
   │  j. delete zipPath (Node could but Rust knows we're done)
   └────────────────────────────────────────────┘
```

Two quiet wins:

- **ETag short-circuit.** A daily `vis advisories sync` in CI does one HEAD request and no work when nothing has rotated.
- **One DB, all ecosystems.** A multi-stack monorepo (Node + Python services + Rust workers) gets a single `db.sqlite` instead of N parallel SQLite files; ecosystem is a column, not a filename. `advisoriesQuery` accepts a heterogeneous batch from a single call.

Atomic-ish semantics: the WAL approach keeps in-progress ingest invisible to concurrent readers, and the `BEGIN IMMEDIATE` lock guarantees only one writer at a time. A crash mid-ingest leaves the DB consistent (old data still queryable) because the per-ecosystem `DELETE` + `INSERT` is a single transaction.

### E. Query path

```text
   vis audit --offline
   ├─ JS:  lockedPackages(workspaceRoot, pm)        // existing
   ├─ JS:  filter --prod-only via @visulima/package // new
   ├─ JS:  buildAdvisoryQueries(packages)
   ├─ Rust: advisoriesQuery(dbPath, queries)        // single sync call, one prepared statement
   ├─ JS:  mergeWithSocketReports(...)              // existing flow, unchanged
   ├─ JS:  optional reachability pass               // §F
   └─ JS:  render (table | json | sarif | html)     // §G
```

`fetchVulnerabilities` in `src/util/catalog.ts` stays for the online path. A new `queryVulnerabilitiesOffline` lives next to it with an identical signature returning `Map<string, SecurityVulnerability[]>`. The audit handler picks one based on `options.offline ?? config.security.audit.offline ?? false`.

A `--source auto` mode (default) tries offline first if a DB exists, otherwise online; `--source online` and `--source offline` force the choice. Not exposing this in the MVP — defaults are explicit per-flag.

### F. Reachability filter (static + light dynamic)

`--usage` is a fresh code path, no leverage from existing vis modules.

Two tiers run; the second only when `security.audit.usage.dynamic` is on (default-on).

**Tier 1 — static import scan (Rust).**

1. Enumerate vulnerable packages from the audit pass.
2. Walk the workspace source tree (respect `.gitignore` via `ignore`, already a vis dep). Two languages cover ~98% of JS-land monorepos:
    - JS/TS: ES + CJS imports via a token scan in Rust. `oxc_resolver` is overkill; a regex-on-stripped-comments pass is good enough for "is this package imported anywhere".
    - JSON `package.json` `dependencies` — covers conventional setups where a package is declared but never imported (Knip's territory, free win here).
3. Return `Set<vulnerablePackage>` of statically-imported packages.

**Tier 2 — light dynamic detection (Rust, same pass).**

Static-only reachability misses three patterns that come up daily and historically force users to set `--no-usage`:

- `import("pkg")` with a string-literal argument — trivially resolvable.
- `require(VAR)` where `VAR` is a `const VAR = "pkg"` in the same scope — local data-flow over a few hundred lines, doable without a full type-checker.
- Loader-glob patterns: webpack `require.context("./pages", true, /\.tsx$/)`, Vite `import.meta.glob("./modules/**/*.ts")`, and the equivalents in Next, Remix, Astro. We detect the loader pattern by tokenizing, then count any package referenced inside the resolved globbed file set as "imported."

What we explicitly don't try (documented as known false-negatives):

- Truly dynamic strings (`require(somethingComputed())`) — flagged "unresolved" and treated as `--no-only-used` for that package (keep, don't drop). Never drop a finding behind an "I couldn't tell" signal.
- Plugin/preset chains in tool configs (`babel.config.js`, `eslint.config.js`) where presets pull other packages by string. The escape hatch `alwaysAssumeUsed: string[]` keeps build-time/loader packages (`esbuild`, `webpack-cli`, etc.) in scope.

A planned **Tier 3 (runtime tracing)** lives behind a future `--usage=runtime` flag and is a separate RFC — it would require a `NODE_OPTIONS=--require ./vis-trace.js` shim around `node`, a startup interceptor on `require` + ES `import`, and a results file the next `vis audit` reads. The benefit (catches truly dynamic loads) is real; the cost (changes how the user runs their app) is too high to ship on by default.

Lives in `src/security/reachability.ts` (JS-side, calls a new `scan_imports` NAPI function for the Rust scanner). The Rust function reuses `prek-identify` for file-type filtering (already a native dep).

### G. Report formats

- **`--format=sarif`**: new branch in `audit/handler.ts`. SARIF 2.1.0; one `run` per audit invocation, `tool.driver.name = "vis-audit"`, `rules[]` from advisory IDs, `results[]` one per (package, advisory) pair. `level` mapped from severity: `CRITICAL`/`HIGH` → `"error"`, `MODERATE` → `"warning"`, `LOW`/`UNKNOWN` → `"note"`. The internal `MODERATE` label is emitted as `medium` on `properties.securitySeverity` so SARIF consumers (GitHub Code Scanning, IDE plugins) see industry-standard labels; the `level` mapping above is the one SARIF consumers actually gate on. PartialFingerprints `{ advisoryId, package, version }` so GitHub Code Scanning deduplicates correctly across runs.
- **`--format=csaf`**: CSAF 2.0 (Common Security Advisory Framework). Emits a `csaf_vex` profile document: `document.category = "csaf_vex"`, `vulnerabilities[]` with `product_status.known_affected` populated from the audit findings, `product_tree` enumerating each `(name, version)` as a `product_id`. Consumers: enterprise vuln-management pipelines (ServiceNow, Vulcan Cyber), regulatory pipelines. Lives in `src/report/csaf.ts`; type-safe builder over the upstream JSON schema (vendored under `src/report/schemas/csaf-2.0.json`).
- **`--format=cyclonedx-vex`**: CycloneDX 1.7 with the `vulnerabilities[]` section populated. This shares 90% of its emitter with the existing SBOM module — `src/sbom/cyclonedx.ts` already produces the document skeleton; the VEX path adds vulnerability records inline. Output is a single document that is both a SBOM **and** a VEX statement, which is what GitHub Dependabot's CycloneDX consumer and most attestation tools want. Lives in `src/report/cyclonedx-vex.ts`, importing the existing SBOM builder.
- **`--report` HTML**: new `src/report/audit-html/` module. Single self-contained HTML file (inlined CSS + JS, no external requests, no analytics). Renderer is Preact-on-render — vis already ships React for the TUI, but the report bundle should be tiny and not pull React. Inline a small Preact build (~3 KB gz) via `packem`. Contents: severity buckets, sortable/filterable findings table, copy-ready remediation commands per row (uses the same builder as `--apply`), breaking-change marker (semver diff between installed and lowest fixed version: `major` → red flag, `minor/patch` → green). Auto-opens via the npm `open` package (new vis runtime dep, ~6 KB), and only when stdout is a TTY and `is-in-ci` says we're interactive. `open` is `dependencies`, not `optionalDependencies` — failure to launch the browser falls back to a stderr "Report at <path>" line, not a crash.

### H. Apply-fix loop (`--apply` direct, `--apply-transitive` transitive)

```text
   ┌──────────────────────────────┐
   │ scan → vulnMap (offline/online) │
   └────┬─────────────────────────┘
        │ build remediation plan (see below)
        │ emit dry-run preview, prompt unless --yes / CI-with-config-opt-in
        ▼
   ┌──────────────────────────────┐
   │ apply phase                   │
   │   direct:     pnpm update <pkg>@<v> / npm install / yarn up / bun update
   │   transitive: write override entry, then re-install
   └────┬─────────────────────────┘
        │ if PM exit != 0 → bail, surface PM output, exit 1
        ▼
   ┌──────────────────────────────┐
   │ rescan; print diff vs before │
   └──────────────────────────────┘
```

Reuses `src/pm/pm-runner.ts` `detectPm` + the existing update plumbing (`src/commands/update/handler.ts`).

**Direct deps (`--apply`).** Filter findings where the vulnerable package is in the workspace `package.json` `dependencies` / `devDependencies`. Bump to `lowestFixedVersion` that satisfies the existing range; if no satisfying version, surface `--allow-major` as the override path.

**Transitive deps (`--apply-transitive`).** When the vulnerable package is buried below a direct dep, write a PM-specific override. The override target is `lowestFixedVersion` of the closest direct ancestor that doesn't already pin the bad version. New module `src/security/transitive-fix.ts` with per-PM writers:

| PM                 | Where the override lives             | Shape                                                                                                                                                                                                                  |
| ------------------ | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| pnpm               | `pnpm-workspace.yaml` → `overrides:` | `'<pkg>': '^1.2.3'`                                                                                                                                                                                                    |
| npm                | `package.json` → `overrides:`        | `{ "<pkg>": "^1.2.3" }`                                                                                                                                                                                                |
| yarn berry (≥ 2.x) | `package.json` → `resolutions:`      | `{ "<pkg>": "^1.2.3" }` — berry also accepts descriptor keys like `"<parent>/<pkg>": "^1.2.3"` for parent-scoped pins; we emit the plain key form for the MVP and surface a config note for users who need scoped pins |
| yarn classic (1.x) | `package.json` → `resolutions:`      | plain key form only; berry's descriptor syntax is unsupported here                                                                                                                                                     |
| bun                | `package.json` → `overrides:`        | npm-compatible                                                                                                                                                                                                         |

Writers preserve existing entries (merge, never replace) and emit deterministic ordering (sorted keys) so the diff stays reviewable. After write, the PM runs its install with the override in effect; we then rescan to confirm the fix actually landed (override could be shadowed by a more-specific entry).

Three safety rules baked in:

1. **Confirmation gate.** Outside CI, prompt before running PM commands. In CI, refuse unless `--yes` AND (for `--apply-transitive`) `security.audit.apply.transitive.enabled = true` — two locks, because rewriting overrides is a higher-blast-radius operation than bumping a top-level version.
2. **Dry-run by default for transitives.** First invocation of `--apply-transitive` prints the override plan + a diff of the would-be `pnpm-workspace.yaml` / `package.json` and exits without writing. `--yes` confirms.
3. **Atomic write.** Override edits go via `writeFileSync` to a `.tmp` sibling + rename, never in-place; a crash mid-write leaves the project file intact.

### I. Signed advisory bundles

OSV does **not** publish signatures upstream today, so the design has to cover three reality tiers:

1. **OSV upstream stays unsigned (today).** `security.audit.advisories.verify.enabled = false` by default. The user runs untrusted bytes from a Google Cloud Storage bucket; the trust boundary is the same as `npm install`. Documented in `docs/guides/security-audit.mdx`. No code path engages.
2. **User runs their own mirror with cosign-signed dumps.** A common enterprise pattern: a daily job downloads OSV, re-uploads it to an internal bucket, and produces a Sigstore bundle alongside it (`all.zip.sig`). The user points `security.audit.advisories.source` at the mirror and sets `verify.enabled = true` with their internal OIDC identity in `expectedIssuer` / `expectedSubject`. The sync flow downloads `<eco>/all.zip.sig` next to the zip, calls `verifyAdvisorySignature()` in Rust (gated by Cargo feature `verify-signatures`, default-on for the release build), aborts on mismatch.
3. **OSV upstream eventually signs (future).** When/if OSV publishes Sigstore signatures, we ship a known-good identity pair in vis's defaults (`expectedIssuer = "https://accounts.google.com"`, `expectedSubject` = whatever OSV publishes), default `verify.enabled = true`, and corporate users get end-to-end provenance for free.

Implementation lives in `native/src/advisories/verify.rs`. The `sigstore` crate's `verify_blob` API takes the zip bytes, the bundle JSON, and an identity policy; returns the certificate subject for logging. Cargo feature gate keeps the dep cost (~2 MB compressed across roots + cosign primitives) optional — corporate-mirror users opt in at build time via `napi build --features verify-signatures`.

The feature gate matters because we publish 8 prebuilt `.node` files. The release pipeline (`build-native.yml`) builds two variants for each target: a default binary without signature verification, and a `-verified` binary with it. The JS loader picks based on the user's config: when `verify.enabled = true` and the standard binary loads, it surfaces `AdvisorySignatureUnsupportedError` with a hint to install `@visulima/vis-binding-<target>-verified`. Cleaner alternative is to always-include the feature and eat the size; this is the call we make in §Decisions.

### J. Multi-ecosystem support

OSV is ecosystem-aware; the schema, NAPI surface, and SQL queries already accept `ecosystem` as a column / parameter from day one (see §A, §B). What changes per ecosystem is the **lockfile reader** (which packages do I have installed?) and the **range matcher** (does this OSV `affected[]` entry apply to my version?).

| Ecosystem | OSV ecosystem name | Lockfile(s)                                                                | Range dialect                      |
| --------- | ------------------ | -------------------------------------------------------------------------- | ---------------------------------- |
| npm       | `npm`              | `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `bun.lock`             | SemVer (npm)                       |
| PyPI      | `PyPI`             | `poetry.lock`, `uv.lock`, `Pipfile.lock`, `requirements.txt` (best-effort) | PEP 440                            |
| Cargo     | `crates.io`        | `Cargo.lock`                                                               | SemVer (cargo)                     |
| Maven     | `Maven`            | `pom.xml` lock outputs, `gradle.lockfile`                                  | Maven version order                |
| Go        | `Go`               | `go.sum`                                                                   | SemVer with `+incompatible` quirks |
| RubyGems  | `RubyGems`         | `Gemfile.lock`                                                             | RubyGems requirement               |

MVP ships **npm** only; the rest land behind feature parity once a single ecosystem is rock-solid. The schema and CLI flags (`--ecosystem npm,pypi`) are stable from day one so opting in later is purely additive.

Range matching abstracts behind a Rust trait:

```rust
pub trait RangeMatcher: Send + Sync {
    fn matches(&self, version: &str, introduced: &str, fixed: Option<&str>) -> bool;
}
```

Implementations: `NpmSemverMatcher` (using `semver` crate; MVP), `Pep440Matcher`, `CargoSemverMatcher` (slightly different from npm — pre-release semantics), `MavenMatcher`, `GoSemverMatcher`, `RubyGemsMatcher`. Each is a separate file under `native/src/advisories/range/`. Picking the matcher at query time is a `match` on ecosystem string; no dynamic dispatch overhead worth measuring.

Lockfile readers on the JS side extend `@visulima/package`'s existing parser (which today knows the four JS lockfile formats). For non-JS ecosystems we add small adapters under `src/security/lockfile-readers/` rather than burdening `@visulima/package` with cross-language concerns; the adapters share a `LockedPackage[]` return type so the audit handler is ecosystem-agnostic above this layer.

Ecosystem auto-detection: presence of `Cargo.lock` → enable `crates.io`, presence of `poetry.lock` / `uv.lock` / `Pipfile.lock` → enable `PyPI`, etc. Explicit `--ecosystem` overrides. A polyglot monorepo gets a single `vis audit` covering everything from one `<cache>/vis/advisories/db.sqlite` — the `ecosystem` column on `affected` and the composite `(ecosystem, key)` PK on `meta` keep each ecosystem's data isolated within that single file.

## ABI / wire format

- `NATIVE_BINDING_VERSION` bumps `3 → 4`. The existing loader in `index.js` already rejects mismatched versions — pre-port `.node` binaries from local dev hard-fail with a clear error.
- DB `schema_version = 1` stored in `meta`. Rust query path refuses on mismatch; user is told to `vis advisories sync --force`.
- The OSV manifest ETag is opaque to us — we treat it as a string, no parsing. If the upstream stops sending ETag, sync silently downgrades to "always download" — flagged in `vis advisories status`.

## Caching & invalidation

- DB lives at `<cache>/vis/advisories/db.sqlite` via `@visulima/find-cache-dir` (already a dep). Per-user, machine-local; not committed. A single file holds every ecosystem the user syncs — see §C for the schema that scopes rows via the `ecosystem` column and composite `meta` PK.
- `vis advisories status` is the only "did the cache go stale" surface. We deliberately don't auto-sync on `vis audit --offline` — silent network calls behind an `--offline` flag are a footgun. Refresh-interval-warning instead: if `last_sync_iso` is older than `refreshIntervalHours`, audit prints a notice (CI: also `process.exitCode = 0`, just a stderr line).
- `vis advisories prune` is the manual escape hatch; no auto-eviction.

## Error handling

| Class                         | Trigger                              | Message                                                                                                                                                                                                                                                                                                            |
| ----------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `AdvisoryDbNotFoundError`     | `vis audit --offline` with no DB     | `No local advisory DB at <path>. Run 'vis advisories sync' first.`                                                                                                                                                                                                                                                 |
| `AdvisorySchemaMismatchError` | DB schema_version != native expected | `Advisory DB schema is v<n>, this build of vis expects v<m>. Run 'vis advisories sync --force'.`                                                                                                                                                                                                                   |
| `AdvisorySyncNetworkError`    | Download fails after retries         | Surfaces underlying status + URL; suggests `--source` or proxy env                                                                                                                                                                                                                                                 |
| `AdvisorySyncCorruptError`    | Zip CRC fails or JSON parse fails    | Names the offending advisory id (if known) + line; preserves the previous DB (atomic rename was never done)                                                                                                                                                                                                        |
| `AdvisoryQueryError`          | SQLite error                         | Maps `rusqlite::Error` variants to a vis-domain `cause`: `SqliteFailure(corrupt)` → suggest `vis advisories sync --force`, `SqliteFailure(busy/locked)` → suggest retry, `InvalidQuery`/`InvalidParameterName` → bug report. Raw `rusqlite::Error::to_string()` goes in `details:`, never the user-facing message. |

All errors print actionable next-step lines, same shape as the existing `VisConfigLoadError` family.

## Performance budget

Targets the audit-handler must meet on a representative monorepo (this repo: 44 packages, ~2.8k installed lockfile rows, npm ecosystem only):

| Operation                                                | Target   | Notes                                                                                                 |
| -------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------- |
| `advisories sync` cold — HEAD + GET (download phase)     | < 8 s    | network-bound, ~80 MB OSV npm dump on a 100 Mbps link                                                 |
| `advisories sync` cold — `advisoriesIngest` (Rust phase) | < 4 s    | zip extract + serde_json + INSERT under WAL; bounded by CPU, not IO                                   |
| `advisories sync` cold — total wall-clock                | < 12 s   | network-bound; ETag HEAD + atomic rename adds ~1 s over raw download                                  |
| `advisories sync` ETag short-circuit                     | < 200 ms | HEAD only; no Rust call                                                                               |
| `advisoriesQuery` 2.8k packages                          | < 80 ms  | prepared statement + single transaction + index on `(ecosystem, package)`                             |
| `vis audit --offline` end-to-end                         | < 400 ms | lockfile parse (~80 ms) + query (~80 ms) + format + render                                            |
| `vis audit` online (today's baseline)                    | ~1.2 s   | OSV roundtrip dominates                                                                               |
| `--usage` pass                                           | < 1.5 s  | walk + scan; bounded by FS, not advisory size                                                         |

Regression test budget: a `__tests__/perf/audit-offline.bench.ts` (Vitest bench) that asserts the 400 ms wall-clock with a 50% slack. Run on CI under `pnpm --filter @visulima/vis run test:perf` (new script, ad-hoc lane).

## Security considerations

- **Native code attack surface.** Network parsing (HTTPS + redirects + TLS) lives in Node `fetch` (undici), already audited and shipped to every vis user. The native crate only parses untrusted bytes that already sit on local disk: `zip` (widely-deployed Rust crate) decompresses, `serde_json` parses each advisory, `rusqlite` (bundled SQLite, strong fuzz history) writes. We trust the OSV bucket the same way we trust the npm registry — no upstream signature verification ships today (OSV doesn't publish one). The trust boundary is documented in `docs/guides/security-audit.mdx`.
- **Zip-bomb mitigation.** OSV dumps are large (tens of MB compressed today) but bounded; a malicious mirror could ship a small zip that decompresses to GBs and pin the disk / OOM the ingest. Two static caps in `advisories/ingest.rs`: `MAX_ENTRY_BYTES = 16 MiB` (rejects any single advisory JSON above the cap — real OSV entries are < 64 KiB) and `MAX_TOTAL_BYTES = 4 GiB` (running sum across uncompressed entries, aborts the transaction if exceeded). Both surface as `AdvisorySyncCorruptError` with the entry name + observed size. Caps live in const declarations so they're trivially tunable if OSV ever scales past them.
- **Filesystem race.** Atomic rename (`.tmp → final`) inside the cache dir means a concurrent `vis audit --offline` either sees the old DB or the new — never a half-written one. Two parallel `vis advisories sync` invocations race for the same temp suffix; we add the process PID + a random nonce to `.tmp` to avoid stepping on each other. Last writer wins on the final filename — acceptable, the DB is idempotent.
- **HTTPS via Node.** TLS validation goes through undici's platform root store + `NODE_EXTRA_CA_CERTS` for corporate MITM CAs. No pinning — OSV's CDN cert rotates. If a user mirrors OSV onto an internal endpoint (`security.audit.advisories.source`), they own the trust chain.
- **`source` URL allowlist.** `security.audit.advisories.source` is validated at config-load time: scheme must be `https://`, host must match one of the built-in allowed registries (`osv-vulnerabilities.storage.googleapis.com`) **or** a user-declared `security.audit.advisories.allowedHosts: string[]` (exact-match, no wildcards). `http://` is rejected (consistent with the REAPI backend's `allowInsecureBearer` precedent). The allowlist catches misconfiguration that would silently funnel advisory traffic to an arbitrary URL via env-var injection (`security.audit.advisories.source` is config-only — never `--source` CLI flag).
- **Path traversal in zip entries.** `zip` exposes a low-level API that does not validate paths; we never write zip contents to disk — we stream entries through `read_to_end → serde_json::from_slice` only. No file output, no traversal risk.
- **`--apply` writes to lockfile + node_modules.** Same trust as any other vis PM command; gated behind the confirmation prompt outside CI and `--yes` inside.

## Implementation outline

In rough order; each chunk lands as its own commit. Phased so a partial revert is always coherent.

**Phase 1 — Foundation (offline npm scanning, no autofix):**

1. **Cargo deps & deny.toml** — add `rusqlite` (bundled), `zip`, `serde`, `semver`. Update `deny.toml` `allow = [...]` to include `blessing` for `libsqlite3-sys`'s SQLite-bundled license (or `0BSD` / public-domain variant depending on the crate version we pin).
2. **Rust module `advisories`** — `native/src/advisories/{mod.rs, schema.rs, ingest.rs, query.rs, range/npm.rs}`. Pure-Rust; unit-tested with a fixture mini-OSV zip checked into `native/tests/fixtures/osv-mini.zip`.
3. **NAPI bindings** — `advisoriesIngest`, `advisoriesQuery`, `advisoriesStatus` in `native/src/lib.rs`. Bump `NATIVE_BINDING_VERSION` to 4.
4. **JS adapter** — `src/security/advisories.ts` exposes `syncAdvisories` (handles HTTP fetch + ETag + temp file, then calls native ingest), `queryAdvisories`, `getAdvisoryStatus`. Errors out clearly on `NATIVE_BINDING_VERSION` mismatch.
5. **CLI: `vis advisories`** — `src/commands/advisories/{index.ts,handler.ts,sync.ts,status.ts,prune.ts}`. Lazy-loaded.
6. **CLI: `vis audit` flags (Phase-1 subset)** — `--offline`, `--db`, `--prod-only`, `--fail-on`, `--format=sarif` in `src/commands/audit/index.ts`; route in `handler.ts`.
7. **`--prod-only` filter** — `lockedPackages` gains an `includeDev: boolean` param; piped through.
8. **SARIF emitter** — `src/report/sarif.ts`; type-safe builder over SARIF 2.1.0.
9. **Config schema** — extend `VisConfig.security` with the `audit` sub-block + `advisories.allowedHosts` validator; regenerate `schemas/vis-config.schema.json`.
10. **Phase-1 tests** — fixture monorepo with the following lockfile shapes, each scanned online + offline:
    - direct vulnerable dep (`lodash@4.17.20`)
    - transitive vulnerable dep (vuln nested under a clean direct)
    - multiple vulns in one package (cross-advisory join coverage)
    - vuln with multiple `affected[].ranges` per package (the `range_index` PK case)
    - no findings (empty-result path)
    - prod-only filters out a dev-only vuln (regression guard for the filter)
    - DB built by an older schema_version → `AdvisorySchemaMismatchError` with the "sync --force" hint
    - DB at a newer schema_version → `AdvisorySchemaMismatchError` with the "downgrade vis" hint
    - SARIF output validates against the OASIS 2.1.0 JSON schema (vendored under `__tests__/fixtures/sarif-2.1.0.schema.json`)
    - `source` URL not in built-in allowlist + no `allowedHosts` config → config-load error
    - zip-bomb fixture (entry decompresses past `MAX_ENTRY_BYTES`) → `AdvisorySyncCorruptError`

**Phase 2 — Reports & reachability:**

11. **HTML report** — `src/report/audit-html/{index.ts, template.tsx, styles.css}`; Preact inline bundle.
12. **CSAF emitter** — `src/report/csaf.ts`; schema vendored under `src/report/schemas/csaf-2.0.json`.
13. **CycloneDX-VEX emitter** — `src/report/cyclonedx-vex.ts`, extending `src/sbom/cyclonedx.ts`.
14. **Reachability Tier 1+2** — `src/security/reachability.ts` + Rust `scan_imports`; covers static + literal `import()` + `require.context` + `import.meta.glob`.
15. **CLI flags** — `--report`, `--no-open`, `--format=csaf`, `--format=cyclonedx-vex`, `--usage`, `--only-used`.

**Phase 3 — Apply loops:**

16. **`--apply` (direct)** — `src/commands/audit/apply.ts`: plan → dispatch to existing PM runner → rescan → diff.
17. **`--apply-transitive`** — `src/security/transitive-fix.ts` with five PM writers (pnpm, npm, yarn classic, yarn berry, bun). Dry-run gate, atomic writes.
18. **`--fix` alias + `--show-fixes`** — backward-compatible rename in `audit/index.ts`.

**Phase 4 — Multi-ecosystem + provenance:**

19. **Rust matcher trait** — refactor `range/npm.rs` behind the `RangeMatcher` trait; add `range/pep440.rs`, `range/cargo.rs`, `range/maven.rs`, `range/go.rs`, `range/rubygems.rs`. One commit per matcher with parity tests.
20. **JS lockfile readers** — `src/security/lockfile-readers/{poetry.ts,uv.ts,pipenv.ts,cargo.ts,maven.ts,gradle.ts,gosum.ts,gemfile.ts}`; auto-detect via marker files.
21. **`--ecosystem` flag** — plumb through `vis audit` + `vis advisories sync`.
22. **`verify-signatures` cargo feature** — `native/src/advisories/verify.rs` with `sigstore` crate; release pipeline gains `-verified` binary variants; loader picks based on config. **Deferred to issue #631** until OSV upstream ships signatures; the corporate-mirror use case is real but niche and doesn't justify the dual-binary release plumbing today. Config schema (`security.audit.advisories.verify`) is already wired so users can declare intent; sync currently no-ops the block.

**Phase 5a — MCP + docs (ships with Phase 4):**

23. **MCP** — add `audit` + `advisory_status` read-only tools to `@visulima/vis-mcp`. Tool names match the CLI verbs (`audit`, not `audit_offline`) so the offline/online split is a tool argument (`{ offline: true }`), not a separate tool surface. Validation gate: MCP integration test invokes both tools against a fixture DB and asserts the returned schema matches the new `AdvisoryQueryResult` shape.
24. **Docs** — new page `docs/guides/security-audit.mdx`; updates `docs/commands/audit.mdx`; fresh `docs/commands/advisories.mdx`. Validation gate: docs build (`pnpm --filter @visulima/web run build`) passes; auto-generated CLI flag table includes every new flag.

**Phase 5b — Test sweep (lands with whichever phase the feature shipped in):**

25. **End-to-end test coverage** — `--apply` golden-path + bail-on-PM-fail, `--apply-transitive` per PM with diff snapshots of override files, `--usage` true/false positives across the Tier-2 patterns (`require.context`, `import.meta.glob`, literal `import()`, `const VAR = "pkg"` + `require(VAR)`), every report format validates against its upstream schema (SARIF 2.1.0, CSAF 2.0, CycloneDX 1.7-VEX), signed-bundle verification with a fixture cosign bundle. Validation gates per phase:
    - Phase 1 → all fixture-monorepo cases in step 10 pass; `pnpm --filter @visulima/vis test:perf` meets the perf budget table.
    - Phase 2 → SARIF/CSAF/CycloneDX-VEX outputs round-trip through their official schemas; HTML report renders headless (snapshot test).
    - Phase 3 → `--apply` is a no-op on a clean repo (idempotency); `--apply-transitive` dry-run diff is byte-stable across runs.
    - Phase 4 → range-matcher parity tests per ecosystem against OSV's published test corpus; `-verified` binary loads when `verify.enabled = true` and the default binary errors with `AdvisorySignatureUnsupportedError`.
    - Fixture-cost note: the cosign bundle fixture is generated once by a script (`scripts/generate-cosign-fixture.ts`) using a self-signed test identity, checked into the repo, and re-generated on demand — we do not run cosign at test time (no network, no key material in CI).

## Decisions

1. **Native SQLite, not `node:sqlite`.** `node:sqlite` is stable on Node 24+ but still experimental (requires `--experimental-sqlite`) on the 22.14+ range vis's `engines` allows. Forcing a flag for a default-on feature is a non-starter. Native Rust ships prebuilt across all 8 NAPI targets, no flag, no fallback path to maintain.
2. **Native SQLite, not `better-sqlite3`.** `better-sqlite3` is a great library but it's _another_ native dep for the consumer to build/prebuild — `vis-native` already exists, has CI matrix coverage, and consolidating into one binary keeps `vis`'s install footprint flat. Reuses our existing prebuild + release pipeline (`scripts/semantic-release-native-addons.mjs`).
3. **`ureq` download in Rust vs `fetch` in Node.** Closed: **download in Node.**

    Speed: equivalent. An 80 MB OSV dump on a 100 Mbps link is ~6.5 s of pure transfer in both stacks. Per-byte CPU below 1 GiB/s is irrelevant — the network is the bottleneck. The intuition that "Rust pipelines download + decompress + insert in one pass" doesn't apply: the zip format keeps the central directory at the tail of the file, so any reader needs `Seek` (`zip` crate) or has to buffer the whole body in memory (`async-zip`). Either way, the realistic flow is "fully buffer, then ingest" — same on both sides.

    What tips it to Node:
    - **Proxy env vars.** `HTTP_PROXY` / `HTTPS_PROXY` / `NO_PROXY` are honored by undici (Node 22+ with manual dispatcher, Node 24+ via `EnvHttpProxyAgent`). `ureq` does not auto-detect them — every corporate user would hit this on day one and need a custom wiring per call.
    - **Custom CAs.** `NODE_EXTRA_CA_CERTS` is the standard knob for corporate MITM CAs; `rustls` needs explicit root-store loading. Same demographic, same blocker.
    - **Binary size.** Dropping `ureq` + `rustls` + `webpki-roots` shaves ~600 KB off each of the 8 prebuilt `.node` files. Compounds.
    - **Test ergonomics.** Mocking `fetch` via a stub server in Vitest is trivial; mocking `ureq` through NAPI is not.

    Implementation: Node streams the response to a temp file in `<cache>/vis/advisories/`, then calls `advisoriesIngest({ zipPath, dbPath, ... })` (renamed from `advisoriesSync` to make the split explicit). Progress for the download phase emits from JS via the existing `scan-progress` UI; progress for the ingest phase emits from Rust via threadsafe callbacks. `ureq` is dropped from §A.A.

4. **`--apply` ships direct-deps in Phase 3; `--apply-transitive` ships in the same phase.** Phasing both into one release shrinks the matrix of "which version of vis behaves how" that downstream users have to reason about. The risk delta (transitives rewrite override blocks) is real but the design lives in one place (`src/security/transitive-fix.ts`); shipping it once, gated behind a config opt-in for CI, is safer than shipping two releases that change auto-fix behavior back-to-back.
5. **SARIF + CSAF + CycloneDX-VEX all ship in Phase 2.** SARIF unblocks GitHub Code Scanning. CSAF unblocks enterprise vuln-management pipelines (the cohort that asks for offline scanning is the same cohort that demands CSAF). CycloneDX-VEX is ~80% reuse of the existing SBOM emitter (`src/sbom/cyclonedx.ts`) — the marginal cost is small enough that splitting it across phases isn't worth a separate release. JSON + table stay the defaults; advanced formats are opt-in via `--format`.
6. **HTML report uses Preact, not vis's existing React + TUI stack.** TUI React is intended for terminal rendering through `react-reconciler` and is not a DOM stack; we'd ship the React+ReactDOM bundle for one report or build a 3 KB Preact bundle. Preact wins on size and on staying out of React's behavioral assumptions.
7. **No auto-sync on `vis audit --offline`.** A silent network call behind an `--offline` flag would be a footgun for air-gapped users. Freshness is a stderr warning, never a fix.
8. **`--fix` becomes an alias for `--apply` with `--show-fixes` for the old behavior.** Renaming-with-alias keeps existing scripts working; `--show-fixes` is default-on so today's stdout is preserved verbatim. Single deprecation line in changelog.
9. **`@visulima/vis-mcp` exposes audit read-only tools.** Consistent with the "agent recommends, human applies" principle from roadmap #5; agents can answer "is anything critical?" without invoking `--apply`.
10. **Multi-ecosystem support lands in Phase 4, not gated on demand.** The schema, NAPI surface, and CLI flags assume ecosystem-aware from day one (`--ecosystem`, `ecosystem` column, ecosystem-keyed `meta` rows). Phase 1 ships only `npm` matchers, but the structural cost of adding PyPI / Cargo / Maven / Go / RubyGems matchers later is one Rust file per ecosystem plus one lockfile reader per ecosystem. Avoiding the "add later" framing now means the design doesn't have to grow ecosystem awareness retroactively — that's the path that creates breaking changes.
11. **Signed bundles via a Cargo feature, not a separate package.** Two `.node` variants per platform (`-verified` vs default) is operationally heavier than always-on, but the dep cost (~2 MB compressed for `sigstore` + roots) on every user's `vis install` is the wrong default when OSV upstream doesn't sign anything yet. Feature gate; revisit when OSV ships signatures upstream and flip the default.
12. **No runtime tracing in the reachability filter.** Static + light-dynamic detection (Tier 1 + 2) covers the realistic patterns. Full runtime tracing requires a `NODE_OPTIONS` preload shim that changes how the user starts their app — that's a separate `--usage=runtime` flag with its own RFC, not a Phase-2 deliverable.

## Out of scope (file separately when there's demand)

- **Runtime-tracing reachability** (`--usage=runtime`). Tier 3 from §F; needs a `NODE_OPTIONS=--require ./vis-trace.js` shim and a results file. Real benefit, large UX change.
- **Auto-PR creation after `--apply`.** The `vis ai heal` flow already creates PRs from local fixes; combining the two surfaces is a future "vis ai audit-fix" RFC.
- **Hosted advisory mirror.** A vis-side bucket that re-publishes signed OSV dumps would close the "OSV doesn't sign" gap for users on the default config. Real ops cost (DNS, infra, signing identity rotation) puts this out of MVP scope.
- **Per-monorepo policy bundles.** Shareable `security.audit` policy presets (`extends: "@acme/vis-security"`). Covered by the existing config-layering RFC (`design-config-layering.md`) once that lands; no new design needed here.
- **Auto-acknowledge ignored advisories from native PM config.** Today the audit handler reads `npmAuditExcludePackages` etc. and applies them as exclusions. Roundtripping in the other direction (writing back to native PM config from accepted-risks in vis) is mostly there via `syncAcceptedRisksToNativeConfig`; tightening the loop into a single `vis audit --acknowledge <id> --reason "..."` is a separate small RFC.

## References

- OSV — https://osv.dev, dump at `https://osv-vulnerabilities.storage.googleapis.com/<ecosystem>/all.zip`
- SARIF 2.1.0 — https://docs.oasis-open.org/sarif/sarif/v2.1.0/sarif-v2.1.0.html
- Internal: `src/util/catalog.ts:1191`, `src/security/dependency-scan.ts`, `src/commands/audit/`, `native/src/lib.rs`, `priority-roadmap.md` (Security & Health note)
