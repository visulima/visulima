import type { Plugin } from "@visulima/cerebro";

import { detectPm } from "../pm-runner";
import { emitSecurityWarnings, enforceScriptSecurity, runApprovedScripts } from "../security";

const INSTALL_COMMANDS = new Set(["add", "install", "update"]);
const PM_COMMANDS = new Set(["add", "dedupe", "install", "remove", "update"]);

/* eslint-disable no-param-reassign -- cerebro plugin pattern */

const securityEnforcementPlugin: Plugin = {
    afterCommand: async (toolbox) => {
        if (process.exitCode && process.exitCode !== 0) {
            return;
        }

        const enforcement = (toolbox as unknown as Record<string, unknown>).scriptEnforcement as
            | ReturnType<typeof enforceScriptSecurity>
            | undefined;

        if (enforcement?.postInstallPackages.length && toolbox.workspaceRoot) {
            runApprovedScripts(toolbox.workspaceRoot, enforcement.postInstallPackages);
        }
    },
    beforeCommand: async (toolbox) => {
        const command = process.argv[2] ?? "";

        if (PM_COMMANDS.has(command) && toolbox.visConfig && toolbox.workspaceRoot) {
            const pm = detectPm(toolbox.workspaceRoot);

            emitSecurityWarnings(toolbox.visConfig, pm.name);

            if (INSTALL_COMMANDS.has(command)) {
                const enforcement = enforceScriptSecurity(pm.name, toolbox.workspaceRoot, toolbox.visConfig);

                for (const w of enforcement.warnings) {
                    toolbox.logger.warn("security: " + w);
                }

                (toolbox as unknown as Record<string, unknown>).scriptEnforcement = enforcement;
            }
        }
    },
    name: "security-enforcement",
};

/* eslint-enable no-param-reassign */

export default securityEnforcementPlugin;
