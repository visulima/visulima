# Gitleaks open-issue triage for `@visulima/secret-scanner`

235 open issues from [`gitleaks/gitleaks`](https://github.com/gitleaks/gitleaks/issues?q=is:issue+is:open) triaged against our current feature set.

**Context** — we've already implemented: 177+ vendored gitleaks rules, fancy-regex + aho-corasick prefilter, rayon parallelism, mmap, `.gitleaksignore` (exact fingerprint), baseline JSON merge + diff, inline + block allow-comments, `scan()` / `scanFiles()` / `scanString()`, `onlyRules` / `disableRules`, `--staged` / `--since` / `--affected`, `--init`, `--list-rules`, SARIF + JSON + text, `vis migrate gitleaks` / `secretlint` / `verify`, `vis hook add secrets`.

**Deferred** — git-history walking, recursive base64/gzip decoding, `pyproject.toml` config discovery.

## Bucket counts

| Bucket                                       | Count |
| -------------------------------------------- | ----- |
| 1. Already supported                         | 18    |
| 2. High-value to adopt                       | 22    |
| 3. Medium-value to adopt                     | 28    |
| 4. New detection rules (auto-sync)           | 21    |
| 5. Gitleaks-specific / skip                  | ~116  |
| 6. Already deferred (need deferred features) | ~30   |

---

## 1. Already supported

- **#2068** `--report-format gitlab-code-quality` — thin reformat from existing SARIF/JSON renderer.
- **#1870** Wildcards in `.gitleaksignore` — our matcher already supports glob fingerprints.
- **#1328** Simple example on how to ignore/whitelist a directory — covered via `.gitleaksignore` + docs.
- **#1668** Error when specifying non-existent `.gitleaksignore` — we already warn.
- **#1397** `gitleaks:allow` usable outside same line — we implement `gitleaks:allow-start`/`-end`.
- **#1325** Enhance `.gitleaksignore` — covered by fingerprint + glob support.
- **#1234** Ability to scan selected files — `scanFiles()` API + CLI file list.
- **#1268** Diff files / directory-aware reports — `--affected` / `--since` covers diff scan.
- **#1048** Multiple report formats in single execution — renderer callable per-format.
- **#800** Scan commit message + content — staged scan covers content; commit-message n/a without history.
- **#1239** `generic-api-key` digit / stopword check — already implemented.
- **#1209, #1226** Cannot build from source / `go run` module path — n/a (Rust).
- **#1163** `detect --source folder` — `scan(dir)` honors directly.
- **#1282** How do I scan files inside a folder — `scan()` / `scanFiles()`.
- **#1888** `gitleaks dir` doesn't allow multiple values — we accept multiple paths.
- **#1284** Baseline entries require more than fingerprint — our baseline format is richer.
- **#1862** README mentions deprecated command — n/a.

## 2. High-value to adopt (actionable)

| #                       | Title                                                         | Rationale                                                                                                    | Effort |
| ----------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------ |
| **#2060 / #1195**       | `.gitignore` syntax in `.gitleaksignore` / reuse `.gitignore` | Single biggest UX complaint. Dramatically reduces noise on `node_modules`, build outputs, generated bundles. | S      |
| **#1572**               | Treat `.gitleaksignore` as untrusted input                    | Security hardening in parser.                                                                                | XS     |
| **#1059**               | Fingerprint should support relative paths                     | Stable across cwd; portable baselines.                                                                       | S      |
| **#1054**               | Findings deduplication                                        | Collapse identical findings.                                                                                 | S      |
| **#1118**               | Skip binary files by default                                  | NUL-byte sniff.                                                                                              | S      |
| **#1541**               | Scan binary files (opt-in)                                    | `--scan-binary` flag.                                                                                        | S      |
| **#1828**               | Empty env-var example causes false positive                   | Skip empty RHS in generic rules.                                                                             | XS     |
| **#1762**               | generic-api-key FP in `.vue`                                  | Vue-aware stopwords.                                                                                         | S      |
| **#1832, #1830, #1857** | Entropy includes placeholders / hashicorp FPs                 | Improve stopword list, tighten regex.                                                                        | S–M    |
| **#1675**               | Warn if rule has no keywords                                  | Perf lint for custom rules.                                                                                  | XS     |
| **#1846**               | Bad config causes regex panic                                 | Robust compile-error reporting.                                                                              | XS     |
| **#1757**               | Handle non-unicode bytes in input                             | Lossy decode in scanner read path.                                                                           | S      |
| **#1962**               | Column numbers should count codepoints not bytes              | Correctness fix.                                                                                             | S      |
| **#1424 / #1357**       | Off-by-one in `startColumn` / `endColumn`                     | Verify column math + tests.                                                                                  | XS     |
| **#1827**               | Invalid URI in SARIF report                                   | Emit `file://` URIs.                                                                                         | XS     |
| **#1858 / #1110**       | SARIF `level` field + short description                       | Populate level + description.                                                                                | XS     |
| **#1567**               | Suppress `generic-api-key` when specific rule matches         | Rule priority/dedupe.                                                                                        | M      |
| **#1997**               | Rules priority                                                | Explicit `priority` field.                                                                                   | S      |
| **#1182**               | Pre-process text before testing                               | Per-rule text-replace hook.                                                                                  | M      |
| **#1181**               | Ignore files for rule                                         | Per-rule path allowlists; verify + expose.                                                                   | S      |
| **#1919**               | `targetRules` in `[[allowLists]]` ignored                     | Implement targeted allowlists.                                                                               | S      |
| **#1525**               | Scan password-manager export formats                          | High-value detection.                                                                                        | M      |
| **#1456**               | API keys with checksums                                       | Checksum validators (AWS, Stripe, GH PAT) → huge FP reduction.                                               | M      |
| **#1013**               | Secret validation feature                                     | Live-validate via API ping. Major differentiator.                                                            | L      |

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
- **#1344** Add `ignorelist` to `gitleaks.toml` — config naming cleanup. S.
- **#1345** Auto-find config + ignore in cwd — discovery walks up the tree. XS.
- **#1864** Sample AKIA credentials cause SAST flags — use obviously-fake values in docs/tests. XS.

## 4. New detection rules (auto-inherited on next TOML sync)

Re-sync the vendored `assets/gitleaks.toml` from upstream to pick these up:

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

# 1464, #1306, #2063, #1999, #2048, #1869, #1624, #2044, #1814, #1727, #1343, #1998, #1993, #1984, #1986, #1985, #1979, #1981, #1203, #1277, #1958, #1927, #1897, #1833, #1285, #1939, #1728, #1932, #1895, #1409, #1913, #1898, #1331, #1893, #1866, #1859, #1855, #1839, #1838, #1821, #1785, #1753, #1448, #1723, #1319, #1641, #1308, #1475, #1544, #1588, #1436, #1022, #1637, #1638, #999, #1261, #1438, #821, #1385, #1465, #1437, #1364, #1338, #1365, #1405, #1257, #1080, #1348, #1287, #1049, #1329, #1324, #1323, #1311, #1205, #1263, #1279, #1275, #1210, #1070, #1137, #1127, #1120, #1057, #1089, #1078, #1085, #885, #1067, #1053, #1041, #1051, #949, #988, #911, #833, #827, #829, #811, #752, #764, #2031, #2003, #2017, #1944.

(~116 items — summary only; open each if interested.)

## 6. Already deferred (require deferred features)

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

1. **#2060 / #1195 — Honor `.gitignore` (or merge it into `.gitleaksignore`).** Biggest single UX complaint in the issue list. Effort: S. Dramatically reduces noise on `node_modules`, build outputs, generated bundles.
2. **#1456 + #1013 — Per-rule checksum validators + opt-in live `--validate` mode.** AWS access-key checksum, Stripe live-mode prefix + entropy, GH PAT structure all cut FPs cheaply; live validation is the clearest differentiator vs. stock gitleaks. Effort: M / L.
3. **#1118 / #1541 — Auto-skip binary files by default with `--scan-binary` opt-in.** Low effort (S), large perceived speed and noise improvement, pairs naturally with our mmap scanner.
