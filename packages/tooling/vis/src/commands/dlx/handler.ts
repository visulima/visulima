import type { CommandExecute, Toolbox } from "@visulima/cerebro";

import { resolveInstaller, runDlx } from "../../pm/pm-runner";
import type { DlxOptions } from "./index";

const execute = async ({ argument, logger, options, visConfig, workspaceRoot: wsRoot }: Toolbox<Console, DlxOptions>): Promise<void> => {
    const args = argument;

    if (!args || args.length === 0) {
        throw new Error("No package specified. Usage: vis dlx <package[@version]> [args...]");
    }

    const [pkg, ...rest] = args;
    const cwd = wsRoot ?? process.cwd();
    const pm = resolveInstaller(cwd, { configBackend: visConfig?.install?.backend, configCorepack: visConfig?.install?.corepack });

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
