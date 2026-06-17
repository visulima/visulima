// The full `vis` CLI: cerebro construction, all 60+ command registrations, and
// the plugin lifecycle. Split out of `bin.ts` so the entry can stay a thin
// dispatcher — lightweight commands (notably `vis x`) skip importing this whole
// module graph (the dominant ~180ms of vis's cold-start). Only the heavy,
// orchestration path loads it, via a dynamic import in `bin.ts`.
import { createCerebro } from "@visulima/cerebro";
import completionCommand from "@visulima/cerebro/command/completion";
import versionCommand from "@visulima/cerebro/command/version";
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
import ciIgnoreCommand from "./commands/ci-ignore";
import cleanCommand from "./commands/clean";
import createCommand from "./commands/create";
import dashboardCommand from "./commands/dashboard";
import dedupeCommand from "./commands/dedupe";
import depsCommand from "./commands/deps";
import devcontainerCommand from "./commands/devcontainer";
import dlxCommand from "./commands/dlx";
import dockerCommands from "./commands/docker";
import doctorCommand from "./commands/doctor";
import execCommand from "./commands/exec";
import fmtCommand from "./commands/fmt";
import generateCommand from "./commands/generate";
import graphCommand from "./commands/graph";
import hookCommands from "./commands/hook";
import ignoreCommand from "./commands/ignore";
import implodeCommand from "./commands/implode";
import importCommand from "./commands/import";
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
import pmCommand from "./commands/pm";
import releaseCommands from "./commands/release";
import removeCommand from "./commands/remove";
import replayCommand from "./commands/replay";
import runCommand from "./commands/run";
import sbomCommand from "./commands/sbom";
import secretsCommand from "./commands/secrets";
import securityCommands from "./commands/security";
import serviceCommands from "./commands/service";
import sortPackageJsonCommand from "./commands/sort-package-json";
import splitCommand from "./commands/split";
import stagedCommand from "./commands/staged";
import statusCommand from "./commands/status";
import syncCommand from "./commands/sync";
import taskWhyCommand from "./commands/task-why";
import toolchainCommands from "./commands/toolchain";
import unlinkCommand from "./commands/unlink";
import updateCommand from "./commands/update";
import upgradeCommand from "./commands/upgrade";
import whyCommand from "./commands/why";
import xCommand from "./commands/x";
import { setTerminalTitle } from "./io/terminal";
import configLoaderPlugin from "./plugins/config-loader";
import postCommandPlugin from "./plugins/post-command";
import securityEnforcementPlugin from "./plugins/security-enforcement";
import { parseEarlyCaCert } from "./util/ca-cert";
import { startUpgradeCheck } from "./util/upgrade-check";

/**
 * Construct and run the full vis CLI. Invoked from `bin.ts` for every command
 * except the lean fast-paths (e.g. `vis x`). The universal early setup that
 * must run before ANY command (heap tuning, --no-color, version env, compile
 * cache) lives in `bin.ts`; the heavier, non-fast-path setup (CA cert, monorepo
 * root discovery, the background upgrade check) lives here.
 */

export const runCli = async (): Promise<void> => {
    // Honor --ca-cert before any TLS handshake fires. NODE_EXTRA_CA_CERTS is
    // read once on the first `tls.createSecureContext` call (lazy, not at
    // require time). A user-set NODE_EXTRA_CA_CERTS takes precedence.
    const earlyCaCert = parseEarlyCaCert(process.argv);

    if (earlyCaCert !== undefined && !process.env["NODE_EXTRA_CA_CERTS"]) {
        process.env["NODE_EXTRA_CA_CERTS"] = earlyCaCert;
    }

    // Set terminal title to the project name and stash the resolved root on an
    // env var so `config-loader.ts` doesn't walk the tree a second time.
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

    // Surfaced for `--help` and consumed by `resolveRuntime`.
    cli.addGlobalOption({
        description: "Target JS runtime: node (default) or bun. Overrides VIS_RUNTIME and config; falls back to lockfile detection.",
        name: "runtime",
        type: String,
    });

    cli.addGlobalOption({
        description: "Path to a vis config file (overrides discovery)",
        name: "config",
        type: String,
    });

    // Surfaced for `vis --help`; the env-var plumbing is applied in bin.ts.
    cli.addGlobalOption({
        description: "Path to a CA bundle (PEM) to trust for HTTPS — for corporate proxies. Equivalent to NODE_EXTRA_CA_CERTS.",
        name: "ca-cert",
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
    cli.addCommand(depsCommand);
    cli.addCommand(analyzeCommand);
    cli.addCommand(sortPackageJsonCommand);
    cli.addCommand(stagedCommand);
    cli.addCommand(statusCommand);
    cli.addCommand(dashboardCommand);
    cli.addCommand(syncCommand);
    cli.addCommand(listCommand);
    cli.addCommand(completionCommand);
    cli.addCommand(versionCommand);

    // Lint & format commands
    cli.addCommand(lintCommand);
    cli.addCommand(fmtCommand);

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
    cli.addCommand(xCommand);
    cli.addCommand(pmCommand);

    // Project & environment commands
    cli.addCommand(initCommand);
    cli.addCommand(cleanCommand);
    cli.addCommand(createCommand);
    cli.addCommand(generateCommand);
    cli.addCommand(devcontainerCommand);
    cli.addCommand(upgradeCommand);
    cli.addCommand(implodeCommand);

    // Workspace lifecycle commands
    cli.addCommand(splitCommand);
    cli.addCommand(importCommand);

    // Security commands
    cli.addCommand(approveBuildsCommand);
    cli.addCommand(auditCommand);
    cli.addCommand(inspectCommand);
    cli.addCommand(doctorCommand);
    cli.addCommand(optimizeCommand);
    cli.addCommand(sbomCommand);
    cli.addCommand(secretsCommand);

    // Nested commands — registered last so leaf-name collisions with flat
    // top-level commands don't trip the duplicate-name guard in cerebro.
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

    for (const command of dockerCommands) {
        cli.addCommand(command);
    }

    for (const command of toolchainCommands) {
        cli.addCommand(command);
    }

    cli.addCommand(ciIgnoreCommand);

    for (const command of releaseCommands) {
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

        return;
    }

    try {
        await cli.run({ shouldExitProcess: false });
    } catch {
        // errorHandlerPlugin already rendered the error
        process.exitCode = process.exitCode || 1;
    } finally {
        // Force an explicit exit once the command settles. Interactive commands
        // (the dynamic TUI run path) can leave stray refs that prevent the event
        // loop from draining; exit deliberately with the recorded exitCode.
        // eslint-disable-next-line unicorn/no-process-exit -- explicit exit is the reliable termination path for TUI commands
        process.exit(process.exitCode ?? 0);
    }
};
