import { createCerebro } from "@visulima/cerebro";
import enableCompileCache from "@visulima/cerebro/compile-cache";
import { errorHandlerPlugin } from "@visulima/cerebro/plugins/error-handler";

import pkg from "../package.json";
import { runAndExit } from "./cli-run";
import dlxCommand from "./commands/dlx";

// `visx` / `vx` is the npx-style entry point for vis: `visx <pkg> [args]`
// runs a remote package without permanent installation, equivalent to
// `vis dlx`. Kept lean on purpose — does NOT load the vis config, the
// security-enforcement plugin, the post-command plugin, the upgrade
// check, or the 40+ commands the main `vis` binary registers. Only the
// dlx command and the error handler are wired in.

// No heap tuning here: `visx`/`vx` only resolves and spawns a package binary
// (a child process). It does no heavy in-process work, so the ~290ms Node
// re-exec that `applyHeapTuning()` costs would be pure overhead.

if (process.argv.includes("--no-color")) {
    process.env["NO_COLOR"] = "1";
    process.env["FORCE_COLOR"] = "0";
}

// Handle --version / -v / -V before re-routing into the dlx subcommand —
// otherwise the splice below would force them into `dlx --version` and
// the user's intent (print the visx version) would never reach cerebro.
if (process.argv.slice(2).some((argument) => argument === "--version" || argument === "-v" || argument === "-V")) {
    process.stdout.write(`${pkg.version}\n`);
    // eslint-disable-next-line unicorn/no-process-exit -- binx is the CLI entry; exit short-circuits the cerebro re-dispatch below.
    process.exit(0);
}

// Re-frame the invocation as `vis dlx <args>` so cerebro's parser sees
// the dlx subcommand. Done unconditionally — `visx --help` is more
// useful when it routes to dlx's help (showing -p/-c/-s/--offline)
// than to the cerebro top-level menu that lists only "dlx".
process.argv.splice(2, 0, "dlx");

enableCompileCache();

const cli = createCerebro("visx", {
    packageName: "visx",
    packageVersion: pkg.version,
});

const isDebug = process.argv.includes("--debug") || Boolean(process.env["DEBUG"]);

cli.addPlugin(
    errorHandlerPlugin({
        detailed: isDebug,
        exitOnError: false,
    }),
);

cli.addCommand(dlxCommand);

// eslint-disable-next-line no-void -- void marks the IIFE promise as intentionally discarded
void runAndExit(cli);
