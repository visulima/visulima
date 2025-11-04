import { Cerebro } from "@visulima/cerebro";
import { cac } from "cac";
import { cli as cleye } from "cleye";
import { Command } from "commander";
import meow from "meow";
import { bench, describe } from "vitest";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { mockProcessExit, suppressOutput, versionArgs } from "./shared";

describe("8. Version Display", () => {
    bench("Cerebro - Display version", async () => {
        await suppressOutput(async () => {
            const cli = new Cerebro("test-cli", { argv: versionArgs.slice(2), packageVersion: "1.0.0" });

            cli.addCommand({
                description: "Output the version number",
                execute: ({ logger, runtime }) => {
                    const version = runtime.getPackageVersion();

                    if (version === undefined) {
                        logger.warn("Unknown version");
                    } else {
                        logger.info(version);
                    }
                },
                name: "version",
            });

            await cli.run({ shouldExitProcess: false });
        });
    });

    bench("Commander - Display version", () => {
        try {
            suppressOutput(() => {
                mockProcessExit(() => {
                    const program = new Command();

                    program.name("test-cli").version("1.0.0");

                    program.parse(versionArgs);
                });
            });
        } catch {
            // Ignore - expected when process.exit is called
        }
    });

    bench("Yargs - Display version", async () => {
        await suppressOutput(async () => {
            const parser = yargs(hideBin(versionArgs)).scriptName("test-cli").version("1.0.0");

            await parser.parseAsync();
        });
    });

    bench("Meow - Display version", () => {
        try {
            suppressOutput(() => {
                mockProcessExit(() => {
                    meow("Test CLI", {
                        argv: versionArgs.slice(2),
                        importMeta: import.meta,
                        version: "1.0.0",
                    });
                });
            });
        } catch {
            // Ignore - expected when process.exit is called
        }
    });

    bench("CAC - Display version", () => {
        suppressOutput(() => {
            const cli = cac("test-cli");

            cli.version("1.0.0");

            cli.parse(versionArgs, { run: false });
        });
    });

    bench("Cleye - Display version", () => {
        try {
            suppressOutput(() => {
                mockProcessExit(() => {
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
                });
            });
        } catch {
            // Ignore - expected when process.exit is called
        }
    });
});
