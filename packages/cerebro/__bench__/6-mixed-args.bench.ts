import { Cerebro } from "@visulima/cerebro";
import { cac } from "cac";
import { cli as cleye } from "cleye";
import { Command } from "commander";
import meow from "meow";
import { bench, describe } from "vitest";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { mixedArgs } from "./shared";

describe("6. Mixed Positional + Flag Arguments", () => {
    bench("Cerebro - Parse mixed args", async () => {
        const cli = new Cerebro("test-cli");

        cli.addCommand({
            description: "Process files",
            execute: () => {
                // Empty execute function
            },
            name: "process",
            options: [
                { description: "Output file", name: "output", type: String },
                { description: "Output format", name: "format", type: String },
                { description: "Compress output", name: "compress", type: Boolean },
            ],
        });

        await cli.run({ argv: mixedArgs, shouldExitProcess: false });
    });

    bench("Commander - Parse mixed args", () => {
        const program = new Command();

        program
            .name("test-cli")
            .command("process <files...>")
            .option("-o, --output <file>", "Output file")
            .option("-f, --format <format>", "Output format")
            .option("-c, --compress", "Compress output")
            .action(() => {
                // Empty action
            });

        program.parse(mixedArgs);
    });

    bench("Yargs - Parse mixed args", async () => {
        const parser = yargs(hideBin(["node", "script.js"]))
            .scriptName("test-cli")
            .command("process <files..>", "Process files", (yargsBuilder) =>
                yargsBuilder
                    .option("output", { alias: "o", type: "string" })
                    .option("format", { alias: "f", type: "string" })
                    .option("compress", { alias: "c", type: "boolean" }));

        await parser.parseAsync(mixedArgs.slice(2));
    });

    bench("Meow - Parse mixed args", () => {
        meow("Process files", {
            argv: mixedArgs.slice(2),
            flags: {
                compress: { shortFlag: "c", type: "boolean" },
                format: { shortFlag: "f", type: "string" },
                output: { shortFlag: "o", type: "string" },
            },
            importMeta: import.meta,
        });
    });

    bench("CAC - Parse mixed args", () => {
        const cli = cac("test-cli");

        cli.command("process <files...>", "Process files")
            .option("-o, --output <file>", "Output file")
            .option("-f, --format <format>", "Output format")
            .option("-c, --compress", "Compress output")
            .action(() => {
                // Empty action
            });

        cli.parse(mixedArgs, { run: false });
    });

    bench("Cleye - Parse mixed args", () => {
        cleye(
            {
                flags: {
                    compress: Boolean,
                    format: String,
                    output: String,
                },
                name: "test-cli",
                parameters: ["[files...]"],
            },
            () => {
                // Empty callback
            },
            mixedArgs.slice(2),
        );
    });
});
