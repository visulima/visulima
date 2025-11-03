import { Cerebro } from "@visulima/cerebro";
import { cac } from "cac";
import { cli as cleye } from "cleye";
import { Command } from "commander";
import meow from "meow";
import { bench, describe } from "vitest";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { errorArgs, suppressOutput } from "./shared";

describe("9. Error Handling Performance", () => {
    bench("Cerebro - Handle unknown command", async () => {
        const cli = new Cerebro("test-cli");

        cli.addCommand({
            description: "Known command",
            execute: () => {
                // Empty execute function
            },
            name: "build",
        });

        await cli.run({ argv: errorArgs, shouldExitProcess: false });
    });

    bench("Commander - Handle unknown command", () => {
        suppressOutput(() => {
            const program = new Command();

            program
                .name("test-cli")
                .command("build")
                .action(() => {
                    // Empty action
                });

            try {
                program.parse(errorArgs);
            } catch {
                // Ignore errors
            }
        });
    });

    bench("Yargs - Handle unknown command", async () => {
        await suppressOutput(async () => {
            const parser = yargs(hideBin(["node", "script.js"]))
                .scriptName("test-cli")
                .command("build", "Build command")
                .strict();

            try {
                await parser.parseAsync(errorArgs.slice(2));
            } catch {
                // Ignore errors
            }
        });
    });

    bench("Meow - Handle invalid input", () => {
        suppressOutput(() => {
            try {
                meow("Test CLI", {
                    argv: errorArgs.slice(2),
                    flags: {
                        validFlag: {
                            type: "boolean",
                        },
                    },
                    importMeta: import.meta,
                });
            } catch {
                // Ignore errors
            }
        });
    });

    bench("CAC - Handle unknown command", () => {
        suppressOutput(() => {
            const cli = cac("test-cli");

            cli.command("build", "Known command").action(() => {
                // Empty action
            });

            try {
                cli.parse(errorArgs, { run: false });
            } catch {
                // Ignore errors
            }
        });
    });

    bench("Cleye - Handle invalid flags", () => {
        suppressOutput(() => {
            try {
                cleye(
                    {
                        flags: {
                            validFlag: Boolean,
                        },
                        name: "test-cli",
                    },
                    () => {
                        // Empty callback
                    },
                    errorArgs.slice(2),
                );
            } catch {
                // Ignore errors
            }
        });
    });
});
