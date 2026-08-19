import type { CreateOptions } from "@visulima/cerebro";
import { defineCommand } from "@visulima/cerebro";

const ciPlanOptionDefinitions = {
    "print-config": {
        description: "Print the resolved release config and exit (--print-config=debug for runtime-resolved fields)",
        type: String,
    },
} as const;

const ciPlan = defineCommand({
    commandPath: ["release", "ci"],
    description: "CI: emit JSON plan + write to $GITHUB_OUTPUT for workflow gating",
    examples: [["vis release ci plan", "Emit { mode, packages, json } and set $GITHUB_OUTPUT"]],
    group: "Release",
    loader: () => import("./handler"),
    name: "plan",
    options: ciPlanOptionDefinitions,
});

export default ciPlan;

export type ReleaseCiPlanOptions = CreateOptions<{ "print-config": string | undefined }>;
