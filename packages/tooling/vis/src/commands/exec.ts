import type { Command } from "@visulima/cerebro";

import { resolveInstaller, runExec } from "../pm-runner";
import { toStringArray } from "../utils";

const exec: Command = {
    argument: {
        description: "Command to execute followed by arguments",
        name: "command",
        type: String,
    },
    description: "Execute a local node_modules/.bin command (no remote fallback)",
    examples: [
        ["vis exec eslint .", "Run local eslint"],
        ["vis exec tsc --noEmit", "Run local TypeScript check"],
        ["vis exec -r -- eslint .", "Run in all workspace packages"],
        ["vis exec -c 'echo $PATH'", "Shell mode"],
    ],
    execute: async ({ argument, logger, options, visConfig, workspaceRoot: wsRoot }) => {
        const args = argument;

        if (!args || args.length === 0) {
            throw new Error("No command specified. Usage: vis exec <command> [args...]");
        }

        const [command, ...rest] = args;
        const cwd = wsRoot ?? process.cwd();
        const pm = resolveInstaller(cwd, { configBackend: visConfig?.install?.backend });

        const code = runExec(
            pm,
            {
                args: rest,
                command: command as string,
                filter: toStringArray(options.filter),
                parallel: (options.parallel as boolean) || false,
                recursive: (options.recursive as boolean) || false,
                reverse: (options.reverse as boolean) || false,
                shellMode: (options.shellMode as boolean) || false,
                workspaceRoot: (options.workspaceRoot as boolean) || false,
            },
            cwd,
            logger,
        );

        if (code !== 0) {
            process.exitCode = code;
        }
    },
    group: "Run & Execute",
    name: "exec",
    options: [
        { alias: "c", defaultValue: false, description: "Execute within shell environment", name: "shell-mode", type: Boolean },
        { alias: "r", defaultValue: false, description: "Run in every workspace package", name: "recursive", type: Boolean },
        { alias: "w", defaultValue: false, description: "Run on workspace root only", name: "workspace-root", type: Boolean },
        { alias: "F", description: "Filter packages by name pattern", multiple: true, name: "filter", type: String },
        { defaultValue: false, description: "Run concurrently without topological ordering", name: "parallel", type: Boolean },
        { defaultValue: false, description: "Reverse topological execution order", name: "reverse", type: Boolean },
    ],
};

export default exec;
