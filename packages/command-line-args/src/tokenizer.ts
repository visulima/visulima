// Tokenization code from args-tokens (MIT License)
// Copyright (c) 2025 kazuya kawaguchi
// https://github.com/kazupon/args-tokens

/**
 * Argument token Kind.
 */
export type ArgTokenKind = "option" | "option-terminator" | "positional";

/**
 * Argument token.
 */
export interface ArgumentToken {
    /**
     * Argument token index.
     */
    index: number;

    /**
     * Inline value flag.
     */
    inlineValue?: boolean;

    /**
     * Argument token kind.
     */
    kind: ArgTokenKind;

    /**
     * Option name.
     */
    name?: string;

    /**
     * Raw option name.
     */
    rawName?: string;

    /**
     * Option value.
     */
    value?: string;
}

const HYPHEN_CHAR = "-";
const HYPHEN_CODE = HYPHEN_CHAR.codePointAt(0)!;
const EQUAL_CHAR = "=";
const EQUAL_CODE = EQUAL_CHAR.codePointAt(0)!;
const TERMINATOR = "--";
const SHORT_OPTION_PREFIX = HYPHEN_CHAR;
const LONG_OPTION_PREFIX = "--";

/**
 * Check if `arg` has a long option prefix (e.g. `--`).
 */
const hasLongOptionPrefix = (argument: string): boolean => argument.length > 2 && argument.indexOf(LONG_OPTION_PREFIX) === 0;

/**
 * Check if `arg` is a long option (e.g. `--foo`).
 */
const isLongOption = (argument: string) => hasLongOptionPrefix(argument) && !argument.includes(EQUAL_CHAR, 3);

/**
 * Check if `arg` is a long option with value (e.g. `--foo=bar`).
 */
const isLongOptionAndValue = (argument: string) => hasLongOptionPrefix(argument) && argument.includes(EQUAL_CHAR, 3);

/**
 * Check if a `value` is an option value.
 */
const hasOptionValue = (value: string | undefined): boolean => !(value == undefined) && value.codePointAt(0) !== HYPHEN_CODE;

/**
 * Parse command line arguments into tokens.
 */
export const parseArgsTokens = (args: string[]): ArgumentToken[] => {
    const tokens: ArgumentToken[] = [];
    const remainings = [...args];
    let index = -1;
    let groupCount = 0;
    let hasShortValueSeparator = false;

    while (remainings.length > 0) {
        const argument = remainings.shift();

        if (argument == undefined) {
            break;
        }

        const nextArgument = remainings[0];

        if (groupCount > 0) {
            groupCount--;
        } else {
            index++;
        }

        // check if `arg` is an options terminator.
        if (argument === TERMINATOR) {
            tokens.push({
                index,
                kind: "option-terminator",
            });
            const mapped = remainings.map((argument_) => {
                return { index: ++index, kind: "positional", value: argument_ };
            });

            tokens.push(...mapped);
            break;
        }

        if (isShortOption(argument)) {
            const shortOption = argument.charAt(1);
            let value: string | undefined;
            let inlineValue: boolean | undefined;

            if (groupCount) {
                tokens.push({
                    index,
                    inlineValue,
                    kind: "option",
                    name: shortOption,
                    rawName: argument,
                    value,
                });

                if (groupCount === 1 && hasOptionValue(nextArgument)) {
                    value = remainings.shift();

                    if (hasShortValueSeparator) {
                        inlineValue = true;
                        hasShortValueSeparator = false;
                    }

                    tokens.push({
                        index,
                        inlineValue,
                        kind: "option",
                        value,
                    });
                }
            } else {
                tokens.push({
                    index,
                    inlineValue,
                    kind: "option",
                    name: shortOption,
                    rawName: argument,
                    value,
                });
            }

            if (value != undefined) {
                ++index;
            }

            continue;
        }

        if (isShortOptionGroup(argument)) {
            const expanded = [];
            let shortValue = "";

            for (let i = 1; i < argument.length; i++) {
                const shortableOption = argument.charAt(i);

                if (hasShortValueSeparator) {
                    shortValue += shortableOption;
                } else if (shortableOption.codePointAt(0) === EQUAL_CODE) {
                    hasShortValueSeparator = true;
                } else {
                    expanded.push(`${SHORT_OPTION_PREFIX}${shortableOption}`);
                }
            }

            if (shortValue) {
                expanded.push(shortValue);
            }

            remainings.unshift(...expanded);
            groupCount = expanded.length;
            continue;
        }

        if (isLongOption(argument)) {
            const longOption = argument.slice(2);

            tokens.push({
                index,
                inlineValue: undefined,
                kind: "option",
                name: longOption,
                rawName: argument,
                value: undefined,
            });

            continue;
        }

        if (isLongOptionAndValue(argument)) {
            const equalIndex = argument.indexOf(EQUAL_CHAR);
            const longOption = argument.slice(2, equalIndex);
            const value = argument.slice(equalIndex + 1);

            tokens.push({
                index,
                inlineValue: true,
                kind: "option",
                name: longOption,
                rawName: argument,
                value,
            });
            continue;
        }

        tokens.push({
            index,
            kind: "positional",
            value: argument,
        });
    }

    return tokens;
};

/**
 * Check if `arg` is a short option (e.g. `-f`).
 */
const isShortOption = (argument: string): boolean =>
    argument.length === 2 && argument.codePointAt(0) === HYPHEN_CODE && argument.codePointAt(1) !== HYPHEN_CODE && !/\d/.test(argument.charAt(1)); // Don't treat - followed by digit as short option

/**
 * Check if `arg` is a short option group (e.g. `-abc`).
 */
const isShortOptionGroup = (argument: string): boolean => {
    if (argument.length <= 2) {
        return false;
    }

    if (argument.codePointAt(0) !== HYPHEN_CODE) {
        return false;
    }

    if (argument.codePointAt(1) === HYPHEN_CODE) {
        return false;
    }

    return true;
};
