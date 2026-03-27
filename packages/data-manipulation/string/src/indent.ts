/**
 * Inlined from https://github.com/sindresorhus/indent-string, https://github.com/sindresorhus/strip-indent, https://github.com/sindresorhus/redent
 * MIT License, Copyright (c) Sindre Sorhus &lt;sindresorhus@gmail.com>
 */

// eslint-disable-next-line import/no-extraneous-dependencies
export { default as redent } from "redent";
// eslint-disable-next-line import/no-extraneous-dependencies
export { dedent, default as stripIndent } from "strip-indent";

export interface IndentOptions {
    /**
     * Also indent empty lines.
     * @default false
     */
    readonly includeEmptyLines?: boolean;

    /**
     * The string to use for the indent.
     * @default ' '
     */
    readonly indent?: string;
}

/**
 * Indent each line in a string.
 * @param string The string to indent.
 * @param count How many times to repeat the indent string. Default: `1`.
 * @param options Configuration options.
 * @returns The indented string.
 */
export const indent = (string: string, count: number = 1, options: IndentOptions = {}): string => {
    const { includeEmptyLines = false, indent: indentChar = " " } = options;

    if (count === 0) {
        return string;
    }

    const regex = includeEmptyLines ? /^/gm : /^(?!\s*$)/gm;

    return string.replace(regex, indentChar.repeat(count));
};
