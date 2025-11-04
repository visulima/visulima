import type { OptionDefinition, PossibleOptionDefinition } from "../../types/command";
import getParameterOption from "./get-parameter-option";
import isBoolean from "./option-is-boolean";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ArgumentsAndLastOption<OD extends OptionDefinition<any>> = { args: string[]; lastOption?: PossibleOptionDefinition<OD> };

const booleanValue = new Set(["0", "1", "false", "true"]);

/**
 * commandLineArgs throws an error if we pass aa value for a boolean arg as follows:
 * myCommand -a=true --booleanArg=false --otherArg true
 * this function removes these booleans to avoid errors from commandLineArgs
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const removeBooleanValues = <OD extends OptionDefinition<any>>(
    arguments_: string[],
    options: PossibleOptionDefinition<OD>[],
    optionMapByName?: Map<string, PossibleOptionDefinition<OD>>,
    optionMapByAlias?: Map<string, PossibleOptionDefinition<OD>>,
): string[] => {
    if (options.length === 0 || arguments_.length === 0) {
        return arguments_;
    }

    const removeBooleanArguments = (argumentsAndLastValue: ArgumentsAndLastOption<OD>, argument: string): ArgumentsAndLastOption<OD> => {
        const { argValue, option } = getParameterOption(argument, options, optionMapByName, optionMapByAlias);

        const { lastOption } = argumentsAndLastValue;

        if (lastOption && isBoolean(lastOption) && booleanValue.has(argument)) {
            const { args } = argumentsAndLastValue;
            const result = args.slice(0, -1);

            return { args: result };
        }

        if (option && isBoolean(option) && argValue) {
            return { args: argumentsAndLastValue.args };
        }

        const newArgs = [...argumentsAndLastValue.args];

        newArgs.push(argument);

        return { args: newArgs, lastOption: option as PossibleOptionDefinition<OD> };
    };

    // eslint-disable-next-line unicorn/no-array-callback-reference,unicorn/no-array-reduce
    return arguments_.reduce<ArgumentsAndLastOption<OD>>(removeBooleanArguments, { args: [] }).args;
};

export default removeBooleanValues;
