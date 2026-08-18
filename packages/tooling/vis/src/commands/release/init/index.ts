import type { CreateOptions } from "@visulima/cerebro";
import { defineCommand } from "@visulima/cerebro";

const initOptionDefinitions = {
    agent: {
        description: "Append a 'Releasing with vis' section to AGENTS.md so AI agents know how to drive the release flow",
        type: Boolean,
    },
    apply: {
        description: "Actually perform the migration writes (not dry-run)",
        type: Boolean,
    },
    "dry-run": {
        description: "Print what would happen without writing files",
        type: Boolean,
    },
    fresh: {
        description: "Skip migration; start clean",
        type: Boolean,
    },
    "from-bumpy": {
        description: "Force migration from bumpy",
        type: Boolean,
    },
    "from-changesets": {
        description: "Force migration from changesets",
        type: Boolean,
    },
    "from-semantic-release": {
        description: "Force migration from semantic-release / multi-semantic-release",
        type: Boolean,
    },
    "package-manager": {
        description: "Override package manager when generating workflows (npm | pnpm | yarn | bun). Default: auto-detect",
        type: String,
    },
    workflows: {
        description: "Generate CI workflow files. GitHub → `.github/workflows/vis-release{,-check,-snapshot}.yml`. GitLab → `.gitlab-ci.yml`.",
        type: Boolean,
    },
    yes: {
        alias: "y",
        description: "Auto-confirm prompts (CI-safe)",
        type: Boolean,
    },
} as const;

const init = defineCommand({
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
    options: initOptionDefinitions,
});

export default init;

export type ReleaseInitOptions = CreateOptions<{
    agent: boolean | undefined;
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
