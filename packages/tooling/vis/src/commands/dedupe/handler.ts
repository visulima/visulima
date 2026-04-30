import type { CommandExecute, Toolbox } from "@visulima/cerebro";

import { resolveInstaller, runDedupe } from "../../pm/pm-runner";
import type { DedupeOptions } from "./index";

const execute = async ({ logger, options, visConfig, workspaceRoot: wsRoot }: Toolbox<Console, DedupeOptions>): Promise<void> => {
    const cwd = wsRoot ?? process.cwd();
    const pm = resolveInstaller(cwd, { configBackend: visConfig?.install?.backend });

    const code = runDedupe(pm, options.check || false, cwd, logger);

    if (code !== 0) {
        process.exitCode = code;
    }
};

export default execute as CommandExecute<Toolbox>;
