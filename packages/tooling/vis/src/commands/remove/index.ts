import type { InferOptions } from "@visulima/cerebro";
import { defineCommand } from "@visulima/cerebro";

const removeOptionDefinitions = {
    filter: {
        alias: "F",
        description: "Filter by workspace package name",
        multiple: true,
        type: String,
    },
    global: {
        alias: "g",
        defaultValue: false,
        description: "Remove global package",
        type: Boolean,
    },
    recursive: {
        alias: "r",
        defaultValue: false,
        description: "Remove from all workspace packages",
        type: Boolean,
    },
    "save-dev": {
        alias: "D",
        defaultValue: false,
        description: "Remove from devDependencies",
        type: Boolean,
    },
    "workspace-root": {
        alias: "w",
        defaultValue: false,
        description: "Remove from workspace root",
        type: Boolean,
    },
} as const;

const remove = defineCommand({
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
    options: removeOptionDefinitions,
});

export default remove;

export type RemoveOptions = InferOptions<typeof removeOptionDefinitions>;
