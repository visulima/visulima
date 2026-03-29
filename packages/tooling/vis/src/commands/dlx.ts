import type { Command } from "@visulima/cerebro";

import { loadNativeBindings } from "../native-binding";
import { detectPm, runInteractive } from "../pm-runner";

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
        ["vis dlx -s create-vue my-app", "Silent mode"],
    ],
    execute: async ({ argument, logger, options, workspaceRoot: wsRoot }) => {
        const args = argument as string[];

        if (!args || args.length === 0) {
            throw new Error("No package specified. Usage: vis dlx <package[@version]> [args...]");
        }

        const [pkg, ...rest] = args;
        const cwd = (options.cwd as string) ?? wsRoot ?? process.cwd();
        const pm = detectPm(cwd);
        const native = loadNativeBindings();

        if (!native) {
            throw new Error("Native bindings not available.");
        }

        const additionalPackages = options.package ? [].concat(options.package as never) : [];

        const resolved = native.resolveDlx(pm.name, pm.version, {
            additionalPackages,
            args: rest,
            package: pkg as string,
            shellMode: (options["shell-mode"] as boolean) || false,
            silent: (options.silent as boolean) || false,
        });

        const code = runInteractive(resolved, cwd, logger);

        if (code !== 0) {
            process.exitCode = code;
        }
    },
    name: "dlx",
    options: [
        { alias: "p", description: "Additional packages to install (repeatable)", multiple: true, name: "package", type: String },
        { alias: "c", defaultValue: false, description: "Execute within shell environment", name: "shell-mode", type: Boolean },
        { alias: "s", defaultValue: false, description: "Suppress output except command results", name: "silent", type: Boolean },
    ],
};

export default dlx;
