<div align="center">
  <h3>Visulima vis</h3>
  <p>
  A CLI task runner for monorepo workspaces, powered by <a href="https://www.npmjs.com/package/@visulima/task-runner">@visulima/task-runner</a> and <a href="https://www.npmjs.com/package/@visulima/cerebro">@visulima/cerebro</a>.
  </p>
</div>

<br />

<div align="center">

[![typescript-image]][typescript-url] [![npm-image]][npm-url] [![license-image]][license-url]

</div>

---

<div align="center">
    <p>
        <sup>
            Daniel Bannert's open source work is supported by the community on <a href="https://github.com/sponsors/prisis">GitHub Sponsors</a>
        </sup>
    </p>
</div>

---

## Features

- **Workspace-aware**: Automatically discovers projects from `pnpm-workspace.yaml` or `package.json` workspaces
- **Task caching**: Powered by `@visulima/task-runner` with local and remote caching support
- **Dependency-aware scheduling**: Runs tasks in topological order with configurable parallelism
- **Affected detection**: Only runs tasks for projects changed since a given git ref
- **Graph visualization**: View your project dependency graph in ASCII, DOT, JSON, or HTML
- **Configurable**: `vis.json` for target defaults, cache settings, and task runner options
- **Built on Cerebro**: Uses `@visulima/cerebro` for a robust CLI experience with built-in help, version, and completion

## Install

```bash
npm install @visulima/vis
```

```bash
yarn add @visulima/vis
```

```bash
pnpm add @visulima/vis
```

## Quick Start

Run a target across all workspace projects:

```bash
vis run build
```

Run tests only on projects affected by recent changes:

```bash
vis affected test --base=main
```

Visualize the project dependency graph:

```bash
vis graph
```

## Commands

### `vis run <target>`

Run a target (e.g., `build`, `test`, `lint`) across workspace projects. Tasks are executed in dependency order with caching.

```bash
vis run build
vis run test --projects=@my/app,@my/lib
vis run build --parallel=5
vis run build --no-cache
vis run lint --dry-run
vis run build --summarize
```

| Option | Alias | Default | Description |
|--------|-------|---------|-------------|
| `--projects` | `-p` | all | Comma-separated list of projects to run |
| `--parallel` | | `3` | Maximum number of parallel tasks |
| `--cache` | | `true` | Enable caching (`--no-cache` to disable) |
| `--cache-dir` | | | Custom cache directory |
| `--dry-run` | | `false` | Show what would run without executing |
| `--summarize` | | `false` | Generate a JSON run summary |

### `vis affected <target>`

Detect which projects are affected by recent git changes and run a target only on those projects. Uses git diff to find changed files, maps them to projects, and includes transitively dependent projects.

```bash
vis affected build
vis affected test --base=main
vis affected lint --base=HEAD~5 --head=HEAD
```

| Option | Default | Description |
|--------|---------|-------------|
| `--base` | `HEAD~1` | Git base ref for comparison |
| `--head` | `HEAD` | Git head ref for comparison |
| `--parallel` | `3` | Maximum number of parallel tasks |
| `--cache` | `true` | Enable caching (`--no-cache` to disable) |
| `--dry-run` | `false` | Show what would run without executing |

### `vis graph`

Visualize the project dependency graph in various formats.

```bash
vis graph
vis graph --format=dot
vis graph --format=json --output=graph.json
vis graph --format=html --output=graph.html
```

| Option | Alias | Default | Description |
|--------|-------|---------|-------------|
| `--format` | `-f` | `ascii` | Output format: `ascii`, `dot`, `json`, `html` |
| `--output` | `-o` | stdout | Write output to file instead of stdout |

## Configuration

Create a `vis.json` file in your workspace root to configure target defaults and task runner options:

```json
{
    "targetDefaults": {
        "build": {
            "dependsOn": ["^build"],
            "outputs": ["{projectRoot}/dist/**"],
            "cache": true
        },
        "test": {
            "dependsOn": ["build"],
            "cache": true
        },
        "lint": {
            "cache": true
        }
    },
    "taskRunnerOptions": {
        "parallel": 5,
        "smartLockfileHashing": true,
        "frameworkInference": true,
        "remoteCache": {
            "url": "https://cache.example.com",
            "token": "my-token",
            "teamId": "my-team"
        }
    }
}
```

### Target Defaults

Target defaults apply to all projects that have a matching script in their `package.json`. They follow the same schema as `@visulima/task-runner`'s `TargetConfiguration`:

| Property | Type | Description |
|----------|------|-------------|
| `dependsOn` | `(string \| object)[]` | Other targets this target depends on. Use `^build` to depend on dependency projects' `build` target |
| `outputs` | `string[]` | Output file patterns. Use `{projectRoot}` as a placeholder |
| `inputs` | `(string \| object)[]` | Input patterns for cache invalidation |
| `cache` | `boolean` | Whether this target is cacheable |
| `parallelism` | `boolean` | Whether this target supports parallel execution |

## Workspace Discovery

`vis` automatically discovers your workspace structure:

1. **pnpm**: Reads `pnpm-workspace.yaml` for package patterns
2. **npm/yarn**: Falls back to the `workspaces` field in root `package.json`
3. **Project metadata**: Reads `project.json` files (Nx-compatible) for additional config like `projectType`, `sourceRoot`, and `tags`
4. **Dependency graph**: Built from `dependencies`, `devDependencies`, and `peerDependencies` in each project's `package.json`

## Programmatic Usage

You can also use `vis` programmatically:

```typescript
import { createCerebro, discoverWorkspace, buildProjectGraph, findWorkspaceRoot } from "@visulima/vis";

// Use the CLI programmatically
const cli = createCerebro();
await cli.run();

// Or use the workspace discovery API directly
const workspaceRoot = findWorkspaceRoot(process.cwd());
const { config, workspace } = discoverWorkspace(workspaceRoot);
const projectGraph = buildProjectGraph(workspaceRoot, workspace);

console.log(`Found ${Object.keys(workspace.projects).length} projects`);
```

## Supported Node.js Versions

Libraries in this ecosystem make the best effort to track [Node.js' release schedule](https://github.com/nodejs/release#release-schedule).

## Contributing

If you would like to help take a look at the [list of issues](https://github.com/visulima/visulima/issues) and check our [Contributing](https://github.com/visulima/visulima/blob/main/.github/CONTRIBUTING.md) guidelines.

## License

The visulima vis is open-sourced software licensed under the [MIT][license-url]

[typescript-image]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]: https://www.typescriptlang.org/
[license-image]: https://img.shields.io/npm/l/@visulima/vis?color=blueviolet&style=for-the-badge
[license-url]: LICENSE.md
[npm-image]: https://img.shields.io/npm/v/@visulima/vis/latest.svg?style=for-the-badge&logo=npm
[npm-url]: https://www.npmjs.com/package/@visulima/vis/v/latest
