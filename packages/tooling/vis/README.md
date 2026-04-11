<!-- START_PACKAGE_OG_IMAGE_PLACEHOLDER -->

<a href="https://www.anolilab.com/open-source" align="center">

  <img src="__assets__/package-og.svg" alt="vis" />

</a>

<h3 align="center">A CLI task runner for monorepo workspaces, powered by @visulima/task-runner</h3>

<!-- END_PACKAGE_OG_IMAGE_PLACEHOLDER -->

<br />

<div align="center">

[![typescript-image][typescript-badge]][typescript-url]
[![mit licence][license-badge]][license]
[![npm downloads][npm-downloads-badge]][npm-downloads]
[![Chat][chat-badge]][chat]
[![PRs Welcome][prs-welcome-badge]][prs-welcome]

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
- **Catalog management**: Check and update dependencies in pnpm/bun workspace catalogs
- **Security scanning**: Check for known vulnerabilities via OSV.dev
- **Graph visualization**: View your project dependency graph in ASCII, DOT, JSON, or HTML
- **Git hooks**: Install, manage, and migrate git hooks (husky migration supported)
- **Configurable**: `vis.json` for target defaults, cache settings, and task runner options
- **Built on Cerebro**: Uses `@visulima/cerebro` for a robust CLI experience with built-in help, version, and completion

## Install

```sh
npm install @visulima/vis
```

```sh
yarn add @visulima/vis
```

```sh
pnpm add @visulima/vis
```

## Quick Start

```bash
# Run a target across all workspace projects
vis run build

# Run tests only on affected projects
vis affected test --base=main

# Visualize the project dependency graph
vis graph

# Check for outdated catalog dependencies
vis check

# Check with security vulnerability scanning
vis check --security

# Update catalog dependencies interactively
vis update --interactive

# Install git hooks
vis hook install
```

## Commands

| Command                 | Alias | Description                                                       |
| ----------------------- | ----- | ----------------------------------------------------------------- |
| `vis create [template]` |       | Scaffold a new project from templates, npm packages, or git repos |
| `vis init`              |       | Initialize vis.config.ts with security defaults                   |
| `vis run <target>`      |       | Run a target across workspace projects with caching               |
| `vis affected <target>` |       | Run tasks only on projects affected by git changes                |
| `vis ignore <project>`  |       | CI build gating for Vercel / Netlify "Ignored Build Step"         |
| `vis graph`             |       | Visualize the project dependency graph                            |
| `vis check [packages]`  | `c`   | Check for outdated dependencies in workspace catalogs             |
| `vis update [packages]` | `up`  | Update packages to their latest versions                          |
| `vis install`           | `i`   | Install dependencies via the detected package manager             |
| `vis dlx <package>`     |       | Execute a remote package without permanent installation           |
| `vis audit`             |       | Audit dependencies for security vulnerabilities                   |
| `vis clean`             |       | Remove build artifacts, caches, and node_modules                  |
| `vis hook <action>`     |       | Manage git hooks (install, uninstall, migrate)                    |

### CI build gating (`vis ignore`)

`vis ignore <project>` decides whether a deploy should proceed, based on whether `<project>` is affected by the current commit. It uses **inverted exit codes** so it drops directly into Vercel's "Ignored Build Step" and Netlify's `ignore` field:

- Exit `0` → the project is **not** affected, platform **cancels** the build.
- Exit `1` → the project **is** affected, platform **continues** the build.

Commit-message keywords take precedence over git-diff detection:

- Skip: `[skip ci]`, `[ci skip]`, `[no ci]`, `[vis skip]`, `[vis skip <project>]` (legacy `[nx skip]` tokens also accepted for easy migration).
- Force deploy: `[vis deploy]`, `[vis deploy <project>]` (and legacy `[nx deploy]`).

#### Vercel

Settings → Git → **Ignored Build Step**:

```
npx @visulima/vis ignore my-app
```

#### Netlify

`netlify.toml`:

```toml
[build]
ignore = "npx @visulima/vis ignore my-app"
```

#### GitHub Actions / GitLab CI (preflight)

Where a platform doesn't offer a custom ignore hook, run `vis ignore` as a preflight step with `--exit-zero-on-build` to use normal exit semantics and gate downstream jobs via an output:

```yaml
- name: Check if my-app is affected
  id: gate
  run: npx @visulima/vis ignore my-app --json > decision.json
- name: Read decision
  run: echo "action=$(jq -r .action decision.json)" >> "$GITHUB_OUTPUT"
```

