import isInCi from "is-in-ci";

import type { VisConfig } from "../config/workspace";
import { pail } from "../io/logger";

interface SecurityCheckResult {
    errors: string[];
    warnings: string[];
}

/**
 * Checks the vis config for recommended security settings.
 *
 * When `defineConfig()` or `loadVisConfig()` is used, secure defaults are already
 * merged. This function validates the *final* config (defaults + user overrides)
 * and flags remaining gaps — primarily `allowBuilds`, which must be user-supplied.
 */
const checkSecurityConfig = (config: VisConfig, packageManager: string): SecurityCheckResult => {
    const result: SecurityCheckResult = { errors: [], warnings: [] };
    const { security } = config;

    if (!security) {
        result.warnings.push("No security settings configured. Use defineConfig() from '@visulima/vis/config' to get secure defaults automatically.");

        return result;
    }

    if (!security.allowBuilds || Object.keys(security.allowBuilds).length === 0) {
        result.warnings.push(
            packageManager === "pnpm"
                ? "security.allowBuilds is not configured. pnpm blocks build scripts by default since v10. Run 'vis approve-builds' to review."
                : "security.allowBuilds is not configured. Consider listing which packages are allowed to run install/postinstall scripts.",
        );
    }

    if (security.minimumReleaseAge === 0) {
        result.warnings.push("security.minimumReleaseAge is explicitly set to 0. New packages can be installed immediately after publishing.");
    }

    if (security.trustPolicy === "off") {
        result.warnings.push("security.trustPolicy is explicitly set to 'off'. Packages whose trust level has decreased will not be blocked.");
    }

    if (security.blockExoticSubdeps === false) {
        result.warnings.push("security.blockExoticSubdeps is explicitly disabled. Transitive dependencies can pull code from git repos or tarball URLs.");
    }

    if (security.strictDepBuilds === false) {
        result.warnings.push("security.strictDepBuilds is explicitly disabled. Unapproved build scripts will only produce warnings, not errors.");
    }

    if (security.strictDepBuilds && (!security.allowBuilds || Object.keys(security.allowBuilds).length === 0)) {
        result.errors.push(
            "security.strictDepBuilds is enabled but security.allowBuilds is empty. All dependencies with build scripts will be blocked. "
            + "Run 'vis approve-builds' to review and add packages.",
        );
    }

    if (security.socket?.acceptedRisks) {
        const staleThresholdMs = 90 * 24 * 60 * 60 * 1000;
        const now = Date.now();

        for (const [pkg, risk] of Object.entries(security.socket.acceptedRisks)) {
            const acceptedTime = new Date(risk.acceptedAt).getTime();

            if (now - acceptedTime > staleThresholdMs) {
                result.warnings.push(`Accepted risk for "${pkg}" is over 90 days old (accepted ${risk.acceptedAt}). Consider re-evaluating with 'vis audit'.`);
            }
        }
    }

    return result;
};

/**
 * Emits a single-line security summary warning before PM commands.
 * Skipped in CI unless VIS_SECURITY_WARNINGS=1.
 *
 * When `enforcementWillFire` is true (install/add/update), the allowBuilds
 * warning is excluded from the summary because `enforceScriptSecurity` is
 * about to emit a more specific, actionable warning for it. Without this,
 * users see two stacked warnings saying the same thing.
 */
const emitSecurityWarnings = (config: VisConfig, packageManager: string, enforcementWillFire = false): void => {
    if (isInCi && !process.env.VIS_SECURITY_WARNINGS) {
        return;
    }

    const result = checkSecurityConfig(config, packageManager);

    for (const error of result.errors) {
        pail.error(error);
    }

    const summarized = enforcementWillFire ? result.warnings.filter((w) => !w.startsWith("security.allowBuilds is not configured")) : result.warnings;

    if (summarized.length > 0) {
        pail.warn(`${summarized.length} security recommendation${summarized.length === 1 ? "" : "s"} found. Run 'vis check --security-config' for details.`);
    }
};

/**
 * Prints the full security audit report, including active settings and warnings.
 */
const printSecurityReport = (config: VisConfig, packageManager: string): void => {
    const result = checkSecurityConfig(config, packageManager);
    const { security } = config;

    if (security) {
        pail.info("Active security settings:");
        pail.info(`  minimumReleaseAge:      ${security.minimumReleaseAge ?? "not set"} minutes`);
        pail.info(`  trustPolicy:            ${security.trustPolicy ?? "not set"}`);
        pail.info(`  trustPolicyIgnoreAfter: ${security.trustPolicyIgnoreAfter ?? "not set"} minutes`);
        pail.info(`  blockExoticSubdeps:     ${security.blockExoticSubdeps ?? false}`);
        pail.info(`  strictDepBuilds:        ${security.strictDepBuilds ?? false}`);
        pail.info(`  allowBuilds:            ${security.allowBuilds ? `${Object.keys(security.allowBuilds).length} entries` : "not configured"}`);
        pail.info("");
        pail.info("Socket.dev integration:");
        pail.info(`  socket.enabled:         ${security.socket?.enabled ?? false}`);
        pail.info(`  socket.apiToken:        ${security.socket?.apiToken || process.env.VIS_SOCKET_TOKEN ? "configured" : "using public token"}`);
        pail.info(`  socket.minimumScore:    ${security.socket?.minimumScore ?? "default (0.4)"}`);
        pail.info(`  socket.cacheTtlMs:      ${security.socket?.cacheTtlMs ?? "default (1 hour)"}`);
        pail.info(`  socket.timeoutMs:       ${security.socket?.timeoutMs ?? "default (15s)"}`);

        if (security.socket?.acceptedRisks) {
            const risks = Object.entries(security.socket.acceptedRisks);

            pail.info(`  socket.acceptedRisks:   ${String(risks.length)} entr${risks.length === 1 ? "y" : "ies"}`);

            for (const [pkg, risk] of risks) {
                pail.info(`    ${pkg}: ${risk.reason} (accepted ${risk.acceptedAt.slice(0, 10)})`);
            }
        } else {
            pail.info("  socket.acceptedRisks:   none");
        }

        pail.info("");
    }

    if (result.errors.length === 0 && result.warnings.length === 0) {
        pail.info("All recommended security settings are configured.");

        return;
    }

    for (const error of result.errors) {
        pail.error(error);
    }

    for (const w of result.warnings) {
        pail.warn(w);
    }

    pail.notice("");
    pail.notice("Secure defaults are applied by defineConfig(). You only need to add allowBuilds:");
    pail.notice("");
    pail.notice("  import { defineConfig } from '@visulima/vis/config';");
    pail.notice("");
    pail.notice("  export default defineConfig({");
    pail.notice("    security: {");
    pail.notice("      allowBuilds: {");
    pail.notice("        esbuild: true,");
    pail.notice("        '@prisma/client': true,");
    pail.notice("      },");
    pail.notice("    },");
    pail.notice("  });");
};

/**
 * Reports which vis security settings would map to pnpm-workspace.yaml.
 */
const previewPnpmSync = (config: VisConfig): string[] => {
    const { security } = config;

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

    if (security.trustPolicyIgnoreAfter !== undefined) {
        entries.push(`trustPolicyIgnoreAfter: ${security.trustPolicyIgnoreAfter}`);
    }

    return entries;
};

export type { SecurityCheckResult };
export { checkSecurityConfig, emitSecurityWarnings, previewPnpmSync, printSecurityReport };
