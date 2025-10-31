// packages/cerebro/__bench__/5-complex-parsing.bench.ts
import { Cerebro } from "@visulima/cerebro";
import { cac } from "cac";
import { cli as cleye, command as cleyeCommand } from "cleye";
import { Command } from "commander";
import meow from "meow";
import { bench, describe } from "vitest";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { complexArgs, suppressOutput } from "./shared";

describe("5. Complex Argument Parsing (Many flags)", () => {
    bench("Cerebro - Parse 8 flags", async () => {
        const cli = new Cerebro("test-cli");

        cli.addCommand({
            description: "Deploy command",
            execute: () => {
                // Empty execute function
            },
            name: "deploy",
            options: [
                { description: "Environment", name: "env", type: String },
                { description: "Region", name: "region", type: String },
                { description: "Verbose", name: "verbose", type: Boolean },
                { description: "Force deploy", name: "force", type: Boolean },
                { description: "Dry run", name: "dry-run", type: Boolean },
                { description: "Worker count", name: "workers", type: Number },
                { description: "Timeout", name: "timeout", type: Number },
                { description: "Config file", name: "config", type: String },
            ],
        });

        await cli.run({ argv: complexArgs, shouldExitProcess: false });
    });

    bench("Commander - Parse 8 flags", () => {
        suppressOutput(() => {
            const program = new Command();

            program
                .name("test-cli")
                .command("deploy")
                .option("-e, --env <env>", "Environment")
                .option("-r, --region <region>", "Region")
                .option("-v, --verbose", "Verbose")
                .option("-f, --force", "Force deploy")
                .option("--dry-run", "Dry run")
                .option("-w, --workers <number>", "Worker count")
                .option("-t, --timeout <number>", "Timeout")
                .option("-c, --config <file>", "Config file")
                .action(() => {
                    // Empty action
                });

            try {
                program.parse(complexArgs);
            } catch {
                // Ignore errors
            }
        });
    });

    bench("Yargs - Parse 8 flags", async () => {
        await suppressOutput(async () => {
            const parser = yargs(hideBin(["node", "script.js"]))
                .scriptName("test-cli")
                .command("deploy", "Deploy command", (yargsBuilder) =>
                    yargsBuilder
                        .option("env", { alias: "e", type: "string" })
                        .option("region", { alias: "r", type: "string" })
                        .option("verbose", { alias: "v", type: "boolean" })
                        .option("force", { alias: "f", type: "boolean" })
                        .option("dry-run", { type: "boolean" })
                        .option("workers", { alias: "w", type: "number" })
                        .option("timeout", { alias: "t", type: "number" })
                        .option("config", { alias: "c", type: "string" }));

            try {
                await parser.parseAsync(complexArgs.slice(2));
            } catch {
                // Ignore errors
            }
        });
    });

    bench("Meow - Parse 8 flags", () => {
        suppressOutput(() => {
            try {
                meow("Deploy command", {
                    argv: complexArgs.slice(2),
                    flags: {
                        config: { shortFlag: "c", type: "string" },
                        dryRun: { type: "boolean" },
                        env: { shortFlag: "e", type: "string" },
                        force: { shortFlag: "f", type: "boolean" },
                        region: { shortFlag: "r", type: "string" },
                        timeout: { shortFlag: "t", type: "number" },
                        verbose: { shortFlag: "v", type: "boolean" },
                        workers: { shortFlag: "w", type: "number" },
                    },
                    importMeta: import.meta,
                });
            } catch {
                // Ignore errors
            }
        });
    });

    bench("CAC - Parse 8 flags", () => {
        suppressOutput(() => {
            const cli = cac("test-cli");

            cli.command("deploy", "Deploy command")
                .option("-e, --env <env>", "Environment")
                .option("-r, --region <region>", "Region")
                .option("-v, --verbose", "Verbose")
                .option("-f, --force", "Force deploy")
                .option("--dry-run", "Dry run")
                .option("-w, --workers <number>", "Worker count")
                .option("-t, --timeout <number>", "Timeout")
                .option("-c, --config <file>", "Config file")
                .action(() => {
                    // Empty action
                });

            try {
                cli.parse(complexArgs, { run: false });
            } catch {
                // Ignore errors
            }
        });
    });

    bench("Cleye - Parse 8 flags", () => {
        suppressOutput(() => {
            try {
                const deployCommand = cleyeCommand({
                    flags: {
                        config: String,
                        dryRun: Boolean,
                        env: String,
                        force: Boolean,
                        region: String,
                        timeout: Number,
                        verbose: Boolean,
                        workers: Number,
                    },
                    name: "deploy",
                });

                cleye(
                    {
                        commands: [deployCommand],
                        name: "test-cli",
                    },
                    () => {
                        // Empty callback
                    },
                    complexArgs.slice(2),
                );
            } catch {
                // Ignore errors
            }
        });
    });
});
