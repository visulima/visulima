import cliTruncate from "cli-truncate";
import stringWidth from "string-width";
import wordwrap from "wordwrap";

/**
 * Applies padding to the left or the right of the string by repeating
 * a given char.
 *
 * The method is not same as `padLeft` or `padRight` from JavaScript STD lib,
 * since it repeats a char regardless of the max width.
 */
const applyPadding = (value: string, options: { paddingChar: string; paddingLeft?: number; paddingRight?: number }): string => {
    if (options.paddingLeft) {
        // eslint-disable-next-line no-param-reassign
        value = `${options.paddingChar.repeat(options.paddingLeft)}${value}`;
    }

    if (options.paddingRight) {
        // eslint-disable-next-line no-param-reassign
        value = `${value}${options.paddingChar.repeat(options.paddingRight)}`;
    }

    return value;
};

/**
 * Justify the columns to have the same width by filling
 * the empty slots with a padding char.
 *
 * Optionally, the column can be aligned left or right.
 */
export const justify = (
    columns: string[],
    options: {
        align?: "left" | "right";
        maxWidth: number;
        paddingChar?: string;
    },
): string[] => {
    const normalizedOptions = {
        align: "left" as const,
        paddingChar: " ",
        ...options,
    };

    return columns.map((column) => {
        const columnWidth = stringWidth(column);

        /**
         * Column is already same or greater than the maxWidth
         */
        if (columnWidth >= normalizedOptions.maxWidth) {
            return column;
        }

        /**
         * Fill empty space on the right
         */
        if (normalizedOptions.align === "left") {
            return applyPadding(column, {
                paddingChar: normalizedOptions.paddingChar,
                paddingRight: normalizedOptions.maxWidth - columnWidth,
            });
        }

        /**
         * Fill empty space on the left
         */
        return applyPadding(column, {
            paddingChar: normalizedOptions.paddingChar,
            paddingLeft: normalizedOptions.maxWidth - columnWidth,
        });
    });
};

/**
 * Wrap the text under the starting and the ending column.
 * The first line will start at 1st column. However, from
 * the 2nd line onwards, the columns before the start
 * column are filled with white space.
 */
export const wrap = (
    columns: string[],
    options: {
        endColumn: number;
        startColumn: number;
        trimStart?: boolean;
    },
): string[] => {
    const wrapper = wordwrap(options.startColumn, options.endColumn);

    if (options.trimStart) {
        return columns.map((column) => wrapper(column).trimStart());
    }

    return columns.map((column) => wrapper(column));
};

/**
 * Truncates the text after a certain width.
 */
export const truncate = (
    columns: string[],
    options: {
        maxWidth: number;
        position?: "end" | "middle" | "start";
        truncationChar?: string;
    },
): string[] =>
    columns.map((column) =>
        cliTruncate(column, options.maxWidth, {
            position: options.position ?? "end",
            truncationCharacter: options.truncationChar ?? "…",
        }),
    );
