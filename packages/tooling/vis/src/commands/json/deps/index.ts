import type { Command, CreateOptions } from "@visulima/cerebro";
import { lazyNamed } from "@visulima/cerebro";

const jsonDeps: Command = {
    commandPath: ["json"],
    description: "Stream every workspace dep-instance as NDJSON (one record per line) to stdout",
    examples: [
        ["vis json deps", "Emit every dep-instance as NDJSON"],
        ["vis json deps --internal-only", "Only workspace/internal deps"],
        ["vis json deps --external-only --dep-type=dependencies", "External runtime deps only"],
        ["vis json deps --include '@scope/*'", "Limit to packages under @scope/"],
        ["vis json deps --exclude '@scope/internal-*'", "Drop matching declaring packages"],
        ["vis json deps --format=json --pretty", "Single pretty-printed JSON array"],
        ["vis json deps | jq -r '.depName' | sort -u", "Pipe to jq for unique deps"],
    ],
    group: "Workspace",
    loader: lazyNamed(() => import("./handler"), "jsonDepsExecute"),
    name: "deps",
    options: [
        {
            description: "Glob of declaring package names to keep. Repeatable.",
            multiple: true,
            name: "include",
            type: String,
        },
        {
            description: "Glob of declaring package names to drop. Repeatable.",
            multiple: true,
            name: "exclude",
            type: String,
        },
        {
            description:
                "Restrict to a specific dep block (dependencies, devDependencies, peerDependencies, optionalDependencies, overrides, resolutions, pnpm.overrides). Repeatable.",
            multiple: true,
            name: "dep-type",
            type: String,
        },
        {
            defaultValue: false,
            description: "Only emit internal/workspace deps",
            name: "internal-only",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Only emit external/registry deps",
            name: "external-only",
            type: Boolean,
        },
        {
            defaultValue: "ndjson",
            description: "Output format: ndjson (default, line-streamed) or json (single array)",
            name: "format",
            type: String,
        },
        {
            defaultValue: false,
            description: "Pretty-print with 2-space indent (only meaningful with --format=json)",
            name: "pretty",
            type: Boolean,
        },
    ],
};

export default jsonDeps;

export type JsonDepsOptions = CreateOptions<{
    "dep-type": string[] | undefined;
    exclude: string[] | undefined;
    "external-only": boolean | undefined;
    format: string | undefined;
    include: string[] | undefined;
    "internal-only": boolean | undefined;
    pretty: boolean | undefined;
}>;
