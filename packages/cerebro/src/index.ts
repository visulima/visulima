import type { VERBOSITY_LEVEL } from "./@types/cli";
import type { CliOptions } from "./cli";
import { Cli as Cerebro } from "./cli";

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Cerebro {
        // eslint-disable-next-line @typescript-eslint/no-empty-object-type
        export interface ExtensionOverrides {}
    }
}

// eslint-disable-next-line @typescript-eslint/no-namespace,@typescript-eslint/no-unused-vars
declare namespace NodeJS {
    interface ProcessEnvironment {
        CEREBRO_MIN_NODE_VERSION?: string;
        CEREBRO_OUTPUT_LEVEL: VERBOSITY_LEVEL;
    }
}

export type { Cli, CliRunOptions, OutputType, VERBOSITY_LEVEL } from "./@types/cli";
export type { ArgumentDefinition, Command, OptionDefinition } from "./@types/command";
export type { Plugin, PluginContext } from "./@types/plugin";
export type { Toolbox } from "./@types/toolbox";
export type { CliOptions } from "./cli";
export { Cli as Cerebro } from "./cli";
export const createCerebro = <T extends Console = Console>(name: string, options?: CliOptions<T>): Cerebro<T> => new Cerebro<T>(name, options);
