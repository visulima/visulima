import type { Toolbox } from "@visulima/cerebro";

import { resolveInstaller, runLink } from "../../pm/pm-runner";
import { resolveCommandRuntime, runtimeInstallerBackend } from "../../runtime/command-runtime";

const execute = async ({ argument, logger, options, visConfig, workspaceRoot: wsRoot }: Toolbox): Promise<void> => {
    const target = argument?.[0] ?? null;
    const cwd = wsRoot ?? process.cwd();
    const runtime = resolveCommandRuntime({ logger, options, visConfig }, cwd);
    const pm = resolveInstaller(cwd, {
        backend: runtimeInstallerBackend(runtime),
        configBackend: visConfig?.install?.backend,
        configCorepack: visConfig?.install?.corepack,
    });

    const code = runLink(pm, target, cwd, logger);

    if (code !== 0) {
        process.exitCode = code;
    }
};

// fallow-ignore-next-line unused-export -- lazy-loaded command entry (cerebro loader/lazyNamed dynamic import)
export default execute;
