import type { State } from "../types";
import copyOwnProperties from "../utils/copy-own-properties";
import getCleanClone from "../utils/get-clean-clone";

declare const emptyObjectSymbol: unique symbol;

const copyObjectIsFunctions = <Value extends Record<PropertyKey, unknown>>(object: Value, clone: Value): void => {
    if (!Object.isExtensible(object)) {
        Object.preventExtensions(clone);
    }

    if (Object.isSealed(object)) {
        Object.seal(clone);
    }

    if (Object.isFrozen(object)) {
        Object.freeze(clone);
    }
};

export const copyObjectLoose = <Value extends Record<PropertyKey, unknown>>(object: Value, state: State): Value => {
    const clone = getCleanClone(object) as { [emptyObjectSymbol]?: never };

    // set in the cache immediately to be able to reuse the object recursively
    state.cache.set(object, clone);

    // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
    for (const key in object) {
        if (Object.hasOwnProperty.call(object, key)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (clone as any)[key] = state.clone(object[key], state);
        }
    }

    const symbols = Object.getOwnPropertySymbols(object);

    // eslint-disable-next-line no-loops/no-loops,no-plusplus
    for (let index = 0, symbol, { length } = symbols; index < length; ++index) {
        symbol = symbols[index] as symbol;

        if (Object.prototype.propertyIsEnumerable.call(object, symbol)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (clone as any)[symbol] = state.clone((object as any)[symbol], state);
        }
    }

    copyObjectIsFunctions(object, clone as Value);

    return clone as Value;
};

/**
 * Deeply copy the properties (keys and symbols) and values of the original, as well
 * as any hidden or non-enumerable properties.
 */
export const copyObjectStrict = <Value extends Record<PropertyKey, unknown>>(object: Value, state: State): Value => {
    const clone = getCleanClone(object) as { [emptyObjectSymbol]?: never };

    // set in the cache immediately to be able to reuse the object recursively
    state.cache.set(object, clone);

    const clonedObject = copyOwnProperties<Value>(object, clone as Value, state);

    const objectPrototype: object | null = Object.getPrototypeOf(object);

    if (Object.getPrototypeOf(clonedObject) !== objectPrototype) {
        Object.setPrototypeOf(clonedObject, objectPrototype);
    }

    copyObjectIsFunctions(object, clone as Value);

    return clonedObject as Value;
};
