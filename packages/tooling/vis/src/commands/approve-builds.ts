import { spawnSync } from "node:child_process";

import type { Command } from "@visulima/cerebro";

import { error as errorOutput, info, note, success, warn } from "../output";
import { detectPm } from "../pm-runner";
import { scanUnapprovedBuildScripts, syncAllowBuildsToNativeConfig } from "../security";

const approveBuilds: Command = {
    group: "Security & Health",
    description: "Review and approve dependencies with build scripts",
    examples: [
        ["vis approve-builds", "Scan and list unapproved build scripts"],
        ["vis approve-builds --all", "Approve all pending builds (pnpm)"],
        ["vis approve-builds --sync-native", "Sync allowBuilds to native PM config"],
    ],
    execute: async ({ options, visConfig, workspaceRoot: wsRoot }) => {
        const cwd = wsRoot ?? process.cwd();
        const pm = detectPm(cwd);

        // For pnpm, delegate to pnpm approve-builds (unless --scan forces vis scanning)
        if (pm.name === "pnpm" && !options.scan) {
            info("Delegating to pnpm approve-builds...");

            const pnpmArgs = ["approve-builds"];

            if (options.all) {
                pnpmArgs.push("--all");
            }

            const result = spawnSync("pnpm", pnpmArgs, { cwd, stdio: "inherit" });

            if (result.error) {
                throw new Error(`Failed to run pnpm approve-builds: ${result.error.message}`);
            }

            if (result.status !== 0 && result.status !== null) {
                errorOutput(`pnpm approve-builds exited with code ${result.status}`);
                process.exitCode = result.status;
            }

            // Fall through to sync-native if requested (don't return early)
            if (!options["sync-native"]) {
                return;
            }
        } else {
            // For other PMs (or --scan flag), do our own scanning
            const allowBuilds = visConfig?.security?.allowBuilds ?? {};
            const unapproved = scanUnapprovedBuildScripts(cwd, allowBuilds);

            if (unapproved.length === 0) {
                success("No unapproved build scripts found.");
            } else {
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
            }
        }

        // Sync to native PM config if requested
        if (options["sync-native"]) {
            const allowBuilds = visConfig?.security?.allowBuilds ?? {};

            if (Object.keys(allowBuilds).length === 0) {
                warn("No security.allowBuilds configured in vis.config.ts. Nothing to sync.");
            } else {
                const actions = syncAllowBuildsToNativeConfig(pm.name, cwd, allowBuilds);

                info("");

                for (const action of actions) {
                    success(action);
                }
            }
        }
    },
    name: "approve-builds",
    options: [
        { defaultValue: false, description: "Approve all pending builds without prompting (pnpm only)", name: "all", type: Boolean },
        { defaultValue: false, description: "Force vis scanning even for pnpm (instead of delegating)", name: "scan", type: Boolean },
        {
            defaultValue: false,
            description: "Sync allowBuilds to native PM config (bun: trustedDependencies, npm: .npmrc, yarn: .yarnrc.yml)",
            name: "sync-native",
            type: Boolean,
        },
    ],
};

export default approveBuilds;
