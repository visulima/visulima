import type { OptionDefinition, PossibleOptionDefinition } from "../../types/command";

/**
 * Performs a simple merge of multiple argument lists. Does not mutate given
 * argument lists or argument.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mergeArguments = <OD extends OptionDefinition<any>>(argumentLists: PossibleOptionDefinition<OD>[]): PossibleOptionDefinition<OD>[] => {
    const argumentsByName = new Map<string, PossibleOptionDefinition<OD>>();

    // Optimized merge: only spread if there's existing data
    for (const argument of argumentLists) {
        const existing = argumentsByName.get(argument.name);

        if (existing) {
            argumentsByName.set(argument.name, { ...existing, ...argument });
        } else {
            argumentsByName.set(argument.name, argument);
        }
    }

    return [...argumentsByName.values()];
};

export default mergeArguments;
