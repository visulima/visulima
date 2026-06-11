/**
 * Parsed command-line arguments object.
 */
export interface CommandLineOptions {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [propName: string]: any;

    /**
     * Command-line arguments not parsed by `commandLineArgs`.
     */
    _unknown?: string[];
}

/**
 * Options for parsing command-line arguments.
 */
export interface ParseOptions {
    /**
     * An array of strings which if present will be parsed instead of `process.argv`.
     */
    argv?: string[];

    /**
     * If `true`, options with hyphenated names (e.g. `move-to`) will be returned in camelCase (e.g. `moveTo`).
     */
    camelCase?: boolean;

    /**
     * If `true`, the case of each option name or alias parsed is insignificant. For example, `--Verbose` and
     * `--verbose` would be parsed identically, as would the aliases `-V` and `-v`. Defaults to false.
     */
    caseInsensitive?: boolean;

    /**
     * If `true`, enables debug logging to help troubleshoot parsing issues.
     */
    debug?: boolean;

    /**
     * If `true`, a `--no-NAME` flag (e.g. `--no-verbose`) sets the matching `Boolean`
     * option to `false` (so `--no-verbose` produces `{ verbose: false }`). Mirrors the behaviour of
     * minimist, yargs and Node's `util.parseArgs` `allowNegative`. Defaults to `false`.
     */
    negation?: boolean;

    /**
     * If `true`, `commandLineArgs` will not throw on unknown options or values, instead returning them in the `_unknown` property of the output.
     */
    partial?: boolean;

    /**
     * If `true`, `commandLineArgs` will not throw on unknown options or values. Instead, parsing will stop at the first unknown argument
     * and the remaining arguments returned in the `_unknown` property of the output. If set, `partial: true` is implied.
     */
    stopAtFirstUnknown?: boolean;

    /**
     * If `true`, type conversions that produce invalid values throw an `InvalidValueError`
     * instead of silently propagating. Currently this catches `type: Number` values that parse
     * to `NaN` (e.g. `--port abc`). Defaults to `false` for parity with the original library.
     */
    strictTypes?: boolean;
}

/**
 * Definition for a command-line option.
 *
 * The optional `Name` and `Value` type parameters allow {@link CommandLineOptions}
 * to be inferred from an `as const` array of definitions. They default to the
 * loose runtime shape so plain `OptionDefinition` usage is unaffected.
 */
export interface OptionDefinition<Name extends string = string, Value = unknown> {
    /**
     * A getopt-style short option name. Can be any single character except a digit or hyphen.
     */
    alias?: string;

    /**
     * Any values unaccounted for by an option definition will be set on the `defaultOption`. This flag is typically set
     * on the most commonly-used option to enable more concise usage.
     */
    defaultOption?: boolean;

    /**
     * An initial value for the option.
     */
    defaultValue?: Value;

    /**
     * One or more group names the option belongs to.
     */
    group?: string | string[];

    /**
     * Identical to `multiple` but with greedy parsing disabled.
     */
    lazyMultiple?: boolean;

    /**
     * Set this flag if the option accepts multiple values. In the output, you will receive an array of values each passed through the `type` function.
     */
    multiple?: boolean;

    /**
     * The long option name.
     */
    name: Name;

    /**
     * A setter function (you receive the output from this) enabling you to be specific about the type and value received. Typical values
     * are `String` (the default), `Number` and `Boolean` but you can use a custom function. If no option value was set you will receive `null`.
     */
    type?: (input: string) => Value;
}

/**
 * Resolve a single {@link OptionDefinition} to the type of its parsed value,
 * taking `type`, `multiple`/`lazyMultiple` and `defaultValue` into account.
 * @internal
 */
export type InferOptionValue<Definition extends OptionDefinition> = Definition extends { type: (input: string) => infer R }
    ? Definition extends { lazyMultiple: true } | { multiple: true }
        ? R[]
        : R | (Definition extends { defaultValue: infer D } ? D : null)
    : Definition extends { lazyMultiple: true } | { multiple: true }
        ? string[]
        : Definition extends { type: BooleanConstructor }
            ? boolean
            : string | null;

/**
 * Infer the parsed result object from a tuple/array of {@link OptionDefinition}s.
 * Use with an `as const` array (or `defineOptions`) to get a precisely-typed
 * result, e.g. `{ file?: string; verbose?: boolean }`.
 *
 * Falls back to the loose {@link CommandLineOptions} shape when the definitions
 * are a plain (non-`const`) `OptionDefinition[]`.
 * For example, given an `as const` array with a `file: String` and a `verbose: Boolean`
 * definition, the inferred result is `{ file: string | null; verbose: boolean; _unknown?: string[] }`.
 */
export type InferCommandLineOptions<Definitions extends ReadonlyArray<OptionDefinition>> = string extends Definitions[number]["name"]
    ? CommandLineOptions
    : { [Definition in Definitions[number] as Definition["name"]]: InferOptionValue<Definition> } & { _unknown?: string[] };
