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
        try {
            const cli = new Cerebro("test-cli", { argv: errorArgs });

            cli.addCommand({
                description: "Known command",
                execute: () => {
                    // Empty execute function
                },
                name: "build",
            });

            await cli.run({ shouldExitProcess: false });
        } catch {
            // Expected - unknown command should throw
        }
    });

    bench("Commander - Handle unknown command", () => {
        try {
            suppressOutput(() => {
                const program = new Command();

                program
                    .name("test-cli")
                    .command("build")
                    .action(() => {
                        // Empty action
                    });

                program.parse(errorArgs);
            });
        } catch {
            // Expected - unknown command should throw
        }
    });

    bench("Yargs - Handle unknown command", async () => {
        try {
            await suppressOutput(async () => {
                const parser = yargs(hideBin(["node", "script.js"]))
                    .scriptName("test-cli")
                    .command("build", "Build command")
                    .strict();

                await parser.parseAsync(errorArgs.slice(2));
            });
        } catch {
            // Expected - unknown command/invalid flags should throw
        }
    });

    bench("Meow - Handle invalid input", () => {
        try {
            suppressOutput(() => {
                meow("Test CLI", {
                    argv: errorArgs.slice(2),
                    flags: {
                        validFlag: {
                            type: "boolean",
                        },
                    },
                    importMeta: import.meta,
                });
            });
        } catch {
            // Expected - invalid input should throw
        }
    });

    bench("CAC - Handle unknown command", () => {
        try {
            suppressOutput(() => {
                const cli = cac("test-cli");

                cli.command("build", "Known command").action(() => {
                    // Empty action
                });

                cli.parse(errorArgs, { run: false });
            });
        } catch {
            // Expected - unknown command should throw
        }
    });

    bench("Cleye - Handle invalid flags", () => {
        try {
            suppressOutput(() => {
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
            });
        } catch {
            // Expected - invalid flags should throw
        }
    });
});
