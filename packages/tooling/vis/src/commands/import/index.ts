import type { InferOptions } from "@visulima/cerebro";
import { defineCommand } from "@visulima/cerebro";

/**
 * `vis import` — pull an external repo into the monorepo under a target
 * prefix, preserving the incoming git history (built-in `git subtree
 * add`). Auto-registers the package into the workspace config unless
 * `--no-register` is passed.
 */
const importCommandOptionDefinitions = {
    "dry-run": {
        defaultValue: false,
        description: "Print the git plan instead of executing it",
        type: Boolean,
    },
    message: {
        alias: "m",
        description: "Commit message for the subtree merge",
        type: String,
    },
    "no-register": {
        defaultValue: false,
        description: "Do not register the package into the workspace config",
        type: Boolean,
    },
    prefix: {
        alias: "p",
        description: "Target directory in the monorepo (e.g. packages/tooling/foo)",
        type: String,
    },
    ref: {
        alias: "r",
        description: "Branch, tag, or commit to import (default: HEAD)",
        type: String,
    },
    squash: {
        defaultValue: false,
        description: "Collapse the incoming history into a single merge commit",
        type: Boolean,
    },
} as const;

const importCommand = defineCommand({
    argument: { description: "Source git repository URL or local path to import", name: "source", type: String },
    description: "Import an external repo into the monorepo under a prefix, preserving history",
    examples: [
        ["vis import git@github.com:me/foo.git --prefix packages/tooling/foo", "Import a repo under packages/tooling/foo"],
        ["vis import ../foo --prefix packages/foo --ref v1.2.0", "Import a specific tag/branch/commit"],
        ["vis import ../foo --prefix packages/foo --squash", "Collapse the incoming history into one commit"],
        ["vis import ../foo --prefix packages/foo --dry-run", "Print the git plan without making changes"],
    ],
    group: "Workspace",
    loader: () => import("./handler"),
    name: "import",
    options: importCommandOptionDefinitions,
});

export default importCommand;

export type ImportOptions = InferOptions<typeof importCommandOptionDefinitions>;
