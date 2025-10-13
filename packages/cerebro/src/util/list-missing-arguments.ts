import type { CommandLineOptions } from "command-line-args";

import type { OptionDefinition, PossibleOptionDefinition } from "../@types/command";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const listMissingArguments = <OD extends OptionDefinition<any>>(
    commandLineConfig: PossibleOptionDefinition<OD>[],
    parsedArguments: CommandLineOptions,
): PossibleOptionDefinition<OD>[] =>
    commandLineConfig
        .filter((config) => config.required && parsedArguments[config.name] == undefined)
        .filter((config) => {
            if (config.type?.name === "Boolean") {
                // eslint-disable-next-line no-param-reassign
                parsedArguments[config.name] = false;

                return false;
            }

            return true;
        });

export default listMissingArguments;
