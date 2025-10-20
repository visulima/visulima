import arrayify from "array-back";
import findReplace from "find-replace";

/**
 * Some useful tools for working with `process.argv`.
 * @module argv-tools
 * @typicalName argvTools
 * @example
 * const argvTools = require('argv-tools')
 */

/**
 * Regular expressions for matching option formats.
 * @static
 */
const re = {
    combinedShort: /^-[^\d-]{2,}$/,
    long: /^--(\S+)/,
    optEquals: /^(--\S+?)=(.*)/,
    short: /^-([^\d-])$/,
};

/**
 * Array subclass encapsulating common operations on `process.argv`.
 * @static
 */
class ArgvArray extends Array {
    /**
     * Clears the array has loads the supplied input.
     * @param argv The argv list to load. Defaults to `process.argv`.
     */
    load(argv?: string[]): void {
        this.clear();

        if (argv && argv !== process.argv) {
            argv = arrayify(argv);
        } else {
            /* if no argv supplied, assume we are parsing process.argv */
            argv = [...process.argv];
            const deleteCount = process.execArgv.some(isExecArgument) ? 1 : 2;

            argv.splice(0, deleteCount);
        }

        argv.forEach((argument: string) => this.push(String(argument)));
    }

    /**
     * Clear the array.
     */
    clear(): void {
        this.length = 0;
    }

    /**
     * expand ``--option=value` style args.
     */
    expandOptionEqualsNotation(): void {
        if (this.some((argument: string) => re.optEquals.test(argument))) {
            const expandedArgs: string[] = [];

            this.forEach((argument: string) => {
                const matches = argument.match(re.optEquals);

                if (matches) {
                    expandedArgs.push(matches[1], matches[2]);
                } else {
                    expandedArgs.push(argument);
                }
            });
            this.clear();
            this.load(expandedArgs);
        }
    }

    /**
     * expand getopt-style combinedShort options.
     */
    expandGetoptNotation(): void {
        if (this.hasCombinedShortOptions()) {
            findReplace(this, re.combinedShort.test.bind(re.combinedShort), expandCombinedShortArgument);
        }
    }

    /**
     * Returns true if the array contains combined short options (e.g. `-ab`).
     * @returns
     */
    hasCombinedShortOptions(): boolean {
        return this.some((argument: string) => re.combinedShort.test(argument));
    }

    static from(argv?: string[]): ArgvArray {
        const result = new this();

        result.load(argv);

        return result;
    }
}

/**
 * Expand a combined short option.
 * @param - the string to expand, e.g. `-ab`
 * @returns
 * @static
 */
const expandCombinedShortArgument = (argument: string): string[] => {
    /* remove initial hypen */
    argument = argument.slice(1);

    return argument.split("").map((letter: string) => `-${letter}`);
};

/**
 * Returns true if the supplied arg matches `--option=value` notation.
 * @param - the arg to test, e.g. `--one=something`
 * @returns
 * @static
 */
const isOptionEqualsNotation = (argument: string): boolean => {
    return re.optEquals.test(argument);
};

/**
 * Returns true if the supplied arg is in either long (`--one`) or short (`-o`) format.
 * @param - the arg to test, e.g. `--one`
 * @returns
 * @static
 */
const isOption = (argument: string): boolean => {
    return (re.short.test(argument) || re.long.test(argument)) && !re.optEquals.test(argument);
};

/**
 * Returns true if the supplied arg is in long (`--one`) format.
 * @param - the arg to test, e.g. `--one`
 * @returns
 * @static
 */
const isLongOption = (argument: string): boolean => {
    return re.long.test(argument) && !isOptionEqualsNotation(argument);
};

/**
 * Returns the name from a long, short or `--options=value` arg.
 * @param - the arg to inspect, e.g. `--one`
 * @returns
 * @static
 */
const getOptionName = (argument: string): string | null => {
    if (re.short.test(argument)) {
        return argument.match(re.short)![1];
    }

    if (isLongOption(argument)) {
        return argument.match(re.long)![1];
    }

    if (isOptionEqualsNotation(argument)) {
        return argument.match(re.optEquals)![1].replace(/^--/, "");
    }

    return null;
};

const isValue = (argument: string): boolean => {
    return !(isOption(argument) || re.combinedShort.test(argument) || re.optEquals.test(argument));
};

const isExecArgument = (argument: string): boolean => {
    return ["--eval", "-e"].includes(argument) || argument.startsWith("--eval=");
};

export { ArgvArray, expandCombinedShortArgument as expandCombinedShortArg, getOptionName, isLongOption, isOption, isOptionEqualsNotation, isValue, re };
