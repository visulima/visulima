import commandLineArgs from "@visulima/command-line-args/src/index.ts";
import { ArgumentParser } from "argparse";
import { parseArgs } from "jackspeak";
import { bench, describe } from "vitest";
import yargsParser from "yargs-parser";

// Benchmark scenarios - using simpler, more compatible args
const simpleArgs = ["--verbose", "--count", "5", "--name", "test"];
const booleanArgs = ["--verbose", "--quiet", "--debug", "--color"];

describe("Command Line Args Benchmark", () => {
    describe("Simple arguments parsing", () => {
        bench("@visulima/command-line-args", () => {
            const optionDefinitions = [
                { name: "verbose", type: Boolean },
                { name: "count", type: Number },
                { name: "name", type: String },
            ];

            commandLineArgs(optionDefinitions, { argv: simpleArgs });
        });

        bench("jackspeak", () => {
            try {
                parseArgs({
                    args: simpleArgs,
                    options: {
                        count: { type: "string" },
                        name: { type: "string" },
                        verbose: { type: "boolean" },
                    },
                });
            } catch {
                // Ignore errors for benchmark
            }
        });

        bench("yargs-parser", () => {
            yargsParser(simpleArgs, {
                boolean: ["verbose"],
                number: ["count"],
                string: ["name"],
            });
        });

        bench("argparse", () => {
            try {
                const parser = new ArgumentParser({ prog: "test" });

                parser.add_argument("-v", "--verbose", { action: "store_true" });
                parser.add_argument("-c", "--count", { type: "int" });
                parser.add_argument("-n", "--name");
                parser.parse_args(simpleArgs);
            } catch {
                // Ignore errors for benchmark
            }
        });
    });

    describe("Boolean flags only", () => {
        bench("@visulima/command-line-args", () => {
            const optionDefinitions = [
                { name: "verbose", type: Boolean },
                { name: "quiet", type: Boolean },
                { name: "debug", type: Boolean },
                { name: "color", type: Boolean },
            ];

            commandLineArgs(optionDefinitions, { argv: booleanArgs });
        });

        bench("jackspeak", () => {
            try {
                parseArgs({
                    args: booleanArgs,
                    options: {
                        color: { type: "boolean" },
                        debug: { type: "boolean" },
                        quiet: { type: "boolean" },
                        verbose: { type: "boolean" },
                    },
                });
            } catch {
                // Ignore errors for benchmark
            }
        });

        bench("yargs-parser", () => {
            yargsParser(booleanArgs, {
                boolean: ["verbose", "quiet", "debug", "color"],
            });
        });

        bench("argparse", () => {
            try {
                const parser = new ArgumentParser({ prog: "test" });

                parser.add_argument("-v", "--verbose", { action: "store_true" });
                parser.add_argument("-q", "--quiet", { action: "store_true" });
                parser.add_argument("-d", "--debug", { action: "store_true" });
                parser.add_argument("--color", { action: "store_true" });
                parser.parse_args(booleanArgs);
            } catch {
                // Ignore errors for benchmark
            }
        });
    });
});
