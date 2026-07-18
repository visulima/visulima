/**
 * Copy the enumerable symbol-keyed own properties from `source` onto `target`.
 *
 * String paths can never target symbol keys, so they are always preserved
 * verbatim (matching lodash's `omit`).
 * @param source The object to read symbol properties from.
 * @param target The object to copy symbol properties onto.
 */
const copySymbols = (source: object, target: Record<PropertyKey, unknown>): void => {
    for (const symbol of Object.getOwnPropertySymbols(source)) {
        const descriptor = Object.getOwnPropertyDescriptor(source, symbol);

        if (descriptor?.enumerable) {
            // eslint-disable-next-line no-param-reassign
            target[symbol] = (source as Record<PropertyKey, unknown>)[symbol];
        }
    }
};

export default copySymbols;
