import type { InferOptions } from "@visulima/cerebro";
import { defineCommand } from "@visulima/cerebro";

import { negatable } from "../../util/negatable-option";

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
const ciOptionDefinitions = {
    ...negatable({
        defaultValue: true,
        description: "Install dependencies before running targets (use --no-install to skip)",
        name: "install",
        type: Boolean,
    }),
    base: {
        description: "Git base ref for affected detection (default: auto-detected from CI env)",
        type: String,
    },
    downstream: {
        defaultValue: "deep",
        description: "Downstream scope: none | direct | deep",
        type: String,
    },
    head: {
        description: "Git head ref for affected detection (default: HEAD)",
        type: String,
    },
    parallel: {
        defaultValue: 4,
        description: "Maximum number of parallel tasks per target",
        type: Number,
    },
    partition: {
        description: "Partition tasks for distributed CI (e.g., \"1/4\")",
        type: String,
    },
    query: {
        description: "Filter affected projects by a query (e.g. 'language=typescript && tag=lib')",
        type: String,
    },
    "skip-toolchain": {
        defaultValue: false,
        description:
                "Skip the toolchain pre-flight (no auto-install for any pinned tool: node / pnpm / yarn / npm / bun / deno / go / python / ruby / rust)",
        type: Boolean,
    },
    upstream: {
        defaultValue: "none",
        description: "Upstream scope: none | direct | deep",
        type: String,
    },
} as const;

const ci = defineCommand({
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
    options: ciOptionDefinitions,
});

export default ci;

export type CiOptions = InferOptions<typeof ciOptionDefinitions>;
