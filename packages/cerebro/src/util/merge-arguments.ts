import type { OptionDefinition, PossibleOptionDefinition } from "../@types/command";

/**
 * Performs a simple merge of multiple argument lists. Does not mutate given
 * argument lists or argument.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mergeArguments = <OD extends OptionDefinition<any>>(argumentLists: PossibleOptionDefinition<OD>[]): PossibleOptionDefinition<OD>[] => {
    const argumentsByName = new Map<string, PossibleOptionDefinition<OD>>();

    argumentLists.forEach((argument) => {
        argumentsByName.set(argument.name, { ...argumentsByName.get(argument.name), ...argument });
    });

    return [...argumentsByName.values()];
};

export default mergeArguments;
