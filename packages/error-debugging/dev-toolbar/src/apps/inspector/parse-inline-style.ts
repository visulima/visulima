/**
 * Parse an inline `style` attribute into a camelCased property map.
 *
 * Declarations without a colon, an empty name or an empty value are skipped,
 * so a trailing semicolon or a stray fragment cannot produce a blank entry.
 */
export const parseInlineStyle = (css: string): Record<string, string> => {
    const result: Record<string, string> = {};

    for (const pair of css.split(";")) {
        const colonIndex = pair.indexOf(":");

        if (colonIndex === -1) {
            continue;
        }

        const key = pair.slice(0, colonIndex).trim();
        const value = pair.slice(colonIndex + 1).trim();

        if (key && value) {
            const camelKey = key.replaceAll(/-([a-z])/g, (_, character) => (character as string).toUpperCase());

            result[camelKey] = value;
        }
    }

    return result;
};
