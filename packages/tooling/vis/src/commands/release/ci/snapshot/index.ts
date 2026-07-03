import type { Command, CreateOptions } from "@visulima/cerebro";

const ciSnapshot: Command = {
    commandPath: ["release", "ci"],
    description: "CI: publish snapshot of affected packages + post sticky PR comment with install instructions",
    examples: [["vis release ci snapshot --tag pr-1234", "Publish PR snapshot + post install snippet"]],
    group: "Release",
    loader: () => import("./handler"),
    name: "snapshot",
    options: [
        {
            description: "Override dist-tag (default: pr-<PR_NUMBER>)",
            name: "tag",
            type: String,
        },
        {
            description:
                "PR-close cleanup mode — enumerate the closed PR's commit SHAs and remove their snapshot tags from the registry (when supported by the backend)",
            name: "on-close",
            type: Boolean,
        },
        {
            description: "Print the resolved release config and exit (--print-config=debug for runtime-resolved fields)",
            name: "print-config",
            type: String,
        },
    ],
};

export default ciSnapshot;

export type ReleaseCiSnapshotOptions = CreateOptions<{
    "on-close": boolean | undefined;
    "print-config": string | undefined;
    tag: string | undefined;
}>;
