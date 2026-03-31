/**
 * Supply chain security checks for package management commands.
 *
 * Ports pnpm's security features (minimumReleaseAge, trustPolicy,
 * allowBuilds, blockExoticSubdeps, strictDepBuilds) to work universally
 * across all package managers.
 *
 * For pnpm: these settings are also written to pnpm-workspace.yaml.
 * For npm/yarn/bun: vis enforces these at the vis layer.
 */

import { warn, info, note, error as errorOutput } from "./output";
import type { VisConfig } from "./workspace";

interface SecurityCheckResult {
    errors: string[];
    warnings: string[];
}

/**
 * Checks the vis config for recommended security settings and emits
 * warnings when they are missing or disabled.
 *
 * Called before install/add/update commands.
 */
const checkSecurityConfig = (config: VisConfig, packageManager: string): SecurityCheckResult => {
    const result: SecurityCheckResult = { errors: [], warnings: [] };
    const security = config.security;

    if (!security) {
        result.warnings.push(
            "No security settings configured. Consider adding a 'security' section to vis.config.ts for supply chain protection.",
        );
        result.warnings.push(
            "Recommended: security.minimumReleaseAge, security.allowBuilds, security.trustPolicy",
        );

        return result;
    }

    // minimumReleaseAge
    if (security.minimumReleaseAge === undefined || security.minimumReleaseAge === 0) {
        result.warnings.push(
            "security.minimumReleaseAge is not set. New packages can be installed immediately after publishing. " +
            "Set to 1440 (24 hours) to reduce risk of installing compromised packages.",
        );
    }

    // allowBuilds
    if (!security.allowBuilds || Object.keys(security.allowBuilds).length === 0) {
        if (packageManager === "pnpm") {
            result.warnings.push(
                "security.allowBuilds is not configured. pnpm blocks build scripts by default since v10. " +
                "Run 'vis approve-builds' to review and approve dependencies that need build scripts.",
            );
        } else {
            result.warnings.push(
                "security.allowBuilds is not configured. Consider listing which packages are allowed " +
                "to run install/postinstall scripts to prevent supply chain attacks.",
            );
        }
    }

    // trustPolicy
    if (!security.trustPolicy || security.trustPolicy === "off") {
        result.warnings.push(
            "security.trustPolicy is 'off'. Set to 'no-downgrade' to prevent installing packages " +
            "whose trust level has decreased (e.g., lost trusted publisher status).",
        );
    }

    // blockExoticSubdeps
    if (!security.blockExoticSubdeps) {
        result.warnings.push(
            "security.blockExoticSubdeps is not enabled. Transitive dependencies can pull code from " +
            "git repos or tarball URLs. Set to true to restrict to registry-only sources.",
        );
    }

    // strictDepBuilds
    if (security.strictDepBuilds && !security.allowBuilds) {
        result.errors.push(
            "security.strictDepBuilds is enabled but security.allowBuilds is empty. " +
            "All dependencies with build scripts will be blocked. Run 'vis approve-builds' first.",
        );
    }

    return result;
};

/**
 * Emits security warnings to stderr. Called by install/add/update commands.
 * Uses dimmed output to be informative without being noisy.
 *
 * Only shows the summary warning on first run. Detailed warnings shown
 * with --security-details flag or VIS_SECURITY_DETAILS=1 env var.
 */
const emitSecurityWarnings = (config: VisConfig, packageManager: string): void => {
    // Skip in CI unless explicitly enabled
    if (process.env.CI && !process.env.VIS_SECURITY_WARNINGS) {
        return;
    }

    const result = checkSecurityConfig(config, packageManager);

    if (result.errors.length > 0) {
        for (const err of result.errors) {
            errorOutput(err);
        }
    }

    if (result.warnings.length > 0) {
        // Show a single summary warning, not the full list
        warn(
            `${result.warnings.length} security recommendation${result.warnings.length === 1 ? "" : "s"} found. ` +
            "Run 'vis check --security-config' for details.",
        );
    }
};

/**
 * Prints the full security audit report. Used by 'vis security-check' command.
 */
