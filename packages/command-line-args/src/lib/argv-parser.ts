import findReplace from "find-replace";
import t from "typical";

import { ArgvArray, isOption, isOptionEqualsNotation, isValue, re } from "./argv-tools.js";
import Definitions from "./option-definitions.js";

/**
 * @module argv-parser
 */

/**
 * @alias module:argv-parser
 */
class ArgvParser {
    private options: any;

    private definitions: Definitions;

    private argv: any;

    /**
     * @param - Definitions array
     * @param [options] Options
     * @param [options.argv] Overrides `process.argv`
     * @param [options.stopAtFirstUnknown]
     * @param [options.caseInsensitive] Arguments will be parsed in a case insensitive manner. Defaults to false.
     */
    constructor(definitions: any[], options?: any) {
        this.options = { ...options };

        /**
         * Option Definitions
         */
        this.definitions = Definitions.from(definitions, this.options.caseInsensitive);

        /**
         * Argv
         */
        this.argv = ArgvArray.from(this.options.argv);

        if (this.argv.hasCombinedShortOptions()) {
            findReplace(this.argv, re.combinedShort.test.bind(re.combinedShort), (argument: string) => {
                argument = argument.slice(1);

                return argument.split("").map((letter: string) => {
                    return { arg: `-${letter}`, origArg: `-${argument}` };
                });
            });
        }
    }

    /**
     * Yields one `{ event, name, value, arg, def }` argInfo object for each arg in `process.argv` (or `options.argv`).
     */
    * [Symbol.iterator]() {
        const { definitions } = this;

        let def: any;
        let value: any;
        let name: string;
        let event: string;
        let singularDefaultSet = false;
        let unknownFound = false;
        let origArgument: string;

        for (let argument of this.argv) {
            if (t.isPlainObject(argument)) {
                origArgument = argument.origArg;
                argument = argument.arg;
            }

            if (unknownFound && this.options.stopAtFirstUnknown) {
                yield { arg: argument, event: "unknown_value", name: "_unknown", value: undefined };
                continue;
            }

            /* handle long or short option */
            if (isOption(argument)) {
                def = definitions.get(argument, this.options.caseInsensitive);
                value = undefined;

                if (def) {
                    value = def.isBoolean() ? true : null;
                    event = "set";
                } else {
                    event = "unknown_option";
                }

                /* handle --option-value notation */
            } else if (isOptionEqualsNotation(argument)) {
                const matches = argument.match(re.optEquals);

                def = definitions.get(matches![1], this.options.caseInsensitive);

                if (def) {
                    if (def.isBoolean()) {
                        yield { arg: argument, def, event: "unknown_value", name: "_unknown", value };
                        event = "set";
                        value = true;
                    } else {
                        event = "set";
                        value = matches![2];
                    }
                } else {
                    event = "unknown_option";
                }

                /* handle value */
            } else if (isValue(argument)) {
                if (def) {
                    value = argument;
                    event = "set";
                } else {
                    /* get the defaultOption */
                    def = this.definitions.getDefault();

                    if (def && !singularDefaultSet) {
                        value = argument;
                        event = "set";
                    } else {
                        event = "unknown_value";
                        def = undefined;
                    }
                }
            }

            name = def ? def.name : "_unknown";
            const argumentInfo = { arg: argument, def, event, name, value };

            if (origArgument) {
                argumentInfo.subArg = argument;
                argumentInfo.arg = origArgument;
            }

            yield argumentInfo;

            /* unknownFound logic */
            if (name === "_unknown")
                unknownFound = true;

            /* singularDefaultSet logic */
            if (def && def.defaultOption && !def.isMultiple() && event === "set")
                singularDefaultSet = true;

            /* reset values once consumed and yielded */
            if (def && def.isBoolean())
                def = undefined;

            /* reset the def if it's a singular which has been set */
            if (def && !def.multiple && t.isDefined(value) && value !== null) {
                def = undefined;
            }

            value = undefined;
            event = undefined;
            name = undefined;
            origArgument = undefined;
        }
    }
}

export default ArgvParser;
