import type { InferOptions } from "@visulima/cerebro";
import { defineCommand } from "@visulima/cerebro";

const implodeOptionDefinitions = {
    yes: {
        alias: "y",
        defaultValue: false,
        description: "Skip confirmation prompt",
        type: Boolean,
    },
} as const;

const implode = defineCommand({
    description: "Remove vis from the system (self-uninstall)",
    examples: [
        ["vis implode", "Interactive uninstall"],
        ["vis implode --yes", "Non-interactive uninstall (CI)"],
    ],
    group: "System",
    loader: () => import("./handler"),
    name: "implode",
    options: implodeOptionDefinitions,
});

export default implode;

export type ImplodeOptions = InferOptions<typeof implodeOptionDefinitions>;
