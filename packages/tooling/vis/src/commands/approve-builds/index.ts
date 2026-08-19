import type { InferOptions } from "@visulima/cerebro";
import { defineCommand } from "@visulima/cerebro";

const approveBuildsOptionDefinitions = {
    all: {
        defaultValue: false,
        description: "Approve all pending builds without prompting (pnpm only)",
        type: Boolean,
    },
    scan: {
        defaultValue: false,
        description: "Force vis scanning even for pnpm (instead of delegating)",
        type: Boolean,
    },
    "sync-native": {
        defaultValue: false,
        description: "Sync allowBuilds to native PM config (bun: trustedDependencies, npm: .npmrc, yarn: .yarnrc.yml)",
        type: Boolean,
    },
    write: {
        defaultValue: false,
        description: "Write unapproved entries directly into vis.config.ts security.policies.installScripts.allow (LavaMoat 'auto' parity)",
        type: Boolean,
    },
} as const;

const approveBuilds = defineCommand({
    description: "Review and approve dependencies with build scripts",
    examples: [
        ["vis approve-builds", "Scan and list unapproved build scripts"],
        ["vis approve-builds --all", "Approve all pending builds (pnpm)"],
        ["vis approve-builds --write", "Write unapproved entries into vis.config.ts security.policies.installScripts.allow"],
        ["vis approve-builds --sync-native", "Sync allowBuilds to native PM config"],
    ],
    group: "Security & Health",
    loader: () => import("./handler"),
    name: "approve-builds",
    options: approveBuildsOptionDefinitions,
});

export default approveBuilds;

export type ApproveBuildsOptions = InferOptions<typeof approveBuildsOptionDefinitions>;
