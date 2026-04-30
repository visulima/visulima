import type { Command, CreateOptions } from "@visulima/cerebro";

/**
 * `vis ci` bundles the CI lifecycle in a single entry:
 *
 * 1. Install dependencies (respecting lockfile / frozen install).
 * 2. Enforce project constraints (implicit, via the `run` command).
 * 3. Determine affected projects since the base ref.
 * 4. Run the requested targets on affected projects only.
 *
 * Meant to be invoked as a single command at the top of a CI job:
 *
 *   vis ci lint test build
 *
 * Compared to wiring these up by hand, this skips reinstalling when
 * already installed, uses CI-safe defaults, and picks up the base ref
 * from common CI provider environment variables.
 */
const ci: Command = {
    argument: {
        description: "Comma-separated list of targets to run (e.g., lint,test,build)",
        name: "targets",
        type: String,
    },
    description: "Run affected targets in a CI-optimized pipeline",
    examples: [
        ["vis ci lint,test,build", "Run lint, test, and build on affected projects"],
        ["vis ci test --base=origin/main", "Override the base ref"],
        ["vis ci build --no-install", "Skip the install step (assume deps already present)"],
        ["vis ci build --parallel=6", "Increase concurrency"],
    ],
    group: "Run & Execute",
    loader: () => import("./handler"),
    name: "ci",
    options: [
        {
            defaultValue: true,
            description: "Install dependencies before running targets (use --no-install to skip)",
            name: "install",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Skip the toolchain pre-flight (no auto-install for any pinned tool: node / pnpm / yarn / npm / bun / deno / go / python / ruby / rust)",
            name: "skip-toolchain",
            type: Boolean,
        },
        {
            description: "Git base ref for affected detection (default: auto-detected from CI env)",
            name: "base",
            type: String,
        },
        {
            description: "Git head ref for affected detection (default: HEAD)",
            name: "head",
            type: String,
        },
        {
            defaultValue: "none",
            description: "Upstream scope: none | direct | deep",
            name: "upstream",
            type: String,
        },
        {
            defaultValue: "deep",
            description: "Downstream scope: none | direct | deep",
            name: "downstream",
            type: String,
        },
        {
            defaultValue: 4,
            description: "Maximum number of parallel tasks per target",
            name: "parallel",
            type: Number,
        },
        {
            description: 'Partition tasks for distributed CI (e.g., "1/4")',
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

export default ci;

export type CiOptions = CreateOptions<{
    base: string | undefined;
    downstream: string | undefined;
    head: string | undefined;
    install: boolean | undefined;
    parallel: number | undefined;
    partition: string | undefined;
    query: string | undefined;
    "skip-toolchain": boolean | undefined;
    upstream: string | undefined;
}>;
