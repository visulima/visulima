# Kingfisher vs. Visulima Secret Scanner — Comparative Analysis

**Date:** 2026-04-16
**Kingfisher version reference:** `main` @ v1.95.0 (MongoDB, Apache-2.0), sources cloned at `/tmp/kingfisher`
**Visulima reference:** `packages/tooling/secret-scanner` + `packages/tooling/vis/src/commands/secrets.ts`

## Executive Summary

- Kingfisher is a batteries-included **security platform** (scan + live validation + blast-radius mapping + 15+ scan sources). Our scanner is a focused, embeddable **Node-native detection library** with a CLI front-end (`vis secrets`) — deliberately narrower scope.
- Verified counts from source: Kingfisher ships **820 rules** across 510 YAML files (`/tmp/kingfisher/crates/kingfisher-rules/data/rules/`, counted by `^  - name:`), of which **533 declare HTTP validators**, 62 have `StatusMatch` sub-matchers, 13 are `HttpMultiStep`, and 9 use native validators (`AWS`, `GCP`, `MongoDB`, `Postgres`, `MySQL`, `Jdbc`, `JWT`, `AzureStorage`, `Coinbase`). Our ruleset is ~177 gitleaks rules, no validators.
- Kingfisher wins on **coverage**, **validation**, **scan sources** (git history, S3, GCS, Docker, GitHub/GitLab/Jira/Slack/Confluence, SQLite, `.pyc`, archives), and **output richness** (HTML audit bundle, SARIF, TOON, BSON, access-map).
- On the **core file-scan hot loop** we differ most on the regex engine: Kingfisher uses **`vectorscan-rs` 0.0.6** (vendored at `/tmp/kingfisher/vendor/vectorscan-rs/`, not upstream Hyperscan), wrapping the BSD vectorscan SIMD multi-pattern engine (`Cargo.toml:22,77`). We use `fancy-regex` per-rule + an `aho-corasick` keyword DFA. This is the single largest perf gap.
- We are **ahead** on: Node.js embeddability (NAPI, no shell-out), gitleaks ruleset parity + fingerprint compatibility, minimal footprint (7 Rust source files, ~1054 LOC; Kingfisher `src/` alone is ~11k LOC with 40+ provider modules), `vis` ergonomics (workspace-aware `--affected`/`--staged`/`--since`, c12 config across TOML/JSON/YAML/TS/JS), and deterministic sorted output.
- Biggest actionable gaps worth closing: **git-history scanning** (gix), **live validators** (at least top-10 providers), **archive/compressed-file extraction**, **`--stdin`**, **pattern engine upgrade** to `regex::RegexSet` (cheap) or `vectorscan-rs` (harder).

---

## Kingfisher Overview (source-verified)

### Stack

- Rust 1.90, edition 2021, workspace with 3 internal crates (`kingfisher-core`, `kingfisher-rules`, `kingfisher-scanner`) + a binary crate. Vendored `vectorscan-rs` at `/tmp/kingfisher/vendor/vectorscan-rs/` (patched via `[patch.crates-io]`).
- **Default allocator: mimalloc** (`Cargo.toml:223`, `features.default = ["use-mimalloc"]`). `tikv-jemallocator` available as opt-in.
- Async runtime: **tokio full** for validators, axum http1 for the embedded report server, rayon for CPU-bound scanning (`Cargo.toml:99`).
- Git: **`gix` 0.81** (gitoxide) with `max-performance-safe`, `serde`, and `blocking-network-client` features — no `git2`/libgit2 anywhere in production code (only `git2` 0.20 in `dev-dependencies` for tests).
- HTTP: `reqwest` 0.12 with `rustls-tls`, blocking + async.
- Compression: `flate2` (gzip/zlib), `bzip2-rs`, `lzma-rs` (xz), `zip` 8.5, `tar`, `asar`, `zstd` via `reqwest` only (no dedicated zstd crate — **no zstd decompression support in archive pipeline**).

### Regex / matching engine — corrected

