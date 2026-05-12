/**
 * `installScripts` policy — wraps `scanBuildScriptStatus` so the unified
 * engine surfaces unapproved lifecycle scripts alongside other policies.
 *
 * - `strict: true` makes unapproved scripts a block-severity decision.
 *   Otherwise they surface as warnings (matches the legacy
 *   `strictDepBuilds` semantics).
 * - When the `allow` map is unset and `strict` is false the policy is
 *   inert and the engine never selects it (see `isConfigured` in
 *   `index.ts`).
 */

import type { VisConfig } from "../../config/types";
import { scanBuildScriptStatus } from "../build-scripts";
import { findAcceptedRisk } from "../socket-security";
import type { PolicyDecision, PolicyInput } from "./index";

export const evaluateInstallScriptsPolicy = (input: PolicyInput, config: VisConfig): PolicyDecision[] => {
    const installScriptsConfig = config.security?.policies?.installScripts;

    if (!installScriptsConfig) {
        return [];
    }

    const allow = installScriptsConfig.allow ?? {};
    const strict = installScriptsConfig.strict === true;

    if (!strict && Object.keys(allow).length === 0) {
        return [];
    }

    const status = scanBuildScriptStatus(input.workspaceRoot, allow);

    if (status.unapproved.length === 0) {
        return [];
    }

    const acceptedRisks = config.security?.acceptedRisks;
    const severity = strict ? "block" : "warn";

    return status.unapproved.map((entry) => {
        return {
            acceptedRisk: findAcceptedRisk(entry.name, entry.version ?? "*", acceptedRisks, "installScripts"),
            data: { hooks: entry.hooks },
            packageName: entry.name,
            policy: "installScripts" as const,
            reason: `${entry.name}${entry.version ? `@${entry.version}` : ""} declares unapproved build script(s): ${entry.hooks.join(", ")}`,
            severity,
            version: entry.version ?? "*",
        };
    });
};
