import type { Command } from "@visulima/cerebro";

import { detectPm, runInfo } from "../pm-runner";

const info: Command = {
    alias: "view",
    argument: {
        description: "Package name followed by optional metadata fields (e.g. 'react version dependencies')",
        name: "args",
        type: String,
    },
    description: "Show npm registry metadata for a package (alias of `npm view` / `pnpm view` / `yarn info` / `bun pm view`)",
    examples: [
        ["vis info react", "Full registry metadata for react"],
        ["vis info react version", "Latest version only"],
        ["vis info react versions", "All published versions"],
        ["vis info react@18 dependencies", "Dependencies of react@18"],
        ["vis info react --json", "Emit JSON"],
        ["vis view react", "Alias matching npm/pnpm"],
    ],
    execute: async ({ argument, logger, options, workspaceRoot: wsRoot }) => {
        if (!argument || argument.length === 0) {
            throw new Error("No package specified. Usage: vis info <package> [field...]");
        }

        const [pkg, ...fields] = argument;

        const cwd = wsRoot ?? process.cwd();
        const pm = detectPm(cwd);

        const code = runInfo(
            pm,
            {
                fields,
                json: (options.json as boolean) || false,
                package: pkg as string,
            },
            cwd,
            logger,
        );

        // Exit 0 = success; exit 1 = the PM reported "not found" / empty result, which
        // is a normal CLI outcome we don't want to flag as a vis failure. Anything else
        // (network error, auth failure, …) propagates as-is.
        if (code !== 0 && code !== 1) {
            process.exitCode = code;
        }
    },
    group: "Dependencies",
    name: "info",
    options: [{ defaultValue: false, description: "Output as JSON", name: "json", type: Boolean }],
};

export default info;
