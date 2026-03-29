import type { Command } from "@visulima/cerebro";

import { loadNativeBindings } from "../native-binding";
import { detectPm, runInteractive } from "../pm-runner";

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
        ["vis exec --filter 'app...' -- tsc --noEmit", "Run in filtered packages"],
        ["vis exec -c 'echo $PATH'", "Shell mode"],
    ],
    execute: async ({ argument, logger, options, workspaceRoot: wsRoot }) => {
        const args = argument as string[];

        if (!args || args.length === 0) {
            throw new Error("No command specified. Usage: vis exec <command> [args...]");
        }

        const [command, ...rest] = args;
        const cwd = (options.cwd as string) ?? wsRoot ?? process.cwd();
        const pm = detectPm(cwd);
        const native = loadNativeBindings();

        if (!native) {
            throw new Error("Native bindings not available.");
        }

        const resolved = native.resolveExec(pm.name, pm.version, {
            args: rest,
            command: command as string,
            filter: options.filter ? [].concat(options.filter as never) : [],
            parallel: (options.parallel as boolean) || false,
            recursive: (options.recursive as boolean) || false,
            reverse: (options.reverse as boolean) || false,
            shellMode: (options["shell-mode"] as boolean) || false,
            workspaceRoot: (options["workspace-root"] as boolean) || false,
        });

        const code = runInteractive(resolved, cwd, logger);

        if (code !== 0) {
            process.exitCode = code;
        }
    },
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
