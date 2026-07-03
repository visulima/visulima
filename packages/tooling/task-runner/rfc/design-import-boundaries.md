# Design — Import-level boundaries

Catch **forbidden imports** — code that imports a package not declared in its `package.json`, or reaches into another package's internals — at the import statement, not just the project-graph level. Matches `turbo boundaries` (experimental) and `@nx/enforce-module-boundaries`.

## Why

`project-constraints.ts` already enforces rules on the **project dependency graph**: layer hierarchy (a project may only depend on equal-or-lower layers), deployment-target projects can't be depended upon, tag rules. That's the Nx-tags model and it's good — but it operates on _declared_ edges. It can't catch:

| Violation                                                                      | Project-graph constraints miss it because…                                                      |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `import x from "lodash"` where `lodash` isn't in this package's `package.json` | the edge was never declared; the import is a phantom dependency that breaks on a clean install  |
| `import x from "@app/core/src/internal/secret"`                                | deep-imports past a package's public entry bypass its API boundary; the project edge looks fine |
| importing a file physically outside the package directory                      | no project edge exists at all                                                                   |

These are exactly Turbo `boundaries`' two checks: (a) imports of files outside the package, (b) imports of deps not in `package.json`.

## Approach

A new analyzer that scans **actual import/require specifiers** and validates each against the importing package's manifest + the boundary policy. Two delivery shapes, same core:

### Core: `checkImportBoundaries(projectGraph, options)`

1. Walk each project's source files (reuse the workspace file enumeration the hasher already does; respect `inputs`/ignored dirs).
2. Extract import specifiers — **use the native addon**: we ship `oxc`/Rust tooling adjacency and the napi host already; a Rust `extract_imports(path) -> string[]` is fast and avoids a JS parser dep. JS fallback via a lightweight regex-free scan only if native is somehow absent (and native is now required — see `design`-level note).
3. Classify each specifier: bare (`lodash` → must be in `package.json` deps/peers, or a known builtin/`node:`), workspace (`@app/core` → must be a declared workspace dep + not a deep import past its `exports`), relative (must resolve **inside** the package dir).
4. Emit `ConstraintViolation[]` (reuse the existing type from `project-constraints.ts`).

### Policy (extends `ConstraintsConfig`)

```ts
boundaries: {
  allowDeepImports: false,          // forbid reaching past package exports
  allowUndeclaredDependencies: false,
  allow: [{ from: "type:test", to: "*" }],  // tag-scoped exceptions, like turbo boundaries' dependents rules
  ignore: ["**/*.stories.tsx"],
}
```

## Integration

- New `src/import-boundaries.ts`, exported from `index.ts`; emits the same `ConstraintViolation` shape `project-constraints.ts` uses so reporting is unified.
- Native: add `extract_imports` to `native/src/` (alongside the existing file-hashing rayon walk — it's the same directory traversal, so fold it in to avoid a second pass).
- `vis run` already runs constraint validation (`run/handler.ts:1274`); add boundaries there behind `--skip-constraints` and a config toggle. Also expose `vis boundaries` (Turbo parity) for a standalone check.
- Pairs naturally with an ESLint rule wrapper for editor feedback (optional follow-up), but the CI check is the core.

## Risks / open questions

- **Resolution correctness** is the hard part: `exports` maps, conditional exports, TS path aliases (`tsconfig` `paths`), `node:` builtins, type-only imports (which shouldn't count as runtime deps). Get the classifier wrong → false positives that erode trust (we have a memory: don't ship noisy diagnostics). Start strict-but-conservative; only flag high-confidence violations.
- Monorepo-wide source scan is O(files) — but it's the same walk the hasher does; consider sharing one traversal.
- Type-only deep imports are usually fine; needs a `type` carve-out.

## Effort

Medium. Isolated new module (no cache/scheduler risk), but the import classifier + `exports`/alias resolution is fiddly and trust-sensitive. Ship behind an opt-in flag first.
