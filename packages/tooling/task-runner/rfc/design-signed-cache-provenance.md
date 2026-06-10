# Design — Signed cache artifacts & per-branch provenance

Make a cache entry **unforgeable and attributable** so a malicious or careless writer can't poison what another machine restores. Closes the class of attack behind Nx's CVE-2025-36852 ("CREEP" — a shared read-write cache credential with no artifact provenance lets a PR poison `main`'s cache), and matches Turborepo's `remoteCache.signature` (HMAC-SHA256) at the same time.

## Why

Our remote cache today (`backends/http.ts`, `backends/reapi.ts`) stores and restores artifacts keyed by task hash. The task hash proves _what inputs produced this_, but **not** _who produced it_ or _that the bytes weren't swapped in transit/at rest_. Two concrete holes:

| Hole                      | Today                                                 | Consequence                                                                                            |
| ------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| No artifact integrity tag | `storeByTaskHash`/`retrieveByTaskHash` trust the body | A compromised cache server (or MITM) serves arbitrary bytes under a valid hash → RCE on every consumer |
| No writer provenance      | any token with write scope can write any hash         | A fork/PR job poisons the hash a protected branch will restore                                         |

`vis` already has a _partial_ mitigation — `applyBranchScope` (`vis/src/cache/cache-directory.ts`) segregates the **local** dir per branch — but it does nothing for the remote/shared tier and provides no integrity guarantee.

## Approach

Two independent, individually-optional layers. **Both are no-ops unless a key is configured**, so existing behaviour is byte-for-byte unchanged when off.

### 1. Artifact signing (integrity) — Turbo-compatible

On write, compute `tag = base64(HMAC-SHA256(key, teamId ‖ taskHash ‖ artifactBytes))` and send it as the `x-artifact-tag` header (Turbo's exact scheme, so our cache interops with `ducktors/turborepo-remote-cache` & friends). On read, recompute and **reject on mismatch** (treat as a cache miss, log a `cacheDiagnostics` reason — never restore unverified bytes).

- Key source: `remoteCache.signatureKey` option, falling back to `TURBO_REMOTE_CACHE_SIGNATURE_KEY` (env, for drop-in Turbo compat).
- Lives in `hash-bridge.ts` (the one chokepoint both backends funnel through) so HTTP and REAPI inherit it.
- Local CAS (`cas/store.ts`) already content-addresses by digest, which is integrity _within_ a machine; signing adds cross-machine trust.

### 2. Branch provenance (authorization)

Stamp each entry with the producing ref + commit, and let consumers declare a trust policy:

```ts
remoteCache: {
  signatureKey: process.env.TURBO_REMOTE_CACHE_SIGNATURE_KEY,
  provenance: {
    // who is allowed to write entries this run will later read
    trustedRefs: ["refs/heads/main", "refs/heads/alpha"],
    // PR / fork jobs get read-only by default
    writeScope: "branch", // "branch" | "global" | "none"
  },
}
```

- A run on `main` only **restores** entries whose provenance ref ∈ `trustedRefs` (so a PR can't feed `main`).
- A PR/fork run is **read-only** by default (`writeScope: "branch"` writes under a branch-namespaced key that protected branches never read). This is the structural CREEP fix: no shared RW credential that crosses the trust boundary.
- Provenance metadata rides in the existing action-cache metadata (`cas/action-cache.ts`) and an `x-artifact-provenance` header for the HTTP tier.

## Integration

- `backends/hash-bridge.ts` — `storeByTaskHash` signs + stamps; `retrieveByTaskHash` verifies + policy-checks before handing bytes to `cache.put`.
- `backends/types.ts` — extend `RemoteCacheBackend` with optional `tag`/`provenance` on store/retrieve (default undefined = today's behaviour).
- `types.ts` — `RemoteCacheConfig` gains `signatureKey?`, `provenance?`.
- `task-orchestrator.ts` — surface verify-failures through `printCacheMiss` with reason `"signature mismatch"` / `"untrusted provenance"`.
- `cacheDiagnostics` already exists as the explainer surface — reuse it.

## Risks / open questions

- **Key distribution** is the user's problem (CI secret), same as Turbo — we only consume it. Document the threat model clearly.
- Verify-on-read adds one HMAC over the artifact bytes per restore — negligible vs the tar/IO already happening.
- REAPI already has its own CAS integrity (digests); signing there is belt-and-suspenders — gate it so we don't double-pay unless `provenance` is on.
- Must **fail closed**: a configured key + missing/garbled tag = miss, never a silent unverified restore.

## Effort

Small–medium. Self-contained in `backends/` + `types.ts`; opt-in so zero blast radius when unconfigured. **Recommended first to build** — cheapest high-value win and a marketing-grade security differentiator (free, self-hostable, signed — the exact thing Nx just deprecated four plugins over).
