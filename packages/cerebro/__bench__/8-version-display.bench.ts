import { Cerebro } from "@visulima/cerebro";
import { cac } from "cac";
import { cli as cleye } from "cleye";
import { Command } from "commander";
import meow from "meow";
import { bench, describe } from "vitest";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { suppressOutput, versionArgs } from "./shared";

describe("8. Version Display", () => {
    bench("Cerebro - Display version", async () => {
        const cli = new Cerebro("test-cli", { packageVersion: "1.0.0" });

        await cli.run({ argv: versionArgs, shouldExitProcess: false });
    });

    bench("Commander - Display version", () => {
        suppressOutput(() => {
            const program = new Command();

            program.name("test-cli").version("1.0.0");

            try {
                program.parse(versionArgs);
            } catch {
                // Ignore errors
            }
        });
    });

    bench("Yargs - Display version", async () => {
        await suppressOutput(async () => {
            const parser = yargs(hideBin(versionArgs)).scriptName("test-cli").version("1.0.0");

            try {
                await parser.parseAsync();
            } catch {
                // Ignore errors
            }
        });
    });

    bench("Meow - Display version", () => {
        suppressOutput(() => {
            try {
                meow("Test CLI", {
                    argv: versionArgs.slice(2),
                    importMeta: import.meta,
                    version: "1.0.0",
                });
            } catch {
                // Ignore errors
            }
        });
    });

    bench("CAC - Display version", () => {
        suppressOutput(() => {
            const cli = cac("test-cli");

            cli.version("1.0.0");

            try {
                cli.parse(versionArgs, { run: false });
            } catch {
                // Ignore errors
            }
        });
    });

    bench("Cleye - Display version", () => {
        suppressOutput(() => {
            try {
                cleye(
                    {
                        name: "test-cli",
                        version: "1.0.0",
                    },
                    () => {
                        // Empty callback
                    },
                    versionArgs.slice(2),
                );
            } catch {
                // Ignore errors
            }
        });
    });
});
