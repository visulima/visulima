import type { CommandExecute, Toolbox } from "@visulima/cerebro";

import { resolveInstaller, runExec } from "../../pm/pm-runner";
import { resolveCommandRuntime, runtimeInstallerBackend } from "../../runtime/command-runtime";
import { toStringArray } from "../../util/utils";
import type { ExecOptions } from "./index";

const execute = async ({ argument, logger, options, rawUnknown, visConfig, workspaceRoot: wsRoot }: Toolbox<Console, ExecOptions>): Promise<void> => {
    const positionals = argument;

    if (!positionals || positionals.length === 0) {
        throw new Error("No command specified. Usage: vis exec <command> [args...]");
    }

    const [command, ...positionalRest] = positionals;

    // cerebro's `stopAtFirstUnknown` parse routes tool flags after the command
    // into `rawUnknown` (which the handler historically ignored, silently
    // dropping them). Forward them so `vis exec <tool> --flag` reaches the tool.
    // When an explicit `--` separator is used, cerebro already put the
    // post-separator tokens into `argument`, and `rawUnknown` merely repeats them
    // (led by the literal `--`), so it is ignored in that case. Tip: use
    // `--filter=<pat>` (not `-F <pat>`) so the multi-value filter doesn't greedily
    // swallow the command.
    const unknown = rawUnknown ?? [];
    const rest = unknown[0] === "--" ? positionalRest : [...positionalRest, ...unknown];

    const cwd = wsRoot ?? process.cwd();
    const runtime = resolveCommandRuntime({ logger, options, visConfig }, cwd);
    const pm = resolveInstaller(cwd, {
        backend: runtimeInstallerBackend(runtime),
        configBackend: visConfig?.install?.backend,
        configCorepack: visConfig?.install?.corepack,
    });

    const code = runExec(
        pm,
        {
            args: rest,
            command: command as string,
            filter: toStringArray(options.filter),
            parallel: options.parallel || false,
            recursive: options.recursive || false,
            reverse: options.reverse || false,
            shellMode: options.shellMode || false,
            workspaceRoot: options.workspaceRoot || false,
        },
        cwd,
        logger,
    );

    if (code !== 0) {
        process.exitCode = code;
    }
};

// fallow-ignore-next-line unused-export -- lazy-loaded command entry (cerebro loader/lazyNamed dynamic import)
export default execute as CommandExecute<Toolbox>;
