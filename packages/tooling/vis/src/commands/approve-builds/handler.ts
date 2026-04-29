import { spawnSync } from "node:child_process";

import type { CommandExecute, Toolbox } from "@visulima/cerebro";

import { error as errorOutput, info, note, success, warn } from "../../output";
import { detectPm } from "../../pm-runner";
import { scanUnapprovedBuildScripts, syncAllowBuildsToNativeConfig } from "../../security";
import type { ApproveBuildsOptions } from "./index";

const execute = async ({ options, visConfig, workspaceRoot: wsRoot }: Toolbox<Console, ApproveBuildsOptions>): Promise<void> => {
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

        // pnpm writes directly to pnpm-workspace.yaml (`allowBuilds:` map on v11,
        // `onlyBuiltDependencies:` list on v10). If the user isn't about to run
        // --sync-native below, remind them that vis.config.ts may now be stale
        // relative to the native config.
        if (!options.syncNative) {
            note("");
            note("Tip: vis.config.ts security.allowBuilds may now be out of sync with pnpm-workspace.yaml.");
            note("Run 'vis check --security-config' to compare, or copy the new entries into vis.config.ts.");

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
    if (options.syncNative) {
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
};

export default execute as CommandExecute<Toolbox>;
