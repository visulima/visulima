import type { InferOptions } from "@visulima/cerebro";
import { defineCommand } from "@visulima/cerebro";

const whyOptionDefinitions = {
    depth: {
        description: "Limit dependency tree depth",
        type: Number,
    },
    dev: {
        alias: "D",
        conflicts: "prod",
        description: "Filter to dev dependencies (pnpm)",
        type: Boolean,
    },
    filter: {
        alias: "F",
        description: "Filter by workspace package name",
        multiple: true,
        type: String,
    },
    global: {
        alias: "g",
        defaultValue: false,
        description: "Check globally installed packages (pnpm)",
        type: Boolean,
    },
    json: {
        defaultValue: false,
        description: "Output as JSON",
        type: Boolean,
    },
    long: {
        defaultValue: false,
        description: "Show extended information (pnpm)",
        type: Boolean,
    },
    "no-optional": {
        defaultValue: false,
        description: "Exclude optional dependencies (pnpm)",
        type: Boolean,
    },
    parseable: {
        defaultValue: false,
        description: "Machine-readable output (pnpm)",
        type: Boolean,
    },
    prod: {
        alias: "P",
        conflicts: "dev",
        description: "Filter to production dependencies (pnpm)",
        type: Boolean,
    },
    recursive: {
        alias: "r",
        defaultValue: false,
        description: "Check across all workspaces",
        type: Boolean,
    },
} as const;

const why = defineCommand({
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
    options: whyOptionDefinitions,
});

export default why;

export type WhyOptions = InferOptions<typeof whyOptionDefinitions>;
