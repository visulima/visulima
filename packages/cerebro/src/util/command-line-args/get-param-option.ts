import type { OptionDefinition } from "../../@types/command";

const argumentNameRegExp = /^-{1,2}(\w+)(=(\w+))?$/;

const getParameterOption = <T>(argument: string, options: OptionDefinition<T>[]): { argName?: string; argValue?: string; option?: OptionDefinition<T> } => {
    const regExpResult = argumentNameRegExp.exec(argument);

    if (regExpResult == null) {
        return {};
    }

    const nameOrAlias = regExpResult[1];

    const option = options.find((option) => option.name === nameOrAlias || option.alias === nameOrAlias);

    if (option !== undefined) {
        return { argName: option.name, argValue: regExpResult[3] as string, option };
    }

    return {};
};

export default getParameterOption;
