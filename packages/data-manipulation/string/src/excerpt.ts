// eslint-disable-next-line import/no-extraneous-dependencies
import { stripHtml } from "string-strip-html";

import type { TruncateOptions } from "./truncate";
import { truncate } from "./truncate";

/**
 * Truncates a sentence to be under the given character limit and strips HTML tags from it.
 * This function first removes all HTML tags and decodes HTML entities, then truncates
 * the resulting plain text to the specified character limit using the truncate function.
 * @example
 * ```typescript
 * excerpt('<p>Hello <strong>world</strong>!</p>', 10);
 * // => 'Hello worl…'
 *
 * excerpt('<div>This is a <em>long</em> text</div>', 20, { ellipsis: '...' });
 * // => 'This is a long text'
 * ```
 * @param html The HTML string to truncate
 * @param limit Maximum character limit for the truncated string
 * @param options Configuration options for truncation
 * @returns The truncated plain text string with HTML tags removed
 */
export const excerpt = (html: string, limit: number, options: ExcerptOptions = {}): string => {
    // Input validation
    if (typeof html !== "string") {
        throw new TypeError(`Expected \`html\` to be a string, got ${typeof html}`);
    }

    if (typeof limit !== "number") {
        throw new TypeError(`Expected \`limit\` to be a number, got ${typeof limit}`);
    }

    // Fast path for empty strings or tiny limits
    if (html === "" || limit <= 0) {
        return "";
    }

    // Strip HTML tags using string-strip-html library
    const plainText = stripHtml(html).result;

    // If the plain text is already shorter than the limit, return it
    if (plainText.length <= limit) {
        return plainText;
    }

    // Use truncate with position 'end' (default) since excerpt should truncate from the end
    return truncate(plainText, limit, {
        ...options,
        position: "end",
    });
};

/**
 * Options for the excerpt function
 */
export type ExcerptOptions = Omit<TruncateOptions, "position">;
