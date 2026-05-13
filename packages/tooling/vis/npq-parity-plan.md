
# Implementation Plan: 12 npq-Parity Marshalls for `@visulima/vis`

This plan brings 12 missing/improved features from `npq` into `packages/tooling/vis/`. Every marshall follows the established pattern in `src/security/typosquats.ts` (pure helper + integration point + allowlist) and reuses the file-cache TTL layout from `src/security/socket-security.ts` (`<getVisCacheDir()>/<marshall-name>/<key>.json` with `createdAt`/`ttlMs` per entry).

A small set of shared utilities (see Cross-Cutting Plan, end of document) must land first so each marshall stays a thin wrapper. Critical paths cited are absolute.

---

## 1. Author marshall

**Goal.** Block install of a package when the publisher is a dormant maintainer, a brand-new publisher on an established package, or the version was published very recently — npq `author.marshall.js` parity.

**Files to create.**
- `/home/prisis/WebstormProjects/visulima/visulima/packages/tooling/vis/src/security/marshalls/author.ts`

**Files to modify.**
- `/home/prisis/WebstormProjects/visulima/visulima/packages/tooling/vis/src/commands/add/handler.ts` — call `runAuthorMarshall` after typosquat, before Socket.dev.
- `/home/prisis/WebstormProjects/visulima/visulima/packages/tooling/vis/src/commands/install/handler.ts` — explicit-args path only (skip on bare `vis install`); see scoping rule below.
- `/home/prisis/WebstormProjects/visulima/visulima/packages/tooling/vis/src/commands/update/handler.ts` — explicit-args path, alongside typosquat.
- `/home/prisis/WebstormProjects/visulima/visulima/packages/tooling/vis/src/config/types.ts` — add `security.author` block.

**Public API.**
```ts
export interface AuthorFinding {
    kind: "new-publisher" | "dormant-maintainer" | "recent-version";
    severity: "error" | "warning";
    packageName: string;
    version: string;
    message: string;
}
export const runAuthorMarshall: (
    packages: { name: string; version: string }[],
    options?: { allowlist?: string[]; cacheTtlMs?: number; signal?: AbortSignal }
) => Promise<AuthorFinding[]>;
```

**Config additions.**
```
security.author?: {
    enabled?: boolean;                  // default true
    allowlist?: string[];               // skip these names
    recentVersionErrorDays?: number;    // default 7
    recentVersionWarnDays?: number;     // default 30
    dormantWarnDays?: number;           // default 183
    dormantErrorDays?: number;          // default 274
    newPublisherWindowDays?: number;    // default 21
}
```

**Env vars.** `MARSHALL_DISABLE_AUTHOR=1` (skip entirely). Honors global `VIS_OFFLINE=1` (skip with notice).

**Cache key/TTL.** Reuses packument cache `<getVisCacheDir()>/packuments/<encodedName>.json` shared with items 3–5; TTL 30 min (configurable). No marshall-specific cache file.