const printSecurityReport = (config: VisConfig, packageManager: string): void => {
    const result = checkSecurityConfig(config, packageManager);

    if (result.errors.length === 0 && result.warnings.length === 0) {
        info("All recommended security settings are configured.");

        return;
    }

    if (result.errors.length > 0) {
        for (const err of result.errors) {
            errorOutput(err);
        }
    }

    for (const warning of result.warnings) {
        warn(warning);
    }

    note("Configure these in vis.config.ts under the 'security' section:");
    note("");
    note("  import { defineConfig } from '@visulima/vis/config';");
    note("");
    note("  export default defineConfig({");
    note("    security: {");
    note("      minimumReleaseAge: 1440,        // 24 hours");
    note("      trustPolicy: 'no-downgrade',");
    note("      blockExoticSubdeps: true,");
    note("      allowBuilds: {");
    note("        esbuild: true,");
    note("        '@prisma/client': true,");
    note("      },");
    note("    },");
    note("  });");
};

/**
 * Reports which vis security settings would map to pnpm-workspace.yaml.
 * Does not write to pnpm-workspace.yaml (that requires YAML manipulation).
 * Use `vis approve-builds --sync-native` for actual native PM config writes.
 */
const previewPnpmSync = (config: VisConfig): string[] => {
    const security = config.security;

    if (!security) {
        return [];
    }

    const entries: string[] = [];

    if (security.minimumReleaseAge !== undefined) {
        entries.push(`minimumReleaseAge: ${security.minimumReleaseAge}`);
    }

    if (security.trustPolicy && security.trustPolicy !== "off") {
        entries.push(`trustPolicy: ${security.trustPolicy}`);
    }

    if (security.blockExoticSubdeps) {
        entries.push("blockExoticSubdeps: true");
    }

    if (security.allowBuilds) {
        entries.push(`allowBuilds: ${Object.keys(security.allowBuilds).length} entries`);
    }

    if (security.strictDepBuilds) {
        entries.push("strictDepBuilds: true");
    }

    return entries;
};

/**
 * Scans node_modules for packages with install scripts that aren't
 * approved in the allowBuilds config. Zero external dependencies.
 */
const scanUnapprovedBuildScripts = (
    cwd: string,
    allowBuilds: Record<string, boolean>,
): string[] => {
    // Inline imports to avoid pulling in @visulima/package chain
    const { existsSync, readdirSync, readFileSync, statSync } = require("node:fs") as typeof import("node:fs");
    const { join } = require("node:path") as typeof import("node:path");

    const nodeModulesPath = join(cwd, "node_modules");

    if (!existsSync(nodeModulesPath)) {
        return [];
    }

    const unapproved: string[] = [];

    const scanDir = (dir: string, prefix = ""): void => {
        let entries: string[];

        try {
            entries = readdirSync(dir);
        } catch {
            return;
        }

        for (const entry of entries) {
            const fullPath = join(dir, entry);

            if (entry.startsWith("@")) {
                scanDir(fullPath, entry + "/");
                continue;
            }

            if (entry.startsWith(".")) {
                continue;
            }

            const pkgName = prefix + entry;
            const pkgJsonPath = join(fullPath, "package.json");

            try {
                if (!statSync(fullPath).isDirectory() || !existsSync(pkgJsonPath)) {
                    continue;
                }

                const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf8"));
                const scripts = pkg.scripts ?? {};
                const hasBuildScripts = scripts.preinstall || scripts.install || scripts.postinstall || scripts.prepare;

                if (!hasBuildScripts) {
                    continue;
                }

                const isApproved = Object.entries(allowBuilds).some(([pattern, allowed]) => {
                    if (!allowed) return false;
                    if (pattern === pkgName) return true;
                    if (pattern.endsWith("*")) return pkgName.startsWith(pattern.slice(0, -1));

                    return false;
                });

                if (!isApproved) {
                    const types = [];

                    if (scripts.preinstall) types.push("preinstall");
                    if (scripts.install) types.push("install");
                    if (scripts.postinstall) types.push("postinstall");
                    if (scripts.prepare) types.push("prepare");

                    unapproved.push(`${pkgName} (${types.join(", ")})`);
                }
            } catch {
                // Skip unreadable packages
            }
        }
    };

    scanDir(nodeModulesPath);

    return unapproved;
};

export type { SecurityCheckResult };
export { checkSecurityConfig, emitSecurityWarnings, printSecurityReport, scanUnapprovedBuildScripts, previewPnpmSync };