#### Supported platforms matrix

| Platform             | Native hook                  | `vis ignore` works?                                 |
| -------------------- | ---------------------------- | --------------------------------------------------- |
| **Vercel**           | Ignored Build Step           | Yes — drop-in                                       |
| **Netlify**          | `ignore` in `netlify.toml`   | Yes — drop-in                                       |
| **GitHub Actions**   | None (CI gating only)        | Yes — via `--json` + job `if:` conditions           |
| **GitLab CI**        | None (CI gating only)        | Yes — via `--json` + `rules:`                       |
| **Cloudflare Pages** | Build Watch Paths (globs)    | No — platform doesn't invoke custom scripts         |
| **Cloudflare Workers Builds** | Build Watch Paths    | No — same reason                                    |
| **Render**           | Build Filters (globs)        | No — [feature request open](https://feedback.render.com/features/p/skip-service-deployment-with-commandscript) |
| **AWS Amplify**      | `[skip-cd]` commit keyword   | No — no custom-command hook                         |

For platforms without a native hook, use their built-in path filtering alongside `vis` — or move CI gating into GitHub Actions / GitLab CI and wrap `vis ignore --json` there.

#### Options

| Flag                           | Default                       | Description                                             |
| ------------------------------ | ----------------------------- | ------------------------------------------------------- |
| `--base <ref>`                 | CI env var, then `HEAD~1`     | Git base ref for the affected comparison                |
| `--head <ref>`                 | `HEAD`                        | Git head ref for the affected comparison                |
| `--downstream <none\|direct\|deep>` | `deep`                   | How far to follow dependents of changed projects        |
| `--upstream <none\|direct\|deep>`   | `none`                   | How far to follow dependencies of changed projects      |
| `--json`                       | off                           | Emit the decision as JSON on stdout instead of text     |
| `--exit-zero-on-build`         | off                           | Disable inverted exit codes (build exits 0, not 1)      |
| `--verbose`                    | off                           | Print the decision path for debugging                   |

Base ref resolution order: explicit `--base` flag → `CACHED_COMMIT_REF` (Netlify) → `VERCEL_GIT_PREVIOUS_SHA` (Vercel) → `GITHUB_BASE_REF` (GitHub Actions) → `CI_COMMIT_BEFORE_SHA` (GitLab CI) → `HEAD~1`. If the resolved ref isn't reachable (e.g. Vercel's shallow clone), it silently falls back to `HEAD~1`.

## Documentation

For full documentation including command reference, configuration options, best practices, and CI/CD integration guides, see the [docs](./docs) folder.

## Supported Node.js Versions

Libraries in this ecosystem make the best effort to track [Node.js' release schedule](https://github.com/nodejs/release#release-schedule).
Here's [a post on why we think this is important](https://medium.com/the-node-js-collection/maintainers-should-consider-following-node-js-release-schedule-ab08ed4de71a).

## Contributing

If you would like to help take a look at the [list of issues](https://github.com/visulima/visulima/issues) and check our [Contributing](.github/CONTRIBUTING.md) guidelines.

> **Note:** please note that this project is released with a Contributor Code of Conduct. By participating in this project you agree to abide by its terms.

## Credits

- [Daniel Bannert](https://github.com/prisis)
- [All Contributors](https://github.com/visulima/visulima/graphs/contributors)

## Made with ❤️ at Anolilab

This is an open source project and will always remain free to use. If you think it's cool, please star it 🌟. [Anolilab](https://www.anolilab.com/open-source) is a Development and AI Studio. Contact us at [hello@anolilab.com](mailto:hello@anolilab.com) if you need any help with these technologies or just want to say hi!

## License

The visulima vis is open-sourced software licensed under the [MIT][license]

<!-- badges -->

[license-badge]: https://img.shields.io/npm/l/@visulima/vis?style=for-the-badge
[license]: https://github.com/visulima/visulima/blob/main/LICENSE
[npm-downloads-badge]: https://img.shields.io/npm/dm/@visulima/vis?style=for-the-badge
[npm-downloads]: https://www.npmjs.com/package/@visulima/vis
[prs-welcome-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge
[prs-welcome]: https://github.com/visulima/visulima/blob/main/.github/CONTRIBUTING.md
[chat-badge]: https://img.shields.io/discord/932323359193186354.svg?style=for-the-badge
[chat]: https://discord.gg/TtFJY8xkFK
[typescript-badge]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]: https://www.typescriptlang.org/
