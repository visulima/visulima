import type { Command, CreateOptions } from "@visulima/cerebro";

const approveBuilds: Command = {
    description: "Review and approve dependencies with build scripts",
    examples: [
        ["vis approve-builds", "Scan and list unapproved build scripts"],
        ["vis approve-builds --all", "Approve all pending builds (pnpm)"],
        ["vis approve-builds --write", "Write unapproved entries into vis.config.ts security.policies.install_scripts.allow"],
        ["vis approve-builds --sync-native", "Sync allowBuilds to native PM config"],
    ],
    group: "Security & Health",
    loader: () => import("./handler"),
    name: "approve-builds",
    options: [
        { defaultValue: false, description: "Approve all pending builds without prompting (pnpm only)", name: "all", type: Boolean },
        { defaultValue: false, description: "Force vis scanning even for pnpm (instead of delegating)", name: "scan", type: Boolean },
        {
            defaultValue: false,
            description: "Sync allowBuilds to native PM config (bun: trustedDependencies, npm: .npmrc, yarn: .yarnrc.yml)",
            name: "sync-native",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Write unapproved entries directly into vis.config.ts security.policies.install_scripts.allow (LavaMoat 'auto' parity)",
            name: "write",
            type: Boolean,
        },
    ],
};

export default approveBuilds;

export type ApproveBuildsOptions = CreateOptions<{
    all: boolean | undefined;
    scan: boolean | undefined;
    "sync-native": boolean | undefined;
    write: boolean | undefined;
}>;
