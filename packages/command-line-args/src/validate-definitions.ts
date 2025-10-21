import { InvalidDefinitionsError } from "./errors/index";
import type { OptionDefinition, ParseOptions } from "./types";
import debugLog from "./utils/debug";

/**
 * Check if a type is boolean.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isBooleanType = (type: any): boolean => type && (type === Boolean || (typeof type === "function" && type.name?.startsWith("Boolean")));

/**
 * Validate option definitions and throw errors for invalid configurations.
 * Checks for naming conflicts, invalid aliases, duplicate options, type validity,
 * and other definition issues.
 * @param definitions Array of option definitions to validate
 * @param caseInsensitive Whether to check for case-insensitive conflicts
 * @param debugOptions Optional debug options containing debug flag
 * @throws {InvalidDefinitionsError} If any validation rule is violated
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
const validateDefinitions = (definitions: ReadonlyArray<OptionDefinition>, caseInsensitive?: boolean, debugOptions?: ParseOptions): void => {
    const debugEnabled = debugOptions?.debug || false;

    debugLog(debugEnabled, "Validating definitions:", "validation", definitions, "caseInsensitive:", caseInsensitive);

    const names = new Set<string>();
    const aliases = new Set<string>();
    const namesLower = new Set<string>();
    const aliasesLower = new Set<string>();

    let defaultOptionCount = 0;

    for (const definition of definitions) {
        debugLog(debugEnabled, "Checking definition:", "validation", definition);

        // Check required name property
        if (!definition.name) {
            debugLog(debugEnabled, "Validation failed: name is required", "validation");
            throw new InvalidDefinitionsError("Invalid option definition: name is required");
        }

        if (typeof definition.name !== "string") {
            throw new InvalidDefinitionsError("Invalid option definition: name must be a string");
        }

        if (definition.name.trim() === "") {
            throw new InvalidDefinitionsError("Invalid option definition: name cannot be empty");
        }

        // Check for duplicate names (case-sensitive and case-insensitive)
        const nameLower = definition.name.toLowerCase();

        if (names.has(definition.name) || (caseInsensitive && namesLower.has(nameLower))) {
            throw new InvalidDefinitionsError(`Invalid option definition: duplicate name '${definition.name}'`);
        }

        names.add(definition.name);

        if (caseInsensitive) {
            namesLower.add(nameLower);
        }

        // Check alias if provided
        if (definition.alias !== undefined) {
            if (typeof definition.alias !== "string") {
                throw new InvalidDefinitionsError("Invalid option definition: alias must be a string");
            }

            if (definition.alias.length !== 1) {
                throw new InvalidDefinitionsError("Invalid option definition: alias must be a single character");
            }

            if (/\d/.test(definition.alias)) {
                throw new InvalidDefinitionsError("Invalid option definition: alias cannot be numeric");
            }

            if (definition.alias === "-") {
                throw new InvalidDefinitionsError("Invalid option definition: alias cannot be \"-\"");
            }

            // Check for duplicate aliases (case-sensitive and case-insensitive)
            const aliasLower = definition.alias.toLowerCase();

            if (aliases.has(definition.alias) || (caseInsensitive && aliasesLower.has(aliasLower))) {
                throw new InvalidDefinitionsError(`Invalid option definition: duplicate alias '${definition.alias}'`);
            }

            aliases.add(definition.alias);

            if (caseInsensitive) {
                aliasesLower.add(aliasLower);
            }
        }

        // Check defaultOption
        if (definition.defaultOption) {
            // eslint-disable-next-line no-plusplus
            defaultOptionCount++;

            // defaultOption cannot be Boolean type
            if (definition.type !== undefined && isBooleanType(definition.type)) {
                throw new InvalidDefinitionsError("Invalid option definition: defaultOption cannot be Boolean type");
            }
        }

        // Check for valid type
        if (definition.type !== undefined) {
            const isValidType
                = definition.type === Boolean
                    || definition.type === Number
                    || definition.type === String
                    || (typeof definition.type === "function" && definition.type.name === "Boolean")
                    || (typeof definition.type === "function" && definition.type.name === "Number")
                    || (typeof definition.type === "function" && definition.type.name === "String")
                    || (typeof definition.type === "function" && definition.type("test") !== undefined); // Test custom function

            if (!isValidType) {
                throw new InvalidDefinitionsError("Invalid option definition: invalid type");
            }
        }
    }

    // Check for multiple defaultOptions
    if (defaultOptionCount > 1) {
        debugLog(debugEnabled, "Validation failed: multiple defaultOptions not allowed", "validation");
        throw new InvalidDefinitionsError("Invalid option definition: multiple defaultOptions not allowed");
    }

    debugLog(debugEnabled, "Validation completed successfully", "validation");
};

export default validateDefinitions;
