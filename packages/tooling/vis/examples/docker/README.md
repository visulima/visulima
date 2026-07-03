# Docker Example — `vis docker scaffold` + `prune`

A small monorepo that demonstrates the `vis docker scaffold` and `vis docker prune` flow for building cache-friendly Docker images.

## Layout

```
packages/
  api/      — focus project, depends on `shared` and `fastify`
  shared/   — workspace dep of `api`
  unused/   — sibling project pulled out of the docker context entirely
              (its `lodash` dep is also dropped from the pruned lockfile)
```

The point of `unused/` is to make the pruning visible: it's not in the focus closure, so it should not appear in `workspace/packages/` and `lodash` should be missing from the rewritten `pnpm-lock.yaml`.

## How it works

`vis docker scaffold --focus=api` writes two directories under `--out` (default `.vis/docker`):

- **`workspace/`** — root manifests + `package.json` for every project in the focus closure (here: `api`, `shared`) + a rewritten `pnpm-lock.yaml` containing only entries reachable from the closure.
- **`sources/`** — full source trees for the focus project(s), if you pass `--include-sources`.

A `vis-docker-manifest.json` is also written at the context root so `vis docker prune` knows which projects to keep when invoked inside the build stage.

## Try it from the monorepo root

First, build the CLI:

```bash
pnpm --filter "@visulima/task-runner" run build
pnpm --filter "@visulima/vis" run build
```

Then scaffold the focus closure for `api`:

```bash
node packages/tooling/vis/dist/bin.js docker scaffold \
    --focus=api \
    --include-sources \
    --cwd=packages/tooling/vis/examples/docker
```

(`--out` defaults to `.vis/docker` relative to `--cwd`.)

Inspect what landed:

```bash
ls packages/tooling/vis/examples/docker/.vis/docker/workspace/packages
# → api  shared          (no `unused/`)

grep -c lodash packages/tooling/vis/examples/docker/.vis/docker/workspace/pnpm-lock.yaml
# → 0                    (lodash was only used by `unused`, so it was pruned)

grep -c fastify packages/tooling/vis/examples/docker/.vis/docker/workspace/pnpm-lock.yaml
# → kept                 (fastify is in the focus closure)
```

To copy the lockfile verbatim instead of pruning (escape hatch for parser edge cases):

```bash
node packages/tooling/vis/dist/bin.js docker scaffold \
    --focus=api \
    --no-prune-lockfile \
    --cwd=packages/tooling/vis/examples/docker
```

## Building the image

The included `Dockerfile` consumes the scaffold output:

```bash
cd packages/tooling/vis/examples/docker
node ../../dist/bin.js docker scaffold --focus=api --include-sources
docker build -t docker-example .
docker run --rm -p 3000:3000 docker-example
curl localhost:3000
# → {"message":"hello, docker"}
```

The first stage of the Dockerfile copies only `workspace/` and runs `pnpm install` — that layer is cached as long as the pruned lockfile and manifests don't change, so source-only edits don't bust it. The second stage copies `sources/`, builds, and runs `vis docker prune` to drop anything outside the focus closure before the final stage copies the build output into a slim runtime image.
