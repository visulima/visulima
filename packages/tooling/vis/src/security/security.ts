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
 */

import { execSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";

import { isAccessibleSync, readFileSync, readJsonSync, writeFileSync } from "@visulima/fs";
import { readYamlSync } from "@visulima/fs/yaml";
import { join } from "@visulima/path";
import isInCi from "is-in-ci";

import type { VisConfig } from "../config/workspace";
import { pail } from "../io/logger";

type PackageManagerName = "bun" | "npm" | "pnpm" | "yarn";

// ── Config checking ──────────────────────────────────────────────────

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

    // allowBuilds has no default — it must be user-supplied
    if (!security.allowBuilds || Object.keys(security.allowBuilds).length === 0) {
        result.warnings.push(
            packageManager === "pnpm"
                ? "security.allowBuilds is not configured. pnpm blocks build scripts by default since v10. Run 'vis approve-builds' to review."
                : "security.allowBuilds is not configured. Consider listing which packages are allowed to run install/postinstall scripts.",
        );
    }

    // Warn if user explicitly disabled defaults
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

    // Error: strictDepBuilds is on but no allowBuilds
    if (security.strictDepBuilds && (!security.allowBuilds || Object.keys(security.allowBuilds).length === 0)) {
        result.errors.push(
            "security.strictDepBuilds is enabled but security.allowBuilds is empty. All dependencies with build scripts will be blocked. " +
                "Run 'vis approve-builds' to review and add packages.",
        );
    }

    // Warn about stale accepted risks (>90 days old)
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

    // Show active security settings
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

/**
 * Scans node_modules for packages with install scripts that aren't approved.
 */
const scanUnapprovedBuildScripts = (cwd: string, allowBuilds: Record<string, boolean>): string[] => {
    const nodeModulesPath = join(cwd, "node_modules");

    if (!isAccessibleSync(nodeModulesPath)) {
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
                scanDir(fullPath, `${entry}/`);
                continue;
            }

            if (entry.startsWith(".")) {
                continue;
            }

            const pkgName = prefix + entry;
            const pkgJsonPath = join(fullPath, "package.json");

            try {
                if (!statSync(fullPath).isDirectory() || !isAccessibleSync(pkgJsonPath)) {
                    continue;
                }

                const pkg = readJsonSync(pkgJsonPath) as { scripts?: Record<string, string> };
                const scripts = pkg.scripts ?? {};

                if (!scripts.preinstall && !scripts.install && !scripts.postinstall && !scripts.prepare) {
                    continue;
                }

                const isApproved = Object.entries(allowBuilds).some(([pattern, allowed]) => {
                    if (!allowed) {
                        return false;
                    }

                    if (pattern === pkgName) {
                        return true;
                    }

                    if (pattern.endsWith("*")) {
                        return pkgName.startsWith(pattern.slice(0, -1));
                    }

                    return false;
                });

                if (!isApproved) {
                    const types = ["preinstall", "install", "postinstall", "prepare"].filter((h) => scripts[h]);

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

// ── Build script enforcement ─────────────────────────────────────────

/** Detects yarn berry vs classic via .yarnrc.yml presence. */
const isYarnBerry = (cwd: string): boolean => isAccessibleSync(join(cwd, ".yarnrc.yml"));

interface EnforcementResult {
    extraArgs: string[];
    postInstallPackages: string[];
    scriptsBlockedByDefault: boolean;
    warnings: string[];
}

/**
 * Determines enforcement actions needed before install/add/update.
 */
const enforceScriptSecurity = (pm: PackageManagerName, workspaceRoot: string, config: VisConfig): EnforcementResult => {
    const result: EnforcementResult = {
        extraArgs: [],
        postInstallPackages: [],
        scriptsBlockedByDefault: false,
        warnings: [],
    };

    const allowBuilds = config.security?.allowBuilds ?? {};
    const hasAllowList = Object.keys(allowBuilds).length > 0;

    switch (pm) {
        case "bun": {
            result.scriptsBlockedByDefault = true;

            if (hasAllowList) {
                const pkgPath = join(workspaceRoot, "package.json");

                try {
                    const pkg = (isAccessibleSync(pkgPath) ? readJsonSync(pkgPath) : {}) as { trustedDependencies?: unknown[] };

                    if (!pkg.trustedDependencies?.length) {
                        result.warnings.push(
                            "vis security.allowBuilds is configured but trustedDependencies is empty. Run 'vis approve-builds --sync-native'.",
                        );
                    }
                } catch {
                    /* skip */
                }
            }

            break;
        }

        case "npm": {
            result.scriptsBlockedByDefault = false;
            const npmrcPath = join(workspaceRoot, ".npmrc");
            const hasIgnoreScripts = isAccessibleSync(npmrcPath) && /^\s*ignore-scripts\s*=\s*true\s*$/m.test(readFileSync(npmrcPath));

            if (!hasIgnoreScripts && hasAllowList) {
                result.warnings.push("npm does not block lifecycle scripts. vis will add --ignore-scripts automatically.");
                result.extraArgs.push("--ignore-scripts");
            } else if (!hasIgnoreScripts && !hasAllowList) {
                result.warnings.push("npm does not block lifecycle scripts. Add 'ignore-scripts=true' to .npmrc and configure security.allowBuilds.");
            }

            if (hasAllowList) {
                for (const [pattern, allowed] of Object.entries(allowBuilds)) {
                    if (allowed) {
                        result.postInstallPackages.push(pattern);
                    }
                }
            }

            break;
        }

        case "pnpm": {
            result.scriptsBlockedByDefault = true;

            if (!hasAllowList) {
                result.warnings.push("pnpm blocks build scripts by default. Run 'vis approve-builds' to review packages that need scripts.");
            }

            break;
        }

        case "yarn": {
            result.scriptsBlockedByDefault = false;

            if (isYarnBerry(workspaceRoot)) {
                const content = readFileSync(join(workspaceRoot, ".yarnrc.yml"));

                if (/^\s*enableScripts\s*:\s*false\s*$/m.test(content)) {
                    result.scriptsBlockedByDefault = true;
                } else {
                    result.warnings.push("yarn berry supports enableScripts. Add 'enableScripts: false' to .yarnrc.yml.");
                }
            } else {
                result.warnings.push("yarn classic does not support blocking lifecycle scripts. Consider upgrading to yarn berry.");

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
        default: {
            break;
        }
    }

    return result;
};

// ── Native config sync ───────────────────────────────────────────────

/**
 * Syncs vis security.allowBuilds to native PM config format.
 */
const syncAllowBuildsToNativeConfig = (pm: PackageManagerName, workspaceRoot: string, allowBuilds: Record<string, boolean>): string[] => {
    const actions: string[] = [];
    const approved = Object.entries(allowBuilds)
        .filter(([, v]) => v)
        .map(([k]) => k);

    switch (pm) {
        case "bun": {
            const pkgPath = join(workspaceRoot, "package.json");

            if (isAccessibleSync(pkgPath)) {
                try {
                    const pkg = readJsonSync(pkgPath) as { trustedDependencies?: string[] };

                    pkg.trustedDependencies = approved;
                    writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
                    actions.push(`Updated package.json trustedDependencies with ${approved.length} packages`);
                } catch (error: unknown) {
                    actions.push(`Failed to update package.json: ${error instanceof Error ? error.message : String(error)}`);
                }
            }

            break;
        }

        case "npm": {
            const npmrcPath = join(workspaceRoot, ".npmrc");
            let content = isAccessibleSync(npmrcPath) ? readFileSync(npmrcPath) : "";

            if (/^\s*ignore-scripts\s*=\s*true\s*$/m.test(content)) {
                actions.push(".npmrc already has ignore-scripts=true");
            } else {
                content = `${content.trimEnd()}\nignore-scripts=true\n`;
                writeFileSync(npmrcPath, content);
                actions.push("Added ignore-scripts=true to .npmrc");
            }

            break;
        }

        case "pnpm": {
            const filePath = join(workspaceRoot, "pnpm-workspace.yaml");

            if (!isAccessibleSync(filePath)) {
                actions.push("pnpm-workspace.yaml not found. Cannot sync allowBuilds.");
                break;
            }

            // Read existing allowBuilds to merge with vis config
            let existing: Record<string, boolean> = {};

            try {
                const data = readYamlSync(filePath) as { allowBuilds?: Record<string, boolean> } | undefined;

                existing = data?.allowBuilds ?? {};
            } catch {
                /* fall through: treat as empty */
            }

            // Merge: vis config wins over existing entries (explicit intent)
            const merged: Record<string, boolean> = { ...existing, ...allowBuilds };
            const addedCount = Object.keys(allowBuilds).filter((key) => existing[key] !== allowBuilds[key]).length;

            if (addedCount === 0) {
                actions.push(`All ${String(Object.keys(allowBuilds).length)} allowBuilds entries already present in pnpm-workspace.yaml.`);
                break;
            }

            // Render the map deterministically (sorted keys, quoted scoped names)
            const sortedKeys = Object.keys(merged).sort();
            const needsQuote = (key: string): boolean => key.startsWith("@") || key.includes("/") || /[:#\s]/.test(key);
            const renderKey = (key: string): string => (needsQuote(key) ? `'${key.replaceAll("'", "''")}'` : key);
            const block = sortedKeys.map((key) => `  ${renderKey(key)}: ${String(merged[key])}`).join("\n");
            const allowBuildsBlock = `allowBuilds:\n${block}\n`;

            // Normalize: ensure trailing newline so the regex can match the final body line.
            let content = readFileSync(filePath);

            if (!content.endsWith("\n")) {
                content += "\n";
            }

            // Replace existing block if present, otherwise append.
            // Matches: "allowBuilds:" followed by zero or more indented (2+ space/tab) lines.
            const existingBlockRegex = /^allowBuilds:[ \t]*\n(?:[ \t]{2}[^\n]*\n)*/m;

            content = existingBlockRegex.test(content) ? content.replace(existingBlockRegex, allowBuildsBlock) : `${content.trimEnd()}\n\n${allowBuildsBlock}`;

            writeFileSync(filePath, content);
            actions.push(`Updated pnpm-workspace.yaml allowBuilds (${String(addedCount)} new, ${String(sortedKeys.length)} total)`);
            break;
        }

        case "yarn": {
            if (isYarnBerry(workspaceRoot)) {
                const yarnrcPath = join(workspaceRoot, ".yarnrc.yml");
                let content = readFileSync(yarnrcPath);
                const hasKey = /^\s*enableScripts\s*:/m.test(content);
                const hasFalse = /^\s*enableScripts\s*:\s*false\s*$/m.test(content);

                if (!hasKey) {
                    content = `${content.trimEnd()}\nenableScripts: false\n`;
                    writeFileSync(yarnrcPath, content);
                    actions.push("Added enableScripts: false to .yarnrc.yml");
                } else if (hasFalse) {
                    actions.push(".yarnrc.yml already has enableScripts: false");
                } else {
                    content = content.replace(/^\s*enableScripts\s*:.+$/m, "enableScripts: false");
                    writeFileSync(yarnrcPath, content);
                    actions.push("Changed enableScripts to false in .yarnrc.yml");
                }
            } else {
                const npmrcPath = join(workspaceRoot, ".npmrc");
                let content = isAccessibleSync(npmrcPath) ? readFileSync(npmrcPath) : "";

                if (/^\s*ignore-scripts\s*=\s*true\s*$/m.test(content)) {
                    actions.push(".npmrc already has ignore-scripts=true");
                } else {
                    content = `${content.trimEnd()}\nignore-scripts=true\n`;
                    writeFileSync(npmrcPath, content);
                    actions.push("Added ignore-scripts=true to .npmrc (yarn classic lacks enableScripts)");
                }
            }

            break;
        }
        default: {
            break;
        }
    }

    return actions;
};

// ── Approved script runner ───────────────────────────────────────────

/** Expands glob patterns against installed node_modules. */
const expandPatterns = (workspaceRoot: string, patterns: string[]): string[] => {
    const nodeModulesPath = join(workspaceRoot, "node_modules");
    const resolved: string[] = [];

    for (const pattern of patterns) {
        if (!pattern.endsWith("*")) {
            resolved.push(pattern);
            continue;
        }

        const prefix = pattern.slice(0, -1);

        try {
            if (prefix.startsWith("@") && prefix.endsWith("/")) {
                const scopeDir = join(nodeModulesPath, prefix.slice(0, -1));

                for (const entry of readdirSync(scopeDir)) {
                    if (!entry.startsWith(".") && statSync(join(scopeDir, entry)).isDirectory()) {
                        resolved.push(`${prefix.slice(0, -1)}/${entry}`);
                    }
                }
            } else {
                for (const entry of readdirSync(nodeModulesPath)) {
                    if (entry.startsWith(prefix) && statSync(join(nodeModulesPath, entry)).isDirectory()) {
                        resolved.push(entry);
                    }
                }
            }
        } catch {
            /* dir doesn't exist */
        }
    }

    return resolved;
};

/**
 * Runs postinstall scripts for approved packages after --ignore-scripts install.
 */
const runApprovedScripts = (workspaceRoot: string, patterns: string[]): void => {
    if (patterns.length === 0) {
        return;
    }

    const packages = expandPatterns(workspaceRoot, patterns);

    if (packages.length === 0) {
        return;
    }

    const nodeModulesPath = join(workspaceRoot, "node_modules");
    let hadFailure = false;

    for (const pkg of packages) {
        if (pkg.includes("..") || pkg.startsWith("/") || pkg.startsWith("\\")) {
            pail.warn(`Skipping invalid package name: ${pkg}`);
            continue;
        }

        const slashCount = (pkg.match(/\//g) || []).length;

        if (slashCount > 1 || (slashCount === 1 && !pkg.startsWith("@"))) {
            pail.warn(`Skipping invalid package name: ${pkg}`);
            continue;
        }

        const pkgDir = join(nodeModulesPath, pkg);
        const pkgJsonPath = join(pkgDir, "package.json");

        if (!isAccessibleSync(pkgJsonPath)) {
            continue;
        }

        try {
            const scripts = (readJsonSync(pkgJsonPath) as { scripts?: Record<string, string> }).scripts ?? {};

            for (const hook of ["preinstall", "install", "postinstall"] as const) {
                if (scripts[hook]) {
                    pail.info(`Running ${hook} for ${pkg}...`);

                    try {
                        const hookScript = scripts[hook];

                        // eslint-disable-next-line sonarjs/os-command -- install hook scripts are arbitrary shell strings authored by the package; the security policy already gates whether we run them
                        execSync(hookScript, { cwd: pkgDir, env: { ...process.env }, stdio: "inherit" });
                    } catch {
                        pail.error(`${hook} script failed for ${pkg}`);
                        hadFailure = true;
                    }
                }
            }
        } catch {
            /* skip unreadable */
        }
    }

    if (hadFailure) {
        process.exitCode = 1;
    }
};

export type { EnforcementResult, PackageManagerName, SecurityCheckResult };
export {
    checkSecurityConfig,
    emitSecurityWarnings,
    enforceScriptSecurity,
    previewPnpmSync,
    printSecurityReport,
    runApprovedScripts,
    scanUnapprovedBuildScripts,
    syncAllowBuildsToNativeConfig,
};
