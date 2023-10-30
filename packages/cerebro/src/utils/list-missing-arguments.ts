import type { CommandLineOptions } from "command-line-args";

import type { OptionDefinition } from "../@types/command";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const listMissingArguments = <T = any>(commandLineConfig: OptionDefinition<T>[], parsedArguments: CommandLineOptions): OptionDefinition<T>[] =>
    commandLineConfig
        .filter((config) => config.required && parsedArguments[config.name] == null)
        .filter((config) => {
            if (config.type.name === "Boolean") {
                parsedArguments[config.name] = false;

                return false;
            }

            return true;
        });

export default listMissingArguments;
