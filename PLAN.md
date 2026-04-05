# Plan: Port vite-plus `create` Command to `vis`

## Overview
Replace the current minimal `vis create` command with a full-featured project scaffolding system inspired by vite-plus. The new command will support interactive prompts, multiple template sources, monorepo awareness, and post-creation integrations — all built on vis's existing ecosystem (`@visulima/cerebro`, `@visulima/fs`, `@visulima/colorize`, native PM bindings).

## File Structure

All new files go under `packages/tooling/vis/src/commands/create/`:

```
packages/tooling/vis/src/commands/create/
├── index.ts                        # Cerebro Command definition (entry point)
├── prompts.ts                      # Interactive prompt flows (using @inquirer/core or readline)
├── discovery.ts                    # Template type detection, GitHub URL parsing, npm shorthand expansion
├── random-name.ts                  # Random adjective-noun project name generator
├── utils.ts                        # Directory helpers, package name validation, conflict detection
├── templates/
│   ├── index.ts                    # Template executor router
│   ├── types.ts                    # Shared types (TemplateType, TemplateConfig, ExecutionContext)
│   ├── builtin.ts                  # Built-in template execution (app, library)
│   ├── monorepo.ts                 # Monorepo scaffold (workspace config, default packages)
│   ├── generator.ts                # Generator scaffold template
│   └── remote.ts                   # Remote npm/GitHub template execution with auto-fixes
└── __tests__/
    ├── discovery.test.ts
    ├── utils.test.ts
    └── prompts.test.ts
```

## Implementation Steps

### Step 1: Create Type Definitions (`templates/types.ts`)
Define core types shared across the create subsystem:
- `TemplateType`: `"builtin:app" | "builtin:library" | "builtin:monorepo" | "builtin:generator" | "remote:npm" | "remote:github"`
- `TemplateConfig`: resolved template info (type, package name, args, source URL)
- `ExecutionContext`: cwd, package manager info, project name, target dir, logger, options
- `PostCreateTask`: enum of post-creation steps

### Step 2: Port Discovery Logic (`discovery.ts`)
Adapt vite-plus's `discovery.ts` to vis:
- `discoverTemplate(input: string)` → returns `TemplateConfig`
- `expandCreateShorthand(name: string)` → e.g., `"vite"` → `"create-vite"`
- `parseGitHubUrl(url: string)` → normalize to degit-compatible format
- `inferParentDir(type: TemplateType, cwd: string)` → suggest `apps/` vs `packages/`
- Built-in template prefix: `vis:monorepo`, `vis:app`, `vis:library`, `vis:generator`
- Use `@visulima/package` for monorepo root detection instead of custom logic

### Step 3: Port Utility Functions (`utils.ts`)
- `isValidPackageName(name: string)` — use `validate-npm-package-name` (add as dependency)
- `toValidPackageName(name: string)` — sanitize string to valid npm name
- `isEmptyDir(path: string)` — check if directory is empty/safe to scaffold into
- `resolveTargetDir(projectName: string, cwd: string)` — resolve and validate target path
- `canSafelyOverwrite(path: string)` — check for conflict with existing files

### Step 4: Port Random Name Generator (`random-name.ts`)
- Port the adjective-noun random name generator from vite-plus
- Used as fallback when no project name is provided in interactive mode

### Step 5: Build Interactive Prompts (`prompts.ts`)
Using `@inquirer/core` (already in pnpm catalog) or `node:readline` (like `init.ts` does):
- `promptTemplateSelection(inMonorepo: boolean)` — select built-in or enter custom
- `promptPackageName(suggestion?: string)` — with NPM name validation
- `promptTargetDirectory(suggestion: string, cwd: string)` — with conflict detection
- `promptOverwriteConfirm(dir: string)` — if directory exists
- `promptPackageManager()` — pnpm/npm/yarn/bun selection
- `promptGitInit()` — for standalone projects
- `promptEditorConfig()` — VS Code config generation

### Step 6: Implement Template Executors

#### `templates/builtin.ts`
- Execute `vis:app` → delegates to `create-vite` via `runDlx` from pm-runner
- Execute `vis:library` → clone library template from GitHub (need `degit` or manual fetch)
- Route to monorepo.ts and generator.ts for those types

