import { Cerebro } from "@visulima/cerebro";
import { cac } from "cac";
import { cli as cleye } from "cleye";
import { Command } from "commander";
import { cli } from "gunshi";
import meow from "meow";
import { describe, test } from "vitest";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { simpleCommand } from "./shared";

describe("4. Simple Argument Parsing", () => {
    test("Cerebro - Parse simple command", async ({ bench }) => {
        await bench("Cerebro - Parse simple command", async () => {
            const cerebroCli = new Cerebro("test-cli", { argv: simpleCommand.slice(2) });

            cerebroCli.addCommand({
                description: "Build command",
                execute: () => {
                    // Empty execute function
                },
                name: "build",
                options: [{ description: "Enable verbose output", name: "verbose", type: Boolean }],
            });

            await cerebroCli.run({ shouldExitProcess: false });
        }).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("Commander - Parse simple command", async ({ bench }) => {
        await bench("Commander - Parse simple command", () => {
            const program = new Command();

            program
                .name("test-cli")
                .command("build")
                .option("-v, --verbose", "Enable verbose output")
                .action(() => {
                    // Empty action
                });

            program.parse(simpleCommand);
        }).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("Yargs - Parse simple command", async ({ bench }) => {
        await bench("Yargs - Parse simple command", async () => {
            const parser = yargs(hideBin(["node", "script.js"]))
                .scriptName("test-cli")
                .command("build", "Build command", (yargsBuilder) =>
                    yargsBuilder.option("verbose", {
                        alias: "v",
                        type: "boolean",
                    }),
                );

            await parser.parseAsync(simpleCommand.slice(2));
        }).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("Meow - Parse simple flags", async ({ bench }) => {
        await bench("Meow - Parse simple flags", () => {
            meow("Build command", {
                argv: simpleCommand.slice(2),
                flags: {
                    verbose: {
                        shortFlag: "v",
                        type: "boolean",
                    },
                },
                importMeta: import.meta,
            });
        }).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("Gunshi - Parse simple command", async ({ bench }) => {
        await bench("Gunshi - Parse simple command", async () => {
            const command = {
                args: {
                    verbose: {
                        description: "Enable verbose output",
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
        }).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("CAC - Parse simple command", async ({ bench }) => {
        await bench("CAC - Parse simple command", () => {
            const cacCli = cac("test-cli");

            cacCli
                .command("build", "Build command")
                .option("-v, --verbose", "Enable verbose output")
                .action(() => {
                    // Empty action
                });

            cacCli.parse(simpleCommand, { run: false });
        }).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("Cleye - Parse simple flags", async ({ bench }) => {
        await bench("Cleye - Parse simple flags", () => {
            cleye(
                {
                    flags: {
                        verbose: Boolean,
                    },
                    name: "test-cli",
                },
                () => {
                    // Empty callback
                },
                simpleCommand.slice(2),
            );
        }).run();
    });
});
