import type { CommandLineOptions } from "@visulima/command-line-args";

import type { OptionDefinition, PossibleOptionDefinition } from "../../types/command";

/**
 * Lists missing required arguments from parsed command line options
 * Optimized to use pre-filtered required options when available
 *
 * Note: This function mutates parsedArguments by setting missing boolean options to false.
 * @param commandLineConfig All command options OR pre-filtered required options
 * @param parsedArguments Parsed command line arguments (will be mutated for boolean defaults)
 * @param onlyRequired If true, commandLineConfig already contains only required options (optimization)
 * @returns Array of missing required options
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const listMissingArguments = <OD extends OptionDefinition<any>>(
    commandLineConfig: PossibleOptionDefinition<OD>[],
    parsedArguments: CommandLineOptions,
    onlyRequired = false,
): PossibleOptionDefinition<OD>[] => {
    // Performance optimization: skip the first filter if we already have only required options
    const requiredOptions = onlyRequired ? commandLineConfig : commandLineConfig.filter((config) => config.required);

    return requiredOptions
        .filter((config) => parsedArguments[config.name] == undefined)
        .filter((config) => {
            if (config.type?.name === "Boolean") {
                // eslint-disable-next-line no-param-reassign
                parsedArguments[config.name] = false;

                return false;
            }

            return true;
        });
};

export default listMissingArguments;
