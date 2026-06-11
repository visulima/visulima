import type { Command, CreateOptions } from "@visulima/cerebro";

/**
 * `vis import` — pull an external repo into the monorepo under a target
 * prefix, preserving the incoming git history (built-in `git subtree
 * add`). Auto-registers the package into the workspace config unless
 * `--no-register` is passed.
 */
const importCommand: Command = {
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
    options: [
        { alias: "p", description: "Target directory in the monorepo (e.g. packages/tooling/foo)", name: "prefix", type: String },
        { alias: "r", description: "Branch, tag, or commit to import (default: HEAD)", name: "ref", type: String },
        { defaultValue: false, description: "Collapse the incoming history into a single merge commit", name: "squash", type: Boolean },
        { alias: "m", description: "Commit message for the subtree merge", name: "message", type: String },
        { defaultValue: false, description: "Do not register the package into the workspace config", name: "no-register", type: Boolean },
        { defaultValue: false, description: "Print the git plan instead of executing it", name: "dry-run", type: Boolean },
    ],
};

export default importCommand;

export type ImportOptions = CreateOptions<{
    "dry-run": boolean | undefined;
    message: string | undefined;
    "no-register": boolean | undefined;
    prefix: string | undefined;
    ref: string | undefined;
    squash: boolean | undefined;
}>;
