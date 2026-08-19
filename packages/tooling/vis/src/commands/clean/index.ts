import type { InferOptions } from "@visulima/cerebro";
import { defineCommand } from "@visulima/cerebro";

const cleanOptionDefinitions = {
    "dry-run": {
        defaultValue: false,
        description: "Preview what would be removed without deleting",
        type: Boolean,
    },
    "empty-packages": {
        alias: "e",
        defaultValue: false,
        description: "Also remove stale workspace directories that match a workspace pattern but have no package.json",
        type: Boolean,
    },
    lockfile: {
        alias: "l",
        defaultValue: false,
        description: "Also remove lockfiles (pnpm-lock.yaml, package-lock.json, etc.)",
        type: Boolean,
    },
} as const;

const clean = defineCommand({
    description: "Remove node_modules from all workspace projects",
    examples: [
        ["vis clean", "Remove all node_modules directories"],
        ["vis clean --lockfile", "Also remove lockfiles"],
        ["vis clean --empty-packages", "Also remove workspace directories that have no package.json"],
        ["vis clean --dry-run", "Preview what would be removed"],
    ],
    group: "Workspace",
    loader: () => import("./handler"),
    name: "clean",
    options: cleanOptionDefinitions,
});

export default clean;

export type CleanOptions = InferOptions<typeof cleanOptionDefinitions>;
