import type { OptionDefinition } from "../@types/command";

/**
 * Performs a simple merge of multiple argument lists. Does not mutate given
 * argument lists or argument.
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
