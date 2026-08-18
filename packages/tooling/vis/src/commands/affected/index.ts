import type { InferOptions } from "@visulima/cerebro";
import { defineCommand } from "@visulima/cerebro";

import { negatable } from "../../util/negatable-option";

const affectedOptionDefinitions = {
    base: {
        description:
                "Git base ref for comparison. When omitted, vis auto-resolves it from the active CI provider (GitHub/GitLab/Buildkite/CircleCI) or falls back to `git merge-base HEAD origin/<defaultBase>` locally. Default base branch comes from `vis.config.ts#defaultBase` (or `main`).",
        type: String,
    },
    head: {
        description: "Git head ref for comparison. When omitted, auto-resolves from CI env (e.g. `$GITHUB_SHA`) or defaults to `HEAD`.",
        type: String,
    },
    ...negatable({
        // No `defaultValue` — `undefined` means "auto": include the
        // working tree for local runs, ignore it in CI where the
        // checkout is the whole truth.
        description:
                "Include uncommitted working-tree changes (tracked edits and untracked files) in the changed-file set. Defaults to on for local runs and off in CI; use --no-uncommitted to force off.",
        name: "uncommitted",
        type: Boolean,
    }),
    downstream: {
        defaultValue: "deep",
        description: "Downstream scope: \"none\", \"direct\", or \"deep\" — controls how far to include dependents of changed projects",
        type: String,
    },
    parallel: {
        defaultValue: 3,
        description: "Maximum number of parallel tasks",
        type: Number,
    },
    upstream: {
        defaultValue: "none",
        description: "Upstream scope: \"none\", \"direct\", or \"deep\" — controls how far to include dependencies of changed projects",
        type: String,
    },
    ...negatable({
        defaultValue: true,
        description: "Enable caching (use --no-cache to disable)",
        name: "cache",
        type: Boolean,
    }),
    "dry-run": {
        defaultValue: false,
        description: "Show what would run without executing",
        type: Boolean,
    },
    partition: {
        description: "Partition tasks for distributed CI (e.g., \"1/4\" for first of four runners). Falls back to VIS_PARTITION env var.",
        type: String,
    },
    query: {
        description: "Filter affected projects by a query (e.g. 'language=typescript && tag=lib')",
        type: String,
    },
    reverse: {
        defaultValue: false,
        description:
                "Run the dependency graph in reverse (leaves first, then their dependents). Useful for teardown targets like `destroy`/`undeploy` where dependents must run before the things they depend on.",
        type: Boolean,
    },
    "runner-tags": {
        description:
                "Comma-separated tags this runner advertises (e.g. 'gpu,slow'). Forwarded verbatim to the downstream `vis run` so capability-gated tasks resolve identically. Falls back to VIS_RUNNER_TAGS env var.",
        type: String,
    },
    "sparse-checkout": {
        defaultValue: false,
        description:
                "Instead of running, print the affected project roots as a git sparse-checkout cone set (one path per line) and exit. Pipe into `git sparse-checkout set --stdin` to shrink huge-monorepo CI checkouts.",
        type: Boolean,
    },
    tag: {
        description:
                "Only run affected projects carrying one of these tags (repeatable, or comma-separated). Shorthand for --query=\"tag=…\"; combines with --query as AND.",
        multiple: true,
        type: String,
    },
} as const;

const affected = defineCommand({
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
    options: affectedOptionDefinitions,
});

export default affected;

export type AffectedCommandOptions = InferOptions<typeof affectedOptionDefinitions>;
