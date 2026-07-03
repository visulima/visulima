import type { Command, CreateOptions } from "@visulima/cerebro";

const add: Command = {
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
    options: [
        {
            description: "Comma-separated package:level pairs (e.g. '@scope/a:minor,@scope/b:patch')",
            name: "packages",
            type: String,
        },
        {
            description: "Changelog body for the change file",
            name: "message",
            type: String,
        },
        {
            description: "Slug for the filename (default: random animal name)",
            name: "name",
            type: String,
        },
        {
            description: "Author an empty change file (no bumps; satisfies non-strict `check`)",
            name: "empty",
            type: Boolean,
        },
        {
            description: "Author a `none` change file (acknowledged but no direct bump)",
            name: "none",
            type: Boolean,
        },
        {
            description: "Inspect the current PR (via `gh pr view`) and author a change file from its Dependabot / Renovate title (changesets #647)",
            name: "from-bot-pr",
            type: Boolean,
        },
    ],
};

export default add;

export type ReleaseAddOptions = CreateOptions<{
    empty: boolean | undefined;
    "from-bot-pr": boolean | undefined;
    message: string | undefined;
    name: string | undefined;
    none: boolean | undefined;
    packages: string | undefined;
}>;
