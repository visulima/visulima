// Lean entry for `vis exec` / `vis dlx` — pure child-dispatch commands that
// resolve a binary and spawn it. They don't need the full CLI (60 commands +
// config/security/post plugins): `securityEnforcementPlugin` only gates the
// install/PM verbs, not exec/dlx, and there's no in-process heavy work. Booting
// just these two commands (like `binx`/`visx` does for dlx) avoids the dominant
// ~250-400ms of cold-start the full `cli-main` pays. Dispatched from `bin.ts`.
//
// Trade-off (matches `visx`): the config loader is NOT run on this path, so a
// `vis.config.ts` `install.backend` pin is not read here — runtime is resolved
// from `--runtime` / `VIS_RUNTIME` / lockfile detection. Run without the fast
// path (or set `--runtime`) if a config-pinned backend must apply to exec/dlx.
import { createCerebro } from "@visulima/cerebro";
import { errorHandlerPlugin } from "@visulima/cerebro/plugins/error-handler";

import pkg from "../package.json";
import { runAndExit } from "./cli-run";
import dlxCommand from "./commands/dlx";
import execCommand from "./commands/exec";

export const runExecCli = async (): Promise<void> => {
    const cli = createCerebro("vis", {
        packageName: "vis",
        packageVersion: pkg.version,
    });

    const isDebug = process.argv.includes("--debug") || Boolean(process.env["DEBUG"]);

    cli.addPlugin(
        errorHandlerPlugin({
            detailed: isDebug,
            exitOnError: false,
        }),
    );

    // Surfaced so `resolveCommandRuntime` in the handlers reads the flag.
    cli.addGlobalOption({
        description: "Target JS runtime: node (default) or bun. Overrides VIS_RUNTIME; falls back to lockfile detection.",
        name: "runtime",
        type: String,
    });

    cli.addCommand(execCommand);
    cli.addCommand(dlxCommand);

    await runAndExit(cli);
};
