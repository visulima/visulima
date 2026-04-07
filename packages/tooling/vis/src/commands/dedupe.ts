import type { Command } from "@visulima/cerebro";

import { detectPm, runDedupe } from "../pm-runner";

const dedupe: Command = {
    group: "Dependencies",
    description: "Deduplicate dependencies using the detected package manager",
    examples: [
        ["vis dedupe", "Run deduplication"],
        ["vis dedupe --check", "Preview changes without modifying (CI-friendly)"],
    ],
    execute: async ({ logger, options, workspaceRoot: wsRoot }) => {
        const cwd = wsRoot ?? process.cwd();
        const pm = detectPm(cwd);

        const code = runDedupe(pm, (options.check as boolean) || false, cwd, logger);

        if (code !== 0) {
            process.exitCode = code;
        }
    },
    name: "dedupe",
    options: [{ defaultValue: false, description: "Preview changes without modifying files (dry-run)", name: "check", type: Boolean }],
};

export default dedupe;
