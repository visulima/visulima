import type { Command, CreateOptions } from "@visulima/cerebro";

const changelog: Command = {
    commandPath: ["release"],
    description: "Render the would-be changelog entries without writing to disk",
    examples: [
        ["vis release changelog", "Print rendered entries for the pending plan"],
        ["vis release changelog --json", "Emit ChangelogResult (with projectChangelogs[]) as JSON"],
    ],
    group: "Release",
    loader: () => import("./handler"),
    name: "changelog",
    options: [
        {
            description: "Emit machine-readable JSON",
            name: "json",
            type: Boolean,
        },
        {
            description: "Limit to packages matching this glob (CSV)",
            name: "filter",
            type: String,
        },
        {
            description: "Override channel (defaults to current branch lookup)",
            name: "channel",
            type: String,
        },
        {
            description: "Print the resolved release config and exit (--print-config=debug for runtime-resolved fields)",
            name: "print-config",
            type: String,
        },
    ],
};

export default changelog;

export type ReleaseChangelogOptions = CreateOptions<{
    channel: string | undefined;
    filter: string | undefined;
    json: boolean | undefined;
    "print-config": string | undefined;
}>;
