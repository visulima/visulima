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
const removeBooleanValues = <OD extends OptionDefinition<any>>(arguments_: string[], options: PossibleOptionDefinition<OD>[]): string[] => {
    const removeBooleanArguments = (argumentsAndLastValue: ArgumentsAndLastOption<OD>, argument: string): ArgumentsAndLastOption<OD> => {
        const { argValue, option } = getParameterOption(argument, options);

        const { lastOption } = argumentsAndLastValue;

        if (lastOption && isBoolean(lastOption) && booleanValue.has(argument)) {
            // eslint-disable-next-line no-underscore-dangle,@typescript-eslint/naming-convention
            const copiedArguments_ = [...argumentsAndLastValue.args];

            copiedArguments_.pop();

            return { args: copiedArguments_ };
        }

        if (option && isBoolean(option) && argValue) {
            return { args: argumentsAndLastValue.args };
        }

        return { args: [...argumentsAndLastValue.args, argument], lastOption: option as PossibleOptionDefinition<OD> };
    };

    // eslint-disable-next-line unicorn/no-array-callback-reference,unicorn/no-array-reduce
    return arguments_.reduce<ArgumentsAndLastOption<OD>>(removeBooleanArguments, { args: [] }).args;
};

export default removeBooleanValues;
