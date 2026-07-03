import type { Command, CreateOptions } from "@visulima/cerebro";

const remove: Command = {
    alias: ["rm", "un", "uninstall"],
    argument: {
        description: "Packages to remove",
        name: "packages",
        type: String,
    },
    description: "Remove packages using the detected package manager",
    examples: [
        ["vis remove lodash", "Remove a package"],
        ["vis rm old-package", "Remove using alias"],
        ["vis remove --filter app react", "Remove from specific workspace"],
        ["vis remove -g typescript", "Remove global package"],
    ],
    group: "Dependencies",
    loader: () => import("./handler"),
    name: "remove",
    options: [
        { alias: "D", defaultValue: false, description: "Remove from devDependencies", name: "save-dev", type: Boolean },
        { alias: "g", defaultValue: false, description: "Remove global package", name: "global", type: Boolean },
        { alias: "r", defaultValue: false, description: "Remove from all workspace packages", name: "recursive", type: Boolean },
        { alias: "w", defaultValue: false, description: "Remove from workspace root", name: "workspace-root", type: Boolean },
        { alias: "F", description: "Filter by workspace package name", multiple: true, name: "filter", type: String },
    ],
};

export default remove;

export type RemoveOptions = CreateOptions<{
    filter: string[] | undefined;
    global: boolean | undefined;
    recursive: boolean | undefined;
    "save-dev": boolean | undefined;
    "workspace-root": boolean | undefined;
}>;
