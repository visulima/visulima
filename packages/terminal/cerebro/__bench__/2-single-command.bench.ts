import { Cerebro } from "@visulima/cerebro";
import { cac } from "cac";
import { cli as cleye } from "cleye";
import { Command } from "commander";
import meow from "meow";
import { bench, describe } from "vitest";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

describe("2. Single Command Registration", () => {
    bench("Cerebro - Register command with 3 options", () => {
        const cli = new Cerebro("test-cli");

        cli.addCommand({
            description: "Build the project",
            execute: () => {
                // Empty execute function
            },
            name: "build",
            options: [
                { description: "Enable verbose output", name: "verbose", type: Boolean },
                { description: "Output directory", name: "output", type: String },
                { description: "Number of workers", name: "workers", type: Number },
            ],
        });

        cli.dispose();
    });

    bench("Commander - Register command with 3 options", () => {
        const program = new Command();

        program
            .name("test-cli")
            .command("build")
            .description("Build the project")
            .option("-v, --verbose", "Enable verbose output")
            .option("-o, --output <dir>", "Output directory")
            .option("-w, --workers <number>", "Number of workers")
            .action(() => {
                // Empty action
            });
    });

    bench("Yargs - Register command with 3 options", () => {
        yargs(hideBin(["node", "script.js"]))
            .scriptName("test-cli")
            .command("build", "Build the project", (yargsBuilder) =>
                yargsBuilder
                    .option("verbose", {
                        alias: "v",
                        description: "Enable verbose output",
                        type: "boolean",
                    })
                    .option("output", {
                        alias: "o",
                        description: "Output directory",
                        type: "string",
                    })
                    .option("workers", {
                        alias: "w",
                        description: "Number of workers",
                        type: "number",
                    }));
    });

    bench("Meow - Define flags for command", () => {
        meow("Build the project", {
            flags: {
                output: {
                    shortFlag: "o",
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
    });

    bench("CAC - Register command with 3 options", () => {
        const cli = cac("test-cli");

        cli.command("build", "Build the project")
            .option("-v, --verbose", "Enable verbose output")
            .option("-o, --output <dir>", "Output directory")
            .option("-w, --workers <number>", "Number of workers")
            .action(() => {
                // Empty action
            });
    });

    bench("Cleye - Define flags (no command)", () => {
        cleye({
            flags: {
                output: {
                    description: "Output directory",
                    type: String,
                },
                verbose: {
                    description: "Enable verbose output",
                    type: Boolean,
                },
                workers: {
                    description: "Number of workers",
                    type: Number,
                },
            },
            name: "test-cli",
        });
    });
});
