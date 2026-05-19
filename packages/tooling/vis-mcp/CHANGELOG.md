## @visulima/vis-mcp [1.0.0-alpha.12](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.11...@visulima/vis-mcp@1.0.0-alpha.12) (2026-05-19)


### Dependencies

* **@visulima/fs:** upgraded to 5.0.0-alpha.24
* **@visulima/vis:** upgraded to 1.0.0-alpha.22

## @visulima/vis-mcp [1.0.0-alpha.11](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.10...@visulima/vis-mcp@1.0.0-alpha.11) (2026-05-16)


### Dependencies

* **@visulima/fs:** upgraded to 5.0.0-alpha.23
* **@visulima/vis:** upgraded to 1.0.0-alpha.21

## @visulima/vis-mcp [1.0.0-alpha.10](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.9...@visulima/vis-mcp@1.0.0-alpha.10) (2026-05-14)

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

* **vis:** offline OSV scanner + unified security.policies ([#632](https://github.com/visulima/visulima/issues/632)) ([6461902](https://github.com/visulima/visulima/commit/646190243bf51bb6df172665d70fd501644e7bc3)), closes [#631](https://github.com/visulima/visulima/issues/631) [#631](https://github.com/visulima/visulima/issues/631) [yarnpkg/berry#6991](https://github.com/yarnpkg/berry/issues/6991)


### Dependencies

* **@visulima/fs:** upgraded to 5.0.0-alpha.22
* **@visulima/vis:** upgraded to 1.0.0-alpha.20

## @visulima/vis-mcp [1.0.0-alpha.9](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.8...@visulima/vis-mcp@1.0.0-alpha.9) (2026-05-11)


### Dependencies

* **@visulima/fs:** upgraded to 5.0.0-alpha.21
* **@visulima/vis:** upgraded to 1.0.0-alpha.19

## @visulima/vis-mcp [1.0.0-alpha.8](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.7...@visulima/vis-mcp@1.0.0-alpha.8) (2026-05-11)


### Dependencies

* **@visulima/fs:** upgraded to 5.0.0-alpha.20
* **@visulima/vis:** upgraded to 1.0.0-alpha.18

## @visulima/vis-mcp [1.0.0-alpha.7](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.6...@visulima/vis-mcp@1.0.0-alpha.7) (2026-05-10)


### Dependencies

* **@visulima/fs:** upgraded to 5.0.0-alpha.19
* **@visulima/vis:** upgraded to 1.0.0-alpha.17

## @visulima/vis-mcp [1.0.0-alpha.6](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.5...@visulima/vis-mcp@1.0.0-alpha.6) (2026-05-10)


### Dependencies

* **@visulima/fs:** upgraded to 5.0.0-alpha.18
* **@visulima/vis:** upgraded to 1.0.0-alpha.16

## @visulima/vis-mcp [1.0.0-alpha.5](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.4...@visulima/vis-mcp@1.0.0-alpha.5) (2026-05-07)


### Dependencies

* **@visulima/fs:** upgraded to 5.0.0-alpha.17
* **@visulima/vis:** upgraded to 1.0.0-alpha.15

## @visulima/vis-mcp [1.0.0-alpha.4](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.3...@visulima/vis-mcp@1.0.0-alpha.4) (2026-05-07)

### Miscellaneous Chores

* **vis-mcp:** bump eslint-plugin-zod and sort package.json keys ([787abc4](https://github.com/visulima/visulima/commit/787abc46e1b637fdb8968a492cd923537e404fbe))


### Dependencies

* **@visulima/fs:** upgraded to 5.0.0-alpha.16
* **@visulima/vis:** upgraded to 1.0.0-alpha.14

## @visulima/vis-mcp [1.0.0-alpha.3](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.2...@visulima/vis-mcp@1.0.0-alpha.3) (2026-05-06)


### Dependencies

* **@visulima/fs:** upgraded to 5.0.0-alpha.15
* **@visulima/vis:** upgraded to 1.0.0-alpha.13

## @visulima/vis-mcp [1.0.0-alpha.2](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.1...@visulima/vis-mcp@1.0.0-alpha.2) (2026-05-06)

### Miscellaneous Chores

* **vis-mcp:** housekeeping cleanup ([947eff5](https://github.com/visulima/visulima/commit/947eff503b5e170194f7f8e21bea2ab82b0786bf))


### Dependencies

* **@visulima/fs:** upgraded to 5.0.0-alpha.14
* **@visulima/vis:** upgraded to 1.0.0-alpha.12

## @visulima/vis-mcp 1.0.0-alpha.1 (2026-05-04)

### Features

* **vis-mcp:** add list_templates and describe_template tools ([549ea7e](https://github.com/visulima/visulima/commit/549ea7edbe88e3dde40e09cf5f5eaea80bb8fd58))
* **vis-mcp:** add MCP server package for AI-agent integration ([a8d5022](https://github.com/visulima/visulima/commit/a8d5022ba905481985378c0ac01e7f654608ec2b))

### Miscellaneous Chores

* **vis-mcp:** adopt zod v4 catalog and bump @modelcontextprotocol/sdk ([a84ceb1](https://github.com/visulima/visulima/commit/a84ceb1efcfb368c361eb738006f2e7f113ac4c7))


### Dependencies

* **@visulima/fs:** upgraded to 5.0.0-alpha.13
* **@visulima/vis:** upgraded to 1.0.0-alpha.11
