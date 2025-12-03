/**
 * Parsed command-line arguments object.
 */
export interface CommandLineOptions {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [propName: string]: any;

    /**
     * Command-line arguments not parsed by `commandLineArgs`.
     */
    _unknown?: string[] | undefined;
}

/**
 * Options for parsing command-line arguments.
 */
export interface ParseOptions {
    /**
     * An array of strings which if present will be parsed instead of `process.argv`.
     */
    argv?: string[] | undefined;

    /**
     * If `true`, options with hyphenated names (e.g. `move-to`) will be returned in camelCase (e.g. `moveTo`).
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

/**
 * Definition for a command-line option.
 */
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type?: ((input: string) => any) | undefined;
}
