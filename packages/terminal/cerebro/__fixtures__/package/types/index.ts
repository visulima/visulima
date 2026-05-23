// Compile-only fixture. Imports the published surface of @visulima/cerebro
// and exercises its public types so a broken dist/*.d.ts will fail `tsc --noEmit`.
import { createCerebro, VERBOSITY_NORMAL } from "@visulima/cerebro";
import type { CliOptions, Command, OptionDefinition } from "@visulima/cerebro";

const opts: CliOptions = {};
const cli = createCerebro("demo", opts);

const command: Command = {
    description: "hello world",
    execute: () => undefined,
    name: "hello",
};

const verbosity: number = VERBOSITY_NORMAL;

declare const option: OptionDefinition<string>;

export { cli, command, option, verbosity };
