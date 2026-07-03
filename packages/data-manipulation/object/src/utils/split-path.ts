/**
 * Split a dot-notation path into its individual segments while honouring
 * backslash-escaped dots (`\.`) and escaped backslashes (`\\`).
 *
 * This mirrors the escaping dialect used by `dot-prop`'s `escapePath`, so a key
 * literally named `"a.b"` can be targeted as `"a\\.b"` and is treated as a
 * single segment instead of two.
 * @param path The dot-notation path to split.
 * @returns The ordered list of unescaped path segments.
 * @example
 * ```js
 * splitPath("a.b.c");      // ["a", "b", "c"]
 * splitPath("a\\.b.c");    // ["a.b", "c"]
 * ```
 */
const splitPath = (path: string): string[] => {
    const segments: string[] = [];
    let current = "";
    let escaped = false;

    for (const character of path) {
        if (escaped) {
            // Only `\.` and `\\` are meaningful escapes; for anything else keep
            // the backslash verbatim so the operation stays lossless.
            current += character === "." || character === "\\" ? character : `\\${character}`;
            escaped = false;

            continue;
        }

        if (character === "\\") {
            escaped = true;

            continue;
        }

        if (character === ".") {
            segments.push(current);
            current = "";

            continue;
        }

        current += character;
    }

    // A trailing lone backslash has no following character to escape; preserve it.
    if (escaped) {
        current += "\\";
    }

    segments.push(current);

    return segments;
};

export default splitPath;
