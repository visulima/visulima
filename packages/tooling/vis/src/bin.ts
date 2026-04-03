import { createCerebro } from "@visulima/cerebro";
import { errorHandlerPlugin } from "@visulima/cerebro/plugins/error-handler";
import { readJsonSync } from "@visulima/fs";
import { findMonorepoRootSync } from "@visulima/package";
import { join } from "@visulima/path";

import pkg from "../package.json";
import addCommand from "./commands/add";
import affectedCommand from "./commands/affected";
import aiCommand from "./commands/ai";
import analyzeCommand from "./commands/analyze";
import approveBuildsCommand from "./commands/approve-builds";
import checkCommand from "./commands/check";
import cleanCommand from "./commands/clean";
import createCommand from "./commands/create";
import dedupeCommand from "./commands/dedupe";
import dlxCommand from "./commands/dlx";
import execCommand from "./commands/exec";
import graphCommand from "./commands/graph";
import hookCommand from "./commands/hook";
import implodeCommand from "./commands/implode";
import initCommand from "./commands/init";
import installCommand from "./commands/install";
import linkCommand from "./commands/link";
import migrateCommand from "./commands/migrate";
import outdatedCommand from "./commands/outdated";
import pmCommand from "./commands/pm";
import removeCommand from "./commands/remove";
import runCommand from "./commands/run";
import stagedCommand from "./commands/staged";
import unlinkCommand from "./commands/unlink";
import updateCommand from "./commands/update";
import upgradeCommand from "./commands/upgrade";
import whyCommand from "./commands/why";
import { injectVersion, setTerminalTitle } from "./output";
import configLoaderPlugin from "./plugins/config-loader";
import postCommandPlugin from "./plugins/post-command";
import securityEnforcementPlugin from "./plugins/security-enforcement";
import { startUpgradeCheck } from "./upgrade-check";

// Inject VIS_VERSION for child processes before any commands run
injectVersion();

// Set terminal title to the project name from package.json
try {
    const rootDir = findMonorepoRootSync(process.cwd()).path;
    const rootPkg = readJsonSync(join(rootDir, "package.json")) as { name?: string };

    if (rootPkg.name) {
        setTerminalTitle(rootPkg.name);
    }
} catch {
    // No workspace root or package.json found — skip
}

// Start background upgrade check immediately (non-blocking)
const upgradeCheckCallback = startUpgradeCheck(pkg.version, process.argv[2] ?? "");

/**
 * Attempts to load and enable V8 compile cache for better performance.
 * Falls back to v8-compile-cache module if Node.js native compile cache is not available.
 */
try {
    // @ts-expect-error - enableCompileCache is only available in Node.js 22.8+
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    Module.enableCompileCache?.();
} catch {
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require("v8-compile-cache");
    } catch {
        // We don't have/need to care about v8-compile-cache failed
    }
}

const cli = createCerebro("vis", {
    packageName: "vis",
    packageVersion: pkg.version,
});

// Enhanced error handling
const isDebug = process.argv.includes("--debug") || Boolean(process.env["DEBUG"]);

cli.addPlugin(
    errorHandlerPlugin({
        detailed: isDebug,
        exitOnError: false,
    }),
);

// Global --cwd option available to all commands
cli.addGlobalOption({
    description: "Override workspace root directory",
    name: "cwd",
    type: String,
});

// Plugins
cli.addPlugin(configLoaderPlugin);
cli.addPlugin(securityEnforcementPlugin);

// Workspace commands
cli.addCommand(runCommand);
cli.addCommand(graphCommand);
cli.addCommand(affectedCommand);
cli.addCommand(hookCommand);
cli.addCommand(updateCommand);
cli.addCommand(checkCommand);
cli.addCommand(aiCommand);
cli.addCommand(analyzeCommand);
cli.addCommand(migrateCommand);
cli.addCommand(stagedCommand);

// Package management commands
cli.addCommand(installCommand);
cli.addCommand(addCommand);
cli.addCommand(removeCommand);
cli.addCommand(dedupeCommand);
cli.addCommand(whyCommand);
cli.addCommand(outdatedCommand);
cli.addCommand(linkCommand);
cli.addCommand(unlinkCommand);
cli.addCommand(dlxCommand);
cli.addCommand(execCommand);
cli.addCommand(pmCommand);

// Project & environment commands
cli.addCommand(initCommand);
cli.addCommand(cleanCommand);
cli.addCommand(createCommand);
cli.addCommand(upgradeCommand);
cli.addCommand(implodeCommand);

// Security commands
cli.addCommand(approveBuildsCommand);

// Post-command: upgrade notice + tips
cli.addPlugin(postCommandPlugin(upgradeCheckCallback));

try {
    await cli.run();
} catch {
    // errorHandlerPlugin already rendered the error
    process.exitCode = process.exitCode || 1;
}
