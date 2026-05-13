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
 * and flags remaining gaps — primarily `installScripts.allow`, which must be
 * user-supplied.
 */
const checkSecurityConfig = (config: VisConfig, packageManager: string): SecurityCheckResult => {
    const result: SecurityCheckResult = { errors: [], warnings: [] };
    const { security } = config;

    if (!security) {
        result.warnings.push("No security settings configured. Use defineConfig() from '@visulima/vis/config' to get secure defaults automatically.");

        return result;
    }

    const policies = security.policies ?? {};
    const { installScripts } = policies;
    const allow = installScripts?.allow;
    const hasAllow = allow && Object.keys(allow).length > 0;

    if (!hasAllow) {
        result.warnings.push(
            packageManager === "pnpm"
                ? "security.policies.installScripts.allow is not configured. pnpm blocks build scripts by default since v10. Run 'vis approve-builds' to review."
                : "security.policies.installScripts.allow is not configured. Consider listing which packages are allowed to run install/postinstall scripts.",
        );
    }

    if (policies.firstSeen?.minutes === 0) {
        result.warnings.push("security.policies.firstSeen.minutes is explicitly set to 0. New packages can be installed immediately after publishing.");
    }

    if (policies.publisherChange?.mode === "off") {
        result.warnings.push("security.policies.publisherChange.mode is explicitly 'off'. Packages whose trust level has decreased will not be blocked.");
    }

    if (security.blockExoticSubdeps === false) {
        result.warnings.push("security.blockExoticSubdeps is explicitly disabled. Transitive dependencies can pull code from git repos or tarball URLs.");
    }

    if (installScripts?.strict === false) {
        result.warnings.push("security.policies.installScripts.strict is explicitly disabled. Unapproved build scripts will only produce warnings, not errors.");
    }

    if (installScripts?.strict && !hasAllow) {
        result.errors.push(
            "security.policies.installScripts.strict is enabled but `.allow` is empty. All dependencies with build scripts will be blocked. "
            + "Run 'vis approve-builds' to review and add packages.",
        );
    }

    if (security.acceptedRisks) {
        const staleThresholdMs = 90 * 24 * 60 * 60 * 1000;
        const now = Date.now();

        for (const [pkg, risk] of Object.entries(security.acceptedRisks)) {
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
 * When `enforcementWillFire` is true (install/add/update), the installScripts.allow
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

    const summarized = enforcementWillFire
        ? result.warnings.filter((w) => !w.startsWith("security.policies.installScripts.allow is not configured"))
        : result.warnings;

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
        const policies = security.policies ?? {};
        const { firstSeen } = policies;
        const { publisherChange } = policies;
        const { installScripts } = policies;
        const { score } = policies;

        pail.info("Active security settings:");
        pail.info(`  policies.firstSeen.minutes:           ${firstSeen?.minutes ?? "not set"} minutes`);
        pail.info(`  policies.publisherChange.mode:        ${publisherChange?.mode ?? "not set"}`);
        pail.info(`  policies.publisherChange.ignoreAfter: ${publisherChange?.ignoreAfter ?? "not set"} minutes`);
        pail.info(`  blockExoticSubdeps:                    ${security.blockExoticSubdeps ?? false}`);
        pail.info(`  policies.installScripts.strict:       ${installScripts?.strict ?? false}`);
        pail.info(`  policies.installScripts.allow:        ${installScripts?.allow ? `${Object.keys(installScripts.allow).length} entries` : "not configured"}`);
        pail.info("");
        pail.info("Socket.dev integration:");
        pail.info(`  socket.enabled:                        ${security.socket?.enabled ?? false}`);
        pail.info(`  socket.apiToken:                       ${security.socket?.apiToken || process.env.VIS_SOCKET_TOKEN ? "configured" : "using public token"}`);
        pail.info(`  policies.score.minimum:                ${score?.minimum ?? "default (0.4)"}`);
        pail.info(`  socket.cacheTtlMs:                     ${security.socket?.cacheTtlMs ?? "default (1 hour)"}`);
        pail.info(`  socket.timeoutMs:                      ${security.socket?.timeoutMs ?? "default (15s)"}`);

        if (security.acceptedRisks) {
            const risks = Object.entries(security.acceptedRisks);

            pail.info(`  acceptedRisks:                         ${String(risks.length)} entr${risks.length === 1 ? "y" : "ies"}`);

            for (const [pkg, risk] of risks) {
                pail.info(`    ${pkg}: ${risk.reason} (accepted ${risk.acceptedAt.slice(0, 10)})`);
            }
        } else {
            pail.info("  acceptedRisks:                         none");
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
    pail.notice("Secure defaults are applied by defineConfig(). You only need to add install-script allowances:");
    pail.notice("");
    pail.notice("  import { defineConfig } from '@visulima/vis/config';");
    pail.notice("");
    pail.notice("  export default defineConfig({");
    pail.notice("    security: {");
    pail.notice("      policies: {");
    pail.notice("        installScripts: {");
    pail.notice("          allow: {");
    pail.notice("            esbuild: true,");
    pail.notice("            '@prisma/client': true,");
    pail.notice("          },");
    pail.notice("        },");
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

    const policies = security.policies ?? {};
    const { firstSeen } = policies;
    const { publisherChange } = policies;
    const { installScripts } = policies;

    const entries: string[] = [];

    if (firstSeen?.minutes !== undefined) {
        entries.push(`minimumReleaseAge: ${firstSeen.minutes}`);
    }

    if (publisherChange?.mode && publisherChange.mode !== "off") {
        entries.push(`trustPolicy: ${publisherChange.mode}`);
    }

    if (security.blockExoticSubdeps) {
        entries.push("blockExoticSubdeps: true");
    }

    if (installScripts?.allow) {
        entries.push(`allowBuilds: ${Object.keys(installScripts.allow).length} entries`);
    }

    if (installScripts?.strict) {
        entries.push("strictDepBuilds: true");
    }

    if (publisherChange?.ignoreAfter !== undefined) {
        entries.push(`trustPolicyIgnoreAfter: ${publisherChange.ignoreAfter}`);
    }

    return entries;
};

export type { SecurityCheckResult };
export { checkSecurityConfig, emitSecurityWarnings, previewPnpmSync, printSecurityReport };
