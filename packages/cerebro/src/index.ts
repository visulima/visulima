export type { Cli } from "./@types/cli";
export type { Command } from "./@types/command";
export type { Extension } from "./@types/extension";
export type { ConfigType, Logger } from "./@types/logger";
export type { Print, PrintTableOptions } from "./@types/print";
export type {
    CerebroError, StringOrBuffer, System,
} from "./@types/system";
export type { Toolbox } from "./@types/toolbox";

/**
 * Any of the output types [[OUTPUT_NORMAL]], [[OUTPUT_RAW]] and [[OUTPUT_PLAIN]].
 */
export type OutputType = 1 | 2 | 4;

/**
 * Any of the verbosity types
 * [[VERBOSITY_QUIET]], [[VERBOSITY_NORMAL]], [[VERBOSITY_VERBOSE]], [[VERBOSITY_VERY_VERBOSE]] nad [[VERBOSITY_DEBUG]].
 */
export type VERBOSITY_LEVEL = 16 | 32 | 64 | 128 | 256;

export { default } from "./cli";
