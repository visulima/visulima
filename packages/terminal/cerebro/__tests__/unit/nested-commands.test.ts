import { describe, expect, it, vi } from "vitest";

import type { Toolbox } from "../../src";
import { Cerebro as Cli } from "../../src";

const DEPLOY_NOT_FOUND_RE = /deploy invalid.*not found/;

describe("nested commands", () => {
    it("should execute nested command with commandPath", async () => {
        expect.assertions(2);

        const deployStagingExecute = vi.fn().mockResolvedValue(undefined);

        const cli = new Cli("MyCLI", { argv: ["deploy", "staging"] });

        cli.addCommand({
            commandPath: ["deploy"],
            description: "Deploy to staging environment",
            execute: deployStagingExecute,
            name: "staging",
        });

        await cli.run({ shouldExitProcess: false });

        expect(deployStagingExecute).toHaveBeenCalledTimes(1);
        expect(deployStagingExecute).toHaveBeenCalledWith(expect.any(Object));
    });

    it("should support multi-level nested commands", async () => {
        expect.assertions(2);

        const databaseMigrateExecute = vi.fn().mockResolvedValue(undefined);

        const cli = new Cli("MyCLI", { argv: ["db", "migrate", "up"] });

        cli.addCommand({
            commandPath: ["db", "migrate"],
            description: "Run database migrations",
            execute: databaseMigrateExecute,
            name: "up",
        });

        await cli.run({ shouldExitProcess: false });

        expect(databaseMigrateExecute).toHaveBeenCalledTimes(1);
        expect(databaseMigrateExecute).toHaveBeenCalledWith(expect.any(Object));
    });

    it("should handle nested commands with options", async () => {
        expect.assertions(3);

        const deployProductionExecute = vi.fn().mockResolvedValue(undefined);

        const cli = new Cli("MyCLI", { argv: ["deploy", "production", "--dry-run"] });

        cli.addCommand({
            commandPath: ["deploy"],
            description: "Deploy to production environment",
            execute: deployProductionExecute,
            name: "production",
            options: [
                {
                    description: "Show what would be deployed without deploying",
                    name: "dry-run",
                    type: Boolean,
                },
            ],
        });

        await cli.run({ shouldExitProcess: false });

        expect(deployProductionExecute).toHaveBeenCalledTimes(1);

        // Options are processed and available in the toolbox
        const callArgs = deployProductionExecute.mock.calls[0][0] as Toolbox;

        expect(callArgs.options).toBeDefined();
        expect(callArgs.options["dry-run"] ?? callArgs.options.dryRun).toBe(true);
    });

    it("should allow flat and nested commands with same name", async () => {
        expect.assertions(4);

        const flatBuildExecute = vi.fn().mockResolvedValue("flat-build");
        const nestedBuildExecute = vi.fn().mockResolvedValue("nested-build");

        // Test flat command
        const cli1 = new Cli("MyCLI", { argv: ["build"] });

        cli1.addCommand({
            description: "Build the project",
            execute: flatBuildExecute,
            name: "build",
        });
        await cli1.run({ shouldExitProcess: false });

        // Test nested command
        const cli2 = new Cli("MyCLI", { argv: ["docker", "build"] });

        cli2.addCommand({
            commandPath: ["docker"],
            description: "Build Docker image",
            execute: nestedBuildExecute,
            name: "build",
        });
        await cli2.run({ shouldExitProcess: false });

        expect(flatBuildExecute).toHaveBeenCalledTimes(1);
        expect(nestedBuildExecute).toHaveBeenCalledTimes(1);
        await expect((flatBuildExecute.mock.results[0] as { value: Promise<string> }).value).resolves.toBe("flat-build");
        await expect((nestedBuildExecute.mock.results[0] as { value: Promise<string> }).value).resolves.toBe("nested-build");
    });

    it("should route a flat command correctly when registered before a nested namesake in the same Cli", async () => {
        expect.assertions(2);

        const flatInstallExecute = vi.fn().mockResolvedValue("flat");
        const hookInstallExecute = vi.fn().mockResolvedValue("hook");

        // Registering the flat command first then a nested one with the same leaf
        // name must not clobber the flat command's slot in the name-keyed lookup.
        const cli = new Cli("MyCLI", { argv: ["install"] });

        cli.addCommand({ description: "Install deps", execute: flatInstallExecute, name: "install" });
        cli.addCommand({ commandPath: ["hook"], description: "Install hooks", execute: hookInstallExecute, name: "install" });

        await cli.run({ shouldExitProcess: false });

        expect(flatInstallExecute).toHaveBeenCalledTimes(1);
        expect(hookInstallExecute).not.toHaveBeenCalled();
    });

    it("should allow registering a flat command after a nested one with the same leaf name", async () => {
        expect.assertions(4);

        const flatInstallExecute = vi.fn().mockResolvedValue("flat");
        const hookInstallExecute = vi.fn().mockResolvedValue("hook");

        const loggerMock = {
            debug: vi.fn(),
            error: vi.fn(),
            info: vi.fn(),
            log: vi.fn(),
            raw: vi.fn(),
            warn: vi.fn(),
        };

        // Order is intentional: nested first, then flat. Previously this either
        // threw a spurious DUPLICATE_COMMAND, or the flat command silently
        // evicted the nested entry from `#commands.values()` — invisible to
        // help listings even though `#commandsByPath` still held it.
        const cli = new Cli("MyCLI", { argv: ["help"], logger: loggerMock as unknown as Console });

        cli.addCommand({ commandPath: ["hook"], description: "Install hooks", execute: hookInstallExecute, name: "install" });

        expect(() => {
            cli.addCommand({ description: "Install dependencies", execute: flatInstallExecute, name: "install" });
        }).not.toThrow();

        await cli.run({ shouldExitProcess: false });

        const helpOutput = loggerMock.raw.mock.calls.flat().join("\n");

        // Both must still appear in the general help listing.
        expect(helpOutput).toContain("Install dependencies");
        expect(helpOutput).toContain("Install hooks");
        expect(loggerMock.error).not.toHaveBeenCalled();
    });

    it("should throw error for duplicate nested command paths", () => {
        expect.assertions(1);

        const cli = new Cli("MyCLI");

        cli.addCommand({
            commandPath: ["deploy"],
            execute: vi.fn(),
            name: "staging",
        });

        expect(() => {
            cli.addCommand({
                commandPath: ["deploy"],
                execute: vi.fn(),
                name: "staging",
            });
        }).toThrow("Command with path \"deploy staging\" already exists");
    });

    it("should support runCommand with nested command paths", async () => {
        expect.assertions(2);

        const deployStagingExecute = vi.fn().mockResolvedValue("staging-deployed");
        const deployExecute = vi.fn().mockImplementation(async ({ runtime }: Toolbox) => {
            const result = await runtime.runCommand("deploy staging");

            return result;
        });

        const cli = new Cli("MyCLI", { argv: ["deploy-all"] });

        cli.addCommand({
            commandPath: ["deploy"],
            execute: deployStagingExecute,
            name: "staging",
        });

        cli.addCommand({
            execute: deployExecute,
            name: "deploy-all",
        });

        await cli.run({ shouldExitProcess: false });

        expect(deployExecute).toHaveBeenCalledTimes(1);
        expect(deployStagingExecute).toHaveBeenCalledTimes(1);
    });

    it("should display nested commands in help output", async () => {
        expect.assertions(2);

        const loggerMock = {
            debug: vi.fn(),
            error: vi.fn(),
            info: vi.fn(),
            log: vi.fn(),
            raw: vi.fn(),
            warn: vi.fn(),
        };

        const cli = new Cli("MyCLI", { argv: ["help"], logger: loggerMock as unknown as Console });

        cli.addCommand({
            commandPath: ["deploy"],
            description: "Deploy to staging",
            execute: vi.fn(),
            name: "staging",
        });

        cli.addCommand({
            commandPath: ["deploy"],
            description: "Deploy to production",
            execute: vi.fn(),
            name: "production",
        });

        await cli.run({ shouldExitProcess: false });

        // Help should display nested commands with their full path
        const helpOutput = loggerMock.raw.mock.calls.flat().join("\n");

        expect(helpOutput).toContain("deploy staging");
        expect(helpOutput).toContain("deploy production");
    });

    it("should throw CommandNotFoundError for invalid nested command path", async () => {
        expect.assertions(1);

        const cli = new Cli("MyCLI", { argv: ["deploy", "invalid"] });

        cli.addCommand({
            commandPath: ["deploy"],
            execute: vi.fn(),
            name: "staging",
        });

        await expect(cli.run({ shouldExitProcess: false })).rejects.toThrow(DEPLOY_NOT_FOUND_RE);
    });

    it("should validate commandPath segments", () => {
        expect.assertions(1);

        const cli = new Cli("MyCLI");

        expect(() => {
            cli.addCommand({
                commandPath: ["-invalid"], // Starts with hyphen, should fail validation
                execute: vi.fn(),
                name: "test",
            });
        }).toThrow("Command name \"-invalid\" must start with a letter");
    });

    it("should dispatch to a top-level parent command without shadowing its children", async () => {
        expect.assertions(2);

        const aiRootExecute = vi.fn().mockResolvedValue(undefined);
        const aiProvidersExecute = vi.fn().mockResolvedValue(undefined);

        const cli = new Cli("MyCLI", { argv: ["ai"] });

        cli.addCommand({
            description: "AI commands",
            execute: aiRootExecute,
            name: "ai",
        });

        cli.addCommand({
            commandPath: ["ai"],
            description: "List AI providers",
            execute: aiProvidersExecute,
            name: "providers",
        });

        await cli.run({ shouldExitProcess: false });

        expect(aiRootExecute).toHaveBeenCalledTimes(1);
        expect(aiProvidersExecute).not.toHaveBeenCalled();
    });

    it("should dispatch to a nested child even when a top-level parent is registered", async () => {
        expect.assertions(2);

        const aiRootExecute = vi.fn().mockResolvedValue(undefined);
        const aiProvidersExecute = vi.fn().mockResolvedValue(undefined);

        const cli = new Cli("MyCLI", { argv: ["ai", "providers"] });

        cli.addCommand({
            description: "AI commands",
            execute: aiRootExecute,
            name: "ai",
        });

        cli.addCommand({
            commandPath: ["ai"],
            description: "List AI providers",
            execute: aiProvidersExecute,
            name: "providers",
        });

        await cli.run({ shouldExitProcess: false });

        expect(aiProvidersExecute).toHaveBeenCalledTimes(1);
        expect(aiRootExecute).not.toHaveBeenCalled();
    });

    it("should pass options to a top-level parent when no child segment follows", async () => {
        expect.assertions(2);

        const aiRootExecute = vi.fn().mockResolvedValue(undefined);

        const cli = new Cli("MyCLI", { argv: ["ai", "--format=json"] });

        cli.addCommand({
            description: "AI commands",
            execute: aiRootExecute,
            name: "ai",
            options: [
                {
                    description: "Output format",
                    name: "format",
                    type: String,
                },
            ],
        });

        cli.addCommand({
            commandPath: ["ai"],
            description: "List AI providers",
            execute: vi.fn(),
            name: "providers",
        });

        await cli.run({ shouldExitProcess: false });

        expect(aiRootExecute).toHaveBeenCalledTimes(1);

        const callArgs = aiRootExecute.mock.calls[0][0] as Toolbox;

        expect(callArgs.options.format).toBe("json");
    });

    it("should resolve a 3-level child when parent and intermediate are also registered", async () => {
        expect.assertions(3);

        const databaseRootExecute = vi.fn().mockResolvedValue(undefined);
        const databaseMigrateExecute = vi.fn().mockResolvedValue(undefined);
        const databaseMigrateUpExecute = vi.fn().mockResolvedValue(undefined);

        const cli = new Cli("MyCLI", { argv: ["db", "migrate", "up"] });

        cli.addCommand({
            description: "Database commands",
            execute: databaseRootExecute,
            name: "db",
        });

        cli.addCommand({
            commandPath: ["db"],
            description: "Migration commands",
            execute: databaseMigrateExecute,
            name: "migrate",
        });

        cli.addCommand({
            commandPath: ["db", "migrate"],
            description: "Run pending migrations",
            execute: databaseMigrateUpExecute,
            name: "up",
        });

        await cli.run({ shouldExitProcess: false });

        expect(databaseMigrateUpExecute).toHaveBeenCalledTimes(1);
        expect(databaseMigrateExecute).not.toHaveBeenCalled();
        expect(databaseRootExecute).not.toHaveBeenCalled();
    });

    it("should display the Subcommands section in help for a parent command with children", async () => {
        expect.assertions(2);

        const loggerMock = {
            debug: vi.fn(),
            error: vi.fn(),
            info: vi.fn(),
            log: vi.fn(),
            raw: vi.fn(),
            warn: vi.fn(),
        };

        const cli = new Cli("MyCLI", { argv: ["ai", "--help"], logger: loggerMock as unknown as Console });

        cli.addCommand({
            description: "AI commands",
            execute: vi.fn(),
            name: "ai",
        });

        cli.addCommand({
            commandPath: ["ai"],
            description: "List AI providers",
            execute: vi.fn(),
            name: "providers",
        });

        cli.addCommand({
            commandPath: ["ai"],
            description: "Test the selected provider",
            execute: vi.fn(),
            name: "test",
        });

        await cli.run({ shouldExitProcess: false });

        const helpOutput = loggerMock.raw.mock.calls.flat().join("\n");

        expect(helpOutput).toContain("ai providers");
        expect(helpOutput).toContain("ai test");
    });

    it("should print command-specific help when invoking `help <name>` with a positional", async () => {
        expect.assertions(2);

        const loggerMock = {
            debug: vi.fn(),
            error: vi.fn(),
            info: vi.fn(),
            log: vi.fn(),
            raw: vi.fn(),
            warn: vi.fn(),
        };

        const cli = new Cli("MyCLI", { argv: ["help", "install"], logger: loggerMock as unknown as Console });

        cli.addCommand({ description: "Install dependencies", execute: vi.fn(), name: "install" });
        cli.addCommand({ commandPath: ["hook"], description: "Install hooks", execute: vi.fn(), name: "install" });

        await cli.run({ shouldExitProcess: false });

        const helpOutput = loggerMock.raw.mock.calls.flat().join("\n");

        expect(helpOutput).toContain("Install dependencies");
        expect(loggerMock.error).not.toHaveBeenCalled();
    });

    it("should print help for a nested command when invoking `help <parent> <child>`", async () => {
        expect.assertions(2);

        const loggerMock = {
            debug: vi.fn(),
            error: vi.fn(),
            info: vi.fn(),
            log: vi.fn(),
            raw: vi.fn(),
            warn: vi.fn(),
        };

        const cli = new Cli("MyCLI", { argv: ["help", "hook", "install"], logger: loggerMock as unknown as Console });

        cli.addCommand({ description: "Install dependencies", execute: vi.fn(), name: "install" });
        cli.addCommand({ commandPath: ["hook"], description: "Install hooks for the workspace", execute: vi.fn(), name: "install" });

        await cli.run({ shouldExitProcess: false });

        const helpOutput = loggerMock.raw.mock.calls.flat().join("\n");

        expect(helpOutput).toContain("Install hooks for the workspace");
        expect(loggerMock.error).not.toHaveBeenCalled();
    });
});
