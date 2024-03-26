// TODO: Uncomment this in the next major release
// import type { CliOptions } from "./cli";
// import { Cli as Cerebro } from "./cli";

// eslint-disable-next-line @typescript-eslint/no-namespace,@typescript-eslint/no-unused-vars
declare namespace NodeJS {
    interface ProcessEnvironment {
        CEREBRO_MIN_NODE_VERSION?: string;
        CEREBRO_OUTPUT_LEVEL: VERBOSITY_LEVEL;
    }
}

export type { Cli } from "./@types/cli";
export type { ArgumentDefinition, Command, OptionDefinition } from "./@types/command";
export type { Extension } from "./@types/extension";
export type { Toolbox } from "./@types/toolbox";
export type { CliOptions } from "./cli";

/**
 * Any of the output types [[OUTPUT_NORMAL]], [[OUTPUT_RAW]] and [[OUTPUT_PLAIN]].
 */
export type OutputType = 1 | 2 | 4;

/**
 * Any of the verbosity types
 * [[VERBOSITY_QUIET]], [[VERBOSITY_NORMAL]], [[VERBOSITY_VERBOSE]] and [[VERBOSITY_DEBUG]].
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export type VERBOSITY_LEVEL = 16 | 32 | 64 | 128 | 256;

export { Cli as default } from "./cli";
// TODO: Uncomment this in the next major release
// export const createCerebro = (name: string, options: CliOptions): Cerebro => new Cerebro(name, options);
