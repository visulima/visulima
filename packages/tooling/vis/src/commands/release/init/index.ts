import type { Command, CreateOptions } from "@visulima/cerebro";

const init: Command = {
    commandPath: ["release"],
    description: "Scaffold .vis/release; migrate from changesets / bumpy / semantic-release",
    examples: [
        ["vis release init", "Auto-detect source tool and scaffold"],
        ["vis release init --from-semantic-release", "Force semantic-release migration"],
        ["vis release init --from-changesets", "Force changesets migration"],
        ["vis release init --fresh", "Skip migration; start clean"],
        ["vis release init --dry-run", "Print what would happen without writing files"],
        ["vis release init --from-semantic-release --apply", "Actually perform the semantic-release migration writes"],
    ],
    group: "Release",
    loader: () => import("./handler"),
    name: "init",
    options: [
        {
            description: "Force migration from semantic-release / multi-semantic-release",
            name: "from-semantic-release",
            type: Boolean,
        },
        {
            description: "Force migration from changesets",
            name: "from-changesets",
            type: Boolean,
        },
        {
            description: "Force migration from bumpy",
            name: "from-bumpy",
            type: Boolean,
        },
        {
            description: "Skip migration; start clean",
            name: "fresh",
            type: Boolean,
        },
        {
            description: "Print what would happen without writing files",
            name: "dry-run",
            type: Boolean,
        },
        {
            alias: "y",
            description: "Auto-confirm prompts (CI-safe)",
            name: "yes",
            type: Boolean,
        },
        {
            description: "Generate CI workflow files. GitHub → `.github/workflows/vis-release{,-check,-snapshot}.yml`. GitLab → `.gitlab-ci.yml`.",
            name: "workflows",
            type: Boolean,
        },
        {
            description: "Override package manager when generating workflows (npm | pnpm | yarn | bun). Default: auto-detect",
            name: "package-manager",
            type: String,
        },
        {
            description: "Actually perform the migration writes (not dry-run)",
            name: "apply",
            type: Boolean,
        },
    ],
};

export default init;

export type ReleaseInitOptions = CreateOptions<{
    apply: boolean | undefined;
    "dry-run": boolean | undefined;
    fresh: boolean | undefined;
    "from-bumpy": boolean | undefined;
    "from-changesets": boolean | undefined;
    "from-semantic-release": boolean | undefined;
    "package-manager": string | undefined;
    workflows: boolean | undefined;
    yes: boolean | undefined;
}>;
