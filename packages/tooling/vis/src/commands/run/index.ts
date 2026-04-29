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
        ['vis run "#frontend:build"', "Run build on projects tagged 'frontend'"],
        ['vis run :build --query "language=typescript"', "Filter by project metadata"],
        ["vis run test --affected", "Run test only on git-changed projects"],
        ["vis run build --fail-fast", "Stop on first failure"],
        ["vis run build --dry-run", "Show execution plan without running"],
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
            defaultValue: false,
            description: "Skip the toolchain pre-flight (no auto-install for any pinned tool: node / pnpm / yarn / npm / bun / deno / go / python / ruby / rust)",
            name: "skip-toolchain",
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
            description: "Custom cache directory",
            name: "cache-dir",
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
            description: 'Partition tasks for distributed CI (e.g., "1/4" for first of four runners). Falls back to VIS_PARTITION env var.',
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
            description: "Output mode: interleaved (pass-through), labeled (prefix each line with [pkg#task]), or grouped (vite-task-style block)",
            name: "log",
            type: String,
        },
        {
            description: "Output style: normal (print every task) or quiet (skip output for successful/cached tasks; failed tasks still print in CI mode, and remain in TUI scrollback in interactive mode). Per-target options.outputStyle overrides this.",
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
            description: "Render the most-recent run's saved summary (from .task-runner/last-summary.json) and exit without executing any tasks",
            name: "last-details",
            type: Boolean,
        },
        {
            defaultValue: true,
            description: "Show flaky task report on failure (use --no-flaky to suppress)",
            name: "flaky",
            type: Boolean,
        },
    ],
};

export default run;

export type RunOptions = CreateOptions<{
    affected: boolean | undefined;
    cache: boolean | undefined;
    "cache-dir": string | undefined;
    "dry-run": boolean | undefined;
    "fail-fast": boolean | undefined;
    flaky: boolean | undefined;
    "last-details": boolean | undefined;
    log: string | undefined;
    "output-style": string | undefined;
    parallel: number | undefined;
    partition: string | undefined;
    profile: string | undefined;
    projects: string | undefined;
    pty: boolean | undefined;
    query: string | undefined;
    "retry-budget": number | undefined;
    "skip-constraints": boolean | undefined;
    "skip-toolchain": boolean | undefined;
    summarize: boolean | undefined;
    watch: boolean | undefined;
}>;
