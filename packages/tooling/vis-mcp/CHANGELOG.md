## @visulima/vis-mcp [1.0.5](https://github.com/visulima/visulima/compare/%40visulima%2Fvis-mcp%401.0.4...%40visulima%2Fvis-mcp%401.0.5) (2026-07-19)


### Dependencies

* **@visulima/fs:** upgraded to 5.0.5
* **@visulima/vis:** upgraded to 1.0.5

## @visulima/vis-mcp [1.0.4](https://github.com/visulima/visulima/compare/%40visulima%2Fvis-mcp%401.0.3...%40visulima%2Fvis-mcp%401.0.4) (2026-07-17)


### Dependencies

* **@visulima/fs:** upgraded to 5.0.4
* **@visulima/vis:** upgraded to 1.0.4

## @visulima/vis-mcp [1.0.3](https://github.com/visulima/visulima/compare/%40visulima%2Fvis-mcp%401.0.2...%40visulima%2Fvis-mcp%401.0.3) (2026-07-17)


### Dependencies

* **@visulima/fs:** upgraded to 5.0.3
* **@visulima/vis:** upgraded to 1.0.3

## @visulima/vis-mcp [1.0.2](https://github.com/visulima/visulima/compare/%40visulima%2Fvis-mcp%401.0.1...%40visulima%2Fvis-mcp%401.0.2) (2026-07-15)


### Dependencies

* **@visulima/fs:** upgraded to 5.0.2
* **@visulima/vis:** upgraded to 1.0.2

## @visulima/vis-mcp [1.0.1](https://github.com/visulima/visulima/compare/%40visulima%2Fvis-mcp%401.0.0...%40visulima%2Fvis-mcp%401.0.1) (2026-07-15)


### Dependencies

* **@visulima/fs:** upgraded to 5.0.1
* **@visulima/vis:** upgraded to 1.0.1

## @visulima/vis-mcp 1.0.0 (2026-07-03)

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

