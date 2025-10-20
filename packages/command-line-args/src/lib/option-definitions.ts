import arrayify from "array-back";
import t from "typical";

import { getOptionName, isOption, re } from "./argv-tools";
import Definition from "./option-definition";

/**
 * @module option-definitions
 */

/**
 * @alias module:option-definitions
 */
class Definitions extends Array {
    /**
     * validate option definitions
     * @param [caseInsensitive] whether arguments will be parsed in a case insensitive manner
     * @returns
     */
    validate(caseInsensitive?: boolean): void {
        const someHaveNoName = this.some((def: any) => !def.name);

        if (someHaveNoName) {
            halt("INVALID_DEFINITIONS", "Invalid option definitions: the `name` property is required on each definition");
        }

        const someDontHaveFunctionType = this.some((def: any) => def.type && typeof def.type !== "function");

        if (someDontHaveFunctionType) {
            halt("INVALID_DEFINITIONS", "Invalid option definitions: the `type` property must be a setter fuction (default: `Boolean`)");
        }

        let invalidOption: any;

        const numericAlias = this.some((def: any) => {
            invalidOption = def;

            return t.isDefined(def.alias) && t.isNumber(def.alias);
        });

        if (numericAlias) {
            halt(
                "INVALID_DEFINITIONS",
                `Invalid option definition: to avoid ambiguity an alias cannot be numeric [--${invalidOption.name} alias is -${invalidOption.alias}]`,
            );
        }

        const multiCharacterAlias = this.some((def: any) => {
            invalidOption = def;

            return t.isDefined(def.alias) && def.alias.length !== 1;
        });

        if (multiCharacterAlias) {
            halt("INVALID_DEFINITIONS", "Invalid option definition: an alias must be a single character");
        }

        const hypenAlias = this.some((def: any) => {
            invalidOption = def;

            return def.alias === "-";
        });

        if (hypenAlias) {
            halt("INVALID_DEFINITIONS", "Invalid option definition: an alias cannot be \"-\"");
        }

        const duplicateName = hasDuplicates(this.map((def: any) => (caseInsensitive ? def.name.toLowerCase() : def.name)));

        if (duplicateName) {
            halt("INVALID_DEFINITIONS", "Two or more option definitions have the same name");
        }

        const duplicateAlias = hasDuplicates(this.map((def: any) => (caseInsensitive && t.isDefined(def.alias) ? def.alias.toLowerCase() : def.alias)));

        if (duplicateAlias) {
            halt("INVALID_DEFINITIONS", "Two or more option definitions have the same alias");
        }

        const duplicateDefaultOption = this.filter((def: any) => def.defaultOption === true).length > 1;

        if (duplicateDefaultOption) {
            halt("INVALID_DEFINITIONS", "Only one option definition can be the defaultOption");
        }

        const defaultBoolean = this.some((def: any) => {
            invalidOption = def;

            return def.isBoolean() && def.defaultOption;
        });

        if (defaultBoolean) {
            halt("INVALID_DEFINITIONS", `A boolean option ["${invalidOption.name}"] can not also be the defaultOption.`);
        }
    }

    /**
     * Get definition by option arg (e.g. `--one` or `-o`)
     * @param [arg] the argument name to get the definition for
     * @param [caseInsensitive] whether to use case insensitive comparisons when finding the appropriate definition
     * @returns
     */
    get(argument: string, caseInsensitive?: boolean): any {
        if (isOption(argument)) {
            if (re.short.test(argument)) {
                const shortOptionName = getOptionName(argument);

                if (caseInsensitive) {
                    const lowercaseShortOptionName = shortOptionName.toLowerCase();

                    return this.find((def: any) => t.isDefined(def.alias) && def.alias.toLowerCase() === lowercaseShortOptionName);
                }

                return this.find((def: any) => def.alias === shortOptionName);
            }

            const optionName = getOptionName(argument);

            if (caseInsensitive) {
                const lowercaseOptionName = optionName.toLowerCase();

                return this.find((def: any) => def.name.toLowerCase() === lowercaseOptionName);
            }

            return this.find((def: any) => def.name === optionName);
        }

        return this.find((def: any) => def.name === argument);
    }

    getDefault(): any {
        return this.find((def: any) => def.defaultOption === true);
    }

    isGrouped(): boolean {
        return this.some((def: any) => def.group);
    }

    whereGrouped(): any[] {
        return this.filter(containsValidGroup);
    }

    whereNotGrouped(): any[] {
        return this.filter((def: any) => !containsValidGroup(def));
    }

    whereDefaultValueSet(): any[] {
        return this.filter((def: any) => t.isDefined(def.defaultValue));
    }

    static from(definitions: any[], caseInsensitive?: boolean): Definitions {
        if (definitions instanceof this)
            return definitions;

        const result = super.from(arrayify(definitions), (def: any) => Definition.create(def));

        result.validate(caseInsensitive);

        return result;
    }
}

const halt = (name: string, message: string): never => {
    const error = new Error(message);

    error.name = name;
    throw error;
};

const containsValidGroup = (def: any): boolean => {
    return arrayify(def.group).some(Boolean);
};

const hasDuplicates = (array: any[]): boolean => {
    const items: Record<string, boolean> = {};

    for (const value of array) {
        if (items[value]) {
            return true;
        }

        if (t.isDefined(value))
            items[value] = true;
    }

    return false;
};

export default Definitions;
