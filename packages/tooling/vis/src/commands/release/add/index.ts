import type { CreateOptions } from "@visulima/cerebro";
import { defineCommand } from "@visulima/cerebro";

const addOptionDefinitions = {
    empty: {
        description: "Author an empty change file (no bumps; satisfies non-strict `check`)",
        type: Boolean,
    },
    "from-bot-pr": {
        description: "Inspect the current PR (via `gh pr view`) and author a change file from its Dependabot / Renovate title (changesets #647)",
        type: Boolean,
    },
    message: {
        description: "Changelog body for the change file",
        type: String,
    },
    name: {
        description: "Slug for the filename (default: random animal name)",
        type: String,
    },
    none: {
        description: "Author a `none` change file (acknowledged but no direct bump)",
        type: Boolean,
    },
    packages: {
        description: "Comma-separated package:level pairs (e.g. '@scope/a:minor,@scope/b:patch')",
        type: String,
    },
} as const;

const add = defineCommand({
    commandPath: ["release"],
    description: "Author a new change file (interactive, or non-interactive via --packages)",
    examples: [
        ["vis release add", "Interactive prompt"],
        ["vis release add --packages '@scope/cerebro:minor,@scope/string:patch' --message 'Add tab completion'", "Non-interactive"],
        ["vis release add --empty", "Author an empty change file (acknowledges PR but releases nothing)"],
        ["vis release add --name fix-tab-completion", "Use a fixed slug instead of a random animal name"],
        ["vis release add --from-bot-pr", "Generate a change file from the current Dependabot / Renovate PR (changesets #647)"],
    ],
    group: "Release",
    loader: () => import("./handler"),
    name: "add",
    options: addOptionDefinitions,
});

export default add;

export type ReleaseAddOptions = CreateOptions<{
    empty: boolean | undefined;
    "from-bot-pr": boolean | undefined;
    message: string | undefined;
    name: string | undefined;
    none: boolean | undefined;
    packages: string | undefined;
}>;
