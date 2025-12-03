// Copyright by https://github.com/swansontec

import { INTERNAL_STRIP_JSON_REGEX } from "../constants";

/**
 * Strips comments from a JSON string.
 * Handles both single-line (//) and multi-line (/* ... *&amp;#47;) comments.
 * @param jsonString The JSON string possibly containing comments.
 * @param [options] Optional configuration for stripping comments.
 * @param [options.whitespace] If `true` (default), comments are replaced with whitespace to preserve line numbers and character positions. If `false`, comments are removed entirely.
 * @returns The JSON string with comments stripped.
 * @example
 * ```javascript
 * import { stripJsonComments } from "@visulima/fs"; // Assuming this util is exported
 *
 * const jsonWithComments = `{
 *   // This is a single-line comment
 *   "name": "John Doe",
 *   "age": 30, /* This is a
 *   multi-line comment *&#47;
 *   "city": "New York"
 * }`;
 *
 * const stripped = stripJsonComments(jsonWithComments);
 * console.log(stripped);
 * // Output (with whitespace=true):
 * // {
 * //
 * //   "name": "John Doe",
 * //   "age": 30, /*
 * //
 * //   "city": "New York"
 * // }
 *
 * const strippedWithoutWhitespace = stripJsonComments(jsonWithComments, { whitespace: false });
 * console.log(strippedWithoutWhitespace);
 * // Output (with whitespace=false):
 * // {
 * //   "name": "John Doe",
 * //   "age": 30,
 * //   "city": "New York"
 * // }
 * ```
 */
const stripJsonComments: (jsonString: string, options?: { whitespace?: boolean }) => string = (jsonString: string, { whitespace = true } = {}): string =>
    // This regular expression translates to:
    //
    //   /quoted-string|line-comment|block-comment/g
    //
    // This means that comment characters inside of strings will match
    // as strings, not comments, so we can just skip the whole string
    // in the replacer function.
    jsonString.replace(INTERNAL_STRIP_JSON_REGEX, (match) => {
        // Skip strings & broken block comments:
        if (match.startsWith("\"") || (match[1] === "*" && !match.endsWith("*/"))) {
            return match;
        }

        // Replace comments with whitespace (or not):
        return whitespace ? match.replaceAll(/\S/g, " ") : "";
    });

export default stripJsonComments;
