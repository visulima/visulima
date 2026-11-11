import { createRequire } from "node:module";
import { parseArgs as nodeParseArgs } from "node:util";

import { parse as bombArgsParse } from "@bomb.sh/args";
import { commandLineArgs } from "@visulima/command-line-args";
import { ArgumentParser } from "argparse";
import { parse as parseArgsTokens } from "args-tokens";
import { jack as jackspeakParseArgs } from "jackspeak";
import minimist from "minimist";
import mri from "mri";
// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, test } from "vitest";
import yargsParser from "yargs-parser";

const require = createRequire(import.meta.url);
// eslint-disable-next-line import/no-commonjs
const args = require("args");
// eslint-disable-next-line import/no-commonjs
const commandLineArgsOriginal = require("command-line-args");

// Benchmark scenarios - using simpler, more compatible args
const simpleArgs = ["--verbose", "--count", "5", "--name", "test"];
const booleanArgs = ["--verbose", "--quiet", "--debug", "--color"];
const argsSimpleArgs = ["node", "script.js", "--verbose", "--count", "5", "--name", "test"];
const argsBooleanArgs = ["node", "script.js", "--verbose", "--quiet", "--debug", "--color"];

describe("Command Line Args Benchmark", () => {
    describe("Simple arguments parsing", () => {
        test("@visulima/command-line-args", async ({ bench }) => {
            await bench("@visulima/command-line-args", () => {
                const optionDefinitions = [
                    { name: "verbose", type: Boolean },
                    { name: "count", type: Number },
                    { name: "name", type: String },
                ];

                commandLineArgs(optionDefinitions, { argv: simpleArgs });
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("command-line-args", async ({ bench }) => {
            await bench("command-line-args", () => {
                const optionDefinitions = [
                    { name: "verbose", type: Boolean },
                    { name: "count", type: Number },
                    { name: "name", type: String },
                ];

                commandLineArgsOriginal(optionDefinitions, { argv: simpleArgs });
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("jackspeak", async ({ bench }) => {
            await bench("jackspeak", () => {
                const parser = jackspeakParseArgs()
                    .opt({ name: { type: "string" } })
                    .flag({ verbose: { type: "boolean" } })
                    .opt({ count: { type: "string" } });

                parser.parse(simpleArgs);
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("node:util.parseArgs", async ({ bench }) => {
            await bench("node:util.parseArgs", () => {
                nodeParseArgs({
                    args: simpleArgs,
                    options: {
                        count: { type: "string" },
                        name: { type: "string" },
                        verbose: { type: "boolean" },
                    },
                });
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("args", async ({ bench }) => {
            await bench("args", () => {
                const parser = new args.Args().option("verbose", "Enable verbose output").option("count", "Count value", 0).option("name", "Name value", "");

                parser.parse(argsSimpleArgs);
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("args-tokens", async ({ bench }) => {
            await bench("args-tokens", () => {
                parseArgsTokens(simpleArgs, {
                    options: {
                        count: { type: "number" },
                        name: { type: "string" },
                        verbose: { type: "boolean" },
                    },
                });
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("yargs-parser", async ({ bench }) => {
            await bench("yargs-parser", () => {
                yargsParser(simpleArgs, {
                    boolean: ["verbose"],
                    number: ["count"],
                    string: ["name"],
                });
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("argparse", async ({ bench }) => {
            await bench("argparse", () => {
                const parser = new ArgumentParser({ prog: "test" });

                parser.add_argument("-v", "--verbose", { action: "store_true" });
                parser.add_argument("-c", "--count", { type: "int" });
                parser.add_argument("-n", "--name");
                parser.parse_args(simpleArgs);
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("mri", async ({ bench }) => {
            await bench("mri", () => {
                mri(simpleArgs, {
                    boolean: ["verbose"],
                    string: ["name"],
                });
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("@bomb.sh/args", async ({ bench }) => {
            await bench("@bomb.sh/args", () => {
                bombArgsParse(simpleArgs, {
                    count: Number,
                    name: String,
                    verbose: Boolean,
                });
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("minimist", async ({ bench }) => {
            await bench("minimist", () => {
                minimist(simpleArgs, {
                    boolean: ["verbose"],
                    string: ["name"],
                });
            }).run();
        });
    });

    describe("Boolean flags only", () => {
        test("@visulima/command-line-args", async ({ bench }) => {
            await bench("@visulima/command-line-args", () => {
                const optionDefinitions = [
                    { name: "verbose", type: Boolean },
                    { name: "quiet", type: Boolean },
                    { name: "debug", type: Boolean },
                    { name: "color", type: Boolean },
                ];

                commandLineArgs(optionDefinitions, { argv: booleanArgs });
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("command-line-args", async ({ bench }) => {
            await bench("command-line-args", () => {
                const optionDefinitions = [
                    { name: "verbose", type: Boolean },
                    { name: "quiet", type: Boolean },
                    { name: "debug", type: Boolean },
                    { name: "color", type: Boolean },
                ];

                commandLineArgsOriginal(optionDefinitions, { argv: booleanArgs });
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("jackspeak", async ({ bench }) => {
            await bench("jackspeak", () => {
                const parser = jackspeakParseArgs()
                    .flag({ verbose: { type: "boolean" } })
                    .flag({ quiet: { type: "boolean" } })
                    .flag({ debug: { type: "boolean" } })
                    .flag({ color: { type: "boolean" } });

                parser.parse(booleanArgs);
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("node:util.parseArgs", async ({ bench }) => {
            await bench("node:util.parseArgs", () => {
                nodeParseArgs({
                    args: booleanArgs,
                    options: {
                        color: { type: "boolean" },
                        debug: { type: "boolean" },
                        quiet: { type: "boolean" },
                        verbose: { type: "boolean" },
                    },
                });
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("args", async ({ bench }) => {
            await bench("args", () => {
                const parser = new args.Args()
                    .option("verbose", "Enable verbose output")
                    .option("quiet", "Enable quiet mode")
                    .option("debug", "Enable debug output")
                    .option("color", "Enable color output");

                parser.parse(argsBooleanArgs);
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("args-tokens", async ({ bench }) => {
            await bench("args-tokens", () => {
                parseArgsTokens(booleanArgs, {
                    options: {
                        color: { type: "boolean" },
                        debug: { type: "boolean" },
                        quiet: { type: "boolean" },
                        verbose: { type: "boolean" },
                    },
                });
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("yargs-parser", async ({ bench }) => {
            await bench("yargs-parser", () => {
                yargsParser(booleanArgs, {
                    boolean: ["verbose", "quiet", "debug", "color"],
                });
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("argparse", async ({ bench }) => {
            await bench("argparse", () => {
                const parser = new ArgumentParser({ prog: "test" });

                parser.add_argument("-v", "--verbose", { action: "store_true" });
                parser.add_argument("-q", "--quiet", { action: "store_true" });
                parser.add_argument("-d", "--debug", { action: "store_true" });
                parser.add_argument("--color", { action: "store_true" });
                parser.parse_args(booleanArgs);
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("mri", async ({ bench }) => {
            await bench("mri", () => {
                mri(booleanArgs, {
                    boolean: ["verbose", "quiet", "debug", "color"],
                });
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("@bomb.sh/args", async ({ bench }) => {
            await bench("@bomb.sh/args", () => {
                bombArgsParse(booleanArgs, {
                    color: Boolean,
                    debug: Boolean,
                    quiet: Boolean,
                    verbose: Boolean,
                });
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("minimist", async ({ bench }) => {
            await bench("minimist", () => {
                minimist(booleanArgs, {
                    boolean: ["verbose", "quiet", "debug", "color"],
                });
            }).run();
        });
    });
});
