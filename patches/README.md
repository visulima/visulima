# Patches

Patches applied to third-party dependencies via [pnpm's `patchedDependencies`](https://pnpm.io/cli/patch)
mechanism. Each patch is wired up in [`pnpm-workspace.yaml`](../pnpm-workspace.yaml) under
`patchedDependencies:` and is automatically applied on `pnpm install`.

Keep this file in sync with the patch files. When you bump a patched upstream package, the patch
must be regenerated via `pnpm patch <pkg>@<new-version>`; line-number context may shift even if
the fix itself still applies cleanly.

## `patches/picomatch@4.0.4.patch`

Three upstream-tracking hunks layered into a single patch:

### 1. `lib/constants.js` — `UNIGNORE` sentinel

Adds `const UNIGNORE = Symbol('unignore');` and exports it on `picomatch.constants`. Required by
the companion `lib/picomatch.js` change below.

### 2. `lib/picomatch.js` — `onIgnore` can rescue matches

Wraps the ignore branch of the matcher in an `ignored:` labelled block. When `options.onIgnore`
returns `picomatch.constants.UNIGNORE`, the path is un-ignored and the matcher returns `true`
(so a consumer can revive a previously-ignored entry).

Used by our `tinyglobby` patch to implement leading-`!` entries inside the `ignore` option —
e.g. `glob(..., { ignore: ["dist/**", "!dist/index.d.ts"] })`.

**Not upstream yet.** Mirrors a pattern discussed in the micromatch ecosystem but no open PR
tracks it. Revisit if picomatch ships equivalent hook support.

### 3. `lib/parse.js` — globstars at the start of brace alternatives

Adds an `isBrace && rest[0] === '/'` branch so patterns like `{**/*.json,**/*.js}` match paths
without a leading directory segment (e.g. `a.json`, `foo.md`).

**Upstream PR:** [micromatch/picomatch#150](https://github.com/micromatch/picomatch/pull/150) —
open at time of patch. Drop this hunk once merged + released.

## `patches/tinyglobby@0.2.16.patch`

Three upstream-tracking hunks:

### 1. Negated ignore patterns (`ignore: ["dist/**", "!dist/keep.ts"]`)

Extends `processPatterns` to collect leading-`!` entries from `options.ignore` into a new
`unignore` array. In `buildCrawler`:

- The main `picomatch` matcher is called with `ignore: processed.ignore` plus an `onIgnore`
  callback that returns `picomatch.constants.UNIGNORE` for paths the unignore matcher catches
  (requires the companion `picomatch` patch above).
- `excludePredicate` uses a partial matcher (`getPartialMatcher(processed.unignore, ...)`) so
  directories with un-ignored descendants aren't pruned during the `fdir` walk.
- The per-entry filter is simplified to `matcher(path)` — the matcher subsumes the ignore check
  now that it owns both halves.

**Not upstream.** tinyglobby's existing behaviour is explicitly "leading `!` inside `ignore` is
ignored for consistency with fast-glob" (see the removed test comment in the upstream source).
Our behaviour deviates; revisit if tinyglobby adopts a different mechanism.

### 2. Negated extglobs at depth (`loc/**/!(en.po)`)

Tracks [tinyglobby#188](https://github.com/SuperchupuDev/tinyglobby/issues/188). `normalizePattern`
used to append `/**` to every pattern whose last char wasn't `*` (the `expandDirectories` feature).
That turned `loc/**/!(en.po)` into `loc/**/!(en.po)/**`, letting picomatch satisfy `!(en.po)`
with any non-`en.po` segment (like `one`) and absorb the real file via the trailing `**` —
returning paths the negation was supposed to exclude.

The patch skips the append when the last segment starts with `!(`. Positive extglobs
(`@(...)`, `+(...)`, `*(...)`, `?(...)`) are left alone because they accept the expansion
cleanly. Covered by `__tests__/unit/find/glob.test.ts` → "applies negated extglobs at arbitrary
depth".

**Upstream issue:** open at time of patch. Drop once merged.

### 3. Perf: skip `fdir` `exclude` predicate on trivial broad patterns

Tracks [tinyglobby#143](https://github.com/SuperchupuDev/tinyglobby/issues/143). When
`processed.ignore` and `processed.unignore` are both empty **and** every match pattern is
literally `**` or `**/*`, the `excludePredicate` can never prune anything — but `fdir` still
pays the cost of invoking it per entry. The patch passes `exclude: undefined` in that case.

**Upstream issue:** still open at time of patch. Drop once merged.

## Regenerating a patch

```bash
# Creates an editable copy of the package under node_modules/.pnpm_patches/<pkg>@<ver>
pnpm patch <pkg>@<ver>

# Edit files under the printed path, then commit:
pnpm patch-commit /home/.../.pnpm_patches/<pkg>@<ver>
```

`pnpm patch-commit` rewrites the file in `patches/` and updates
`pnpm-workspace.yaml:patchedDependencies` automatically.
