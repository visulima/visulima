declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Cerebro {
        // eslint-disable-next-line import/no-unused-modules
        export interface ExtensionOverrides {}
    }
}

export type { Cli, CommandSection } from "./cli";
export type { Command } from "./command";
export type { Extension } from "./extension";
export type { Options } from "./options";
export type { Toolbox } from "./toolbox";
