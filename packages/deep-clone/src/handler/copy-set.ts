import type { State } from "../types";
import copyOwnProperties from "../utils/copy-own-properties";

export const copySetLoose = <Value extends Set<unknown>>(set: Value, state: State): Value => {
    const clone = new Set() as Value;

    // set in the cache immediately to be able to reuse the object recursively
    state.cache.set(set, clone);

    set.forEach((value) => {
        clone.add(state.clone(value, state));
    });

    return clone;
};

/**
 * Deeply copy the values of the original, as well as any custom properties.
 */
export const copySetStrict = <Value extends Set<unknown>>(set: Value, state: State): Value => copyOwnProperties(set, copySetLoose<Value>(set, state), state);
