import type { Command, CreateOptions } from "@visulima/cerebro";

const outdated: Command = {
    argument: {
        description: "Specific packages to check (checks all if omitted)",
        name: "packages",
        type: String,
    },
    description: "Check for outdated packages using the detected package manager",
    examples: [
        ["vis outdated", "Check all packages"],
        ["vis outdated react", "Check specific package"],
        ["vis outdated --format json", "Output as JSON"],
        ["vis outdated -r", "Check across all workspaces"],
    ],
    group: "Security & Health",
    loader: () => import("./handler"),
    name: "outdated",
    options: [
        { defaultValue: false, description: "Show extended information", name: "long", type: Boolean },
        { defaultValue: "table", description: "Output format: table, list, or json", name: "format", type: String },
        { alias: "r", defaultValue: false, description: "Check all workspaces", name: "recursive", type: Boolean },
        { alias: "w", defaultValue: false, description: "Include workspace root", name: "workspace-root", type: Boolean },
        { alias: "P", defaultValue: false, description: "Production dependencies only (pnpm)", name: "prod", type: Boolean },
        { alias: "D", defaultValue: false, description: "Dev dependencies only (pnpm)", name: "dev", type: Boolean },
        { defaultValue: false, description: "Exclude optional dependencies (pnpm)", name: "no-optional", type: Boolean },
        { defaultValue: false, description: "Show only semver-compatible updates (pnpm)", name: "compatible", type: Boolean },
        { alias: "g", defaultValue: false, description: "Check globally installed packages", name: "global", type: Boolean },
        { alias: "F", description: "Filter by workspace package name", multiple: true, name: "filter", type: String },
    ],
};

export default outdated;

export type OutdatedOptions = CreateOptions<{
    "long": boolean | undefined;
    "format": string | undefined;
    "recursive": boolean | undefined;
    "workspace-root": boolean | undefined;
    "prod": boolean | undefined;
    "dev": boolean | undefined;
    "no-optional": boolean | undefined;
    "compatible": boolean | undefined;
    "global": boolean | undefined;
    "filter": string[] | undefined;
}>;
