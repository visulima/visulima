# @visulima/yaml benchmarks

Micro-benchmarks comparing `@visulima/yaml` against the most-used JavaScript
YAML libraries — [`yaml`](https://www.npmjs.com/package/yaml),
[`js-yaml`](https://www.npmjs.com/package/js-yaml) and
[`yamljs`](https://www.npmjs.com/package/yamljs) — across a spread of
representative workloads:

- **small document** — a tiny `package.json`-style file.
- **medium config** — nested mappings, flow collections and a literal block scalar.
- **anchors + merge keys** — anchor/alias resolution and `<<` merges.
- **large document** — 200 records (~1000 lines) of mixed mappings and flow sequences.
- **stringify** — serializing a parsed config back to YAML.

## Running

```bash
pnpm --filter yaml-bench run test:bench
```

Results are also collected in CI through the
[CodSpeed](https://codspeed.io) vitest plugin.

`yamljs` is loaded lazily — if it is not installed, its rows are simply skipped
so the rest of the suite still runs.

## Indicative results

On a recent run `@visulima/yaml` led every parse workload (roughly **1.5×**
faster than `js-yaml`, **3.6–5×** faster than `yamljs`, and **16–20×** faster
than `yaml`); `yamljs` was marginally faster on the stringify workload. Numbers
vary by machine — run the suite locally for figures you can trust.

> The comparison libraries are dev-only dependencies of this private benchmark
> package; they are never pulled into `@visulima/yaml` itself, which ships with
> zero runtime dependencies.
