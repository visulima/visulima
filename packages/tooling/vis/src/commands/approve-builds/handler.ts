import { spawnSync } from "node:child_process";

import type { CommandExecute, Toolbox } from "@visulima/cerebro";

import { pail } from "../../io/logger";
import { detectPm } from "../../pm/pm-runner";
import { scanUnapprovedBuildScripts, syncAllowBuildsToNativeConfig } from "../../security/security";
import type { ApproveBuildsOptions } from "./index";

const execute = async ({ options, visConfig, workspaceRoot: wsRoot }: Toolbox<Console, ApproveBuildsOptions>): Promise<void> => {
    const cwd = wsRoot ?? process.cwd();
    const pm = detectPm(cwd);

    // For pnpm, delegate to pnpm approve-builds (unless --scan forces vis scanning)
    if (pm.name === "pnpm" && !options.scan) {
        pail.info("Delegating to pnpm approve-builds...");

        const pnpmArgs = ["approve-builds"];

        if (options.all) {
            pnpmArgs.push("--all");
        }

        const result = spawnSync("pnpm", pnpmArgs, { cwd, stdio: "inherit" });

        if (result.error) {
            throw new Error(`Failed to run pnpm approve-builds: ${result.error.message}`);
        }

        if (result.status !== 0 && result.status !== null) {
            pail.error(`pnpm approve-builds exited with code ${result.status}`);
            process.exitCode = result.status;
        }

        // pnpm writes directly to pnpm-workspace.yaml (`allowBuilds:` map on v11,
        // `onlyBuiltDependencies:` list on v10). If the user isn't about to run
        // --sync-native below, remind them that vis.config.ts may now be stale
        // relative to the native config.
        if (!options.syncNative) {
            pail.notice("");
            pail.notice("Tip: vis.config.ts security.allowBuilds may now be out of sync with pnpm-workspace.yaml.");
            pail.notice("Run 'vis check --security-config' to compare, or copy the new entries into vis.config.ts.");

            return;
        }
    } else {
        // For other PMs (or --scan flag), do our own scanning
        const allowBuilds = visConfig?.security?.allowBuilds ?? {};
        const unapproved = scanUnapprovedBuildScripts(cwd, allowBuilds);

        if (unapproved.length === 0) {
            pail.success("No unapproved build scripts found.");
        } else {
            pail.warn(`Found ${unapproved.length} package${unapproved.length === 1 ? "" : "s"} with unapproved build scripts:\n`);

            for (const pkg of unapproved) {
                pail.info(`  ${pkg}`);
            }

            pail.notice("");
            pail.notice("To approve these packages, add them to vis.config.ts:");
            pail.notice("");
            pail.notice("  security: {");
            pail.notice("    allowBuilds: {");

            for (const pkg of unapproved) {
                const name = pkg.split(" (")[0];

                pail.notice(`      "${name}": true,`);
            }

            pail.notice("    },");
            pail.notice("  },");

            if (pm.name === "pnpm") {
                pail.notice("");
                pail.notice("Or run 'pnpm approve-builds' to update pnpm-workspace.yaml directly.");
            }
        }
    }

    // Sync to native PM config if requested
    if (options.syncNative) {
        const allowBuilds = visConfig?.security?.allowBuilds ?? {};

        if (Object.keys(allowBuilds).length === 0) {
            pail.warn("No security.allowBuilds configured in vis.config.ts. Nothing to sync.");
        } else {
            const actions = syncAllowBuildsToNativeConfig(pm.name, cwd, allowBuilds);

            pail.info("");

            for (const action of actions) {
                pail.success(action);
            }
        }
    }
};

export default execute as CommandExecute<Toolbox>;
