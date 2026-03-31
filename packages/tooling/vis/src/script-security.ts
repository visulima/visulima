/**
 * Build script enforcement for package managers that lack native allowlists.
 *
 * Support matrix:
 * - pnpm v10+: Native `allowBuilds` in pnpm-workspace.yaml (vis validates config)
 * - bun: Native `trustedDependencies` in package.json (vis validates config)
 * - npm: NO native allowlist. vis adds --ignore-scripts and runs approved scripts manually
 * - yarn: NO native allowlist. vis checks enableScripts in .yarnrc.yml
 *
 * References:
 * - https://pnpm.io/settings#allowbuilds
 * - https://bun.sh/docs/install/lifecycle
 * - https://www.coinspect.com/blog/supply-chain-guardrails/
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { execSync, spawnSync } from "node:child_process";
import { join } from "node:path";

import { info, note, success, warn, error as errorOutput } from "./output";
import type { VisConfig } from "./workspace";

type PackageManagerName = "bun" | "npm" | "pnpm" | "yarn";

/**
 * Detects the yarn version. Returns "1.x" for classic, "2.x"+ for berry.
 * Falls back to "1.0.0" if detection fails.
 */
const detectYarnVersion = (cwd: string): string => {
    // Check .yarnrc.yml - its presence indicates berry (v2+)
    if (existsSync(join(cwd, ".yarnrc.yml"))) {
        try {
            const result = spawnSync("yarn", ["--version"], { cwd, encoding: "utf8", timeout: 5000 });

            if (result.status === 0) {
                return result.stdout.trim();
            }
        } catch {
            // Assume berry since .yarnrc.yml exists
        }

        return "4.0.0"; // Default berry version
    }

    // No .yarnrc.yml = likely classic
    return "1.22.0";
};

interface EnforcementResult {
    /** Extra args to inject into the PM command (e.g., --ignore-scripts) */
    extraArgs: string[];
    /** Packages that need their scripts run after install */
    postInstallPackages: string[];
    /** Whether scripts are blocked by default for this PM */
    scriptsBlockedByDefault: boolean;
    /** Warnings to display */
    warnings: string[];
}

/**
 * Determines what enforcement actions are needed before running
 * an install/add command, based on the PM and vis security config.
 */
