import debugLog from "./debug";
import { resolveArgs } from "./resolver";
import { parseArgsTokens } from "./tokenizer";
import { validateDefinitions } from "./validation";

// Export error classes for better error handling
export { AlreadySetError, InvalidDefinitionsError, UnknownOptionError, UnknownValueError } from "./errors";

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
     * If `true`, enables debug logging to help troubleshoot parsing issues.
     */
    debug?: boolean | undefined;

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
 * @param optionDefinitions Single definition or array of option definitions
 * @param options Parsing options (argv, camelCase, caseInsensitive, debug, partial, stopAtFirstUnknown)
 * @returns Parsed command-line arguments as key-value pairs
 */
export const commandLineArgs = (optionDefinitions: OptionDefinition | ReadonlyArray<OptionDefinition>, options: ParseOptions = {}): CommandLineOptions => {
    const debugEnabled = options.debug || false;

    debugLog(debugEnabled, "Starting command-line-args parsing", "index");
    debugLog(debugEnabled, "Options:", "index", options);

    // Handle stopAtFirstUnknown implying partial
    if (options.stopAtFirstUnknown) {
        options.partial = true;
    }

    // Normalize optionDefinitions to always be an array
    const definitions = Array.isArray(optionDefinitions) ? optionDefinitions : [optionDefinitions];

    debugLog(debugEnabled, "Normalized definitions:", "index", definitions);

    // Validate definitions
    validateDefinitions(definitions, options.caseInsensitive, debugEnabled ? options : undefined);

    // Get argv to parse
    let { argv } = options;

    if (!argv) {
        // Automatically detect and skip Node.js exec args
        argv = process.argv.slice(2);

        if (process.execArgv?.length) {
            // Skip exec args that appear in argv
            const execArgs = new Set(process.execArgv);

            argv = argv.filter((argument) => !execArgs.has(argument));
        }
    }

    debugLog(debugEnabled, "Using argv:", "index", argv);

    // Handle case insensitive option matching
    let normalizedArgv = argv;

    if (options.caseInsensitive) {
        normalizedArgv = argv.map((argument) => {
            if (argument.startsWith("--")) {
                const equalsIndex = argument.indexOf("=");
                const optionName = equalsIndex === -1 ? argument.slice(2) : argument.slice(2, equalsIndex);
                const normalizedName = optionName.toLowerCase();

                return equalsIndex === -1 ? `--${normalizedName}` : `--${normalizedName}${argument.slice(equalsIndex)}`;
            }

            if (argument.startsWith("-") && argument.length > 1) {
                const normalizedAlias = argument[1].toLowerCase();

                return `-${normalizedAlias}${argument.slice(2)}`;
            }

            return argument;
        });
    }

    // Tokenize arguments
    const tokens = parseArgsTokens(normalizedArgv.map(String));

    debugLog(debugEnabled, "Tokenized arguments:", "index", tokens);

    // Resolve tokens into final parsed arguments
    const result = resolveArgs(tokens, definitions, options, argv);

    debugLog(debugEnabled, "Command-line-args parsing completed", "index");

    return result;
};
