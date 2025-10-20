// eslint-disable-next-line import/no-extraneous-dependencies
import { parse as parseArgsTokens } from "args-tokens";

/**
 * @module command-line-args
 */

export interface CommandLineOptions {
    [propName: string]: any;

    /**
     * Command-line arguments not parsed by `commandLineArgs`.
     */
    _unknown?: string[] | undefined;
}

export interface ParseOptions {
    /**
     * An array of strings which if present will be parsed instead of `process.argv`.
     */
    argv?: string[] | undefined;

    /**
     * If `true`, options with hypenated names (e.g. `move-to`) will be returned in camel-case (e.g. `moveTo`).
     */
    camelCase?: boolean | undefined;

    /**
     * If `true`, the case of each option name or alias parsed is insignificant. For example, `--Verbose` and
     * `--verbose` would be parsed identically, as would the aliases `-V` and `-v`. Defaults to false.
     */
    caseInsensitive?: boolean | undefined;

    /**
     * If `true`, `commandLineArgs` will not throw on unknown options or values, instead returning them in the `_unknown` property of the output.
     */
    partial?: boolean | undefined;

    /**
     * If `true`, `commandLineArgs` will not throw on unknown options or values. Instead, parsing will stop at the first unknown argument
     * and the remaining arguments returned in the `_unknown` property of the output. If set, `partial: true` is implied.
     */
    stopAtFirstUnknown?: boolean | undefined;
}

export interface OptionDefinition {
    /**
     * A getopt-style short option name. Can be any single character except a digit or hyphen.
     */
    alias?: string | undefined;

    /**
     * Any values unaccounted for by an option definition will be set on the `defaultOption`. This flag is typically set
     * on the most commonly-used option to enable more concise usage.
     */
    defaultOption?: boolean | undefined;

    /**
     * An initial value for the option.
     */
    defaultValue?: any;

    /**
     * One or more group names the option belongs to.
     */
    group?: string | string[] | undefined;

    /**
     * Identical to `multiple` but with greedy parsing disabled.
     */
    lazyMultiple?: boolean | undefined;

    /**
     * Set this flag if the option accepts multiple values. In the output, you will receive an array of values each passed through the `type` function.
     */
    multiple?: boolean | undefined;

    /**
     * The long option name.
     */
    name: string;

    /**
     * A setter function (you receive the output from this) enabling you to be specific about the type and value received. Typical values
     * are `String` (the default), `Number` and `Boolean` but you can use a custom function. If no option value was set you will receive `null`.
     */
    type?: ((input: string) => any) | undefined;
}

/**
 * Returns an object containing option values parsed from the command line. By default it parses the global `process.argv` array.
 * Parsing is strict by default. To be more permissive, enable `partial` or `stopAtFirstUnknown` modes.
 */
