import type { InferOptions } from "@visulima/cerebro";
import { defineCommand } from "@visulima/cerebro";

const upgradeOptionDefinitions = {
    check: {
        defaultValue: false,
        description: "Check for updates without installing",
        type: Boolean,
    },
    force: {
        defaultValue: false,
        description: "Reinstall even if already current",
        type: Boolean,
    },
    silent: {
        defaultValue: false,
        description: "Suppress output (CI mode)",
        type: Boolean,
    },
} as const;

const upgrade = defineCommand({
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
    options: upgradeOptionDefinitions,
});

export default upgrade;

export type UpgradeOptions = InferOptions<typeof upgradeOptionDefinitions>;
