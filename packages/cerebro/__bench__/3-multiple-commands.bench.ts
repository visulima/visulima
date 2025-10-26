// packages/cerebro/__bench__/3-multiple-commands.bench.ts
import { Cerebro } from "@visulima/cerebro";
import { cac } from "cac";
import { cli as cleye, command as cleyeCommand } from "cleye";
import { Command } from "commander";
import { bench, describe } from "vitest";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

describe("3. Multiple Command Registration (Realistic CLI)", () => {
    bench("Cerebro - Register 5 commands", () => {
        const cli = new Cerebro("test-cli");

        const commands = ["build", "test", "deploy", "clean", "init"];

        commands.forEach((cmdName) => {
            cli.addCommand({
                description: `${cmdName} command`,
                execute: () => {
                    // Empty execute function
                },
                name: cmdName,
                options: [
                    { description: "Verbose output", name: "verbose", type: Boolean },
                    { description: "Config file", name: "config", type: String },
                ],
            });
        });

        cli.dispose();
    });

    bench("Commander - Register 5 commands", () => {
        const program = new Command();

        program.name("test-cli");

        const commands = ["build", "test", "deploy", "clean", "init"];

        commands.forEach((cmdName) => {
            program
                .command(cmdName)
                .description(`${cmdName} command`)
                .option("-v, --verbose", "Verbose output")
                .option("-c, --config <file>", "Config file")
                .action(() => {
                    // Empty action
                });
        });
    });

    bench("Yargs - Register 5 commands", () => {
        let parser = yargs(hideBin(["node", "script.js"])).scriptName("test-cli");

        const commands = ["build", "test", "deploy", "clean", "init"];

        commands.forEach((cmdName) => {
            parser = parser.command(cmdName, `${cmdName} command`, (yargsBuilder) =>
                yargsBuilder
                    .option("verbose", {
                        alias: "v",
                        description: "Verbose output",
                        type: "boolean",
                    })
                    .option("config", {
                        alias: "c",
                        description: "Config file",
                        type: "string",
                    }));
        });
    });

    bench("CAC - Register 5 commands", () => {
        const cli = cac("test-cli");

        const commands = ["build", "test", "deploy", "clean", "init"];

        commands.forEach((cmdName) => {
            cli.command(cmdName, `${cmdName} command`)
                .option("-v, --verbose", "Verbose output")
                .option("-c, --config <file>", "Config file")
                .action(() => {
                    // Empty action
                });
        });
    });

    bench("Cleye - Register 5 commands", () => {
        const commands = ["build", "test", "deploy", "clean", "init"];
        const cleyeCommands = commands.map((cmdName) =>
            cleyeCommand({
                flags: {
                    config: String,
                    verbose: Boolean,
                },
                name: cmdName,
            }),
        );

        cleye({
            commands: cleyeCommands,
            name: "test-cli",
        });
    });
});
