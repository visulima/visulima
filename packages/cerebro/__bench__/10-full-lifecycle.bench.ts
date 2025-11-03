import { Cerebro } from "@visulima/cerebro";
import { cac } from "cac";
import { cli as cleye } from "cleye";
import { Command } from "commander";
import { cli } from "gunshi";
import meow from "meow";
import { bench, describe } from "vitest";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { simpleCommand } from "./shared";

describe("10. Full Lifecycle (Init + Register + Parse)", () => {
    bench("Cerebro - Complete flow", async () => {
        const cerebroCli = new Cerebro("test-cli");

        cerebroCli.addCommand({
            description: "Build command",
            execute: () => {
                // Empty execute function
            },
            name: "build",
            options: [
                { description: "Verbose output", name: "verbose", type: Boolean },
                { description: "Output directory", name: "output", type: String },
            ],
        });

        await cerebroCli.run({ argv: simpleCommand, shouldExitProcess: false });
    });

    bench("Commander - Complete flow", () => {
        const program = new Command();

        program
            .name("test-cli")
            .command("build")
            .option("-v, --verbose", "Verbose output")
            .option("-o, --output <dir>", "Output directory")
            .action(() => {
                // Empty action
            });

        program.parse(simpleCommand);
    });

    bench("Yargs - Complete flow", async () => {
        const parser = yargs(hideBin(["node", "script.js"]))
            .scriptName("test-cli")
            .command("build", "Build command", (yargsBuilder) =>
                yargsBuilder.option("verbose", { alias: "v", type: "boolean" }).option("output", { alias: "o", type: "string" }));

        await parser.parseAsync(simpleCommand.slice(2));
    });

    bench("Meow - Complete flow", () => {
        meow("Build command", {
            argv: simpleCommand.slice(2),
            flags: {
                output: { shortFlag: "o", type: "string" },
                verbose: { shortFlag: "v", type: "boolean" },
            },
            importMeta: import.meta,
        });
    });

    bench("Gunshi - Complete flow", async () => {
        const command = {
            args: {
                output: {
                    description: "Output directory",
                    short: "o",
                    type: "string" as const,
                },
                verbose: {
                    description: "Verbose output",
                    short: "v",
                    type: "boolean" as const,
                },
            },
            description: "Build command",
            name: "build",
            run: () => {
                // Empty run method
            },
        };

        await cli(simpleCommand.slice(2), command, {
            name: "test-cli",
            version: "1.0.0",
        });
    });

    bench("CAC - Complete flow", () => {
        const cacCli = cac("test-cli");

        cacCli
            .command("build", "Build command")
            .option("-v, --verbose", "Verbose output")
            .option("-o, --output <dir>", "Output directory")
            .action(() => {
                // Empty action
            });

        cacCli.parse(simpleCommand, { run: false });
    });

    bench("Cleye - Complete flow", () => {
        cleye(
            {
                flags: {
                    output: String,
                    verbose: Boolean,
                },
                name: "test-cli",
            },
            () => {
                // Empty callback
            },
            simpleCommand.slice(2),
        );
    });
});