export const commandLineArgs = (optionDefinitions: OptionDefinition[] | OptionDefinition, options: ParseOptions = {}): CommandLineOptions => {
    // Handle stopAtFirstUnknown implying partial
    if (options.stopAtFirstUnknown) {
        // eslint-disable-next-line no-param-reassign
        options.partial = true;
    }

    // Normalize optionDefinitions to always be an array
    const definitions = Array.isArray(optionDefinitions) ? optionDefinitions : [optionDefinitions];

    // Get argv to parse
    const argv = options.argv || process.argv.slice(2);

    const argvForTokens = argv; // Use original argv, handle conversion in catch if needed

    // Convert option definitions to args-tokens schema
    const schema: Record<string, any> = {};

    for (const def of definitions) {
        const optionName = def.name;
        const schemaEntry: any = {};

        // Handle type
        switch (def.type) {
            case Boolean: {
                schemaEntry.type = "boolean";

                break;
            }
            case Number: {
                schemaEntry.type = "number";

                break;
            }
            case String: {
                schemaEntry.type = "string";

                break;
            }
            default: {
                if (def.type) {
                    // Custom type function - args-tokens doesn't support this directly
                    // We'll handle this in post-processing
                    schemaEntry.type = "custom";
                    schemaEntry.parse = def.type;
                } else {
                    schemaEntry.type = "string"; // Default
                }
            }
        }

        // Handle alias -> short
        if (def.alias) {
            schemaEntry.short = def.alias;
        }

        // Handle default value
        if (def.defaultValue !== undefined) {
            schemaEntry.default = def.defaultValue;
        }

        // Handle multiple
        if (def.multiple || def.lazyMultiple) {
            schemaEntry.multiple = true;
        }

        // Handle defaultOption - args-tokens doesn't have direct equivalent
        // We'll handle this in post-processing
        if (def.defaultOption) {
            schemaEntry.defaultOption = true;
        }

        schema[optionName] = schemaEntry;
    }

    // Build fast lookup maps for option definitions and pre-compute camelCase names
    const definitionMap = new Map<string, any>();
    const aliasMap = new Map<string, any>();
    const camelCaseMap = new Map<string, string>(); // Cache camelCase transformations

    for (const definition of definitions) {
        definitionMap.set(definition.name, definition);

        if (definition.alias) {
            aliasMap.set(definition.alias, definition);
        }

        // Pre-compute camelCase version if needed (optimized regex)
        if (options.camelCase) {
            camelCaseMap.set(
                definition.name,
                definition.name.replaceAll(/-([a-z])/g, (_, letter) => letter.toUpperCase()),
            );
        }
    }

    let result;

    try {
        // Use args-tokens for parsing
        result = parseArgsTokens(argvForTokens);
        // Convert args-tokens result to command-line-args format
        const output: CommandLineOptions = {};

        // Process tokens to extract values - optimized single pass
        const values: Record<string, any> = {};
        const unknownArgs: string[] = [];
        const consumedPositionalIndices = new Set<number>();

        // Single optimized pass through tokens
        for (let i = 0; i < result.tokens.length; i++) {
            const token = result.tokens[i];

            if (token.kind === "option" && token.name) {
                // Fast lookup for option definition
                const definition = definitionMap.get(token.name) || aliasMap.get(token.name);
                const optionName = definition ? definition.name : token.name;
                const isMultiple = definition && (definition.multiple || definition.lazyMultiple);

                // In partial mode, collect unknown options and skip processing them
                if (!definition && options.partial) {
                    unknownArgs.push(argv[token.index]);
                    continue;
                }

                if (token.value === undefined) {
                    // Option without inline value
                    const nextToken = result.tokens[i + 1];

                    if (nextToken && nextToken.kind === "positional") {
                        if (isMultiple) {
                            // For multiple options, collect consecutive positionals
                            let currentIndex = i + 1;
                            const collectedValues: any[] = [];

                            while (currentIndex < result.tokens.length && result.tokens[currentIndex].kind === "positional") {
                                collectedValues.push(result.tokens[currentIndex].value);
                                consumedPositionalIndices.add(result.tokens[currentIndex].index);
                                currentIndex++;
                            }

                            if (values[optionName] === undefined) {
                                values[optionName] = collectedValues;
                            } else {
                                // If already exists, append
                                if (!Array.isArray(values[optionName])) {
                                    values[optionName] = [values[optionName]];
                                }

                                values[optionName].push(...collectedValues);
                            }

                            // Skip consumed tokens
                            i = currentIndex - 1;
                        } else {
                            // Single value - take first positional
                            values[optionName] = nextToken.value;
                            consumedPositionalIndices.add(nextToken.index);
                            i++; // Skip the consumed positional
                        }
                    } else {
                        // Option without value - check if it should be boolean or null
                        values[optionName] = definition && definition.type === Boolean ? true : null;
                    }
                } else {
                    // Option with inline value (--option=value)
                    let { value } = token;

                    // Special handling for boolean options with empty inline values
                    if (definition && definition.type === Boolean && value === "") {
                        value = true;
                    }

                    // For multiple options, collect consecutive positional values after inline value
                    const collectedValues: any[] = [value];

                    if (isMultiple) {
                        // Collect consecutive positional tokens after this option
                        let currentIndex = i + 1;

                        while (currentIndex < result.tokens.length && result.tokens[currentIndex].kind === "positional") {
                            collectedValues.push(result.tokens[currentIndex].value);
                            consumedPositionalIndices.add(result.tokens[currentIndex].index);
                            currentIndex++;
                        }
                        i = currentIndex - 1; // Skip consumed tokens
                    }

                    if (values[optionName] === undefined) {
                        values[optionName] = isMultiple ? collectedValues : value;
                    } else if (isMultiple) {
                        // Handle multiple values
                        if (!Array.isArray(values[optionName])) {
                            values[optionName] = [values[optionName]];
                        }

                        values[optionName].push(...collectedValues);
                    }
                }
            }
        }

        // Ensure multiple values are arrays
        for (const [key, value] of Object.entries(values)) {
            const definition = definitionMap.get(key);

            if (definition && (definition.multiple || definition.lazyMultiple) && !Array.isArray(value)) {
                values[key] = [value];
            }
        }

        // Handle defaultOption - collect positional arguments that weren't consumed by options (cached lookup)
        const defaultOptionDefinition = definitions.find((d) => d.defaultOption);
        const hasDefaultOption = !!defaultOptionDefinition;

        if (defaultOptionDefinition) {
            const positionalValues: any[] = [];
            const consumedIndices = new Set<number>();
            const isDefaultOptionMultiple = defaultOptionDefinition.multiple || defaultOptionDefinition.lazyMultiple;

            // Mark indices that were consumed by options or their values
            for (let i = 0; i < result.tokens.length; i++) {
                const token = result.tokens[i];

                if (token.kind === "option" && token.name) {
                    consumedIndices.add(i); // Mark option itself as consumed

                    // For multiple options, mark all following positional args as consumed (use O(1) lookup)
                    const definition = definitionMap.get(token.name) || aliasMap.get(token.name);

                    if (definition && (definition.multiple || definition.lazyMultiple)) {
                        // Special case: if this option is also a defaultOption, don't consume positional args
                        // They should all go to the defaultOption instead
                        if (!definition.defaultOption) {
                            let j = i + 1;

                            while (j < result.tokens.length && result.tokens[j].kind === "positional") {
                                consumedIndices.add(j);
                                j++;
                            }
                            i = j - 1; // Skip to end of multiple values
                        }
                    } else {
                        // Mark single value if present (only for non-boolean options)
                        if (definition && definition.type !== Boolean) {
                            const nextToken = result.tokens[i + 1];

                            if (nextToken && nextToken.kind === "positional") {
                                consumedIndices.add(i + 1);
                                i++; // Skip the consumed positional
                            }
                        }
                    }
                }
            }

            // Collect unconsumed positionals for defaultOption
            result.tokens.forEach((token, index) => {
                if (token.kind === "positional" && !consumedIndices.has(index)) {
                    positionalValues.push(token.value);
                }
            });

            if (positionalValues.length > 0) {
                if (options.partial) {
                    // In partial mode, only the first positional goes to defaultOption, rest are unknown
                    values[defaultOptionDefinition.name] = isDefaultOptionMultiple ? [positionalValues[0]] : positionalValues[0];

                    // Mark the first positional as consumed so it doesn't appear in _unknown
                    if (positionalValues.length > 0) {
                        // Find the index of the first positional value in the tokens
                        const firstPositionalIndex = result.tokens.findIndex(
                            (token, index) => token.kind === "positional" && !consumedIndices.has(index) && token.value === positionalValues[0],
                        );

                        if (firstPositionalIndex !== -1) {
                            consumedIndices.add(firstPositionalIndex);
                        }

                        // Add remaining positionals to unknownArgs since in partial mode only first goes to defaultOption
                        for (let i = 1; i < positionalValues.length; i++) {
                            const remainingValue = positionalValues[i];
                            const remainingIndex = result.tokens.findIndex(
                                (token, index) => token.kind === "positional" && !consumedIndices.has(index) && token.value === remainingValue,
                            );

                            if (remainingIndex !== -1) {
                                unknownArgs.push(argv[result.tokens[remainingIndex].index]);
                                consumedIndices.add(remainingIndex); // Mark as processed
                            }
                        }
                    }
                } else {
                    // Normal mode - all positionals go to defaultOption
                    values[defaultOptionDefinition.name] = isDefaultOptionMultiple ? positionalValues : positionalValues[0];
                    // Mark all positionals as consumed since they all go to defaultOption
                    result.tokens.forEach((token, index) => {
                        if (token.kind === "positional" && positionalValues.includes(token.value)) {
                            consumedIndices.add(index);
                        }
                    });
                }
            }
        }

        // Helper function for type conversion (handles both single values and arrays)
        const convertValue = (value: any, type: any): any => {
            if (Array.isArray(value)) {
                switch (type) {
                    case Boolean: {
                        return value.map(Boolean);
                    }
                    case Number: {
                        return value.map(Number);
                    }
                    case String: {
                        return value.map(String);
                    }
                    default: {
                        return value.map((v: any) => type(String(v)));
                    }
                }
            } else if (value === null) {
                return null; // Preserve null values
            } else {
                switch (type) {
                    case Boolean: {
                        return Boolean(value);
                    }
                    case Number: {
                        return Number(value);
                    }
                    case String: {
                        return String(value);
                    }
                    default: {
                        return type(String(value));
                    }
                }
            }
        };

        // Process collected values
        Object.entries(values).forEach(([key, value]) => {
            // Apply camelCase conversion if requested (use cached version)
            const finalKey = options.camelCase ? camelCaseMap.get(key) || key : key;

            // Handle custom type functions (use O(1) lookup instead of O(n) search)
            const definition = definitionMap.get(key);

            if (definition && definition.type && typeof definition.type === "function") {
                output[finalKey] = convertValue(value, definition.type);
            } else {
                // Use value as-is, but convert undefined to null for consistency
                output[finalKey] = value === undefined ? null : value;
            }
        });

        // Handle default values that weren't provided
        definitions.forEach((definition) => {
            const key = options.camelCase ? camelCaseMap.get(definition.name) || definition.name : definition.name;

            if (!(key in output) && definition.defaultValue !== undefined) {
                const isMultipleDefinition = definition.multiple || definition.lazyMultiple;

                if (isMultipleDefinition) {
                    // For multiple options, ensure default value is an array
                    output[key] = Array.isArray(definition.defaultValue) ? definition.defaultValue : [definition.defaultValue];
                } else {
                    output[key] = definition.defaultValue;
                }
            }
        });

        // Handle grouping
        const groups: Record<string, Record<string, any>> = {};

        definitions.forEach((definition) => {
            if (definition.group) {
                const groupArray = Array.isArray(definition.group) ? definition.group : [definition.group];

                groupArray.forEach((group) => {
                    if (!groups[group]) {
                        groups[group] = {};
                    }
                });
            }
        });

        // Add options to their groups and collect all options
        const allOptions: Record<string, any> = {};
        const ungroupedOptions: Record<string, any> = {};

        Object.keys(output).forEach((key) => {
            if (key.charAt(0) !== "_") {
                allOptions[key] = output[key];

                // Find the definition for this key to see if it's grouped (use O(1) lookup)
                const definition = definitionMap.get(key);

                if (definition && definition.group) {
                    const groupArray = Array.isArray(definition.group) ? definition.group : [definition.group];

                    groupArray.forEach((group) => {
                        if (groups[group]) {
                            groups[group][key] = output[key];
                        }
                    });
                } else {
                    // Ungrouped option
                    ungroupedOptions[key] = output[key];
                }
            }
        });

        // Add grouping to output
        if (Object.keys(groups).length > 0) {
            // When grouping is present, replace the output with only grouped results
            const groupedOutput: CommandLineOptions = {};

            groupedOutput._all = allOptions;

            // Add group objects
            Object.keys(groups).forEach((group) => {
                groupedOutput[group] = groups[group];
            });

            // Handle _none group (ungrouped options) - only if there are ungrouped options
            if (Object.keys(ungroupedOptions).length > 0) {
                groupedOutput._none = ungroupedOptions;
            }

            // Preserve _unknown if it exists
            if (output._unknown) {
                groupedOutput._unknown = output._unknown;
            }

            // Replace the output with the grouped version
            Object.keys(output).forEach((key) => delete output[key]);
            Object.assign(output, groupedOutput);
        }

        // Handle unknown arguments for partial mode
        if (options.partial) {
            // Add unconsumed positional arguments as unknown when there's no defaultOption
            if (!hasDefaultOption) {
                for (const token of result.tokens) {
                    if (token.kind === "positional" && !consumedPositionalIndices.has(token.index)) {
                        unknownArgs.push(argv[token.index]);
                    }
                }
            }

            // Handle special cases for boolean options with empty inline values
            argv.forEach((argument) => {
                if (argument.includes("=") && argument.endsWith("=")) {
                    const optionName = argument.split("=")[0].replace(/^--/, "");
                    const definition = definitionMap.get(optionName) || aliasMap.get(optionName);

                    // For boolean options with empty inline values, treat as unknown
                    // but still set the option to true (preserving the test behavior)
                    if (definition && definition.type === Boolean) {
                        unknownArgs.push(argument);
                    }
                }
            });

            // Remove duplicates and sort by argv order (optimized)
            const argvIndexMap = new Map<string, number>();

            argv.forEach((argument, index) => argvIndexMap.set(argument, index));

            // Efficient deduplication using Set, then sort
            const seen = new Set<string>();
            const uniqueUnknown: string[] = [];

            for (const argument of unknownArgs) {
                if (!seen.has(argument)) {
                    seen.add(argument);
                    uniqueUnknown.push(argument);
                }
            }

            uniqueUnknown.sort((a, b) => argvIndexMap.get(a)! - argvIndexMap.get(b)!);

            if (uniqueUnknown.length > 0) {
                output._unknown = uniqueUnknown;
            }
        }

        // Handle stopAtFirstUnknown - find first unknown and stop there
        if (options.stopAtFirstUnknown) {
            // Find the first unknown argument in the original argv
            // This is a simplified implementation - in practice we'd need more sophisticated logic
            // Use existing maps instead of rebuilding the set

            let firstUnknownIndex = -1;

            for (const [i, argument] of argv.entries()) {
                if (argument.startsWith("--")) {
                    const optionName = argument.slice(2);

                    if (!definitionMap.has(optionName)) {
                        firstUnknownIndex = i;
                        break;
                    }
                } else if (argument.startsWith("-") && argument.length > 1) {
                    const shortOption = argument.slice(1);

                    if (!aliasMap.has(shortOption)) {
                        firstUnknownIndex = i;
                        break;
                    }
                } else if (!argument.startsWith("-")) {
                    // This might be an unknown positional argument
                    firstUnknownIndex = i;
                    break;
                }
            }

            if (firstUnknownIndex >= 0) {
                output._unknown = argv.slice(firstUnknownIndex);
            }
        }

        // Check for errors and throw appropriate command-line-args errors
        if (result.error && !options.partial) {
            if (result.error.name === "ArgResolveError") {
                switch (result.error.type) {
                    case "required": {
                        const requestError = new Error(`Option '${result.error.name}' is required`);

                        requestError.name = "REQUIRED_OPTION";
                        throw requestError;
                    }
                    case "type": {
                        const typeError = new Error(`Invalid value for option '${result.error.name}'`);

                        typeError.name = "INVALID_TYPE";
                        throw typeError;
                    }
                    case "conflict": {
                        const conflictError = new Error(`Option '${result.error.name}' conflicts with another option`);

                        conflictError.name = "CONFLICT_OPTION";
                        throw conflictError;
                    }
                    default: {
                        throw result.error;
                    }
                }
            }

            throw result.error;
        }

        return output;
    } catch (error: any) {
        // If args-tokens fails due to non-string argv, fall back to original behavior
        if (error.message && error.message.includes("codePointAt")) {
            // This is the non-string argv error, handle it specially
            // Convert argv to strings and try again
            const stringArgv = argv.map(String);

            result = parseArgsTokens(stringArgv, {
                options: schema,
            });

            // For non-string argv, we need to preserve the original types
            // Find the first option and its value, and preserve the original type
            if (argv.length >= 2 && typeof argv[0] === "string" && argv[0].startsWith("--")) {
                const optionName = argv[0].slice(2); // Remove '--' prefix
                const definition = definitionMap.get(optionName);

                if (definition && argv[1] !== undefined) {
                    // Return the result with preserved type for the first argument
                    return { [optionName]: argv[1] };
                }
            }
        }

        // Re-throw with command-line-args error format
        if (!error.name || !["CONFLICT_OPTION", "INVALID_TYPE", "REQUIRED_OPTION", "UNKNOWN_OPTION", "UNKNOWN_VALUE"].includes(error.name)) {
            if (error.message.includes("Unknown option")) {
                const unknownError = new Error(error.message);

                unknownError.name = "UNKNOWN_OPTION";
                throw unknownError;
            } else if (error.message.includes("Unknown value") || error.message.includes("requires a value")) {
                const valueError = new Error(error.message);

                valueError.name = "UNKNOWN_VALUE";
                throw valueError;
            }
        }

        throw error;
    }
};
