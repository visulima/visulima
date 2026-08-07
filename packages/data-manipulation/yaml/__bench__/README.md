# @visulima/yaml benchmarks

Micro-benchmarks comparing `@visulima/yaml` against the two most-used JavaScript
YAML libraries — [`yaml`](https://www.npmjs.com/package/yaml) and
[`js-yaml`](https://www.npmjs.com/package/js-yaml) — across a spread of
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

> The comparison libraries are dev-only dependencies of this private benchmark
> package; they are never pulled into `@visulima/yaml` itself, which ships with
> zero runtime dependencies.
