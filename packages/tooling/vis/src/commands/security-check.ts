import type { Command } from "@visulima/cerebro";

import { detectPm } from "../pm-runner";
import { printSecurityReport, syncToPnpmConfig } from "../security";
import { info, success } from "../output";

const securityCheck: Command = {
    description: "Audit supply chain security settings and show recommendations",
    examples: [
        ["vis security-check", "Show security audit report"],
        ["vis security-check --sync", "Sync vis security config to pnpm-workspace.yaml (pnpm only)"],
    ],
    execute: async ({ options, visConfig, workspaceRoot: wsRoot }) => {
        const cwd = wsRoot ?? process.cwd();
        const pm = detectPm(cwd);

        printSecurityReport(visConfig ?? {}, pm.name);

        if (options.sync && pm.name === "pnpm") {
            const synced = syncToPnpmConfig(cwd, visConfig ?? {});

            if (synced.length > 0) {
                info("\nSettings that would sync to pnpm-workspace.yaml:");

                for (const s of synced) {
                    success(`  ${s}`);
                }
            } else {
                info("No security settings to sync.");
            }
        } else if (options.sync && pm.name !== "pnpm") {
            info(`--sync is only available for pnpm projects. Your project uses ${pm.name}.`);
            info("vis enforces security settings at the vis layer for non-pnpm projects.");
        }
    },
    name: "security-check",
    options: [
        { defaultValue: false, description: "Sync security settings to pnpm-workspace.yaml (pnpm only)", name: "sync", type: Boolean },
    ],
};

export default securityCheck;
