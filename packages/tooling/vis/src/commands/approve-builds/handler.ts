import { spawnSync } from "node:child_process";

import type { CommandExecute, Toolbox } from "@visulima/cerebro";

import { writeApprovedBuildsToVisConfig } from "../../config/config-writer";
import { pail } from "../../io/logger";
import { detectPm } from "../../pm/pm-runner";
import { scanBuildScriptStatus, syncAllowBuildsToNativeConfig } from "../../security/security";
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
            pail.notice("Tip: vis.config.ts security.policies.install_scripts.allow may now be out of sync with pnpm-workspace.yaml.");
            pail.notice("Run 'vis check --security-config' to compare, or copy the new entries into vis.config.ts.");

            return;
        }
    } else {
        // For other PMs (or --scan flag), do our own scanning
        const allowBuilds = visConfig?.security?.policies?.install_scripts?.allow ?? {};
        const pinVersions = visConfig?.security?.pinVersions === true;
        const status = scanBuildScriptStatus(cwd, allowBuilds, { pinVersions });

        if (status.unapproved.length === 0) {
            pail.success("No unapproved build scripts found.");

            if (options.write) {
                pail.info("");
                pail.info("Nothing to write — there are no unapproved build scripts.");
            }
        } else {
            pail.warn(`Found ${status.unapproved.length} package${status.unapproved.length === 1 ? "" : "s"} with unapproved build scripts:\n`);

            for (const entry of status.unapproved) {
                pail.info(`  ${entry.name} (${entry.hooks.join(", ")})`);
            }

            pail.notice("");
            pail.notice("To approve these packages, add them to vis.config.ts:");
            pail.notice("");
            pail.notice("  security: {");
            pail.notice("    policies: {");
            pail.notice("      install_scripts: {");
            pail.notice("        allow: {");

            for (const entry of status.unapproved) {
                const key = pinVersions && entry.version ? `${entry.name}@${entry.version}` : entry.name;

                pail.notice(`          "${key}": true,`);
            }

            pail.notice("        },");
            pail.notice("      },");
            pail.notice("    },");
            pail.notice("  },");

            if (pm.name === "pnpm") {
                pail.notice("");
                pail.notice("Or run 'pnpm approve-builds' to update pnpm-workspace.yaml directly.");
            }

            // LavaMoat-style 'auto' writer: mutate vis.config.ts in place.
            if (options.write) {
                const pinVersionsActive = visConfig?.security?.pinVersions === true;
                const entries = status.unapproved.map((entry) => (pinVersionsActive && entry.version ? `${entry.name}@${entry.version}` : entry.name));
                const result = writeApprovedBuildsToVisConfig(cwd, entries);

                pail.info("");

                switch (result.status) {
                    case "missing-anchor": {
                        pail.warn(`Could not locate 'defineConfig({' or 'export default {' in ${String(result.configPath)} — please add entries manually.`);
                        break;
                    }
                    case "no-config": {
                        pail.warn("No vis.config.ts found. Run 'vis init' first, then re-run with --write.");
                        break;
                    }
                    case "noop": {
                        pail.info(
                            `All ${String(entries.length)} entr${entries.length === 1 ? "y" : "ies"} were already present in vis.config.ts security.policies.install_scripts.allow.`,
                        );
                        break;
                    }
                    default: {
                        pail.success(`Wrote ${String(result.added.length)} entr${result.added.length === 1 ? "y" : "ies"} to ${String(result.configPath)}.`);

                        if (result.skipped.length > 0) {
                            pail.info(`Skipped ${String(result.skipped.length)} already-present entr${result.skipped.length === 1 ? "y" : "ies"}.`);
                        }
                    }
                }
            }
        }

        // Excess / stale allowlist entries — port of LavaMoat's
        // missingPolicies+excessPolicies idea. Helps users prune entries
        // for packages that have since been removed.
        if (status.excess.length > 0) {
            pail.notice("");
            pail.warn(
                `Stale install_scripts.allow entries — ${String(status.excess.length)} pattern${status.excess.length === 1 ? "" : "s"} no longer match any installed package:`,
            );

            for (const pattern of status.excess) {
                pail.info(`  ${pattern}`);
            }

            pail.notice("Consider removing these entries from vis.config.ts security.policies.install_scripts.allow.");
        }

        if (status.versionDrift.length > 0) {
            pail.notice("");
            pail.warn(
                `Version drift — ${String(status.versionDrift.length)} entr${status.versionDrift.length === 1 ? "y" : "ies"} pinned to an outdated version:`,
            );

            for (const { from, to } of status.versionDrift) {
                pail.info(`  ${from}  →  ${to}`);
            }

            pail.notice("Rename the keys in vis.config.ts security.policies.install_scripts.allow to migrate.");
        }
    }

    // Sync to native PM config if requested
    if (options.syncNative) {
        const allowBuilds = visConfig?.security?.policies?.install_scripts?.allow ?? {};

        if (Object.keys(allowBuilds).length === 0) {
            pail.warn("No security.policies.install_scripts.allow configured in vis.config.ts. Nothing to sync.");
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
