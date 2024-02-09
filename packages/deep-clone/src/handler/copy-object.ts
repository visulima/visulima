import type { UnknownRecord } from "type-fest";

import type { State } from "../types";
import getCleanClone from "../utils/get-clean-clone";
import copyOwnProperties from "../utils/copy-own-properties";

export const copyObjectLoose = <Value extends Record<string, any>>(object: Value, state: State): Value => {
    const clone = getCleanClone(object);

    // set in the cache immediately to be able to reuse the object recursively
    state.cache.set(object, clone);

    for (const key in object) {
        if (Object.hasOwnProperty.call(object, key)) {
            clone[key] = state.clone(object[key], state);
        }
    }

    const symbols = Object.getOwnPropertySymbols(object);

    for (let index = 0, { length } = symbols, symbol; index < length; ++index) {
        symbol = symbols[index];

        if (Object.prototype.propertyIsEnumerable.call(object, symbol)) {
            clone[symbol] = state.clone((object as any)[symbol], state);
        }
    }

    if (!Object.isExtensible(object)) {
        Object.preventExtensions(clone);
    }

    if (Object.isSealed(object)) {
        Object.seal(clone);
    }

    if (Object.isFrozen(object)) {
        Object.freeze(clone);
    }

    return clone;
};

/**
 * Deeply copy the properties (keys and symbols) and values of the original, as well
 * as any hidden or non-enumerable properties.
 */
export const copyObjectStrict = <Value extends UnknownRecord>(object: Value, state: State): Value => {
    const clone = getCleanClone(object);

    // set in the cache immediately to be able to reuse the object recursively
    state.cache.set(object, clone);

    const clonedObject = copyOwnProperties<Value>(object, clone as Value, state);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const objectPrototype: object | null = Object.getPrototypeOf(object);

    if (Object.getPrototypeOf(clonedObject) !== objectPrototype) {
        Object.setPrototypeOf(clonedObject, objectPrototype);
    }

    if (!Object.isExtensible(object)) {
        Object.preventExtensions(clonedObject);
    }

    if (Object.isSealed(object)) {
        Object.seal(clonedObject);
    }

    if (Object.isFrozen(object)) {
        Object.freeze(clonedObject);
    }

    return clonedObject;
};
