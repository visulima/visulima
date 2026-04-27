import type { Command } from "@visulima/cerebro";

import { resolveInstaller, runDlx } from "../pm-runner";

const dlx: Command = {
    argument: {
        description: "Package to execute (optionally with @version)",
        name: "package",
        type: String,
    },
    description: "Execute a remote package without permanent installation",
    examples: [
        ["vis dlx create-vite my-app", "Scaffold a new project"],
        ["vis dlx typescript@5.5.4 tsc --version", "Run specific version"],
        ["vis dlx -p cowsay -p lolcatjs -c 'echo hi | cowsay | lolcatjs'", "Multiple packages with shell"],
    ],
    execute: async ({ argument, logger, options, visConfig, workspaceRoot: wsRoot }) => {
        const args = argument;

        if (!args || args.length === 0) {
            throw new Error("No package specified. Usage: vis dlx <package[@version]> [args...]");
        }

        const [pkg, ...rest] = args;
        const cwd = wsRoot ?? process.cwd();
        const pm = resolveInstaller(cwd, { configBackend: visConfig?.install?.backend });

        const additionalPackages = options.package ? (Array.isArray(options.package) ? (options.package as string[]) : [options.package as string]) : [];

        const code = runDlx(
            pm,
            {
                additionalPackages,
                args: rest,
                package: pkg as string,
                shellMode: (options.shellMode as boolean) || false,
                silent: (options.silent as boolean) || false,
            },
            cwd,
            logger,
        );

        if (code !== 0) {
            process.exitCode = code;
        }
    },
    group: "Run & Execute",
    name: "dlx",
    options: [
        { alias: "p", description: "Additional packages to install (repeatable)", multiple: true, name: "package", type: String },
        { alias: "c", defaultValue: false, description: "Execute within shell environment", name: "shell-mode", type: Boolean },
        { alias: "s", defaultValue: false, description: "Suppress output except command results", name: "silent", type: Boolean },
    ],
};

export default dlx;
