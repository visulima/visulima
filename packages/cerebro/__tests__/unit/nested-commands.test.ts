import { describe, expect, it, vi } from "vitest";

import { Cerebro as Cli } from "../../src";

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
        const callArgs = deployProductionExecute.mock.calls[0]?.[0];

        expect(callArgs?.options).toBeDefined();
        expect(callArgs?.options?.["dry-run"] || callArgs?.options?.dryRun).toBe(true);
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
        await expect(flatBuildExecute.mock.results[0]?.value).resolves.toBe("flat-build");
        await expect(nestedBuildExecute.mock.results[0]?.value).resolves.toBe("nested-build");
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
        const deployExecute = vi.fn().mockImplementation(async ({ runtime }) => {
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
            raw: vi.fn(),
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

        await expect(cli.run({ shouldExitProcess: false })).rejects.toThrow(/deploy invalid.*not found/);
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
});
