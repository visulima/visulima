import type { Command } from "@visulima/cerebro";

import { loadNativeBindings } from "../native-binding";
import { detectPm, runInteractive } from "../pm-runner";

const unlink: Command = {
    argument: {
        description: "Packages to unlink (omit for current package)",
        name: "packages",
        type: String,
    },
    description: "Unlink a previously linked package",
    examples: [
        ["vis unlink", "Unlink current package"],
        ["vis unlink react", "Unlink specific package"],
        ["vis unlink -r", "Unlink in all workspace packages"],
    ],
    execute: async ({ argument, logger, options, workspaceRoot: wsRoot }) => {
        const packages = (argument as string[]) || [];
        const cwd = (options.cwd as string) ?? wsRoot ?? process.cwd();
        const pm = detectPm(cwd);
        const native = loadNativeBindings();

        if (!native) {
            throw new Error("Native bindings not available.");
        }

        const resolved = native.resolveUnlink(
            pm.name,
            pm.version,
            packages,
            (options.recursive as boolean) || false,
        );

        const code = runInteractive(resolved, cwd, logger);

        if (code !== 0) {
            process.exitCode = code;
        }
    },
    name: "unlink",
    options: [
        { alias: "r", defaultValue: false, description: "Unlink in all workspace packages", name: "recursive", type: Boolean },
    ],
};

export default unlink;
