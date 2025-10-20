import { createRequire } from "node:module";
import { parseArgs as nodeParseArgs } from "node:util";

import { parse as bombArgsParse } from "@bomb.sh/args";
import { commandLineArgs } from "@visulima/command-line-args";
import { ArgumentParser } from "argparse";
import { parse as parseArgsTokens } from "args-tokens";
import { jack as jackspeakParseArgs } from "jackspeak";
import minimist from "minimist";
import mri from "mri";
import { bench, describe } from "vitest";
import yargsParser from "yargs-parser";

const require = createRequire(import.meta.url);
const args = require("args");
const commandLineArgsOriginal = require("command-line-args");

// Benchmark scenarios - using simpler, more compatible args
const simpleArgs = ["--verbose", "--count", "5", "--name", "test"];
const booleanArgs = ["--verbose", "--quiet", "--debug", "--color"];
const argsSimpleArgs = ["node", "script.js", "--verbose", "--count", "5", "--name", "test"];
const argsBooleanArgs = ["node", "script.js", "--verbose", "--quiet", "--debug", "--color"];

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

        bench("command-line-args", () => {
            const optionDefinitions = [
                { name: "verbose", type: Boolean },
                { name: "count", type: Number },
                { name: "name", type: String },
            ];

            commandLineArgsOriginal(optionDefinitions, { argv: simpleArgs });
        });

        bench("jackspeak", () => {
            const parser = jackspeakParseArgs()
                .opt({ name: { type: "string" } })
                .flag({ verbose: { type: "boolean" } })
                .opt({ count: { type: "string" } });

            parser.parse(simpleArgs);
        });

        bench("node:util.parseArgs", () => {
            nodeParseArgs({
                args: simpleArgs,
                options: {
                    count: { type: "string" },
                    name: { type: "string" },
                    verbose: { type: "boolean" },
                },
            });
        });

        bench("args", () => {
            const parser = new args.Args().option("verbose", "Enable verbose output").option("count", "Count value", 0).option("name", "Name value", "");

            parser.parse(argsSimpleArgs);
        });

        bench("args-tokens", () => {
            parseArgsTokens(simpleArgs, {
                options: {
                    count: { type: "number" },
                    name: { type: "string" },
                    verbose: { type: "boolean" },
                },
            });
        });

        bench("yargs-parser", () => {
            yargsParser(simpleArgs, {
                boolean: ["verbose"],
                number: ["count"],
                string: ["name"],
            });
        });

        bench("argparse", () => {
            const parser = new ArgumentParser({ prog: "test" });

            parser.add_argument("-v", "--verbose", { action: "store_true" });
            parser.add_argument("-c", "--count", { type: "int" });
            parser.add_argument("-n", "--name");
            parser.parse_args(simpleArgs);
        });

        bench("mri", () => {
            mri(simpleArgs, {
                boolean: ["verbose"],
                string: ["name"],
            });
        });

        bench("@bomb.sh/args", () => {
            bombArgsParse(simpleArgs, {
                count: Number,
                name: String,
                verbose: Boolean,
            });
        });

        bench("minimist", () => {
            minimist(simpleArgs, {
                boolean: ["verbose"],
                string: ["name"],
            });
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

        bench("command-line-args", () => {
            const optionDefinitions = [
                { name: "verbose", type: Boolean },
                { name: "quiet", type: Boolean },
                { name: "debug", type: Boolean },
                { name: "color", type: Boolean },
            ];

            commandLineArgsOriginal(optionDefinitions, { argv: booleanArgs });
        });

        bench("jackspeak", () => {
            const parser = jackspeakParseArgs()
                .flag({ verbose: { type: "boolean" } })
                .flag({ quiet: { type: "boolean" } })
                .flag({ debug: { type: "boolean" } })
                .flag({ color: { type: "boolean" } });

            parser.parse(booleanArgs);
        });

        bench("node:util.parseArgs", () => {
            nodeParseArgs({
                args: booleanArgs,
                options: {
                    color: { type: "boolean" },
                    debug: { type: "boolean" },
                    quiet: { type: "boolean" },
                    verbose: { type: "boolean" },
                },
            });
        });

        bench("args", () => {
            const parser = new args.Args()
                .option("verbose", "Enable verbose output")
                .option("quiet", "Enable quiet mode")
                .option("debug", "Enable debug output")
                .option("color", "Enable color output");

            parser.parse(argsBooleanArgs);
        });

        bench("args-tokens", () => {
            parseArgsTokens(booleanArgs, {
                options: {
                    color: { type: "boolean" },
                    debug: { type: "boolean" },
                    quiet: { type: "boolean" },
                    verbose: { type: "boolean" },
                },
            });
        });

        bench("yargs-parser", () => {
            yargsParser(booleanArgs, {
                boolean: ["verbose", "quiet", "debug", "color"],
            });
        });

        bench("argparse", () => {
            const parser = new ArgumentParser({ prog: "test" });

            parser.add_argument("-v", "--verbose", { action: "store_true" });
            parser.add_argument("-q", "--quiet", { action: "store_true" });
            parser.add_argument("-d", "--debug", { action: "store_true" });
            parser.add_argument("--color", { action: "store_true" });
            parser.parse_args(booleanArgs);
        });

        bench("mri", () => {
            mri(booleanArgs, {
                boolean: ["verbose", "quiet", "debug", "color"],
            });
        });

        bench("@bomb.sh/args", () => {
            bombArgsParse(booleanArgs, {
                color: Boolean,
                debug: Boolean,
                quiet: Boolean,
                verbose: Boolean,
            });
        });

        bench("minimist", () => {
            minimist(booleanArgs, {
                boolean: ["verbose", "quiet", "debug", "color"],
            });
        });
    });
});
