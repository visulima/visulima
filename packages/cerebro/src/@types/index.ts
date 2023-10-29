declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Cerebro {
        // eslint-disable-next-line @typescript-eslint/no-empty-interface,import/no-unused-modules
        export interface ExtensionOverrides {}
    }
}

export type { Cli, CommandSection } from "./cli";
export type { Command } from "./command";
export type { Extension } from "./extension";
export type { ConfigType, Logger } from "./logger";
export type { Options } from "./options";
export type { Print, PrintTableOptions } from "./print";
export type { CerebroError, StringOrBuffer, System } from "./system";
export type { Toolbox } from "./toolbox";
