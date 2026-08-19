import type { CommandExecute, Toolbox } from "@visulima/cerebro";

import { maybeGateFirstRun } from "../../dlx/first-run";
import { resolveInstaller, runDlx } from "../../pm/pm-runner";
import { resolveCommandRuntime, runtimeInstallerBackend } from "../../runtime/command-runtime";
import { isTruthyEnv } from "../../util/env";
import type { DlxOptions } from "./index";

const execute = async ({ argument, logger, options, process: proc, visConfig, workspaceRoot: wsRoot }: Toolbox<Console, DlxOptions>): Promise<void> => {
    const args = argument;

    if (!args || args.length === 0) {
        throw new Error("No package specified. Usage: vis dlx <package[@version]> [args...]");
    }

    const [pkg, ...rest] = args;
    const cwd = wsRoot ?? proc.cwd;

    const additionalPackages = options.package ? (Array.isArray(options.package) ? options.package : [options.package as unknown as string]) : [];

    // First-run info gate: show size / security score / permissions / changelog
    // and confirm before downloading an unseen package. In shell mode (`-c`) the
    // positional is a shell command, so the packages to vet are the `-p` entries;
    // otherwise it's the positional plus any `-p` extras. The gate self-skips on
    // the fast path (CI / non-TTY / `--yes` / `--no-info` / already-approved).
    const gateTargets = options.shellMode ? additionalPackages : [pkg as string, ...additionalPackages];

    for (const target of gateTargets) {
        // cerebro folds `--no-info` onto `info` and deletes the negated key, so
        // `info` is the only signal that reaches here: `false` means the panel
        // was explicitly suppressed, `true` means it was not. `--info` and the
        // default are indistinguishable by design — both leave it `true` — so
        // the env var stays the second way to suppress.
        const noInfo = !options.info || isTruthyEnv(proc.env.VIS_DLX_NO_INFO);
        const forceInfo = !noInfo && options.info;

        const gate = await maybeGateFirstRun({
            forceInfo,
            noInfo,
            offline: options.offline || false,
            pkg: target,
            socketToken: visConfig?.security?.socket?.apiToken ?? proc.env.VIS_SOCKET_TOKEN,
            workspaceRoot: cwd,
            yes: options.yes || isTruthyEnv(proc.env.VIS_DLX_YES),
        });

        if (!gate.proceed) {
            logger.info("Aborted.");
            // `CerebroProcess.exit` terminates; this path has to return so the
            // rest of the command lifecycle still runs, and the adapter has no
            // non-terminating equivalent of `exitCode`.
            process.exitCode = 1;

            return;
        }
    }

    const runtime = resolveCommandRuntime({ logger, options, visConfig }, cwd);
    const pm = resolveInstaller(cwd, {
        backend: runtimeInstallerBackend(runtime),
        configBackend: visConfig?.install?.backend,
        configCorepack: visConfig?.install?.corepack,
    });

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

// fallow-ignore-next-line unused-export -- lazy-loaded command entry (cerebro loader/lazyNamed dynamic import)
export default execute as CommandExecute<Toolbox>;
