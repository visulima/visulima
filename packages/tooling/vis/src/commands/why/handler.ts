import type { CommandExecute, Toolbox } from "@visulima/cerebro";

import { resolveInstaller, runWhy } from "../../pm/pm-runner";
import { resolveCommandRuntime, runtimeInstallerBackend } from "../../runtime/command-runtime";
import { toStringArray } from "../../util/utils";
import type { WhyOptions } from "./index";

const execute = async ({
    argument,
    logger,
    options,
    process: proc,
    rawUnknown,
    visConfig,
    workspaceRoot: wsRoot,
}: Toolbox<Console, WhyOptions>): Promise<void> => {
    // Forward unknown flags to the PM (parity with the native path; honor a `--`).
    const unknown = rawUnknown ?? [];
    const packages = unknown[0] === "--" ? (argument ?? []) : [...(argument ?? []), ...unknown];

    if (packages.length === 0) {
        throw new Error("No packages specified. Usage: vis why <package...>");
    }

    const cwd = wsRoot ?? proc.cwd;
    const runtime = resolveCommandRuntime({ logger, options, visConfig }, cwd);
    const pm = resolveInstaller(cwd, {
        backend: runtimeInstallerBackend(runtime),
        configBackend: visConfig?.install?.backend,
        configCorepack: visConfig?.install?.corepack,
    });

    const code = runWhy(
        pm,
        {
            depth: options.depth === undefined ? undefined : Number(options.depth),
            dev: options.dev || false,
            filter: toStringArray(options.filter),
            global: options.global || false,
            json: options.json || false,
            long: options.long || false,
            noOptional: (options as Record<string, unknown>).optional === false,
            packages,
            parseable: options.parseable || false,
            prod: options.prod || false,
            recursive: options.recursive || false,
        },
        cwd,
        logger,
    );

    if (code !== 0 && code !== 1) {
        process.exitCode = code;
    }
};

export default execute as CommandExecute<Toolbox>;
