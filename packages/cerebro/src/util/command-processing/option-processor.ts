import camelCase from "@visulima/string/case/camel-case";

import type { OptionDefinition } from "../../@types/command";
import type { Toolbox as IToolbox } from "../../@types/toolbox";

/**
 * Adds camelCase names to options
 */
export const processOptionNames = <OD extends OptionDefinition<unknown>>(command: { options?: OD[] }): void => {
    command.options?.forEach((option) => {
        // eslint-disable-next-line no-underscore-dangle,no-param-reassign
        option.__camelCaseName__ = camelCase(option.name);
    });
};

/**
 * Adds negatable options for boolean flags
 */
export const addNegatableOptions = <OD extends OptionDefinition<unknown>>(command: { name: string; options?: OD[] }): void => {
    if (Array.isArray(command.options)) {
        command.options.forEach((option) => {
            if (option.name.startsWith("no-") && !(command.options as OD[]).some((o) => o.name === option.name.replace("no-", ""))) {
                if (option.type !== Boolean) {
                    throw new Error(`Cannot add negated option "${option.name}" to command "${command.name}" because it is not a boolean.`);
                }

                const negatedOption = {
                    ...option,
                    defaultValue: option.defaultValue === undefined ? true : !option.defaultValue,
                    name: `${option.name.replace("no-", "")}`,
                } as OD;

                (command.options as OD[]).push(negatedOption);
            }
        });
    }
};

/**
 * Maps negatable options to their non-negated counterparts
 */
export const mapNegatableOptions = (toolbox: IToolbox, command: { options?: OptionDefinition<unknown>[] }): void => {
    Object.entries(toolbox.options as IToolbox["options"]).forEach(([key, value]) => {
        if (key.startsWith("no")) {
            const nonNegatedKey: string = key.replace(/^no-?/, "");

            command.options?.forEach((option) => {
                if (option.name === nonNegatedKey) {
                    // eslint-disable-next-line no-underscore-dangle,no-param-reassign
                    option.__negated__ = true;
                }
            });

            // eslint-disable-next-line no-param-reassign
            toolbox.options[nonNegatedKey] = !value;
        }
    });
};

/**
 * Applies implied option values
 */
export const mapImpliedOptions = (toolbox: IToolbox, command: { options?: OptionDefinition<unknown>[] }): void => {
    Object.keys(toolbox.options as IToolbox["options"]).forEach((optionKey) => {
        const option = command.options?.find(
            // eslint-disable-next-line no-underscore-dangle
            (o) => o.__camelCaseName__ === optionKey && o.__negated__ === undefined && o.implies !== undefined,
        );

        if (option?.implies) {
            const implies = option.implies as Record<string, unknown>;

            Object.entries(implies).forEach(([key, value]) => {
                if (toolbox.options[key] === undefined) {
                    // eslint-disable-next-line no-param-reassign
                    toolbox.options[key] = value;
                }
                // Note: We don't override explicitly set options
            });
        }
    });
};
