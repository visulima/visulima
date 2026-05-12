import type { Plugin } from "@visulima/cerebro";
import { isAccessibleSync, readJsonSync } from "@visulima/fs";
import { join } from "@visulima/path";

import { pail } from "../io/logger";
import { detectPm } from "../pm/pm-runner";
import { checkPmNativeConfigDrift, emitSecurityWarnings, enforceScriptSecurity, formatDriftReport, runApprovedScripts } from "../security/security";
import { buildSocketOptions, fetchSocketReports, formatSecurityOverview } from "../security/socket-security";

const INSTALL_COMMANDS = new Set(["add", "install", "update"]);
const PM_COMMANDS = new Set(["add", "dedupe", "install", "remove", "update"]);

const VERSION_REGEX = /(\d+\.\d+\.\d+)/;

/**
 * Resolves installed packages from the workspace root.
 * Reads the top-level package.json and resolves actual versions from node_modules.
 */
const resolveInstalledPackages = (workspaceRoot: string): { name: string; version: string }[] => {
    const pkgJsonPath = join(workspaceRoot, "package.json");

    if (!isAccessibleSync(pkgJsonPath)) {
        return [];
    }

    const packages: { name: string; version: string }[] = [];

    try {
        const pkg = readJsonSync(pkgJsonPath) as {
            dependencies?: Record<string, string>;
            devDependencies?: Record<string, string>;
        };

        const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

        for (const [name, range] of Object.entries(allDeps)) {
            // Try to resolve actual installed version from node_modules
            const installedPkgPath = join(workspaceRoot, "node_modules", name, "package.json");

            if (isAccessibleSync(installedPkgPath)) {
                try {
                    const installedPkg = readJsonSync(installedPkgPath) as { version?: string };

                    if (installedPkg.version) {
                        packages.push({ name, version: installedPkg.version });
                        continue;
                    }
                } catch {
                    // Fall through to range parsing
                }
            }

            // Fall back to parsing version from range
            const versionMatch = VERSION_REGEX.exec(range);

            if (versionMatch?.[1]) {
                packages.push({ name, version: versionMatch[1] });
            }
        }
    } catch {
        // Non-critical
    }

    return packages;
};

const securityEnforcementPlugin: Plugin = {
    afterCommand: async (toolbox) => {
        if (process.exitCode && process.exitCode !== 0) {
            return;
        }

        const enforcement = (toolbox as unknown as Record<string, unknown>).scriptEnforcement as ReturnType<typeof enforceScriptSecurity> | undefined;

        if (enforcement?.postInstallPackages.length && toolbox.workspaceRoot) {
            runApprovedScripts(toolbox.workspaceRoot, enforcement.postInstallPackages);
        }

        const command = process.argv[2] ?? "";

        // Native-config drift check — runs after install/update/add to nudge
        // users when vis.config security settings have diverged from what
        // is actually in the PM's native config files.
        // `detectPm` is cached at the top because both this block and the
        // socket overview below would otherwise re-detect on every hook.
        const pm = INSTALL_COMMANDS.has(command) && toolbox.workspaceRoot ? detectPm(toolbox.workspaceRoot) : undefined;

        if (pm && toolbox.visConfig && toolbox.workspaceRoot) {
            const supported = new Set<string>(["bun", "npm", "pnpm", "yarn"]);

            if (supported.has(pm.name)) {
                const report = checkPmNativeConfigDrift(toolbox.visConfig, pm.name, toolbox.workspaceRoot);

                if (report.hasDrift) {
                    pail.info("");

                    for (const line of formatDriftReport(report)) {
                        pail.warn(line);
                    }
                }
            }
        }

        // Display Socket.dev security summary after install/update commands
        const socketOptions = buildSocketOptions(toolbox.visConfig?.security?.socket);

        if (INSTALL_COMMANDS.has(command) && socketOptions && toolbox.workspaceRoot) {
            try {
                const packages = resolveInstalledPackages(toolbox.workspaceRoot);

                if (packages.length > 0) {
                    const reports = await fetchSocketReports(packages, socketOptions);

                    if (reports.size > 0) {
                        const overview = formatSecurityOverview(reports);

                        if (overview) {
                            pail.info("");
                            pail.info(overview);

                            // Warn about critical/high alerts
                            let criticalHighCount = 0;

                            for (const report of reports.values()) {
                                for (const alert of report.alerts) {
                                    if (alert.severity === "critical" || alert.severity === "high") {
                                        criticalHighCount++;
                                    }
                                }
                            }

                            if (criticalHighCount > 0) {
                                pail.warn(
                                    `${String(criticalHighCount)} critical/high severity alert${criticalHighCount === 1 ? "" : "s"} detected. `
                                    + "Run 'vis check --security' for details.",
                                );
                            }
                        }
                    }
                }
            } catch {
                // Graceful degradation: don't fail the install if Socket.dev is unreachable
            }
        }
    },
    beforeCommand: async (toolbox) => {
        const command = process.argv[2] ?? "";

        if (PM_COMMANDS.has(command) && toolbox.visConfig && toolbox.workspaceRoot) {
            const pm = detectPm(toolbox.workspaceRoot);
            const willEnforce = INSTALL_COMMANDS.has(command);

            emitSecurityWarnings(toolbox.visConfig, pm.name, willEnforce);

            if (willEnforce) {
                const enforcement = enforceScriptSecurity(pm.name, toolbox.workspaceRoot, toolbox.visConfig);

                for (const w of enforcement.warnings) {
                    toolbox.logger.warn(`security: ${w}`);
                }

                (toolbox as unknown as Record<string, unknown>).scriptEnforcement = enforcement;
            }
        }
    },
    name: "security-enforcement",
};

export default securityEnforcementPlugin;
