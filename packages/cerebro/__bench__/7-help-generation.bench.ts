// packages/cerebro/__bench__/7-help-generation.bench.ts
import { Cerebro } from "@visulima/cerebro";
import { cac } from "cac";
import { cli as cleye } from "cleye";
import { Command } from "commander";
import meow from "meow";
import { bench, describe } from "vitest";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { helpArgs, suppressOutput } from "./shared";

describe("7. Help Text Generation", () => {
    bench("Cerebro - Generate help", async () => {
        const cli = new Cerebro("test-cli");

        cli.addCommand({
            description: "Test command with detailed help",
            execute: () => {
                // Empty execute function
            },
            name: "test",
            options: [
                { description: "Enable verbose output for debugging", name: "verbose", type: Boolean },
                { description: "Specify configuration file path", name: "config", type: String },
                { description: "Set number of parallel workers (1-10)", name: "workers", type: Number },
            ],
        });

        await cli.run({ argv: helpArgs, shouldExitProcess: false });
    });

    bench("Commander - Generate help", () => {
        suppressOutput(() => {
            const program = new Command();

            program
                .name("test-cli")
                .description("Test CLI application")
                .command("test")
                .description("Test command with detailed help")
                .option("-v, --verbose", "Enable verbose output for debugging")
                .option("-c, --config <file>", "Specify configuration file path")
                .option("-w, --workers <number>", "Set number of parallel workers (1-10)")
                .action(() => {
                    // Empty action
                });

            try {
                program.parse(helpArgs);
            } catch {
                // Ignore errors
            }
        });
    });

    bench("Yargs - Generate help", async () => {
        await suppressOutput(async () => {
            const parser = yargs(hideBin(["node", "script.js"]))
                .scriptName("test-cli")
                .usage("Test CLI application")
                .command("test", "Test command with detailed help", (yargsBuilder) =>
                    yargsBuilder
                        .option("verbose", {
                            alias: "v",
                            description: "Enable verbose output for debugging",
                            type: "boolean",
                        })
                        .option("config", {
                            alias: "c",
                            description: "Specify configuration file path",
                            type: "string",
                        })
                        .option("workers", {
                            alias: "w",
                            description: "Set number of parallel workers (1-10)",
                            type: "number",
                        }))
                .help();

            try {
                await parser.parseAsync(helpArgs.slice(2));
            } catch {
                // Ignore errors
            }
        });
    });

    bench("Meow - Generate help", () => {
        suppressOutput(() => {
            try {
                meow("Test command with detailed help", {
                    argv: helpArgs.slice(2),
                    flags: {
                        config: {
                            shortFlag: "c",
                            type: "string",
                        },
                        verbose: {
                            shortFlag: "v",
                            type: "boolean",
                        },
                        workers: {
                            shortFlag: "w",
                            type: "number",
                        },
                    },
                    importMeta: import.meta,
                });
            } catch {
                // Ignore errors
            }
        });
    });

    bench("CAC - Generate help", () => {
        suppressOutput(() => {
            const cli = cac("test-cli");

            cli.command("test", "Test command with detailed help")
                .option("-v, --verbose", "Enable verbose output for debugging")
                .option("-c, --config <file>", "Specify configuration file path")
                .option("-w, --workers <number>", "Set number of parallel workers (1-10)")
                .action(() => {
                    // Empty action
                });

            cli.help();

            try {
                cli.parse(helpArgs, { run: false });
            } catch {
                // Ignore errors
            }
        });
    });

    bench("Cleye - Generate help", () => {
        suppressOutput(() => {
            try {
                cleye(
                    {
                        flags: {
                            config: {
                                description: "Specify configuration file path",
                                type: String,
                            },
                            verbose: {
                                description: "Enable verbose output for debugging",
                                type: Boolean,
                            },
                            workers: {
                                description: "Set number of parallel workers (1-10)",
                                type: Number,
                            },
                        },
                        name: "test-cli",
                    },
                    () => {
                        // Empty callback
                    },
                    helpArgs.slice(2),
                );
            } catch {
                // Ignore errors
            }
        });
    });
});
