import type { InferOptions } from "@visulima/cerebro";
import { defineCommand } from "@visulima/cerebro";

import { negatable } from "../../util/negatable-option";

const runOptionDefinitions = {
    filter: {
        alias: "F",
        description:
                "pnpm-style package selector (repeatable). Supports name globs (@org/*), graph modifiers (...pkg dependents, pkg... dependencies, ...^pkg / pkg^... exclude self), changed-since ([main], ...[origin/main]), and path globs (./packages/*, {glob}).",
        multiple: true,
        type: String,
    },
    projects: {
        alias: "p",
        description: "Comma-separated list of projects to run",
        type: String,
    },
    "skip-toolchain": {
        defaultValue: false,
        description:
                "Skip the toolchain pre-flight (no auto-install for any pinned tool: node / pnpm / yarn / npm / bun / deno / go / python / ruby / rust)",
        type: Boolean,
    },
    ...negatable({
        // No `defaultValue` — handler treats `undefined` as "fall
        // back to config (default: enabled)" so `vis.config.ts`
        // `preflight.lockfile` can opt out workspace-wide and
        // `--no-preflight` opts out per-run without conflicting layers.
        description: "Detect lockfile/node_modules drift before running (warns in TTY, fails in CI). Use --no-preflight to disable.",
        name: "preflight",
        type: Boolean,
    }),
    parallel: {
        defaultValue: 3,
        description: "Maximum number of parallel tasks (falls back to VIS_RUN_CONCURRENCY_LIMIT env var, then 3)",
        type: Number,
    },
    ...negatable({
        defaultValue: true,
        description: "Enable caching (use --no-cache to disable)",
        name: "cache",
        type: Boolean,
    }),
    affected: {
        defaultValue: false,
        description: "Only run on projects affected by git changes. Honors --base/--head/--downstream/--upstream, same as `vis affected`.",
        type: Boolean,
    },
    base: {
        description:
                "Git base ref for --affected. When omitted, vis auto-resolves it from the active CI provider (GitHub/GitLab/Buildkite/CircleCI) or falls back to `git merge-base HEAD origin/<defaultBase>` locally. Default base branch comes from `vis.config.ts#defaultBase` (or `main`). Requires --affected.",
        type: String,
    },
    "cache-backend": {
        description: "Remote cache wire backend: http (Turborepo-compatible) or reapi (Bazel Remote Execution API gRPC)",
        type: String,
    },
    "cache-dir": {
        description: "Custom cache directory",
        type: String,
    },
    "cache-mode": {
        description: "Remote cache mode: read | write | readwrite (defaults to readwrite when remoteCache is configured)",
        type: String,
    },
    downstream: {
        description:
                "Downstream scope for --affected: \"none\", \"direct\", or \"deep\" — controls how far to include dependents of changed projects (default \"deep\"). Requires --affected.",
        type: String,
    },
    "dry-run": {
        defaultValue: false,
        description: "Show what would run without executing",
        type: Boolean,
    },
    "hash-mode": {
        description:
                "Override how the requested target is hashed for this run: declared (hash listed inputs) or trace (hash the files the task actually reads). Overrides per-target hashMode config for the directly-run target.",
        type: String,
    },
    head: {
        description:
                "Git head ref for --affected. When omitted, auto-resolves from CI env (e.g. `$GITHUB_SHA`) or defaults to `HEAD`. Requires --affected.",
        type: String,
    },
    partition: {
        description: "Partition tasks for distributed CI (e.g., \"1/4\" for first of four runners). Falls back to VIS_PARTITION env var.",
        type: String,
    },
    query: {
        description: "Filter matched projects by a query (e.g. 'language=typescript && tag=lib')",
        type: String,
    },
    "skip-cache": {
        description:
                "Comma-separated selectors of tasks to bypass cache for (e.g. 'app:test', ':e2e', '#flaky:lint'). Other tasks in the run still cache normally. --no-cache wins when both are set.",
        type: String,
    },
    "skip-constraints": {
        defaultValue: false,
        description: "Skip project constraint validation",
        type: Boolean,
    },
    summarize: {
        defaultValue: false,
        description: "Generate a run summary after execution",
        type: Boolean,
    },
    tag: {
        description:
                "Only run projects carrying one of these tags (repeatable, or comma-separated). Shorthand for --query=\"tag=…\"; combines with --query as AND.",
        multiple: true,
        type: String,
    },
    upstream: {
        description:
                "Upstream scope for --affected: \"none\", \"direct\", or \"deep\" — controls how far to include dependencies of changed projects (default \"none\"). Requires --affected.",
        type: String,
    },
    ...negatable({
        // Mirrors `vis affected --uncommitted`. `undefined` means
        // "auto": include working-tree changes for local interactive
        // runs, ignore them in CI where the checkout is the truth.
        description:
                "Include uncommitted working-tree changes when computing --affected. Defaults to on for local runs and off in CI; use --no-uncommitted to force off.",
        name: "uncommitted",
        type: Boolean,
    }),
    "fail-fast": {
        defaultValue: false,
        description: "Stop all tasks on first failure",
        type: Boolean,
    },
    "last-details": {
        defaultValue: false,
        description: "Render the most-recent run's saved summary (from .vis/last-summary.json) and exit without executing any tasks",
        type: Boolean,
    },
    log: {
        description: "Output mode: interleaved (pass-through), labeled (prefix each line with [pkg#task]), or grouped (vite-task-style block)",
        type: String,
    },
    "output-style": {
        description:
                "Output style: normal (print every task) or quiet (skip output for successful/cached tasks; failed tasks still print in CI mode, and remain in TUI scrollback in interactive mode). Defaults to normal; set run.quietOnSuccess in config to make quiet the default. Per-target options.outputStyle overrides this.",
        type: String,
    },
    profile: {
        description: "Write a Chrome Tracing JSON profile of the run to this path (open in chrome://tracing or Perfetto)",
        type: String,
    },
    pty: {
        defaultValue: false,
        description: "Run every task through a pseudo-terminal so color-aware tools render as if attached to a TTY (disables caching)",
        type: Boolean,
    },
    "retry-budget": {
        description: "Global retry budget: cap on total task retries across the run (per-target retryCount is still honored up to the budget)",
        type: Number,
    },
    reverse: {
        defaultValue: false,
        description:
                "Run the dependency graph in reverse (leaves first, then their dependents). Useful for teardown targets like `destroy`/`undeploy` where dependents must run before the things they depend on.",
        type: Boolean,
    },
    watch: {
        defaultValue: false,
        description: "Rerun affected tasks on file change. Ctrl+C to exit.",
        type: Boolean,
    },
    ...negatable({
        defaultValue: true,
        description: "Show flaky task report on failure (use --no-flaky to suppress)",
        name: "flaky",
        type: Boolean,
    }),
    "fail-on-retry": {
        defaultValue: false,
        description:
                "Treat any task that needed at least one retry as a run failure (exit non-zero), even when retries eventually succeeded. Use in CI to surface flakes that retries would otherwise mask.",
        type: Boolean,
    },
    ...negatable({
        // No `defaultValue` — `undefined` means "fall back to vis.config.ts strictEnv (default off)".
        description:
                "Fail a task if its command references an env var that is unset (no silent empty-string substitution). Use --no-strict-env to disable when set in config.",
        name: "strict-env",
        type: Boolean,
    }),
    "runner-tags": {
        description:
                "Comma-separated tags this runner advertises (e.g. 'gpu,slow'). Tasks declaring `options.runnerTags` only run when at least one tag overlaps. Untagged tasks always run. Falls back to VIS_RUNNER_TAGS env var.",
        type: String,
    },
    services: {
        description: "Auto-start service deps. One of: auto | ephemeral | persistent | off. Defaults to `auto` in TTY, `off` in CI.",
        type: String,
    },
    "stop-services": {
        defaultValue: false,
        description:
                "Stop services this run auto-started in registry mode when the run exits (clean, q, or Ctrl+C). Ephemeral services already die with the run.",
        type: Boolean,
    },
} as const;