#### `templates/monorepo.ts`
- Create workspace structure: `apps/`, `packages/`, root `package.json`
- Generate `pnpm-workspace.yaml` (or yarn workspaces config)
- Copy dotfiles (`.gitignore`, `.editorconfig`)
- Optionally scaffold default app + library
- Initialize git repo

#### `templates/generator.ts`
- Scaffold a code generator template in the workspace
- Set up `bin/index.ts` with executable permissions
- Prompt for generator description

#### `templates/remote.ts`
- Execute arbitrary npm `create-*` packages via `runDlx`
- Apply auto-fixes for popular tools:
  - `create-vite`: add `--no-immediate`, `--no-rolldown`
  - `create-nuxt`: add `--no-gitInit` in monorepo context
  - `@tanstack/cli`: add `--no-install`, `--no-toolchain`
  - `sv` (SvelteKit): prepend `create`, add `--no-install`
- Handle GitHub URLs via `degit` (add as dependency)

#### `templates/index.ts`
- Router: given a `TemplateConfig`, dispatch to the correct executor
- `executeTemplate(config: TemplateConfig, context: ExecutionContext)`

### Step 7: Build the Command Entry Point (`index.ts`)
Replace `packages/tooling/vis/src/commands/create.ts` with a directory module:
- Define Cerebro `Command` with:
  - `argument`: `template` (optional — triggers interactive mode if missing)
  - `options`: `--list`, `--editor`, `--no-interactive`, `--pm`, `--git-init`
- Main flow:
  1. Detect workspace context (`@visulima/package` findMonorepoRootSync)
  2. If `--list`: show available templates and exit
  3. If template argument provided: discover template type
  4. If no template: run interactive prompt flow
  5. Validate package name and target directory
  6. Execute template
  7. Run post-creation tasks (deps install, editor config, git init, formatting)
  8. Print success summary with next steps

### Step 8: Update `bin.ts` Import
- Change `import createCommand from "./commands/create"` → `import createCommand from "./commands/create/index"`
  (or just `"./commands/create"` if index.ts is the default)

### Step 9: Add Dependencies
In `packages/tooling/vis/package.json`:
- Add `validate-npm-package-name` (for package name validation)
- Add `degit` (for GitHub template cloning)
- Add `@inquirer/core` if using inquirer for prompts (already in catalog as `catalog:dev`)
- Add `@types/validate-npm-package-name` to devDependencies

### Step 10: Write Tests
- `discovery.test.ts`: test shorthand expansion, GitHub URL parsing, template type detection
- `utils.test.ts`: test package name validation, directory helpers
- `prompts.test.ts`: test prompt logic (mocked stdin)

### Step 11: Post-Creation Integrations
Enhance the existing `generateVscodeConfig` and add:
- **AI instructions**: write `.ai/instructions` file for AI coding assistants
- **Editor config**: `.editorconfig`, `.vscode/settings.json`, `.vscode/extensions.json`
- **Dependency install**: run `pm install` via native bindings
- **Git init**: `git init` + initial commit for standalone projects
- **Format**: run formatter if available

## Dependencies to Add

| Package | Purpose | Catalog? |
|---------|---------|----------|
| `validate-npm-package-name` | NPM name validation | No (add directly) |
| `degit` | Clone GitHub repos as templates | No (add directly) |
| `@inquirer/core` | Interactive prompts | Yes (`catalog:dev`) |

## Key Design Decisions

1. **Use `node:readline` for prompts** (like `init.ts` already does) to minimize new dependencies, OR use `@inquirer/core` for richer UX — recommend `@inquirer/core` for select menus and validation
2. **Reuse `pm-runner.ts`** native bindings for all PM operations (detect, install, dlx)
3. **Use `vis:` prefix** for built-in templates (not `vite:`) to match the tool's branding
4. **Keep the command as a Cerebro Command** — no separate binary entry point
5. **Monorepo templates** should generate pnpm workspace config by default (vis's ecosystem is pnpm-focused)
6. **Auto-fixes for popular tools** are a key feature — port them as-is with potential for extending

## Risk & Considerations

- **degit** is needed for GitHub template cloning — evaluate if we can use a lighter alternative or `git clone --depth 1`
- **Native binding for file monitoring** (vite-plus uses it to detect created dirs) — vis already has native bindings, evaluate if `runCommandAndDetectProjectDir` pattern is needed
- **Template files** for monorepo/generator scaffolds need to be bundled — store as string templates or in a `templates/` asset directory
- **Testing**: mock filesystem and PM operations heavily; use vitest
