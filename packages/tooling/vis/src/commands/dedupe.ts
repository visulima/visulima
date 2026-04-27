import type { Command } from "@visulima/cerebro";

import { resolveInstaller, runDedupe } from "../pm-runner";

const dedupe: Command = {
    description: "Deduplicate dependencies using the detected package manager",
    examples: [
        ["vis dedupe", "Run deduplication"],
        ["vis dedupe --check", "Preview changes without modifying (CI-friendly)"],
    ],
    execute: async ({ logger, options, visConfig, workspaceRoot: wsRoot }) => {
        const cwd = wsRoot ?? process.cwd();
        const pm = resolveInstaller(cwd, { configBackend: visConfig?.install?.backend });

        const code = runDedupe(pm, (options.check as boolean) || false, cwd, logger);

        if (code !== 0) {
            process.exitCode = code;
        }
    },
    group: "Dependencies",
    name: "dedupe",
    options: [{ defaultValue: false, description: "Preview changes without modifying files (dry-run)", name: "check", type: Boolean }],
};

export default dedupe;
