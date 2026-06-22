import type { CommandExecute, Toolbox } from "@visulima/cerebro";

import { resolveInstaller, runUnlink } from "../../pm/pm-runner";
import { resolveCommandRuntime, runtimeInstallerBackend } from "../../runtime/command-runtime";
import { mergeForwardedPackages } from "../../util/utils";
import type { UnlinkOptions } from "./index";

const execute = async ({ argument, logger, options, rawUnknown, visConfig, workspaceRoot: wsRoot }: Toolbox<Console, UnlinkOptions>): Promise<void> => {
    const packages = mergeForwardedPackages(argument, rawUnknown);
    const cwd = wsRoot ?? process.cwd();
    const runtime = resolveCommandRuntime({ logger, options, visConfig }, cwd);
    const pm = resolveInstaller(cwd, {
        backend: runtimeInstallerBackend(runtime),
        configBackend: visConfig?.install?.backend,
        configCorepack: visConfig?.install?.corepack,
    });

    const code = runUnlink(pm, packages, options.recursive || false, cwd, logger);

    if (code !== 0) {
        process.exitCode = code;
    }
};

export default execute as CommandExecute<Toolbox>;
