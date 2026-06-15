# Release subsystem fixtures (RFC §19.3)

7 fixture monorepos for integration / e2e testing of `vis release`:

| Fixture | Purpose |
|---|---|
| `npm-workspace/` | npm 11+ workspace; tests `NpmAdapter` pack/publish/install |
| `pnpm-workspace/` | pnpm 10+ workspace with `catalog:` + `workspace:^` refs |
| `yarn-workspace/` | yarn Berry/v4 workspace with `workspace:^` |
| `bun-workspace/` | bun 1.2+ workspace |
| `from-semantic-release/` | per-package `.releaserc.json` files; tests `vis release init --from-semantic-release` |
| `from-changesets/` | `.changeset/` dir with config + pending change files; tests `--from-changesets` |
| `from-bumpy/` | `.bumpy/` dir with config + pending change files; tests `--from-bumpy` |

## Layout per pm-fixture

```
<pm>-workspace/
├── package.json              # workspaces glob + packageManager field
├── vis.config.json           # release block — defaultManaged: true, channel: main
├── (pnpm-workspace.yaml)     # pnpm only — catalog:typescript
├── packages/
│   ├── a/   (leaf)
│   ├── b/   (depends on a via workspace:^1.0.0)
│   └── c/   (depends on a via workspace:* + catalog: for typescript on pnpm)
└── .vis/release/sample.md    # 1 pending change file
```

## How to run e2e against these (TODO — verdaccio + runner not yet wired)

1. Install verdaccio + msw (currently NOT in vis's package.json):
   ```sh
   pnpm add -D --filter @visulima/vis verdaccio msw @types/verdaccio
   ```

2. Run the harness:
   ```sh
   pnpm --filter @visulima/vis run test:e2e
   ```

   (script not yet added to package.json — see harness/runner.ts for the
   intended entry point.)

3. The harness will, for each fixture:
   a. Spin up verdaccio on `localhost:4873`
   b. Copy the fixture to a temp dir + `git init`
   c. Run `vis release init` (for migration fixtures) or skip
   d. Run `vis release status` → assert plan
   e. Run `vis release version --commit` → assert package.json + CHANGELOG writes
   f. Run `vis release publish --tag latest` → assert verdaccio receives the tarball
   g. Verify the published `package.json` has `workspace:` / `catalog:`
      refs **resolved** (not literal protocol prefixes)

## Status

- ✅ Fixture filesystems created (this commit)
- ✅ Harness skeleton (`harness/runner.ts`)
- ⏳ verdaccio + msw not yet a vis dep — harness execution is gated
- ⏳ Per-fixture assertions TODO (1 file per fixture under `__tests__/release/e2e/`)
