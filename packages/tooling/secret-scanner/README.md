<!-- START_PACKAGE_OG_IMAGE_PLACEHOLDER -->

<a href="https://www.anolilab.com/open-source" align="center">

  <img src="__assets__/package-og.svg" alt="secret-scanner" />

</a>

<h3 align="center">Fast secret and credential scanner — a Rust port of gitleaks detection, exposed via NAPI</h3>

<!-- END_PACKAGE_OG_IMAGE_PLACEHOLDER -->

<br />

<div align="center">

[![typescript-image][typescript-badge]][typescript-url]
[![mit licence][license-badge]][license]
[![npm downloads][npm-downloads-badge]][npm-downloads]
[![Chat][chat-badge]][chat]
[![PRs Welcome][prs-welcome-badge]][prs-welcome]

</div>

---

<div align="center">
    <p>
        <sup>
            Daniel Bannert's open source work is supported by the community on <a href="https://github.com/sponsors/prisis">GitHub Sponsors</a>
        </sup>
    </p>
</div>

---

Production-grade secret and credential scanner for Node.js. Written in Rust, delivered as a NAPI module, and shipped with **1,058 bundled rules** — the union of [gitleaks](https://github.com/gitleaks/gitleaks)' default ruleset (MIT, 222 rules), MongoDB [Kingfisher](https://github.com/mongodb/kingfisher) (Apache-2.0, 825 rules), and 11 opt-in Visulima detectors. Plug it into pre-commit hooks, CI gates, editor extensions, or library code without shelling out to a Go binary.

### Detection

- **1,058 rules** covering 350+ providers — gitleaks compatibility for established detectors, Kingfisher for breadth, Visulima opt-ins (`preset:weak-passwords`, `preset:password-manager`) for niches the upstreams don't cover.
- **Confidence floors** — drop low/medium-confidence rules with `config.minConfidence`. Rules without a declared confidence resolve to `"low"` so the floor behaves as expected in CI.
- **Pattern requirements & stopword filters** — Kingfisher-style `minLength`, `minDigits`, and `ignoreIfContains` reject documentation placeholders (`EXAMPLE`, `YOUR_KEY_HERE`) before entropy is even computed.
- **Rule priority + dedup** — overlapping matches collapse to the most specific rule; the rest are surfaced on `Finding.alternateMatches`.
- **Source provenance** — every finding carries `source: "gitleaks" | "kingfisher" | "visulima" | <user>` so reporters and baselines can route appropriately.

### Live validation (opt-in)

- **HTTP validators** for ~493 Kingfisher rules — `StatusMatch`, `WordMatch`, `JsonValid`, and `HeaderMatch` matchers run against the provider's API. Liquid-lite templating (`{{ TOKEN }}`, filters `downcase`/`upcase`/`b64enc`/`b64dec`) builds the request.
- **Cross-rule chaining** — `dependsOnRule` pairs related secrets (AWS AKID + secret, OAuth id + secret, 106 rules total) before validation.
- **Offline checks** — JWT formal-validity and CRC32 checksum filters short-circuit before the network is touched.
- **Per-host rate limiting** under a global concurrency cap; `Retry-After` honoured on 429 / 503.
- `config.onlyVerified: true` filters to provider-confirmed leaks for hard CI gating.

### Performance

- **PCRE-capable `fancy-regex`** for lookarounds; falls back to byte-level `regex` when a pattern doesn't need them.
- **Aho-Corasick keyword prefilter** + `regex::bytes::RegexSet` shortlists candidate rules in a single DFA pass.
- **Per-rule lookback windows** (±4 KiB around each keyword hit) keep `captures_iter` off the rest of the file.
- **`rayon` parallel scanning**, memory-mapped zero-copy reads above 1 MiB.
- ~11 ms per 550 KB file with the full ruleset active. Compiled rulesets cached in-process.

### Workflow

- **Respects `.gitignore` / `.ignore`** out of the box; layer extra gitignore-syntax filters via `walk.excludePatterns` / `walk.excludeFromFiles`.
- **Baseline JSON** with content-hash fingerprints (SHA-256 over `secret + ruleId + file`, truncated to 16 hex) — survives line shifts. Legacy `file:rule:line` baselines still suppress on read.
- **Inline + block + next-line suppression** — `gitleaks:allow`, `gitleaks:allow-start` / `-end`, `secret-scanner:` equivalents, plus detect-secrets `pragma: allowlist secret` / `pragma: allowlist nextline secret` for YAML and PEM bodies.
- **Heuristic false-positive suite** — lock-file skip, UUID / sequential / non-alphanumeric drops. All on by default, individually toggleable via `config.heuristics.*`.
- **YAML block-scalar transformer** — opt-in helper (`transformYamlBlockScalars`) that collapses `|` / `>` scalars into single-line proxies before scanning so multi-line secrets stop hiding.
- **Deterministic output** — stable sort on file + line + column + rule id.
- **Codepoint-based column math** for editor / LSP consumers.
- **gitleaks-compatible JSON config** at runtime. Author rules in TOML if you prefer; convert once at build time. No TOML parser in the runtime dep graph.

## Install

```sh
npm install @visulima/secret-scanner
```

```sh
yarn add @visulima/secret-scanner
```

```sh
pnpm add @visulima/secret-scanner
```

The right prebuilt native binary is pulled in automatically via `optionalDependencies`. Supported platforms:

| OS      | Arch  | libc         |
| ------- | ----- | ------------ |
| macOS   | x64   | —            |
| macOS   | arm64 | —            |
| Linux   | x64   | glibc / musl |
| Linux   | arm64 | glibc / musl |
| Windows | x64   | MSVC         |
| Windows | arm64 | MSVC         |

## Usage

```ts
import {
    scan,
    scanFiles,
    scanString,
    listRules,
    inspectRuleset,
    fingerprint,
    transformYamlBlockScalars,
    isLockFile,
    isPotentialUuid,
    isSequentialString,
    isNotAlphanumericString,
} from "@visulima/secret-scanner";

// 1) Scan directories (respects .gitignore)
const findings = await scan([process.cwd()], { redact: true });

// 2) Scan a specific file list (e.g., output of `git diff --name-only`)
const staged = await scanFiles(["src/app.ts", "src/db.ts"]);

// 3) Scan an in-memory buffer
const inline = await scanString('aws_secret = "AKIA..."', "config.env");

// 4) List every bundled rule
const rules = await listRules();
console.log(`${rules.length} rules loaded`);

// 5) Validate a custom config — returns rules that failed to compile
const skipped = await inspectRuleset({ config: { path: "./gitleaks.json" } });

// 6) Enable an opt-in rule bundle additively (weak-passwords / password-manager).
//    `rules.enable` turns them on without restricting output; use `rules.include`
//    instead if you want to see *only* preset findings.
const weak = await scan([process.cwd()], { rules: { enable: ["tag:preset:weak-passwords"] } });

// 7) Only high-confidence rules (drops unlabeled + low/medium — useful in CI).
//    Gitleaks rules have no declared confidence → treated as low → dropped; you'll
//    get a Kingfisher-only subset.
const highOnly = await scan([process.cwd()], { config: { minConfidence: "high" } });

// 8) Live-validate each finding against its provider. Every Kingfisher rule that
//    carries an HTTP `validation:` block (StatusMatch + WordMatch matchers) hits
//    its API; the finding's `validation` field becomes "verified" | "rejected" |
//    "skipped" | "error". `onlyVerified` filters to `"verified"` for CI gating.
//    WARNING: sends candidate secrets to the provider — only enable on owned repos.
const verified = await scan([process.cwd()], { config: { validate: true, onlyVerified: true } });

// 9) Content-hash fingerprint — stable across line shifts in the source file.
//    Hashes `(secret, ruleId, file)`, so edits that move a secret up or down
//    don't invalidate the baseline entry. Legacy line-based baselines
//    (`file:ruleID:startLine`) are still accepted on read.
for (const f of findings) console.log(fingerprint(f));
```

### Ruleset

| Source                 | Rules     | License    | Default state                                                    |
| ---------------------- | --------- | ---------- | ---------------------------------------------------------------- |
| gitleaks               | 222       | MIT        | enabled                                                          |
| MongoDB Kingfisher     | 825       | Apache-2.0 | enabled                                                          |
| Visulima preset bundle | 11        | MIT        | **disabled** — enable with `rules.enable: ["tag:preset:<name>"]` |
| **Total**              | **1,058** |            | 1,047 active by default                                          |

The Kingfisher import is regenerated from the pinned upstream commit in `scripts/kingfisher.ref` via `pnpm run build:rules`. Eleven Kingfisher rules with `pattern_requirements.checksum:` are skipped during import (their loose patterns aren't meaningful without CRC verification — see `data/kingfisher.skipped.log`); their `dependsOnRule` metadata is preserved everywhere else for future multi-token chaining.

The opt-in HTTP validator handles 493 of Kingfisher's 510 validation-carrying rules. Native validators (`AWS`, `GCP`, `MongoDB`, `Postgres`, `Jdbc`, `Grpc`, `Raw`) and a handful of JSON / XML matchers populate `finding.validation = "skipped"` — they belong in plugin packages rather than the core, since each adds a provider SDK for ≤2 rules.

### Suppression

Four markers plus a baseline file — all markers match **case-insensitively** and work regardless of the host-language comment syntax (`#`, `//`, `/* */`, `--`, `<!-- -->`, …) because the scanner looks for the marker text itself, not the delimiters.

**Inline comment** (same line as the secret)

```ts
const token = "ghp_..."; // gitleaks:allow
const other = "ghp_..."; // secret-scanner:allow
const third = "ghp_..."; // pragma: allowlist secret   # detect-secrets compat
```

**Block region** (suppresses everything between markers)

```ts
// gitleaks:allow-start
const testFixtures = {
    /* ... */
};
// gitleaks:allow-end
```

**Previous-line marker** (suppresses a finding on the line immediately below — useful for YAML block scalars and PEM bodies where an inline comment on the secret line isn't possible)

```yaml
# pragma: allowlist nextline secret
token: |
    <multi-line secret body here>
```

**Baseline JSON**

- Array of `Finding` objects (same shape `scan()` returns). Pass via `baseline: "./path.json"`. Findings whose content-hash fingerprint (SHA-256 over `secret + ruleId + file`, truncated to 16 hex chars) matches an entry in the baseline are suppressed. Line-shift tolerant; the legacy `file:ruleID:startLine` format continues to suppress correctly without a migration.
- `rules.include` / `rules.exclude` arrays for rule-id level filtering.
- Use `.gitignore` to exclude paths from scanning (respected by the walker), or `walk.excludePatterns` / `walk.excludeFromFiles` for extra gitignore-syntax filters.

### Heuristic false-positive filters

Four post-detection heuristics run by default on every scan, dropping high-confidence placeholders before findings are returned. Each is individually toggleable via `config.heuristics.<name>: false` — turn one off if you need the raw match set (e.g. scanning a known-bad fixture intentionally containing UUID-shaped tokens).

| Key                     | Default | Drops findings where …                                                                                                                                            |
| ----------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lockFile`              | `true`  | file basename is a known lock file (28 entries: `yarn.lock`, `pnpm-lock.yaml`, `Cargo.lock`, `go.sum`, `flake.lock`, `gradle.lockfile`, `.terraform.lock.hcl`, …) |
| `sequentialString`      | `true`  | the secret is a substring of a standard character sequence or a single repeating character (`abcdefgh`, `12345678`, `AAAAAAAA`)                                   |
| `potentialUuid`         | `true`  | the secret matches the canonical 8-4-4-4-12 UUID shape — almost always an object identifier, not a credential                                                     |
| `notAlphanumericString` | `true`  | the secret contains zero ASCII alphanumerics (`*****`, `------`, `//////`)                                                                                        |

```ts
// Keep UUID-shaped findings (e.g. auditing a system that uses UUIDs as API keys).
const findings = await scan([process.cwd()], {
    config: { heuristics: { potentialUuid: false } },
});
```

The filters are ported from [detect-secrets](https://github.com/Yelp/detect-secrets) for parity with teams migrating over.

### YAML block-scalar transformer (opt-in)

YAML `|` / `>` block scalars hide secrets across multiple lines — a credential written as

```yaml
token: |
    <first half>
    <second half>
```

never appears as a single string in the scanner's view, so detectors that expect a contiguous token miss it. The `transformYamlBlockScalars` helper collapses block scalars into single-line `key: "value"` proxies while preserving line numbers so findings still report against the original file:

```ts
import { readFile } from "node:fs/promises";
import { scanString, transformYamlBlockScalars } from "@visulima/secret-scanner";

const yaml = await readFile("config.yaml", "utf8");
const findings = await scanString(transformYamlBlockScalars(yaml), "config.yaml");
// Findings' startLine / endLine map back to the original file because the
// transformer pads blank lines for every consumed block-scalar body line.
```

Scope: handles `key: |` and `key: >` at any indent level, including quoted keys. Sequence-element scalars (`- |`) and flow mappings are left alone — small hit rate, large edge-case surface.

### API

```ts
interface ScanOptions {
    /** Path to a baseline JSON array of `Finding` objects (suppression list). */
    baseline?: string;
    /** Rayon worker threads. 0 / omit = auto. */
    concurrency?: number;

    config?: {
        /** Layer the user's rules on top of the bundled ruleset. Default: true. */
        extendBundled?: boolean;
        /** Post-detection heuristic filters (detect-secrets parity). All default to `true`. */
        heuristics?: {
            lockFile?: boolean;
            notAlphanumericString?: boolean;
            potentialUuid?: boolean;
            sequentialString?: boolean;
        };
        /** Pre-parsed gitleaks-shaped object. Fastest path — zero file IO. */
        inline?: GitleaksConfig;
        /** Drop rules whose declared `confidence` is below this floor. */
        minConfidence?: "high" | "low" | "medium";
        /** With `validate: true`, keep only `validation === "verified"` findings. */
        onlyVerified?: boolean;
        /** Path to a JSON file (gitleaks-compatible shape). */
        path?: string;
        /** Opt in to HTTP / transport validators. WARNING: sends candidates to the provider. */
        validate?: boolean;
    };

    /** Mask `match` / `secret` strings in every finding. */
    redact?: boolean;

    /**
     * Rule-id filters. Entries are either literal ids or `tag:<name>` selectors.
     * Unknown tags throw so typos surface early.
     */
    rules?: {
        /** Additive: enable opt-in rules (e.g. `tag:preset:weak-passwords`) without restricting output. */
        enable?: string[];
        /** Blacklist: drop findings whose ruleId matches. */
        exclude?: string[];
        /** Whitelist: only emit findings whose ruleId matches. Implies enablement for referenced opt-in rules. */
        include?: string[];
    };

    /** Print diagnostics (skipped rules) to stderr on first run. */
    verbose?: boolean;

    walk?: {
        /** Additional `.gitignore`-shaped files to honor (e.g. `.secretsignore`). */
        excludeFromFiles?: string[];
        /** Gitignore-syntax lines applied on top of `.gitignore`. */
        excludePatterns?: string[];
        /** Respect `.gitignore` / `.ignore`. Default: true. */
        gitignore?: boolean;
        /** Visit dotfiles / hidden entries. Default: false. */
        includeHidden?: boolean;
        /** Skip files larger than this (bytes). Default: 10 MiB. */
        maxFileSize?: number;
    };
}

interface Finding {
    ruleId: string;
    description: string;
    file: string;
    startLine: number;
    endLine: number;
    startColumn: number;
    endColumn: number;
    match: string;
    secret: string;
    entropy: number;
    tags: string[];
}

interface RuleInfo {
    id: string;
    description: string;
    tags: string[];
    keywords: string[];
    entropy?: number;
    hasRegex: boolean;
    hasPathFilter: boolean;
}
interface SkippedRule {
    ruleId: string;
    reason: string;
}

declare function scan(paths: string[], options?: ScanOptions): Promise<Finding[]>;
declare function scanFiles(files: string[], options?: ScanOptions): Promise<Finding[]>;
declare function scanString(content: string, file: string, options?: ScanOptions): Promise<Finding[]>;
declare function listRules(options?: ScanOptions): Promise<RuleInfo[]>;
declare function inspectRuleset(options?: ScanOptions): Promise<SkippedRule[]>;
declare function fingerprint(f: Finding): string;
declare const bundledConfigPath: string;

// Heuristic helpers — the same predicates the pipeline applies. Exported so
// custom pre-filters (editor plugins, CI gates) can reuse the logic.
declare function isLockFile(path: string): boolean;
declare function isSequentialString(secret: string): boolean;
declare function isPotentialUuid(secret: string): boolean;
declare function isNotAlphanumericString(secret: string): boolean;

// Opt-in YAML block-scalar collapser for multi-line secret detection.
declare function transformYamlBlockScalars(content: string): string;
```

### Parity testing vs. upstream gitleaks

`pnpm test:parity` downloads gitleaks' `testdata/` via `git sparse-checkout` into `node_modules/.cache/secret-scanner/` and runs our scanner against it. If the `gitleaks` CLI is on `PATH`, it also runs gitleaks for a side-by-side rule-id coverage diff.

```sh
pnpm test:parity                                     # defaults to master
SECRET_SCANNER_PARITY_REF=v8.30.2 pnpm test:parity   # pin to a tag
```

The test is skipped in normal `pnpm test` runs unless `SECRET_SCANNER_PARITY=1` is set.

## Related

- [`@visulima/vis`](https://visulima.com/packages/vis) — ships `vis secrets`, a friendly CLI built on top of this package, plus `vis migrate gitleaks` / `vis migrate secretlint` migrations.
- [gitleaks](https://github.com/gitleaks/gitleaks) — upstream rule source #1; we vendor the default ruleset and stay config-compatible.
- [MongoDB Kingfisher](https://github.com/mongodb/kingfisher) — upstream rule source #2; we import the catalog plus the validator metadata.
- [secretlint](https://github.com/secretlint/secretlint) — plugin-based alternative; `vis migrate secretlint` ports configs over.

## Supported Node.js Versions

Libraries in this ecosystem make the best effort to track [Node.js' release schedule](https://github.com/nodejs/release#release-schedule).
Here's [a post on why we think this is important](https://medium.com/the-node-js-collection/maintainers-should-consider-following-node-js-release-schedule-ab08ed4de71a).

## Contributing

If you would like to help take a look at the [list of issues](https://github.com/visulima/visulima/issues) and check our [Contributing](.github/CONTRIBUTING.md) guidelines.

> **Note:** please note that this project is released with a Contributor Code of Conduct. By participating in this project you agree to abide by its terms.

## Credits

- [Daniel Bannert](https://github.com/prisis)
- [All Contributors](https://github.com/visulima/visulima/graphs/contributors)
- The [gitleaks](https://github.com/gitleaks/gitleaks) project (MIT, © 2019 Zachary Rice) — we vendor the default ruleset. See [`data/LICENSE-GITLEAKS`](./data/LICENSE-GITLEAKS).
- The [MongoDB Kingfisher](https://github.com/mongodb/kingfisher) project (Apache-2.0, © MongoDB, Inc.) — we import the rule catalog and validator metadata. See [`data/LICENSE-KINGFISHER`](./data/LICENSE-KINGFISHER) and [`data/NOTICE-KINGFISHER`](./data/NOTICE-KINGFISHER).

## Made with ❤️ at Anolilab

This is an open source project and will always remain free to use. If you think it's cool, please star it 🌟. [Anolilab](https://www.anolilab.com/open-source) is a Development and AI Studio. Contact us at [hello@anolilab.com](mailto:hello@anolilab.com) if you need any help with these technologies or just want to say hi!

## License

The visulima secret-scanner is open-sourced software licensed under the [MIT][license]

<!-- badges -->

[license-badge]: https://img.shields.io/npm/l/@visulima/secret-scanner?style=for-the-badge
[license]: https://github.com/visulima/visulima/blob/main/LICENSE
[npm-downloads-badge]: https://img.shields.io/npm/dm/@visulima/secret-scanner?style=for-the-badge
[npm-downloads]: https://www.npmjs.com/package/@visulima/secret-scanner
[prs-welcome-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge
[prs-welcome]: https://github.com/visulima/visulima/blob/main/.github/CONTRIBUTING.md
[chat-badge]: https://img.shields.io/discord/932323359193186354.svg?style=for-the-badge
[chat]: https://discord.gg/TtFJY8xkFK
[typescript-badge]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]: https://www.typescriptlang.org/
