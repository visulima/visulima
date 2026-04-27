import type { Command, CreateOptions } from "@visulima/cerebro";

const dedupe: Command = {
    description: "Deduplicate dependencies using the detected package manager",
    examples: [
        ["vis dedupe", "Run deduplication"],
        ["vis dedupe --check", "Preview changes without modifying (CI-friendly)"],
    ],
    group: "Dependencies",
    loader: () => import("./handler"),
    name: "dedupe",
    options: [{ defaultValue: false, description: "Preview changes without modifying files (dry-run)", name: "check", type: Boolean }],
};

export default dedupe;

export type DedupeOptions = CreateOptions<{
    "check": boolean | undefined;
}>;
