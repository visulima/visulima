// Command registration for the full `vis` CLI, split out of `cli-main.ts` so
// tests can construct the exact command set the binary ships without running
// the CLI (workspace discovery, plugins, upgrade check).
import type { Cli } from "@visulima/cerebro";
import completionCommand from "@visulima/cerebro/command/completion";
import versionCommand from "@visulima/cerebro/command/version";

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
import shimCommands from "./commands/shim";
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

/**
 * Register every `vis` command on a cerebro instance, in the order the CLI
 * depends on.
 */
const registerCommands = (cli: Cli<Console>): void => {
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

    for (const command of shimCommands) {
        cli.addCommand(command);
    }

    cli.addCommand(ciIgnoreCommand);

    for (const command of releaseCommands) {
        cli.addCommand(command);
    }
};

export default registerCommands;
