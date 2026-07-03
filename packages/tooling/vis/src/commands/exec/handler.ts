import type { CommandExecute, Toolbox } from "@visulima/cerebro";

import { resolveInstaller, runExec, runLocalExec } from "../../pm/pm-runner";
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
    const filter = toStringArray(options.filter);

    // Fast path: when the invocation targets a single package (no
    // recursive / filter / workspace-root / shell mode) and the binary is
    // already in `node_modules/.bin`, launch it directly and skip the
    // package manager's `exec`/`x` wrapper start-up. `runLocalExec`
    // returns `null` when the binary is not local, so we fall through to
    // the PM, which can still resolve workspace-aware or globally-linked
    // binaries.
    const singlePackage = !options.recursive && !options.workspaceRoot && !options.parallel && !options.reverse && !options.shellMode && filter.length === 0;

    let code = singlePackage ? runLocalExec(command as string, rest, cwd) : null;

    if (code === null) {
        const runtime = resolveCommandRuntime({ logger, options, visConfig }, cwd);
        const pm = resolveInstaller(cwd, {
            backend: runtimeInstallerBackend(runtime),
            configBackend: visConfig?.install?.backend,
            configCorepack: visConfig?.install?.corepack,
        });

        code = runExec(
            pm,
            {
                args: rest,
                command: command as string,
                filter,
                parallel: options.parallel || false,
                recursive: options.recursive || false,
                reverse: options.reverse || false,
                shellMode: options.shellMode || false,
                workspaceRoot: options.workspaceRoot || false,
            },
            cwd,
            logger,
        );
    }

    if (code !== 0) {
        process.exitCode = code;
    }
};

// fallow-ignore-next-line unused-export -- lazy-loaded command entry (cerebro loader/lazyNamed dynamic import)
export default execute as CommandExecute<Toolbox>;
