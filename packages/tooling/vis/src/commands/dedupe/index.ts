import type { InferOptions } from "@visulima/cerebro";
import { defineCommand } from "@visulima/cerebro";

const dedupeOptionDefinitions = {
    check: {
        defaultValue: false,
        description: "Preview changes without modifying files (dry-run)",
        type: Boolean,
    },
} as const;

const dedupe = defineCommand({
    description: "Deduplicate dependencies using the detected package manager",
    examples: [
        ["vis dedupe", "Run deduplication"],
        ["vis dedupe --check", "Preview changes without modifying (CI-friendly)"],
    ],
    group: "Dependencies",
    loader: () => import("./handler"),
    name: "dedupe",
    options: dedupeOptionDefinitions,
});

export default dedupe;

export type DedupeOptions = InferOptions<typeof dedupeOptionDefinitions>;
