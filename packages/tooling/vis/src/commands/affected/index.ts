import type { Command, CreateOptions } from "@visulima/cerebro";

const affected: Command = {
    argument: {
        description: "The target to run (e.g., build, test, lint)",
        name: "target",
        type: String,
    },
    description: "Run a target only on projects affected by recent changes",
    examples: [
        ["vis affected build", "Run build on affected projects"],
        ["vis affected test --base=main", "Run tests on projects changed since main"],
        ["vis affected destroy --reverse", "Tear down affected projects leaves-first"],
        ["vis affected build --sparse-checkout", "Print a git sparse-checkout cone set for the affected projects and exit"],
    ],
    group: "Run & Execute",
    loader: () => import("./handler"),
    name: "affected",
    options: [
        {
            description:
                "Git base ref for comparison. When omitted, vis auto-resolves it from the active CI provider (GitHub/GitLab/Buildkite/CircleCI) or falls back to `git merge-base HEAD origin/<defaultBase>` locally. Default base branch comes from `vis.config.ts#defaultBase` (or `main`).",
            name: "base",
            type: String,
        },
        {
            description: "Git head ref for comparison. When omitted, auto-resolves from CI env (e.g. `$GITHUB_SHA`) or defaults to `HEAD`.",
            name: "head",
            type: String,
        },
        {
            defaultValue: "deep",
            description: "Downstream scope: \"none\", \"direct\", or \"deep\" — controls how far to include dependents of changed projects",
            name: "downstream",
            type: String,
        },
        {
            defaultValue: "none",
            description: "Upstream scope: \"none\", \"direct\", or \"deep\" — controls how far to include dependencies of changed projects",
            name: "upstream",
            type: String,
        },
        {
            defaultValue: 3,
            description: "Maximum number of parallel tasks",
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
            defaultValue: false,
            description: "Show what would run without executing",
            name: "dry-run",
            type: Boolean,
        },
        {
            defaultValue: false,
            description:
                "Instead of running, print the affected project roots as a git sparse-checkout cone set (one path per line) and exit. Pipe into `git sparse-checkout set --stdin` to shrink huge-monorepo CI checkouts.",
            name: "sparse-checkout",
            type: Boolean,
        },
        {
            description: "Partition tasks for distributed CI (e.g., \"1/4\" for first of four runners). Falls back to VIS_PARTITION env var.",
            name: "partition",
            type: String,
        },
        {
            description: "Filter affected projects by a query (e.g. 'language=typescript && tag=lib')",
            name: "query",
            type: String,
        },
        {
            defaultValue: false,
            description:
                "Run the dependency graph in reverse (leaves first, then their dependents). Useful for teardown targets like `destroy`/`undeploy` where dependents must run before the things they depend on.",
            name: "reverse",
            type: Boolean,
        },
        {
            description:
                "Comma-separated tags this runner advertises (e.g. 'gpu,slow'). Forwarded verbatim to the downstream `vis run` so capability-gated tasks resolve identically. Falls back to VIS_RUNNER_TAGS env var.",
            name: "runner-tags",
            type: String,
        },
    ],
};

export default affected;

export type AffectedCommandOptions = CreateOptions<{
    base: string | undefined;
    cache: boolean | undefined;
    downstream: string | undefined;
    "dry-run": boolean | undefined;
    head: string | undefined;
    parallel: number | undefined;
    partition: string | undefined;
    query: string | undefined;
    reverse: boolean | undefined;
    "runner-tags": string | undefined;
    "sparse-checkout": boolean | undefined;
    upstream: string | undefined;
}>;
