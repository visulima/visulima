import type { InferOptions } from "@visulima/cerebro";
import { defineCommand } from "@visulima/cerebro";

const snapshotOptionDefinitions = {
    "dry-run": {
        description: "Print what would publish without uploading",
        type: Boolean,
    },
    filter: {
        description: "Glob filter (CSV) — limit snapshots to specific packages",
        type: String,
    },
    "print-config": {
        description: "Print the resolved release config and exit (--print-config=debug for runtime-resolved fields)",
        type: String,
    },
    registry: {
        description: "Override registry URL (defaults to pkg-pr-new backend or `release.snapshot.registry`)",
        type: String,
    },
    tag: {
        description: "Required: dist-tag for the snapshot release",
        type: String,
    },
} as const;

const snapshot = defineCommand({
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
    options: snapshotOptionDefinitions,
});

export default snapshot;

export type ReleaseSnapshotOptions = InferOptions<typeof snapshotOptionDefinitions>;
