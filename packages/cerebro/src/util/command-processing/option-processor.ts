// eslint-disable-next-line import/no-extraneous-dependencies
import camelCase from "@visulima/string/case/camel-case";

import type { OptionDefinition } from "../../types/command";
import type { Toolbox as IToolbox } from "../../types/toolbox";

/**
 * Converts option names to camelCase and adds them as __camelCaseName__ properties.
 * @template OD The option definition type
 * @param command The command object containing options to process
 * @param command.options The options array to process
 */
export const processOptionNames = <OD extends OptionDefinition<unknown>>(command: { options?: OD[] }): void => {
    command.options?.forEach((option) => {
        // eslint-disable-next-line no-param-reassign
        option.__camelCaseName__ = camelCase(option.name);
    });
};

/**
 * Adds negatable options for boolean flags.
 * For options starting with "no-", creates a corresponding non-negated option.
 * @template OD The option definition type
 * @param command The command object to add negatable options to
 * @param command.name The name of the command (used for error messages)
 * @param command.options The array of option definitions to process
 * @throws {Error} When a negated option is not of type Boolean
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
export const addNegatableOptions = <OD extends OptionDefinition<unknown>>(command: { name: string; options?: OD[] }): void => {
    if (!Array.isArray(command.options) || command.options.length === 0) {
        return;
    }

    const optionNames = new Set<string>();

    for (const option of command.options) {
        optionNames.add(option.name);
    }

    const optionsToAdd: OD[] = [];

    for (const option of command.options) {
        if (option.name.startsWith("no-")) {
            const nonNegatedName = option.name.replace("no-", "");

            if (!optionNames.has(nonNegatedName)) {
                if (option.type !== Boolean) {
                    throw new Error(`Cannot add negated option "${option.name}" to command "${command.name}" because it is not a boolean.`);
                }

                const negatedOption = {
                    ...option,
                    defaultValue: option.defaultValue === undefined ? true : !option.defaultValue,
                    name: nonNegatedName,
                } as OD;

                optionsToAdd.push(negatedOption);
                optionNames.add(nonNegatedName);
            }
        }
    }

    if (optionsToAdd.length > 0) {
        (command.options as OD[]).push(...optionsToAdd);
    }
};

/**
 * Maps negatable options to their non-negated counterparts.
 * Processes toolbox options starting with "no" and converts them to non-negated form.
 * @param toolbox The command toolbox containing options
 * @param command The command object with option definitions
 * @param command.options The command options array
 */
export const mapNegatableOptions = <O extends OptionDefinition<unknown>, TLogger extends Console = Console>(
    toolbox: IToolbox<TLogger>,
    command: {
        options?: ReadonlyArray<
            | O
            | OptionDefinition<boolean[]>
            | OptionDefinition<boolean>
            | OptionDefinition<number[]>
            | OptionDefinition<number>
            | OptionDefinition<string[]>
            | OptionDefinition<string>
        >;
    },
): void => {
    if (!command.options || command.options.length === 0) {
        return;
    }

    const options = toolbox.options as IToolbox["options"];
    const negatableKeys = Object.keys(options).filter((key) => key.startsWith("no-"));

    if (negatableKeys.length === 0) {
        return;
    }

    const optionMapByName = new Map<string, OptionDefinition<unknown>>();

    for (const option of command.options) {
        optionMapByName.set(option.name, option as OptionDefinition<unknown>);
    }

    for (const key of negatableKeys) {
        const nonNegatedKey: string = key.replace(/^no-/, "");
        const option = optionMapByName.get(nonNegatedKey);

        if (option) {
            option.__negated__ = true;
        }

        options[nonNegatedKey] = !options[key];
    }
};

/**
 * Applies implied option values.
 * Sets implied option values from option definitions that have an implies property.
 * @param toolbox The command toolbox to apply implied values to
 * @param command The command object with option definitions
 * @param command.options The command options array
 */

export const mapImpliedOptions = <O extends OptionDefinition<unknown>, TLogger extends Console = Console>(
    toolbox: IToolbox<TLogger>,
    command: {
        options?: ReadonlyArray<
            | O
            | OptionDefinition<boolean[]>
            | OptionDefinition<boolean>
            | OptionDefinition<number[]>
            | OptionDefinition<number>
            | OptionDefinition<string[]>
            | OptionDefinition<string>
        >;
    },
    // eslint-disable-next-line sonarjs/cognitive-complexity
): void => {
    if (!command.options || command.options.length === 0) {
        return;
    }

    const optionMapByCamelCase = new Map<string, OptionDefinition<unknown>>();

    for (const option of command.options) {
        if (option.__camelCaseName__ && option.__negated__ === undefined && option.implies !== undefined) {
            optionMapByCamelCase.set(option.__camelCaseName__, option as OptionDefinition<unknown>);
        }
    }

    if (optionMapByCamelCase.size === 0) {
        return;
    }

    const options = toolbox.options as IToolbox["options"];

    for (const optionKey of Object.keys(options)) {
        const option = optionMapByCamelCase.get(optionKey);

        if (option?.implies) {
            const implies = option.implies as Record<string, unknown>;

            for (const [key, value] of Object.entries(implies)) {
                if (options[key] === undefined) {
                    options[key] = value;
                }
            }
        }
    }
};
