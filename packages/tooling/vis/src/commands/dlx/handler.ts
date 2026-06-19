import type { CommandExecute, Toolbox } from "@visulima/cerebro";

import { maybeGateFirstRun } from "../../dlx/first-run";
import { resolveInstaller, runDlx } from "../../pm/pm-runner";
import { resolveCommandRuntime, runtimeInstallerBackend } from "../../runtime/command-runtime";
import type { DlxOptions } from "./index";

const isTruthyEnv = (value: string | undefined): boolean => {
    const normalized = (value ?? "").trim().toLowerCase();

    return normalized !== "" && normalized !== "0" && normalized !== "false" && normalized !== "no";
};

const execute = async ({ argument, logger, options, visConfig, workspaceRoot: wsRoot }: Toolbox<Console, DlxOptions>): Promise<void> => {
    const args = argument;

    if (!args || args.length === 0) {
        throw new Error("No package specified. Usage: vis dlx <package[@version]> [args...]");
    }

    const [pkg, ...rest] = args;
    const cwd = wsRoot ?? process.cwd();

    // First-run info gate: show size / security score / permissions / changelog
    // and confirm before downloading an unseen package. Skipped in `--silent`
    // mode and on the fast path (CI / non-TTY / `--yes` / already-approved).
    if (!options.silent) {
        const gate = await maybeGateFirstRun({
            forceInfo: options.info || false,
            noInfo: options.noInfo || isTruthyEnv(process.env.VIS_DLX_NO_INFO),
            offline: options.offline || false,
            pkg: pkg as string,
            socketToken: visConfig?.security?.socket?.apiToken ?? process.env.VIS_SOCKET_TOKEN,
            workspaceRoot: cwd,
            yes: options.yes || isTruthyEnv(process.env.VIS_DLX_YES),
        });

        if (!gate.proceed) {
            logger.info("Aborted.");
            process.exitCode = 130;

            return;
        }
    }

    const runtime = resolveCommandRuntime({ logger, options, visConfig }, cwd);
    const pm = resolveInstaller(cwd, {
        backend: runtimeInstallerBackend(runtime),
        configBackend: visConfig?.install?.backend,
        configCorepack: visConfig?.install?.corepack,
    });

    const additionalPackages = options.package ? (Array.isArray(options.package) ? options.package : [options.package as unknown as string]) : [];

    const code = runDlx(
        pm,
        {
            additionalPackages,
            args: rest,
            package: pkg as string,
            shellMode: options.shellMode || false,
            silent: options.silent || false,
        },
        cwd,
        logger,
        { offline: options.offline || false },
    );

    if (code !== 0) {
        process.exitCode = code;
    }
};

export default execute as CommandExecute<Toolbox>;
