import type { CommandExecute, Toolbox } from "@visulima/cerebro";

import { resolveInstaller, runUnlink } from "../../pm/pm-runner";
import type { UnlinkOptions } from "./index";

const execute = async ({ argument, logger, options, visConfig, workspaceRoot: wsRoot }: Toolbox<Console, UnlinkOptions>): Promise<void> => {
    const packages = argument || [];
    const cwd = wsRoot ?? process.cwd();
    const pm = resolveInstaller(cwd, { configBackend: visConfig?.install?.backend, configCorepack: visConfig?.install?.corepack });

    const code = runUnlink(pm, packages, options.recursive || false, cwd, logger);

    if (code !== 0) {
        process.exitCode = code;
    }
};

export default execute as CommandExecute<Toolbox>;
