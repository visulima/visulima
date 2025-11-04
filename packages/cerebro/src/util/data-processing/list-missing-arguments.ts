import type { CommandLineOptions } from "@visulima/command-line-args";

import type { OptionDefinition, PossibleOptionDefinition } from "../../types/command";

/**
 * Lists missing required arguments from parsed command line options
 * Optimized to use pre-filtered required options when available
 * Combines filter operations for better performance
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
    const missing: PossibleOptionDefinition<OD>[] = [];

    // Single pass through options combining all filter conditions
    for (const config of commandLineConfig) {
        // Skip if not required (unless already filtered)
        if (!onlyRequired && !config.required) {
            continue;
        }

        // Skip if already present in parsed arguments
        if (parsedArguments[config.name] !== undefined) {
            continue;
        }

        // Handle boolean defaults
        if (config.type?.name === "Boolean") {
            // eslint-disable-next-line no-param-reassign
            parsedArguments[config.name] = false;
            // Don't add to missing list as it now has a default value
            continue;
        }

        missing.push(config);
    }

    return missing;
};

export default listMissingArguments;
