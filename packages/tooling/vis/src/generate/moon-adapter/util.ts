/**
 * Split on `,` at the top level — outside quotes and parentheses.
 *
 * Used by both `parseFilterCall` in `filename-interp.ts` and
 * `tera-subset.ts` so `path_join("a,b", "c")` and
 * `[var | path_join("a,b", "c")]` produce the same two args.
 */
export const splitCommaOutsideQuotes = (input: string): string[] => {
    const parts: string[] = [];
    let depth = 0;
    let start = 0;
    let inQuote: '"' | "'" | undefined;
    let index = -1;

    for (const character of input) {
        index += 1;

        if (inQuote) {
            if (character === inQuote) {
                inQuote = undefined;
            }

            continue;
        }

        if (character === '"' || character === "'") {
            inQuote = character;
            continue;
        }

        if (character === "(") {
            depth += 1;
        } else if (character === ")") {
            depth -= 1;
        } else if (character === "," && depth === 0) {
            parts.push(input.slice(start, index));
            start = index + 1;
        }
    }

    parts.push(input.slice(start));

    return parts;
};

/**
 * Strip matching single- or double-quote wrappers. Returns `undefined`
 * when the input isn't a quoted literal so callers can fall through to
 * variable lookup or number parsing.
 */
export const stripQuotes = (input: string): string | undefined => {
    if ((input.startsWith("\"") && input.endsWith("\"")) || (input.startsWith("'") && input.endsWith("'"))) {
        return input.slice(1, -1);
    }

    return undefined;
};
