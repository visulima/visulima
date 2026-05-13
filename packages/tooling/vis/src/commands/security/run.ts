import type { CommandExecute, Toolbox } from "@visulima/cerebro";

import { pail } from "../../io/logger";
import { runApprovedScripts, runRootLifecycleScripts } from "../../security/security";
import type { SecurityRunOptions } from "./index";

const execute = ({ options, visConfig, workspaceRoot: wsRoot }: Toolbox<Console, SecurityRunOptions>): void => {
    const cwd = wsRoot ?? process.cwd();
    const allowBuilds = visConfig?.security?.policies?.installScripts?.allow ?? {};
    const approved = Object.entries(allowBuilds)
        .filter(([, v]) => v)
        .map(([k]) => k);

    if (approved.length === 0 && !options.rootOnly) {
        pail.warn("No approved packages in security.policies.installScripts.allow — nothing to run.");

        if (!options.withRoot) {
            return;
        }
    }

    if (!options.rootOnly) {
        runApprovedScripts(cwd, approved);
    }

    if (options.withRoot || options.rootOnly) {
        runRootLifecycleScripts(cwd);
    }
};

export default execute as CommandExecute<Toolbox>;
