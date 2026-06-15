import type { Command, CreateOptions } from "@visulima/cerebro";

const ciPlan: Command = {
    commandPath: ["release", "ci"],
    description: "CI: emit JSON plan + write to $GITHUB_OUTPUT for workflow gating",
    examples: [["vis release ci plan", "Emit { mode, packages, json } and set $GITHUB_OUTPUT"]],
    group: "Release",
    loader: () => import("./handler"),
    name: "plan",
    options: [
        {
            description: "Print the resolved release config and exit (--print-config=debug for runtime-resolved fields)",
            name: "print-config",
            type: String,
        },
    ],
};

export default ciPlan;

export type ReleaseCiPlanOptions = CreateOptions<{ "print-config": string | undefined }>;
