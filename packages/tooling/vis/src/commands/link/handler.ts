import type { Toolbox } from "@visulima/cerebro";

import { resolveInstaller, runLink } from "../../pm/pm-runner";

const execute = async ({ argument, logger, visConfig, workspaceRoot: wsRoot }: Toolbox): Promise<void> => {
    const target = argument?.[0] ?? null;
    const cwd = wsRoot ?? process.cwd();
    const pm = resolveInstaller(cwd, { configBackend: visConfig?.install?.backend });

    const code = runLink(pm, target, cwd, logger);

    if (code !== 0) {
        process.exitCode = code;
    }
};

export default execute;
