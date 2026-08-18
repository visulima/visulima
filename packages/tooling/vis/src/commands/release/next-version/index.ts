import type { CreateOptions } from "@visulima/cerebro";
import { defineCommand } from "@visulima/cerebro";

const nextVersionOptionDefinitions = {
    channel: {
        description: "Override channel (defaults to current branch lookup)",
        type: String,
    },
    "first-release": {
        description:
                "Bootstrap mode for greenfield monorepos: preview the plan without registry / tag lookups (matches `vis release version --first-release`).",
        type: Boolean,
    },
    json: {
        description: "Emit a JSON `{ name: { from, to } }` map instead of pretty lines",
        type: Boolean,
    },
    package: {
        description: "Limit output to a single package",
        type: String,
    },
    "print-config": {
        description: "Print the resolved release config and exit (--print-config=debug for runtime-resolved fields)",
        type: String,
    },
} as const;

const nextVersion = defineCommand({
    commandPath: ["release"],
    description: "Print the next computed version for each package in the release plan. Read-only; no mutations.",
    examples: [
        ["vis release next-version", "Print `<pkg> <old> -> <new>` for every package in the plan"],
        ["vis release next-version --package=@scope/a", "Single-package mode"],
        ["vis release next-version --json", "Emit a `{ name: { from, to } }` JSON map"],
    ],
    group: "Release",
    loader: () => import("./handler"),
    name: "next-version",
    options: nextVersionOptionDefinitions,
});

export default nextVersion;

export type ReleaseNextVersionOptions = CreateOptions<{
    channel: string | undefined;
    "first-release": boolean | undefined;
    json: boolean | undefined;
    package: string | undefined;
    "print-config": string | undefined;
}>;
