import type { CommandExecute, Toolbox } from "@visulima/cerebro";

import { resolveInstaller, runRemove } from "../../pm/pm-runner";
import { resolveCommandRuntime, runtimeInstallerBackend } from "../../runtime/command-runtime";
import { toStringArray } from "../../util/utils";
import type { RemoveOptions } from "./index";

const execute = async ({ argument, logger, options, rawUnknown, visConfig, workspaceRoot: wsRoot }: Toolbox<Console, RemoveOptions>): Promise<void> => {
    // Forward unknown flags to the PM (parity with the native path; honor a `--`).
    const unknown = rawUnknown ?? [];
    const packages = unknown[0] === "--" ? (argument ?? []) : [...(argument ?? []), ...unknown];

    if (packages.length === 0) {
        throw new Error("No packages specified. Usage: vis remove <packages...>");
    }

    const cwd = process.cwd();
    const runtime = resolveCommandRuntime({ logger, options, visConfig }, wsRoot ?? cwd);
    const pm = resolveInstaller(wsRoot ?? cwd, {
        backend: runtimeInstallerBackend(runtime),
        configBackend: visConfig?.install?.backend,
        configCorepack: visConfig?.install?.corepack,
    });

    const code = runRemove(
        pm,
        {
            filter: toStringArray(options.filter),
            global: options.global || false,
            packages,
            recursive: options.recursive || false,
            saveDev: options.saveDev || false,
            workspaceRoot: options.workspaceRoot || false,
        },
        cwd,
        logger,
    );

    if (code !== 0) {
        process.exitCode = code;
    }
};

export default execute as CommandExecute<Toolbox>;
