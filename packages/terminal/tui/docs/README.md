# Docs maintainer notes

## Conventions

- **Tone:** direct and technical.
- **Links:** use relative links (e.g. `[Hooks](hooks.md)`).
- **Code blocks:** always include language tags (`tsx`, `ts`, `bash`).
- **Accuracy first:** verify behavior against source before documenting it.

## Page ownership

| Page                           | Source of truth                                                                                          |
| ------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `package-map.md`               | `packages/*/package.json`, package README files                                                          |
| `components.md`                | `../react/src/react.ts`, `../react/src/styles.ts`, `../react/src/renderer.ts`                            |
| `hooks.md`                     | `../react/src/hooks.ts`, `../react/src/focus.ts`, `../core/src/input.ts`                                 |
| `ink-compat.md`                | `../react/src/react.ts`, `../react/src/hooks.ts`, `../../compat-test/`                                   |
| `raw-buffer.md`                | `../core/src/lib.rs`, `../core/src/terminal.rs`, `../core/src/inline.ts`, `../core/index.d.ts`           |
| `ts-buffer-guide.md`           | `../core/src/lib.rs`, `../core/src/cell.ts`, `../../examples-raw/harness.ts`                             |
| `why-is-ink-slow.md`           | `../react/src/renderer.ts`, `../core/src/lib.rs`, `../../benchmark/startup/`, `../ink/src/`              |
| `ink-performance-plan.md`      | `why-is-ink-slow.md`, `../ink/benchmark/` outputs, maintainer roadmap decisions                          |
| `render-loop.md`               | `../react/src/react.ts`, `../core/src/app.ts`, `../react/src/reconciler.ts`                              |
| `renderer-correctness-plan.md` | `../react/__test__/renderer-xterm-roundtrip.spec.ts`, `../react/src/text-width.ts`, `../core/src/lib.rs` |
| `decisions.md`                 | Maintainer-updated architecture log                                                                      |
| `examples.md`                  | `../../examples/`, `../../examples-raw/`                                                                 |

## Update checklist

When API behavior changes:

1. Update reference docs (`components.md`, `hooks.md`, `ink-compat.md`)
2. Update quickstarts if entry flow changed
3. Update `examples.md` for renamed/added/removed demos
4. Validate internal links
5. Run at least one relevant example

## Adding a new page

1. Create `packages/docs/<name>.md`
2. Add it to `packages/docs/index.md`
3. Cross-link from related pages

## GitHub Pages config

Pages config lives in `packages/docs/_config.yml` (Jekyll/minima).
