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

Fast secret and credential scanner for Node.js — a Rust port of the [gitleaks](https://github.com/gitleaks/gitleaks) detection engine, exposed through NAPI.

- Bundles the default gitleaks ruleset (222 rules, MIT) plus 825 rules from MongoDB Kingfisher (Apache-2.0)
- Opt-in rule groups tagged `preset:<name>` — ships `weak-passwords` (low-entropy credentials) and `password-manager` (committed vault exports) disabled by default, enable via `rules.include: ["tag:preset:<name>"]`
- PCRE-compatible `fancy-regex` engine + Aho–Corasick keyword prefilter
- Parallel file scanning via `rayon`, memory-mapped zero-copy reads for large files
- Respects `.gitignore` / `.ignore` out of the box; extra gitignore-syntax filters via `walk.excludePatterns` / `walk.excludeFromFiles`
- Deterministic output order across runs
- Baseline JSON (fingerprint suppression), inline (`gitleaks:allow`) and block (`gitleaks:allow-start` / `gitleaks:allow-end`) suppression
- Also accepts `secret-scanner:allow` / `-start` / `-end` markers
- JSON config at runtime (gitleaks-compatible shape). Author rules in TOML, convert once at build time.

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
import { scan, scanFiles, scanString, listRules, inspectRuleset, fingerprint } from "@visulima/secret-scanner";

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

// 7) Content-hash fingerprint — stable across line shifts in the source file.
//    Hashes `(secret, ruleId, file)`, so edits that move a secret up or down
//    don't invalidate the baseline entry. Legacy line-based baselines
//    (`file:ruleID:startLine`) are still accepted on read.
for (const f of findings) console.log(fingerprint(f));
```

### Ruleset

A single bundled ruleset ships: **1,058 rules** — the union of upstream
gitleaks (MIT, 222 rules), MongoDB Kingfisher (Apache-2.0, 825 rules), and
11 opt-in preset rules tagged `preset:weak-passwords` and
`preset:password-manager` (`defaultEnabled: false` — enable via
`rules.enable: ["tag:preset:<name>"]`). The native detector layers a
`regex::bytes::RegexSet` prefilter + compiled-ruleset cache on top of the
aho-corasick keyword filter, so scan cost stays in the low single-digit
milliseconds per file.

Kingfisher rules carry two extra hooks:

- `patternRequirements` — `minDigits`, `minLength`, and a case-insensitive `ignoreIfContains`
  list that drops documentation placeholders (`EXAMPLE`, `TEST`, `YOUR_KEY_HERE`).
- `confidence` — `"low" | "medium" | "high"`. Filter at load time with
  `config.minConfidence` / `--min-confidence`.

`Finding.source`, `Finding.confidence`, and `Finding.alternateMatches` are populated on
every emitted finding so reporters and baselines can distinguish between overlapping rules.

Kingfisher's `validation:` blocks are consumed by the opt-in HTTP validator
(`config.validate: true` / `--validate`). The validator handles `type: Http`
rules with `StatusMatch` or `WordMatch` response matchers — ~493 of the 510
validation-carrying rules qualify. Other types (`AWS`, `GCP`, `MongoDB`,
`Postgres`, `Jdbc`, `JWT`, `Grpc`, `Raw`, and the few JSON / XML / Header
matchers) populate `finding.validation = "skipped"`. Templates support `{{ TOKEN }}`
plus the filters `downcase`, `upcase`, `b64enc`, `b64dec` — enough to construct
the HTTP request that every StatusMatch/WordMatch-based rule needs.
`depends_on_rule:` blocks are preserved on every rule for future multi-token
validation. Rules with `pattern_requirements.checksum:` (11 upstream) are still
skipped during import — those need crc verification before their loose pattern
is meaningful. See `data/kingfisher.skipped.log`. The upstream reference is
pinned in `scripts/kingfisher.ref`; regenerate with `pnpm run build:rules`.

### Suppression

Three ways — all compatible with gitleaks' formats where they overlap:

**Inline comment** (same line)

```ts
const token = "ghp_..."; // gitleaks:allow
const other = "ghp_..."; # secret-scanner:allow
```

**Block region** (suppresses everything between markers)

```ts
// gitleaks:allow-start
const testFixtures = {
    /* ... */
};
// gitleaks:allow-end
```

**Baseline JSON**

- Array of `Finding` objects (same shape `scan()` returns). Pass via `baseline: "./path.json"`. Findings whose content-hash fingerprint (SHA-256 over `secret + ruleId + file`, truncated to 16 hex chars) matches an entry in the baseline are suppressed. Line-shift tolerant; the legacy `file:ruleID:startLine` format continues to suppress correctly without a migration.
- `rules.include` / `rules.exclude` arrays for rule-id level filtering.
- Use `.gitignore` to exclude paths from scanning (respected by the walker), or `walk.excludePatterns` / `walk.excludeFromFiles` for extra gitignore-syntax filters.

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
        /** Pre-parsed gitleaks-shaped object. Fastest path — zero file IO. */
        inline?: GitleaksConfig;
        /** Path to a JSON file (gitleaks-compatible shape). */
        path?: string;
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
- [gitleaks](https://github.com/gitleaks/gitleaks) — upstream detection engine we vendor the ruleset from.
- [secretlint](https://github.com/secretlint/secretlint) — plugin-based alternative we can migrate users away from.

## Supported Node.js Versions

Libraries in this ecosystem make the best effort to track [Node.js' release schedule](https://github.com/nodejs/release#release-schedule).
Here's [a post on why we think this is important](https://medium.com/the-node-js-collection/maintainers-should-consider-following-node-js-release-schedule-ab08ed4de71a).

## Contributing

If you would like to help take a look at the [list of issues](https://github.com/visulima/visulima/issues) and check our [Contributing](.github/CONTRIBUTING.md) guidelines.

> **Note:** please note that this project is released with a Contributor Code of Conduct. By participating in this project you agree to abide by its terms.

## Credits

- [Daniel Bannert](https://github.com/prisis)
- [All Contributors](https://github.com/visulima/visulima/graphs/contributors)
- The [gitleaks](https://github.com/gitleaks/gitleaks) project (MIT, © 2019 Zachary Rice) — we vendor the default ruleset. See [`LICENSE-GITLEAKS.md`](./LICENSE-GITLEAKS.md).

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
