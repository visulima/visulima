import type { Command } from "@visulima/cerebro";
import { describe, expect, it } from "vitest";

import actionGraphCommand from "../../src/commands/action-graph";
import addCommand from "../../src/commands/add";
import affectedCommand from "../../src/commands/affected";
import aiCommands from "../../src/commands/ai";
import analyzeCommand from "../../src/commands/analyze";
import approveBuildsCommand from "../../src/commands/approve-builds";
import auditCommand from "../../src/commands/audit";
import cacheCommands from "../../src/commands/cache";
import checkCommand from "../../src/commands/check";
import ciCommand from "../../src/commands/ci";
import cleanCommand from "../../src/commands/clean";
import createCommand from "../../src/commands/create";
import dedupeCommand from "../../src/commands/dedupe";
import devcontainerCommand from "../../src/commands/devcontainer";
import dlxCommand from "../../src/commands/dlx";
import dockerCommand from "../../src/commands/docker";
import doctorCommand from "../../src/commands/doctor";
import execCommand from "../../src/commands/exec";
import generateCommand from "../../src/commands/generate";
import graphCommand from "../../src/commands/graph";
import hookCommands from "../../src/commands/hook";
import ignoreCommand from "../../src/commands/ignore";
import implodeCommand from "../../src/commands/implode";
import infoCommand from "../../src/commands/info";
import initCommand from "../../src/commands/init";
import installCommand from "../../src/commands/install";
import linkCommand from "../../src/commands/link";
import listCommand from "../../src/commands/list";
import migrateCommands from "../../src/commands/migrate";
import optimizeCommand from "../../src/commands/optimize";
import pmCommand from "../../src/commands/pm";
import removeCommand from "../../src/commands/remove";
import runCommand from "../../src/commands/run";
import sbomCommand from "../../src/commands/sbom";
import secretsCommand from "../../src/commands/secrets";
import sortPackageJsonCommand from "../../src/commands/sort-package-json";
import stagedCommand from "../../src/commands/staged";
import statusCommand from "../../src/commands/status";
import syncCommand from "../../src/commands/sync";
import taskWhyCommand from "../../src/commands/task-why";
import toolchainCommand from "../../src/commands/toolchain";
import unlinkCommand from "../../src/commands/unlink";
import updateCommand from "../../src/commands/update";
import upgradeCommand from "../../src/commands/upgrade";
import whyCommand from "../../src/commands/why";

const FLAT_COMMANDS: Command[] = [
    actionGraphCommand,
    addCommand,
    affectedCommand,
    analyzeCommand,
    approveBuildsCommand,
    auditCommand,
    checkCommand,
    ciCommand,
    cleanCommand,
    createCommand,
    dedupeCommand,
    devcontainerCommand,
    dlxCommand,
    dockerCommand,
    doctorCommand,
    execCommand,
    generateCommand,
    graphCommand,
    ignoreCommand,
    implodeCommand,
    infoCommand,
    initCommand,
    installCommand,
    linkCommand,
    listCommand,
    optimizeCommand,
    pmCommand,
    removeCommand,
    runCommand,
    sbomCommand,
    secretsCommand,
    sortPackageJsonCommand,
    stagedCommand,
    statusCommand,
    syncCommand,
    taskWhyCommand,
    toolchainCommand,
    unlinkCommand,
    updateCommand,
    upgradeCommand,
    whyCommand,
];

const ALL_COMMANDS: Command[] = [...FLAT_COMMANDS, ...aiCommands, ...cacheCommands, ...hookCommands, ...migrateCommands];

describe("vis lazy command contract", () => {
    it.each(ALL_COMMANDS.map((c) => [c.name, c]))("%s declares loader, not execute", (_name, command) => {
        expect.assertions(2);

        expect(command.execute).toBeUndefined();
        expect(command.loader).toBeTypeOf("function");
    });

    it.each(ALL_COMMANDS.map((c) => [c.name, c]))(
        "%s loader resolves to a default-exported function",
        async (_name, command) => {
            expect.assertions(1);

            const loaded = await command.loader!();

            expect(loaded.default).toBeTypeOf("function");
        },
        30_000,
    );
});
