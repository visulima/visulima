import type { Command } from "@visulima/cerebro";

import { loadNativeBindings } from "../native-binding";
import { detectPm, runInteractive } from "../pm-runner";

const dedupe: Command = {
    description: "Deduplicate dependencies using the detected package manager",
    examples: [
        ["vis dedupe", "Run deduplication"],
        ["vis dedupe --check", "Preview changes without modifying (CI-friendly)"],
    ],
    execute: async ({ logger, options, workspaceRoot: wsRoot }) => {
        const cwd = (options.cwd as string) ?? wsRoot ?? process.cwd();
        const pm = detectPm(cwd);
        const native = loadNativeBindings();

        if (!native) {
            throw new Error("Native bindings not available.");
        }

        const resolved = native.resolveDedupe(pm.name, pm.version, (options.check as boolean) || false);

        const code = runInteractive(resolved, cwd, logger);

        if (code !== 0) {
            process.exitCode = code;
        }
    },
    name: "dedupe",
    options: [
        { defaultValue: false, description: "Preview changes without modifying files (dry-run)", name: "check", type: Boolean },
    ],
};

export default dedupe;
