import type { PossibleOptionDefinition } from "../../@types/command";
import getParameterOption from "./get-parameter-option";
import isBoolean from "./option-is-boolean";

type ArgumentsAndLastOption<T> = { args: string[]; lastOption?: PossibleOptionDefinition<T> };

const booleanValue = new Set(["1", "0", "true", "false"]);

/**
 * commandLineArgs throws an error if we pass aa value for a boolean arg as follows:
 * myCommand -a=true --booleanArg=false --otherArg true
 * this function removes these booleans so as to avoid errors from commandLineArgs
 */

const removeBooleanValues = <T>(arguments_: string[], options: PossibleOptionDefinition<T>[]): string[] => {
    const removeBooleanArguments = (argumentsAndLastValue: ArgumentsAndLastOption<T>, argument: string): ArgumentsAndLastOption<T> => {
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

        return { args: [...argumentsAndLastValue.args, argument], lastOption: option as PossibleOptionDefinition<T> };
    };

    // eslint-disable-next-line unicorn/no-array-callback-reference,unicorn/no-array-reduce
    return arguments_.reduce<ArgumentsAndLastOption<T>>(removeBooleanArguments, { args: [] }).args;
};

export default removeBooleanValues;
