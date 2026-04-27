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
            description: 'Downstream scope: "none", "direct", or "deep" — controls how far to include dependents of changed projects',
            name: "downstream",
            type: String,
        },
        {
            defaultValue: "none",
            description: 'Upstream scope: "none", "direct", or "deep" — controls how far to include dependencies of changed projects',
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
            description: 'Partition tasks for distributed CI (e.g., "1/4" for first of four runners). Falls back to VIS_PARTITION env var.',
            name: "partition",
            type: String,
        },
        {
            description: "Filter affected projects by a query (e.g. 'language=typescript && tag=lib')",
            name: "query",
            type: String,
        },
    ],
};

export default affected;

export type AffectedCommandOptions = CreateOptions<{
    "base": string | undefined;
    "head": string | undefined;
    "downstream": string | undefined;
    "upstream": string | undefined;
    "parallel": number | undefined;
    "cache": boolean | undefined;
    "dry-run": boolean | undefined;
    "partition": string | undefined;
    "query": string | undefined;
}>;
