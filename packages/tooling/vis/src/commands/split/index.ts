import type { Command, CreateOptions } from "@visulima/cerebro";

/**
 * `vis split` — extract a package out of the monorepo into a new
 * standalone git repo, preserving the history of just that subtree
 * (built-in `git subtree split`). Optionally wires up a remote, pushes,
 * and removes the package from the monorepo.
 */
const split: Command = {
    argument: { description: "Project name or workspace-relative path of the package to extract", name: "package", type: String },
    description: "Extract a package into a standalone git repo, preserving its history",
    examples: [
        ["vis split @scope/pkg --output ../pkg-repo", "Extract a package into a new repo at ../pkg-repo"],
        ["vis split packages/tooling/foo -o ../foo --remote git@github.com:me/foo.git --push", "Extract, set origin, and push"],
        ["vis split @scope/pkg -o ../pkg --remove", "Extract, then delete the package from the monorepo (committed)"],
        ["vis split @scope/pkg --dry-run", "Print the git plan without making changes"],
    ],
    group: "Workspace",
    loader: () => import("./handler"),
    name: "split",
    options: [
        { alias: "o", description: "Destination directory for the new repo (required unless --dry-run)", name: "output", type: String },
        { alias: "b", description: "Default branch name in the new repo (default: vis.config defaultBase or \"main\")", name: "branch", type: String },
        { description: "Git remote URL to set as origin on the new repo", name: "remote", type: String },
        { defaultValue: false, description: "Push the new repo to origin (requires --remote)", name: "push", type: Boolean },
        { defaultValue: false, description: "Delete the package from the monorepo after extracting and commit the removal", name: "remove", type: Boolean },
        { defaultValue: false, description: "Prefix the rewritten commit messages with the package name", name: "annotate", type: Boolean },
        { defaultValue: false, description: "Use a non-empty --output directory anyway", name: "force", type: Boolean },
        { defaultValue: false, description: "Print the git plan instead of executing it", name: "dry-run", type: Boolean },
    ],
};

export default split;

export type SplitOptions = CreateOptions<{
    annotate: boolean | undefined;
    branch: string | undefined;
    "dry-run": boolean | undefined;
    force: boolean | undefined;
    output: string | undefined;
    push: boolean | undefined;
    remote: string | undefined;
    remove: boolean | undefined;
}>;