const run = defineCommand({
    argument: {
        description: "The target to run (e.g., build, test, lint)",
        name: "target",
        type: String,
    },
    description: "Run a target across workspace projects",
    examples: [
        ["vis run", "List all available targets"],
        ["vis run build", "Run build on all projects"],
        ["vis run :build", "Run build on all projects (moon-style)"],
        ["vis run ~:test", "Run test on the project closest to the current directory"],
        ["vis run \"#frontend:build\"", "Run build on projects tagged 'frontend'"],
        ["vis run :build --query \"language=typescript\"", "Filter by project metadata"],
        ["vis run build --filter \"@org/web\"", "Run build on a single package (pnpm filter)"],
        ["vis run build --filter \"...@org/web\"", "Run build on @org/web and everything that depends on it"],
        ["vis run build -F \"@org/web...\"", "Run build on @org/web and its dependencies"],
        ["vis run build -F \"...[origin/main]\"", "Run build on packages changed since origin/main + their dependents"],
        ["vis run build -F \"./packages/*\"", "Run build on packages matched by a path glob"],
        ["vis run test --affected", "Run test only on git-changed projects"],
        ["vis run build --fail-fast", "Stop on first failure"],
        ["vis run build --dry-run", "Show execution plan without running"],
        ["vis run destroy --reverse", "Run leaves-first (teardown order, e.g. CDK/Pulumi destroy)"],
    ],
    group: "Run & Execute",
    loader: () => import("./handler"),
    name: "run",
    options: runOptionDefinitions,
});

export default run;

export type RunOptions = InferOptions<typeof runOptionDefinitions>;
