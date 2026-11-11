import { Command as OclifCommand } from "@oclif/core";
import { Cerebro } from "@visulima/cerebro";
import { cac } from "cac";
import { cli as cleye } from "cleye";
import { Command } from "commander";
import meow from "meow";
import { describe, test } from "vitest";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

describe("1. Cold Start / Initialization (Critical for CLI tools)", () => {
    test("Cerebro - Initialize CLI with plugin", async ({ bench }) => {
        await bench("Cerebro - Initialize CLI with plugin", () => {
            const cerebroCli = new Cerebro("test-cli");

            cerebroCli.dispose();

            return cerebroCli;
        }).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("Commander - Initialize program", async ({ bench }) => {
        await bench("Commander - Initialize program", () => {
            const program = new Command();

            program.name("test-cli").description("Test CLI");
        }).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("Yargs - Initialize parser", async ({ bench }) => {
        await bench("Yargs - Initialize parser", () => {
            yargs(hideBin(["node", "script.js"]))
                .scriptName("test-cli")
                .usage("Test CLI");
        }).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("Oclif - Define command class", async ({ bench }) => {
        await bench("Oclif - Define command class", () => {
            class TestCommand extends OclifCommand {
                // eslint-disable-next-line class-methods-use-this
                public async run() {
                    return {};
                }
            }
            TestCommand.description = "Test CLI";
        }).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("Gunshi - Define command object", async ({ bench }) => {
        await bench("Gunshi - Define command object", () => {
            // Define command structure
            const description = "Test CLI";
            const name = "test";

            return { description, name };
        }).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("Meow - Initialize CLI", async ({ bench }) => {
        await bench("Meow - Initialize CLI", () => {
            meow("Test CLI", {
                importMeta: import.meta,
            });
        }).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("CAC - Initialize CLI", async ({ bench }) => {
        await bench("CAC - Initialize CLI", () => {
            cac("test-cli");
        }).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("Cleye - Initialize CLI", async ({ bench }) => {
        await bench("Cleye - Initialize CLI", () => {
            cleye({
                name: "test-cli",
            });
        }).run();
    });
});