**Integration points.** Runs in `add/handler.ts` between typosquat (line ~528) and the Socket.dev pre-check (line ~531). Receives the post-typosquat, post-version-resolution `lookupPackages` array (concrete versions only — non-resolvable specs skip). Each `AuthorFinding` with `severity: "error"` blocks; warnings flow into the shared "warnings collector" (item 10). Skipped entirely when no version was resolvable (matches Socket.dev's behavior at line 214).

**Edge cases / failure modes.**
- Packument 404 / network error → warning "Could not check author for X" (do not block).
- Missing `time[version]` or malformed timestamps → skip this package silently.
- `_npmUser` missing (older packages) → skip dormant-maintainer check, still run recent-version check.
- Boundary: exactly 183/274/21/7/30 days does **not** cross to the next tier (use `<=`/`<`).
- Single-publisher packages (every version by same email) → treat as dormant baseline; no new-publisher firing.

**Tests to add.**
- `/home/prisis/WebstormProjects/visulima/visulima/packages/tooling/vis/__tests__/security/author-marshall.test.ts`
  - dormant >274 days → error
  - dormant 183–274 → warning
  - first publish by user on long-established package within 21 d → error
  - version published 5d ago → error; 25d ago → warning; 60d ago → no finding
  - missing `time`/`_npmUser` → no error
  - allowlist suppresses findings
  - `MARSHALL_DISABLE_AUTHOR=1` returns empty array

**Effort.** M.

---

## 2. Expired email domain marshall

**Goal.** Resolve NS records for each maintainer's email domain; flag NXDOMAIN as a hijack risk — npq `expiredDomains.marshall.js` parity.

**Files to create.**
- `/home/prisis/WebstormProjects/visulima/visulima/packages/tooling/vis/src/security/marshalls/expired-domains.ts`

**Files to modify.**
- `/home/prisis/WebstormProjects/visulima/visulima/packages/tooling/vis/src/commands/add/handler.ts` (and update/install for explicit args).
- `/home/prisis/WebstormProjects/visulima/visulima/packages/tooling/vis/src/config/types.ts` — add `security.expiredDomains`.

**Public API.**
```ts
export interface ExpiredDomainFinding {
    packageName: string;
    domain: string;
    maintainer: string;
}
export const runExpiredDomainsMarshall: (
    packages: { name: string; version: string }[],
    options?: { dnsServers?: string[]; cacheTtlMs?: number; perDomainTimeoutMs?: number; signal?: AbortSignal }
) => Promise<ExpiredDomainFinding[]>;
```

Internals build a `Resolver` from `node:dns/promises` with `setServers(["1.1.1.1", "8.8.8.8"])`. `resolveNs` per unique domain (deduped across maintainers/packages).

**Config additions.**
```
security.expiredDomains?: {
    enabled?: boolean;          // default true
    allowDomains?: string[];    // skip checks for these domains
    dnsServers?: string[];      // default ["1.1.1.1", "8.8.8.8"]
    timeoutMs?: number;         // default 4000
}
```

**Env vars.** `MARSHALL_DISABLE_EXPIRED_DOMAINS=1`.

**Cache key/TTL.** Per-domain cache `<getVisCacheDir()>/expired-domains/<sha256(domain).slice(0,12)>.json` containing `{ createdAt, ttlMs, resolved: boolean, error?: string }`. TTL 24 h. Cache resolved + NXDOMAIN outcomes; do NOT cache transient errors (timeout, ECONNREFUSED).

**Integration points.** Same call site as item 1; runs after author. Errors (NXDOMAIN) block. DNS timeouts and other transient errors degrade to warning "could not verify maintainer email domain for X".

**Edge cases / failure modes.**
- All DNS servers unreachable → warning, do not block (offline-friendly).
- Maintainer entry missing `email` → skip that maintainer.
- Email syntactically invalid (no `@`) → skip with internal debug log.
- Multiple maintainers with same domain → resolve once.
- `noreply@github.com`-style domains: not special-cased — they will resolve, so no false positives.

**Tests to add.**
- `/home/prisis/WebstormProjects/visulima/visulima/packages/tooling/vis/__tests__/security/expired-domains.test.ts`
  - mock `node:dns/promises` Resolver: NXDOMAIN → finding; ENOTFOUND → finding
  - timeout → warning, no finding
  - cache hit returns prior result without DNS call
  - `allowDomains` skips the domain
  - `MARSHALL_DISABLE_EXPIRED_DOMAINS` short-circuits

**Effort.** M.

---

## 3. Registry signature verification

**Goal.** Verify each resolved version's `dist.signatures` against npm's published signing keys — npq `signatures.marshall.js` parity.

**Files to create.**
- `/home/prisis/WebstormProjects/visulima/visulima/packages/tooling/vis/src/security/marshalls/signatures.ts`
- `/home/prisis/WebstormProjects/visulima/visulima/packages/tooling/vis/src/security/marshalls/registry-keys.ts` — fetch + cache `https://registry.npmjs.org/-/npm/v1/keys`.
- `/home/prisis/WebstormProjects/visulima/visulima/packages/tooling/vis/src/security/marshalls/verify-ecdsa.ts` — small ECDSA P-256 verifier using `node:crypto.createVerify("SHA256")` against the SPKI-encoded key from the keys endpoint (no new dep).

**Files to modify.**
- `add/handler.ts`, `update/handler.ts` integration.
- `/home/prisis/WebstormProjects/visulima/visulima/packages/tooling/vis/src/commands/security/index.ts` — add `vis security keys-refresh` (force-refresh the keys cache).
- `config/types.ts` — `security.signatures` block.

**Public API.**
```ts
export interface SignatureFinding {
    packageName: string;
    version: string;
    severity: "error" | "warning";
    code: "missing-signature" | "expired-key" | "unknown-keyid" | "invalid-signature" | "fetch-failed";
    message: string;
}
export const runSignatureMarshall: (
    packages: { name: string; version: string }[],
    options?: { cacheTtlMs?: number; signal?: AbortSignal }
) => Promise<SignatureFinding[]>;
export const fetchRegistryKeys: (
    options?: { ttlMs?: number }
) => Promise<{ keys: { keyid: string; key: string; expires?: string }[] }>;
```

**Config additions.**
```
security.signatures?: {
    enabled?: boolean;             // default true
    keysTtlMs?: number;            // default 24h
    treatExpiredAs?: "warning" | "error"; // default "warning" (npq behavior)
}
```

**Env vars.** `MARSHALL_DISABLE_SIGNATURES=1`, `VIS_NPM_KEYS_URL` (override for tests / mirrors).

**Cache key/TTL.**
- Keys: `<getVisCacheDir()>/registry-keys/npmjs.json` — 24 h.
- No per-package cache; reuse packument cache for `dist.signatures`.

**Integration points.** Runs after author/expired-domains, before Socket.dev. Verification reads `manifest.dist.signatures` and `manifest._integrity`/`manifest.dist.integrity`. Failures: missing signature → warning; signature present but invalid → error (block).

**Decision: vendor vs. dep.** Plan to implement in-tree using `node:crypto` because:
1. The npm keys endpoint returns base64-encoded ECDSA P-256 keys in SPKI format directly consumable by `crypto.createPublicKey({ key, format: "pem" })` after wrapping in PEM.
2. Adding `sigstore` (>1 MB) is excessive for one signature scheme.
3. Provenance verification (item 4) is *separate* — it doesn't need sigstore for the regression check, only for full attestation verify which we defer.

**Edge cases / failure modes.**
- `/-/npm/v1/keys` 5xx → warning "could not fetch registry keys" with stale-while-revalidate behavior (use expired cache if present).
- `dist.signatures` empty → "missing-signature" warning.
- Key `expires` in the past → emit `expired-key` per `treatExpiredAs`.
- Keyid not in keyset → `unknown-keyid` error (potential MITM).
- Non-npmjs registry (`.npmrc` override) → skip with info note.

**Tests to add.**
- `/home/prisis/WebstormProjects/visulima/visulima/packages/tooling/vis/__tests__/security/signatures.test.ts`
  - golden fixture: valid keyset + manifest pair → no findings
  - tampered signature → invalid-signature error
  - missing signatures field → warning
  - expired key with `treatExpiredAs: "warning"` → warning, `"error"` → error
  - keys cache hit avoids fetch
- `/home/prisis/WebstormProjects/visulima/visulima/packages/tooling/vis/__tests__/security/registry-keys.test.ts` — stale-while-revalidate, force refresh.

**Effort.** L.

---

## 4. Provenance regression

**Goal.** Error when current resolved version lacks `dist.attestations` but a prior semver had them — npq `provenance.marshall.js` parity.

**Files to create.**
- `/home/prisis/WebstormProjects/visulima/visulima/packages/tooling/vis/src/security/marshalls/provenance.ts`

**Files to modify.**
- `add/handler.ts`, `update/handler.ts`.
- `config/types.ts` — `security.provenance`.

**Public API.**
```ts
export interface ProvenanceFinding {
    packageName: string;
    version: string;
    priorVersionWithProvenance: string;
}
export const runProvenanceMarshall: (
    packages: { name: string; version: string }[],
    options?: { allowlist?: string[] }
) => Promise<ProvenanceFinding[]>;
```

Uses the same shared `getPackument(name)` from item 3 — no extra HTTP. Internal helper `findNewestPriorWithAttestations(packument, version)` ported verbatim from npq.

**Config additions.**
```
security.provenance?: {
    enabled?: boolean;       // default true
    allowlist?: string[];    // names to exempt
}
```

**Env vars.** `MARSHALL_DISABLE_PROVENANCE=1`.

**Cache key/TTL.** None of its own — packument cache only.

**Integration points.** Runs in the same pipeline; shares the prefetched packument map with items 1, 3, 5. Always blocks (error).

**Edge cases / failure modes.**
- Packument missing `versions` map → skip.
- Installed version invalid semver (e.g. `latest`) → skip (caller already filters to resolved semver).
- Only prereleases ahead with attestations → ignored; we only look at `< installedVersion`.
- Newly published 1.0.0 with no priors → no finding.

**Tests to add.**
- `/home/prisis/WebstormProjects/visulima/visulima/packages/tooling/vis/__tests__/security/provenance.test.ts`
  - prior 1.2.0 has attestations, 1.3.0 does not → finding
  - prior had attestations but allowlist contains pkg → no finding
  - no priors → no finding
  - all priors lack attestations → no finding

**Effort.** S.

---

## 5. New-bin marshall

**Goal.** Warn (do not error) when a version introduces bins not present in the immediately-prior published version — npq `newbin.marshall.js` parity.

**Files to create.**
- `/home/prisis/WebstormProjects/visulima/visulima/packages/tooling/vis/src/security/marshalls/new-bin.ts`

**Files to modify.**
- `add/handler.ts`, `update/handler.ts`.
- `config/types.ts` — `security.newBin`.

**Public API.**
```ts
export interface NewBinFinding {
    packageName: string;
    fromVersion: string;
    toVersion: string;
    newBins: { name: string; command: string }[];
}
export const runNewBinMarshall: (
    packages: { name: string; version: string }[],
    options?: { allowlist?: string[] }
) => Promise<NewBinFinding[]>;
```

Internal `normalizeBin(field, pkgName)` handles npm's two forms (string vs. record), matching npq.

**Config additions.**
```
security.newBin?: {
    enabled?: boolean;         // default true
    allowlist?: string[];      // names to skip
    allowBins?: string[];      // bin names that never trigger (e.g. "tsc")
}
```

**Env vars.** `MARSHALL_DISABLE_NEW_BIN=1`.

**Cache key/TTL.** None — packument only.

**Integration points.** Same pipeline. Warnings only; feeds the shared auto-continue collector (item 10).

**Edge cases / failure modes.**
- No prior version → no finding.
- Bin renamed (`x` → `y`) shows up as "new bin `y`"; that's intentional (npq parity).
- `allowBins` filter applies after diffing, so an entry in `allowBins` silences common dev tools (`tsc`, `eslint`).

**Tests to add.**
- `/home/prisis/WebstormProjects/visulima/visulima/packages/tooling/vis/__tests__/security/new-bin.test.ts`
  - 1.0.0 had `{ foo: "./foo.js" }`, 1.1.0 has `{ foo, bar }` → finding for `bar`
  - bin string shorthand → normalized correctly
  - `allowBins: ["bar"]` → no finding
  - `MARSHALL_DISABLE_NEW_BIN` short-circuits

**Effort.** S.

---

## 6. Download count floor marshall

**Goal.** Warn when a package has fewer than N downloads in the last month — npq `downloads.marshall.js` parity.

**Files to create.**
- `/home/prisis/WebstormProjects/visulima/visulima/packages/tooling/vis/src/security/marshalls/downloads.ts`

**Files to modify.**
- `add/handler.ts`, `update/handler.ts`.
- `config/types.ts` — `security.downloads`.

**Public API.**
```ts
export interface DownloadFinding {
    packageName: string;
    downloadsLastMonth: number;
    severity: "error" | "warning";
}
export const runDownloadsMarshall: (
    packageNames: string[],
    options?: { errorThreshold?: number; warnThreshold?: number; cacheTtlMs?: number }
) => Promise<DownloadFinding[]>;
```

Hits `https://api.npmjs.org/downloads/point/last-month/<pkg>`.

**Config additions.**
```
security.downloads?: {
    enabled?: boolean;         // default true
    allowlist?: string[];
    errorThreshold?: number;   // default 20 (per spec note; npq defaults 100/10000 — we pick lower since vis only flags direct user-typed deps)
    warnThreshold?: number;    // default 10_000
    cacheTtlMs?: number;       // default 24h
}
```

**Env vars.** `MARSHALL_DISABLE_DOWNLOADS=1`.

**Cache key/TTL.** `<getVisCacheDir()>/downloads/<encodedName>.json` with `{ createdAt, ttlMs, downloads, observedAt }`. TTL 24 h.

**Integration points.** Same call site; warnings only by default (since `errorThreshold` is low, sub-threshold packages still warn — wire as "error" only if `warnThreshold === errorThreshold`).

**Edge cases / failure modes.**
- API 404 (brand new package, no stats yet) → warning "no download data yet".
- API rate-limit (429) → warning, do not block; do not cache.
- Scoped names (`@scope/name`) must be encoded with `encodeURIComponent` in the URL.
- Network offline → degrade silently with single info line if `VIS_OFFLINE=1`.

**Tests to add.**
- `/home/prisis/WebstormProjects/visulima/visulima/packages/tooling/vis/__tests__/security/downloads.test.ts`
  - mock fetch returns 5 downloads → error finding (default `errorThreshold: 20`)
  - returns 5000 → warning
  - returns 1M → no finding
  - cache short-circuits second call
  - 404 → no finding (just warning side-effect)

**Effort.** S.

---

## 7. README / license / repo presence marshall

**Goal.** Single bundled marshall that warns on missing README, npm-placeholder README, missing `license`, or missing/invalid `repository.url` — npq `readme.marshall.js`, `license.marshall.js`, `repo.marshall.js` combined.

**Files to create.**
- `/home/prisis/WebstormProjects/visulima/visulima/packages/tooling/vis/src/security/marshalls/metadata.ts`

**Files to modify.**
- `add/handler.ts`, `update/handler.ts`.
- `config/types.ts` — `security.metadata`.

**Public API.**
```ts
export interface MetadataFinding {
    packageName: string;
    version: string;
    issues: ("missing-readme" | "placeholder-readme" | "missing-license" | "missing-repo" | "invalid-repo-url")[];
}
export const runMetadataMarshall: (
    packages: { name: string; version: string }[],
    options?: { allowlist?: string[] }
) => Promise<MetadataFinding[]>;
```

Reads packument latest version's `readme`, `license`, `repository.url`. Placeholder-README heuristic ports npq's check (`ERROR: No README data found!` and `# Security holding package` prefix detection).

**Config additions.**
```
security.metadata?: {
    enabled?: boolean;                            // default true
    allowlist?: string[];
    checks?: Array<"readme" | "license" | "repo">;// default ["readme","license","repo"]
}
```

**Env vars.** `MARSHALL_DISABLE_METADATA=1`.

**Cache key/TTL.** Packument only.

**Integration points.** Same pipeline. All issues are warnings — never block. Single combined finding per package keeps console output compact.

**Edge cases / failure modes.**
- Some packuments contain `readme` at packument root vs. per-version `readmeFilename` only — check both.
- `license` may be a string or `{ type, url }` (deprecated form) — both accepted.
- `repository.url` of `git+ssh://git@github.com/...` must parse via the same URL handling as npq (which constructs a fresh `https://` URL from host+path).
- Workspace-private internal packages → exempt via `allowlist` or via npq-style `private: true` check baked in.

**Tests to add.**
- `/home/prisis/WebstormProjects/visulima/visulima/packages/tooling/vis/__tests__/security/metadata.test.ts`
  - packument with placeholder readme → finding includes `placeholder-readme`
  - missing license → finding includes `missing-license`
  - `repository.url` invalid → `invalid-repo-url`
  - `private: true` in packument's latest version → no finding (regardless of metadata)
  - `checks: ["license"]` filters to license-only

**Effort.** M.

---

## 8. GitHub archived-repo detection

**Goal.** When `repository.url` points to a GitHub repo, call `/repos/{owner}/{repo}` and warn if `archived: true` — extends the existing deprecation handling pipeline.

**Files to create.**
- `/home/prisis/WebstormProjects/visulima/visulima/packages/tooling/vis/src/security/marshalls/archived-repo.ts`

**Files to modify.**
- `add/handler.ts`, `update/handler.ts`.
- `config/types.ts` — `security.archivedRepo`.

**Public API.**
```ts
export interface ArchivedRepoFinding {
    packageName: string;
    owner: string;
    repo: string;
    archivedAt?: string;
}
export const runArchivedRepoMarshall: (
    packages: { name: string; version: string }[],
    options?: { cacheTtlMs?: number; githubToken?: string }
) => Promise<ArchivedRepoFinding[]>;
```

Parse `repository.url` with `parseGitHubUrl` (port npq's: strip `git+`, swap `ssh:` host, extract `owner/repo`). Call `https://api.github.com/repos/{owner}/{repo}` with `Authorization: Bearer ${process.env.GITHUB_TOKEN}` if present.

**Config additions.**
```
security.archivedRepo?: {
    enabled?: boolean;        // default true
    allowlist?: string[];     // names to skip
    cacheTtlMs?: number;      // default 24h
    githubToken?: string;     // override env
}
```

**Env vars.** `MARSHALL_DISABLE_ARCHIVED_REPO=1`, `GITHUB_TOKEN` (reused for higher rate limits).

**Cache key/TTL.** `<getVisCacheDir()>/archived-repo/<owner>__<repo>.json` with `{ createdAt, ttlMs, archived: boolean, archivedAt?: string }`. TTL 24 h.

**Integration points.** Same pipeline; warnings only.

**Edge cases / failure modes.**
- Non-GitHub repos (GitLab, Bitbucket, codeberg) → skip with internal debug note (the metadata marshall covers missing-repo).
- Monorepos with `repository.url` pointing at the org repo (e.g. `vercel/next.js`) and `repository.directory` set: still resolves correctly because we only check `archived` on the parent repo. Caveat: a single archived parent flags every child package; mention in docs.
- Rate limit (403) → warning "could not check archive status", do not cache.
- Repo deleted (404) → warning "repository missing"; cache 24 h.
- `git@github.com:owner/repo.git` and `git+https://github.com/owner/repo.git` both parse.

**Tests to add.**
- `/home/prisis/WebstormProjects/visulima/visulima/packages/tooling/vis/__tests__/security/archived-repo.test.ts`
  - mock fetch returns `{ archived: true }` → finding
  - returns 404 → "repo missing" finding
  - parses ssh + https + git+ URL forms
  - cache hit avoids second fetch
  - non-github URL → no fetch, no finding

**Effort.** M.

---

## 9. `MARSHALL_DISABLE_*` env var matrix

**Goal.** Uniform env-var-based disable mechanism across **all** marshalls (existing + new), with one helper and one canonical name table.

**Files to create.**
- `/home/prisis/WebstormProjects/visulima/visulima/packages/tooling/vis/src/security/marshalls/registry.ts` — single source of truth.

**Files to modify.**
- `src/security/typosquats.ts` — gate `runTyposquatCheck` and `scanDepsForTyposquats` behind `isMarshallDisabled("typosquats")`.
- `src/security/security.ts` — gate `emitSecurityWarnings`, `enforceScriptSecurity`, the minimum-release-age enforcement (already in `update/handler.ts`) on `isMarshallDisabled("allowBuilds")` and `isMarshallDisabled("minReleaseAge")` respectively.
- Every new marshall created by items 1–8 reads through this helper.
- Optional: `commands/security/list.ts` to print the current disable matrix.

**Public API.**
```ts
export type MarshallName =
    | "typosquats"
    | "allowBuilds"
    | "minReleaseAge"
    | "author"
    | "expiredDomains"
    | "signatures"
    | "provenance"
    | "newBin"
    | "downloads"
    | "metadata"
    | "archivedRepo"
    | "socket";

export const ALL_MARSHALLS: readonly MarshallName[];

/** Reads MARSHALL_DISABLE_<UPPER_SNAKE> env var + config.security.<name>.enabled === false. */
export const isMarshallDisabled: (
    name: MarshallName,
    config?: VisConfig
) => boolean;

/** Snake-uppercase the marshall name for env var conversion (single source of canonical name → env). */
export const envVarFor: (name: MarshallName) => string; // e.g. "newBin" → "MARSHALL_DISABLE_NEW_BIN"
```

The canonical mapping (camelCase → SCREAMING_SNAKE_CASE) lives once in this file. Marshalls never read `process.env.MARSHALL_DISABLE_*` directly — always through `isMarshallDisabled`.

**Config additions.**
Every marshall already gets a `security.<name>.enabled` boolean. This item just enforces the convention and adds the helper that both checks are routed through.

**Env vars.** All 12 + 3 legacy (`MARSHALL_DISABLE_TYPOSQUATS`, `MARSHALL_DISABLE_ALLOW_BUILDS`, `MARSHALL_DISABLE_MIN_RELEASE_AGE`, `MARSHALL_DISABLE_SOCKET`, `MARSHALL_DISABLE_AUTHOR`, `MARSHALL_DISABLE_EXPIRED_DOMAINS`, `MARSHALL_DISABLE_SIGNATURES`, `MARSHALL_DISABLE_PROVENANCE`, `MARSHALL_DISABLE_NEW_BIN`, `MARSHALL_DISABLE_DOWNLOADS`, `MARSHALL_DISABLE_METADATA`, `MARSHALL_DISABLE_ARCHIVED_REPO`).

`MARSHALL_DISABLE_ALL=1` short-circuits every check.

**Cache key/TTL.** N/A.

**Integration points.** Call at the top of each marshall's exported function. Also wire into `commands/security/list.ts` so `vis security list` prints "Marshall: name (enabled/disabled via X)".

**Edge cases / failure modes.**
- Env var present but value `"0"`, `"false"`, `""` → treat as **enabled** (truthy-only disable; matches `MARSHALL_DISABLE_X=1` idiom).
- Both env disabled AND config enabled → env wins.
- `MARSHALL_DISABLE_ALL` plus a single explicit enable → all-off still wins (no overrides).

**Tests to add.**
- `/home/prisis/WebstormProjects/visulima/visulima/packages/tooling/vis/__tests__/security/marshall-registry.test.ts`
  - canonical name mapping (table-driven for all 12)
  - env wins over config
  - `MARSHALL_DISABLE_ALL` disables every marshall
  - falsy env value still enables

**Effort.** S.

---

## 10. Auto-continue countdown on warnings

**Goal.** When a command's marshalls produced only warnings (no errors), print a 15s countdown then auto-proceed. Disabled in CI, non-TTY, with `--strict`, or `VIS_DISABLE_AUTO_CONTINUE=1`.

**Files to create.**
- `/home/prisis/WebstormProjects/visulima/visulima/packages/tooling/vis/src/security/marshalls/decision-prompt.ts` — extracted shared prompt + countdown helper used by *every* marshall integration point.

**Files to modify.**
- `src/security/typosquats.ts` — refactor `askConfirmation` and `runTyposquatCheck` to route through `decision-prompt.ts` (keep the typosquat-specific "S/y/N" semantics; the shared helper supplies the countdown and TTY/CI gating).
- `commands/add/handler.ts`, `commands/install/handler.ts`, `commands/update/handler.ts` — accumulate all marshall findings into a single `MarshallFindings` aggregator and call `presentMarshallDecision(...)` once.
- `commands/add/index.ts`, `install/index.ts`, `update/index.ts` — add a `--strict` flag (`Boolean`, default `false`).

**Public API.**
```ts
export interface MarshallFinding {
    marshall: MarshallName;
    severity: "error" | "warning";
    packageName: string;
    message: string;
    suggestedAction?: string;
}
export interface MarshallDecisionOptions {
    countdownSeconds?: number;  // default 15
    strict?: boolean;
    nonInteractiveOk?: boolean; // when set, no-TTY does not abort warnings (CI tweak)
}
export type MarshallDecisionResult = { proceed: true } | { proceed: false; reason: "user-aborted" | "non-tty" | "ci-strict" | "errors-present" };
export const presentMarshallDecision: (
    findings: MarshallFinding[],
    options?: MarshallDecisionOptions
) => Promise<MarshallDecisionResult>;
```

**Config additions.**
```
security.autoContinue?: {
    enabled?: boolean;          // default true (only effective on warnings-only)
    countdownSeconds?: number;  // default 15
}
```

**Env vars.** `VIS_DISABLE_AUTO_CONTINUE=1` (skip countdown — require explicit Y). `VIS_AUTO_CONTINUE_SECONDS=<n>` (override).

**Cache key/TTL.** N/A.

**Integration points.**
- The typosquat prompt remains its own first step (it has unique "S = use suggested" semantics that don't compose with a generic countdown).
- After typosquat passes (or auto-corrects), `add`/`install`/`update` collect findings from items 1–8 into a single array.
- If any `severity === "error"` AND `--strict OR isInCi`, return `{ proceed: false, reason: "errors-present" }`.
- If errors but interactive → prompt "Proceed despite errors? [y/N]" (no countdown).
- If only warnings AND TTY AND not `--strict` AND not `VIS_DISABLE_AUTO_CONTINUE` AND not CI → print findings, then a re-rendering "Continuing in 15s... press Ctrl-C to abort." (Use `setInterval` decrementing line via `\r` rewrite; clear on signal.)
- If only warnings in CI/non-TTY → proceed silently (auto-continue) unless `--strict`.

**Edge cases / failure modes.**
- Ctrl-C during countdown → exit code 130 (signal-style).
- stdin closed mid-prompt → fall back to non-TTY semantics.
- Concurrent vis processes (background install) → countdown not rendered when not attached to a TTY.
- Output redirected (`vis add foo > log.txt`) → not a TTY, take auto-proceed path.
- Composition with typosquat prompt: typosquat decides first; if user picks "abort", we never reach the countdown. If user picks "yes, keep original", findings from subsequent marshalls still flow.

**Tests to add.**
- `/home/prisis/WebstormProjects/visulima/visulima/packages/tooling/vis/__tests__/security/decision-prompt.test.ts`
  - errors present + strict → `errors-present`
  - warnings only + TTY → proceed after fake timer advances 15s
  - warnings only + CI (`is-in-ci` mocked) → auto-proceed without timer
  - `VIS_DISABLE_AUTO_CONTINUE=1` + warnings → requires `y/N`
  - SIGINT during countdown → reject with `user-aborted`

**Effort.** M.

---

## 11. `vis inspect <pkg>` command

**Goal.** Run all marshalls against a not-yet-installed `name@version` and exit without modifying anything — equivalent to `npq install <pkg>` dry-run.

**Files to create.**
- `/home/prisis/WebstormProjects/visulima/visulima/packages/tooling/vis/src/commands/inspect/index.ts`
- `/home/prisis/WebstormProjects/visulima/visulima/packages/tooling/vis/src/commands/inspect/handler.ts`

**Files to modify.**
- `/home/prisis/WebstormProjects/visulima/visulima/packages/tooling/vis/src/bin.ts` — register `inspectCommand` next to `auditCommand`.

**Public API.**
```ts
// inspect/index.ts: Command export with options
// inspect/handler.ts:
export interface InspectOptions {
    json?: boolean;
    strict?: boolean;
    only?: MarshallName[];   // run subset
}
const execute: CommandExecute<Toolbox> = async (toolbox) => { ... }
```

**Config additions.** None of its own; shares all `security.*` blocks.

**Env vars.** None of its own. All `MARSHALL_DISABLE_*` apply.

**Cache key/TTL.** Shares all marshall caches (packument, registry-keys, downloads, archived-repo, expired-domains).

**Integration points.** Brand new command, no `pm-runner` involvement. Pipeline:
1. parse arg → `{ name, versionSpec }`
2. resolve version to a concrete semver via the shared resolver
3. fetch packument via shared `getPackument(name)`
4. run typosquat (`checkTyposquat`), then items 1–8 in the same order as `add`
5. format output: human-readable table OR `--json` array of `MarshallFinding`
6. exit code: 1 on any error finding (or any finding with `--strict`); 0 otherwise

**Edge cases / failure modes.**
- Invalid `pkg@version` syntax → exit 2 with usage hint.
- Network offline → emit single warning row "could not run online checks"; static checks (metadata heuristics from cached packument) still run.
- `vis inspect @scope/pkg` (no version) → resolve to `latest` dist-tag.

**Tests to add.**
- `/home/prisis/WebstormProjects/visulima/visulima/packages/tooling/vis/__tests__/commands/inspect.test.ts`
  - mock all marshalls, assert command emits findings in deterministic order
  - `--json` emits parseable JSON, exit 0 with warnings only
  - `--strict` causes non-zero exit on warning
  - `--only author,downloads` runs subset only

**Effort.** M.

---

## 12. Docs: shell-alias / wrapper pattern

**Goal.** README + docs page explaining `alias npm='vis install'`, etc. — and confirm `vis install` currently passes through unknown subcommands cleanly.

**Files to create.**
- `/home/prisis/WebstormProjects/visulima/visulima/packages/tooling/vis/docs/guides/shell-alias.mdx`

**Files to modify.**
- `/home/prisis/WebstormProjects/visulima/visulima/packages/tooling/vis/README.md` — short "Wrap your package manager" section linking to the guide.
- `/home/prisis/WebstormProjects/visulima/visulima/packages/tooling/vis/docs/guides/meta.json` (if present alongside other guides) to expose the new entry.

**Public API.** None.

**Config additions.** None.

**Env vars.** None.

**Cache key/TTL.** N/A.

**Integration points / handler caveats.** Verified during exploration: `commands/install/handler.ts` accepts only the documented flags via `InstallOptions`; positional arguments beyond `install` are not currently inspected. Risk: when a user aliases `npm install foo`, that becomes `vis install foo`, which today goes through `runInstall` (not `runAdd`). For full wrapper parity we'd need to detect `vis install <pkg-arg>` and route to `runAdd`. **Scope a small change in `install/handler.ts`**: when `argument.length > 0`, delegate to `add/handler` (preserving `--save-dev`/`--save-peer` flag aliasing — npm-style → vis-style mapping table). Document the supported flag aliases (`-D`/`--save-dev`, `-O`/`--save-optional`, etc.) in the guide.

Also document:
- `alias pnpm='vis install'`, `alias yarn='vis install'`, `alias bun='vis install'`
- caveat: `npm run` / `npm exec` are not wrapped; users keep using the PM directly for those
- the env-var matrix (item 9) so power users can disable specific checks per-shell
- compatibility with project pinned PM via `corepack` (vis already routes through the detected PM)

**Edge cases / failure modes.**
- Wrapper used in CI as `npm ci` would break unless `vis install --ci` is the alias target; doc this explicitly.
- `npm publish` is **not** intercepted; the alias only routes `install`/`i`/`add` paths.
- Power users with `.npmrc` `prefix=...` settings: those still flow through to the underlying PM unchanged.

**Tests to add.**
- `/home/prisis/WebstormProjects/visulima/visulima/packages/tooling/vis/__tests__/commands/install-passthrough.test.ts` — `vis install foo` invokes add path; preserves typosquat + marshall pipeline.

**Effort.** S (docs) + S (passthrough wiring) = S.

---

# Cross-Cutting Plan

## Suggested rollout order (with reasoning)

1. **Item 9 — `MARSHALL_DISABLE_*` env var matrix.** Every later item plugs into `isMarshallDisabled`. Doing this first means each new marshall is wired correctly from day one and the existing three checks (typosquats, allowBuilds, minReleaseAge) get the helper retrofitted in the same PR.
2. **Shared infrastructure** (see next section). Land `getPackument()`, `resolveVersionRange()`, the packument cache module, and the decision-prompt skeleton (item 10 stub) before any new marshall — otherwise we'd duplicate registry fetching 7 times.
3. **Item 10 — auto-continue / decision-prompt extraction.** Now every marshall plugs into the same UX. Land the typosquat refactor (no behavior change for typosquats themselves) in this commit so the diff is reviewable.
4. **Item 4 (provenance) + Item 5 (new-bin).** Smallest, fully offline once packument is cached, no new fetch endpoints. Good warm-up that shakes out the shared packument helper.
5. **Item 1 (author).** Builds on packument; introduces the warning-vs-error tiered semantics that item 10 already accepts.
6. **Item 7 (metadata).** Packument-only too; rounds out the "read what we already have" cluster.
7. **Item 6 (downloads).** First new external endpoint (`api.npmjs.org`). Single-purpose cache; low risk.
8. **Item 8 (archived-repo).** Adds GitHub API integration with token. Plan rate-limit handling here once and reuse.
9. **Item 2 (expired domains).** DNS resolver pattern; isolated. Land last among detection marshalls because it touches a new I/O primitive.
10. **Item 3 (signatures).** Largest and most invasive — vendored verification logic. Land alone with the keys-refresh subcommand and a generous fixture set.
11. **Item 11 — `vis inspect`.** All marshalls are in place; this just composes them in a new entry point.
12. **Item 12 — docs + install passthrough.** Last because documenting alias patterns is most valuable once all checks exist.

## Shared infrastructure to extract before writing marshalls

New module: **`/home/prisis/WebstormProjects/visulima/visulima/packages/tooling/vis/src/security/marshalls/packument.ts`**
```ts
export interface Packument { /* minimum subset npq uses */ }
export const getPackument: (name: string, options?: { cacheTtlMs?: number; registryUrl?: string; signal?: AbortSignal }) => Promise<Packument | undefined>;
export const resolveVersionRange: (packument: Packument, spec: string | undefined) => string | undefined;
export const clearPackumentCache: () => number;
```
- Cache at `<getVisCacheDir()>/packuments/<encodeURIComponent(name)>.json`. TTL default 30 min, override via `security.packument.cacheTtlMs`.
- Uses `loadNpmrc()` from `util/catalog.ts` to honor registry overrides + auth tokens (free for users who already configured private registries).

New module: **`/home/prisis/WebstormProjects/visulima/visulima/packages/tooling/vis/src/security/marshalls/registry.ts`** — the `MarshallName`/`isMarshallDisabled` helper (item 9).

New module: **`/home/prisis/WebstormProjects/visulima/visulima/packages/tooling/vis/src/security/marshalls/decision-prompt.ts`** — `presentMarshallDecision` + countdown (item 10).

New module: **`/home/prisis/WebstormProjects/visulima/visulima/packages/tooling/vis/src/security/marshalls/findings.ts`** — `MarshallFinding` type and a `MarshallFindings` aggregator + formatters (table, JSON) used by `add`/`install`/`update`/`inspect`.

These four modules form the spine; every per-item file from sections 1–8 imports from them.

## What this plan does NOT touch

- `vis audit` lockfile-walking semantics (`commands/audit/handler.ts`). Audit will *not* gain new marshalls automatically — it remains the dedicated installed-tree scanner. A follow-up could opt audit into running items 1, 4, 5, 7, 8 against `lockedPackages(...)`, but that's out of scope here.
- Transitive scanning from `add`/`install`/`update`. These commands continue to inspect **only explicit args**, per the existing typosquat rule. Lockfile-wide checks belong in audit.
- The Socket.dev integration in `socket-security.ts` — left alone. Item 11's `vis inspect` will call `fetchSocketReports` opportunistically, but the existing precondition (`security.socket.enabled === true`) still applies.
- The prompting library — no new dependency; `decision-prompt.ts` uses raw `node:readline` like `typosquats.ts` does today.
- `pm-runner` integration — no marshall calls `runAdd`/`runInstall`/`runUpdate`; they're all pre-flight checks.

## Risks specific to this effort

- **Registry rate limits.** `add foo bar baz` now triggers ≥3 packument fetches + 3 download-stat fetches + (optionally) 3 keys lookups (cached) + per-domain DNS + per-repo GitHub API calls. Mitigation: aggressive caching with the shared packument cache; promise.allSettled fan-out; warn-don't-block on every transient failure. Add a global cap (e.g. `security.maxParallelRequests = 8`) to all fan-outs.
- **Packument size.** Old popular packages (`react`, `lodash`) have packuments north of 5 MB. The cache file grows fast. Mitigation: strip the cached packument to only the fields we read (`versions[*].dist`, `versions[*]._npmUser`, `versions[*].maintainers`, `versions[*].bin`, `time`, `dist-tags`, `versions[*].repository`, `versions[*].license`, `versions[*].readme`). Document a `vis cache clean --packuments` invocation.
- **Sigstore / key cache invalidation.** If npm rotates a key and the user's 24h cache hasn't expired, every signature check fails. Mitigation: stale-while-revalidate (try fetch first when cache is `>20h` old; fall back to cached on transient errors). Item 3 exposes `vis security keys-refresh` for hand-forced invalidation. Also recommend `--strict` users set `keysTtlMs: 3_600_000` (1h).
- **False positives for legitimate monorepo packages.** Many internal/legitimate packages have no GitHub repo (`repository.url` points at the org monorepo). Item 8 archives-repo finding will fire on every child of an archived parent — false positive when the upstream archived a single proof-of-concept repo. Mitigation: `security.archivedRepo.allowlist`, plus document the limitation in the docs/guides page from item 12.
- **DNS reliability in offline-first environments.** Corporate networks frequently block `1.1.1.1`/`8.8.8.8`. Mitigation: `security.expiredDomains.dnsServers` override, plus auto-degrade to "warning, could not verify" when no resolvers respond.
- **Auto-continue countdown UX in non-VT TTYs.** Some terminals (Windows CMD legacy, certain CI containers that appear TTY-ish) can mis-render the `\r`-based countdown. Mitigation: detect by reading `process.env.TERM` (`dumb` / `unknown` → no animation, just a single "warnings present; proceeding in 15s" line) and skip the rewriting entirely.
- **Verification logic bugs in item 3.** Custom ECDSA verification is the highest-stakes new code. Mitigation: ship with a comprehensive golden-fixture test suite (real npm-published manifests + keys, captured once), fuzz the base64 + PEM-wrapping helpers, and gate the rollout behind `security.signatures.enabled: false` by default for the first minor release.

---

## Critical Files for Implementation

- /home/prisis/WebstormProjects/visulima/visulima/packages/tooling/vis/src/security/typosquats.ts
- /home/prisis/WebstormProjects/visulima/visulima/packages/tooling/vis/src/security/socket-security.ts
- /home/prisis/WebstormProjects/visulima/visulima/packages/tooling/vis/src/commands/add/handler.ts
- /home/prisis/WebstormProjects/visulima/visulima/packages/tooling/vis/src/config/types.ts
- /home/prisis/WebstormProjects/visulima/visulima/packages/tooling/vis/src/util/vis-paths.ts