const enforceScriptSecurity = (
    pm: PackageManagerName,
    workspaceRoot: string,
    config: VisConfig,
): EnforcementResult => {
    const result: EnforcementResult = {
        extraArgs: [],
        postInstallPackages: [],
        scriptsBlockedByDefault: false,
        warnings: [],
    };

    const security = config.security;
    const allowBuilds = security?.allowBuilds ?? {};
    const hasAllowList = Object.keys(allowBuilds).length > 0;

    switch (pm) {
        case "pnpm": {
            // pnpm v10+ blocks scripts by default. Validate config exists.
            result.scriptsBlockedByDefault = true;

            if (!hasAllowList) {
                result.warnings.push(
                    "pnpm blocks build scripts by default. Run 'vis approve-builds' to review packages that need scripts.",
                );
            }

            // pnpm handles enforcement natively - no extra args needed
            break;
        }

        case "bun": {
            // Bun blocks scripts by default via trustedDependencies.
            result.scriptsBlockedByDefault = true;

            // Check if trustedDependencies exists in package.json
            const pkgPath = join(workspaceRoot, "package.json");

            if (existsSync(pkgPath)) {
                try {
                    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));

                    if (!pkg.trustedDependencies || pkg.trustedDependencies.length === 0) {
                        if (hasAllowList) {
                            result.warnings.push(
                                "vis security.allowBuilds is configured but package.json trustedDependencies is empty. " +
                                "Run 'vis approve-builds --sync-bun' to sync allowBuilds to trustedDependencies.",
                            );
                        }
                    }
                } catch {
                    // Invalid package.json
                }
            }

            break;
        }

        case "npm": {
            // npm does NOT block scripts by default. This is the biggest gap.
            result.scriptsBlockedByDefault = false;

            // Check if .npmrc has ignore-scripts
            const npmrcPath = join(workspaceRoot, ".npmrc");
            let hasIgnoreScripts = false;

            if (existsSync(npmrcPath)) {
                const content = readFileSync(npmrcPath, "utf8");

                hasIgnoreScripts = /^\s*ignore-scripts\s*=\s*true\s*$/m.test(content);
            }

            if (!hasIgnoreScripts && hasAllowList) {
                // vis has an allowlist but npm isn't blocking scripts
                result.warnings.push(
                    "npm does not block lifecycle scripts by default. " +
                    "Add 'ignore-scripts=true' to .npmrc for supply chain security.",
                );
                result.warnings.push(
                    "vis will add --ignore-scripts to install commands automatically.",
                );
                result.extraArgs.push("--ignore-scripts");

                // Collect packages that are allowed to run scripts
                for (const [pattern, allowed] of Object.entries(allowBuilds)) {
                    if (allowed) {
                        result.postInstallPackages.push(pattern);
                    }
                }
            } else if (!hasIgnoreScripts && !hasAllowList) {
                result.warnings.push(
                    "npm does not block lifecycle scripts by default. Any package can run arbitrary code on install. " +
                    "Add 'ignore-scripts=true' to .npmrc and configure security.allowBuilds in vis.config.ts.",
                );
            }

            break;
        }

        case "yarn": {
            result.scriptsBlockedByDefault = false;

            const yarnVersion = detectYarnVersion(workspaceRoot);
            const isBerry = !yarnVersion.startsWith("1.");

            if (isBerry) {
                // Yarn berry (v2+): supports enableScripts in .yarnrc.yml
                const yarnrcPath = join(workspaceRoot, ".yarnrc.yml");

                if (existsSync(yarnrcPath)) {
                    const content = readFileSync(yarnrcPath, "utf8");
                    const hasEnableScriptsFalse = /^\s*enableScripts\s*:\s*false\s*$/m.test(content);

                    if (hasEnableScriptsFalse) {
                        result.scriptsBlockedByDefault = true;
                    } else {
                        result.warnings.push(
                            `yarn berry (v${yarnVersion}) supports enableScripts. ` +
                            "Add 'enableScripts: false' to .yarnrc.yml for supply chain security.",
                        );

                        if (hasAllowList) {
                            result.warnings.push(
                                "vis has security.allowBuilds configured but yarn will still run all scripts. " +
                                "Set enableScripts: false in .yarnrc.yml first.",
                            );
                        }
                    }
                }
            } else {
                // Yarn classic (v1): no enableScripts, no native script blocking
                result.warnings.push(
                    "yarn classic (v1) does not support blocking lifecycle scripts natively. " +
                    "Consider upgrading to yarn berry (v4+) or using --ignore-scripts flag.",
                );

                // For yarn classic, inject --ignore-scripts like npm
                if (hasAllowList) {
                    result.extraArgs.push("--ignore-scripts");

                    for (const [pattern, allowed] of Object.entries(allowBuilds)) {
                        if (allowed) {
                            result.postInstallPackages.push(pattern);
                        }
                    }
                }
            }

            break;
        }
    }

    return result;
};

/**
 * Syncs vis security.allowBuilds to the native PM config format.
 *
 * - pnpm: writes to pnpm-workspace.yaml `allowBuilds` section
 * - bun: writes to package.json `trustedDependencies` array
 * - npm: writes `ignore-scripts=true` to .npmrc
 * - yarn: writes `enableScripts: false` to .yarnrc.yml
 */
