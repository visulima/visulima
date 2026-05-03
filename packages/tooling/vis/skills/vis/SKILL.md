---
name: vis
description: Use when the workspace contains a vis.config.ts (or vis.config.js/json) at the repo root, or when the user mentions "vis", "task-runner", or "@visulima/vis". This skill orchestrates the vis MCP server's eight read-only tools to inspect projects, plan task graphs, and diagnose remote-cache rotations.
---

# Working with the `vis` task runner

`vis` is the Visulima monorepo task runner — a Turborepo/Nx-class tool with a remote cache, REAPI gRPC backend, and project graph. When this skill is active you have the **`@visulima/vis-mcp` server** mounted, exposing eight read-only tools. Use them in preference to running `vis` shell commands yourself: the tools give you structured JSON and run faster.

The MCP server deliberately does NOT execute targets or scaffold templates — Nx-style "agent prepares, human executes". When the user wants to run `<project>:<target>` or `vis generate <template>`, prepare the command (use `list_targets`/`describe_template` to confirm it exists and capture required arguments) and ask the user to run it themselves; afterwards use `get_run_logs` to read the result of any task run.

## Tools available

| Tool | Purpose |
| --- | --- |
| `list_projects` | All projects in the workspace, optionally filtered by a vis query (`tag=frontend`, `type=application`, …) |
| `describe_project` | Full metadata for one project: language, layer, tags, root path, all targets |
| `list_targets` | Per-target rows across the workspace, optionally narrowed to a single project |
| `list_templates` | Scaffolding templates discovered in `.vis/templates/`, `.moon/templates/`, and `vis.config.ts` `generator.templates` |
| `describe_template` | Variable schema, default destination, and description for a single template — required before suggesting a `vis generate` command |
| `get_run_logs` | Most recent run summary from `.task-runner/`, or a specific `runId`, optionally filtered to one task |
| `cache_why` | Diff a task's cache hash against the previous run — pinpoints what changed (command, nodes, runtime, implicit deps) |
| `cache_hash` | Recorded hash and per-input hash details for a task |

## Workflow patterns

### Discovery — "what's in this repo?"
Default opening move when the user asks about the workspace:
1. `list_projects` (no filter). Shows everything with categories and target counts.
2. If they ask about a specific package, `describe_project` for the full picture rather than re-running list with a filter.

### Plan a build
1. `list_targets` (optionally with `project: "@scope/name"`) to see what `build`/`test`/`lint`/etc. targets exist.
2. Tell the user the exact command (`vis run @scope/name:build`) and let them run it.
3. Use `get_run_logs` afterwards to inspect status, cache hits, and stderr tails.

### Investigate a cache miss
When a build that should have been cached re-ran:
1. `get_run_logs` (no args → latest summary) — surfaces all task statuses for the last run.
2. For any task with status `success` but `cacheStatus: "miss"`, call `cache_why` with that `taskId`. It diffs hashDetails against the previous run and tells you which input rotated (command string, file content, `implicitDependency`, runtime version, …).
3. If `cache_why` shows the change but the user wants to see the raw hash inputs, `cache_hash` returns the full per-input breakdown.

### Scaffold a new package or component
When the user asks for "a new X" / "scaffold Y":
1. `list_templates` — pick the template whose `name` or `description` matches the user's request.
2. `describe_template` with that name — read the `variables[]` schema. Identify which variables are `required` and which have sensible `default` values.
3. Construct the command: `vis generate <name> -- --var1=value1 --var2=value2`. For interactive prompts, drop the `--` overrides and let the user step through. For `--defaults`-friendly templates, add `--defaults` to skip prompts.
4. Hand the command to the user to execute. Don't fabricate variable values — if the user hasn't told you what to pass for a required variable, ask.

#### Worked example

User: *"Scaffold a new React button component called PrimaryButton."*

1. Call `list_templates` → response contains an entry `{ "name": "component", "source": "native", "description": "Scaffold a React component" }`. That's the closest match.
2. Call `describe_template` with `{ "name": "component" }` → response shows `variables`:
   ```json
   [
     { "name": "name",     "type": "string", "required": true,  "prompt": "Component name?" },
     { "name": "withTest", "type": "boolean", "required": false, "default": true },
     { "name": "style",    "type": "enum",   "required": false, "default": "primary",
       "values": ["primary", "secondary"] }
   ]
   ```
3. The user supplied `name` (`PrimaryButton`) and implied `style=primary` (default already matches). `withTest` is unspecified — the default is fine, no need to override.
4. Suggested command for the user to run:
   ```sh
   vis generate component -- --name=PrimaryButton --style=primary
   ```
   Do **not** invent values for required variables the user never mentioned — ask first.

### Diagnose a failed run
1. `get_run_logs` to see which task(s) failed.
2. `get_run_logs` with `taskId` set to the failing task — returns just that entry, including the captured stderr tail.
3. Decide: is it a code bug (read the project's source), a cache poisoning issue (`cache_why`), or environmental (look at the run summary's `runtime` block)?

## Safety rules

- **All tools are read-only.** The server does not execute targets. If the user wants something built/tested/linted, give them the command and let them run it.
- **All tools run in the directory where `vis-mcp` was launched.** Override at server startup by setting `VIS_MCP_WORKSPACE_ROOT`. You can read that path from the server's stderr boot line: `[vis-mcp] ready (workspace: …)`.

## When NOT to use this skill

- The user wants to write a `vis.config.ts` — that's editing source, not running the CLI. Use Read/Edit/Write on the config file directly.
- The user is asking about Turborepo, Nx, or Bazel specifically (not vis). The tools won't help with those.
- The repo has no `vis.config.*` and no mention of vis. Don't volunteer the tools.

## Tool-result conventions

All tools return JSON-encoded text in the standard MCP `content[].text` slot. On error, `isError: true` is set and the text payload is `{"error": "<message>"}`. Parse the JSON before reasoning about it — the text field is structured data, not prose.
