import { execSync } from "node:child_process";

import type { Command } from "@visulima/cerebro";

import { detectPm } from "../pm-runner";
import { info, note, success, warn } from "../output";
import { scanUnapprovedBuildScripts } from "../security";
import { syncAllowBuildsToNativeConfig } from "../script-security";

const approveBuilds: Command = {
    description: "Review and approve dependencies with build scripts",
    examples: [
        ["vis approve-builds", "Scan and list unapproved build scripts"],
        ["vis approve-builds --all", "Approve all pending builds"],
    ],
    execute: async ({ options, visConfig, workspaceRoot: wsRoot }) => {
        const cwd = wsRoot ?? process.cwd();
        const pm = detectPm(cwd);

        // For pnpm, delegate to pnpm approve-builds
        if (pm.name === "pnpm" && !options.scan) {
            info("Delegating to pnpm approve-builds...");

            try {
                const args = options.all ? "--all" : "";

                execSync(`pnpm approve-builds ${args}`.trim(), {
                    cwd,
                    stdio: "inherit",
                });
            } catch {
                // pnpm approve-builds exits non-zero when there are unapproved builds
            }

            return;
        }

        // For other PMs (or --scan flag), do our own scanning
        const allowBuilds = visConfig?.security?.allowBuilds ?? {};
        const unapproved = scanUnapprovedBuildScripts(cwd, allowBuilds);

        if (unapproved.length === 0) {
            success("No unapproved build scripts found.");

            return;
        }

        warn(`Found ${unapproved.length} package${unapproved.length === 1 ? "" : "s"} with unapproved build scripts:\n`);

        for (const pkg of unapproved) {
            info(`  ${pkg}`);
        }

        note("");
        note("To approve these packages, add them to vis.config.ts:");
        note("");
        note("  security: {");
        note("    allowBuilds: {");

        for (const pkg of unapproved) {
            const name = pkg.split(" (")[0];

            note(`      "${name}": true,`);
        }

        note("    },");
        note("  },");

        if (pm.name === "pnpm") {
            note("");
            note("Or run 'pnpm approve-builds' to update pnpm-workspace.yaml directly.");
        }

        // Sync to native PM config if requested
        if (options["sync-native"]) {
            const allowBuilds = visConfig?.security?.allowBuilds ?? {};

            if (Object.keys(allowBuilds).length === 0) {
                warn("No security.allowBuilds configured in vis.config.ts. Nothing to sync.");
            } else {
                const actions = syncAllowBuildsToNativeConfig(
                    pm.name as "bun" | "npm" | "pnpm" | "yarn",
                    cwd,
                    allowBuilds,
                );

                info("");

                for (const action of actions) {
                    success(action);
                }
            }
        }
    },
    name: "approve-builds",
    options: [
        { defaultValue: false, description: "Approve all pending builds without prompting", name: "all", type: Boolean },
        { defaultValue: false, description: "Force vis scanning even for pnpm (instead of delegating)", name: "scan", type: Boolean },
        { defaultValue: false, description: "Sync allowBuilds to native PM config (bun: trustedDependencies, npm: .npmrc, yarn: .yarnrc.yml)", name: "sync-native", type: Boolean },
    ],
};

export default approveBuilds;
