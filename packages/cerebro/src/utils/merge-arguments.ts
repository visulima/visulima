import type { OptionDefinition } from "../@types/command";

/**
 * Performs a simple merge of multiple argument lists. Does not mutate given
 * argument lists or argument.
 *
 * This doesn't perform any validation of duplicate argument, multiple
 * defaults, etc., because by the time this function is run, the user can't do
 * anything about it. Validation of command and global argument should be done
 * in tests, not on users machines.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mergeArguments = <T = any>(argumentLists: OptionDefinition<T>[]): OptionDefinition<T>[] => {
    const argumentsByName = new Map<string, OptionDefinition<T>>();

    argumentLists.forEach((argument) => {
        argumentsByName.set(argument.name, { ...argumentsByName.get(argument.name), ...argument });
    });

    return [...argumentsByName.values()];
};

export default mergeArguments;
