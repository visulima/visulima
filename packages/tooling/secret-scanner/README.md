<!-- START_PACKAGE_OG_IMAGE_PLACEHOLDER --><!-- END_PACKAGE_OG_IMAGE_PLACEHOLDER -->

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

- Bundles the default gitleaks ruleset (177+ rules, MIT)
- PCRE-compatible `fancy-regex` engine + Aho–Corasick keyword prefilter
- Parallel file scanning via `rayon`, memory-mapped zero-copy reads for large files
- Respects `.gitignore` / `.ignore` out of the box
- Deterministic output order across runs
- Baseline JSON (fingerprint suppression), inline (`gitleaks:allow`) and block (`gitleaks:allow-start` / `gitleaks:allow-end`) suppression
- Also accepts `secret-scanner:allow` / `-start` / `-end` markers
- Config loading via [`c12`](https://github.com/unjs/c12) — accepts `.toml`, `.json`, `.yaml`, `.ts`, `.js`, `.mjs`, `.cjs` configs on top of the bundled gitleaks ruleset
- Path exclusion via `.gitignore` (respected by the walker) + `extraIgnores` option

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
const skipped = await inspectRuleset({ configPath: "./gitleaks.toml" });

// 6) Gitleaks-compatible fingerprint (`file:ruleID:startLine`)
for (const f of findings) console.log(fingerprint(f));
```

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

- Array of `Finding` objects (same shape `scan()` returns). Pass via `baselinePath`. Findings whose fingerprint (`<file>:<ruleID>:<startLine>`) appears in the baseline are suppressed.
- `disableRules` / `onlyRules` option arrays for rule-id level filtering.
- Use `.gitignore` to exclude paths from scanning (respected by the walker).

### API

```ts
interface ScanOptions {
    /** Pre-parsed config object (gitleaks-compatible shape). */
    config?: GitleaksConfig;
    /** Path to a config file — c12 auto-detects TOML/JSON/YAML/TS/JS. */
    configPath?: string;
    /** Directory to resolve the config from. Defaults to cwd. */
    cwd?: string;
    /** Set false to skip merging the bundled gitleaks ruleset (default: merge). */
    includeBundled?: boolean;

    respectGitignore?: boolean;
    includeHidden?: boolean;
    extraIgnores?: string[];
    maxFileSize?: number;
    redact?: boolean;
    concurrency?: number;
    baselinePath?: string;
    onlyRules?: string[];
    disableRules?: string[];
    warnOnSkippedRules?: boolean;
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
