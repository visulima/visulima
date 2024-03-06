import type { PossibleOptionDefinition } from "../../@types/command";
import getParameterOption from "./get-parameter-option";
import isBoolean from "./option-is-boolean";

type PartialAndLastOption<T> = {
    lastName?: string | undefined;
    lastOption?: PossibleOptionDefinition<T> | undefined;
    partial: Partial<T>;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const convertType = <T>(value: any, option: PossibleOptionDefinition<T>): any => {
    if (option.type === undefined) {
        return value;
    }

    if (option.type.name === "Boolean") {
        if (value === "true" || value === "1") {
            return option.type(true);
        }

        if (value === "false" || value === "0") {
            return option.type(false);
        }
    }

    return option.type(value);
};

const booleanValue = new Set(["1", "0", "true", "false"]);

/**
 * Gets the values of any boolean arguments that were specified on the command line with a value
 * These arguments were removed by removeBooleanValues
 */
const getBooleanValues = <T>(arguments_: string[], options: PossibleOptionDefinition<T>[]): Partial<T> => {
    const getBooleanValue = (argumentsAndLastOption: PartialAndLastOption<T>, argument: string): PartialAndLastOption<T> => {
        const { argName, argValue, option } = getParameterOption<T>(argument, options);

        const { lastOption } = argumentsAndLastOption;

        if (option && isBoolean(option) && argValue && argName) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any,no-param-reassign
            argumentsAndLastOption.partial[argName as keyof PartialAndLastOption<T>["partial"]] = convertType(argValue, option) as any;
        } else if (argumentsAndLastOption.lastName && lastOption && isBoolean(lastOption) && booleanValue.has(argument)) {
            // eslint-disable-next-line no-param-reassign
            argumentsAndLastOption.partial[argumentsAndLastOption.lastName as keyof PartialAndLastOption<T>["partial"]] = convertType(
                argument,
                lastOption,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ) as any;
        }

        return { lastName: argName, lastOption: option, partial: argumentsAndLastOption.partial };
    };

    // eslint-disable-next-line unicorn/no-array-callback-reference,unicorn/no-array-reduce
    return arguments_.reduce<PartialAndLastOption<T>>(getBooleanValue, { partial: {} }).partial;
};

export default getBooleanValues;
