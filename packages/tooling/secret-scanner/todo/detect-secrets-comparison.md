# detect-secrets vs. Visulima Secret Scanner — Comparative Analysis

**Date:** 2026-04-16
**detect-secrets reference:** `master` @ `5e14193` (tag `v1.5.0`, Yelp, Apache-2.0), cloned at `/tmp/detect-secrets-analysis/detect-secrets`
**Visulima reference:** `packages/tooling/secret-scanner` + `packages/tooling/vis/src/commands/secrets.ts`

## Executive Summary

- detect-secrets is a Python engine with an **unusual architecture for this category**: it is not a rules file read at runtime. It is a **plugin + filter + transformer framework** where each detector is a Python class, each false-positive heuristic is a standalone function, and parseable file formats (YAML/INI) are pre-transformed to single-line "line proxies" so that detectors can see `key: value` together. We scan files with 222 gitleaks-shaped regex rules; they scan with **25 Python plugins** (23 `RegexBasedDetector` + `KeywordDetector` + `Base64/HexHighEntropyString`) layered with **13 filter functions**.
- Their ruleset is **tiny on paper** (~25 detectors) but **deep per-detector** — several plugins do post-processing the way kingfisher does (`AWSKeyDetector.verify` reaches into the surrounding `CodeSnippet` to find the matching AKID+secret pair, `JwtTokenDetector.is_formally_valid` base64-decodes and JSON-parses the token halves). Our per-rule pipeline is regex → entropy → allowlist — structurally shallower.
- detect-secrets is **audit-first, prevention-second**: the primary CLI surface is `scan` (seed the baseline) + `audit` (interactively label each finding true/false) + `detect-secrets-hook` (block commits that introduce _new_ findings vs. the baseline). `--only-verified`, `--only-allowlisted`, `audit --diff`, `audit --report`, `audit --stats` all exist to build a false-positive/true-positive ground truth. We ship the prevention half cleanly (baseline diff, staged/since/affected); we don't have the audit half at all.
- Their standout technical ideas worth stealing (ranked):
    1. **Dependency-injected filters** — filter functions declare which of `{filename, line, secret, plugin, context}` they need; the engine only calls filters whose parameter set is satisfiable at that stage. Enables user-authored filters that are pure, testable functions.
    2. **Transformer layer** — parses YAML/INI into `key: "value"` "line proxies" before detection so multi-line block scalars and `[section] key = value` syntax become first-class input for any detector.
    3. **Versioned baselines with sequential upgrade modules** — their `v0_12.py` / `v1_0.py` / `v1_1.py` modules migrate user baselines on load. We have no migration story.
    4. **Per-secret heuristic suite** — `is_sequential_string`, `is_potential_uuid`, `is_likely_id_string`, `is_indirect_reference`, `is_lock_file`, `is_swagger_file`. Most of these we don't have.
    5. **`pragma: allowlist secret` + `pragma: allowlist nextline secret`** directive — cleanly namespaced, language-agnostic (# / // / /\* \*/ / ' / -- / <!-- -->), and covers the common block-scalar case. Kingfisher and gitleaks don't support nextline suppression.
    6. **Multi-factor secret verification via `CodeSnippet`** — the AWS detector pulls the 5-line window around the AKID match and regex-scans it for the secret-access-key, then signs an STS request. Offline + online path in one.
    7. **Slim-baseline mode** — omit line numbers + `generated_at` to keep baselines diff-friendly. We keep line numbers in the fingerprint, so a shifted line rewrites the baseline.
- Where we are already **structurally ahead**:
    - **Scale**: 1,047 rules out-of-the-box (222 gitleaks + 825 Kingfisher) vs. 25 plugins; gitleaks-compatible rule format so the ruleset grows at its pace, not ours.
    - **Speed**: Rust NAPI + rayon + aho-corasick prefilter + mmap on large files vs. Python + `mp.Pool` with no prefilter.
    - **Walker**: `ignore` crate with `.gitignore`/`.ignore`/global excludes vs. `git ls-files` shell-out (and `--all-files` fallback walk). Theirs silently fails outside a repo.
    - **Suppression**: block-form `allow-start` / `allow-end` covers multi-line literals; detect-secrets only does same-line + previous-line (good for YAML, weak for PEM).
    - **Config formats**: TOML/JSON/YAML/TS/JS/MJS/CJS via c12 vs. baseline-only JSON with `plugins_used` / `filters_used` arrays.
    - **Monorepo integration**: `vis secrets --staged / --since / --affected` against Node/pnpm workflows.
- Biggest gaps worth closing (ranked): **pragma-style suppression + previous-line check** (S), **heuristic filter suite** (S–M), **baseline migrator** (M), **dependency-injected filter interface** (M), **`--string` adhoc scan + stdin** (S), **YAML/INI transformer** (M–L), **`audit` workflow or at least baseline labels** (L).

---

## detect-secrets Overview (source-verified)

### Stack

- Python ≥3.7, Apache-2.0. Two console entry points: `detect-secrets` (main) and `detect-secrets-hook` (pre-commit). Hard deps `pyyaml` + `requests`; optional `pyahocorasick` (wordlist filter) and `gibberish-detector` (ML filter). Optional `unidiff` for `scan_diff`. No compiled extensions (`setup.py:32-49`).
- 27 plugin files (`detect_secrets/plugins/`, 1 `base.py` + 1 `__init__.py` → **25 concrete detectors**), 7 filter modules, 3 transformer modules, 8 audit modules. Total ~5,764 LOC across `detect_secrets/` (vs. our 1,054 LOC Rust + 355 LOC TS wrapper — same order).
- Global state lives in `Settings` (`detect_secrets/settings.py:126`) — a lru-cached singleton with `configure_plugins` / `configure_filters`, `default_settings()` context manager, and `transient_settings(config)` for per-invocation overrides. `cache_bust()` reaches into every registered filter module via `importlib` to clear their `lru_cache` decorators.

### Scan pipeline — `detect_secrets/core/scan.py` (441 LOC)

- `get_files_to_scan` first tries `git ls-files` on any directory argument (`util/git.py:21`), falls back to `os.walk` only with `--all-files`. Outside a git repo with no `--all-files`, you get **zero files** — a real gotcha.
- `scan_file` opens the file in text mode, passes the handle to `get_transformed_file`, then iterates lines. **If any secret is found in the transformed stream, the eager pass is skipped** — there's a short-circuit at the top of `scan.py:158-163`. The eager pass is only used to catch INI-shaped files without an `.ini` extension.
- For each line: (1) `_is_filtered_out(required_filter_parameters=['line'], …)` runs all line-aware filters; (2) every active plugin runs `analyze_line`; (3) the plugin's result list is filtered again with `required_filter_parameters=['secret']`.
- **Iteration order is lines × plugins**, not plugins × lines. This means a `line`-only filter short-circuits all plugins on that line. Our order is candidate-rules-per-file then whole-file regex scan — different model, different profile.

### Plugins — `detect_secrets/plugins/` (25 detectors)

- **`HighEntropyStringsPlugin`** (`high_entropy_strings.py`) — base for `Base64HighEntropyString` (charset `A-Za-z0-9+/\-_=`, limit 4.5) and `HexHighEntropyString` (charset `0-9a-fA-F`, limit 3.0 with a custom digit-only downshift `entropy -= 1.2 / log2(len)`).
    - Crucially: it only matches **quoted strings** (regex `([\'"])([CHARSET]+)(\1)`) — `'long string'` or `"long string"`, not bare tokens. That's a smaller recall than our entropy-applied-to-match model, but sharply reduces false positives in prose.
    - Adhoc mode (`--string "..."`) falls back to a non-quoted regex so users can spot-check.
- **`KeywordDetector`** (`plugins/keyword.py`) — the most complex detector. It builds a denylist `(api_?key|auth_?key|…|password|passwd|pwd|secret|contraseña|contrasena)`, affixes wildcard chars before/after the keyword, and pairs it with **per-filetype regex groups**: `CONFIG_DENYLIST_REGEX_TO_GROUP` for yaml/toml/ini/properties, `GOLANG_DENYLIST_REGEX_TO_GROUP` for `.go`, `COMMON_C_DENYLIST_REGEX_TO_GROUP` for `.c`/`.m`/`.cs`, `C_PLUS_PLUS_REGEX_TO_GROUP` for `.cpp`, `QUOTES_REQUIRED_DENYLIST_REGEX_TO_GROUP` for Java/JS/Python/Swift/Terraform and CLS. **Filetype is determined by extension only** (`util/filetype.py`, 18 enum cases, no shebang / content sniffing).
    - The equivalent on our side is gitleaks's `generic-api-key` plus our FP patches — a single rule, not filetype-aware.
- **`AWSKeyDetector`** (`plugins/aws.py`) — two regexes: `(A3T[A-Z0-9]|ABIA|ACCA|AKIA|ASIA)[0-9A-Z]{16}` for AKIDs, plus a secondary keyword-guided regex for the 40-char secret. **`verify()` is non-trivial**: given an AKID, it scans the surrounding `CodeSnippet` for a 40-char `[A-Za-z0-9/+=]{40}` token, then signs an STS `GetCallerIdentity` request with `hmac.sha256`, posts to `sts.amazonaws.com`, and treats 403 as `VERIFIED_FALSE`. No boto3 dep.
- **`JwtTokenDetector`** — regex `eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*?` plus `is_formally_valid`: base64-decode each of the three parts with padding fixup, `json.loads` the first two. Rejects anything where the first two segments aren't valid JSON. **Our JWT rule has no formal validation.**
- **`PrivateKeyDetector`** — 8 static regexes for PEM headers: `BEGIN {DSA,EC,OPENSSH,PGP,PRIVATE,RSA,SSH2 ENCRYPTED} PRIVATE KEY`, `PuTTY-User-Key-File-2`. Same as our gitleaks rule.
- **`GitHubTokenDetector`** — `(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36}`. No `github_pat_` prefix (2022+) and no fine-grained-token variant. **We detect both.**
- Other detectors (typically 10–50 LOC each): Artifactory, AzureStorageKey, BasicAuth, Cloudant, DiscordBotToken, GitLabToken, IbmCloudIam, IbmCosHmac, IPPublic (`plugins/ip_public.py`), Mailchimp, NPM, OpenAI, PypiToken, SendGrid, Slack, Softlayer, SquareOAuth, Stripe, TelegramBotToken, Twilio.
- **`RegexBasedDetector.build_assignment_regex`** (static utility) — composes `<prefix>(-|_|)<secret_keyword> (=|:|:=|=>| +|::) <secret_regex>` with optional quotes and square brackets. Used by IbmCloudIam, IbmCosHmac, Softlayer.

### Filters — `detect_secrets/filters/` (13 named filter functions + dependency-injection engine)

- The **dependency-injection kernel** (`util/inject.py`, 80 LOC) is the key abstraction. Each filter function declares its signature; `call_function_with_arguments(filter_fn, filename=…, line=…, secret=…, plugin=…, context=…)` inspects `func.__code__.co_varnames` and only passes the kwargs the function can accept. Functions are bucketed by which variable-set they require, so filters that need `secret` run after detection, filters that need only `filename` run before.
- Built-in filters (declared in `settings.Settings.__init__`, 10 filters enabled by default, Apache-2.0):
    - `filters.allowlist.is_line_allowlisted` — the pragma engine. Checks both the current line and `context.previous_line` for `pragma: allowlist secret` and `pragma: allowlist nextline secret`, across 6 comment syntaxes (`#`, `//`, `/* */`, `'`, `--`, `<!-- -->`). YAML bypass: for `.yaml` only, the `#` form is enforced (no false match in `// a string`). Cache: `lru_cache` on comment-tuple × nextline.
    - `filters.common.is_invalid_file` — `not os.path.isfile(filename)`. Handles symlinks pointing outside repo.
    - `filters.common.is_baseline_file` — skip the baseline itself (configured from `Settings`).
    - `filters.common.is_ignored_due_to_verification_policies` — wraps `plugin.verify(secret, context)` and compares to the configured `min_level`. Powers `--no-verify` / `--only-verified`.
    - `filters.heuristic.is_sequential_string` — uppercases the secret, checks if it's a substring of several precomputed charset sequences (base64, hex, alphanumeric, ASCII). Drops `abcdefgh`, `12345678`, `=/=/=/`.
    - `filters.heuristic.is_potential_uuid` — regex `[a-f0-9]{8}-[a-f0-9]{4}-…` (case-insensitive). Drops UUIDs.
    - `filters.heuristic.is_likely_id_string` — inspects the _line_ for `id` / `myid` / `userid` / `_id` (with optional `s`) immediately before the secret offset. Suppresses `user_id = "…"`.
    - `filters.heuristic.is_non_text_file` — 38-entry extension allowlist (.7z, .bin, .bmp, .class, .css, .dmg, .doc, .eot, .exe, .gif, .gz, .ico, .iml, .ipr, .iws, .jar, .jpg, .jpeg, .lock, .map, .mo, .pdf, .png, .prefs, .psd, .rar, .realm, .s7z, .sum, .svg, .tar, .tif, .tiff, .ttf, .webp, .woff, .xls, .xlsx, .zip). Our walker skips binaries by null-byte sniff; this is a complementary fast path.
    - `filters.heuristic.is_templated_secret` — drop values shaped like `{secret}`, `<secret>`, `${secret}`.
    - `filters.heuristic.is_prefixed_with_dollar_sign` — drop values starting with `$` (PowerShell-style variable ref). Known to increase false negatives and off by default in some setups.
    - `filters.heuristic.is_indirect_reference` — regex for `foo = get_secret_key()` or `x = request.headers['apikey']`. 1000-char line length cap to avoid catastrophic backtracking. **Specifically guards `KeywordDetector`** — without this, every Python code path touching a "secret" variable would fire.
    - `filters.heuristic.is_lock_file` — 12-entry allowlist (Brewfile.lock.json, Cartfile.resolved, composer.lock, Gemfile.lock, Package.resolved, package-lock.json, Podfile.lock, yarn.lock, Pipfile.lock, poetry.lock, Cargo.lock, packages.lock.json). **We don't have this.**
    - `filters.heuristic.is_not_alphanumeric_string` — drop `*****`, `------`, `////`.
    - `filters.heuristic.is_swagger_file` — regex `.*swagger.*` on the filename. Drops swagger-ui docs.
    - `filters.regex.{should_exclude_line, should_exclude_file, should_exclude_secret}` — CLI `--exclude-lines` / `--exclude-files` / `--exclude-secrets`, user-supplied regex.
    - `filters.wordlist.should_exclude_secret` — user-supplied wordlist file, loaded into a pyahocorasick `Automaton` at initialize time. Used for org-specific known-dummy tokens like `AKIAIOSFODNN7EXAMPLE`.
    - `filters.gibberish.should_exclude_secret` — optional. Wraps `gibberish-detector` Markov model (ships with `rfc.model`, trained on RFC text). Default threshold `3.7`. **Drops secrets that look like real words.** Not turned on by default.
- User filters via `--filter` accept `dotted.module.path::function_name` or `file:///abs/path.py::function_name`. The dotted form is auto-registered via `importlib.import_module`; the `file://` form goes through `util/importlib.import_file_as_module`.

### Transformers — `detect_secrets/transformers/` (3 active + 1 base, 647 LOC)

- `transformers/base.py` — `BaseTransformer` declares `should_parse_file(filename)` + `parse_file(file)` + `is_eager: bool`. `get_transformed_file(file, use_eager_transformers=False)` picks the first matching non-eager transformer, falls back to eager if the first pass returned no lines.
- **`YAMLTransformer`** (`transformers/yaml.py`, 352 LOC) — the crown jewel. It overrides `pyyaml.SafeLoader.compose_node` to tag every scalar node with its `__line__`, walks the parsed document, and emits a synthetic `<key>: "<value>"<comment>` line per scalar. Multi-line block scalars collapse into a single line proxy:
    ```yaml
    "token": | # original
        gX69YO4CvBsVjzAwYxdG
        yDd30t5+9ez31gKATtj4
    ```
    becomes
    ```yaml
    "token": "gX69YO4CvBsVjzAwYxdGyDd30t5+9ez31gKATtj4"
    ```
    on line 1. Binary YAML values (`!!binary`) are re-base64-encoded for consistent entropy scanning. Quotes inside values are escaped. Inline-flow `{key: value, key2: value2}` gets `_parse_flow_mapping_key_shim` special-casing for line-number fidelity.
- **`ConfigFileTransformer` + `EagerConfigFileTransformer`** (`transformers/config.py`, 243 LOC) — uses `configparser` for `.ini`-shaped content, emits `key = "value"` per item. The eager variant adds `[DEFAULT]` headers so files without sections (`.env`-shaped) still parse. `_is_allowlist_nextline_secret_comment` preserves pragma comments through the transform.
- The reason transformers exist: `KeywordDetector` and `HighEntropyStringsPlugin` both need `key_name: "value"` on a single line. Without transformers, multi-line YAML block scalars and INI `[section] key=value` split across lines are invisible. Our equivalent: file contents are scanned as-is; we rely on `generic-api-key` to pick up `<key> = <value>` forms on whichever line has the assignment.

### Baseline — `detect_secrets/core/baseline.py` (147 LOC) + `core/secrets_collection.py`

- JSON format (`baseline.py:67`):
    ```json
    {
      "version": "1.5.0",
      "plugins_used": [{"name": "Base64HighEntropyString", "limit": 4.5}, …],
      "filters_used": [{"path": "detect_secrets.filters.heuristic.is_potential_uuid"}, …],
      "generated_at": "2020-11-13T19:05:03Z",
      "results": {
        "test_data/config.yaml": [
          {
            "type": "Base64 High Entropy String",
            "filename": "test_data/config.yaml",
            "hashed_secret": "bc9160bc0ff062e1b2d21d2e59f6ebaba104f051",
            "is_verified": false,
            "line_number": 5,
            "is_secret": true
          }
        ]
      }
    }
    ```
- **Fingerprint is `{filename, sha1(secret), type}`** (`potential_secret.py:54`). `line_number` is **not** part of identity — moved lines don't duplicate entries. Same secret in two files = two entries. Same secret by two plugins = two entries.
- `--slim` mode pops `line_number` + `generated_at` from the output for minimal diffs. Trades off the `audit` story (audit needs line numbers to re-derive the raw secret from disk).
- **Upgrade chain**: `baseline.upgrade()` walks `core/upgrades/v0_12.py`, `v1_0.py`, `v1_1.py` in order, applying each step whose affected version is > the current baseline version. `v1_1._add_new_default_filters` extends the baseline's `filters_used` with the three filters added in that release (`is_lock_file`, `is_not_alphanumeric_string`, `is_swagger_file`). This is how they do migrations: one module per semver, idempotent, filter-list aware.
- `SecretsCollection` (`core/secrets_collection.py`, 318 LOC) — the in-memory store. Implements `merge()` (preserve labels from old baseline onto new scan), `trim()` (intersection-with-left-join to drop entries for deleted files but preserve un-rescanned files), `__sub__` (set diff). The detection fingerprint enables O(1) lookup via dict-of-set.

### Audit — `detect_secrets/audit/` (8 files, 889 LOC)

- `audit.py` — interactive TTY workflow. For each unlabelled secret, clears the screen, prints a 5-line code snippet with the secret highlighted, asks `(y)es, (n)o, (s)kip, (q)uit, (b)ack`. `BidirectionalIterator` (`audit/iterator.py`) lets the user step back to correct mistakes. Labelled secrets are saved into `is_secret: true|false` in the baseline.
- `compare.py` — `audit --diff old.json new.json`. Merges the two baselines, shows `>> ADDED <<` / `>> REMOVED <<` for each secret, with side-by-side line context. Useful for tuning `--base64-limit`, `--hex-limit`, or filter sets.
- `report.py` — `audit --report --category real-secret|false-positive`. Groups by (secret_hash, filename), joins with the `is_secret` label, emits JSON. Used to hand analysts a to-do list of actually-rotate-this credentials.
- `analytics.py` — `audit --stats`. Precision/recall per-plugin from labelled data. Recall is approximated as `TP / (TP + unknown)` since there's no ground truth for false negatives; the note at `analytics.py:117-144` explains the reasoning. Actionable output for rule authors.

### CLI commands — `detect_secrets/core/usage/` (6 files)

- `scan` — the primary builder. Flags: `--string [STRING]` (adhoc), `--only-allowlisted` (scan only lines with the pragma, verify they're truly not secrets), `--all-files` (walk outside git), `--baseline FILENAME`, `--force-use-all-plugins`, `--slim`, `--list-all-plugins`, `-p PLUGIN`, `--base64-limit`, `--hex-limit`, `--disable-plugin`, `-n`/`--no-verify`, `--only-verified`, `--exclude-lines`, `--exclude-files`, `--exclude-secrets`, `--word-list`, `-f FILTER`, `--disable-filter`.
- `detect-secrets-hook` — separate entry point. Takes filenames, baseline path; exits 1 if new (not-in-baseline) secrets are found; auto-updates the baseline with new line numbers for unchanged secrets.
- `audit` — `filename` + subcommands `--diff`, `--stats`, `--report`.

### Scan-diff — `core/scan.py:169-179`

- `scan_diff(diff: str)` parses unified-diff text via `unidiff` (optional dep), iterates added lines per file, runs the same `_process_line_based_plugins`. `detect-secrets-server` (a separate Yelp project) uses this for server-side scanning of PRs and commits.

---

## Our Scanner Overview (refresher)

- Rust NAPI addon via `napi` v3, distributed through per-platform npm optional-dependencies. JS wrapper (`packages/tooling/secret-scanner/src/index.ts`, 355 LOC) exposes `scan`, `scanFiles`, `scanString`, `listRules`, `inspectRuleset`, `fingerprint`.
- **Ruleset**: 1,047 bundled rules active by default (222 gitleaks MIT + 825 MongoDB Kingfisher Apache-2.0) + 11 opt-in `preset:*` rules (`weak-passwords`, `password-manager`) disabled by default + additive `gitleaks.patches.json` (stopwords + template regexes for FP reduction). TOML-to-JSON build at `scripts/build-rules.mjs`.
- **Detection pipeline** (`native/src/detector.rs`, 363 LOC): `aho-corasick` keyword prefilter marks candidate rules per file → each candidate rule's `fancy-regex` runs on the content → `preRegexReplace` applied first if declared → secret slice extracted via `secret_group` → `shannon()` entropy → inline/block allow-regions → per-rule + global allowlists with `match`/`secret`/`line` targets, OR/AND conditions, and `targetRules` scoping.
- **Walker** (`native/src/walker.rs`): `ignore` crate `WalkBuilder::build_parallel`, respects `.gitignore` / `.ignore` / `.git/info/exclude` / global gitignore, hidden-skip on by default, `walk.excludePatterns` + `walk.excludeFromFiles` hooked through `extra_ignores` + `ignore_files`.
- **Scanning** (`native/src/scanner.rs`): mmap at ≥1 MiB, null-byte sniff in first 8 KiB for binary skip, UTF-8 with lossy fallback via `encoding_rs`.
- **Suppression**: inline `gitleaks:allow` + `secret-scanner:allow`, **block** `allow-start`/`allow-end` (`detector.rs:32-61`), baseline JSON keyed by `file:ruleID:startLine`, per-rule allowlists with `targetRules`.
- **CLI** (`vis secrets`, 394 LOC): `--staged`, `--since`, `--affected`, `--init`, `--list-rules`, `--format text|json|sarif`, `--baseline`, `--update-baseline`, `--replace-baseline`, `--include-rule` / `--exclude-rule` (supports `tag:<name>` selectors, including `tag:preset:*` for opt-in groups), `--exclude` / `--exclude-from`, `--redact`, `--include-hidden`, `--no-gitignore`, `--max-size`, `--concurrency`, `--quiet`, `--verbose`.

---

## Feature Gap Analysis

| Feature                            | detect-secrets                                                                                                              | Visulima                                                             | Gap / Notes                                                                                                     |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Detector count                     | **25** (2 entropy + 22 regex + 1 keyword)                                                                                   | **1,047** rules (222 gitleaks + 825 Kingfisher) + `preset:*` opt-ins | Breadth ours; depth theirs.                                                                                     |
| Detector model                     | Python class `BasePlugin.analyze_line` + `analyze_string`. Per-plugin `verify()` closure.                                   | Declarative gitleaks TOML/JSON → compiled `CompiledRule`             | Theirs allows imperative post-processing (AWS AKID→secret pair, JWT formal validity). We can't do that in JSON. |
| Regex engine                       | Python `re` per-plugin, per-line                                                                                            | `fancy-regex` per-rule, file-level, `aho-corasick` prefilter         | We're ~orders faster on large files; also scan once per file, not per line.                                     |
| Keyword prefilter                  | Per-filetype regex-by-group in `KeywordDetector`                                                                            | Aho-Corasick across all rules                                        | We have a cross-ruleset prefilter; they short-circuit only within one plugin.                                   |
| Entropy                            | Shannon; **only on quoted strings** in default regex                                                                        | Shannon; applied to capture or full match                            | Theirs lower false-positive rate on prose; ours has higher recall.                                              |
| File-format transformers           | **YAML + INI/config + eager config**; collapse block scalars to line proxies                                                | None                                                                 | We miss multi-line YAML secrets. Medium gap.                                                                    |
| Filetype awareness                 | Extension → `FileType` enum → `KeywordDetector` picks regex group                                                           | None (single rule applied everywhere)                                | Minor — gitleaks's `generic-api-key` covers most of this.                                                       |
| Heuristic filters (false-positive) | 10 named functions: sequential, uuid, id-string, templated, dollar-sign, indirect-reference, lock-file, swagger, non-alnum… | Partial — placeholder stopwords + template regexes in FP patch file  | We cover some via per-rule stopwords; they cover globally. Medium gap.                                          |
| Filter dependency injection        | Yes — filter declares `{filename,line,secret,plugin,context}` subset, engine only invokes when kwargs match                 | None — hard-coded allowlist pipeline                                 | Clean user-extension story. Medium port.                                                                        |
| Custom plugin loading              | `--plugin file:///abs/path.py::PluginClassName`                                                                             | None                                                                 | We'd need to define a JS plugin interface if we went this way.                                                  |
| Custom filter loading              | `--filter dotted.path::fn` or `file://…::fn`                                                                                | None                                                                 | Same.                                                                                                           |
| Plugin/filter registry in baseline | Yes — `plugins_used` + `filters_used` serialized                                                                            | No — baseline just lists findings                                    | Theirs enables reproducibility + `--force-use-all-plugins` escape hatch.                                        |
| Baseline identity                  | `{filename, sha1(secret), type}` — line-shift tolerant                                                                      | `file:ruleID:startLine` — breaks on line shift                       | **Theirs wins**; matches gitleaks's v8 behavior. Should port.                                                   |
| Baseline migration                 | `v0_12.py` / `v1_0.py` / `v1_1.py` upgrade chain                                                                            | None                                                                 | We have no migration story for baseline format changes. Medium port.                                            |
| Slim baseline                      | Yes (`--slim`)                                                                                                              | No                                                                   | Small win — fewer noise in PR diffs.                                                                            |
| Pragma suppression                 | **`pragma: allowlist secret`** and **`pragma: allowlist nextline secret`** across 6 comment syntaxes                        | `gitleaks:allow` + `secret-scanner:allow` + block `allow-start/-end` | We win on blocks, lose on nextline. Ports cleanly.                                                              |
| Previous-line-aware suppression    | Yes — checks `context.previous_line` for YAML                                                                               | No                                                                   | Missing. Small port.                                                                                            |
| Block suppression                  | No                                                                                                                          | Yes (`allow-start` / `allow-end`)                                    | We win.                                                                                                         |
| Live verification                  | Per-plugin `verify()` using `requests`; policies via `--only-verified` / `--no-verify`                                      | None                                                                 | Same gap as kingfisher analysis. Highest-impact false-positive reduction.                                       |
| Multi-factor verification          | `AWSKeyDetector.verify` reaches into `CodeSnippet` for AKID+secret pair, signs STS request                                  | None                                                                 | Requires (a) context window passed to rule, (b) per-rule code. Larger lift.                                     |
| Adhoc string scan                  | `detect-secrets scan --string "..."`                                                                                        | None (programmatic `scanString` only)                                | Small — add `--string` / `--stdin`.                                                                             |
| Scan diff                          | `SecretsCollection.scan_diff(unified_diff)` with `unidiff`                                                                  | `--staged` + `--since` scan file-level diffs                         | Ours scans whole files but only changed ones; theirs scans _only added lines_. Different axis.                  |
| `--only-allowlisted`               | Yes — verify that pragma-marked lines aren't actually secrets                                                               | No                                                                   | Audit feature, small port.                                                                                      |
| Audit workflow                     | Interactive triage + diff + report + stats                                                                                  | None                                                                 | Large. Belongs in a separate `vis secrets audit` subcommand.                                                    |
| Analytics (precision/recall)       | Yes (`audit --stats`)                                                                                                       | No                                                                   | Requires labelled baseline; pairs with audit.                                                                   |
| Lock-file filter                   | 12-entry allowlist                                                                                                          | No (some lock files skipped via `.gitignore`)                        | Small port.                                                                                                     |
| Swagger filter                     | `.*swagger.*` regex on filename                                                                                             | No                                                                   | Small port.                                                                                                     |
| Gibberish filter (optional)        | Markov ML model via `gibberish-detector`                                                                                    | No                                                                   | Optional; adds a Rust crate + model data; lift medium-high.                                                     |
| Wordlist filter                    | pyahocorasick-powered allowlist file                                                                                        | Per-allowlist `stopwords` array                                      | We can pass a global wordlist via config; `--word-list FILE` would be the CLI shorthand.                        |
| Non-text file skip                 | 38-ext allowlist                                                                                                            | Null-byte sniff in 8 KiB window                                      | Par — two valid strategies.                                                                                     |
| Walker                             | `git ls-files` (default) + `os.walk` (with `--all-files`)                                                                   | `ignore` crate parallel walker                                       | We're stronger outside repos + faster inside.                                                                   |
| Git history scan                   | No (only `scan_diff` for unified diffs)                                                                                     | No (only `--since` file list)                                        | Both lack it. kingfisher is the reference.                                                                      |
| Remote sources                     | No                                                                                                                          | No                                                                   | Par.                                                                                                            |
| Binary output                      | JSON only                                                                                                                   | JSON + SARIF + text                                                  | We win.                                                                                                         |
| Pre-commit hook binary             | `detect-secrets-hook` (separate entry point, auto-updates baseline)                                                         | `vis hook add secrets`                                               | Par — we integrate via husky + cerebro. Different shape.                                                        |
| Config formats                     | JSON baseline only                                                                                                          | TOML/JSON/YAML/TS/JS/MJS/CJS via c12                                 | We win.                                                                                                         |
| Parallelism                        | `multiprocessing.Pool` per-file                                                                                             | `rayon::par_iter` per-file                                           | We win (no IPC cost).                                                                                           |
| Determinism                        | Sorted by `(filename, line_number, hash)` via `SecretsCollection.__iter__`                                                  | Sorted by `(file, start_line, start_column, rule_id)`                | Par.                                                                                                            |
| Licensing                          | Apache-2.0                                                                                                                  | MIT + vendored gitleaks (MIT)                                        | Compatible if we lift code.                                                                                     |

---

## Where detect-secrets is Faster / Better

1. **Quoted-string entropy** — `HighEntropyStringsPlugin` only triggers on `'…'`/`"…"` delimited captures. Massively reduces false positives vs. scanning bare tokens. We already do this for many rules via `secret_group`, but our `generic-api-key` fires on any `[A-Za-z0-9]{32,}` — noisier.
2. **Previous-line allowlist** — `is_line_allowlisted` checks `context.previous_line`, so:
    ```yaml
    "token": | # pragma: allowlist nextline secret
        longbase64stringacross
        multiplelines
    ```
    works. We'd need our block form (`allow-start`/`allow-end`) to cover this today.
3. **Heuristic filter suite runs pre-regex** — `is_not_alphanumeric_string`, `is_lock_file`, `is_swagger_file` etc. execute with low-parameter signatures _before_ the per-line plugin loop, short-circuiting entire files. Our filter equivalents live in per-rule allowlists and run inside the hot path.
4. **Filetype-aware keyword regex** — `KeywordDetector` uses filetype-specific regex groups so Go's `x := "secret"` is parsed differently from YAML's `x: secret`. Our `generic-api-key` is one regex across all languages and has more false positives on Go/Python/INI specifically.
5. **Secret-hash baseline identity** — stable across line moves. Our `file:ruleID:line` flips on any re-indent.

## Where We're Ahead

- **Throughput** — Rust + aho-corasick prefilter + mmap + rayon vs. Python + no prefilter + `mp.Pool`. Order-of-magnitude on large repos.
- **Rule breadth** — 1,047 (222 gitleaks + 825 Kingfisher) vs. 25 detectors. We pick up Kubernetes secrets, Slack webhooks, Datadog, New Relic, Snyk, Square, Plaid, Dropbox, npm legacy, PyPI legacy, etc. out of the box.
- **Walker correctness** — we work outside a git repo (detect-secrets silently scans nothing without `--all-files`), honor `.gitignore`/`.ignore`/global excludes natively, have `--exclude` / `--exclude-from`.
- **Block suppression** — PEM key or multi-line base64 blob marked with `allow-start`/`allow-end`. They only do line + nextline.
- **Deterministic column math** — 1-based codepoint columns for LSP-clean findings; they only emit line numbers.
- **Output formats** — SARIF out of the box (fed to GitHub code-scanning); they emit JSON only.
- **Monorepo ergonomics** — `--affected` / `--since` / `--staged`, per-project configs via c12, `vis hook add secrets`.
- **Pre-regex replacement** — per-rule `preRegexReplace` array normalizes content before detection (e.g. strip template interpolations). They have no equivalent.
- **Rule priority + dedup** — overlapping findings collapse to the higher-priority rule. They emit every plugin's finding separately (same secret detected by 3 plugins = 3 entries).
- **Rule filtering** — `--include-rule` / `--exclude-rule` (ours) vs. `--disable-plugin` only (theirs). Same idea, we support allowlist direction too.

---

## Recommendations (prioritized)

Effort: **S** = <1 day, **M** = 1–3 days, **L** = 1–2 weeks. Impact relative to current scanner.

### Quick wins (S)

1. **Adopt `pragma: allowlist secret` + `pragma: allowlist nextline secret`** as a third marker family, alongside `gitleaks:allow` and `secret-scanner:allow`. Same byte-level scan as `has_allow_comment` (`native/src/detector.rs:221-229`). Add `pragma: allowlist nextline secret` on the previous line via `find_allow_regions`-style logic that scans N bytes backward from the match. File: `native/src/detector.rs`. Impact: compat with detect-secrets users migrating over + covers the YAML block-scalar use case without needing transformers.
2. **Port heuristic filters as per-rule stopwords in `gitleaks.patches.toml`** — specifically `is_sequential_string`, `is_potential_uuid`, `is_indirect_reference`, `is_not_alphanumeric_string`. `is_potential_uuid` and `is_not_alphanumeric_string` are simple regex additions to the `generic-api-key` allowlist. `is_sequential_string` is a character-set intersection check — cheapest as a Rust filter hardcoded in `detector.rs`. Reference: `detect_secrets/filters/heuristic.py:12-225`.
3. **`is_lock_file` filter** — drop findings in `{Brewfile.lock.json, Cartfile.resolved, composer.lock, Gemfile.lock, Package.resolved, package-lock.json, Podfile.lock, yarn.lock, Pipfile.lock, poetry.lock, Cargo.lock, packages.lock.json}`. Add as `walk.excludePatterns` defaults or as a hard-coded post-walk filter. File: `native/src/walker.rs` or `src/index.ts`. Impact: immediate FP reduction on Node/Ruby/Python repos.
4. **`is_swagger_file` filter** — `.*swagger.*` regex on filenames. Same placement as above.
5. **`--string <value>`** adhoc scan and **`--stdin`** input — forward to `scanString` (which already exists programmatically). File: `packages/tooling/vis/src/commands/secrets.ts`. Impact: editor plugin + shell-pipe unlocks, demo-friendly.
6. **`JwtTokenDetector.is_formally_valid`-style validator for our JWT rule** — decode base64url parts, `JSON.parse` the first two. Runs in JS wrapper (we already have the finding in Node-land before SARIF emit). Drops most `eyJ…` hits that aren't actual JWTs. File: `src/index.ts` post-scan step or new `native/src/detector.rs` helper. Impact: JWT rule precision.

### Medium investments (M)

7. **Baseline v2 with secret-hash fingerprint**. Add `xxh3_64` of the normalized secret as an optional `secretHash` field in the baseline JSON. Fingerprint becomes `{file, secretHash, ruleId}` — line-shift tolerant. Keep backwards compat: read the old form, write the new form. Reference: detect-secrets `PotentialSecret.hash_secret` (`potential_secret.py:70`). Kingfisher's analysis already recommends this; detect-secrets is a second, older data point in favour. File: `src/index.ts` + baseline format spec.
8. **Baseline upgrade chain.** When we change format, ship a `upgrades/v<major>_<minor>.ts` module that `load()` runs sequentially. Reference: `core/baseline.py:115-146` + `core/upgrades/__init__.py`. Our current code does nothing on format bump — users hit a parse error and start over. File: `packages/tooling/secret-scanner/src/baseline-migrate.ts` (new).
9. **Dependency-injected filter interface.** Define a TS interface `SecretFilter = (args: { filename?, line?, secret?, rule?, context? }) => boolean` where each property is optional and the engine only calls filters that accept keys it can supply at that stage. Enables user-contributed filters in `vis.config.ts`. Reference: `detect_secrets/util/inject.py:11-80`. We don't need the full `co_varnames` introspection — JS object-spread + explicit `accepts: string[]` on the filter metadata is enough. File: `src/index.ts` + expose via NAPI post-scan hook or JS-side.
10. **`--only-allowlisted` scan mode.** Invert the allow-region logic: skip everything _except_ regions marked with `allow-start`/`allow-end` or inline markers. Use to audit that your suppressions are actually legitimate. Reference: `detect_secrets/core/scan.py:181-250`. File: `native/src/detector.rs` + new CLI flag in `secrets.ts`.
11. **`is_likely_id_string`** pre-match filter — if the characters preceding the match on the line look like `(^|_)id(s?)[^a-z0-9]`, drop the finding. Drops `user_id = "abc123..."` findings. Reference: `detect_secrets/filters/heuristic.py:64-83`. File: `native/src/detector.rs` as a post-capture check.
12. **`is_indirect_reference`** pre-match filter — if the line looks like `x = fn(...)` or `x = obj[...]`, drop `generic-api-key` findings. Reference: `detect_secrets/filters/heuristic.py:170-200`. Only apply to keyword-style rules to avoid hiding real tokens inside API URLs.
13. **Slim baseline mode** (`--slim`) — emit baseline without line numbers and `generated_at`. Pairs with secret-hash fingerprint from (7). Reference: `baseline.py:76-89`. File: `src/index.ts`.
14. **YAML transformer as optional preset.** Start small: only handle YAML block scalars `|` / `>`. Collapse each multi-line scalar into a single-line proxy before scanning. Reuse `yaml` npm package in the JS wrapper rather than implementing in Rust (performance cost is bounded to files the user opts in). Reference: `detect_secrets/transformers/yaml.py:27-91`. File: `src/transformers/yaml.ts` (new). Impact: catch multi-line YAML secrets without block-suppression workarounds.
15. **Global wordlist filter** (CLI `--word-list <file>`, config `filters.wordlist`). Load into an `aho_corasick::AhoCorasick` and short-circuit any finding whose secret contains a listed word. Today users can express this via per-allowlist `stopwords` but only per-rule, not globally. Reference: `detect_secrets/filters/wordlist.py`. File: `native/src/detector.rs` + config plumbing.

### Larger investments (L)

16. **Live verification framework** — already called out in the Kingfisher analysis. detect-secrets reinforces the pattern: `BasePlugin.verify(secret, context)` + `--only-verified` + exit-code gating. Port the rule-format addition + tokio runner + `SkipMap` cache from the Kingfisher write-up (`todo/kingfisher-comparison.md:245-255`). detect-secrets's `AWSKeyDetector.verify_aws_secret_access_key` is a concrete, dep-free STS signer you can lift directly.
17. **Multi-factor rule support.** Two flavours, different lifts:
    - **Same-line pairing** (ours: extend `secret_group` to accept multiple named groups, e.g. `{ id: 1, secret: 2 }`).
    - **Window pairing** (Kingfisher's `depends_on_rule` + liquid vars, detect-secrets's `CodeSnippet` passed into `verify`). Requires either (a) emitting findings from rule A, collecting them, then running rule B with rule-A's capture as a variable, or (b) passing the 5-line code snippet around the rule-A match into a `verify()` hook. Pair with (16).
18. **Interactive audit workflow (`vis secrets audit`).** Reads baseline, iterates findings, opens each in `$EDITOR` with line highlighted or prints a 5-line snippet + `(y)/(n)/(s)/(b)/(q)` prompt, writes back `is_secret: true|false` labels. Reference: `detect_secrets/audit/audit.py`. Out of scope if we want to stay lean; valuable for enterprise users. **Consider making it a separate package `@visulima/secret-scanner-audit` so the core stays dependency-free.**
19. **Precision/recall analytics** (`vis secrets audit --stats`). Pairs with (18). Compute per-rule TP/FP/unknown from labelled baseline. Actionable for rule tuning. Reference: `detect_secrets/audit/analytics.py:81-152` — the math is six lines.
20. **Audit-baseline diff (`audit --diff old.json new.json`).** Show findings added/removed between two baselines (typically two scan configs). Reference: `detect_secrets/audit/compare.py:42-229`. Useful when adjusting rule sets.
21. **INI/config transformer.** Much smaller surface than YAML, but more FP-prone in practice (.env files, properties, TOML). Python's `configparser` is lenient; we can lift `node-config-ini` or hand-roll a streaming parser. Emit `key = "value"` line proxies with the original line numbers preserved. Reference: `detect_secrets/transformers/config.py:43-68`. File: `src/transformers/config.ts` (new).

### Don't copy

- **Per-plugin Python class architecture.** Our gitleaks-shaped declarative rules give more breadth with far less code; keep that. Reserve "post-processing" code for the live-verification hook added in (16).
- **SHA1 secret hash in fingerprint.** Use `xxh3_64` (already in kingfisher's comparison) or `blake3_256` — SHA1 is fine for this case but the Rust ecosystem has better options with lower binary size.
- **`multiprocessing.Pool` architecture.** Rayon already beats it.
- **`--all-files` escape hatch.** Our walker already handles the non-git case correctly; we don't need a mode flag.
- **Gibberish ML filter.** Nice research prop, practical value is limited (trained on RFCs, misses domain-specific jargon). If we want a similar signal, the Kingfisher approach (strict entropy + structural requirements + validators) is more reliable and already on our roadmap.
- **Interactive audit + report into core.** Ship audit as a sidecar package per (18).

---

## References

- detect-secrets repo: https://github.com/Yelp/detect-secrets
- Pinned commit: `5e14193` (2026-04-02), tag `v1.5.0`
- Core scan pipeline: `/tmp/detect-secrets-analysis/detect-secrets/detect_secrets/core/scan.py`
- Plugins: `/tmp/detect-secrets-analysis/detect-secrets/detect_secrets/plugins/` (27 files)
- Filters: `/tmp/detect-secrets-analysis/detect-secrets/detect_secrets/filters/` (7 modules)
- Transformers: `/tmp/detect-secrets-analysis/detect-secrets/detect_secrets/transformers/` (`base.py`, `config.py`, `yaml.py`)
- Audit: `/tmp/detect-secrets-analysis/detect-secrets/detect_secrets/audit/` (8 files, 889 LOC)
- Baseline format + upgrades: `detect_secrets/core/baseline.py`, `core/upgrades/v{0_12,1_0,1_1}.py`
- Dependency injection: `detect_secrets/util/inject.py` (80 LOC)
- Design doc: `/tmp/detect-secrets-analysis/detect-secrets/docs/design.md`
- Filters doc: `/tmp/detect-secrets-analysis/detect-secrets/docs/filters.md`
- Audit doc: `/tmp/detect-secrets-analysis/detect-secrets/docs/audit.md`
- Our scanner: `packages/tooling/secret-scanner/`
- Our CLI: `packages/tooling/vis/src/commands/secrets.ts`
- Companion analyses: `todo/kingfisher-comparison.md`, `todo/gitleaks-issues-triage.md`
