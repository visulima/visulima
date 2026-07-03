/**
 * Supply chain security for package management commands.
 *
 * Maps the unified `security.policies` config to native PM settings
 * (minimumReleaseAge, trustPolicy, allowBuilds, blockExoticSubdeps,
 * strictDepBuilds) and enforces them universally across package managers.
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

export { collectBinShadows } from "./bin-shadows";
export { scanBuildScriptStatus, scanUnapprovedBuildScripts } from "./build-scripts";
export { checkSecurityConfig, emitSecurityWarnings, previewPnpmSync, printSecurityReport } from "./config-check";
export { checkPmNativeConfigDrift, formatDriftReport } from "./drift";
export { formatMinutesAsTimeString, parseDurationToMinutes } from "./duration";
export { enforceScriptSecurity } from "./enforcement";
export { syncMinimumReleaseAgeToNativeConfig } from "./min-release-age";
export { syncAllowBuildsToNativeConfig } from "./native-config-sync";
export { runApprovedScripts, runRootLifecycleScripts } from "./run-scripts";
export type { PackageManagerName } from "./types";
