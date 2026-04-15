# Gitleaks open-issue triage for `@visulima/secret-scanner`

235 open issues from [`gitleaks/gitleaks`](https://github.com/gitleaks/gitleaks/issues?q=is:issue+is:open) triaged against our current feature set. Refreshed 2026-04-16 to reflect the `.gitleaksignore` removal + JSON config migration + gitignore-native support.

**Context** — we've implemented: 222 vendored gitleaks rules, fancy-regex + aho-corasick prefilter, rayon parallelism, mmap, baseline JSON (merge + diff, sole fingerprint store), inline `gitleaks:allow` + block `gitleaks:allow-start`/`-end` suppression, native `.gitignore` respect via the walker, `walk.ignore` + `walk.ignoreFiles` for scanner-specific gitignore-syntax exclusions, `scan()` / `scanFiles()` / `scanString()`, grouped `ScanOptions` (config / walk / rules / output / baseline), `rules.only` / `rules.disable`, `--staged` / `--since` / `--affected`, `--init`, `--list-rules`, SARIF + JSON + text, `vis migrate gitleaks` / `secretlint` / `verify`, `vis hook add secrets`.

**Deferred** — git-history walking, recursive base64/gzip decoding, `pyproject.toml` config discovery.

## Bucket counts

| Bucket                             | Count |
| ---------------------------------- | ----- |
| 1. Already supported               | ~22   |
| 2. High-value to adopt             | ~17   |
| 3. Medium-value to adopt           | 28    |
| 4. New detection rules (auto-sync) | 21    |
| 5. Gitleaks-specific / skip        | ~117  |
| 6. Already deferred                | ~30   |

---

## 1. Already supported

- **#2068** `--report-format gitlab-code-quality` — thin reformat from existing SARIF/JSON renderer.
- **#2060 / #1195** Use `.gitignore` / gitignore-syntax for ignores — walker respects `.gitignore` natively; `walk.ignoreFiles` adds arbitrary `.secretsignore`-style files; `walk.ignore` takes inline gitignore patterns.
- **#1328** Simple example on how to ignore/whitelist a directory — `.gitignore` + `walk.ignoreFiles` + `walk.ignore`.
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

## 2. High-value to adopt (actionable)

| #                                 | Title                                                 | Rationale                                                                                                                         | Effort |
| --------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------ |
| **#1059**                         | Fingerprint should support relative paths             | Stable across cwd; portable baselines. `vis` already writes relative paths into baselines; secret-scanner itself could normalize. | S      |
| **#1054**                         | Findings deduplication                                | Collapse identical findings.                                                                                                      | S      |
| **#1541**                         | Scan binary files (opt-in)                            | `--scan-binary` flag. Skip-by-default already done; this is the opt-in switch.                                                    | S      |
| **#1828**                         | Empty env-var example causes false positive           | Skip empty RHS in generic rules.                                                                                                  | XS     |
| **#1762**                         | generic-api-key FP in `.vue`                          | Vue-aware stopwords.                                                                                                              | S      |
| **#1832, #1830, #1857**           | Entropy includes placeholders / hashicorp FPs         | Improve stopword list, tighten regex.                                                                                             | S–M    |
| **#1675**                         | Warn if rule has no keywords                          | Perf lint for custom rules — we already track `keywords_lower.is_empty()` for always-run rules; expose as a diagnostic.           | XS     |
| **#1846**                         | Bad config causes regex panic                         | Robust compile-error reporting — we already `skipped_rules`; verify panic paths fully covered.                                    | XS     |
| **#1962**                         | Column numbers should count codepoints not bytes      | Correctness fix for editor consumers.                                                                                             | S      |
| **#1424 / #1357**                 | Off-by-one in `startColumn` / `endColumn`             | Verify column math + tests.                                                                                                       | XS     |
| **#1827**                         | Invalid URI in SARIF report                           | Emit `file://` URIs in our SARIF renderer (vis side).                                                                             | XS     |
| **#1858 / #1110**                 | SARIF `level` field + short description               | Populate level + description.                                                                                                     | XS     |
| **#1567**                         | Suppress `generic-api-key` when specific rule matches | Rule priority/dedupe.                                                                                                             | M      |
| **#1997**                         | Rules priority                                        | Explicit `priority` field.                                                                                                        | S      |
| **#1182**                         | Pre-process text before testing                       | Per-rule text-replace hook.                                                                                                       | M      |
| **#1919**                         | `targetRules` in `[[allowLists]]` ignored             | Implement targeted allowlists.                                                                                                    | S      |
| **#1525**                         | Scan password-manager export formats                  | High-value detection.                                                                                                             | M      |
| **#1456**                         | API keys with checksums                               | Checksum validators (AWS, Stripe, GH PAT) → huge FP reduction.                                                                    | M      |
| **#1013**                         | Secret validation feature                             | Live-validate via API ping. Major differentiator.                                                                                 | L      |
| **#1331 / #1833 / #1958 / #1203** | Simple passwords / special chars not detected         | Matches the "low-entropy-api-key" rule pattern users often add. See note below.                                                   | S      |

### Note on #1331 + low-entropy rule snippets

User-submitted custom rule:

```toml
[extend]
useDefault = true

[[rules]]
id = "low-entropy-api-key"
regex = '''(?i)[\w.-]{0,50}?(?:access|auth|(?-i:[Aa]pi|API)|credential|creds|key|passwd|password|secret|token)...'''
entropy = 2.0
keywords = ["access","api","auth","key","credential","creds","passwd","password","secret","token"]
```

**Do we support this?** Mechanically, **yes** — the rule shape is 1:1 with our compiled `Rule` (regex + entropy + keywords + allowlists). The AC prefilter keys on `keywords`, the regex runs per-match, and `entropy = 2.0` gates emission. Everything the rule needs is in `rules.rs`/`detector.rs`.

**Two gotchas:**

1. **TOML config input was removed.** Runtime takes JSON only. Convert once:

    ```bash
    # anywhere you have smol-toml or confbox locally:
    node -e 'import("smol-toml").then(m => process.stdout.write(JSON.stringify(m.parse(require("fs").readFileSync(0, "utf8")))))' < low-entropy.toml > low-entropy.json
    ```

    Then pass `configPath: "./low-entropy.json"` or via `vis.config.ts`:

    ```ts
    secrets: {
        config: {
            path: "./low-entropy.json";
        }
    }
    ```

2. **`[extend] useDefault = true`** in gitleaks means "start from the bundled ruleset". Our runtime doesn't act on `extend` fields, **but** our merger does the same thing automatically: if your config has `rules: [...]` and `config.merge` is not `false`, we merge on top of the bundled 222 rules. Equivalent behavior, different mechanism. If you want to disable bundled rules, set `config.merge: false`.

So the user's rule works today — one conversion step from TOML to JSON. No code change needed.

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

Re-sync the vendored `assets/gitleaks.toml` from upstream to pick these up:

- #1697 SourceGraph tokens
- #1818 `GCPServiceAccount` rule
- #1942 GCP API key (Google Chat variant)
- #1946 Looker client ID + secret
- #1715 SQL Server connection strings
- #1778 Tailscale keys
- #1687 Azure Development Account Key
- #1082 Crypto wallet private keys / seed phrases
- #1228 Cleartext SQL passwords
- #1301 Docker registry credentials
- #1326 `.npmrc` auth detection
- #539 Additional Azure rules
- #1391 JWK private key matching
- #1444 HubSpot Private App Access Tokens / Developer API keys
- #1447 Discord Bot Tokens
- #1467 OpenAI API Key variants
- #1366 LaunchDarkly access-token coverage
- #1147 nuget passwords
- #1114 Commvault rule
- #1034 Exclude encrypted cosign private keys
- #739 Browser cookie database rules

Plus the "generic-api-key" cluster (#1773, #1772, #1052, #1047, #1036, #1564, #908) — fold into our regex tweaks or inherit from upstream.

## 5. Gitleaks-specific / skip

CLI bugs, Go/docker/GH-Action issues, usage questions, and internals that don't apply:

#1464, #1306, #2063, #1999, #2048, #1869, #1624, #2044, #1814, #1727, #1343, #1998, #1993, #1984, #1986, #1985, #1979, #1981, #1277, #1927, #1897, #1285, #1939, #1728, #1932, #1895, #1409, #1913, #1898, #1893, #1866, #1859, #1855, #1839, #1838, #1821, #1785, #1753, #1448, #1723, #1319, #1641, #1308, #1475, #1544, #1588, #1436, #1022, #1637, #1638, #999, #1261, #1438, #821, #1385, #1465, #1437, #1364, #1338, #1365, #1405, #1257, #1080, #1348, #1287, #1049, #1329, #1324, #1323, #1311, #1205, #1263, #1279, #1275, #1210, #1070, #1137, #1127, #1120, #1057, #1089, #1078, #1085, #885, #1067, #1053, #1041, #1051, #949, #988, #911, #833, #827, #829, #811, #752, #764, #2031, #2003, #2017, #1944, plus obsolete `.gitleaksignore`-specific issues (#1870, #1325, #1572, #1668) since the concept no longer exists in our design.

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

1. **#1456 + #1013 — Per-rule checksum validators + opt-in live `--validate` mode.** Biggest differentiator vs. stock gitleaks; AWS/Stripe/GH PAT checksums + structural validators cut FPs cheaply.
2. **#1331 cluster — Ship a curated "low-entropy" rule preset** alongside the bundled gitleaks rules. Users keep asking for weak-password detection; we can ship a named preset (`strict`, `permissive`, `weak-passwords`) via `config.path` pointing at a bundled variant.
3. **#1541 — `--scan-binary` opt-in.** Skip-by-default is done; a flag to force binary scanning completes the pair.
4. **#1827 / #1858 / #1110 — SARIF polish** (file:// URI, `level`, short description). Three XS fixes, ships a more compliant SARIF output for GitHub/GitLab code-scanning integrations.
