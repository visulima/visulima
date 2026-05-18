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
import advisoriesCommands from "./commands/advisories";
import affectedCommand from "./commands/affected";
import aiCommands from "./commands/ai";
import analyzeCommand from "./commands/analyze";
import approveBuildsCommand from "./commands/approve-builds";
import attestCommands from "./commands/attest";
import auditCommand from "./commands/audit";
import cacheCommands from "./commands/cache";
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
import generateCommand from "./commands/generate";
import graphCommand from "./commands/graph";
import hookCommands from "./commands/hook";
import ignoreCommand from "./commands/ignore";
import implodeCommand from "./commands/implode";
import infoCommand from "./commands/info";
import initCommand from "./commands/init";
import inspectCommand from "./commands/inspect";
import installCommand from "./commands/install";
import linkCommand from "./commands/link";
import lintCommand from "./commands/lint";
import listCommand from "./commands/list";
import migrateCommands from "./commands/migrate";
import { isBareMigrateInvocation } from "./commands/migrate/detect-bare";
import { runMigrateInteractive } from "./commands/migrate/interactive";
import optimizeCommand from "./commands/optimize";
// outdated is now an alias of check
import pmCommand from "./commands/pm";
import removeCommand from "./commands/remove";
import replayCommand from "./commands/replay";
import runCommand from "./commands/run";
import sbomCommand from "./commands/sbom";
import secretsCommand from "./commands/secrets";
import securityCommands from "./commands/security";
import serviceCommands from "./commands/service";
import sortPackageJsonCommand from "./commands/sort-package-json";
import stagedCommand from "./commands/staged";
import statusCommand from "./commands/status";
import syncCommand from "./commands/sync";
import taskWhyCommand from "./commands/task-why";
import toolchainCommand from "./commands/toolchain";
import unlinkCommand from "./commands/unlink";
import updateCommand from "./commands/update";
import upgradeCommand from "./commands/upgrade";
import whyCommand from "./commands/why";
import { injectVersion, setTerminalTitle } from "./io/terminal";
import configLoaderPlugin from "./plugins/config-loader";
import postCommandPlugin from "./plugins/post-command";
import securityEnforcementPlugin from "./plugins/security-enforcement";
import { startUpgradeCheck } from "./util/upgrade-check";

// Apply heap memory tuning before any heavy work begins.
// May re-spawn the process with tuned V8 flags and never return.
applyHeapTuning();

// Honor --no-color before any colorized output is emitted. We can't wait
// for cerebro's option parser because banner / error frames that fire
// during plugin setup would already be colored by then.
if (process.argv.includes("--no-color")) {
    process.env["NO_COLOR"] = "1";
    process.env["FORCE_COLOR"] = "0";
}

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

cli.addGlobalOption({
    description: "Path to a vis config file (overrides discovery)",
    name: "config",
    type: String,
});

// Plugins
cli.addPlugin(configLoaderPlugin);
cli.addPlugin(securityEnforcementPlugin);

// Flat top-level commands must be registered before any nested commands that
// share their leaf name (cerebro's addCommand throws DUPLICATE_COMMAND for a
// flat command when a nested command with the same leaf name is already
// registered). The nested-command blocks (hook/migrate/cache) therefore come
// last, after every flat command.

// Workspace commands
cli.addCommand(runCommand);
cli.addCommand(ciCommand);
cli.addCommand(graphCommand);
cli.addCommand(actionGraphCommand);
cli.addCommand(affectedCommand);
cli.addCommand(taskWhyCommand);
cli.addCommand(replayCommand);
cli.addCommand(ignoreCommand);
cli.addCommand(updateCommand);
cli.addCommand(checkCommand);
cli.addCommand(lintCommand);
cli.addCommand(analyzeCommand);
cli.addCommand(sortPackageJsonCommand);
cli.addCommand(stagedCommand);
cli.addCommand(statusCommand);
cli.addCommand(syncCommand);
cli.addCommand(dockerCommand);
cli.addCommand(listCommand);
cli.addCommand(toolchainCommand);
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
cli.addCommand(createCommand);
cli.addCommand(generateCommand);
cli.addCommand(devcontainerCommand);
cli.addCommand(upgradeCommand);
cli.addCommand(implodeCommand);

// Security commands
cli.addCommand(approveBuildsCommand);
cli.addCommand(auditCommand);
cli.addCommand(inspectCommand);
cli.addCommand(doctorCommand);
cli.addCommand(optimizeCommand);
cli.addCommand(sbomCommand);
cli.addCommand(secretsCommand);

// Nested commands — registered last so leaf-name collisions with flat
// top-level commands (list, install, add, run, clean) don't trip the
// duplicate-name guard in cerebro's addCommand.
for (const command of hookCommands) {
    cli.addCommand(command);
}

for (const command of migrateCommands) {
    cli.addCommand(command);
}

for (const command of cacheCommands) {
    cli.addCommand(command);
}

for (const command of advisoriesCommands) {
    cli.addCommand(command);
}

for (const command of aiCommands) {
    cli.addCommand(command);
}

for (const command of serviceCommands) {
    cli.addCommand(command);
}

for (const command of securityCommands) {
    cli.addCommand(command);
}

for (const command of attestCommands) {
    cli.addCommand(command);
}

// Post-command: upgrade notice + tips
cli.addPlugin(postCommandPlugin(upgradeCheckCallback));

if (isBareMigrateInvocation(process.argv.slice(2))) {
    const { loadVisConfig } = await import("./config/config");
    const workspaceRoot = process.env["VIS_MONOREPO_ROOT"] || process.cwd();

    let visConfig: Awaited<ReturnType<typeof loadVisConfig>> | undefined;

    try {
        visConfig = await loadVisConfig(workspaceRoot);
    } catch {
        visConfig = undefined;
    }

    try {
        await runMigrateInteractive({
            logger: {
                info: (message: string) => {
                    process.stdout.write(`${message}\n`);
                },
                warn: (message: string) => {
                    process.stderr.write(`${message}\n`);
                },
            },
            visConfig,
            workspaceRoot,
        });
    } catch (error) {
        process.stderr.write(`${(error as Error).message}\n`);
        process.exitCode = 1;
    }
} else {
    // Run inside an async IIFE so there's no top-level await — Node 22 logs
    // "Detected unsettled top-level await" if cerebro's plugin lifecycle keeps
    // a microtask in flight when the loop empties.
    // eslint-disable-next-line unicorn/prefer-top-level-await, no-void -- void marks the IIFE promise as intentionally discarded
    void (async () => {
        try {
            await cli.run({ shouldExitProcess: false });
        } catch {
            // errorHandlerPlugin already rendered the error
            process.exitCode = process.exitCode || 1;
        } finally {
            // Force an explicit exit once the command settles. Interactive
            // commands (the dynamic TUI run path in particular) can leave
            // stray refs on stdin or Ink internals that prevent the event
            // loop from draining naturally — chasing every one is fragile,
            // so we exit deliberately with whatever exitCode the command
            // (or errorHandlerPlugin) recorded.
            // eslint-disable-next-line unicorn/no-process-exit -- explicit exit is the reliable termination path for TUI commands
            process.exit(process.exitCode ?? 0);
        }
    })();
}
