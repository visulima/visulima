import { isAccessibleSync, readFileSync, readJsonSync } from "@visulima/fs";
import { join } from "@visulima/path";

import type { VisConfig } from "../config/workspace";
import { isYarnBerry } from "./pm-helpers";
import type { PackageManagerName } from "./types";

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

    const allowBuilds = config.security?.policies?.installScripts?.allow ?? {};
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
                            "vis security.policies.installScripts.allow is configured but trustedDependencies is empty. Run 'vis approve-builds --sync-native'.",
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
                result.warnings.push(
                    "npm does not block lifecycle scripts. Add 'ignore-scripts=true' to .npmrc and configure security.policies.installScripts.allow.",
                );
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

export type { EnforcementResult };
export { enforceScriptSecurity };
