import type { OptionDefinition, PossibleOptionDefinition } from "../../types/command";

const argumentNameRegExp = /^-{1,2}(\w+)(=(\w+))?$/;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getParameterOption = <OD extends OptionDefinition<any>>(
    argument: string,
    options: PossibleOptionDefinition<OD>[],
    optionMapByName?: Map<string, PossibleOptionDefinition<OD>>,
    optionMapByAlias?: Map<string, PossibleOptionDefinition<OD>>,
): {
    argName?: string;
    argValue?: string;
    option?: PossibleOptionDefinition<OD>;
} => {
    const regExpResult = argumentNameRegExp.exec(argument);

    if (regExpResult === undefined || regExpResult === null) {
        return {};
    }

    const nameOrAlias = regExpResult[1];

    const option: PossibleOptionDefinition<OD> | undefined
        = optionMapByName && optionMapByAlias
            ? optionMapByName.get(nameOrAlias) ?? optionMapByAlias.get(nameOrAlias)
            : options.find((o) => o.name === nameOrAlias || o.alias === nameOrAlias);

    if (option !== undefined) {
        return { argName: option.name, argValue: regExpResult[3] as string, option };
    }

    return {};
};

export default getParameterOption;
