## @visulima/vis [1.0.0-alpha.26](https://github.com/visulima/visulima/compare/@visulima/vis@1.0.0-alpha.25...@visulima/vis@1.0.0-alpha.26) (2026-05-29)

### Bug Fixes

* **vis:** isolate git env vars in staged integration tests ([18900a1](https://github.com/visulima/visulima/commit/18900a126bfb16f6d70ab81cbe5248720b03ac40))
* **vis:** run persistent tasks under a PTY in the live TUI ([77b2a26](https://github.com/visulima/visulima/commit/77b2a263b9563f8ee894671f910e013f2c95077a))

### Tests

* **vis:** assert index excludes unstaged hunk on modify ([371063e](https://github.com/visulima/visulima/commit/371063ebc5fb2c4a90a3aa3cb377fdcc3d2d34ea))


### Dependencies

* **@visulima/cerebro:** upgraded to 3.0.0-alpha.29
* **@visulima/pail:** upgraded to 4.0.0-alpha.19

## @visulima/vis [1.0.0-alpha.25](https://github.com/visulima/visulima/compare/@visulima/vis@1.0.0-alpha.24...@visulima/vis@1.0.0-alpha.25) (2026-05-27)

### Features

* **vis:** add GitLab and JUnit audit report formats ([18e8bc2](https://github.com/visulima/visulima/commit/18e8bc204cc5ce2bac8e83a043ede9cf51d57a70))
* **vis:** audit hardening — ca-cert flag, dep-path walker, report parity ([eb187ab](https://github.com/visulima/visulima/commit/eb187ab4e9ee04357d142c438f428b556a68ff79))
* **vis:** auto-update GitHub Actions, Docker, and GitLab CI references ([9a3c767](https://github.com/visulima/visulima/commit/9a3c7679c1aa981eb889250ddd841b6feb213b55))
* **vis:** breaking-change UI + interactive picker for ecosystem updates ([75b7e33](https://github.com/visulima/visulima/commit/75b7e33eb9a460036cf8f8feff5197b1fb2db010))
* **vis:** changelog URLs, docker min-age gate, action advisories, TUI sort ([23d65e1](https://github.com/visulima/visulima/commit/23d65e1f020dd723b900c5d25f9eb384be0bece8))
* **vis:** honor project.json[#name](https://github.com/visulima/visulima/issues/name) as the workspace identity ([4a97c92](https://github.com/visulima/visulima/commit/4a97c9203df1398265196161213f1aa5736ea4c0)), closes [package.json#dependencies](https://github.com/visulima/package.json/issues/dependencies)
* **vis:** migrate command handlers to toolbox.fs and toolbox.process ([c582c74](https://github.com/visulima/visulima/commit/c582c740150a7eab6b34e4eabe68f521471186c1))
* **vis:** nx migrator hardening + smart --affected SHA resolution ([631351e](https://github.com/visulima/visulima/commit/631351ef32b9367a37c6ca0931673f0e08c103a9)), closes [VisConfig#defaultBase](https://github.com/visulima/VisConfig/issues/defaultBase)

### Bug Fixes

* add tabular to dep ([92d578e](https://github.com/visulima/visulima/commit/92d578e7e2ce558f5e8947bd1d9c2b1da879e351))
* added tabular to the excluded packges ([20799d6](https://github.com/visulima/visulima/commit/20799d66f3cf73381b7fd3e7bd8776401eef399f))
* **storage-client:** percent-encode user fields in defaultFingerprint ([7c78a0f](https://github.com/visulima/visulima/commit/7c78a0f9512e2a673b941d80839e9f1e86b7b5d0))
* **task-runner:** resolve workspace .bin binaries in spawned tasks ([69bd30c](https://github.com/visulima/visulima/commit/69bd30c95fb1e70aba1f7c5b4d3d17b8f0465c11))
* **vis:** address coderabbit feedback on ecosystem updates ([#654](https://github.com/visulima/visulima/issues/654)) ([049f0b4](https://github.com/visulima/visulima/commit/049f0b40aa890978b43104cd15f238800d62d981))
* **vis:** address ecosystem-update review findings ([88ac870](https://github.com/visulima/visulima/commit/88ac8703eaab7ad9741aa94a4addf77d618a2464))
* **vis:** bump stale workspace dep versions so Nx links them ([448ce87](https://github.com/visulima/visulima/commit/448ce87dd146bd696fd0cb0b5ad6deabb7ffc9d6))
* **vis:** enhance PATH inside ephemeral service bootstrap config ([30c6364](https://github.com/visulima/visulima/commit/30c6364cceff0d3c48fe5e7e4a996b77a1ed224c))

### Documentation

* **vis:** mention ecosystem updates in README and ci-cd guide ([1577e95](https://github.com/visulima/visulima/commit/1577e95accc4a91a67ece2c7a25ad1a8b26bc784))

### Miscellaneous Chores

* refresh generated license bundles and disposable-domain stats ([a389f38](https://github.com/visulima/visulima/commit/a389f38484788aafa8ba9b698e2dd5805a982d98))
* sorted package.json ([b47c545](https://github.com/visulima/visulima/commit/b47c545591600fdab17d5cd3a3fbc68b61e199da))
* sorted package.json v2 ([70f0116](https://github.com/visulima/visulima/commit/70f01166709d5db1bd8cb309758e86edd4127eb5))
* **vis:** regenerate vis-config.schema.json for defaultBase ([4a847e9](https://github.com/visulima/visulima/commit/4a847e9a7e193880546c295920c29b2c67265a16)), closes [VisConfig#defaultBase](https://github.com/visulima/VisConfig/issues/defaultBase)

### Tests

* **vis:** cover highlight-preservation on sort + symmetric newRef on min-age skip ([5d383c7](https://github.com/visulima/visulima/commit/5d383c70a16c1a3b2243cb3d4503a547036a0d7c))


### Dependencies

* **@visulima/secret-scanner:** upgraded to 1.0.0-alpha.4
* **@visulima/tabular:** upgraded to 4.0.0-alpha.12
* **@visulima/task-runner:** upgraded to 1.0.0-alpha.16
* **@visulima/tui:** upgraded to 1.0.0-alpha.20
* **@visulima/ansi:** upgraded to 4.0.0-alpha.15
* **@visulima/cerebro:** upgraded to 3.0.0-alpha.28
* **@visulima/colorize:** upgraded to 2.0.0-alpha.12
* **@visulima/error:** upgraded to 6.0.0-alpha.30
* **@visulima/find-cache-dir:** upgraded to 3.0.0-alpha.10
* **@visulima/fs:** upgraded to 5.0.0-alpha.28
* **@visulima/interactive-manager:** upgraded to 1.0.0-alpha.3
* **@visulima/package:** upgraded to 5.0.0-alpha.27
* **@visulima/pail:** upgraded to 4.0.0-alpha.18
* **@visulima/path:** upgraded to 3.0.0-alpha.11
* **@visulima/redact:** upgraded to 3.0.0-alpha.12
* **@visulima/source-map:** upgraded to 3.0.0-alpha.10
* **@visulima/spinner:** upgraded to 1.0.0-alpha.2
* **@visulima/string:** upgraded to 3.0.0-alpha.14

## @visulima/vis [1.0.0-alpha.24](https://github.com/visulima/visulima/compare/@visulima/vis@1.0.0-alpha.23...@visulima/vis@1.0.0-alpha.24) (2026-05-26)

### Features

* **vis:** surface peer-dependency hint after install ([4a140b0](https://github.com/visulima/visulima/commit/4a140b0d8e80f3dda82d0af645272e1149867d02))

### Miscellaneous Chores

* **ci-stability:** green CI across vis, native, lint, tests, attw ([#651](https://github.com/visulima/visulima/issues/651)) ([d4eb684](https://github.com/visulima/visulima/commit/d4eb684b5f75c818c9251048c605a0ed54a268e3))
* **repo:** apply eslint --fix and prettier --fix across packages ([#650](https://github.com/visulima/visulima/issues/650)) ([2e26a84](https://github.com/visulima/visulima/commit/2e26a84774f218f21345e9a8ecd68236b6542743)), closes [#620](https://github.com/visulima/visulima/issues/620)
* **repo:** sort package.json keys across all packages ([e1fd9ab](https://github.com/visulima/visulima/commit/e1fd9ab467ef96a98c777da1572ff6a50fcf7e71))

### Tests

* **repo:** add dist runtime + types integration tests ([32ee300](https://github.com/visulima/visulima/commit/32ee300b7184117a0ddf9f9d390f75f8932d5ed9))
* **repo:** cover bin entry points in dist integration suite ([7479ef1](https://github.com/visulima/visulima/commit/7479ef113cf5ccef25692619082afb1b6a0eecab))


### Dependencies

* **@visulima/error:** upgraded to 6.0.0-alpha.28
* **@visulima/tui:** upgraded to 1.0.0-alpha.19
* **@visulima/cerebro:** upgraded to 3.0.0-alpha.27
* **@visulima/fs:** upgraded to 5.0.0-alpha.26
* **@visulima/package:** upgraded to 5.0.0-alpha.25
* **@visulima/pail:** upgraded to 4.0.0-alpha.17

## @visulima/vis [1.0.0-alpha.23](https://github.com/visulima/visulima/compare/@visulima/vis@1.0.0-alpha.22...@visulima/vis@1.0.0-alpha.23) (2026-05-20)

### Features

* **vis:** add dashboard command with browser UI for cache and run metrics ([f94fcd9](https://github.com/visulima/visulima/commit/f94fcd94ef04f74e20ce308769d79cbd21d9fd60))
* **vis:** add HTML graph report ([92865a2](https://github.com/visulima/visulima/commit/92865a2973a36f8c43adaf023ecd68e3859d0c68))
* **vis:** add visx/vx npx-style entry point ([3802695](https://github.com/visulima/visulima/commit/3802695f3a0cf2776aaf706183ed2032324532bd))
* **vis:** rebuild dashboard with Hono SSE + Vite + shadcn/ui ([f9df814](https://github.com/visulima/visulima/commit/f9df814683c6a1c967d8cbe15bee1b13959b5ab7))
* **vis:** redesign audit HTML report + add --explain AI helper ([6b0ab9f](https://github.com/visulima/visulima/commit/6b0ab9ffe36c732a4ac0c05a4ad9453d51fbe89b))
* **vis:** redesign dashboard with Nothing-inspired UI ([7cfc81d](https://github.com/visulima/visulima/commit/7cfc81d8592cdfda0086700363dbeac39650d1d7))

### Bug Fixes

* **ci:** address review findings — injection, perms, defaults, fetch hardening ([0192278](https://github.com/visulima/visulima/commit/0192278b63a0178262c08a3d77fa0e832d085147))
* **vis:** address audit findings on dashboard + visx + defineConfig refactor ([1eb8ae5](https://github.com/visulima/visulima/commit/1eb8ae5820d425780b9f5c05f153b68fe74a8a36))
* **vis:** clean up dashboard audit nits — typos, dead code, redundant calls ([46a5c0e](https://github.com/visulima/visulima/commit/46a5c0ed8116f79c0307d51a1eb7c9d8ae419dde))
* **vis:** harden dashboard server, metrics, and live UI ([be4c6a1](https://github.com/visulima/visulima/commit/be4c6a134410ef9e2b893d57ee6e2c1b163c4b88))
* **vis:** key doctor cache on the resolved npm lockfile ([628a21d](https://github.com/visulima/visulima/commit/628a21d62285d6299fe399409783c297c64f9e1b))
* **vis:** name the actual lockfile in npm pruner messages ([c783683](https://github.com/visulima/visulima/commit/c78368392930c3eafdb6e0c056535217665b2f07))
* **vis:** prune npm-shrinkwrap.json into the Docker context ([ecfb54c](https://github.com/visulima/visulima/commit/ecfb54c7c515a14509c71458468c99c000b07d21))
* **vis:** render task failure block lazily at the consumer ([cb35aa7](https://github.com/visulima/visulima/commit/cb35aa78550408b462e9a1ec2af3eddb65a27b87))

### Miscellaneous Chores

* ignore sample-workspace .vis dirs and refresh license artifact ([0f88438](https://github.com/visulima/visulima/commit/0f884380bcc7b25ac0beec5994256cc5b956a167))
* **vis:** make sample-workspace tasks cacheable ([a1db143](https://github.com/visulima/visulima/commit/a1db143b57a594470b9bf5695c60a0ced18344e3))

### Code Refactoring

* **vis:** extract tryLoadSourceMap helper ([5b06bb6](https://github.com/visulima/visulima/commit/5b06bb69876e4870e75985a75ff22e299c8cf583))
* **vis:** make defineConfig a pure typed-identity ([28f6f3f](https://github.com/visulima/visulima/commit/28f6f3f909a89103b972ca50a502fb6145d87794))

### Tests

* **vis:** align task-store tests with lazy failure rendering ([9ddf5de](https://github.com/visulima/visulima/commit/9ddf5de95a41d89b4c9a33bbb88e777b909b6aee))

### Continuous Integration

* tighten workflow yaml + restore missing publint dep ([b478f9a](https://github.com/visulima/visulima/commit/b478f9a9329d9c7243e694e3f360d385cc34567c))


### Dependencies

* **@visulima/error:** upgraded to 6.0.0-alpha.27
* **@visulima/tui:** upgraded to 1.0.0-alpha.18
* **@visulima/ansi:** upgraded to 4.0.0-alpha.14
* **@visulima/cerebro:** upgraded to 3.0.0-alpha.26
* **@visulima/fs:** upgraded to 5.0.0-alpha.25
* **@visulima/package:** upgraded to 5.0.0-alpha.24

## @visulima/vis [1.0.0-alpha.22](https://github.com/visulima/visulima/compare/@visulima/vis@1.0.0-alpha.21...@visulima/vis@1.0.0-alpha.22) (2026-05-19)

### Features

* **task-runner:** auto-capture outputs for compound build scripts ([e084434](https://github.com/visulima/visulima/commit/e0844344cf184177999a82b708299f08fbfd31ec))
* **task-runner:** per-target hashMode "trace" opt-in ([#643](https://github.com/visulima/visulima/issues/643)) ([32353ff](https://github.com/visulima/visulima/commit/32353ff7a760ae9486e23cc4042fab46a2f2cc11))
* **vis:** add composite s1ngularity supply-chain marshall ([44cdeaf](https://github.com/visulima/visulima/commit/44cdeafb58eefcef061ffaab6822d4628cb06b2c))
* **vis:** add deprecation + package-age marshalls ([5547840](https://github.com/visulima/visulima/commit/5547840b5aef9689f4080c77c44d3884309b0601))
* **vis:** add deps.dev as supply-chain security provider alongside Socket ([7f752d2](https://github.com/visulima/visulima/commit/7f752d250fa3c96d2ec01ca58bddf911586ea949))
* **vis:** add lockfile supply-chain verification ([a8c741d](https://github.com/visulima/visulima/commit/a8c741d80b52b275cde11be188ab22c41a11f5f4))
* **vis:** add migrate verify-graph equivalence verification ([697e2c0](https://github.com/visulima/visulima/commit/697e2c0888c596e4bcee0a12922db76937a29175))
* **vis:** add Snyk security provider ([aba3571](https://github.com/visulima/visulima/commit/aba35710719d1325b311bf80d81a91c91e75aa1f))
* **vis:** add write guard, watchman backend, vcs hints ([5127d79](https://github.com/visulima/visulima/commit/5127d79ad2aa523760517601f71fdf38571ca4d3))
* **vis:** attested keyless-signed remote cache (Sigstore) ([4732610](https://github.com/visulima/visulima/commit/47326103a668ab99fcfc4e21f2c9efeaa5892944))
* **vis:** default inferTargets on with guarded script enrichment ([29cabd1](https://github.com/visulima/visulima/commit/29cabd1763ce915cbfa6aaa85b1c29a020d72b01))
* **vis:** harden bootstrap installers + add lint CI ([49ec0a2](https://github.com/visulima/visulima/commit/49ec0a25e76ab5865cd2a2dce49413311fcf389c))
* **vis:** integrate aube package manager + offline OSV bloom prefilter ([9513e09](https://github.com/visulima/visulima/commit/9513e0930c6fbcdb00e42df2ab9c650194a35eb4))
* **vis:** scan npm-shrinkwrap.json with precedence ([ae907f1](https://github.com/visulima/visulima/commit/ae907f18e560eed7c80c7738650330909a254148))
* **vis:** security check on by default for update, add --no-security ([e8db4c8](https://github.com/visulima/visulima/commit/e8db4c88a4c64038ca00c46b2a63083fee224637))
* **vis:** source-mapped, code-framed task failure rendering ([95b2343](https://github.com/visulima/visulima/commit/95b2343d7299ab8537c5a4ef0205ddeee9146c58))

### Bug Fixes

* **vis:** harden marshall pipeline and failure-render ANSI stripping ([22dc431](https://github.com/visulima/visulima/commit/22dc431ac3e841a2a342f297673b4d5f1a0a8a43))
* **vis:** make write guard github/gitlab asymmetry explicit ([0202fd9](https://github.com/visulima/visulima/commit/0202fd99e920173cbbb5e9711bb2df9528d25e42))
* **vis:** parse pnpm v11 multi-document lockfiles ([94024b6](https://github.com/visulima/visulima/commit/94024b65310ab70ef4a3d4fed93f4987203f4a57))
* **vis:** version the packument cache so stale entries can't blind marshalls ([6741f55](https://github.com/visulima/visulima/commit/6741f551ed9c1a28a2184672ed644dd06344c93b))
* **vis:** wire s1ngularity into the vis inspect dispatch ([0e355eb](https://github.com/visulima/visulima/commit/0e355eb44acfcf50caf09f7b0954038def735278))

### Documentation

* **vis:** add MARSHALL_DISABLE_S1NGULARITY to shell-alias guide ([fee4979](https://github.com/visulima/visulima/commit/fee4979338cd255ee5c4ff1e52e99e545695e4d7))
* **vis:** document lockfile supply-chain verification ([05c338f](https://github.com/visulima/visulima/commit/05c338f55f7069ed59018e64be3d24016ab3fb66))
* **vis:** document s1ngularity marshall in add/update/inspect ([6a14d5c](https://github.com/visulima/visulima/commit/6a14d5c190a6125817abe9c3e35afde87893228a))

### Styles

* **vis:** prettier/eslint conformance sweep ([dd200bd](https://github.com/visulima/visulima/commit/dd200bd84c022f5fd8819ce23bab2c1c4cace1ed))

### Miscellaneous Chores

* **vis:** remove competitive-analysis and priority-roadmap docs ([3116348](https://github.com/visulima/visulima/commit/3116348a5f76772ace9f285d136d352a815c3f0a))


### Dependencies

* **@visulima/error:** upgraded to 6.0.0-alpha.26
* **@visulima/task-runner:** upgraded to 1.0.0-alpha.15
* **@visulima/tui:** upgraded to 1.0.0-alpha.17
* **@visulima/cerebro:** upgraded to 3.0.0-alpha.25
* **@visulima/fs:** upgraded to 5.0.0-alpha.24
* **@visulima/package:** upgraded to 5.0.0-alpha.23

## @visulima/vis [1.0.0-alpha.21](https://github.com/visulima/visulima/compare/@visulima/vis@1.0.0-alpha.20...@visulima/vis@1.0.0-alpha.21) (2026-05-16)


### Dependencies

* **@visulima/tui:** upgraded to 1.0.0-alpha.16
* **@visulima/cerebro:** upgraded to 3.0.0-alpha.24
* **@visulima/fs:** upgraded to 5.0.0-alpha.23
* **@visulima/package:** upgraded to 5.0.0-alpha.22

## @visulima/vis [1.0.0-alpha.20](https://github.com/visulima/visulima/compare/@visulima/vis@1.0.0-alpha.19...@visulima/vis@1.0.0-alpha.20) (2026-05-14)

### ⚠ BREAKING CHANGES

* **vis:** the following security.* keys were renamed:
- security.minimumReleaseAge          -> security.policies.first_seen.minutes
- security.minimumReleaseAgeExclude   -> security.policies.first_seen.exclude
- security.trustPolicy                -> security.policies.publisher_change.mode
- security.trustPolicyExclude         -> security.policies.publisher_change.exclude
- security.trustPolicyIgnoreAfter     -> security.policies.publisher_change.ignoreAfter
- security.allowBuilds                -> security.policies.install_scripts.allow
- security.strictDepBuilds            -> security.policies.install_scripts.strict
- security.socket.minimumScore        -> security.policies.score.minimum
- security.socket.acceptedRisks       -> security.acceptedRisks
- security.audit.failOn               -> security.policies.vulnerability.failOn
- security.audit.usage                -> security.policies.vulnerability.usage

AcceptedRisk now carries optional policies[] and expiresAt fields so
risks can be scoped per-policy and time-boxed. Native PM sync writers
keep emitting pnpm-native field names since pnpm owns that schema.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>

* chore(vis): address coderabbit review feedback

- Add JSDoc to exported items across hook builtins, advisories, audit, docker
- Document OSV `last_affected` inclusive-upper semantics with a focused test
- Annotate NAPI u64→u32 truncations with JS Number range rationale
- Switch vis-mcp tool payloads to zod schemas with `.catchall(z.unknown())`
  so unknown CLI fields stay forward-compatible
- Fence RFC code blocks with explicit languages and tidy hook-command
  formatting (multi-line type, implicit-return arrows)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>

* chore(vis): address second-round coderabbit feedback on policies rename

- Drift report labels now reference `security.policies.*` paths so the
  hint matches the keys users edit
- `defineConfig` JSDoc examples use the new `security.policies` shape
- `mergeSecurityDefaults` deep-merges every defaulted sub-policy
  generically; `mergeVisConfigs` deep-merges `policies` and
  `acceptedRisks` so presets aren't clobbered
- Config-writer scopes its `allow:` match to follow an
  `install_scripts:` opener
- JSDoc clarifications for `audit.advisories.source` default,
  `acceptedRisks.expiresAt`/`acceptedScore` ranges, `malware.mode`
  cross-field default, and the current `policies.score.minimum`
  wiring gap

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>

* chore(vis): finish coderabbit round-2 fixes — camelCase policies + wire score.minimum

- Rename `PolicyName` union to camelCase (`firstSeen`, `installScripts`,
  `publisherChange`, `unexpectedDeps`). Updates every consumer in src/,
  test fixtures, schemas, and docs. JSON schema regenerated.
- Add `types` mapping to the `#native` package.json import so TypeScript
  resolves `index.d.ts` when consumers import the alias.
- Thread `socketOptions.minimumScore` through `audit`, `doctor`, `check`,
  `update`, `add`, `formatSecurityOverview`, `formatSummary`, and
  `applyFilter`. `buildSocketOptions` now resolves the effective minimum
  once (from `security.policies.score.minimum` or
  `DEFAULT_LOW_SCORE_THRESHOLD`) so every consumer sees the same value
  instead of comparing scores against the hard-coded constant.
- Update the JSDoc on `policies.score.minimum` to reflect the new wiring.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>

* feat(vis): add Socket-style policy engine with 4 offline-clean policies

Introduce a unified `evaluatePolicies()` engine under `src/security/policies/`
with four offline-clean modules: license, install_scripts, vulnerability,
and unexpected_deps (baseline mode). Each policy emits PolicyDecisions
(block/warn/info) keyed by package, with per-policy accepted-risk scoping
and expiresAt support reused from the shared matcher.

Wires the engine into `vis audit`: a new `--policies <names>` flag
(comma-list, `all`, or `none`) narrows evaluation. Block-severity
decisions feed into `--exit-code` and `--fail-on`. JSON output gains
`policies[]` + `summary.policyBlocks`. SARIF and HTML formatters render
policy decisions alongside vulnerabilities; CSAF and CycloneDX-VEX are
intentionally left untouched (vuln-specific data models).

Adds `readNodeModulesManifests()` to walk `node_modules/` (including the
pnpm `.pnpm/` content-addressed store) and surface license + scripts +
maintainers metadata for the offline policies.

33 new unit + integration tests; full vitest suite (3582/3582) green;
`tsc --noEmit` clean.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>

* fix(vis): close three audit policy gating gaps surfaced by CodeRabbit

- applyExitGate's fallthrough call to applyFailOnGate was dropping the
  policyDecisions argument, so `vis audit --format sarif --fail-on high`
  exited 0 when the only signal was a block-severity policy decision.
  Forward the argument.
- Unknown --policies tokens were silently swallowed when format was
  json/sarif/csaf/cyclonedx-vex, so a typoed CI invocation reduced
  enforcement with no log. Always emit the warning to stderr and
  surface the tokens in JSON output as `warnings[]`.
- Vulnerability-policy block decisions whose advisory was masked by
  --severity used to exit 1 with no visible reason. Surface those
  decisions in the human-readable "Policy Decisions" section so the
  gate is always traceable.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>

* fix(vis): correct npm/yarn min-release-age native config writers

npm CLI types `min-release-age` as `Number` in days, not a duration string —
vis wrote `48h`/`15m`, which npm's parseInt would silently read as 48/15 days.
Write integer days rounded up so the native gate is never weaker than vis-config.

Yarn Berry silently treats day suffixes in `npmMinimalAgeGate` as minutes

### Features

* **vis:** add LavaMoat allow-scripts parity (run/tripwire/--write/allowBins) ([84218d3](https://github.com/visulima/visulima/commit/84218d392abcde8d76b9b92de7d220be2b08e854))
* **vis:** multi-source codeowners aggregation ([d22df81](https://github.com/visulima/visulima/commit/d22df81214899209be3fd9fa4d83372be97552ef))
* **vis:** offline OSV scanner + unified security.policies ([#632](https://github.com/visulima/visulima/issues/632)) ([6461902](https://github.com/visulima/visulima/commit/646190243bf51bb6df172665d70fd501644e7bc3)), closes [#631](https://github.com/visulima/visulima/issues/631) [#631](https://github.com/visulima/visulima/issues/631) [yarnpkg/berry#6991](https://github.com/yarnpkg/berry/issues/6991)
* **vis:** wire marshall env-var matrix into install/audit/check + add keys-refresh ([e1e2d6c](https://github.com/visulima/visulima/commit/e1e2d6c2dc81cfdf442b6f75b6497150b368565f))

### Bug Fixes

* **release:** patch NAPI version-check string and ship fresh loader on release ([0676e33](https://github.com/visulima/visulima/commit/0676e336f453c9ae38c9f3a5fbbb675f9bff7ea0))
* **vis:** clear lint findings in hook dispatch, builtins, and util ([d05204c](https://github.com/visulima/visulima/commit/d05204c9a88d300b2b4ba3c2dd4169a9860a1d86))

### Documentation

* **vis:** add vltpkg/security-archive attribution ([019d6fd](https://github.com/visulima/visulima/commit/019d6fd4d4426991f2fb31450f72616b14874aff))

### Miscellaneous Chores

* fixed build ([ec156bf](https://github.com/visulima/visulima/commit/ec156bf08859e81186b74533610357d85c38f64e))
* update license file ([8a84e10](https://github.com/visulima/visulima/commit/8a84e10f2077779159f2f1e186be1d461c47e043))
* **vis:** apply prettier and eslint --fix sweep ([ec64552](https://github.com/visulima/visulima/commit/ec645524984f0e767ba63b3fcaaf60e184d31edf))
* **vis:** clear remaining ESLint findings across marshalls and tests ([29f87c5](https://github.com/visulima/visulima/commit/29f87c56d8c4aadfe5e270e67901435af31b8eae))
* **vis:** fix indent-binary-ops and silence default-log no-console ([9c8d5e1](https://github.com/visulima/visulima/commit/9c8d5e1cc07e6e5f3c01d0b79715f074dbda9b0b))
* **vis:** style normalization sweep + scopedTasks/allowBins config fields ([ff97758](https://github.com/visulima/visulima/commit/ff977584da0afdf61d619b7a5fb7536f80c782a6))

### Tests

* **vis:** raise audit-offline gate to 5× budget for CI hosts ([345b159](https://github.com/visulima/visulima/commit/345b1590cd5f0fbe432855aafde8e7cb3ab19c84))
* **vis:** use median-of-11 samples for audit-offline perf gate ([3225515](https://github.com/visulima/visulima/commit/3225515f9bf67149b8e0cb42812bc21729b6d750))

### Continuous Integration

* **vis:** track index.d.ts so loader artifact survives cache hits ([b9a439f](https://github.com/visulima/visulima/commit/b9a439f178f1849cc14233ad76e51fe38e5d180f))


### Dependencies

* **@visulima/secret-scanner:** upgraded to 1.0.0-alpha.3
* **@visulima/task-runner:** upgraded to 1.0.0-alpha.14
* **@visulima/tui:** upgraded to 1.0.0-alpha.15
* **@visulima/cerebro:** upgraded to 3.0.0-alpha.23
* **@visulima/colorize:** upgraded to 2.0.0-alpha.11
* **@visulima/fs:** upgraded to 5.0.0-alpha.22
* **@visulima/package:** upgraded to 5.0.0-alpha.21
* **@visulima/pail:** upgraded to 4.0.0-alpha.16

## @visulima/vis [1.0.0-alpha.19](https://github.com/visulima/visulima/compare/@visulima/vis@1.0.0-alpha.18...@visulima/vis@1.0.0-alpha.19) (2026-05-11)

### ⚠ BREAKING CHANGES

* **vis:** replace prek runner with in-process hook dispatcher
* **vis:** vis sbom now emits CycloneDX 1.7. Downstream consumers
pinned to a 1.6 validator must upgrade.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>

### Features

* **vis:** bump sbom to cyclonedx 1.7 ([904075f](https://github.com/visulima/visulima/commit/904075fd9353e40b593d5a13f53307c584e31da7))
* **vis:** replace prek runner with in-process hook dispatcher ([659ba07](https://github.com/visulima/visulima/commit/659ba07fc311c36783e8900188b9753276a961fe))


### Dependencies

* **@visulima/tui:** upgraded to 1.0.0-alpha.14
* **@visulima/cerebro:** upgraded to 3.0.0-alpha.22
* **@visulima/fs:** upgraded to 5.0.0-alpha.21
* **@visulima/package:** upgraded to 5.0.0-alpha.20

## @visulima/vis [1.0.0-alpha.18](https://github.com/visulima/visulima/compare/@visulima/vis@1.0.0-alpha.17...@visulima/vis@1.0.0-alpha.18) (2026-05-11)

### Features

* **task-runner:** add resolveTurboEnvCompat helper ([a8e73ef](https://github.com/visulima/visulima/commit/a8e73ef324dd8d1bc1f1f471f59f9292f9f01745))
* **vis:** add vis-mcp post-command promotion nudge ([9244fad](https://github.com/visulima/visulima/commit/9244fad8a8f9164ce99b2ab3cb771d53f926e788))
* **vis:** expand secrets.config.presets to tag selectors ([77b8d2b](https://github.com/visulima/visulima/commit/77b8d2bbc951d5180753f37a45d2313c01fcf47f))
* **vis:** honour TURBO_API/TURBO_TOKEN/TURBO_TEAM env vars ([0d4fc8c](https://github.com/visulima/visulima/commit/0d4fc8c1ad617ba27c436e40e520ddcbb19ebeca))
* **vis:** show flakiness table on successful runs too ([085b219](https://github.com/visulima/visulima/commit/085b219a4472ceb0fd2f507c7bc3b3b1780a014a))
* **vis:** surface retried-but-passed tasks and add CI log grouping ([2bdceaa](https://github.com/visulima/visulima/commit/2bdceaacf3f69c99a08c9e1b3b6eda0ee3528cd2))

### Bug Fixes

* **vis:** raise timeout for exposed-files preset tests to 15s ([433db73](https://github.com/visulima/visulima/commit/433db7319ecf4720664bc199582d571ea6a3630b))
* **vis:** warm default ruleset for exposed-files preset tests ([9c76250](https://github.com/visulima/visulima/commit/9c76250d2ee6e8e2be878e5dcfb149d38126d60d))

### Documentation

* **vis:** mention TURBO_API fallback in help text and migrate hint ([f9bd7ac](https://github.com/visulima/visulima/commit/f9bd7acd7a53837e40376f9b0dcf54040bbc50a1))

### Miscellaneous Chores

* added fixtures to prettier ignore ([13bda29](https://github.com/visulima/visulima/commit/13bda2942d5d95fedeec7c07937fdfc37cf960c7))
* **vis:** apply eslint and formatter sweep ([d3a48c5](https://github.com/visulima/visulima/commit/d3a48c577a77864b1aae52e6061a8aad1554f273))


### Dependencies

* **@visulima/secret-scanner:** upgraded to 1.0.0-alpha.2
* **@visulima/task-runner:** upgraded to 1.0.0-alpha.13
* **@visulima/tui:** upgraded to 1.0.0-alpha.13
* **@visulima/cerebro:** upgraded to 3.0.0-alpha.21
* **@visulima/fs:** upgraded to 5.0.0-alpha.20
* **@visulima/package:** upgraded to 5.0.0-alpha.19

## @visulima/vis [1.0.0-alpha.17](https://github.com/visulima/visulima/compare/@visulima/vis@1.0.0-alpha.16...@visulima/vis@1.0.0-alpha.17) (2026-05-10)

### Features

* **vis:** expand typed plugin hook surface ([d0784df](https://github.com/visulima/visulima/commit/d0784df2b0c422002ec21c3c8da0002e0ff70dee))


### Dependencies

* **@visulima/task-runner:** upgraded to 1.0.0-alpha.12
* **@visulima/tui:** upgraded to 1.0.0-alpha.12
* **@visulima/cerebro:** upgraded to 3.0.0-alpha.20
* **@visulima/fs:** upgraded to 5.0.0-alpha.19
* **@visulima/package:** upgraded to 5.0.0-alpha.18

## @visulima/vis [1.0.0-alpha.16](https://github.com/visulima/visulima/compare/@visulima/vis@1.0.0-alpha.15...@visulima/vis@1.0.0-alpha.16) (2026-05-10)

### Features

* add service and tool projectType variants ([61858ad](https://github.com/visulima/visulima/commit/61858ad4c044b5f30318f282615c83f716667053)), closes [#21](https://github.com/visulima/visulima/issues/21)
* **vis:** auto-start declared service deps for vis run with TUI dock ([adeb316](https://github.com/visulima/visulima/commit/adeb3164d29aec6da2eeed03d46fc0502aec5d6a))
* **vis:** cross-PM dispatch for vis pm (yarn berry, pnpm 11, bun pm) ([fd56b86](https://github.com/visulima/visulima/commit/fd56b86317f4141227814504845f03ce777c0b88))
* **vis:** expand nx migrator and add --force overwrite ([d6e5a91](https://github.com/visulima/visulima/commit/d6e5a91c4bc44a34dd770dd0b8298b5017bdd6df))
* **vis:** prune workspace lockfile in docker scaffold ([d1c0904](https://github.com/visulima/visulima/commit/d1c090425d130b3e18b6e64e44fe81eb1e08b923))

### Bug Fixes

* **vis:** exit explicitly after cli.run settles ([2dc28e2](https://github.com/visulima/visulima/commit/2dc28e2d0d735526c9c551aeae72af63a2deee4d))
* **vis:** release stdin and label persistent quits in dynamic TUI ([7350547](https://github.com/visulima/visulima/commit/7350547363fcbd4ec4d845d2194c22188605f34f))

### Documentation

* **vis:** document missing cache subcommands and run flags ([cf093a1](https://github.com/visulima/visulima/commit/cf093a1879ff414d0500ac91d76bba98352ed97e))

### Miscellaneous Chores

* **vis:** drop redundant section banners and pure-WHAT docblocks ([745844b](https://github.com/visulima/visulima/commit/745844b601cf111d362718611fa7021c19f2e939))
* **vis:** finish .vis/ cutover for stragglers ([3053347](https://github.com/visulima/visulima/commit/30533478e084b9ae84aefe191d57c672ca0797fa))
* **vis:** sort docker example api/package.json deps ([28fdbd7](https://github.com/visulima/visulima/commit/28fdbd780fb3384dcfc3f06db4145fafaeef52d2))

### Code Refactoring

* replace execa with tinyexec ([56ec776](https://github.com/visulima/visulima/commit/56ec776908fe0c068c54542f3885cb29f061fea7))
* **vis:** consolidate workspace state under .vis/ ([9e89d52](https://github.com/visulima/visulima/commit/9e89d52f03cc8b3a6a51c13a2359e9b93532c1dd))
* **vis:** extract definePlugin and fix jiti temp config path under pnpm hoisting ([8cda079](https://github.com/visulima/visulima/commit/8cda079c22686121c966befb25295bc3511bf29b))
* **vis:** import @visulima/tui components and hooks from subpaths ([2d9245d](https://github.com/visulima/visulima/commit/2d9245d81c9555b87c3803a428b1a306ae242da0))
* **vis:** polish derivations across vis-* TUI apps ([47a7945](https://github.com/visulima/visulima/commit/47a79456341282f945689e40c8b174e92b8dc6df))

### Tests

* **vis:** bump docker-lockfile prune test timeout for CI ([ef57ec2](https://github.com/visulima/visulima/commit/ef57ec21799b1158b972ff92568db111daa2e74f))
* **vis:** cover docker scaffold with example workspace and real-lockfile fixture ([9104638](https://github.com/visulima/visulima/commit/910463861d1200773b163acdc8bff919e37d6b97))
* **vis:** skip docker-lockfile fixture suite in CI ([af7503e](https://github.com/visulima/visulima/commit/af7503eea3d76ace9b9703332456b771bfd91380))


### Dependencies

* **@visulima/task-runner:** upgraded to 1.0.0-alpha.11
* **@visulima/tui:** upgraded to 1.0.0-alpha.11
* **@visulima/cerebro:** upgraded to 3.0.0-alpha.19
* **@visulima/fs:** upgraded to 5.0.0-alpha.18
* **@visulima/package:** upgraded to 5.0.0-alpha.17
* **@visulima/string:** upgraded to 3.0.0-alpha.13

## @visulima/vis [1.0.0-alpha.15](https://github.com/visulima/visulima/compare/@visulima/vis@1.0.0-alpha.14...@visulima/vis@1.0.0-alpha.15) (2026-05-07)

### Bug Fixes

* moved deps to dev dep ([62a47f2](https://github.com/visulima/visulima/commit/62a47f29b182b202c9956819f3b4a32da38c14cd))


### Dependencies

* **@visulima/tui:** upgraded to 1.0.0-alpha.10
* **@visulima/cerebro:** upgraded to 3.0.0-alpha.18
* **@visulima/fs:** upgraded to 5.0.0-alpha.17
* **@visulima/package:** upgraded to 5.0.0-alpha.16
* **@visulima/pail:** upgraded to 4.0.0-alpha.15
* **@visulima/redact:** upgraded to 3.0.0-alpha.11
* **@visulima/string:** upgraded to 3.0.0-alpha.12

## @visulima/vis [1.0.0-alpha.14](https://github.com/visulima/visulima/compare/@visulima/vis@1.0.0-alpha.13...@visulima/vis@1.0.0-alpha.14) (2026-05-07)

### Features

* **vis:** add --peer and --include-internal flags to update and check ([900bbbe](https://github.com/visulima/visulima/commit/900bbbed6ec3611e993cf4fcc929c8b9b7cc7d60)), closes [package.json#workspaces](https://github.com/visulima/package.json/issues/workspaces)

### Bug Fixes

* **vis:** apply pnpm !-exclusions and root .gitignore in workspace resolver ([b08a1be](https://github.com/visulima/visulima/commit/b08a1be4391e362dca4f935541362bae01b859d9)), closes [package.json#workspaces](https://github.com/visulima/package.json/issues/workspaces)

### Miscellaneous Chores

* **vis:** bump example setup-wizard @inquirer/prompts to v8 ([1974734](https://github.com/visulima/visulima/commit/1974734c34d49c61ce62b663a999a6161e679251))
* **vis:** bundle internal deps as devDeps and extend packem hoisted exclude ([9cd6cba](https://github.com/visulima/visulima/commit/9cd6cba0ed89e26b6def141433d024c7a5851578))

### Code Refactoring

* **vis:** centralize per-user filesystem layout in vis-paths helpers ([9a06751](https://github.com/visulima/visulima/commit/9a0675131e7da5bc338bcaf438574a4a5930d239))
* **vis:** read negative flags via cerebro's options.X === false idiom ([c52f39f](https://github.com/visulima/visulima/commit/c52f39f9294c42e69be2e4e3c327330875aef37b))


### Dependencies

* **@visulima/fs:** upgraded to 5.0.0-alpha.16
* **@visulima/tui:** upgraded to 1.0.0-alpha.9
* **@visulima/cerebro:** upgraded to 3.0.0-alpha.17
* **@visulima/package:** upgraded to 5.0.0-alpha.15

## @visulima/vis [1.0.0-alpha.13](https://github.com/visulima/visulima/compare/@visulima/vis@1.0.0-alpha.12...@visulima/vis@1.0.0-alpha.13) (2026-05-06)


### Dependencies

* **@visulima/cerebro:** upgraded to 3.0.0-alpha.16
* **@visulima/fs:** upgraded to 5.0.0-alpha.15
* **@visulima/package:** upgraded to 5.0.0-alpha.14
* **@visulima/pail:** upgraded to 4.0.0-alpha.14
* **@visulima/tui:** upgraded to 1.0.0-alpha.8

## @visulima/vis [1.0.0-alpha.12](https://github.com/visulima/visulima/compare/@visulima/vis@1.0.0-alpha.11...@visulima/vis@1.0.0-alpha.12) (2026-05-06)

### Features

* **vis:** add --reverse for leaves-first task order ([9d02f37](https://github.com/visulima/visulima/commit/9d02f373ff08ed94c95055725ce43ed42ea8c9aa))
* **vis:** add --skip-cache for selective per-task cache bypass ([28cfa7a](https://github.com/visulima/visulima/commit/28cfa7afc03ace27a4ff41746e91c70006cb9e9e))
* **vis:** add corepack passthrough + unified dry/silent/env ([0ba38b2](https://github.com/visulima/visulima/commit/0ba38b297385497deb167efd03349f38ef1a7049)), closes [#6](https://github.com/visulima/visulima/issues/6) [#10](https://github.com/visulima/visulima/issues/10) [#11](https://github.com/visulima/visulima/issues/11)
* **vis:** add custom-types lint for engines/packageManager/volta drift ([149455a](https://github.com/visulima/visulima/commit/149455a114b76c86ea12b7f271450297f38eeff6))
* **vis:** add deno as first-class package manager + --auto-install-peers ([90d6d0f](https://github.com/visulima/visulima/commit/90d6d0fd98d531e1f76de42848da27605509f7d3))
* **vis:** add sponsor notice after successful commands ([86ebd1c](https://github.com/visulima/visulima/commit/86ebd1c3270c3241c76577eae8bb889690b71e53))
* **vis:** add syncpack migrate adapter and audit ([6e07ae8](https://github.com/visulima/visulima/commit/6e07ae86401f374d76206c81d1c6131bc08618e2))
* **vis:** add task-level runner tags for capability-gated CI lanes ([8980e03](https://github.com/visulima/visulima/commit/8980e0319e99b4f79c5e049509d7dc2039f2092d))
* **vis:** auto-generate JSON schemas from TypeScript types ([391a3f0](https://github.com/visulima/visulima/commit/391a3f0d253b3b55d02346bbb0dbeb061d8ec06f))
* **vis:** close 7 syncpack-parity gaps ([85bc6b1](https://github.com/visulima/visulima/commit/85bc6b169fbc75cc4cc1b43b5bea85e673253f06)), closes [pnpm-workspace.yaml#overrides](https://github.com/visulima/pnpm-workspace.yaml/issues/overrides) [#623](https://github.com/visulima/visulima/issues/623) [#624](https://github.com/visulima/visulima/issues/624) [#625](https://github.com/visulima/visulima/issues/625) [#626](https://github.com/visulima/visulima/issues/626) [#627](https://github.com/visulima/visulima/issues/627) [#628](https://github.com/visulima/visulima/issues/628) [#629](https://github.com/visulima/visulima/issues/629)
* **vis:** honor editorconfig in all JSON writers ([859e925](https://github.com/visulima/visulima/commit/859e92533d0349be37c1a750cb80582c14acb715))
* **vis:** implement vis sync package-json-fields ([87e1fa1](https://github.com/visulima/visulima/commit/87e1fa11f2be741a768fe0c6c04238427823623a))
* **vis:** port sherif lint rules and add migrate sherif command ([243324b](https://github.com/visulima/visulima/commit/243324b440a31831b6c6d93219d8cb3a3ab48495))
* **vis:** scope banned-deps rules with packages/paths globs ([82fbaf2](https://github.com/visulima/visulima/commit/82fbaf2ffac946f032fc872ee2a428989ebf8c57))
* **vis:** skip ignored paths in sort-package-json ([74215c0](https://github.com/visulima/visulima/commit/74215c06fd0e0f562b97e803a95b9e662e9980e2)), closes [package.json#workspaces](https://github.com/visulima/package.json/issues/workspaces)
* **vis:** surface leftover migration references in vis doctor ([ebd3a48](https://github.com/visulima/visulima/commit/ebd3a4841a736209cdbf2641ac6e27ec2e69f886))
* **vis:** translate syncpack isBanned versionGroups to policy.bannedDeps ([f95d01b](https://github.com/visulima/visulima/commit/f95d01bda6a5add3f7fa0d48c1c955942b5c7fc3))
* **vis:** user-defined customTypes for vis lint ([51fa21f](https://github.com/visulima/visulima/commit/51fa21f4193913f64e4abcd1dc9f97322dd21553))

### Bug Fixes

* **vis:** coalesce wheel-burst input and group sort-package-json TUI ([97aa78b](https://github.com/visulima/visulima/commit/97aa78bc445fc234e1473986a867e70f8d15d7b4))
* **vis:** declare missing editorconfig field on VisConfig type ([4a33428](https://github.com/visulima/visulima/commit/4a334285b396ee41a1dbe507eb27fb2894055463))
* **vis:** drop duplicate --no-color global option ([c50879a](https://github.com/visulima/visulima/commit/c50879a7ab2b195b4decf81d2cca5d3a39b8f137))
* **vis:** harden extraTypes per review ([8b56f48](https://github.com/visulima/visulima/commit/8b56f48fce55ac133bd20f181133ad17e06a9825))
* **vis:** hash expanded command so token-driven cache keys vary per affected set ([636b1ac](https://github.com/visulima/visulima/commit/636b1ac843381cf7df3fec844431ec0123b5f565))
* **vis:** read bun minimumReleaseAge from bunfig.toml, not package.json ([78fe9f4](https://github.com/visulima/visulima/commit/78fe9f40452ddfc93d4bd3d66ec49f269b6085e6))
* **vis:** replace editorconfig with ec4rs binding ([3a83ed0](https://github.com/visulima/visulima/commit/3a83ed0f9de3e4202dfa51cf9bf4e6d8c3b0134d))
* **vis:** resolve tsc errors in create handler and watch keybinds ([033760d](https://github.com/visulima/visulima/commit/033760d83c8a7252dadbd716ecd04f80f54816e9))

### Documentation

* **vis:** add migration sources to credits section ([2caddce](https://github.com/visulima/visulima/commit/2caddcea6755bdc73780b559243cc27d4f2d48f7))
* **vis:** document json deps, sync fields, post-sort flags ([d244ddd](https://github.com/visulima/visulima/commit/d244ddd2b2e88d53e756fef57e4024cd46a57430))
* **vis:** document patchedDependencies supply-chain check ([b373960](https://github.com/visulima/visulima/commit/b373960d6d7dc38db9eeb8437cec33d47f9102ab))
* **vis:** document vis lint and mark syncpack item 6 shipped ([73cbd44](https://github.com/visulima/visulima/commit/73cbd4457810a91ecce99856522904885e80c4d6))
* **vis:** mark `${affected.files}` token wiring as shipped ([e4d306e](https://github.com/visulima/visulima/commit/e4d306e5ddd1eba30a404bf3d03efc5d976f0e9a)), closes [#6](https://github.com/visulima/visulima/issues/6)
* **vis:** mark syncpack ports shipped, link [#622](https://github.com/visulima/visulima/issues/622) ([2fdb8de](https://github.com/visulima/visulima/commit/2fdb8de9d1b6946208a34a4da491918820f8c815))

### Miscellaneous Chores

* commit pnpm-lock and vis syncpack roadmap ([5138981](https://github.com/visulima/visulima/commit/5138981ee04b45900c6cf1ba41f8e18025d4ba63))
* re-enable antfu/if-newline in vis and secret-scanner ([bcd84de](https://github.com/visulima/visulima/commit/bcd84de019b60f6bc474852e7ae6b7da822a9185))
* re-enable jsdoc/match-description in api-platform and tighten config docs ([4ecaa31](https://github.com/visulima/visulima/commit/4ecaa315064cdd798af1ea1296be1fe52967bf9a))
* **vis:** apply pending eslint autofixes and regenerate bundled licenses ([742c613](https://github.com/visulima/visulima/commit/742c61358fcc6b07a62f3c4f688320335aeca27b))
* **vis:** apply prettier and eslint quote-style auto-fix ([f477246](https://github.com/visulima/visulima/commit/f47724629e5708ca45bb7891fdc03411088f0d00))
* **vis:** apply prettier and eslint quote-style auto-fix ([915d80b](https://github.com/visulima/visulima/commit/915d80b4eca4e8da8ca36154a994f9048d1c1e28))
* **vis:** clear all eslint warnings across vis package ([f0c513e](https://github.com/visulima/visulima/commit/f0c513ead5761ebba35379099bcfa50ee006e44f))
* **vis:** commit pending lint+tsc fixes ([3d7a519](https://github.com/visulima/visulima/commit/3d7a5193f729e70444bdac983afdcf39828b4ad6))
* **vis:** destructure runtime to satisfy prefer-destructuring in custom-types tests ([4802c91](https://github.com/visulima/visulima/commit/4802c912dda97ffd04182c1d9d4169c58b3c5aac))
* **vis:** drop stale planning doc and exclude sherif-lint fixtures ([6002fd2](https://github.com/visulima/visulima/commit/6002fd273242f357eb8884a1d3cfe2526c769d61))
* **vis:** enforce @stylistic/quotes — auto-fix 333 single→double quote sites ([b33bdcb](https://github.com/visulima/visulima/commit/b33bdcbb52ecba14b8088053df5653adba0b5b6e))
* **vis:** fix lint errors ([0898454](https://github.com/visulima/visulima/commit/0898454c6119b2eaf77836015bc078a8afd2a1c0))
* **vis:** housekeeping cleanup ([59a33fb](https://github.com/visulima/visulima/commit/59a33fba3ed65ae965b227d1e860e05e1b707bfa))
* **vis:** remove ~10 eslint disables and fix mid-tier violations ([6a8a960](https://github.com/visulima/visulima/commit/6a8a960289c31d495cd3d37d2b28022516c02cd5))
* **vis:** remove ~10 stale-zero/trivial eslint disables ([ffda729](https://github.com/visulima/visulima/commit/ffda72972a7d44d3b6eb2d1942897ff211811172))
* **vis:** remove ~21 eslint disables and fix the violations ([6aec6e8](https://github.com/visulima/visulima/commit/6aec6e830c6e8816036f5dce8c6f57178f1e1af6))
* **vis:** rename PascalCase TUI components to kebab-case ([3aaa398](https://github.com/visulima/visulima/commit/3aaa398125f722770c1b44d0edb45ddfec2d0802))

### Code Refactoring

* **vis:** drop --json alias from vis list, use --format=json ([30251b0](https://github.com/visulima/visulima/commit/30251b016c5631bb200d580ece891ff783d67930))
* **vis:** fold vis json deps into vis list --deps --format=ndjson ([1d0c859](https://github.com/visulima/visulima/commit/1d0c85981b9b1db1a49a6932dd4986e1862f4725))
* **vis:** tighten verify+syncpack types from audit feedback ([277bf93](https://github.com/visulima/visulima/commit/277bf93f810e034c98b83c53a5ff09b7b4fe8688))
* **vis:** tighten versionGroups remainder filter ([9965d34](https://github.com/visulima/visulima/commit/9965d34e5425d9307f1a2207058c3916d2b76cfb))

### Tests

* **vis:** bump loader-resolution timeout to 30s to survive suite contention ([17d738d](https://github.com/visulima/visulima/commit/17d738db8aee272fb9abbb40d0f2a094f16c5eae))
* **vis:** cover custom-types format outputs ([b99ea50](https://github.com/visulima/visulima/commit/b99ea50a7b270bbc56984adf8a3f3c7b154559bb))
* **vis:** cover syncpack-parity features and wire --query into --deps ([f913f51](https://github.com/visulima/visulima/commit/f913f51ba78e427c57099c9819f3013c5c88231d)), closes [pnpm-workspace.yaml#overrides](https://github.com/visulima/pnpm-workspace.yaml/issues/overrides)

### Continuous Integration

* **vis:** move schemas drift check out of vitest ([6da612b](https://github.com/visulima/visulima/commit/6da612bf459095777c163707747f6f0a29bf2fec))


### Dependencies

* **@visulima/cerebro:** upgraded to 3.0.0-alpha.15
* **@visulima/fs:** upgraded to 5.0.0-alpha.14
* **@visulima/package:** upgraded to 5.0.0-alpha.13
* **@visulima/pail:** upgraded to 4.0.0-alpha.13
* **@visulima/task-runner:** upgraded to 1.0.0-alpha.10
* **@visulima/tui:** upgraded to 1.0.0-alpha.7

## @visulima/vis [1.0.0-alpha.11](https://github.com/visulima/visulima/compare/@visulima/vis@1.0.0-alpha.10...@visulima/vis@1.0.0-alpha.11) (2026-05-04)

### Features

* **task-runner,vis:** cache restoration fidelity ([a15cb22](https://github.com/visulima/visulima/commit/a15cb22bde832cfe76ee017722b8b9f9102dac8f))
* **task-runner:** add REAPI gRPC backend, cacheMode, and cache doctor ([03e6da9](https://github.com/visulima/visulima/commit/03e6da97beb84f6adc4a07a1c7ca4acf28be3b33))
* **task-runner:** add URI-based input format ([050b583](https://github.com/visulima/visulima/commit/050b5838c15590a3ccba0ca99ad585cbabc36d99))
* **vis:** add --json and --describe to vis generate ([396c89b](https://github.com/visulima/visulima/commit/396c89b29ddca99b01394508fda4b3d6b1804a3a))
* **vis:** add `vis add --to <pkg>` auto-conforming to catalogs (syncpack[#285](https://github.com/visulima/visulima/issues/285)) ([03a5641](https://github.com/visulima/visulima/commit/03a56411fe88165395ec081f1d9caee2474fbf2a))
* **vis:** add 33 inferTargets detectors ([b4b4684](https://github.com/visulima/visulima/commit/b4b468436ed2c48484ecbf69539b0121870fd124))
* **vis:** add ai heal + heal accept commands ([3c6fa32](https://github.com/visulima/visulima/commit/3c6fa323c8133d95a17fe9bc19ffd3d8aeb37c4e))
* **vis:** add Buildkite CI provider and `vis generate buildkite-ci` builtin ([845ac99](https://github.com/visulima/visulima/commit/845ac99a37dc9f280d5bba11aad4cf196cdaaebc)), closes [#19](https://github.com/visulima/visulima/issues/19)
* **vis:** add Claude skill for vis-mcp consumption ([434ceb2](https://github.com/visulima/visulima/commit/434ceb2e8d6c49f31a3b7f84d45c35de247a4806))
* **vis:** add discover-help subcommand, drop --format from ai root ([36d3990](https://github.com/visulima/visulima/commit/36d3990f7ee6368687af8151454a86181f188511))
* **vis:** add replay + strict env, finish service registry ([c6db6d5](https://github.com/visulima/visulima/commit/c6db6d54688c43960b5aef9650b3bbc0292c0a58)), closes [#10](https://github.com/visulima/visulima/issues/10) [#16](https://github.com/visulima/visulima/issues/16) [#20](https://github.com/visulima/visulima/issues/20)
* **vis:** inferred targets, preflight, services ([9697571](https://github.com/visulima/visulima/commit/96975719f12ccaf051452ecc60f07f1df0b5bc69)), closes [#11](https://github.com/visulima/visulima/issues/11) [#21](https://github.com/visulima/visulima/issues/21)
* **vis:** list --targets table with type, cache, description ([a480e27](https://github.com/visulima/visulima/commit/a480e27a8d9a938a5225b9ebfda918de6c569f21)), closes [#22](https://github.com/visulima/visulima/issues/22) [#23](https://github.com/visulima/visulima/issues/23)

### Bug Fixes

* declare libc on linux binding subpackages ([078b31f](https://github.com/visulima/visulima/commit/078b31f1a9029487c86651e75ecdad70f02b37e8)), closes [npm/cli#4828](https://github.com/npm/cli/issues/4828)
* **vis:** address review findings on services + inference ([c191cbc](https://github.com/visulima/visulima/commit/c191cbc3661a2885488daa44554b642e64785e52))
* **vis:** preserve probe error on close failure and clamp formatAge ([f1d71d6](https://github.com/visulima/visulima/commit/f1d71d63a5432fc2ed8c09c9a0a87e4e59b83b0b))
* **vis:** tighten update command view and reduce duplicated security warnings ([4002b43](https://github.com/visulima/visulima/commit/4002b4379aadd00bac5c5e3d9c4eb5796b9d7b3d))

### Documentation

* **vis:** add AI integration guide ([a6dbbe0](https://github.com/visulima/visulima/commit/a6dbbe0bf8c03519764ff41da9efdd4cb4439b77))
* **vis:** add ai/list pages, stub 18 commands, refresh flags ([71b81ca](https://github.com/visulima/visulima/commit/71b81ca8704548bca0ec33437854476eb425c411))
* **vis:** cover template introspection in AI guide and skill ([7763283](https://github.com/visulima/visulima/commit/7763283dfd0f94dc8ef25800fa9f48e6d7888c8e))

### Miscellaneous Chores

* catalog refresh + task-runner binding bump to 1.0.0-alpha.8 ([ff4548a](https://github.com/visulima/visulima/commit/ff4548a5678c992048a57e73c310757733c04756))
* **deps:** bump rust crates to current majors ([3a1d9bb](https://github.com/visulima/visulima/commit/3a1d9bb7f6e2c6b2d3862e212ae62707d60815cc))
* prettier sweep + catalog refresh ([5c7a610](https://github.com/visulima/visulima/commit/5c7a610d9b33d6df3eb3d3ba77b79759241ee1a4))

### Code Refactoring

* **task-runner,vis:** consolidate helpers and tighten branches ([d1290d1](https://github.com/visulima/visulima/commit/d1290d1f614036902c6803d8ff51df100fdd07ab))
* **task-runner,vis:** expose worktree helpers from task-runner ([12468d7](https://github.com/visulima/visulima/commit/12468d76bb03278ec56691ba0c6d9821c9482f94))
* **vis:** expose /config via folder barrel ([0cd155a](https://github.com/visulima/visulima/commit/0cd155a872dda22d201fd86f16f056dced9886be))
* **vis:** migrate otel plugin to @opentelemetry/api types ([6440f20](https://github.com/visulima/visulima/commit/6440f201e5c15013a941f014fc4a979c80314bcf))
* **vis:** mirror src/ layout in __tests__/ and lift __fixtures__ ([ddedc1b](https://github.com/visulima/visulima/commit/ddedc1bbf87d8e572e40cb6ad65452a947dac148))
* **vis:** unify path imports on @visulima/path ([06632ab](https://github.com/visulima/visulima/commit/06632aba64e0985bb24d476cbba7bebeebe08724))


### Dependencies

* **@visulima/cerebro:** upgraded to 3.0.0-alpha.14
* **@visulima/fs:** upgraded to 5.0.0-alpha.13
* **@visulima/package:** upgraded to 5.0.0-alpha.12
* **@visulima/task-runner:** upgraded to 1.0.0-alpha.9
* **@visulima/tui:** upgraded to 1.0.0-alpha.6

## @visulima/vis [1.0.0-alpha.10](https://github.com/visulima/visulima/compare/@visulima/vis@1.0.0-alpha.9...@visulima/vis@1.0.0-alpha.10) (2026-04-30)

### Features

- **vis:** [@inherit](https://github.com/inherit) array merge sentinel ([c1334ab](https://github.com/visulima/visulima/commit/c1334ab75a84e12aa972aa1aba57ee74edbcc17d))
- **vis:** add manual typosquat list and scoped brand-jacks ([1eaef11](https://github.com/visulima/visulima/commit/1eaef1154bb3ca18f09cebee290a9857c5171339))
- **vis:** auto-recover orphaned runners via doctor --fix ([7c68a6e](https://github.com/visulima/visulima/commit/7c68a6e1fd163fdcfb2f4f663f78b5b81cf4df09))
- **vis:** cache diagnostics, retention, and quiet output style ([9ec307b](https://github.com/visulima/visulima/commit/9ec307b06cec5c3114a6e70abbf1f2346ce61910))
- **vis:** doctor checks for watch/signal runtime ([d7d53a7](https://github.com/visulima/visulima/commit/d7d53a7f520b64e72aa193e0beacf2722a82a6f4))
- **vis:** finish vis-side when:/always:/tokens migration ([3c3c759](https://github.com/visulima/visulima/commit/3c3c75946d716efa5971f6cf1fa9ae8d139d9652))
- **vis:** per-package vis.task.ts overlay ([14f6adf](https://github.com/visulima/visulima/commit/14f6adfc37b7ff552629309bd555d1fd3dd317f9)), closes [package.json#workspaces](https://github.com/visulima/package.json/issues/workspaces)
- **vis:** rewrite doctor with TUI store and live scan progress ([84f4923](https://github.com/visulima/visulima/commit/84f492376ef9129781464b26a50b1954b7e3b206))
- **vis:** secure-by-default install/add and lint cleanup ([28df4c4](https://github.com/visulima/visulima/commit/28df4c40504b7414460c57ef563593cfe14c5eeb))
- **vis:** split ai into nested subcommands, add discovery, unify cache type filter ([51d2b5e](https://github.com/visulima/visulima/commit/51d2b5ee9fdfcee0cbd4d5e5b9f2f1d08f9ef2ea))
- **vis:** support extends in vis.config.ts ([70d7b36](https://github.com/visulima/visulima/commit/70d7b36b362b0a7340e4717bdae12db355bf05e9))
- **vis:** typed errors for vis config loader ([0dce143](https://github.com/visulima/visulima/commit/0dce143247ba695eb7fa46f3b59c709c473bdc57))
- **vis:** watch keybinds and timeout escalation ([3181bb5](https://github.com/visulima/visulima/commit/3181bb50986b4d7e924a2d5b053a9883228ab08f))
- **vis:** worktree-aware shared task cache with --scope flag ([4328542](https://github.com/visulima/visulima/commit/4328542a9abfa16a40fa62cfe9e8d688eb0d9d81))

### Bug Fixes

- **vis:** address review findings on watch UX bundle ([edee703](https://github.com/visulima/visulima/commit/edee7038fe23a488791682dd8ce5c469b40a3e8c))
- **vis:** measure update list viewport for scrollbar ([4451cd3](https://github.com/visulima/visulima/commit/4451cd3726598ad1848c61800410f6d3146ec817))

### Documentation

- **vis:** document doctor command and Phase 2 watch/signal flow ([4e66350](https://github.com/visulima/visulima/commit/4e663505be135666757d9e90bbfd033f66466220)), closes [doctor#runtime](https://github.com/visulima/doctor/issues/runtime)
- **vis:** document layered configuration ([9a0f303](https://github.com/visulima/visulima/commit/9a0f3037f94992887e3551fbcd72f2dc73260305))
- **vis:** spec for layered configuration ([bcd830d](https://github.com/visulima/visulima/commit/bcd830dc9f1ed7e9dfc39f91649f839afe29bd87))

### Miscellaneous Chores

- **vis:** alphabetize VisConfig members in workspace.ts ([b7869a6](https://github.com/visulima/visulima/commit/b7869a650641a55d895dbf135bfec1a94f9f50e7))

### Code Refactoring

- **vis:** expose VisConfig types and move RFC under rfc/ ([3baa115](https://github.com/visulima/visulima/commit/3baa1151b6ec5d611135cc77e1b39911a4592470))
- **vis:** regroup src into folders and reuse visulima primitives ([18250d7](https://github.com/visulima/visulima/commit/18250d7bd39bccfdccc9737e13a8b0e7c28ffca2))

### Tests

- added more tests ([33f3f19](https://github.com/visulima/visulima/commit/33f3f191332ff9590d94ae543f3b7ef0b82de291))
- **vis:** scrub leaked GIT\_\* env vars in worktree fixture tests ([f066775](https://github.com/visulima/visulima/commit/f0667756c16cd3ad4e25541113e481966606fe62))

### Dependencies

- **@visulima/cerebro:** upgraded to 3.0.0-alpha.13
- **@visulima/task-runner:** upgraded to 1.0.0-alpha.8

## @visulima/vis [1.0.0-alpha.9](https://github.com/visulima/visulima/compare/@visulima/vis@1.0.0-alpha.8...@visulima/vis@1.0.0-alpha.9) (2026-04-28)

### Features

- Add toolchain management with version manager detection and delegation ([#617](https://github.com/visulima/visulima/issues/617)) ([548b0e8](https://github.com/visulima/visulima/commit/548b0e8f9d59743be25abb97b5de3fdbeb681bd6))
- **vis:** add aube as default installer with PM fallback ([79a9933](https://github.com/visulima/visulima/commit/79a99333c0e73e69f375b36c56e40b2693dc4c90))
- **vis:** add ignore/sortOrder/unsorted/finalNewline/lineEnding to sort-package-json ([50f68df](https://github.com/visulima/visulima/commit/50f68dfc2bc31c082ef98b3ddcf73d3dee0cc080))
- **vis:** interactive TUI for bare `vis migrate` ([2171441](https://github.com/visulima/visulima/commit/217144190520447ba9fbe66a9a8f0c452469151e))

### Bug Fixes

- fixed spacing ([1544af2](https://github.com/visulima/visulima/commit/1544af21294edaaf5799846e6c6063c86def3d29))
- **vis:** use default colorize import ([2b95ad2](https://github.com/visulima/visulima/commit/2b95ad28207e699161ed201a43f175a630a06c61))

### Miscellaneous Chores

- added missing version key ([036d86e](https://github.com/visulima/visulima/commit/036d86e6cfa078e4f651327f630cec721f1bbc47))
- **vis:** upgrade packem to 2.0.0-alpha.76 ([9753759](https://github.com/visulima/visulima/commit/97537598a23a4f680e332ca2ea73ad64f301252a))

### Code Refactoring

- **vis:** adopt cerebro lazy commands; split each command into folder ([e1efc0f](https://github.com/visulima/visulima/commit/e1efc0fe57e39433c33c50b1ad2c9e971ea596ba))
- **vis:** drop native-binding wrapper; preserve indent in sort-package-json ([efcccb8](https://github.com/visulima/visulima/commit/efcccb8bedac2f7e7e0819b8eb12277e5bf71312))

### Tests

- **vis:** isolate host env in toolchain tests, fix assertion count ([d472635](https://github.com/visulima/visulima/commit/d4726350c3a68d574b08aff88369751f07216137))
- **vis:** scope PATH in ensureToolchain engines-pnpm test ([ced1571](https://github.com/visulima/visulima/commit/ced157139ba8c6140b85a11d6c3655b2412620ac))

### Dependencies

- **@visulima/cerebro:** upgraded to 3.0.0-alpha.12
- **@visulima/tui:** upgraded to 1.0.0-alpha.5

## @visulima/vis [1.0.0-alpha.8](https://github.com/visulima/visulima/compare/@visulima/vis@1.0.0-alpha.7...@visulima/vis@1.0.0-alpha.8) (2026-04-22)

### Features

- **vis:** add --last-commit shortcut for hook run ([a841c8e](https://github.com/visulima/visulima/commit/a841c8ebfaf69d196cdc3115757c65705204d850))
- **vis:** migrate prek hooks to vis ([92fec22](https://github.com/visulima/visulima/commit/92fec22f61d1882eecd78ff139e4632f55ee3e00))
- **vis:** parse prek.toml via @visulima/fs/toml ([4599680](https://github.com/visulima/visulima/commit/459968089e8968f58edea35c5e2d801cdfbd2913))
- **vis:** translate remote prek hooks, file filters, and deps ([2705c8f](https://github.com/visulima/visulima/commit/2705c8f99e287bb93d0865361f376bafa8043736))
- **vis:** vis hook run/list/validate, migrate --dry-run, runner extras ([bce23d9](https://github.com/visulima/visulima/commit/bce23d912790f9fc2eafa7ce4596e66d0a70e97e))

### Bug Fixes

- added missing deps ([de0522f](https://github.com/visulima/visulima/commit/de0522f18286b23489cf6a51007ef3a4e7c5fd76))

### Documentation

- **vis:** document --last-commit and nested hook/migrate/cache commands ([a1f14d7](https://github.com/visulima/visulima/commit/a1f14d7ff5c1bfa2b038501f3c83c458746d3f31))

### Code Refactoring

- **vis:** split hook/migrate/cache into nested cerebro commands ([42c04fc](https://github.com/visulima/visulima/commit/42c04fc90b16b1538eddb77cf00b1d5d20372dba))

### Dependencies

- **@visulima/tui:** upgraded to 1.0.0-alpha.4

## @visulima/vis [1.0.0-alpha.7](https://github.com/visulima/visulima/compare/@visulima/vis@1.0.0-alpha.6...@visulima/vis@1.0.0-alpha.7) (2026-04-22)

### Bug Fixes

- added [@bomb](https://github.com/bomb).sh/tab ([8be4063](https://github.com/visulima/visulima/commit/8be40636caff4e7eb4776869bb71e11cc6c76298))

### Miscellaneous Chores

- added [@bomb](https://github.com/bomb).sh/tab to exclude ([6e3839e](https://github.com/visulima/visulima/commit/6e3839e5973bac479d6b2e0cb2c3d3c59db3d416))

## @visulima/vis [1.0.0-alpha.6](https://github.com/visulima/visulima/compare/@visulima/vis@1.0.0-alpha.5...@visulima/vis@1.0.0-alpha.6) (2026-04-22)

### Features

- Add comprehensive workspace configuration and command infrastructure ([#609](https://github.com/visulima/visulima/issues/609)) ([f4347bf](https://github.com/visulima/visulima/commit/f4347bfdcdd1b228cd9d842a927e446aaf23f035))
- Add CycloneDX 1.6 SBOM generation with `vis sbom` command ([#611](https://github.com/visulima/visulima/issues/611)) ([1e95276](https://github.com/visulima/visulima/commit/1e9527630958722a0f0f7e79d18bb23b5a57e0df))
- Add CycloneDX SBOM schema validation and TypeScript types ([#610](https://github.com/visulima/visulima/issues/610)) ([bd37e64](https://github.com/visulima/visulima/commit/bd37e6454f43116af94b5b6ae59d70d2cbe51d45))
- Migrate pnpm config from .npmrc to pnpm-workspace.yaml for v11 ([#608](https://github.com/visulima/visulima/issues/608)) ([af9321c](https://github.com/visulima/visulima/commit/af9321ccd2bacefbbda95248aea155c76c5d53ad))
- **secret-scanner:** regroup ScanOptions, add weak-passwords preset, polish SARIF ([1ddbfac](https://github.com/visulima/visulima/commit/1ddbfac6781408d750856003b5b5f53408afa5b3))
- **secret-scanner:** rust-native secret scanner with vis integration ([926a583](https://github.com/visulima/visulima/commit/926a5830efca68d9956f053496b0a5efb359eccd))
- **task-runner:** output globs, auto-writes, parallel cache IO ([137f53f](https://github.com/visulima/visulima/commit/137f53f7f5a4d8c16df511c9d145b2c158025a32))
- **vis, staged:** add env-var concurrency + fast-fail SIGKILL ([8fc5ae3](https://github.com/visulima/visulima/commit/8fc5ae3147901560f4b06848187da61d7a98819d))
- **vis, staged:** case-insensitive globs, auto-stage, parseConcurrent extraction ([671fa42](https://github.com/visulima/visulima/commit/671fa424f57cb1a94ef3d95be3d60b8632201675))
- **vis:** add `vis migrate kingfisher` for MongoDB Kingfisher users ([d7d8a5e](https://github.com/visulima/visulima/commit/d7d8a5e43c3d1d588180fcbe37e6789f68fa8d74))
- **vis:** add built-in staged-files workflow ([34c005a](https://github.com/visulima/visulima/commit/34c005a2fef371bda48139a5aba8c8858a1c8a42)), closes [#990](https://github.com/visulima/visulima/issues/990) [#1713](https://github.com/visulima/visulima/issues/1713) [#1722](https://github.com/visulima/visulima/issues/1722) [#33](https://github.com/visulima/visulima/issues/33)
- **vis:** add cache command for task runner cache ([#607](https://github.com/visulima/visulima/issues/607)) ([6752769](https://github.com/visulima/visulima/commit/67527692562b3dd9c03bb6a67c084ff1e694a560))
- **vis:** add info command for registry metadata lookup ([6e9c43d](https://github.com/visulima/visulima/commit/6e9c43d480445ff5b932193c44bbd9556cca3180))
- **vis:** add vis generate scaffolding command ([5e0bea1](https://github.com/visulima/visulima/commit/5e0bea179dd93bac8a5663e9d51a843c8f626c1b))
- **vis:** OTel plugin, --last-details, per-instance hook errors ([79c660f](https://github.com/visulima/visulima/commit/79c660f92e6982248dacd5e2bba0f113df338baf))
- **vis:** plugin API, task metadata, watch ergonomics, and run polish ([065c0dc](https://github.com/visulima/visulima/commit/065c0dc646f7e2769dcab9c01e0db52b401fcf99)), closes [#324](https://github.com/visulima/visulima/issues/324)
- **vis:** update secrets command for new scanner API + docs ([00bb0f0](https://github.com/visulima/visulima/commit/00bb0f057237e0ce88043f2c120d23b84f59d818))

### Bug Fixes

- **ci:** publish native addons via local semantic-release plugin ([974beb2](https://github.com/visulima/visulima/commit/974beb2d021e7b2afc86b958bd2137be88d2f464))
- **tooling:** resolve eslint and formatting issues ([399d292](https://github.com/visulima/visulima/commit/399d29282be5b29bb26b4e5b24d45e2a6cdeeca3))
- **tui:** inline component and hook barrel exports in ink entry ([1cf8dd2](https://github.com/visulima/visulima/commit/1cf8dd25c91a2001268fb9d964d95df649bf7832))
- **vis:** add missing space and drop extra line in update progress UI ([db1bac1](https://github.com/visulima/visulima/commit/db1bac1ecff50eac682a5cb33958cd30e4da2bf6))
- **vis:** filter truncated SBOM hashes that fail CycloneDX 1.6 schema validation ([34c7b22](https://github.com/visulima/visulima/commit/34c7b2268f68eac1095835aa65e21f998c3a63dc))
- **vis:** fixed types ([ff39190](https://github.com/visulima/visulima/commit/ff39190d92644bf592cbb1df81d69c224ede2bff))
- **vis:** harden vis generate edge cases and migrate moon templates ([ed37000](https://github.com/visulima/visulima/commit/ed3700059e34c2fb563890edf49fd6050ddfad37))
- **vis:** recover -- passthrough in generate and create commands ([688e6a9](https://github.com/visulima/visulima/commit/688e6a9b58766b341cc510d048669b753a30345a))
- **vis:** resolve type errors across commands, tui and utils ([187d460](https://github.com/visulima/visulima/commit/187d4607732799ac1711d2097f90666674850c75))

### Documentation

- **vis:** correct vis generate partial detection and lock CLI surface ([45b40a0](https://github.com/visulima/visulima/commit/45b40a072ffd61274309b3dbe63a3413e764cb9d))

### Miscellaneous Chores

- **api-platform:** apply pending lint and source updates ([3fb0043](https://github.com/visulima/visulima/commit/3fb0043a4cf35f752ca89a09a077100ae0142da8))
- bump engines.node to ^22.14.0 || >=24.10.0 ([c3d0931](https://github.com/visulima/visulima/commit/c3d0931d1504e4f21ebf50ea680cfa7ce4ba15ce))
- remove unused deprecated aliases ([#612](https://github.com/visulima/visulima/issues/612)) ([24ee546](https://github.com/visulima/visulima/commit/24ee546bcb2c17b8915622e4878797c00aa1d813))
- **vis:** apply pending lint and source updates ([f1f3a92](https://github.com/visulima/visulima/commit/f1f3a92c952d129cdcedae137de4b0e77ea787b4))
- **vis:** apply prettier and declare staged killSignal option ([23af135](https://github.com/visulima/visulima/commit/23af1357f19c22f3d4a67962ab2e28ac2ce64af1))
- **vis:** bump @eslint-react/eslint-plugin + fix revealed issues ([1c19670](https://github.com/visulima/visulima/commit/1c1967040e627d29857768150a992ff1e77fd3c1))
- **vis:** enforce curly braces and apply lint fixes ([9cf1d21](https://github.com/visulima/visulima/commit/9cf1d21f53bdb09fd93b30c7f9de758f16f8960d))
- **vis:** tighten toolbox, cache, and TUI typings ([a761ad7](https://github.com/visulima/visulima/commit/a761ad76d9200e1751e4ac1c7efd6619d1d1cde0))

### Code Refactoring

- replace inline import() types with top-level imports ([4569a4c](https://github.com/visulima/visulima/commit/4569a4ca04723da069f985855dcfab292f7347e1))
- **vis, staged:** move env-var concurrency fallback to the CLI layer ([31cb567](https://github.com/visulima/visulima/commit/31cb56767158e53f02ce2c5602a0221a774995b0))
- **vis:** read passthrough from toolbox.rawUnknown ([8d73d9c](https://github.com/visulima/visulima/commit/8d73d9c00924e02b98965d4cd89c8672a4fdffb8))
- **vis:** use @visulima/fs helpers, remove compiled artifacts from src ([dc03e7c](https://github.com/visulima/visulima/commit/dc03e7c053e8d7fb747cde38924efce6f489ca7f))

### Tests

- **vis:** add gated remote template integration test ([a626e56](https://github.com/visulima/visulima/commit/a626e5675630db044230400794a02d37ecbc0d31)), closes [visulima/visulima#alpha](https://github.com/visulima/visulima/issues/alpha)
- **vis:** remove native binding guard from tests ([40e8707](https://github.com/visulima/visulima/commit/40e870700930b1284701d0a33a72e589e1d3facd))

### Dependencies

- **@visulima/cerebro:** upgraded to 3.0.0-alpha.11
- **@visulima/secret-scanner:** upgraded to 1.0.0-alpha.1
- **@visulima/tui:** upgraded to 1.0.0-alpha.3

## @visulima/vis [1.0.0-alpha.5](https://github.com/visulima/visulima/compare/@visulima/vis@1.0.0-alpha.4...@visulima/vis@1.0.0-alpha.5) (2026-04-09)

### Features

- **vis:** add includeLocked, packageMode, depFields, maturity period to update command ([4cf85e1](https://github.com/visulima/visulima/commit/4cf85e163e392d9dd48c3119c13d3e7a7c9a782e))

### Bug Fixes

- **vis:** use camelCase option names for cerebro CLI flags ([7f187a5](https://github.com/visulima/visulima/commit/7f187a557eb85ced5e2995b4e1a7cebc61484c45))

### Documentation

- **vis:** document new update command options and configuration ([3e72240](https://github.com/visulima/visulima/commit/3e72240dbddebb3abf896a6c941e713ba460a73d))

### Tests

- **vis:** add tests for update command features and fix config tests ([52635db](https://github.com/visulima/visulima/commit/52635db43243e47f781bc8bd3e79d620b72ecfb5))

### Dependencies

- **@visulima/tui:** upgraded to 1.0.0-alpha.2

## @visulima/vis [1.0.0-alpha.4](https://github.com/visulima/visulima/compare/@visulima/vis@1.0.0-alpha.3...@visulima/vis@1.0.0-alpha.4) (2026-04-08)

### Features

- add comprehensive `vis create` scaffolding command ([#602](https://github.com/visulima/visulima/issues/602)) ([e029146](https://github.com/visulima/visulima/commit/e0291469fc8c55e76721333a20753c802820d3de))
- Add native Rust bindings for package manager operations ([#596](https://github.com/visulima/visulima/issues/596)) ([2ec22d0](https://github.com/visulima/visulima/commit/2ec22d023eade3fed67fb811696fbd8f7b52569d))
- Add Socket.dev security intelligence integration ([#599](https://github.com/visulima/visulima/issues/599)) ([c2e2b8a](https://github.com/visulima/visulima/commit/c2e2b8a55d1688c43b1deed82b8d954bc294fa11))
- Add sort-package-json command with native Rust implementation ([#601](https://github.com/visulima/visulima/issues/601)) ([8c5d2c3](https://github.com/visulima/visulima/commit/8c5d2c311d30077384df1b9194a870ac6687a0a4))
- Add typosquat detection for package names ([#603](https://github.com/visulima/visulima/issues/603)) ([16ef5e8](https://github.com/visulima/visulima/commit/16ef5e8acc3670cf1bf883f7a5d9483f331b6133))
- **cerebro:** add addGlobalOption API for CLI-wide options ([ccc1cc0](https://github.com/visulima/visulima/commit/ccc1cc085ed0189be49ab8da7d9dbbc69ba07c72))
- **task-runner, vis:** project constraints, CI partitioning, affected scopes ([29295e9](https://github.com/visulima/visulima/commit/29295e989ecdfe2019469d1917a6c90a92e17bcf))
- **tui:** add TreeView component with keyboard navigation and selection ([f3421e3](https://github.com/visulima/visulima/commit/f3421e36540f8c7a229e0176c683cb94c0d46e0f))
- **vis:** add ignore option to update config and check non-catalog package.json deps ([27e22dd](https://github.com/visulima/visulima/commit/27e22dd7efa30b7d77b8360b9eac9c7245de92a7))
- **vis:** add interactive devcontainer command for creating/editing .devcontainer/devcontainer.json ([9e1665f](https://github.com/visulima/visulima/commit/9e1665fb5a8cee7979a15d6b0a4ba7fa10cfe27c))
- **vis:** add interactive progress bar and replace CI detection with is-in-ci ([255a1b1](https://github.com/visulima/visulima/commit/255a1b100d0dd4bc614094f292b61fc88bc4ad62))
- **vis:** add interactive TUI for update and check commands ([3e96e7e](https://github.com/visulima/visulima/commit/3e96e7e68c444368ed91bc0654bbbfb9b857e7c5))
- **vis:** add navigation and scrollbar to run command task list ([83abf11](https://github.com/visulima/visulima/commit/83abf11670ea924e9df0a966bd9ce1049dcdcb5e))
- **vis:** add terminal links, use cerebro performance helpers ([abc7f89](https://github.com/visulima/visulima/commit/abc7f8937ce43c8446e422f48e5e307b7d0843b0))
- **vis:** add TUI lifecycles with dynamic and static terminal output ([d7eeae1](https://github.com/visulima/visulima/commit/d7eeae1e51c4ffa707f7506ef0ed2f7860f37faf))
- **vis:** expand devcontainer command with templates, validation, and config properties ([807e730](https://github.com/visulima/visulima/commit/807e730a43f0ea644d016b4f5506706972d2ff41))
- **vis:** group CLI commands into logical categories for help output ([0a4cac8](https://github.com/visulima/visulima/commit/0a4cac859c8edf7aacdacca7b9a03219967d525a))
- **vis:** interactive TUI graph viewer, enriched sample workspace ([b821f34](https://github.com/visulima/visulima/commit/b821f34b5b125aef107c7bca1b2aab7d84826651))
- **vis:** redesign TUI with 3-view architecture and NX-style layout ([72da46f](https://github.com/visulima/visulima/commit/72da46fd9dac1227c0abc80709196e7c9b89c017))
- **vis:** replace inline TUI with full-screen Nx-style interactive task runner ([1409aad](https://github.com/visulima/visulima/commit/1409aad879c713051bba12298a3feb1d5ba852f2))
- **vis:** set terminal title to project name on startup ([204622a](https://github.com/visulima/visulima/commit/204622acd943ccad738b33f5e945190e38f5839f))
- **vis:** use concurrent process runner with bounded output buffering ([901c02f](https://github.com/visulima/visulima/commit/901c02fc5a5e131c1d3316c869b321390de901a4))

### Bug Fixes

- resolve failing tests across multiple packages ([2b4b6f0](https://github.com/visulima/visulima/commit/2b4b6f04169b60fdc4cf77b293015436a272c0fb))
- **tsconfig:** add node types and fix implicit any parameter ([1744d82](https://github.com/visulima/visulima/commit/1744d82a07fca03f2e6ff660b918e9b2623acf69))
- **tui:** apply upstream ResizeObserver NaN guard and measurement extraction ([bcd4fd1](https://github.com/visulima/visulima/commit/bcd4fd16e7e0fda7d3de09657dfe76ce46fa370a))
- **tui:** prevent interactive apps from exiting on beforeExit ([449e84c](https://github.com/visulima/visulima/commit/449e84ca739d9dd48728f40ad9514359306f9527))
- **vis,tui:** fix 10 code review issues across TUI components ([3410347](https://github.com/visulima/visulima/commit/34103473cb661cca4187661e59b396eecff1bdec))
- **vis,tui:** validate directory in detectPm and use useLayoutEffect in StaticRender ([de53e9b](https://github.com/visulima/visulima/commit/de53e9b7a944a3778f0d10f1daa1653a1063d9b3))
- **vis:** add explicit type annotation for isolatedDeclarations compatibility ([235d389](https://github.com/visulima/visulima/commit/235d389f8fd3ffa4de2d867eaff781dccd99be20))
- **vis:** add explicit type annotations for isolatedDeclarations compatibility ([5a5f35c](https://github.com/visulima/visulima/commit/5a5f35cd0e92aff38f4c7bd8f31dda5e813ff568))
- **vis:** exclude native binding deps from unused dependency check ([0e8409e](https://github.com/visulima/visulima/commit/0e8409e66676803fb1494fa32df64cdc44969966))
- **vis:** expand StagedConfig type and support Bun object-form workspaces ([af810bc](https://github.com/visulima/visulima/commit/af810bc10a512ec0ed390152e9d59ece681f7360))
- **vis:** fix broken lib-a dep in sample workspace example ([538b7d4](https://github.com/visulima/visulima/commit/538b7d42d0b09313ff87342143f0c7502788092b))
- **vis:** fix failing tests across tui, catalog, and pm-runner modules ([1c29189](https://github.com/visulima/visulima/commit/1c29189ad39061085cc10ca316d1128d52e88811))
- **vis:** fix tips CI test by resetting modules before doMock ([c578ef5](https://github.com/visulima/visulima/commit/c578ef55c1176397448136c8e190992cdf50eb08))
- **vis:** improve devcontainer TUI scrolling, mount suggestions, and review fixes ([6bb03da](https://github.com/visulima/visulima/commit/6bb03dae9f48d9a6461bdfce2ad29da3f16c4ecf))
- **vis:** overhaul TUI with pail InteractiveManager and tabular layout ([ecab9ff](https://github.com/visulima/visulima/commit/ecab9ffc61531b76a58b89202401f1266a5decea))
- **vis:** resolve eslint errors ([b9ee58b](https://github.com/visulima/visulima/commit/b9ee58b179588fa9f3c08178f26dac7cc8e7f6c5))
- **vis:** resolve test failures across multiple modules ([5728d8a](https://github.com/visulima/visulima/commit/5728d8aabae0fb0bb8c64527f61b8663b73148f2))
- **vis:** support Bun object-form workspaces in migration catalog handling ([f44a17f](https://github.com/visulima/visulima/commit/f44a17fe7836febfac4012f744438df70f36af6b))
- **vis:** TUI polish - compact split, responsive layout, double output fix ([e0487ea](https://github.com/visulima/visulima/commit/e0487ea735ecc2734046ccaedc9588a8ca165674)), closes [#1e1e1e](https://github.com/visulima/visulima/issues/1e1e1e)

### Performance Improvements

- **vis:** wrap immutable TUI components with StaticRender ([00e47e9](https://github.com/visulima/visulima/commit/00e47e9f7a6c562570e0b090b7940389451aa1ef))

### Styles

- cs fixs ([0666662](https://github.com/visulima/visulima/commit/066666293c50cde41c796dc38b4b62c48531a3c0))

### Miscellaneous Chores

- added og images ([02d9d1e](https://github.com/visulima/visulima/commit/02d9d1e47be3ce75679ea89e857dc4e4bfe4946b))
- apply linting and formatting fixes across packages ([5d150a5](https://github.com/visulima/visulima/commit/5d150a578f9ce861c791843c683deeb849b774a9))
- update git ignore ([67ac9cf](https://github.com/visulima/visulima/commit/67ac9cfd5969f54fbbbb426b3277472f75b0d520))
- update license.md ([d4fb70e](https://github.com/visulima/visulima/commit/d4fb70ec954722345967ef2c607322402d25f2d9))
- update lock file ([e58ef7c](https://github.com/visulima/visulima/commit/e58ef7c5764fc262e72504f31b4d97def449ee89))
- **vis:** add .gitignore for cache, update changelog and lint fixes ([32d5ae8](https://github.com/visulima/visulima/commit/32d5ae841e79cb436273a73003ca42e610e912a5))
- **vis:** apply auto-fix formatting ([098aa0f](https://github.com/visulima/visulima/commit/098aa0fabf17efee373987006a9ed9bad150f69d))
- **vis:** apply linter auto-fixes ([c6ca2aa](https://github.com/visulima/visulima/commit/c6ca2aa6b648fcb90ef16a24502bbc753cdce712))
- **vis:** apply prettier formatting ([05476bc](https://github.com/visulima/visulima/commit/05476bc9d9c1fd8a34423081159558576bfa6490))
- **vis:** expand braceless if/else statements to block syntax ([85f2595](https://github.com/visulima/visulima/commit/85f259532872b6d478e96a42b8122db6730ef280))
- **vis:** expand inline if-return to block syntax ([69a6c77](https://github.com/visulima/visulima/commit/69a6c7778eb40c33fd945e85a1c11607ae8c62c5))
- **vis:** migrate .prettierrc.cjs to prettier.config.js ([2caed59](https://github.com/visulima/visulima/commit/2caed5911cd31a89f4db68c570a11cc74080820a))

### Code Refactoring

- **vis:** address review findings across optimize and audit ([317dca8](https://github.com/visulima/visulima/commit/317dca88a16f6604c267f9240556d7e15a563a95))
- **vis:** apply Nothing design system to TUI components ([3d0517d](https://github.com/visulima/visulima/commit/3d0517d6225f75ea2e2ccf6170efdfa7911bf0c2))
- **vis:** unify TUI style across run and update commands ([2c85520](https://github.com/visulima/visulima/commit/2c855204a1972596e079a42e12b3a79aba6c657c))
- **vis:** update commands, TUI components, and project scaffolding ([26b40fb](https://github.com/visulima/visulima/commit/26b40fb3521411f750d176ad638c353bd7e36f44))

### Tests

- **vis:** add 50 sample workspace packages for TUI testing ([579d05b](https://github.com/visulima/visulima/commit/579d05b46e2f5bad73297dfab823016663d3041e))

### Build System

- regenerate NAPI-RS bindings as ESM ([f202caf](https://github.com/visulima/visulima/commit/f202caf3dc383a2ec24815c4935d8d68c29f33d0))
- switch NAPI-RS native builds to ESM output ([3d7cd61](https://github.com/visulima/visulima/commit/3d7cd615ad830392005915735c11771e0247ef3f))

### Continuous Integration

- distribute native artifacts for all three packages (task-runner, tui, vis) ([78760ec](https://github.com/visulima/visulima/commit/78760ec805ee4ed38a134ab18fa39b398527cef9))

### Dependencies

- **@visulima/ansi:** upgraded to 4.0.0-alpha.8
- **@visulima/cerebro:** upgraded to 3.0.0-alpha.10
- **@visulima/colorize:** upgraded to 2.0.0-alpha.8
- **@visulima/find-ai-runner:** upgraded to 1.0.0-alpha.3
- **@visulima/find-cache-dir:** upgraded to 3.0.0-alpha.7
- **@visulima/fs:** upgraded to 5.0.0-alpha.7
- **@visulima/humanizer:** upgraded to 3.0.0-alpha.9
- **@visulima/package:** upgraded to 5.0.0-alpha.7
- **@visulima/path:** upgraded to 3.0.0-alpha.8
- **@visulima/task-runner:** upgraded to 1.0.0-alpha.4
- **@visulima/tui:** upgraded to 1.0.0-alpha.1

## @visulima/vis [1.0.0-alpha.3](https://github.com/visulima/visulima/compare/@visulima/vis@1.0.0-alpha.2...@visulima/vis@1.0.0-alpha.3) (2026-03-26)

### Features

- **web:** auto-generate packages page from workspace metadata ([623e520](https://github.com/visulima/visulima/commit/623e5207693a7fe720f5f2f179593a3654c880e3))

### Dependencies

- **@visulima/boxen:** upgraded to 3.0.0-alpha.8
- **@visulima/cerebro:** upgraded to 3.0.0-alpha.9
- **@visulima/find-ai-runner:** upgraded to 1.0.0-alpha.2
- **@visulima/fs:** upgraded to 5.0.0-alpha.6
- **@visulima/package:** upgraded to 5.0.0-alpha.6
- **@visulima/path:** upgraded to 3.0.0-alpha.7
- **@visulima/tabular:** upgraded to 4.0.0-alpha.8
- **@visulima/task-runner:** upgraded to 1.0.0-alpha.3

## @visulima/vis [1.0.0-alpha.2](https://github.com/visulima/visulima/compare/@visulima/vis@1.0.0-alpha.1...@visulima/vis@1.0.0-alpha.2) (2026-03-26)

### Dependencies

- **@visulima/task-runner:** upgraded to 1.0.0-alpha.2

## @visulima/vis 1.0.0-alpha.1 (2026-03-26)

### Features

- Add @visulima/task-runner , vis and find-ai-runner ([#594](https://github.com/visulima/visulima/issues/594)) ([034b5db](https://github.com/visulima/visulima/commit/034b5db8aadcc02e23abe007208c5196859c7755))

### Bug Fixes

- **vis:** fall back to package.json deps when pnpm/bun have no catalogs ([8da8e19](https://github.com/visulima/visulima/commit/8da8e190a40abc22e18e3af740a594edc8cc382d))
- **vis:** isolate loadNpmrc test from host ~/.npmrc ([a7016d6](https://github.com/visulima/visulima/commit/a7016d6ce8770c1d462ebfb9b2dab530fcedac5d))

### Dependencies

- **@visulima/boxen:** upgraded to 3.0.0-alpha.7
- **@visulima/cerebro:** upgraded to 3.0.0-alpha.8
- **@visulima/find-ai-runner:** upgraded to 1.0.0-alpha.1
- **@visulima/fs:** upgraded to 5.0.0-alpha.5
- **@visulima/package:** upgraded to 5.0.0-alpha.5
- **@visulima/path:** upgraded to 3.0.0-alpha.6
- **@visulima/tabular:** upgraded to 4.0.0-alpha.7
- **@visulima/task-runner:** upgraded to 1.0.0-alpha.1
