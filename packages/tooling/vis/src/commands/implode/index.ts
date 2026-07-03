import type { Command, CreateOptions } from "@visulima/cerebro";

const implode: Command = {
    description: "Remove vis from the system (self-uninstall)",
    examples: [
        ["vis implode", "Interactive uninstall"],
        ["vis implode --yes", "Non-interactive uninstall (CI)"],
    ],
    group: "System",
    loader: () => import("./handler"),
    name: "implode",
    options: [{ alias: "y", defaultValue: false, description: "Skip confirmation prompt", name: "yes", type: Boolean }],
};

export default implode;

export type ImplodeOptions = CreateOptions<{
    yes: boolean | undefined;
}>;
