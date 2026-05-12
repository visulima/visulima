import type { CommandExecute, Toolbox } from "@visulima/cerebro";

import { pail } from "../../io/logger";
import { detectPm } from "../../pm/pm-runner";
import { checkPmNativeConfigDrift, collectBinShadows, formatDriftReport, scanBuildScriptStatus } from "../../security/security";
import type { SecurityListOptions } from "./index";

const SUPPORTED_PMS = new Set<string>(["bun", "npm", "pnpm", "yarn"]);

const execute = ({ options, visConfig, workspaceRoot: wsRoot }: Toolbox<Console, SecurityListOptions>): void => {
    const cwd = wsRoot ?? process.cwd();
    const pm = detectPm(cwd);
    const allowBuilds = visConfig?.security?.policies?.install_scripts?.allow ?? {};
    const allowBins = visConfig?.security?.allowBins ?? {};
    const pinVersions = visConfig?.security?.pinVersions === true;
    const status = scanBuildScriptStatus(cwd, allowBuilds, { pinVersions });
    const binConflicts = collectBinShadows(cwd, allowBins);
    const drift = visConfig && SUPPORTED_PMS.has(pm.name) ? checkPmNativeConfigDrift(visConfig, pm.name, cwd) : undefined;

    if (options.json) {
        process.stdout.write(
            `${JSON.stringify(
                {
                    binConflicts,
                    drift,
                    excess: status.excess,
                    installed: status.installed.map((p) => {
                        return { hooks: p.hooks, name: p.name, version: p.version };
                    }),
                    packageManager: pm.name,
                    pinVersions,
                    unapproved: status.unapproved.map((p) => {
                        return { hooks: p.hooks, name: p.name, version: p.version };
                    }),
                    versionDrift: status.versionDrift,
                },
                undefined,
                2,
            )}\n`,
        );

        return;
    }

    pail.info(`Build-script status (${pm.name}):\n`);

    if (status.installed.length === 0 && status.unapproved.length === 0) {
        pail.success("  No installed packages declare lifecycle scripts.");
    }

    if (status.installed.length > 0) {
        pail.success(`  Approved (${String(status.installed.length)}):`);

        for (const entry of status.installed) {
            pail.info(`    ✓ ${entry.name} — ${entry.hooks.join(", ")}`);
        }
    }

    if (status.unapproved.length > 0) {
        pail.info("");
        pail.warn(`  Unapproved (${String(status.unapproved.length)}):`);

        for (const entry of status.unapproved) {
            pail.info(`    ✗ ${entry.name} — ${entry.hooks.join(", ")}`);
        }

        pail.notice("    Run 'vis approve-builds' to review.");
    }

    if (status.excess.length > 0) {
        pail.info("");
        pail.warn(`  Stale allowlist entries (${String(status.excess.length)}):`);

        for (const pattern of status.excess) {
            pail.info(`    ! ${pattern}`);
        }

        pail.notice("    Remove these from vis.config.ts security.policies.install_scripts.allow.");
    }

    if (status.versionDrift.length > 0) {
        pail.info("");
        pail.warn(
            `  Version drift (pinVersions: true) — ${String(status.versionDrift.length)} entr${status.versionDrift.length === 1 ? "y" : "ies"} point at outdated versions:`,
        );

        for (const { from, to } of status.versionDrift) {
            pail.info(`    ${from}  →  ${to}`);
        }

        pail.notice("    Update vis.config.ts security.policies.install_scripts.allow keys to migrate.");
    }

    if (binConflicts.length > 0) {
        pail.info("");
        pail.warn(`  Bin conflicts (${String(binConflicts.length)}) — multiple packages expose the same bin name:`);

        for (const conflict of binConflicts) {
            pail.info(`    ${conflict.bin} ← ${conflict.packages.map((p) => p.name).join(", ")}`);
        }

        pail.notice("    Add the bin (or 'pkg#bin') to vis.config.ts security.allowBins to silence this.");
    }

    if (drift?.hasDrift) {
        pail.info("");

        for (const line of formatDriftReport(drift)) {
            pail.warn(line);
        }
    }
};

export default execute as CommandExecute<Toolbox>;