- Kingfisher **does not use Intel Hyperscan directly**; it depends on [`vectorscan-rs` 0.0.6](https://crates.io/crates/vectorscan-rs), a Rust binding over **VectorCamp's vectorscan** (BSD-licensed Hyperscan fork, AVX2/SVE portable).
- Vectorscan is imported from a **vendored path** (`/tmp/kingfisher/vendor/vectorscan-rs/`) — they ship patches, so cross-compilation risks live with them, not upstream.
- Patterns compile into a single **`BlockDatabase`** (`crates/kingfisher-rules/src/rules_database.rs:28`). All patterns match in a single scan pass with SIMD literal acceleration — this is the headline perf lever.
- A parallel **`regex::bytes::Regex` per rule** (`anchored_regexes`) is kept for precise span recovery after vectorscan says "hit" (`rules_database.rs:25`). So the pipeline is two-stage: vectorscan → byte-regex.
- `RULE_COMMENTS_PATTERN` strips regex comments and flattens multi-line `(?x)` patterns before compilation (`rules_database.rs:31`).

### Rule format

- YAML, embedded into the binary at compile time via `include_dir!("$CARGO_MANIFEST_DIR/data")` (`crates/kingfisher-rules/src/defaults.rs:10`). No filesystem dependency at runtime for default rules; users can still add external rules via CLI.
- Confidence filter on load (`get_builtin_rules(Some(Confidence::Medium))` is the default — `defaults.rs:43`). Observed distribution across 820 rules: **645 medium, 94 high, 32 low** (`grep confidence:` over `data/rules/`).
- Rule fields observed in `/tmp/kingfisher/crates/kingfisher-rules/data/rules/aws.yml` and `stripe.yml`:
    - `name`, `id` (`kingfisher.<provider>.<n>`), `pattern` (supports `(?x)` with comments), `confidence`, `visible`, `categories`, `examples`, `references`.
    - `pattern_requirements`: `{ min_digits, min_uppercase, min_lowercase, ignore_if_contains: [...] }` — **644/820 rules use this**. Provides fast structural rejection before entropy check. We have no equivalent.
    - `min_entropy`: float Shannon threshold — **813/820 rules set it** (virtually universal).
    - `depends_on_rule`: chains rules by ID and exports captured groups as **liquid template variables** (e.g. AWS secret-key rule depends on AKID rule with `variable: AKID`) — **107 rules use cross-rule dependencies**. Unique feature.
    - `validation`: `{ type: Http | HttpMultiStep | AWS | GCP | MongoDB | MySQL | Postgres | Jdbc | JWT | AzureStorage | Coinbase | Grpc, content: {...} }`. **~660 of 820 rules have validators**.
    - `revocation`: companion block to auto-revoke a leaked credential (47 rules, AWS/GCP and other native providers).
    - `response_matcher`: sub-rules using `StatusMatch` / `WordMatch` / `JsonPath` / `Regex` / `Raw` / `report_response: true` to decide validity.

### Validation framework

- **`src/direct_validate.rs`** (1077 lines) — per-rule HTTP validator. Uses `liquid` templating (`{{ TOKEN }}`, `{{ AKID }}`, etc.) to build the request; `retry_request`, `validate_response`, `build_request_builder` are the primitives (`src/validation/httpvalidation.rs`).
- **`src/grpc_validation.rs`** — h2 + rustls TLS, native HTTP/2 gRPC (1 rule uses it today: `type: Grpc`). TLS roots cached via `OnceCell`.
- Native non-HTTP validators: `src/validation/aws.rs`, `gcp.rs`, `mongodb.rs`, `mysql.rs`, `postgres.rs`, `jdbc.rs`, `jwt.rs`, `azure.rs`, `coinbase.rs`. Each lives under `src/validation/` and runs on tokio.
- **Rate limiting:** `src/validation_rate_limit.rs` — per-rule RPS cap; global limiter shared across the scan.
- **Cache:** `crossbeam_skiplist::SkipMap<String, CachedResponse>` keyed by rule + token hash; prevents re-validating the same secret across blobs.
- **CLI:** `kingfisher scan --only-valid` (post-filter), `kingfisher validate --rule <id> --secret <value>` (direct validation of a known secret).

### Git history scanning

- **`src/git_repo_enumerator.rs`** (247 lines) + **`src/git_metadata_graph.rs`** (583 lines).
- Pipeline: `gix` opens the repo, `RepositoryIndex` builds an in-memory index of all commits/trees/blobs, `GitMetadataGraph` walks the DAG with `petgraph::DiGraph` and deduplicates via **`roaring::RoaringBitmap`** per-commit seen-sets (one bitmap for trees, one for blobs).
- **`MIN_SCANNABLE_BLOB_SIZE = 20`** bytes (`git_repo_enumerator.rs:23`) — below that, blobs are skipped (no secret fits).
- `GitBlobSource::StreamFromOdb` overlaps enumeration with scanning; blobs are pulled lazily from the ODB during parallel iteration. `GitBlobSource::Precomputed` materializes metadata up-front for deterministic runs.
- Commit metadata (author/committer/time) is parsed lazily only for commits that actually introduce new blobs.
- `--since-commit <ref>` / `--branch <ref>` wire into this same graph walker.

### Archive / decompression — `src/decompress.rs` (587 lines)

- Formats: zip (+ 20+ zip-based wrappers: docx, jar, ipa, nupkg, epub, sketch, key, numbers, xlsx, pptx, odt/ods/odp, kmz, xap, …), tar, tar.gz, tar.bz2, tar.xz, gz, bz2, xz, asar (Electron archives).
- Two extraction modes: **`Raw` / `RawFile`** for single-stream compression, **`Archive` / `ArchiveFiles`** for multi-entry archives. `RawFile`/`ArchiveFiles` stream to `tempdir` — used when decompressed size would exceed memory thresholds.
- **`is_safe_extract_path`** guards against zip-slip (rejects `..` components and mid-path `Prefix`).

### Binary detection — `src/binary.rs` (24 lines)

- Uses `content_inspector` crate: reads first 1024 bytes (`MAX_PEEK_SIZE`), calls `inspect()` which checks for BOMs, null bytes, and UTF-8/UTF-16 plausibility. Much simpler than our multi-signal approach (MIME + null-byte + base64 heuristic).
- `guesser` module is a 0-byte stub (`src/guesser.rs` is empty) — the prior analysis citing it was wrong. Language inference lives in `src/parser/` (`lexer.rs`, `html.rs`, `css.rs`) and feeds the matcher's context-verifier.

### Context verification & language parsing — `src/matcher/mod.rs`

- `CONTEXT_VERIFIER_MAX_LIMIT = 2 MiB`, `BASE64_SCAN_LIMIT = 64 MiB`, `MAX_CHUNK_SIZE = 1 GiB`, `CHUNK_OVERLAP = 64 KiB` for boundary matches, `RAW_MATCH_LOOKBACK = 4 KiB` (`matcher/mod.rs:39-44`).
- The old tree-sitter-based context verifier was replaced with a **lightweight regex lexer** (`src/parser/lexer.rs`) to allow a much higher blob-size ceiling (2 MiB vs. 128 KiB previously). We have no equivalent — we scan everything up to the full file.
- Base64 decode pass (`src/matcher/base64_decode.rs`) re-runs all rules against decoded base64 strings found in-blob, bounded to blobs ≤ 64 MiB.

### Inline ignore — `src/inline_ignore.rs` (436 lines)

- Default token: `kingfisher:ignore`. Users can add more via CLI; all normalized to ASCII-lowercase.
- `should_ignore` checks **three windows**: start-line, a few lines _before_ (handles pre-multi-line-string directives à la Python), and a few lines _after_ (for closing delimiters). Byte-level scan, no full-file lowercasing.
- Does **not** implement block-form `allow-start`/`allow-end` that we support.

### Baseline — `src/baseline.rs` (257 lines)

- YAML file with `ExactFindings.matches: [{ filepath, fingerprint, linenum, lastupdated }]`.
- Fingerprint is a **16-hex-char xxhash** of the finding (`format!("{:016x}", m.finding_fingerprint)`), not line-based — so moved findings stay suppressed as long as the secret text stays the same.
- `apply_baseline(..., manage: bool, roots)` mutates the findings store and optionally writes back new/removed entries (`--manage-baseline`).
- Our baseline keys on `file:ruleID:startLine` (breaks on line shifts). Their hash approach is strictly better.

### Access-map / blast-radius — `src/access_map/` (40+ provider modules)

- Each provider module exports a `check_<provider>_access(token) -> AccessReport` that calls provider APIs with the leaked credential and enumerates reachable resources (S3 buckets, EC2 instances, IAM roles, GitHub repos, Slack channels, etc.).
- Triggered by `--access-map` flag; report serialized to the HTML audit bundle.
- 39 providers confirmed: airtable, algolia, anthropic, artifactory, auth0, aws, azure/azure_devops, bitbucket, buildkite, circleci, digitalocean, fastly, gcp, gitea, github, gitlab, harness, hubspot, huggingface, ibm_cloud, jira, microsoft_teams, mongodb, mysql, openai, paypal, plaid, postgres, salesforce, sendgrid, sendinblue, shopify, slack, square, stripe, terraform, weightsandbiases, xray, zendesk.

### Output formats — `src/reporter/`

- `json_format.rs`, `sarif_format.rs`, `toon_format.rs`, `pretty_format.rs`, `html_format.rs`, `bson_format.rs`. HTML is a single-file bundle with an embedded web viewer and a local `axum` server for live browse (`--serve`).

### Scanner orchestration — `src/scanner/runner.rs` (1124 lines)

- `run_async_scan` is the main entry; composes filesystem enum, git enum, remote enumerators (GitHub, GitLab, Bitbucket, Gitea, Azure DevOps, Hugging Face, S3, GCS, Jira, Confluence, Slack, Teams, Docker), validation, access-map collection, and summary reporting.
- Shared via `ValidationDeps` (Arc-tuple of liquid parser, HTTP clients, cache, rate limiter) — a neat way to pass four long-lived deps through the rayon closures.

### CLI commands — `src/cli/commands/`

- `scan` (primary), `validate` (direct-validate a known secret), `rules` (list/show/lint YAML), `report` (re-render stored findings), `update` (self-update via `self_update` crate), `manage-baseline`, plus sub-source commands (`github orgs`, `github repos`, etc.).
- Exit codes: `0` clean, `200` any finding, `205` validated finding (reviewed in `src/cli/global.rs`).

### Build / Makefile

- `Makefile` exposes `build`, `release`, `test`, `lint`, `fmt`, `bench`, `install-hooks`. `scripts/monitor_kf_mem.sh` watches RSS during long scans. `scripts/rule_cleanup` is a Python helper to dedupe and lint the YAML ruleset.

---

## Our Scanner Overview

- **Stack:** Rust NAPI addon via `napi` v3, shipped through npm optional-dependencies per-platform, consumed from Node/TS.
- **Regex engine:** `fancy-regex` 0.13 (PCRE superset) + `aho-corasick` 1.x keyword prefilter (DFA, case-insensitive). See `packages/tooling/secret-scanner/native/src/rules.rs` and `native/src/detector.rs`.
- **Ruleset:** Vendored gitleaks `gitleaks.json` (~177 rules, MIT) at `packages/tooling/secret-scanner/assets/gitleaks.json`. Config merging via c12 accepts TOML/JSON/YAML/TS/JS/MJS/CJS (`src/config-loader.ts`).
- **Walker:** `ignore` 0.4 crate `WalkBuilder::build_parallel` with `.gitignore` / `.ignore` / `.git/info/exclude` / global gitignore, plus `extraIgnores` + `ignoreFiles` (`native/src/walker.rs`).
- **File reads:** mmap at ≥1 MiB (`memmap2`), binary-byte sniff on first 8 KiB, UTF-8 with lossy fallback via `encoding_rs` (`native/src/scanner.rs`).
- **Parallelism:** `rayon` 1.x; `par_iter` across files; global pool by default (`native/src/lib.rs`).
- **Suppression:** inline `gitleaks:allow` / `secret-scanner:allow`, **block** `allow-start`/`allow-end` (unique vs. Kingfisher), baseline JSON (`<file>:<ruleID>:<startLine>`), per-rule allowlists with OR/AND conditions, stopwords (`native/src/detector.rs:27-50`).
- **APIs:** `scan`, `scanFiles`, `scanString`, `listRules`, `inspectRuleset`, `fingerprint` (`src/index.ts`).
- **CLI:** `vis secrets` at `packages/tooling/vis/src/commands/secrets.ts` — supports `--staged`, `--since <ref>`, `--affected`, `--init`, baselines, SARIF/JSON/text.
- **Sources:** files/dirs, staged files, `git diff --name-only` for `--since/--affected`, in-memory strings. **No history, no remote sources, no archive extraction.**
- **Rust footprint:** 7 source files, ~1054 LOC total (`wc -l native/src/*.rs`).

---

## Feature Gap Analysis

| Feature                                                      | Kingfisher                                                                                                                  | Visulima                                                                                                | Gap / Notes                                                                                                                |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Rule count                                                   | **820** (measured, `^  - name:` over `data/rules/`)                                                                         | ~177 (gitleaks JSON)                                                                                    | Large; we inherit gitleaks. Importing extra rulesets is cheap — format is gitleaks-shaped.                                 |
| Rule format                                                  | YAML, `include_dir!`-embedded, confidence-gated                                                                             | JSON (compiled from gitleaks TOML)                                                                      | Theirs richer: `pattern_requirements`, `depends_on_rule`, `validation`, `revocation`, `response_matcher`.                  |
| Regex engine                                                 | **`vectorscan-rs` 0.0.6 (BSD vectorscan)** + per-rule `regex::bytes::Regex` for span recovery                               | `fancy-regex` per rule + `aho-corasick` prefilter                                                       | They scan all 820 patterns in a single SIMD pass. We AC-prefilter then run each rule's regex. Big gap on text-heavy files. |
| Keyword prefilter                                            | Built into vectorscan literal matching                                                                                      | `aho-corasick` DFA                                                                                      | Comparable signal, different mechanism.                                                                                    |
| Entropy                                                      | Shannon, rule-declared; applied to capture or full match based on group structure                                           | Shannon, rule-declared min (`native/src/entropy.rs`, `detector.rs`)                                     | Par.                                                                                                                       |
| **Pattern structural requirements**                          | `min_digits`, `min_uppercase`, `min_lowercase`, `ignore_if_contains` on 644/820 rules                                       | **None**                                                                                                | Medium gap; fast FP rejection without extra regex.                                                                         |
| **Rule dependencies**                                        | `depends_on_rule` + liquid vars; 107 rules (e.g. AWS secret needs AKID)                                                     | None                                                                                                    | Unique; enables multi-token secrets (AKID+secret, OAuth id+secret).                                                        |
| Language-aware context                                       | Regex lexer (`parser/lexer.rs`), capped at 2 MiB per blob                                                                   | No                                                                                                      | Suppresses matches in comments/strings for opt-in rules.                                                                   |
| **Live validation**                                          | 533 HTTP + 13 HttpMultiStep + 9 native + 1 gRPC validators; `--only-valid`, `validate` subcmd, per-rule RPS, response cache | **No**                                                                                                  | Largest feature gap.                                                                                                       |
| Checksum verification                                        | Yes (`ChecksumActual` rule field, 5+ rules observed)                                                                        | No                                                                                                      | Offline pre-check; pairs with validators.                                                                                  |
| **Git history scan**                                         | gix + petgraph + roaring dedup, streaming ODB reads, 20-byte min blob                                                       | `git diff --name-only` only                                                                             | Large gap.                                                                                                                 |
| Scan staged / since ref                                      | `--since-commit`, `--branch`                                                                                                | `--staged`, `--since`, `--affected` (`commands/secrets.ts`)                                             | We cover the PR case cleanly for Node monorepos.                                                                           |
| stdin                                                        | Yes                                                                                                                         | No (`scanString` covers programmatic only)                                                              | Small — add `--stdin` flag.                                                                                                |
| Remote sources                                               | GitHub/GitLab/Bitbucket/Gitea/Azure Repos/Hugging Face/S3/GCS/Docker/Jira/Confluence/Slack/Teams                            | None                                                                                                    | Out of scope for embeddable library.                                                                                       |
| Archive / compressed                                         | zip + 20 zip-based, tar(.gz/.bz2/.xz), gz/bz2/xz, asar; streaming to tempdir                                                | None                                                                                                    | Missing. No zstd in Kingfisher either.                                                                                     |
| SQLite / `.pyc`                                              | Yes (`src/sqlite.rs`, `src/pyc.rs`)                                                                                         | No                                                                                                      | Niche.                                                                                                                     |
| Binary detection                                             | `content_inspector::inspect()` on first 1024 B                                                                              | MIME + null-byte + base64 sniff, 8 KiB window                                                           | We do more signals; theirs is simpler/faster.                                                                              |
| Output: JSON/SARIF                                           | Yes                                                                                                                         | Yes (`secrets/format.ts`)                                                                               | Par.                                                                                                                       |
| Output: HTML bundle / web viewer                             | Yes (single-file + embedded axum server)                                                                                    | No                                                                                                      | Nice-to-have.                                                                                                              |
| Output: TOON, BSON                                           | Yes                                                                                                                         | No                                                                                                      | Niche.                                                                                                                     |
| Baseline                                                     | **YAML, xxhash fingerprint** (line-shift tolerant), `--manage-baseline`                                                     | JSON, `file:ruleID:startLine` (breaks on line shift), `--init`/`--update-baseline`/`--replace-baseline` | **They're ahead on stability.**                                                                                            |
| Inline suppression                                           | `kingfisher:ignore` single-line, checks 3-line window (line, above, below)                                                  | `gitleaks:allow` + `secret-scanner:allow` single-line + **block regions**                               | We support blocks; they don't.                                                                                             |
| Global + per-rule allowlists (paths/regex/stopwords, AND/OR) | Yes (`src/safe_list.rs`)                                                                                                    | Yes (`native/src/detector.rs`)                                                                          | Par.                                                                                                                       |
| Config formats                                               | YAML                                                                                                                        | TOML/JSON/YAML/TS/JS/MJS/CJS via c12                                                                    | We're more flexible.                                                                                                       |
| **Access-map / blast radius**                                | 39 providers (`src/access_map/`)                                                                                            | No                                                                                                      | Unique Kingfisher feature.                                                                                                 |
| Credential revocation                                        | Yes (`revocation:` block, 47 rules)                                                                                         | No                                                                                                      | Unique.                                                                                                                    |
| CI exit codes                                                | 0 / 200 / 205                                                                                                               | 0 / 1 / 2                                                                                               | Theirs encodes "validated"; we could mirror with `--only-valid`.                                                           |
| Embedding                                                    | Rust crates (`kingfisher-core/-rules/-scanner`)                                                                             | Node NAPI (+ Rust crate internally)                                                                     | Different audiences; we own Node.                                                                                          |
| Determinism                                                  | Stable sort in findings store; xxhash fingerprint                                                                           | Explicit lex sort by `(file, line, col, ruleId)` (`lib.rs`)                                             | Par on stability guarantees.                                                                                               |
| Allocator                                                    | mimalloc by default, jemalloc optional                                                                                      | System allocator                                                                                        | Medium perf lever on scans with heavy allocation churn.                                                                    |

---

## Performance Analysis

### Where Kingfisher is faster

1. **Vectorscan SIMD multi-pattern scan.** A single pass matches all 820 patterns using AVX2/SSE4.2 literal acceleration (`rules_database.rs:28`, `matcher/mod.rs`). Our `aho-corasick` keyword DFA narrows to candidate rules, but each candidate then runs a full `fancy_regex` execution independently. Expect **2–5× on text-heavy files** with many concurrently-applicable patterns.
2. **mimalloc default** (`Cargo.toml:223`). Large-scan workloads with many short-lived allocations benefit noticeably — we ship the system allocator.
3. **`pattern_requirements` fast path.** Digit/case-count checks reject candidates before entropy calc or secondary regex (`src/matcher/filter.rs:~60+`). Saves Shannon-entropy work on the 644 rules that declare them.
4. **Streaming ODB blob reads.** History scans overlap enumeration with scanning (`git_repo_enumerator.rs:40` `StreamFromOdb`). We can't history-scan at all.
5. **Context-verifier 2 MiB cap.** They skip language-parse on blobs > 2 MiB (`matcher/mod.rs:48`). Keeps tail-latency bounded.
6. **Validation cache.** `SkipMap` keyed by rule+token so duplicate leaks across commits hit cache once.

### Where we're comparable or ahead

- **Walker.** Both use `ignore` crate `build_parallel`. Our implementation is clean (`native/src/walker.rs`) with a single lock-protected collector, `.gitignore` / `.ignore` / `git_exclude` / `git_global` all on, hidden skip by default. Matches their approach.
- **mmap threshold.** We mmap at ≥1 MiB, UTF-8 fast path with lossy fallback, binary skip after 8 KiB null sniff (`scanner.rs`). Their binary detection is 1 KiB and single-signal (`content_inspector`).
- **Allocation discipline.** `secret_slice` borrows from `content`; entropy + allowlist run before any `to_string()` (`native/src/detector.rs`).
- **Determinism.** We emit deterministic order by `(file, start_line, start_column, rule_id)` explicitly (`native/src/lib.rs`). Kingfisher orders via findings-store insertion + xxhash — similar guarantee, different mechanism.
- **NAPI overhead.** In-process scanning for editor/IDE/CI plugin embedding — no child-process fork, no JSON over stdio.
- **Block-form suppression.** `allow-start`/`allow-end` covers multi-line secret literals elegantly. Kingfisher's line-based approach misses long TLS key blobs.

### Specific deltas worth attention

- `fancy-regex` falls back to backtracking only when the pattern uses lookarounds/backrefs. Gitleaks rules rarely do, so most hot-path matching uses Rust's `regex` crate under the hood — narrowing but not closing the vectorscan gap.
- We compile every rule to its own `Regex`. A multi-pattern union (`regex::RegexSet`) would let us skip per-rule execution on cold files. `RegexSet::matches` is available today and doesn't require vectorscan. **Highest-ROI engine change we can ship without new deps.**
- `find_allow_regions` lowercases the whole file (`native/src/detector.rs:28`). For large files this is wasteful — a byte-level case-insensitive search (or `memchr`-based scan for `g`/`s`) would avoid the allocation. Compare Kingfisher's `inline_ignore.rs:45-99`, which walks bytes line-by-line.
- Line/col resolution builds a `Vec<usize>` of every newline offset. For files with no findings this is wasted work — compute lazily only for emitted matches.
- `memchr` is already in Kingfisher's tree (`Cargo.toml:150`) — we should add it (cheap dep) for the `find_allow_regions` rewrite and for `\n` indexing.

---

## Where We're Ahead

- **Node embeddability.** Direct NAPI bindings, `scan`/`scanFiles`/`scanString` return typed findings. Kingfisher users embedding outside Rust must shell out or use the Rust crate (which drags in 100+ deps including tokio, reqwest, AWS SDK, MongoDB driver, …).
- **Config ergonomics.** c12 auto-detects TOML/JSON/YAML/TS/JS/MJS/CJS; Kingfisher is YAML-only.
- **Monorepo awareness via `vis`.** `--affected` piggybacks on git, `--staged` integrates with pre-commit, `--since <ref>` for PR diffs — first-class Node/pnpm workflow.
- **Block suppression.** `allow-start`/`allow-end` for multi-line secrets — Kingfisher only supports line directives.
- **Dual suppression markers.** We accept upstream `gitleaks:allow` so migrations are zero-touch, while also owning `secret-scanner:allow`.
- **Minimal footprint.** Single native `.node` binary + JS wrapper. No mimalloc, no reqwest, no AWS SDK, no axum report server, no webbrowser opening, no self-updater.
- **Gitleaks fingerprint parity.** `file:ruleID:startLine` matches gitleaks exactly, so existing gitleaks baselines work as-is.
- **Baseline diff UX.** `vis secrets` prints `+new / unchanged / -resolved` counts after every run when a baseline exists. Kingfisher does baseline management but not this inline summary.

---

## Recommendations (prioritized)

Effort: **S** = <1 day, **M** = 1–3 days, **L** = 1–2 weeks. Impact relative to current scanner.

### Quick wins (S)

1. **Swap `content.to_lowercase()` in `find_allow_regions` for a byte-level scan.** Add `memchr` dep, locate candidate `g`/`s` bytes, `eq_ignore_ascii_case` on fixed-length markers. Model: Kingfisher `src/inline_ignore.rs:45-99`. File: `native/src/detector.rs:27`.
2. **Lazy line-offset table.** Only compute when ≥1 candidate rule matched. Saves a full-file pass on clean files. File: `native/src/detector.rs`.
3. **Expose `--stdin` in `vis secrets`.** Wire to `scanString`. Unlocks `cat file | vis secrets`, editor plugins. File: `commands/secrets.ts`.
4. **Add exit code 205 equivalent.** Wire `--only-valid` flag (initially a no-op until validators land) to the exit-code convention so CI users can prepare. File: `commands/secrets.ts`.
5. **Adopt `pattern_requirements` rule fields.** Extend rule JSON shape with `minDigits`/`minUppercase`/`minLowercase`/`ignoreIfContains`; evaluate _before_ entropy. Cheap ports from Kingfisher YAMLs. Files: `native/src/rules.rs`, `detector.rs`.
6. **Switch default allocator to mimalloc** (gate behind `--features mimalloc`, ship enabled in prebuilt binaries). Kingfisher's config is a good template (`Cargo.toml:223`).

### Medium investments (M)

7. **`regex::RegexSet` union pre-check per file.** Build once at compile, use as a second-stage filter after AC prefilter. On cold files with AC false-positives, skip individual regex runs entirely. Files: `native/src/rules.rs`, `detector.rs`. Impact: medium-high, especially for large codebases where most files match AC but not any regex.
8. **Git-history scan (`vis secrets --history`).** Use `gix` (same as Kingfisher) to iterate commits, walk blobs, dedup by OID with `roaring::RoaringBitmap`, run `scan_text` per blob. Stream blobs, don't materialize. Model: `src/git_repo_enumerator.rs`. **Impact: high.**
9. **Archive extraction.** Support `.zip`, `.tar.gz`, `.tar`, `.gz` via `zip`/`tar`/`flate2`. Skip binary entries. Model: `src/decompress.rs` (pare down to 4 formats, skip asar/xz/bz2 for v1). File: new `native/src/archive.rs`.
10. **Baseline v2 with xxhash fingerprint.** Current fingerprint `file:ruleID:startLine` breaks when lines shift. Add optional `secretHash` (`xxh3_64`, render as `{:016x}`) so moved findings stay suppressed. Direct port of `src/baseline.rs:76`. File: `src/index.ts`.
11. **HTML report.** Single-file bundle consumable by `vis secrets --format html`. Reuse SARIF output as the data source. Impact: improves CI-reviewer UX. Don't replicate Kingfisher's embedded axum server — stay static.
12. **Rule pack plugins.** Publish `@visulima/secret-scanner-rules-ai`, `-cloud-extra`, etc., to narrow the rule-count gap without bloating default install. Kingfisher's 820-rule default install bundles 40+ provider SDKs; we can stay lean by shipping packs opt-in.
13. **Inline-ignore window matching like Kingfisher.** Scan 1–2 lines _above_ and _below_ the match so `// kingfisher:ignore` placed above a multi-line literal works (`src/inline_ignore.rs:62-99`). We currently only check the match line.

### Larger investments (L)

14. **Live validation framework.** Add a `validation:` section to rule format (HTTP method, URL template with liquid `{{ TOKEN }}`, expected status codes, response matcher, timeout, RPS). Implement a tokio runner in the NAPI layer, concurrency-capped, with a `SkipMap` cache. Start with top-10 providers (AWS, GitHub, GitLab, Stripe, SendGrid, Twilio, OpenAI, Anthropic, Slack, Datadog). Gate behind `validate: true` in config. File: new `native/src/validator.rs`. **Impact: highest** for false-positive reduction.
15. **`depends_on_rule` + liquid templating.** Needed to validate multi-token credentials (AWS AKID+secret, OAuth id+secret). Port the liquid-filters registration (`src/liquid_filters.rs`) or use `handlebars`/simple `${var}` interpolation. Pairs with (14).
16. **Pattern engine upgrade.** Evaluate `vectorscan-rs` 0.0.6 (same crate Kingfisher uses) as an optional feature flag. Keep `fancy-regex` as the fallback for platforms without SSE4.2/NEON. Gate via Cargo feature; ship both in prebuilt binaries per-arch. Bench carefully — building vectorscan adds ~2 min to the native build and ~1 MB to binary size. **Impact: high on large repos.**
17. **Remote sources (incremental).** Start with GitHub org/repo scanning via REST API (existing tokens). Add GitLab second. Keep as optional `vis secrets remote …` subcommand so the core package stays small.
18. **Language-aware suppression.** Use a regex lexer (Kingfisher's `src/parser/lexer.rs` approach, **not** tree-sitter) to skip matches inside comments/strings if a rule opts in. This is false-positive reduction, not speed — trades throughput for precision. Cap at 2 MiB per blob (match their ceiling).

### Don't copy

- **Access-map / blast radius.** Out of scope for a scanner; belongs in a dedicated posture tool. Revisit after (14).
- **Slack/Jira/Confluence/Teams sources.** Low signal-to-scope for a Node-centric tool. Users who need these should use Kingfisher.
- **Docker image scanning.** Ecosystem already has `trivy`, `grype`. Not our fight.
- **`.pyc` / SQLite / asar extraction.** Niche; don't carry the dep weight.
- **Embedded axum report server.** HTML static file is plenty; live browsing is scope creep.

---

## References

- Kingfisher repo: https://github.com/mongodb/kingfisher
- Kingfisher rules (820, counted): `/tmp/kingfisher/crates/kingfisher-rules/data/rules/`
- Vectorscan (BSD Hyperscan fork): https://github.com/VectorCamp/vectorscan
- `vectorscan-rs` crate: https://crates.io/crates/vectorscan-rs (0.0.6)
- Intel Hyperscan (upstream, not used directly): https://github.com/intel/hyperscan
- Gitoxide (`gix`): https://github.com/GitoxideLabs/gitoxide
- Gitleaks (our ruleset source): https://github.com/gitleaks/gitleaks
- Our scanner: `packages/tooling/secret-scanner/`
- Our CLI: `packages/tooling/vis/src/commands/secrets.ts`
- Key Kingfisher file refs: `Cargo.toml` (deps), `src/matcher/mod.rs:39-48` (limits), `src/git_repo_enumerator.rs:23` (min blob), `src/decompress.rs:18-22` (zip-based formats), `src/baseline.rs:76` (xxhash), `src/inline_ignore.rs:45-99` (window scan), `crates/kingfisher-rules/src/defaults.rs:10` (embed), `crates/kingfisher-rules/src/rules_database.rs:28` (vectorscan BlockDatabase).
