// eslint-disable-next-line import/no-extraneous-dependencies
import camelCase from "@visulima/string/case/camel-case";

import type { OptionDefinition } from "../../types/command";
import type { Toolbox as IToolbox } from "../../types/toolbox";

/**
 * Converts option names to camelCase and adds them as __camelCaseName__ properties
 * @template OD - The option definition type
 * @param command The command object containing options to process
 */
export const processOptionNames = <OD extends OptionDefinition<unknown>>(command: { options?: OD[] }): void => {
    command.options?.forEach((option) => {
        // eslint-disable-next-line no-underscore-dangle,no-param-reassign
        option.__camelCaseName__ = camelCase(option.name);
    });
};

/**
 * Adds negatable options for boolean flags
 * For options starting with "no-", creates a corresponding non-negated option
 * Optimized with Set lookup for better performance
 * @template OD - The option definition type
 * @param command The command object to add negatable options to
 * @throws {Error} When a negated option is not of type Boolean
 */
export const addNegatableOptions = <OD extends OptionDefinition<unknown>>(command: { name: string; options?: OD[] }): void => {
    if (!Array.isArray(command.options) || command.options.length === 0) {
        return;
    }

    // Build a Set of option names for O(1) lookups instead of O(n) array.some()
    const optionNames = new Set<string>();

    for (const option of command.options) {
        optionNames.add(option.name);
    }

    const optionsToAdd: OD[] = [];

    for (const option of command.options) {
        if (option.name.startsWith("no-")) {
            const nonNegatedName = option.name.replace("no-", "");

            // Use Set lookup instead of array.some()
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

    // Add all new options at once
    if (optionsToAdd.length > 0) {
        (command.options as OD[]).push(...optionsToAdd);
    }
};

/**
 * Maps negatable options to their non-negated counterparts
 * Processes toolbox options starting with "no" and converts them to non-negated form
 * Optimized with Map lookup for better performance
 * @param toolbox The command toolbox containing options
 * @param command The command object with option definitions
 */
export const mapNegatableOptions = (toolbox: IToolbox, command: { options?: OptionDefinition<unknown>[] }): void => {
    if (!command.options || command.options.length === 0) {
        return;
    }

    // Optimize: early return if no options start with "no-"
    const options = toolbox.options as IToolbox["options"];
    const negatableKeys = Object.keys(options).filter((key) => key.startsWith("no-"));

    if (negatableKeys.length === 0) {
        return;
    }

    // Build a Map for O(1) lookups instead of O(n) array iteration
    const optionMapByName = new Map<string, OptionDefinition<unknown>>();

    for (const option of command.options) {
        optionMapByName.set(option.name, option);
    }

    for (const key of negatableKeys) {
        const nonNegatedKey: string = key.replace(/^no-/, "");
        const option = optionMapByName.get(nonNegatedKey);

        if (option) {
            // eslint-disable-next-line no-underscore-dangle
            option.__negated__ = true;
        }

        options[nonNegatedKey] = !options[key];
    }
};

/**
 * Applies implied option values
 * Sets implied option values from option definitions that have an implies property
 * Optimized with Map lookup for better performance
 * @param toolbox The command toolbox to apply implied values to
 * @param command The command object with option definitions
 */
export const mapImpliedOptions = (toolbox: IToolbox, command: { options?: OptionDefinition<unknown>[] }): void => {
    if (!command.options || command.options.length === 0) {
        return;
    }

    // Build a Map keyed by camelCase name for O(1) lookups instead of O(n) array.find()
    const optionMapByCamelCase = new Map<string, OptionDefinition<unknown>>();

    for (const option of command.options) {
        // eslint-disable-next-line no-underscore-dangle
        if (option.__camelCaseName__ && option.__negated__ === undefined && option.implies !== undefined) {
            // eslint-disable-next-line no-underscore-dangle
            optionMapByCamelCase.set(option.__camelCaseName__, option);
        }
    }

    // Optimize: early return if no options have implies
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
                // Note: We don't override explicitly set options
            }
        }
    }
};
