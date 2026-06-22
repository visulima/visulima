import type { CommandExecute, Toolbox } from "@visulima/cerebro";

import { resolveInstaller, runOutdated } from "../../pm/pm-runner";
import { resolveCommandRuntime, runtimeInstallerBackend } from "../../runtime/command-runtime";
import { toStringArray } from "../../util/utils";
import type { OutdatedOptions } from "./index";

const execute = async ({ argument, logger, options, rawUnknown, visConfig, workspaceRoot: wsRoot }: Toolbox<Console, OutdatedOptions>): Promise<void> => {
    // Forward unknown flags to the PM (parity with the native path; honor a `--`).
    const unknown = rawUnknown ?? [];
    const packages = unknown[0] === "--" ? (argument ?? []) : [...(argument ?? []), ...unknown];
    const cwd = wsRoot ?? process.cwd();
    const runtime = resolveCommandRuntime({ logger, options, visConfig }, cwd);
    const pm = resolveInstaller(cwd, {
        backend: runtimeInstallerBackend(runtime),
        configBackend: visConfig?.install?.backend,
        configCorepack: visConfig?.install?.corepack,
    });

    const code = runOutdated(
        pm,
        {
            compatible: options.compatible || false,
            dev: options.dev || false,
            filter: toStringArray(options.filter),
            format: options.format || "table",
            global: options.global || false,
            long: options.long || false,
            noOptional: (options as Record<string, unknown>).optional === false,
            packages,
            prod: options.prod || false,
            recursive: options.recursive || false,
            workspaceRoot: options.workspaceRoot || false,
        },
        cwd,
        logger,
    );

    if (code !== 0 && code !== 1) {
        process.exitCode = code;
    }
};

export default execute as CommandExecute<Toolbox>;
