import type { PossibleOptionDefinition } from "../../@types/command";

// eslint-disable-next-line security/detect-unsafe-regex
const argumentNameRegExp = /^-{1,2}(\w+)(=(\w+))?$/;

const getParameterOption = <T>(
    argument: string,
    options: PossibleOptionDefinition<T>[],
): {
    argName?: string;
    argValue?: string;
    option?: PossibleOptionDefinition<T>;
} => {
    const regExpResult = argumentNameRegExp.exec(argument);

    if (regExpResult == null) {
        return {};
    }

    const nameOrAlias = regExpResult[1];

    const option = options.find((o) => o.name === nameOrAlias || o.alias === nameOrAlias);

    if (option !== undefined) {
        return { argName: option.name, argValue: regExpResult[3] as string, option };
    }

    return {};
};

export default getParameterOption;
