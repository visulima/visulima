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

    // The global options carry a `group`, so command-line-args groups the
    // result: every parsed option lives under `_all` (with camelCased keys),
    // never at the bare top level. Read through `_all` when present so a
    // provided option is actually detected instead of always looking missing.
    // eslint-disable-next-line no-underscore-dangle
    const values = ((parsedArguments._all as Record<string, unknown> | undefined) ?? parsedArguments) as Record<string, unknown>;

    for (const config of commandLineConfig) {
        if (!onlyRequired && !config.required) {
            continue;
        }

        // The parser emits camelCased keys (camelCase: true), so hyphenated
        // option names must be looked up via their pre-computed camelCase name.
        // eslint-disable-next-line no-underscore-dangle
        const key = config.__camelCaseName__ ?? config.name;

        if (values[key] !== undefined) {
            continue;
        }

        if (config.type?.name === "Boolean") {
            // eslint-disable-next-line no-param-reassign
            parsedArguments[key] = false;
            continue;
        }

        missing.push(config);
    }

    return missing;
};

export default listMissingArguments;
