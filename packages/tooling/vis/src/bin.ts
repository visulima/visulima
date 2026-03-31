import { createCerebro } from "@visulima/cerebro";
import { findMonorepoRootSync } from "@visulima/package";

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
import envCommand from "./commands/env";
import execCommand from "./commands/exec";
import graphCommand from "./commands/graph";
import hookCommand from "./commands/hook";
import implodeCommand from "./commands/implode";
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
import { loadVisConfig } from "./config";
import { injectVersion } from "./output";
import { detectPm } from "./pm-runner";
import { emitSecurityWarnings } from "./security";
import { enforceScriptSecurity, runApprovedScripts } from "./script-security";
import { showTip } from "./tips";

// Inject VIS_VERSION for child processes before any commands run
injectVersion();

/**
 * Attempts to load and enable V8 compile cache for better performance.
 * Falls back to v8-compile-cache module if Node.js native compile cache is not available.
 */
try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports,global-require
    if (!require("node:module")?.enableCompileCache?.()) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports,global-require
        require("v8-compile-cache");
    }
} catch {
    // We don't have/need to care about v8-compile-cache failed
}

const cli = createCerebro("vis", {
    packageName: "vis",
    packageVersion: pkg.version,
});

// Load config once and inject into every command's toolbox
cli.addPlugin({
    /* eslint-disable no-param-reassign -- cerebro plugin pattern requires mutating toolbox */
    beforeCommand: async (toolbox) => {
        try {
            const workspaceRoot = findMonorepoRootSync(process.cwd()).path;

            toolbox.workspaceRoot = workspaceRoot;
            toolbox.visConfig = await loadVisConfig(workspaceRoot);
        } catch (error: unknown) {
            // findMonorepoRootSync failing is expected (e.g., running --help outside a workspace)
            if (error instanceof Error && !error.message.includes("monorepo root")) {
                toolbox.logger.warn(`Failed to load vis config: ${error.message}`);
            }

            toolbox.visConfig = {};
        }
    },
    /* eslint-enable no-param-reassign */
    name: "config-loader",
});

// Security plugin: warn about missing settings + enforce script blocking for npm/yarn
const INSTALL_COMMANDS = new Set(["install", "add"]);
const PM_COMMANDS = new Set(["install", "add", "update", "remove", "dedupe"]);

cli.addPlugin({
    /* eslint-disable no-param-reassign -- cerebro plugin pattern */
    beforeCommand: async (toolbox) => {
        const command = process.argv[2] ?? "";

        if (PM_COMMANDS.has(command) && toolbox.visConfig && toolbox.workspaceRoot) {
            const pm = detectPm(toolbox.workspaceRoot);

            emitSecurityWarnings(toolbox.visConfig, pm.name);

            // For install/add: enforce script blocking on npm/yarn
            if (INSTALL_COMMANDS.has(command)) {
                const enforcement = enforceScriptSecurity(
                    pm.name as "bun" | "npm" | "pnpm" | "yarn",
                    toolbox.workspaceRoot,
                    toolbox.visConfig,
                );

                for (const w of enforcement.warnings) {
                    toolbox.logger.warn(`security: ${w}`);
                }

                // Store enforcement result for afterCommand
                toolbox.scriptEnforcement = enforcement;
            }
        }
    },
    afterCommand: async (toolbox) => {
        // Run approved scripts after --ignore-scripts install (npm/yarn)
        const enforcement = toolbox.scriptEnforcement as ReturnType<typeof enforceScriptSecurity> | undefined;

        if (enforcement?.postInstallPackages.length && toolbox.workspaceRoot) {
            runApprovedScripts(toolbox.workspaceRoot, enforcement.postInstallPackages);
        }
    },
    /* eslint-enable no-param-reassign */
    name: "security-enforcement",
});

// Existing commands
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

// Package management commands (native Rust-backed)
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
cli.addCommand(cleanCommand);
cli.addCommand(createCommand);
cli.addCommand(envCommand);
cli.addCommand(upgradeCommand);
cli.addCommand(implodeCommand);

// Security commands
cli.addCommand(approveBuildsCommand);

// Tips plugin: show contextual tips after command execution
cli.addPlugin({
    afterCommand: async () => {
        const args = process.argv.slice(2);
        const command = args[0] ?? "";

        showTip({ args, command, success: process.exitCode === undefined || process.exitCode === 0 });
    },
    name: "cli-tips",
});

await cli.run();
