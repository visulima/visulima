import type { OptionDefinition } from "command-line-usage";

import hideBin from "../utils/hide-bin";

const COMMAND_DELIMITER = " ";

const equals = (a: string[], b: string[]) => a.length === b.length && a.every((v, index) => v === b[index]);

/**
 * Performs a simple merge of multiple argument lists. Does not mutate given
 * argument lists or argument.
 *
 * This doesn't perform any validation of duplicate argument, multiple
 * defaults, etc., because by the time this function is run, the user can't do
 * anything about it. Validation of command and global argument should be done
 * in tests, not on users machines.
 */
export const mergeArguments = (argumentLists: OptionDefinition[]): OptionDefinition[] => {
    const argumentsByName = new Map<string, OptionDefinition>();

    argumentLists.forEach((argument) => {
        argumentsByName.set(argument.name, { ...argumentsByName.get(argument.name), ...argument });
    });

    return [...argumentsByName.values()];
};

/**
 * Parses the raw command into an array of strings.
 *
 * @param commandArray Command string or list of command parts.
 * @returns The command as an array of strings.
 */
export const parseRawCommand = (commandArray: string[] | string): string[] => {
    // use the command line options if not passed in
    if (typeof commandArray === "string") {
        return (commandArray as string).split(COMMAND_DELIMITER);
    }

    // remove the first 2 options if it comes from process.argv
    if (equals(commandArray as string[], process.argv)) {
        return hideBin(commandArray as string[]);
    }

    return commandArray as string[];
};