const syncAllowBuildsToNativeConfig = (
    pm: PackageManagerName,
    workspaceRoot: string,
    allowBuilds: Record<string, boolean>,
): string[] => {
    const actions: string[] = [];
    const approved = Object.entries(allowBuilds)
        .filter(([, allowed]) => allowed)
        .map(([name]) => name);

    switch (pm) {
        case "bun": {
            const pkgPath = join(workspaceRoot, "package.json");

            if (existsSync(pkgPath)) {
                try {
                    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));

                    pkg.trustedDependencies = approved;
                    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
                    actions.push(`Updated package.json trustedDependencies with ${approved.length} packages`);
                } catch (error: unknown) {
                    actions.push(`Failed to update package.json: ${(error as Error).message}`);
                }
            }

            break;
        }

        case "npm": {
            const npmrcPath = join(workspaceRoot, ".npmrc");
            let content = "";

            if (existsSync(npmrcPath)) {
                content = readFileSync(npmrcPath, "utf8");
            }

            if (!/^\s*ignore-scripts\s*=\s*true\s*$/m.test(content)) {
                content = content.trimEnd() + "\nignore-scripts=true\n";
                writeFileSync(npmrcPath, content);
                actions.push("Added ignore-scripts=true to .npmrc");
            } else {
                actions.push(".npmrc already has ignore-scripts=true");
            }

            break;
        }

        case "yarn": {
            const yarnVersion = detectYarnVersion(workspaceRoot);
            const isBerry = !yarnVersion.startsWith("1.");

            if (isBerry) {
                // Yarn berry: supports enableScripts in .yarnrc.yml
                const yarnrcPath = join(workspaceRoot, ".yarnrc.yml");

                if (existsSync(yarnrcPath)) {
                    let content = readFileSync(yarnrcPath, "utf8");

                    if (!/^\s*enableScripts\s*:/m.test(content)) {
                        content = content.trimEnd() + "\nenableScripts: false\n";
                        writeFileSync(yarnrcPath, content);
                        actions.push("Added enableScripts: false to .yarnrc.yml");
                    } else {
                        actions.push(".yarnrc.yml already has enableScripts configured");
                    }
                } else {
                    writeFileSync(yarnrcPath, "enableScripts: false\n");
                    actions.push("Created .yarnrc.yml with enableScripts: false");
                }
            } else {
                // Yarn classic: no enableScripts support, fall back to .npmrc
                const npmrcPath = join(workspaceRoot, ".npmrc");
                let content = "";

                if (existsSync(npmrcPath)) {
                    content = readFileSync(npmrcPath, "utf8");
                }

                if (!/^\s*ignore-scripts\s*=\s*true\s*$/m.test(content)) {
                    content = content.trimEnd() + "\nignore-scripts=true\n";
                    writeFileSync(npmrcPath, content);
                    actions.push("Added ignore-scripts=true to .npmrc (yarn classic lacks enableScripts)");
                } else {
                    actions.push(".npmrc already has ignore-scripts=true");
                }
            }

            break;
        }

        case "pnpm": {
            // pnpm uses allowBuilds in pnpm-workspace.yaml - handled natively
            actions.push(`pnpm manages allowBuilds natively in pnpm-workspace.yaml (${approved.length} packages approved)`);
            break;
        }
    }

    return actions;
};

/**
 * Runs postinstall scripts for approved packages after an --ignore-scripts install.
 * Only needed for npm (and potentially yarn classic).
 */
const runApprovedScripts = (
    workspaceRoot: string,
    packages: string[],
): void => {
    if (packages.length === 0) {
        return;
    }

    for (const pkg of packages) {
        const pkgDir = join(workspaceRoot, "node_modules", pkg);
        const pkgJsonPath = join(pkgDir, "package.json");

        if (!existsSync(pkgJsonPath)) {
            continue;
        }

        try {
            const pkgJson = JSON.parse(readFileSync(pkgJsonPath, "utf8"));
            const scripts = pkgJson.scripts ?? {};

            for (const hook of ["preinstall", "install", "postinstall"] as const) {
                if (scripts[hook]) {
                    info(`Running ${hook} for ${pkg}...`);

                    try {
                        execSync(scripts[hook], {
                            cwd: pkgDir,
                            env: { ...process.env },
                            stdio: "inherit",
                        });
                    } catch {
                        errorOutput(`${hook} script failed for ${pkg}`);
                    }
                }
            }
        } catch {
            // Skip unreadable packages
        }
    }
};

export type { EnforcementResult, PackageManagerName };
export { enforceScriptSecurity, runApprovedScripts, syncAllowBuildsToNativeConfig };
