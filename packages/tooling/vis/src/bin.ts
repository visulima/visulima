import { createCerebro } from "@visulima/cerebro";
import completionCommand from "@visulima/cerebro/command/completion";
import enableCompileCache from "@visulima/cerebro/compile-cache";
import { applyHeapTuning } from "@visulima/cerebro/heap-tuning";
import { errorHandlerPlugin } from "@visulima/cerebro/plugins/error-handler";
import { readJsonSync } from "@visulima/fs";
import { findMonorepoRootSync } from "@visulima/package";
import { join } from "@visulima/path";

import pkg from "../package.json";
import actionGraphCommand from "./commands/action-graph";
import addCommand from "./commands/add";
import affectedCommand from "./commands/affected";
import aiCommand from "./commands/ai";
import analyzeCommand from "./commands/analyze";
import approveBuildsCommand from "./commands/approve-builds";
import auditCommand from "./commands/audit";
import cacheCommand from "./commands/cache";
import checkCommand from "./commands/check";
import ciCommand from "./commands/ci";
import cleanCommand from "./commands/clean";
import createCommand from "./commands/create";
import dedupeCommand from "./commands/dedupe";
import devcontainerCommand from "./commands/devcontainer";
import dlxCommand from "./commands/dlx";
import dockerCommand from "./commands/docker";
import doctorCommand from "./commands/doctor";
import execCommand from "./commands/exec";
import graphCommand from "./commands/graph";
import hookCommand from "./commands/hook";
import ignoreCommand from "./commands/ignore";
import implodeCommand from "./commands/implode";
import infoCommand from "./commands/info";
import initCommand from "./commands/init";
import installCommand from "./commands/install";
import linkCommand from "./commands/link";
import listCommand from "./commands/list";
import migrateCommand from "./commands/migrate";
import optimizeCommand from "./commands/optimize";
// outdated is now an alias of check
import pmCommand from "./commands/pm";
import removeCommand from "./commands/remove";
import runCommand from "./commands/run";
import sbomCommand from "./commands/sbom";
import secretsCommand from "./commands/secrets";
import sortPackageJsonCommand from "./commands/sort-package-json";
import stagedCommand from "./commands/staged";
import statusCommand from "./commands/status";
import syncCommand from "./commands/sync";
import taskWhyCommand from "./commands/task-why";
import unlinkCommand from "./commands/unlink";
import updateCommand from "./commands/update";
import upgradeCommand from "./commands/upgrade";
import whyCommand from "./commands/why";
import { injectVersion, setTerminalTitle } from "./output";
import configLoaderPlugin from "./plugins/config-loader";
import postCommandPlugin from "./plugins/post-command";
import securityEnforcementPlugin from "./plugins/security-enforcement";
import { startUpgradeCheck } from "./upgrade-check";

// Apply heap memory tuning before any heavy work begins.
// May re-spawn the process with tuned V8 flags and never return.
applyHeapTuning();

// Inject VIS_VERSION for child processes before any commands run
injectVersion();

// Set terminal title to the project name from package.json.
// Stash the resolved root on an env var so `config-loader.ts`
// doesn't have to walk the directory tree a second time.
try {
    const rootDir = findMonorepoRootSync(process.cwd()).path;

    process.env["VIS_MONOREPO_ROOT"] = rootDir;

    const rootPkg = readJsonSync(join(rootDir, "package.json")) as { name?: string };

    if (rootPkg.name) {
        setTerminalTitle(rootPkg.name);
    }
} catch {
    // No workspace root or package.json found — skip
}

// Start background upgrade check immediately (non-blocking)
const upgradeCheckCallback = startUpgradeCheck(pkg.version, process.argv[2] ?? "");

// Enable V8 compile cache for faster subsequent startups
enableCompileCache();

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
cli.addCommand(ciCommand);
cli.addCommand(graphCommand);
cli.addCommand(actionGraphCommand);
cli.addCommand(affectedCommand);
cli.addCommand(taskWhyCommand);
cli.addCommand(ignoreCommand);
cli.addCommand(hookCommand);
cli.addCommand(updateCommand);
cli.addCommand(checkCommand);
cli.addCommand(aiCommand);
cli.addCommand(analyzeCommand);
cli.addCommand(migrateCommand);
cli.addCommand(sortPackageJsonCommand);
cli.addCommand(stagedCommand);
cli.addCommand(statusCommand);
cli.addCommand(syncCommand);
cli.addCommand(dockerCommand);
cli.addCommand(listCommand);
cli.addCommand(completionCommand);

// Package management commands
cli.addCommand(installCommand);
cli.addCommand(addCommand);
cli.addCommand(removeCommand);
cli.addCommand(dedupeCommand);
cli.addCommand(whyCommand);
cli.addCommand(infoCommand);
cli.addCommand(linkCommand);
cli.addCommand(unlinkCommand);
cli.addCommand(dlxCommand);
cli.addCommand(execCommand);
cli.addCommand(pmCommand);

// Project & environment commands
cli.addCommand(initCommand);
cli.addCommand(cleanCommand);
cli.addCommand(cacheCommand);
cli.addCommand(createCommand);
cli.addCommand(devcontainerCommand);
cli.addCommand(upgradeCommand);
cli.addCommand(implodeCommand);

// Security commands
cli.addCommand(approveBuildsCommand);
cli.addCommand(auditCommand);
cli.addCommand(doctorCommand);
cli.addCommand(optimizeCommand);
cli.addCommand(sbomCommand);
cli.addCommand(secretsCommand);

// Post-command: upgrade notice + tips
cli.addPlugin(postCommandPlugin(upgradeCheckCallback));

try {
    await cli.run();
} catch {
    // errorHandlerPlugin already rendered the error
    process.exitCode = process.exitCode || 1;
}
