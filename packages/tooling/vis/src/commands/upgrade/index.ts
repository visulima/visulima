import type { Command, CreateOptions } from "@visulima/cerebro";

const upgrade: Command = {
    argument: {
        description: "Target version (defaults to latest)",
        name: "version",
        type: String,
    },
    description: "Update vis itself to the latest version",
    examples: [
        ["vis self-update", "Update to latest"],
        ["vis self-update 2.0.0", "Install specific version"],
        ["vis self-update --check", "Check for updates without installing"],
    ],
    group: "System",
    loader: () => import("./handler"),
    name: "self-update",
    options: [
        { defaultValue: false, description: "Check for updates without installing", name: "check", type: Boolean },
        { defaultValue: false, description: "Reinstall even if already current", name: "force", type: Boolean },
        { defaultValue: false, description: "Suppress output (CI mode)", name: "silent", type: Boolean },
    ],
};

export default upgrade;

export type UpgradeOptions = CreateOptions<{
    "check": boolean | undefined;
    "force": boolean | undefined;
    "silent": boolean | undefined;
}>;
