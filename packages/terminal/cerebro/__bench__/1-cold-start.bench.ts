import { Command as OclifCommand } from "@oclif/core";
import { Cerebro } from "@visulima/cerebro";
import { cac } from "cac";
import { cli as cleye } from "cleye";
import { Command } from "commander";
import meow from "meow";
import { bench, describe } from "vitest";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

describe("1. Cold Start / Initialization (Critical for CLI tools)", () => {
    bench("Cerebro - Initialize CLI with plugin", () => {
        const cerebroCli = new Cerebro("test-cli");

        cerebroCli.dispose();

        return cerebroCli;
    });

    bench.skipIf(process.env.CODSPEED_ENV)("Commander - Initialize program", () => {
        const program = new Command();

        program.name("test-cli").description("Test CLI");
    });

    bench.skipIf(process.env.CODSPEED_ENV)("Yargs - Initialize parser", () => {
        yargs(hideBin(["node", "script.js"]))
            .scriptName("test-cli")
            .usage("Test CLI");
    });

    bench.skipIf(process.env.CODSPEED_ENV)("Oclif - Define command class", () => {
        class TestCommand extends OclifCommand {
            // eslint-disable-next-line class-methods-use-this
            public async run() {
                return {};
            }
        }
        TestCommand.description = "Test CLI";
    });

    bench.skipIf(process.env.CODSPEED_ENV)("Gunshi - Define command object", () => {
        // Define command structure
        const description = "Test CLI";
        const name = "test";

        return { description, name };
    });

    bench.skipIf(process.env.CODSPEED_ENV)("Meow - Initialize CLI", () => {
        meow("Test CLI", {
            importMeta: import.meta,
        });
    });

    bench.skipIf(process.env.CODSPEED_ENV)("CAC - Initialize CLI", () => {
        cac("test-cli");
    });

    bench.skipIf(process.env.CODSPEED_ENV)("Cleye - Initialize CLI", () => {
        cleye({
            name: "test-cli",
        });
    });
});
