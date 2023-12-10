import type { OptionDefinition } from "../../@types/command";
import getParameterOption from "./get-param-option";
import isBoolean from "./option-is-boolean";

type PartialAndLastOption<T> = {
    lastName?: string | undefined;
    lastOption?: OptionDefinition<T> | undefined;
    partial: Partial<T>;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const convertType = <T>(value: any, option: OptionDefinition<T>): any => {
    if (option.type === undefined) {
        return value;
    }

    if (option.type.name === "Boolean") {
        switch (value) {
            case "true":
            case "1": {
                return option.type(true);
            }
            case "false":
            case "0": {
                return option.type(false);
            }
        }
    }

    return option.type(value);
};

const booleanValue = new Set(["1", "0", "true", "false"]);

/**
 * Gets the values of any boolean arguments that were specified on the command line with a value
 * These arguments were removed by removeBooleanValues
 */
const getBooleanValues = <T>(arguments_: string[], options: OptionDefinition<T>[]): Partial<T> => {
    function getBooleanValues(argumentsAndLastOption: PartialAndLastOption<T>, argument: string): PartialAndLastOption<T> {
        const { argName, argValue, option } = getParameterOption<T>(argument, options);

        const { lastOption } = argumentsAndLastOption;

        if (option && isBoolean(option) && argValue && argName) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            argumentsAndLastOption.partial[argName as keyof PartialAndLastOption<T>["partial"]] = convertType(argValue, option) as any;
        } else if (argumentsAndLastOption.lastName && lastOption && isBoolean(lastOption) && booleanValue.has(argument)) {
             
            argumentsAndLastOption.partial[argumentsAndLastOption.lastName as keyof PartialAndLastOption<T>["partial"]] = convertType(
                argument,
                lastOption,
            ) as any;
        }

        return { lastName: argName, lastOption: option, partial: argumentsAndLastOption.partial };
    }

    return arguments_.reduce<PartialAndLastOption<T>>(getBooleanValues, { partial: {} }).partial;
};

export default getBooleanValues;