* **vis-mcp:** add audit/advisory/lint/fmt/list_runs tools and structured output ([4918e4b](https://github.com/visulima/visulima/commit/4918e4bb176508065bc8a578141beb79316c530d))
* **vis-mcp:** add list_templates and describe_template tools ([549ea7e](https://github.com/visulima/visulima/commit/549ea7edbe88e3dde40e09cf5f5eaea80bb8fd58))
* **vis-mcp:** add MCP server package for AI-agent integration ([a8d5022](https://github.com/visulima/visulima/commit/a8d5022ba905481985378c0ac01e7f654608ec2b))
* **vis:** lint + fmt orchestrator ([3a78ed7](https://github.com/visulima/visulima/commit/3a78ed709922e6a35648e0d0eb3f41cc49f89b7a))
* **vis:** offline OSV scanner + unified security.policies ([#632](https://github.com/visulima/visulima/issues/632)) ([6461902](https://github.com/visulima/visulima/commit/646190243bf51bb6df172665d70fd501644e7bc3)), closes [#631](https://github.com/visulima/visulima/issues/631) [#631](https://github.com/visulima/visulima/issues/631) [yarnpkg/berry#6991](https://github.com/yarnpkg/berry/issues/6991)

### Bug Fixes

* **storage-client:** percent-encode user fields in defaultFingerprint ([7c78a0f](https://github.com/visulima/visulima/commit/7c78a0f9512e2a673b941d80839e9f1e86b7b5d0))
* **tests:** revert unsafe vitest autofixes from the lint sweep ([378f27c](https://github.com/visulima/visulima/commit/378f27caa370f1d3188aef2ed36d46839abc88c4))
* **vis-mcp:** 1 bug fix ([33cd25e](https://github.com/visulima/visulima/commit/33cd25ecbcea0185e4cab1e3d49ba0fd41206d67))
* **vis:** unbreak full build — exclude variable-import modules from dynamic-import-vars ([#712](https://github.com/visulima/visulima/issues/712)) ([29d46eb](https://github.com/visulima/visulima/commit/29d46eb719de11ab8f09e5303748264607b04fe3)), closes [#697](https://github.com/visulima/visulima/issues/697) [#697](https://github.com/visulima/visulima/issues/697) [#697](https://github.com/visulima/visulima/issues/697) [#697](https://github.com/visulima/visulima/issues/697)

### Miscellaneous Chores

* add fallow code-intelligence across all packages ([a3b4821](https://github.com/visulima/visulima/commit/a3b48215002e86fed20f2973038b5d4a0aa1ce04))
* apply eslint + prettier autofixes across packages ([c1bb784](https://github.com/visulima/visulima/commit/c1bb7848a0d93d0dfe2960c77e3cda22239c79a0))
* **ci-stability:** green CI across vis, native, lint, tests, attw ([#651](https://github.com/visulima/visulima/issues/651)) ([d4eb684](https://github.com/visulima/visulima/commit/d4eb684b5f75c818c9251048c605a0ed54a268e3))
* **release:** @visulima/vis-mcp@1.0.0-alpha.1 [skip ci]\n\n## @visulima/vis-mcp 1.0.0-alpha.1 (2026-05-04) ([4bea1b6](https://github.com/visulima/visulima/commit/4bea1b639140431c9fa25656d4a2225ddb1073d1))
* **release:** @visulima/vis-mcp@1.0.0-alpha.10 [skip ci]\n\n## @visulima/vis-mcp [1.0.0-alpha.10](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.9...@visulima/vis-mcp@1.0.0-alpha.10) (2026-05-14) ([aa118b9](https://github.com/visulima/visulima/commit/aa118b9acab23ace6523bc1b1b6ed2b5b5c4b69f))
* **release:** @visulima/vis-mcp@1.0.0-alpha.11 [skip ci]\n\n## @visulima/vis-mcp [1.0.0-alpha.11](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.10...@visulima/vis-mcp@1.0.0-alpha.11) (2026-05-16) ([e1c0f42](https://github.com/visulima/visulima/commit/e1c0f42676885a1ae0dbe867f2d3750ea2b60816))
* **release:** @visulima/vis-mcp@1.0.0-alpha.12 [skip ci]\n\n## @visulima/vis-mcp [1.0.0-alpha.12](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.11...@visulima/vis-mcp@1.0.0-alpha.12) (2026-05-19) ([df08589](https://github.com/visulima/visulima/commit/df085896065d7ee11b0ac48119cbc4d18542bce2))
* **release:** @visulima/vis-mcp@1.0.0-alpha.13 [skip ci]\n\n## @visulima/vis-mcp [1.0.0-alpha.13](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.12...@visulima/vis-mcp@1.0.0-alpha.13) (2026-05-20) ([6ac5046](https://github.com/visulima/visulima/commit/6ac50469ba4193756ce27e60010bf7725dd214e9))
* **release:** @visulima/vis-mcp@1.0.0-alpha.14 [skip ci]\n\n## @visulima/vis-mcp [1.0.0-alpha.14](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.13...@visulima/vis-mcp@1.0.0-alpha.14) (2026-05-26) ([a816f32](https://github.com/visulima/visulima/commit/a816f32ca84ad91e6a36fa852453dfdb095e218c))
* **release:** @visulima/vis-mcp@1.0.0-alpha.15 [skip ci]\n\n## @visulima/vis-mcp [1.0.0-alpha.15](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.14...@visulima/vis-mcp@1.0.0-alpha.15) (2026-05-27) ([8c626df](https://github.com/visulima/visulima/commit/8c626df8cfe37b190c7199446012be356b380dbb))
* **release:** @visulima/vis-mcp@1.0.0-alpha.16 [skip ci]\n\n## @visulima/vis-mcp [1.0.0-alpha.16](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.15...@visulima/vis-mcp@1.0.0-alpha.16) (2026-05-29) ([7f98d00](https://github.com/visulima/visulima/commit/7f98d002e55a7c70f70ef4648bc6622bb4bb2686))
* **release:** @visulima/vis-mcp@1.0.0-alpha.17 [skip ci]\n\n## @visulima/vis-mcp [1.0.0-alpha.17](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.16...@visulima/vis-mcp@1.0.0-alpha.17) (2026-06-02) ([5e112bb](https://github.com/visulima/visulima/commit/5e112bbcfc982bafa6a18d38916d172dbe209717))
* **release:** @visulima/vis-mcp@1.0.0-alpha.18 [skip ci]\n\n## @visulima/vis-mcp [1.0.0-alpha.18](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.17...@visulima/vis-mcp@1.0.0-alpha.18) (2026-06-03) ([8cb3d99](https://github.com/visulima/visulima/commit/8cb3d990a30e5765f52b2a558064c7e2cd29d759))
* **release:** @visulima/vis-mcp@1.0.0-alpha.19 [skip ci]\n\n## @visulima/vis-mcp [1.0.0-alpha.19](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.18...@visulima/vis-mcp@1.0.0-alpha.19) (2026-06-04) ([8210e8c](https://github.com/visulima/visulima/commit/8210e8cad57916e4b8736dcb95e640a40dda713f))
* **release:** @visulima/vis-mcp@1.0.0-alpha.2 [skip ci]\n\n## @visulima/vis-mcp [1.0.0-alpha.2](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.1...@visulima/vis-mcp@1.0.0-alpha.2) (2026-05-06) ([fcf91fa](https://github.com/visulima/visulima/commit/fcf91fa4c22cf3314b57bd45a28e67281351e65d))
* **release:** @visulima/vis-mcp@1.0.0-alpha.20 [skip ci]\n\n## @visulima/vis-mcp [1.0.0-alpha.20](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.19...@visulima/vis-mcp@1.0.0-alpha.20) (2026-06-04) ([7000c46](https://github.com/visulima/visulima/commit/7000c4608e54de019a93562c2255c96fca1afb7d))
* **release:** @visulima/vis-mcp@1.0.0-alpha.21 [skip ci]\n\n## @visulima/vis-mcp [1.0.0-alpha.21](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.20...@visulima/vis-mcp@1.0.0-alpha.21) (2026-06-06) ([3abc667](https://github.com/visulima/visulima/commit/3abc66722bea0d69730b60bec445cd1e2b9ae948))
* **release:** @visulima/vis-mcp@1.0.0-alpha.22 [skip ci]\n\n## @visulima/vis-mcp [1.0.0-alpha.22](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.21...@visulima/vis-mcp@1.0.0-alpha.22) (2026-06-07) ([3062334](https://github.com/visulima/visulima/commit/306233441335f5e36b6ffc386f9233c98b529631))
* **release:** @visulima/vis-mcp@1.0.0-alpha.23 [skip ci]\n\n## @visulima/vis-mcp [1.0.0-alpha.23](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.22...@visulima/vis-mcp@1.0.0-alpha.23) (2026-06-07) ([9262893](https://github.com/visulima/visulima/commit/92628936ed49da4277a06ffea13163f87278cbd2))
* **release:** @visulima/vis-mcp@1.0.0-alpha.24 [skip ci]\n\n## @visulima/vis-mcp [1.0.0-alpha.24](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.23...@visulima/vis-mcp@1.0.0-alpha.24) (2026-06-08) ([8f8c3dc](https://github.com/visulima/visulima/commit/8f8c3dcedab8d80818a07b35642f09b1791801ed))
* **release:** @visulima/vis-mcp@1.0.0-alpha.25 [skip ci]\n\n## @visulima/vis-mcp [1.0.0-alpha.25](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.24...@visulima/vis-mcp@1.0.0-alpha.25) (2026-06-09) ([fd66314](https://github.com/visulima/visulima/commit/fd6631451ed09ec1096800d06f09bd3d70e609f6))
* **release:** @visulima/vis-mcp@1.0.0-alpha.26 [skip ci]\n\n## @visulima/vis-mcp [1.0.0-alpha.26](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.25...@visulima/vis-mcp@1.0.0-alpha.26) (2026-06-13) ([9bcbaa2](https://github.com/visulima/visulima/commit/9bcbaa2ab0334786180881c36d85cad6782f715d))
* **release:** @visulima/vis-mcp@1.0.0-alpha.27 [skip ci]\n\n## @visulima/vis-mcp [1.0.0-alpha.27](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.26...@visulima/vis-mcp@1.0.0-alpha.27) (2026-06-15) ([13222ff](https://github.com/visulima/visulima/commit/13222ffedbc93110bc557e9574470d9d2076490b))
* **release:** @visulima/vis-mcp@1.0.0-alpha.28 [skip ci]\n\n## @visulima/vis-mcp [1.0.0-alpha.28](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.27...@visulima/vis-mcp@1.0.0-alpha.28) (2026-06-16) ([41bbb5f](https://github.com/visulima/visulima/commit/41bbb5f5aaf36382dfeb5dcf97565c23dfceb3ac))
* **release:** @visulima/vis-mcp@1.0.0-alpha.29 [skip ci]\n\n## @visulima/vis-mcp [1.0.0-alpha.29](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.28...@visulima/vis-mcp@1.0.0-alpha.29) (2026-06-16) ([6b911f6](https://github.com/visulima/visulima/commit/6b911f682352b8c3cea5f589f9e11c336c4192ce))
* **release:** @visulima/vis-mcp@1.0.0-alpha.3 [skip ci]\n\n## @visulima/vis-mcp [1.0.0-alpha.3](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.2...@visulima/vis-mcp@1.0.0-alpha.3) (2026-05-06) ([30cfcda](https://github.com/visulima/visulima/commit/30cfcdabff162902ed53e018420f53967c6d2d9a))
* **release:** @visulima/vis-mcp@1.0.0-alpha.30 [skip ci]\n\n## @visulima/vis-mcp [1.0.0-alpha.30](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.29...@visulima/vis-mcp@1.0.0-alpha.30) (2026-06-17) ([ba5f8d2](https://github.com/visulima/visulima/commit/ba5f8d261ab2f0907ae0a8e46f54c0217205bf0e))
* **release:** @visulima/vis-mcp@1.0.0-alpha.31 [skip ci]\n\n## @visulima/vis-mcp [1.0.0-alpha.31](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.30...@visulima/vis-mcp@1.0.0-alpha.31) (2026-06-19) ([ec79624](https://github.com/visulima/visulima/commit/ec7962425122ed9cbd534a159da1909fc290da0b))
* **release:** @visulima/vis-mcp@1.0.0-alpha.32 [skip ci]\n\n## @visulima/vis-mcp [1.0.0-alpha.32](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.31...@visulima/vis-mcp@1.0.0-alpha.32) (2026-06-19) ([581a6ef](https://github.com/visulima/visulima/commit/581a6ef35da1471486c6f8e1f63603a5b29d4e8e))
* **release:** @visulima/vis-mcp@1.0.0-alpha.33 [skip ci]\n\n## @visulima/vis-mcp [1.0.0-alpha.33](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.32...@visulima/vis-mcp@1.0.0-alpha.33) (2026-06-20) ([d23610f](https://github.com/visulima/visulima/commit/d23610f925906eae32512f8cece804d6d17e980c))
* **release:** @visulima/vis-mcp@1.0.0-alpha.34 [skip ci]\n\n## @visulima/vis-mcp [1.0.0-alpha.34](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.33...@visulima/vis-mcp@1.0.0-alpha.34) (2026-06-23) ([a90381f](https://github.com/visulima/visulima/commit/a90381f477ffb2638ac37a7cdfc6bb25a28d89be))
* **release:** @visulima/vis-mcp@1.0.0-alpha.35 [skip ci]\n\n## @visulima/vis-mcp [1.0.0-alpha.35](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.34...@visulima/vis-mcp@1.0.0-alpha.35) (2026-06-30) ([a4ccaf6](https://github.com/visulima/visulima/commit/a4ccaf66eba5dbd6e81567e369c2bed6902ad8ff))
* **release:** @visulima/vis-mcp@1.0.0-alpha.36 [skip ci]\n\n## @visulima/vis-mcp [1.0.0-alpha.36](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.35...@visulima/vis-mcp@1.0.0-alpha.36) (2026-07-01) ([beca008](https://github.com/visulima/visulima/commit/beca00876cd9282fb703063c3074e6ea8843af85))
* **release:** @visulima/vis-mcp@1.0.0-alpha.37 [skip ci]\n\n## @visulima/vis-mcp [1.0.0-alpha.37](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.36...@visulima/vis-mcp@1.0.0-alpha.37) (2026-07-03) ([105c996](https://github.com/visulima/visulima/commit/105c996f6433c5609bdbeb7b045508a8da5acda5))
* **release:** @visulima/vis-mcp@1.0.0-alpha.4 [skip ci]\n\n## @visulima/vis-mcp [1.0.0-alpha.4](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.3...@visulima/vis-mcp@1.0.0-alpha.4) (2026-05-07) ([1783ff4](https://github.com/visulima/visulima/commit/1783ff4dfcdfa2930876d1a21ebc4494fa25e26d))
* **release:** @visulima/vis-mcp@1.0.0-alpha.5 [skip ci]\n\n## @visulima/vis-mcp [1.0.0-alpha.5](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.4...@visulima/vis-mcp@1.0.0-alpha.5) (2026-05-07) ([11fdc83](https://github.com/visulima/visulima/commit/11fdc83848f17c272730dc8f4dc87270f78d434c))
* **release:** @visulima/vis-mcp@1.0.0-alpha.6 [skip ci]\n\n## @visulima/vis-mcp [1.0.0-alpha.6](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.5...@visulima/vis-mcp@1.0.0-alpha.6) (2026-05-10) ([94bb50c](https://github.com/visulima/visulima/commit/94bb50cb28bf9a4d0630d7da703f9c09de17b1f3))
* **release:** @visulima/vis-mcp@1.0.0-alpha.7 [skip ci]\n\n## @visulima/vis-mcp [1.0.0-alpha.7](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.6...@visulima/vis-mcp@1.0.0-alpha.7) (2026-05-10) ([299de51](https://github.com/visulima/visulima/commit/299de51d78febde7024b30ce8242703b75fb06b4))
* **release:** @visulima/vis-mcp@1.0.0-alpha.8 [skip ci]\n\n## @visulima/vis-mcp [1.0.0-alpha.8](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.7...@visulima/vis-mcp@1.0.0-alpha.8) (2026-05-11) ([de533a9](https://github.com/visulima/visulima/commit/de533a9dd9f32d2dc90d2f8a9f322fc950f1eaaf))
* **release:** @visulima/vis-mcp@1.0.0-alpha.9 [skip ci]\n\n## @visulima/vis-mcp [1.0.0-alpha.9](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.8...@visulima/vis-mcp@1.0.0-alpha.9) (2026-05-11) ([308df7f](https://github.com/visulima/visulima/commit/308df7f556442ff017635a31f4fc19326c7efec7))
* **repo:** apply eslint --fix and prettier --fix across packages ([#650](https://github.com/visulima/visulima/issues/650)) ([2e26a84](https://github.com/visulima/visulima/commit/2e26a84774f218f21345e9a8ecd68236b6542743)), closes [#620](https://github.com/visulima/visulima/issues/620)
* sorted package.json ([b47c545](https://github.com/visulima/visulima/commit/b47c545591600fdab17d5cd3a3fbc68b61e199da))
* **vis-mcp:** adopt zod v4 catalog and bump @modelcontextprotocol/sdk ([a84ceb1](https://github.com/visulima/visulima/commit/a84ceb1efcfb368c361eb738006f2e7f113ac4c7))
* **vis-mcp:** bump eslint-plugin-zod and sort package.json keys ([787abc4](https://github.com/visulima/visulima/commit/787abc46e1b637fdb8968a492cd923537e404fbe))
* **vis-mcp:** housekeeping cleanup ([947eff5](https://github.com/visulima/visulima/commit/947eff503b5e170194f7f8e21bea2ab82b0786bf))

### Code Refactoring

* **vis-mcp:** reformat source and README for prettier line-length ([5b41e65](https://github.com/visulima/visulima/commit/5b41e65dceb622cecf554b938261fb7c550a47bd))

### Tests

* improve coverage across packages ([91bd6d3](https://github.com/visulima/visulima/commit/91bd6d3b61736e3c8bd1fc59b0b5955f76a5d323))
* **repo:** cover bin entry points in dist integration suite ([7479ef1](https://github.com/visulima/visulima/commit/7479ef113cf5ccef25692619082afb1b6a0eecab))
* **vis-mcp:** assert error payloads are strings ([cf18663](https://github.com/visulima/visulima/commit/cf1866327423e77b6a99d6e6e41ebc9f10995dc2))
* **vis-mcp:** cover cli-failure catch paths, resolveVisBin fallback, and version/exec edge branches ([a46fa08](https://github.com/visulima/visulima/commit/a46fa08c991ceeab1e5d4ae575768581aba7bdec))

### Build System

* **deps:** update vis-mcp dependencies ([5f27664](https://github.com/visulima/visulima/commit/5f2766405b74001dee44f90722e65608a71434ac))

### Continuous Integration

* **fallow:** make fallow:health advisory (--report-only) ([d57148e](https://github.com/visulima/visulima/commit/d57148ea0e3556b4c24d8d336b9fa14987f5dc7d))


### Dependencies

* **@visulima/fs:** upgraded to 5.0.0
* **@visulima/path:** upgraded to 3.0.0
* **@visulima/vis:** upgraded to 1.0.0

## @visulima/vis-mcp [1.0.0-alpha.37](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.36...@visulima/vis-mcp@1.0.0-alpha.37) (2026-07-03)


### Dependencies

* **@visulima/vis:** upgraded to 1.0.0-alpha.47

## @visulima/vis-mcp [1.0.0-alpha.36](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.35...@visulima/vis-mcp@1.0.0-alpha.36) (2026-07-01)


### Dependencies

* **@visulima/vis:** upgraded to 1.0.0-alpha.46

## @visulima/vis-mcp [1.0.0-alpha.35](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.34...@visulima/vis-mcp@1.0.0-alpha.35) (2026-06-30)

### Miscellaneous Chores

* add fallow code-intelligence across all packages ([a3b4821](https://github.com/visulima/visulima/commit/a3b48215002e86fed20f2973038b5d4a0aa1ce04))

### Continuous Integration

* **fallow:** make fallow:health advisory (--report-only) ([d57148e](https://github.com/visulima/visulima/commit/d57148ea0e3556b4c24d8d336b9fa14987f5dc7d))


### Dependencies

* **@visulima/fs:** upgraded to 5.0.0-alpha.33
* **@visulima/vis:** upgraded to 1.0.0-alpha.45

## @visulima/vis-mcp [1.0.0-alpha.34](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.33...@visulima/vis-mcp@1.0.0-alpha.34) (2026-06-23)

### Bug Fixes

* **vis:** unbreak full build — exclude variable-import modules from dynamic-import-vars ([#712](https://github.com/visulima/visulima/issues/712)) ([29d46eb](https://github.com/visulima/visulima/commit/29d46eb719de11ab8f09e5303748264607b04fe3)), closes [#697](https://github.com/visulima/visulima/issues/697) [#697](https://github.com/visulima/visulima/issues/697) [#697](https://github.com/visulima/visulima/issues/697) [#697](https://github.com/visulima/visulima/issues/697)


### Dependencies

* **@visulima/vis:** upgraded to 1.0.0-alpha.44

## @visulima/vis-mcp [1.0.0-alpha.33](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.32...@visulima/vis-mcp@1.0.0-alpha.33) (2026-06-20)


### Dependencies

* **@visulima/vis:** upgraded to 1.0.0-alpha.43

## @visulima/vis-mcp [1.0.0-alpha.32](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.31...@visulima/vis-mcp@1.0.0-alpha.32) (2026-06-19)


### Dependencies

* **@visulima/vis:** upgraded to 1.0.0-alpha.42

## @visulima/vis-mcp [1.0.0-alpha.31](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.30...@visulima/vis-mcp@1.0.0-alpha.31) (2026-06-19)


### Dependencies

* **@visulima/vis:** upgraded to 1.0.0-alpha.41

## @visulima/vis-mcp [1.0.0-alpha.30](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.29...@visulima/vis-mcp@1.0.0-alpha.30) (2026-06-17)


### Dependencies

* **@visulima/vis:** upgraded to 1.0.0-alpha.40

## @visulima/vis-mcp [1.0.0-alpha.29](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.28...@visulima/vis-mcp@1.0.0-alpha.29) (2026-06-16)


### Dependencies

* **@visulima/vis:** upgraded to 1.0.0-alpha.39

## @visulima/vis-mcp [1.0.0-alpha.28](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.27...@visulima/vis-mcp@1.0.0-alpha.28) (2026-06-16)


### Dependencies

* **@visulima/vis:** upgraded to 1.0.0-alpha.38

## @visulima/vis-mcp [1.0.0-alpha.27](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.26...@visulima/vis-mcp@1.0.0-alpha.27) (2026-06-15)


### Dependencies

* **@visulima/vis:** upgraded to 1.0.0-alpha.37

## @visulima/vis-mcp [1.0.0-alpha.26](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.25...@visulima/vis-mcp@1.0.0-alpha.26) (2026-06-13)

### Features

* **vis-mcp:** add audit/advisory/lint/fmt/list_runs tools and structured output ([4918e4b](https://github.com/visulima/visulima/commit/4918e4bb176508065bc8a578141beb79316c530d))

### Code Refactoring

* **vis-mcp:** reformat source and README for prettier line-length ([5b41e65](https://github.com/visulima/visulima/commit/5b41e65dceb622cecf554b938261fb7c550a47bd))

### Tests

* **vis-mcp:** assert error payloads are strings ([cf18663](https://github.com/visulima/visulima/commit/cf1866327423e77b6a99d6e6e41ebc9f10995dc2))

### Build System

* **deps:** update vis-mcp dependencies ([5f27664](https://github.com/visulima/visulima/commit/5f2766405b74001dee44f90722e65608a71434ac))


### Dependencies

* **@visulima/fs:** upgraded to 5.0.0-alpha.32
* **@visulima/path:** upgraded to 3.0.0-alpha.13
* **@visulima/vis:** upgraded to 1.0.0-alpha.36

## @visulima/vis-mcp [1.0.0-alpha.25](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.24...@visulima/vis-mcp@1.0.0-alpha.25) (2026-06-09)


### Dependencies

* **@visulima/vis:** upgraded to 1.0.0-alpha.35

## @visulima/vis-mcp [1.0.0-alpha.24](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.23...@visulima/vis-mcp@1.0.0-alpha.24) (2026-06-08)


### Dependencies

* **@visulima/vis:** upgraded to 1.0.0-alpha.34

## @visulima/vis-mcp [1.0.0-alpha.23](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.22...@visulima/vis-mcp@1.0.0-alpha.23) (2026-06-07)


### Dependencies

* **@visulima/vis:** upgraded to 1.0.0-alpha.33

## @visulima/vis-mcp [1.0.0-alpha.22](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.21...@visulima/vis-mcp@1.0.0-alpha.22) (2026-06-07)


### Dependencies

* **@visulima/vis:** upgraded to 1.0.0-alpha.32

## @visulima/vis-mcp [1.0.0-alpha.21](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.20...@visulima/vis-mcp@1.0.0-alpha.21) (2026-06-06)


### Dependencies

* **@visulima/vis:** upgraded to 1.0.0-alpha.31

## @visulima/vis-mcp [1.0.0-alpha.20](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.19...@visulima/vis-mcp@1.0.0-alpha.20) (2026-06-04)


### Dependencies

* **@visulima/fs:** upgraded to 5.0.0-alpha.31
* **@visulima/vis:** upgraded to 1.0.0-alpha.30

## @visulima/vis-mcp [1.0.0-alpha.19](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.18...@visulima/vis-mcp@1.0.0-alpha.19) (2026-06-04)

### Bug Fixes

* **vis-mcp:** 1 bug fix ([33cd25e](https://github.com/visulima/visulima/commit/33cd25ecbcea0185e4cab1e3d49ba0fd41206d67))


### Dependencies

* **@visulima/fs:** upgraded to 5.0.0-alpha.30
* **@visulima/path:** upgraded to 3.0.0-alpha.12
* **@visulima/vis:** upgraded to 1.0.0-alpha.29

## @visulima/vis-mcp [1.0.0-alpha.18](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.17...@visulima/vis-mcp@1.0.0-alpha.18) (2026-06-03)


### Dependencies

* **@visulima/vis:** upgraded to 1.0.0-alpha.28

## @visulima/vis-mcp [1.0.0-alpha.17](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.16...@visulima/vis-mcp@1.0.0-alpha.17) (2026-06-02)

### Features

* **vis:** lint + fmt orchestrator ([3a78ed7](https://github.com/visulima/visulima/commit/3a78ed709922e6a35648e0d0eb3f41cc49f89b7a))

### Bug Fixes

* **tests:** revert unsafe vitest autofixes from the lint sweep ([378f27c](https://github.com/visulima/visulima/commit/378f27caa370f1d3188aef2ed36d46839abc88c4))

### Miscellaneous Chores

* apply eslint + prettier autofixes across packages ([c1bb784](https://github.com/visulima/visulima/commit/c1bb7848a0d93d0dfe2960c77e3cda22239c79a0))

### Tests

* **vis-mcp:** cover cli-failure catch paths, resolveVisBin fallback, and version/exec edge branches ([a46fa08](https://github.com/visulima/visulima/commit/a46fa08c991ceeab1e5d4ae575768581aba7bdec))


### Dependencies

* **@visulima/fs:** upgraded to 5.0.0-alpha.29
* **@visulima/vis:** upgraded to 1.0.0-alpha.27

## @visulima/vis-mcp [1.0.0-alpha.16](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.15...@visulima/vis-mcp@1.0.0-alpha.16) (2026-05-29)

### Tests

* improve coverage across packages ([91bd6d3](https://github.com/visulima/visulima/commit/91bd6d3b61736e3c8bd1fc59b0b5955f76a5d323))


### Dependencies

* **@visulima/vis:** upgraded to 1.0.0-alpha.26

## @visulima/vis-mcp [1.0.0-alpha.15](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.14...@visulima/vis-mcp@1.0.0-alpha.15) (2026-05-27)

### Bug Fixes

* **storage-client:** percent-encode user fields in defaultFingerprint ([7c78a0f](https://github.com/visulima/visulima/commit/7c78a0f9512e2a673b941d80839e9f1e86b7b5d0))

### Miscellaneous Chores

* sorted package.json ([b47c545](https://github.com/visulima/visulima/commit/b47c545591600fdab17d5cd3a3fbc68b61e199da))


### Dependencies

* **@visulima/fs:** upgraded to 5.0.0-alpha.28
* **@visulima/path:** upgraded to 3.0.0-alpha.11
* **@visulima/vis:** upgraded to 1.0.0-alpha.25

## @visulima/vis-mcp [1.0.0-alpha.14](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.13...@visulima/vis-mcp@1.0.0-alpha.14) (2026-05-26)

### Miscellaneous Chores

* **ci-stability:** green CI across vis, native, lint, tests, attw ([#651](https://github.com/visulima/visulima/issues/651)) ([d4eb684](https://github.com/visulima/visulima/commit/d4eb684b5f75c818c9251048c605a0ed54a268e3))
* **repo:** apply eslint --fix and prettier --fix across packages ([#650](https://github.com/visulima/visulima/issues/650)) ([2e26a84](https://github.com/visulima/visulima/commit/2e26a84774f218f21345e9a8ecd68236b6542743)), closes [#620](https://github.com/visulima/visulima/issues/620)

### Tests

* **repo:** cover bin entry points in dist integration suite ([7479ef1](https://github.com/visulima/visulima/commit/7479ef113cf5ccef25692619082afb1b6a0eecab))


### Dependencies

* **@visulima/fs:** upgraded to 5.0.0-alpha.26
* **@visulima/vis:** upgraded to 1.0.0-alpha.24

## @visulima/vis-mcp [1.0.0-alpha.13](https://github.com/visulima/visulima/compare/@visulima/vis-mcp@1.0.0-alpha.12...@visulima/vis-mcp@1.0.0-alpha.13) (2026-05-20)


### Dependencies

* **@visulima/fs:** upgraded to 5.0.0-alpha.25
* **@visulima/vis:** upgraded to 1.0.0-alpha.23

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
