import type { Command, CreateOptions } from "@visulima/cerebro";

const why: Command = {
    alias: "explain",
    argument: {
        description: "Package(s) to explain",
        name: "packages",
        type: String,
    },
    description: "Show why a package is installed (dependency chain)",
    examples: [
        ["vis why react", "Show why react is installed"],
        ["vis why react --json", "Output as JSON"],
        ["vis why react -r", "Check across all workspaces"],
        ["vis explain react", "Alias matching npm's command"],
    ],
    group: "Dependencies",
    loader: () => import("./handler"),
    name: "why",
    options: [
        { defaultValue: false, description: "Output as JSON", name: "json", type: Boolean },
        { defaultValue: false, description: "Show extended information (pnpm)", name: "long", type: Boolean },
        { defaultValue: false, description: "Machine-readable output (pnpm)", name: "parseable", type: Boolean },
        { alias: "r", defaultValue: false, description: "Check across all workspaces", name: "recursive", type: Boolean },
        { alias: "D", conflicts: "prod", description: "Filter to dev dependencies (pnpm)", name: "dev", type: Boolean },
        { alias: "P", conflicts: "dev", description: "Filter to production dependencies (pnpm)", name: "prod", type: Boolean },
        { defaultValue: false, description: "Exclude optional dependencies (pnpm)", name: "no-optional", type: Boolean },
        { alias: "g", defaultValue: false, description: "Check globally installed packages (pnpm)", name: "global", type: Boolean },
        { description: "Limit dependency tree depth", name: "depth", type: Number },
        { alias: "F", description: "Filter by workspace package name", multiple: true, name: "filter", type: String },
    ],
};

export default why;

export type WhyOptions = CreateOptions<{
    depth: number | undefined;
    dev: boolean | undefined;
    filter: string[] | undefined;
    global: boolean | undefined;
    json: boolean | undefined;
    long: boolean | undefined;
    "no-optional": boolean | undefined;
    parseable: boolean | undefined;
    prod: boolean | undefined;
    recursive: boolean | undefined;
}>;
