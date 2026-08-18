import type { CreateOptions } from "@visulima/cerebro";
import { defineCommand } from "@visulima/cerebro";

const ciSnapshotOptionDefinitions = {
    "on-close": {
        description:
                "PR-close cleanup mode — enumerate the closed PR's commit SHAs and remove their snapshot tags from the registry (when supported by the backend)",
        type: Boolean,
    },
    "print-config": {
        description: "Print the resolved release config and exit (--print-config=debug for runtime-resolved fields)",
        type: String,
    },
    tag: {
        description: "Override dist-tag (default: pr-<PR_NUMBER>)",
        type: String,
    },
} as const;

const ciSnapshot = defineCommand({
    commandPath: ["release", "ci"],
    description: "CI: publish snapshot of affected packages + post sticky PR comment with install instructions",
    examples: [["vis release ci snapshot --tag pr-1234", "Publish PR snapshot + post install snippet"]],
    group: "Release",
    loader: () => import("./handler"),
    name: "snapshot",
    options: ciSnapshotOptionDefinitions,
});

export default ciSnapshot;

export type ReleaseCiSnapshotOptions = CreateOptions<{
    "on-close": boolean | undefined;
    "print-config": string | undefined;
    tag: string | undefined;
}>;
