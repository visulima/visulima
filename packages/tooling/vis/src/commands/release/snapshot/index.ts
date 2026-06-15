import type { Command, CreateOptions } from "@visulima/cerebro";

const snapshot: Command = {
    commandPath: ["release"],
    description: "Publish 0.0.0-<tag>-<sha> snapshot versions of affected packages",
    examples: [
        ["vis release snapshot --tag pr-1234", "Publish snapshots tagged with the PR number"],
        ["vis release snapshot --tag canary --filter '@scope/*'", "Limit to a glob"],
        ["vis release snapshot --tag pr-1234 --dry-run", "Preview without uploading"],
    ],
    group: "Release",
    loader: () => import("./handler"),
    name: "snapshot",
    options: [
        {
            description: "Required: dist-tag for the snapshot release",
            name: "tag",
            type: String,
        },
        {
            description: "Override registry URL (defaults to pkg-pr-new backend or `release.snapshot.registry`)",
            name: "registry",
            type: String,
        },
        {
            description: "Glob filter (CSV) — limit snapshots to specific packages",
            name: "filter",
            type: String,
        },
        {
            description: "Print what would publish without uploading",
            name: "dry-run",
            type: Boolean,
        },
        {
            description: "Print the resolved release config and exit (--print-config=debug for runtime-resolved fields)",
            name: "print-config",
            type: String,
        },
    ],
};

export default snapshot;

export type ReleaseSnapshotOptions = CreateOptions<{
    "dry-run": boolean | undefined;
    filter: string | undefined;
    "print-config": string | undefined;
    registry: string | undefined;
    tag: string | undefined;
}>;
