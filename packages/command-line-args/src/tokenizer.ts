// Tokenization code from args-tokens (MIT License)
// Copyright (c) 2025 kazuya kawaguchi
// https://github.com/kazupon/args-tokens

const HYPHEN_CHAR = "-";
const HYPHEN_CODE = HYPHEN_CHAR.codePointAt(0);
const EQUAL_CHAR = "=";
const EQUAL_CODE = EQUAL_CHAR.codePointAt(0);
const TERMINATOR = "--";
const SHORT_OPTION_PREFIX = HYPHEN_CHAR;
const LONG_OPTION_PREFIX = "--";

/**
 * Check if argument has a long option prefix (e.g., `--`).
 * @param argument The argument to check
 * @returns True if argument starts with `--` and has length > 2
 */
const hasLongOptionPrefix = (argument: string): boolean => argument.length > 2 && argument.startsWith(LONG_OPTION_PREFIX);

/**
 * Check if argument is a long option (e.g., `--foo`).
 * @param argument The argument to check
 * @returns True if argument is a long option without inline value
 */
const isLongOption = (argument: string) => hasLongOptionPrefix(argument) && !argument.includes(EQUAL_CHAR, 3);

/**
 * Check if argument is a long option with inline value (e.g., `--foo=bar`).
 * @param argument The argument to check
 * @returns True if argument has long option prefix and contains `=`
 */
const isLongOptionAndValue = (argument: string) => hasLongOptionPrefix(argument) && argument.includes(EQUAL_CHAR, 3);

/**
 * Check if value is an option value (doesn't start with hyphen).
 * @param value The value to check
 * @returns True if value is defined and doesn't start with hyphen
 */
const hasOptionValue = (value: string | undefined): boolean => value !== undefined && value.length > 0 && value.codePointAt(0) !== HYPHEN_CODE;

/**
 * Check if argument is a short option (e.g., `-f`).
 * @param argument The argument to check
 * @returns True if argument is exactly 2 characters, starts with hyphen, and second char is not hyphen or digit
 */
const isShortOption = (argument: string): boolean => {
    if (argument.length !== 2 || argument.codePointAt(0) !== HYPHEN_CODE || argument.codePointAt(1) === HYPHEN_CODE) {
        return false;
    }

    // Check if second character is NOT a digit (48-57 are ASCII codes for 0-9)
    const secondCharCode = argument.codePointAt(1);

    return secondCharCode !== undefined && (secondCharCode < 48 || secondCharCode > 57);
};

/**
 * Check if argument is a short option group (e.g., `-abc`).
 * @param argument The argument to check
 * @returns True if argument is short option group format
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

export type ArgumentTokenKind = "option" | "option-terminator" | "positional";

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
    kind: ArgumentTokenKind;

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

/**
 * Parse command line arguments into tokens.
 * Converts raw command-line arguments into structured tokens for processing.
 * Handles long options (--foo), short options (-f), option groups (-abc),
 * inline values (--foo=bar), and positional arguments.
 * @param args Array of command-line arguments to parse
 * @returns Array of parsed argument tokens
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
export const parseArgsTokens = (args: string[]): ArgumentToken[] => {
    const tokens: ArgumentToken[] = [];
    const remainings = [...args];
    let index = -1;
    let groupCount = 0;
    let hasShortValueSeparator = false;

    while (remainings.length > 0) {
        const argument = remainings.shift();

        if (argument === undefined) {
            break;
        }

        const nextArgument = remainings[0];

        if (groupCount > 0) {
            // eslint-disable-next-line no-plusplus
            groupCount--;
        } else {
            // eslint-disable-next-line no-plusplus
            index++;
        }

        // check if `arg` is an options terminator.
        if (argument === TERMINATOR) {
            tokens.push({
                index,
                kind: "option-terminator",
            });

            const mapped = remainings.map((argument_) => {
                // eslint-disable-next-line no-plusplus
                return { index: ++index, kind: "positional", value: argument_ };
            }) as ArgumentToken[];

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
                    // Consume the value from remainings, but do NOT increment index
                    // because this value is associated with the current short option,
                    // which is part of the current argv index (e.g., in "-abc value",
                    // value belongs to index of the whole "-abc" argument, not a new index)
                    value = remainings.shift();

                    if (hasShortValueSeparator) {
                        inlineValue = true;
                        // eslint-disable-next-line sonarjs/no-redundant-assignments
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

            if (value !== undefined) {
                // eslint-disable-next-line no-plusplus
                ++index;
            }

            continue;
        }

        if (isShortOptionGroup(argument) // Skip if this looks like a short option with inline value (e.g., "-o=value")
            // These should be handled by the inline value handler, not expanded as groups
            && !argument.includes(EQUAL_CHAR)) {
            const expanded: string[] = [];
            let shortValue = "";
            let localHasShortValueSeparator = false;

            // eslint-disable-next-line no-plusplus
            for (let i = 1; i < argument.length; i++) {
                const shortableOption = argument.charAt(i);

                if (localHasShortValueSeparator) {
                    shortValue += shortableOption;
                } else if (shortableOption.codePointAt(0) === EQUAL_CODE) {
                    localHasShortValueSeparator = true;
                } else {
                    expanded.push(`${SHORT_OPTION_PREFIX}${shortableOption}`);
                }
            }

            // If '=' was present, push the collected value even if empty (e.g., "-o=" -> value = "")
            // This maintains parity with long options like "--opt=" which emit a value token
            if (localHasShortValueSeparator) {
                if (expanded.length > 0) {
                    const lastOption = expanded.pop() as string;

                    expanded.push(`${lastOption}=${shortValue}`);
                } else {
                    // Edge case: just "-=" with no option before it
                    expanded.push(shortValue);
                }
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

        // Handle short option with inline value (e.g., -b=cd)
        if (argument.length > 2 && argument.codePointAt(0) === HYPHEN_CODE && argument.codePointAt(1) !== HYPHEN_CODE && argument.includes(EQUAL_CHAR)) {
            const equalIndex = argument.indexOf(EQUAL_CHAR);
            const shortOption = argument.charAt(1);
            const value = argument.slice(equalIndex + 1);

            tokens.push({
                index,
                inlineValue: true,
                kind: "option",
                name: shortOption,
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
