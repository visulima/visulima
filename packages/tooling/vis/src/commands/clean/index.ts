import type { Command, CreateOptions } from "@visulima/cerebro";

const clean: Command = {
    description: "Remove node_modules from all workspace projects",
    examples: [
        ["vis clean", "Remove all node_modules directories"],
        ["vis clean --lockfile", "Also remove lockfiles"],
        ["vis clean --dry-run", "Preview what would be removed"],
    ],
    group: "Workspace",
    loader: () => import("./handler"),
    name: "clean",
    options: [
        { alias: "l", defaultValue: false, description: "Also remove lockfiles (pnpm-lock.yaml, package-lock.json, etc.)", name: "lockfile", type: Boolean },
        { defaultValue: false, description: "Preview what would be removed without deleting", name: "dry-run", type: Boolean },
    ],
};

export default clean;

export type CleanOptions = CreateOptions<{
    "lockfile": boolean | undefined;
    "dry-run": boolean | undefined;
}>;
