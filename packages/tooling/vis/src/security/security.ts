/**
 * Supply chain security for package management commands.
 *
 * Ports pnpm's security features (minimumReleaseAge, trustPolicy,
 * allowBuilds, blockExoticSubdeps, strictDepBuilds) to work universally
 * across all package managers.
 *
 * Support matrix for build script enforcement:
 * - pnpm v10+: Native `allowBuilds` in pnpm-workspace.yaml (vis validates config)
 * - bun: Native `trustedDependencies` in package.json (vis validates config)
 * - npm: NO native allowlist. vis adds --ignore-scripts and runs approved scripts manually
 * - yarn: NO native allowlist. vis checks enableScripts in .yarnrc.yml
 *
 * This module is a barrel — the real implementation lives in focused
 * submodules. New code may import directly from the submodules; we keep
 * the barrel so existing callers and tests do not need to change.
 */

export type { BinConflict } from "./bin-shadows";
export { collectBinShadows } from "./bin-shadows";
export type { BuildScriptEntry, BuildScriptStatus } from "./build-scripts";
export { scanBuildScriptStatus, scanUnapprovedBuildScripts } from "./build-scripts";
export type { SecurityCheckResult } from "./config-check";
export { checkSecurityConfig, emitSecurityWarnings, previewPnpmSync, printSecurityReport } from "./config-check";
export type { DriftReport } from "./drift";
export { checkPmNativeConfigDrift, formatDriftReport } from "./drift";
export { formatMinutesAsTimeString, parseDurationToMinutes } from "./duration";
export type { EnforcementResult } from "./enforcement";
export { enforceScriptSecurity } from "./enforcement";
export { syncMinimumReleaseAgeToNativeConfig } from "./min-release-age";
export { syncAllowBuildsToNativeConfig } from "./native-config-sync";
export { runApprovedScripts, runRootLifecycleScripts } from "./run-scripts";
export type { PackageManagerName } from "./types";
