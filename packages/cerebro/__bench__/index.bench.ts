import { Command as OclifCommand } from "@oclif/core";
import { Command } from "commander";
import { cli } from "gunshi";
import { bench, describe } from "vitest";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { Cerebro } from "../src";

// Benchmark scenarios
const simpleArgs = ["node", "script.js", "test", "--verbose", "--count", "5", "--name", "test"];
const helpArgs = ["node", "script.js", "--help"];
const versionArgs = ["node", "script.js", "--version"];

describe("Cerebro CLI Framework Benchmark", () => {
    describe("CLI Initialization", () => {
        bench("Cerebro - Basic CLI setup", () => {
            const cli = new Cerebro("test-cli");
            // Just measure initialization time
        });

        bench("Commander - Basic CLI setup", () => {
            const program = new Command();

            program.name("test-cli").description("Test CLI");
        });

        bench("Yargs - Basic CLI setup", () => {
            const argv = yargs(hideBin(["node", "script.js"]))
                .scriptName("test-cli")
                .usage("Test CLI");
        });

        bench("Oclif - Basic CLI setup", () => {
            class TestCommand extends OclifCommand {
                async run() {
                    // Empty run method
                }
            }
            TestCommand.description = "Test CLI";
        });

        bench("Gunshi - Basic CLI setup", () => {
            const command = {
                description: "Test CLI",
                name: "test",
                run: () => {
                    // Empty run method
                },
            };
        });
    });

    describe("Command Registration", () => {
        bench("Cerebro - Register single command", () => {
            const cli = new Cerebro("test-cli");

            cli.addCommand({
                description: "A test command",
                execute: () => {
                    // Empty execute function
                },
                name: "test",
                options: [
                    { description: "Enable verbose output", name: "verbose", type: Boolean },
                    { description: "Count value", name: "count", type: Number },
                    { description: "Name value", name: "name", type: String },
                ],
            });
        });

        bench("Commander - Register single command", () => {
            const program = new Command();

            program
                .name("test-cli")
                .command("test")
                .description("A test command")
                .option("-v, --verbose", "Enable verbose output")
                .option("-c, --count <number>", "Count value")
                .option("-n, --name <string>", "Name value")
                .action(() => {
                    // Empty action
                });
        });

        bench("Yargs - Register single command", () => {
            const argv = yargs(hideBin(["node", "script.js"]))
                .scriptName("test-cli")
                .command("test", "A test command", (yargs) => yargs
                    .option("verbose", {
                        alias: "v",
                        description: "Enable verbose output",
                        type: "boolean",
                    })
                    .option("count", {
                        alias: "c",
                        description: "Count value",
                        type: "number",
                    })
                    .option("name", {
                        alias: "n",
                        description: "Name value",
                        type: "string",
                    }));
        });

        bench("Oclif - Register single command", () => {
            // Measure the time to define a command structure similar to Oclif
            const description = "A test command";
            const flags = {
                count: { char: "c", description: "Count value", type: "integer" },
                name: { char: "n", description: "Name value", type: "string" },
                verbose: { char: "v", description: "Enable verbose output", type: "boolean" },
            };

            // Simulate Oclif's flag processing
            const processedFlags = Object.entries(flags).map(([key, config]) => {
                return {
                    name: key,
                    ...config,
                };
            });

            return { description, flags: processedFlags };
        });

        bench("Gunshi - Register single command", () => {
            const command = {
                args: {
                    count: {
                        description: "Count value",
                        short: "c",
                        type: "number",
                    },
                    name: {
                        description: "Name value",
                        short: "n",
                        type: "string",
                    },
                    verbose: {
                        description: "Enable verbose output",
                        short: "v",
                        type: "boolean",
                    },
                },
                description: "A test command",
                name: "test",
                run: () => {
                    // Empty run method
                },
            };
        });
    });

    describe("Command Parsing Performance", () => {
        // Cerebro setup
        const cerebroCli = new Cerebro("test-cli");

        cerebroCli.addCommand({
            description: "A test command",
            execute: () => {
                // Empty execute function
            },
            name: "test",
            options: [
                { description: "Enable verbose output", name: "verbose", type: Boolean },
                { description: "Count value", name: "count", type: Number },
                { description: "Name value", name: "name", type: String },
            ],
        });

        // Commander setup
        const commanderProgram = new Command();

        commanderProgram
            .name("test-cli")
            .command("test")
            .description("A test command")
            .option("-v, --verbose", "Enable verbose output")
            .option("-c, --count <number>", "Count value")
            .option("-n, --name <string>", "Name value")
            .action(() => {
                // Empty action
            });

        // Yargs setup
        const yargsInstance = yargs(hideBin(["node", "script.js"]))
            .scriptName("test-cli")
            .command("test", "A test command", (yargs) => yargs
                .option("verbose", {
                    alias: "v",
                    description: "Enable verbose output",
                    type: "boolean",
                })
                .option("count", {
                    alias: "c",
                    description: "Count value",
                    type: "number",
                })
                .option("name", {
                    alias: "n",
                    description: "Name value",
                    type: "string",
                }));

        bench("Cerebro - Parse simple args", async () => {
            try {
                await cerebroCli.run({ argv: simpleArgs, shouldExitProcess: false });
            } catch {
                // Ignore errors for benchmarking
            }
        });

        bench("Commander - Parse simple args", () => {
            try {
                commanderProgram.parse(simpleArgs);
            } catch {
                // Ignore errors for benchmarking
            }
        });

        bench("Yargs - Parse simple args", async () => {
            try {
                await yargsInstance.parseAsync(simpleArgs);
            } catch {
                // Ignore errors for benchmarking
            }
        });

        bench("Gunshi - Parse simple args", async () => {
            const command = {
                args: {
                    count: {
                        description: "Count value",
                        short: "c",
                        type: "number",
                    },
                    name: {
                        description: "Name value",
                        short: "n",
                        type: "string",
                    },
                    verbose: {
                        description: "Enable verbose output",
                        short: "v",
                        type: "boolean",
                    },
                },
                description: "A test command",
                name: "test",
                run: () => {
                    // Empty run method
                },
            };

            try {
                await cli(simpleArgs.slice(2), command, {
                    name: "test-cli",
                    version: "1.0.0",
                });
            } catch {
                // Parsing might fail, ignore for benchmarking
            }
        });
    });

    describe("Help Generation", () => {
        // Cerebro setup with help
        const cerebroCliWithHelp = new Cerebro("test-cli");

        cerebroCliWithHelp.addCommand({
            description: "A test command",
            execute: () => {
                // Empty execute function
            },
            name: "test",
            options: [
                { description: "Enable verbose output", name: "verbose", type: Boolean },
                { description: "Count value", name: "count", type: Number },
                { description: "Name value", name: "name", type: String },
            ],
        });

        // Commander setup with help
        const commanderProgramWithHelp = new Command();

        commanderProgramWithHelp
            .name("test-cli")
            .description("Test CLI")
            .command("test")
            .description("A test command")
            .option("-v, --verbose", "Enable verbose output")
            .option("-c, --count <number>", "Count value")
            .option("-n, --name <string>", "Name value")
            .action(() => {
                // Empty action
            });

        // Yargs setup with help
        const yargsInstanceWithHelp = yargs(hideBin(["node", "script.js"]))
            .scriptName("test-cli")
            .usage("Test CLI")
            .command("test", "A test command", (yargs) => yargs
                .option("verbose", {
                    alias: "v",
                    description: "Enable verbose output",
                    type: "boolean",
                })
                .option("count", {
                    alias: "c",
                    description: "Count value",
                    type: "number",
                })
                .option("name", {
                    alias: "n",
                    description: "Name value",
                    type: "string",
                }))
            .help();

        bench("Cerebro - Generate help output", async () => {
            try {
                await cerebroCliWithHelp.run({ argv: helpArgs, shouldExitProcess: false });
            } catch {
                // Help command typically exits, ignore for benchmarking
            }
        });

        bench("Commander - Generate help output", () => {
            try {
                commanderProgramWithHelp.parse(helpArgs);
            } catch {
                // Help command typically exits, ignore for benchmarking
            }
        });

        bench("Yargs - Generate help output", async () => {
            try {
                await yargsInstanceWithHelp.parseAsync(helpArgs);
            } catch {
                // Help command typically exits, ignore for benchmarking
            }
        });

        bench("Gunshi - Generate help output", async () => {
            const command = {
                args: {
                    count: {
                        description: "Count value",
                        short: "c",
                        type: "number",
                    },
                    name: {
                        description: "Name value",
                        short: "n",
                        type: "string",
                    },
                    verbose: {
                        description: "Enable verbose output",
                        short: "v",
                        type: "boolean",
                    },
                },
                description: "A test command",
                name: "test",
                run: () => {
                    // Empty run method
                },
            };

            try {
                await cli(helpArgs.slice(2), command, {
                    name: "test-cli",
                    version: "1.0.0",
                });
            } catch {
                // Help command typically exits, ignore for benchmarking
            }
        });
    });

    describe("Version Display", () => {
        // Cerebro setup with version
        const cerebroCliWithVersion = new Cerebro("test-cli", { packageVersion: "1.0.0" });

        // Commander setup with version
        const commanderProgramWithVersion = new Command();

        commanderProgramWithVersion.name("test-cli").version("1.0.0");

        // Yargs setup with version
        const yargsInstanceWithVersion = yargs(hideBin(["node", "script.js"]))
            .scriptName("test-cli")
            .version("1.0.0");

        bench("Cerebro - Display version", async () => {
            try {
                await cerebroCliWithVersion.run({ argv: versionArgs, shouldExitProcess: false });
            } catch {
                // Version command typically exits, ignore for benchmarking
            }
        });

        bench("Commander - Display version", () => {
            try {
                commanderProgramWithVersion.parse(versionArgs);
            } catch {
                // Version command typically exits, ignore for benchmarking
            }
        });

        bench("Yargs - Display version", async () => {
            try {
                await yargsInstanceWithVersion.parseAsync(versionArgs);
            } catch {
                // Version command typically exits, ignore for benchmarking
            }
        });

        bench("Gunshi - Display version", async () => {
            const command = {
                description: "A test command",
                name: "test",
                run: () => {
                    // Empty run method
                },
            };

            try {
                await cli(versionArgs.slice(2), command, {
                    name: "test-cli",
                    version: "1.0.0",
                });
            } catch {
                // Version command typically exits, ignore for benchmarking
            }
        });
    });
});
