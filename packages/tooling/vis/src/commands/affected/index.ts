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
    ],
    group: "Run & Execute",
    loader: () => import("./handler"),
    name: "affected",
    options: [
        {
            defaultValue: "HEAD~1",
            description: "Git base ref for comparison",
            name: "base",
            type: String,
        },
        {
            defaultValue: "HEAD",
            description: "Git head ref for comparison",
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
    upstream: string | undefined;
}>;
