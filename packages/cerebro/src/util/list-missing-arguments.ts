import type { CommandLineOptions } from "command-line-args";

import type { PossibleOptionDefinition } from "../@types/command";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const listMissingArguments = <T = any>(commandLineConfig: PossibleOptionDefinition<T>[], parsedArguments: CommandLineOptions): PossibleOptionDefinition<T>[] =>
    commandLineConfig
        .filter((config) => config.required && parsedArguments[config.name] == null)
        .filter((config) => {
            if (config.type?.name === "Boolean") {
                // eslint-disable-next-line no-param-reassign
                parsedArguments[config.name] = false;

                return false;
            }

            return true;
        });

export default listMissingArguments;
