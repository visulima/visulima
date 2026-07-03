import type { Command, CreateOptions } from "@visulima/cerebro";

const run: Command = {
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
    options: [
        {
            alias: "p",
            description: "Comma-separated list of projects to run",
            name: "projects",
            type: String,
        },
        {
            alias: "F",
            description:
                "pnpm-style package selector (repeatable). Supports name globs (@org/*), graph modifiers (...pkg dependents, pkg... dependencies, ...^pkg / pkg^... exclude self), changed-since ([main], ...[origin/main]), and path globs (./packages/*, {glob}).",
            multiple: true,
            name: "filter",
            type: String,
        },
        {
            defaultValue: false,
            description:
                "Skip the toolchain pre-flight (no auto-install for any pinned tool: node / pnpm / yarn / npm / bun / deno / go / python / ruby / rust)",
            name: "skip-toolchain",
            type: Boolean,
        },
        {
            // No `defaultValue` — handler treats `undefined` as "fall
            // back to config (default: enabled)" so `vis.config.ts`
            // `preflight.lockfile` can opt out workspace-wide and
            // `--no-preflight` opts out per-run without conflicting layers.
            description: "Detect lockfile/node_modules drift before running (warns in TTY, fails in CI). Use --no-preflight to disable.",
            name: "preflight",
            type: Boolean,
        },
        {
            defaultValue: 3,
            description: "Maximum number of parallel tasks (falls back to VIS_RUN_CONCURRENCY_LIMIT env var, then 3)",
            name: "parallel",
            type: Number,
        },
        {
            defaultValue: true,
            description: "Enable caching (use --no-cache to disable)",
            name: "cache",
            type: Boolean,
        },
        {
            description:
                "Comma-separated selectors of tasks to bypass cache for (e.g. 'app:test', ':e2e', '#flaky:lint'). Other tasks in the run still cache normally. --no-cache wins when both are set.",
            name: "skip-cache",
            type: String,
        },
        {
            description: "Custom cache directory",
            name: "cache-dir",
            type: String,
        },
        {
            description: "Remote cache mode: read | write | readwrite (defaults to readwrite when remoteCache is configured)",
            name: "cache-mode",
            type: String,
        },
        {
            description: "Remote cache wire backend: http (Turborepo-compatible) or reapi (Bazel Remote Execution API gRPC)",
            name: "cache-backend",
            type: String,
        },
        {
            description:
                "Override how the requested target is hashed for this run: declared (hash listed inputs) or trace (hash the files the task actually reads). Overrides per-target hashMode config for the directly-run target.",
            name: "hash-mode",
            type: String,
        },
        {
            defaultValue: false,
            description: "Show what would run without executing",
            name: "dry-run",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Generate a run summary after execution",
            name: "summarize",
            type: Boolean,
        },
        {
            description: "Partition tasks for distributed CI (e.g., \"1/4\" for first of four runners). Falls back to VIS_PARTITION env var.",
            name: "partition",
            type: String,
        },
        {
            defaultValue: false,
            description: "Skip project constraint validation",
            name: "skip-constraints",
            type: Boolean,
        },
        {
            description: "Filter matched projects by a query (e.g. 'language=typescript && tag=lib')",
            name: "query",
            type: String,
        },
        {
            defaultValue: false,
            description: "Only run on projects affected by git changes (shorthand for vis affected)",
            name: "affected",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Rerun affected tasks on file change. Ctrl+C to exit.",
            name: "watch",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Stop all tasks on first failure",
            name: "fail-fast",
            type: Boolean,
        },
        {
            defaultValue: false,
            description:
                "Run the dependency graph in reverse (leaves first, then their dependents). Useful for teardown targets like `destroy`/`undeploy` where dependents must run before the things they depend on.",
            name: "reverse",
            type: Boolean,
        },
        {
            description: "Output mode: interleaved (pass-through), labeled (prefix each line with [pkg#task]), or grouped (vite-task-style block)",
            name: "log",
            type: String,
        },
        {
            description:
                "Output style: normal (print every task) or quiet (skip output for successful/cached tasks; failed tasks still print in CI mode, and remain in TUI scrollback in interactive mode). Defaults to normal; set run.quietOnSuccess in config to make quiet the default. Per-target options.outputStyle overrides this.",
            name: "output-style",
            type: String,
        },
        {
            defaultValue: false,
            description: "Run every task through a pseudo-terminal so color-aware tools render as if attached to a TTY (disables caching)",
            name: "pty",
            type: Boolean,
        },
        {
            description: "Global retry budget: cap on total task retries across the run (per-target retryCount is still honored up to the budget)",
            name: "retry-budget",
            type: Number,
        },
        {
            description: "Write a Chrome Tracing JSON profile of the run to this path (open in chrome://tracing or Perfetto)",
            name: "profile",
            type: String,
        },
        {
            defaultValue: false,
            description: "Render the most-recent run's saved summary (from .vis/last-summary.json) and exit without executing any tasks",
            name: "last-details",
            type: Boolean,
        },
        {
            defaultValue: true,
            description: "Show flaky task report on failure (use --no-flaky to suppress)",
            name: "flaky",
            type: Boolean,
        },
        {
            defaultValue: false,
            description:
                "Treat any task that needed at least one retry as a run failure (exit non-zero), even when retries eventually succeeded. Use in CI to surface flakes that retries would otherwise mask.",
            name: "fail-on-retry",
            type: Boolean,
        },
        {
            // No `defaultValue` — `undefined` means "fall back to vis.config.ts strictEnv (default off)".
            description:
                "Fail a task if its command references an env var that is unset (no silent empty-string substitution). Use --no-strict-env to disable when set in config.",
            name: "strict-env",
            type: Boolean,
        },
        {
            description:
                "Comma-separated tags this runner advertises (e.g. 'gpu,slow'). Tasks declaring `options.runnerTags` only run when at least one tag overlaps. Untagged tasks always run. Falls back to VIS_RUNNER_TAGS env var.",
            name: "runner-tags",
            type: String,
        },
        {
            // One knob for the service-preflight feature. Falls back to
            // `vis.config.ts → run.services` and finally to a TTY-aware
            // default (auto-pick mode in a terminal, off in CI / pipes).
            // Values:
            //   auto       — pick by task: `dev` → ephemeral, others → persistent
            //   ephemeral  — services die with the run (no registry entry)
            //   persistent — services persist in the registry across runs
            //   off        — skip auto-start; print today's diagnostic and abort
            description: "Auto-start service deps. One of: auto | ephemeral | persistent | off. Defaults to `auto` in TTY, `off` in CI.",
            name: "services",
            type: String,
        },
        {
            // Opt-in cleanup for registry-mode services this run started.
            // Ephemeral services already die with the run; this only
            // affects services that would otherwise persist (the ones
            // surfaced by today's "N service(s) started in the background"
            // hint). Applies on every exit path: clean finish, `q`, Ctrl+C.
            defaultValue: false,
            description:
                "Stop services this run auto-started in registry mode when the run exits (clean, q, or Ctrl+C). Ephemeral services already die with the run.",
            name: "stop-services",
            type: Boolean,
        },
    ],
};

export default run;

export type RunOptions = CreateOptions<{
    affected: boolean | undefined;
    cache: boolean | undefined;
    "cache-backend": string | undefined;
    "cache-dir": string | undefined;
    "cache-mode": string | undefined;
    "dry-run": boolean | undefined;
    "fail-fast": boolean | undefined;
    "fail-on-retry": boolean | undefined;
    filter: string[] | undefined;
    flaky: boolean | undefined;
    "hash-mode": string | undefined;
    "last-details": boolean | undefined;
    log: string | undefined;
    "output-style": string | undefined;
    parallel: number | undefined;
    partition: string | undefined;
    preflight: boolean | undefined;
    profile: string | undefined;
    projects: string | undefined;
    pty: boolean | undefined;
    query: string | undefined;
    "retry-budget": number | undefined;
    reverse: boolean | undefined;
    "runner-tags": string | undefined;
    services: string | undefined;
    "skip-cache": string | undefined;
    "skip-constraints": boolean | undefined;
    "skip-toolchain": boolean | undefined;
    "stop-services": boolean | undefined;
    "strict-env": boolean | undefined;
    summarize: boolean | undefined;
    watch: boolean | undefined;
}>;
