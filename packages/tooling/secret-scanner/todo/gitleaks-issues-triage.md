# Gitleaks open-issue triage for `@visulima/secret-scanner`

235 open issues from [`gitleaks/gitleaks`](https://github.com/gitleaks/gitleaks/issues?q=is:issue+is:open) triaged against our current feature set. Refreshed 2026-04-16 after the `ScanOptions` regrouping, SARIF polish, rule-priority engine, codepoint column math, per-rule pre-processor and false-positive patches landed.

**Context — we've implemented:**

- 222 vendored gitleaks rules (upstream MIT) + 11 opt-in preset rules + additive FP patch file (`data/gitleaks.patches.json`)
- `weak-passwords` preset (low-entropy credentials, #1331 cluster)
- `password-manager` preset (1Password / Bitwarden / LastPass / KeePass / browser-CSV export detection, #1525)
- fancy-regex + aho-corasick keyword prefilter, rayon parallelism, mmap on large files
- Baseline JSON (merge + diff, sole fingerprint store), inline `gitleaks:allow` + block `gitleaks:allow-start`/`-end` suppression, also accepts `secret-scanner:allow` markers
- Native `.gitignore` respect via the walker, plus `walk.excludePatterns` + `walk.excludeFromFiles` for scanner-specific gitignore-syntax exclusions
- `scan()` / `scanFiles()` / `scanString()` entry points with grouped `ScanOptions` (config / walk / rules / baseline)
- `rules.include` / `rules.exclude` rule filters
- **Findings deduplication** — identical and span-overlapping findings collapse (#1054)
- **Rule priority** (`priority: int`) — specific rules beat `generic-api-key` on the same span (#1567, #1997)
- **Relative-path findings** — walker canonicalises roots, strips prefix, normalises separators (#1059)
- **Codepoint-based columns** — 1-based, matches editor/LSP expectations (#1962, #1424, #1357)
- **Empty-RHS skip** in the detector (#1828)
- **Target-scoped allowlists** via `targetRules` (#1919)
- **Per-rule `preRegexReplace`** — text normalisation before the rule regex runs (#1182)
- **FP patches** — placeholder stopwords + template/interpolation regexes for `generic-api-key` (#1830, #1832, #1857); framework-aware placeholders (Vue / Svelte / Astro / Nuxt / Next / React patterns) (#1762)
- **`alwaysRuns` diagnostic** on `RuleInfo` — flags rules without keywords that bypass the AC prefilter (#1675)
- **Panic-free rule compilation** — all regex + AC errors funnel into `skipped_rules`; column math uses checked indexing (#1846)
- Polished SARIF output (file:// URIs + `tool.driver.rules[]` cross-refs, level, short description) (#1827, #1858, #1110)
- `--staged` / `--since` / `--affected`, `--init`, `--list-rules`, SARIF + JSON + text formats
- `vis migrate gitleaks` / `secretlint` / `verify`, `vis hook add secrets`

**Deferred** — git-history walking, recursive base64/gzip decoding, `pyproject.toml` config discovery.

## Bucket counts

| Bucket                             | Count |
| ---------------------------------- | ----- |
| 1. Already supported               | ~36   |
| 2. High-value to adopt             | 3     |
| 3. Medium-value to adopt           | 28    |
| 4. New detection rules (auto-sync) | 21    |
| 5. Gitleaks-specific / skip        | ~117  |
| 6. Already deferred                | ~30   |

---

## 1. Already supported

### Carried over

- **#2068** `--report-format gitlab-code-quality` — thin reformat from existing SARIF/JSON renderer.
- **#2060 / #1195** Use `.gitignore` / gitignore-syntax for ignores — walker respects `.gitignore` natively; `walk.excludeFromFiles` adds arbitrary `.secretsignore`-style files; `walk.excludePatterns` takes inline gitignore patterns.
- **#1328** Simple example on how to ignore/whitelist a directory — `.gitignore` + `walk.excludeFromFiles` + `walk.excludePatterns`.
- **#1397** `gitleaks:allow` usable outside same line — we implement `gitleaks:allow-start`/`-end`.
- **#1234** Ability to scan selected files — `scanFiles()` API + CLI file list.
- **#1268** Diff files / directory-aware reports — `--affected` / `--since` covers diff scan.
- **#1048** Multiple report formats in single execution — renderer callable per-format.
- **#800** Scan commit message + content — staged scan covers content; commit-message n/a without history.
- **#1239** `generic-api-key` digit / stopword check — already implemented upstream; shipped via vendored rules.
- **#1163** `detect --source folder` — `scan(dir)` honors directly.
- **#1282** How do I scan files inside a folder — `scan()` / `scanFiles()`.
- **#1888** `gitleaks dir` doesn't allow multiple values — we accept multiple paths.
- **#1284** Baseline entries require more than fingerprint — our baseline stores full `Finding` objects.
- **#1118** Skip binary files by default — `scanner.rs` null-byte sniff in first 8 KiB.
- **#1757** Handle non-unicode bytes in input — `scanner.rs` lossy UTF-8 decode via `encoding_rs`.
- **#1181** Ignore files for rule — per-rule `allowlist.paths` from upstream gitleaks schema, compiled in `rules.rs`.
- **#1209, #1226** Can't build from source / `go run` module path — n/a (Rust).
- **#1862** README mentions deprecated command — n/a.

### Shipped in recent iterations

- **#1054** Findings deduplication — exact duplicates collapse, span-overlap dedup by priority (`finalize_findings` in `native/src/lib.rs`).
- **#1059** Relative-path fingerprints — findings emit paths relative to the first scan root; baselines portable across cwd.
- **#1567 / #1997** Rule priority — `priority: int` field; higher priority wins on span overlap.
- **#1828** Empty-RHS false positives — `secret_slice.trim().is_empty()` drop in `detector.rs`.
- **#1832 / #1830 / #1857** Placeholder + hashicorp FPs — additive `gitleaks.patches.toml` with 26 stopwords + 5 template regexes (`${VAR}`, `{{ }}`, `vault://`, `$env:`, `arn:aws:*`). Upstream `gitleaks.toml` stays pristine for re-syncs.
- **#1962 / #1424 / #1357** Codepoint column math — 1-based char counts, fixed off-by-one (`codepoint_col` in `detector.rs`).
- **#1919** `targetRules` in allowlists — allowlists can now scope to specific rule ids.
- **#1182** Per-rule text pre-processor — `preRegexReplace: [{from, to}]` runs before the rule regex.
- **#1827** Invalid URI in SARIF report — `file://` URIs emitted via `pathToFileURL` in vis renderer.
- **#1858 / #1110** SARIF `level` + short description — populated; `tool.driver.rules[]` cross-references added.
- **#1331 / #1833 / #1958 / #1203** Low-entropy rule snippets — shipped as the bundled `weak-passwords` preset.
- **#1525** Password-manager export detection — shipped as the bundled `password-manager` preset (1Password 1PUX / 1PIF, Bitwarden JSON, LastPass CSV, KeePass KDBX/XML, browser-native CSV, 1Password CLI session tokens, path-only catch-all).
- **#1675** Keyword-less rule diagnostic — new `alwaysRuns: boolean` on `RuleInfo`.
- **#1762** Framework-aware stopwords — placeholders for Vue / Svelte / Astro / Nuxt / Next.js / React patterns added to `gitleaks.patches.toml`.
- **#1846** Robust regex-panic handling — audit pass + defensive column-math indexing (`.saturating_sub` / `.get().copied().unwrap_or(0)`).

## 2. High-value to adopt (actionable)

| #         | Title                      | Rationale                                                                                     | Effort |
| --------- | -------------------------- | --------------------------------------------------------------------------------------------- | ------ |
| **#1541** | Scan binary files (opt-in) | `--scan-binary` / `walk.scanBinary`. Skip-by-default already done; this is the opt-in switch. | S      |
| **#1456** | API keys with checksums    | Checksum validators (AWS, Stripe, GH PAT). Huge FP reduction. Differentiator #1.              | M      |
| **#1013** | Secret validation feature  | Live-validate via API ping. Major differentiator #2 — pairs with #1456.                       | L      |

## 3. Medium-value to adopt

- **#1924** tiktoken token-density for randomness — alt entropy heuristic. M.
- **#1766 / #1074** Add context lines around findings. S.
- **#1626** Output git command for context — show snippet for working tree. S.
- **#1714** Generate links for directory scans — `file:line` links in text output. XS.
- **#1511** Custom replacement string for redaction. XS.
- **#1122** Disable color codes (`--no-color` / `NO_COLOR`). XS.
- **#1246** Suppress `gitleaks:allow` inline annotation (`--no-allow-comments`). XS.
- **#1925** Logging ignored secrets (verbose suppression report). S.
- **#1004** Logging around failure to write report. XS.
- **#1065** Validate `report-path` before scan. XS.
- **#1689** Missing XML report format (JUnit XML). S.
- **#1312** Support `-` for stdout when `--report-path = ""`. XS.
- **#1058 / #914** Jupyter notebooks — strip base64 cells, parse `.ipynb`. S.
- **#1361** YAML files in scan by default — confirm + add tests. XS.
- **#1647 / #1933** Kubernetes multi-line secrets — k8s `data:` decoder pre-processor. M.
- **#1513** Additional Kubernetes secret detections. S.
- **#1923** Load configs from git refs (`--config <ref:path>`). M.
- **#1754** Min version check when `useDefault`. XS.
- **#947** Extending configuration files — proper `extends` semantics. M.
- **#983** Print resulting configuration for debug (`--print-config`). XS.
- **#1027** Docs for "extending a central config". XS.
- **#1251** Separate files for rules and allowlist. S.
- **#1557** Clarify `--config` precedence. XS.
- **#1344** Add `ignorelist` to config — naming cleanup. S.
- **#1345** Auto-find config in cwd — discovery walks up the tree. XS.
- **#1864** Sample AKIA credentials cause SAST flags — use obviously-fake values in docs/tests. XS.

## 4. New detection rules (auto-inherited on next TOML sync)

Bump `scripts/gitleaks.ref` and re-run `pnpm run build:rules` to pick these up:

- # 1697 SourceGraph tokens
- # 1818 `GCPServiceAccount` rule
- # 1942 GCP API key (Google Chat variant)
- # 1946 Looker client ID + secret
- # 1715 SQL Server connection strings
- # 1778 Tailscale keys
- # 1687 Azure Development Account Key
- # 1082 Crypto wallet private keys / seed phrases
- # 1228 Cleartext SQL passwords
- # 1301 Docker registry credentials
- # 1326 `.npmrc` auth detection
- # 539 Additional Azure rules
- # 1391 JWK private key matching
- # 1444 HubSpot Private App Access Tokens / Developer API keys
- # 1447 Discord Bot Tokens
- # 1467 OpenAI API Key variants
- # 1366 LaunchDarkly access-token coverage
- # 1147 nuget passwords
- # 1114 Commvault rule
- # 1034 Exclude encrypted cosign private keys
- # 739 Browser cookie database rules

Plus the "generic-api-key" cluster (#1773, #1772, #1052, #1047, #1036, #1564, #908) — fold into our regex tweaks or inherit from upstream.

## 5. Gitleaks-specific / skip

CLI bugs, Go/docker/GH-Action issues, usage questions, and internals that don't apply:

# 1464, #1306, #2063, #1999, #2048, #1869, #1624, #2044, #1814, #1727, #1343, #1998, #1993, #1984, #1986, #1985, #1979, #1981, #1277, #1927, #1897, #1285, #1939, #1728, #1932, #1895, #1409, #1913, #1898, #1893, #1866, #1859, #1855, #1839, #1838, #1821, #1785, #1753, #1448, #1723, #1319, #1641, #1308, #1475, #1544, #1588, #1436, #1022, #1637, #1638, #999, #1261, #1438, #821, #1385, #1465, #1437, #1364, #1338, #1365, #1405, #1257, #1080, #1348, #1287, #1049, #1329, #1324, #1323, #1311, #1205, #1263, #1279, #1275, #1210, #1070, #1137, #1127, #1120, #1057, #1089, #1078, #1085, #885, #1067, #1053, #1041, #1051, #949, #988, #911, #833, #827, #829, #811, #752, #764, #2031, #2003, #2017, #1944, plus obsolete `.gitleaksignore`-specific issues (#1870, #1325, #1572, #1668) since the concept no longer exists in our design.

## 6. Already deferred

Pending the deferred roadmap items — git-history walk, recursive base64/gzip decoding, `pyproject.toml` discovery:

- **#2066** `pyproject.toml` config — deferred.
- **#2019** Memory with `--max-decode-depth` — base64 recursive decode.
- **#2010** Can't scan compressed files with unknown extension — gzip/decompress.
- **#2000** Decoding skips Unicode — base64 decoder.
- **#1708** Base64-decoded findings color — base64 decode.
- **#1732** `max-decode-depth` in config — base64 decode.
- **#1647, #1933** K8s multi-line secrets — base64 decode.
- **#1315** Scanning previous commits — git history.
- **#1310** `--depth 1` wrong commit IDs — git history.
- **#1316** gitconfig breaks commit info — git history.
- **#1305** git 1.8.3.1 `-C` support — git history.
- **#1287** NoGit fingerprint — git history.
- **#1206** `protect` external diff tool — git history.
- **#1381** `gitleaks --amend` — git history.
- **#1338** gitdiff parser hang — git history.
- **#1128** Secrets in deletions — git history.
- **#1028** Secrets during merge — git history.
- **#1293** `.gitleaksignore` for bare repo — git mode.
- **#821** Pre-receive hook scanning — git history server-side.
- **#1814** Custom gitconfig — git history.
- **#1981** Git errors ignored — git history.
- **#1923** Configs from git refs — partial git history.

---

## Top recommendations

1. **#1456 + #1013 — Per-rule checksum validators + opt-in live `--validate` mode.** Biggest differentiator vs. stock gitleaks. AWS/Stripe/GH PAT structural validators cut FPs cheaply; opt-in live validation is the major-differentiator follow-up. M + L.
2. **#1541 — `--scan-binary` opt-in.** Skip-by-default is done; a flag to force binary scanning completes the pair. S.

Everything else actionable in this round shipped. Remaining buckets 3/4/6 are medium-value polish, auto-sync detection rules, and the deferred roadmap (git-history / base64-decode / `pyproject.toml`).
