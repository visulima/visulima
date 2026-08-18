import type { CreateOptions } from "@visulima/cerebro";
import { defineCommand } from "@visulima/cerebro";

const changelogOptionDefinitions = {
    channel: {
        description: "Override channel (defaults to current branch lookup)",
        type: String,
    },
    filter: {
        description: "Limit to packages matching this glob (CSV)",
        type: String,
    },
    json: {
        description: "Emit machine-readable JSON",
        type: Boolean,
    },
    "print-config": {
        description: "Print the resolved release config and exit (--print-config=debug for runtime-resolved fields)",
        type: String,
    },
} as const;

const changelog = defineCommand({
    commandPath: ["release"],
    description: "Render the would-be changelog entries without writing to disk",
    examples: [
        ["vis release changelog", "Print rendered entries for the pending plan"],
        ["vis release changelog --json", "Emit ChangelogResult (with projectChangelogs[]) as JSON"],
    ],
    group: "Release",
    loader: () => import("./handler"),
    name: "changelog",
    options: changelogOptionDefinitions,
});

export default changelog;

export type ReleaseChangelogOptions = CreateOptions<{
    channel: string | undefined;
    filter: string | undefined;
    json: boolean | undefined;
    "print-config": string | undefined;
}>;
