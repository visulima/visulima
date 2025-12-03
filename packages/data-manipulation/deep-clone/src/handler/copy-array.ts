import type { State } from "../types";
import copyOwnProperties from "../utils/copy-own-properties";

export const copyArrayLoose = <Value extends unknown[]>(array: Value, state: State): Value => {
    const clone: Value = [] as unknown as Value;

    // set in the cache immediately to be able to reuse the object recursively
    state.cache.set(array, clone);

    // eslint-disable-next-line no-loops/no-loops,no-plusplus
    for (let index = 0, { length } = array; index < length; ++index) {
        clone[index] = state.clone(array[index], state);
    }

    return clone;
};

/**
 * Deeply copy the indexed values in the array, as well as any custom properties.
 */
export const copyArrayStrict = <Value extends unknown[]>(array: Value, state: State): Value => {
    const clone: Value = [] as unknown as Value;

    // set in the cache immediately to be able to reuse the object recursively
    state.cache.set(array, clone);

    return copyOwnProperties(array, clone, state);
};
