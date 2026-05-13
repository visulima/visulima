/**
 * Supply-chain hardening posture for `vis doctor`.
 *
 * Renders a static "Supply Chain" section that surfaces the current
 * values of `security.policies.firstSeen`, `security.policies.publisherChange`,
 * `security.blockExoticSubdeps`, and `security.policies.installScripts` from the
 * resolved vis config. Unlike the live "Security" section (vulns,
 * Socket alerts), this is config-only and runs in microseconds — it
 * exists to make the hardening knobs *visible* so users discover them
 * before they need them, rather than only seeing warnings when a
 * setting is misconfigured.
 *
 * Severity mapping:
 *   ok    — setting is configured to a hardened value
 *   warn  — setting is unset or set to a permissive value
 *   error — setting is dangerously misconfigured (rare; e.g.
 *           installScripts.strict on with empty installScripts.allow)
 */

import type { VisConfig } from "../../config/workspace";
import { findPatchIssues, readPatchedDependencies } from "../../util/patched-dependencies";
import { scanMigrationLeftovers } from "../migrate/verify";
import type { SectionStatus, SupplyChainFinding, SupplyChainPosture } from "./sections";

/**
 * Roll a list of findings into a single section status. `error`
 * dominates `warn`, `warn` dominates `ok`. Empty findings list returns
 * `ok` so a doctor run with no security config block doesn't claim
 * findings it didn't compute.
 */
const rollUpStatus = (findings: ReadonlyArray<SupplyChainFinding>): SectionStatus => {
    if (findings.some((f) => f.severity === "error")) {
        return "error";
    }

    if (findings.some((f) => f.severity === "warn")) {
        return "warn";
    }

    return "ok";
};

export interface SupplyChainContext {
    /** Optional — when provided, enables PM-native patch validation. */
    packageManager?: string;
    /** Optional — when provided, enables PM-native patch validation. */
    workspaceRoot?: string;
}

export const buildSupplyChainPosture = (config: VisConfig | undefined, context: SupplyChainContext = {}): SupplyChainPosture => {
    const findings: SupplyChainFinding[] = [];
    const security = config?.security;

    if (!security) {
        findings.push({
            detail: "Use defineConfig() from '@visulima/vis/config' to apply secure defaults.",
            label: "No security config — running with the PM's native defaults",
            severity: "warn",
        });

        return { findings, status: rollUpStatus(findings) };
    }

    const firstSeenMinutes = security.policies?.firstSeen?.minutes;
    const publisherChange = security.policies?.publisherChange;
    const installScripts = security.policies?.installScripts;

    // firstSeen — block packages published in the last N minutes.
    if (firstSeenMinutes === undefined) {
        findings.push({
            detail: "Set security.policies.firstSeen.minutes to block packages published in the last N minutes (mitigates supply-chain attacks).",
            label: "policies.firstSeen.minutes is not set",
            severity: "warn",
        });
    } else if (firstSeenMinutes === 0) {
        findings.push({
            detail: "New packages can be installed immediately after publishing. Consider setting a non-zero cooldown.",
            label: "policies.firstSeen.minutes is explicitly 0",
            severity: "warn",
        });
    } else {
        findings.push({
            label: `policies.firstSeen.minutes: ${String(firstSeenMinutes)} minutes`,
            severity: "ok",
        });
    }

    // publisherChange — block when a package's trust level decreases (e.g.
    // OIDC-published → token-published).
    if (publisherChange?.mode === undefined || publisherChange.mode === "off") {
        findings.push({
            detail: "Packages whose trust level has decreased will not be blocked. Consider 'no-downgrade'.",
            label: `policies.publisherChange.mode: ${publisherChange?.mode ?? "not set"}`,
            severity: "warn",
        });
    } else {
        findings.push({
            label: `policies.publisherChange.mode: ${publisherChange.mode}`,
            severity: "ok",
        });
    }

    // blockExoticSubdeps — disallow git/tarball URLs in transitive deps.
    if (security.blockExoticSubdeps === undefined || !security.blockExoticSubdeps) {
        findings.push({
            detail: "Transitive dependencies can pull code from git repos or tarball URLs. Set to true to block.",
            label: `blockExoticSubdeps: ${String(security.blockExoticSubdeps ?? false)}`,
            severity: "warn",
        });
    } else {
        findings.push({
            label: "blockExoticSubdeps: true",
            severity: "ok",
        });
    }

    // policies.installScripts.allow — explicit allowlist of packages
    // permitted to run lifecycle scripts. Vis blocks scripts by default;
    // `allow` is the inverse opt-in.
    const allowBuildsCount = installScripts?.allow ? Object.keys(installScripts.allow).length : 0;

    if (allowBuildsCount === 0) {
        findings.push({
            detail: "Lifecycle scripts are blocked by default. List trusted packages here to opt them back in (e.g. esbuild, @prisma/client).",
            label: "policies.installScripts.allow: not configured",
            severity: "warn",
        });
    } else {
        findings.push({
            label: `policies.installScripts.allow: ${String(allowBuildsCount)} ${allowBuildsCount === 1 ? "entry" : "entries"}`,
            severity: "ok",
        });
    }

    // policies.installScripts.strict + empty allow is an active misconfiguration.
    if (installScripts?.strict && allowBuildsCount === 0) {
        findings.push({
            detail: "All dependencies with build scripts will be blocked. Run 'vis approve-builds' to populate the allow list.",
            label: "policies.installScripts.strict is on but allow is empty",
            severity: "error",
        });
    }

    // Leftover migration tool references — when `vis migrate <tool>` was
    // run incompletely, scripts/hooks/configs may still mention the old
    // tool. Surface as `warn` so reviewers can re-run the verify step.
    if (context.workspaceRoot) {
        const leftovers = scanMigrationLeftovers(context.workspaceRoot);

        if (leftovers.length > 0) {
            const toolList = [...new Set(leftovers.map((issue) => issue.tool))].sort((a, b) => a.localeCompare(b)).join(", ");

            findings.push({
                detail: "Run `vis migrate verify` for the full list, then re-run `vis migrate <tool>` to clean up.",
                label: `${String(leftovers.length)} leftover ${leftovers.length === 1 ? "reference" : "references"} to ${toolList}`,
                severity: "warn",
            });
        }
    }

    // patchedDependencies — pnpm/bun ship a patch system whose entries
    // reference `.patch` files relative to the manifest. A missing file
    // makes `install` fail; we surface it as `error` so the next install
    // doesn't blow up unannounced. Skipped silently for npm/yarn.
    if (context.workspaceRoot && context.packageManager) {
        const patchEntries = readPatchedDependencies(context.workspaceRoot, context.packageManager);

        if (patchEntries.length > 0) {
            const issues = findPatchIssues(patchEntries);

            if (issues.length === 0) {
                findings.push({
                    label: `patchedDependencies: ${String(patchEntries.length)} ${patchEntries.length === 1 ? "entry" : "entries"} resolved`,
                    severity: "ok",
                });
            } else {
                for (const issue of issues) {
                    findings.push({
                        detail: `Referenced from ${context.packageManager === "pnpm" ? "pnpm-workspace.yaml" : "package.json"} but the file is not present at ${issue.entry.patchFile}.`,
                        label: `patchedDependencies: missing patch file for ${issue.entry.name}@${issue.entry.version}`,
                        severity: "error",
                    });
                }
            }
        }
    }

    return { findings, status: rollUpStatus(findings) };
};
