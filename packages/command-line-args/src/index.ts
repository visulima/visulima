import ArgvParser from "./lib/argv-parser.js";
import Option from "./lib/option.js";
import Definitions from "./lib/option-definitions.js";
import Output from "./lib/output.js";
import OutputGrouped from "./lib/output-grouped.js";

/**
 * @module command-line-args
 */

/**
 * Returns an object containing all option values set on the command line. By default it parses the global  [`process.argv`](https://nodejs.org/api/process.html#process_process_argv) array.
 *
 * Parsing is strict by default - an exception is thrown if the user sets a singular option more than once or sets an unknown value or option (one without a valid [definition](https://github.com/75lb/command-line-args/blob/master/doc/option-definition.md)). To be more permissive, enabling [partial](https://github.com/75lb/command-line-args/wiki/Partial-mode-example) or [stopAtFirstUnknown](https://github.com/75lb/command-line-args/wiki/stopAtFirstUnknown) modes will return known options in the usual manner while collecting unknown arguments in a separate `_unknown` property.
 * @param - An array of [OptionDefinition](https://github.com/75lb/command-line-args/blob/master/doc/option-definition.md) objects
 * @param [options] Options.
 * @param [options.argv] An array of strings which, if present will be parsed instead  of `process.argv`.
 * @param [options.partial] If `true`, an array of unknown arguments is returned in the `_unknown` property of the output.
 * @param [options.stopAtFirstUnknown] If `true`, parsing will stop at the first unknown argument and the remaining arguments returned in `_unknown`. When set, `partial: true` is also implied.
 * @param [options.camelCase] If `true`, options with hypenated names (e.g. `move-to`) will be returned in camel-case (e.g. `moveTo`).
 * @param [options.caseInsensitive] If `true`, the case of each option name or alias parsed is insignificant. In other words, both `--Verbose` and `--verbose`, `-V` and `-v` would be equivalent. Defaults to false.
 * @returns
 * @throws `UNKNOWN_OPTION` If `options.partial` is false and the user set an undefined option. The `err.optionName` property contains the arg that specified an unknown option, e.g. `--one`.
 * @throws `UNKNOWN_VALUE` If `options.partial` is false and the user set a value unaccounted for by an option definition. The `err.value` property contains the unknown value, e.g. `5`.
 * @throws `ALREADY_SET` If a user sets a singular, non-multiple option more than once. The `err.optionName` property contains the option name that has already been set, e.g. `one`.
 * @throws `INVALID_DEFINITIONS`
 *   - If an option definition is missing the required `name` property
 *   - If an option definition has a `type` value that's not a function
 *   - If an alias is numeric, a hyphen or a length other than 1
 *   - If an option definition name was used more than once
 *   - If an option definition alias was used more than once
 *   - If more than one option definition has `defaultOption: true`
 *   - If a `Boolean` option is also set as the `defaultOption`.
 * @alias module:command-line-args
 */
function commandLineArgs(optionDefinitions: any[], options?: any): any {
    options = options || {};

    if (options.stopAtFirstUnknown)
        options.partial = true;

    optionDefinitions = Definitions.from(optionDefinitions, options.caseInsensitive);

    const parser = new ArgvParser(optionDefinitions, {
        argv: options.argv,
        caseInsensitive: options.caseInsensitive,
        stopAtFirstUnknown: options.stopAtFirstUnknown,
    });

    const OutputClass = optionDefinitions.isGrouped() ? OutputGrouped : Output;
    const output = new OutputClass(optionDefinitions);

    /* Iterate the parser setting each known value to the output. Optionally, throw on unknowns. */
    for (const argumentInfo of parser) {
        const argument = argumentInfo.subArg || argumentInfo.arg;

        if (!options.partial) {
            if (argumentInfo.event === "unknown_value") {
                const error = new Error(`Unknown value: ${argument}`);

                error.name = "UNKNOWN_VALUE";
                error.value = argument;
                throw error;
            } else if (argumentInfo.event === "unknown_option") {
                const error = new Error(`Unknown option: ${argument}`);

                error.name = "UNKNOWN_OPTION";
                error.optionName = argument;
                throw error;
            }
        }

        let option;

        if (output.has(argumentInfo.name)) {
            option = output.get(argumentInfo.name);
        } else {
            option = Option.create(argumentInfo.def);
            output.set(argumentInfo.name, option);
        }

        if (argumentInfo.name === "_unknown") {
            option.set(argument);
        } else {
            option.set(argumentInfo.value);
        }
    }

    return output.toObject({ camelCase: options.camelCase, skipUnknown: !options.partial });
}

export default commandLineArgs;
