/* eslint-disable @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-assignment */
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

    // eslint-disable-next-line no-restricted-syntax
    for (const key in object) {
        if (Object.hasOwnProperty.call(object, key)) {
            // Guard against prototype pollution: assigning to `__proto__` via the
            // index setter would invoke the `Object.prototype.__proto__` accessor and
            // replace the clone's prototype with attacker-controlled data (e.g. when
            // cloning the result of `JSON.parse('{"__proto__":{...}}')`, which has an
            // own enumerable `__proto__` key). Define it as a plain own data property
            // instead so the clone faithfully mirrors the source without re-parenting.
            if (key === "__proto__") {
                Object.defineProperty(clone, key, {
                    configurable: true,
                    enumerable: true,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    value: state.clone((object as any)[key], state),
                    writable: true,
                });

                continue;
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (clone as any)[key] = state.clone(object[key], state);
        }
    }

    const symbols = Object.getOwnPropertySymbols(object);

    // eslint-disable-next-line no-plusplus
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

    const clonedObject = copyOwnProperties(object, clone as Value, state);

    const objectPrototype: object | null = Object.getPrototypeOf(object);

    if (Object.getPrototypeOf(clonedObject) !== objectPrototype) {
        Object.setPrototypeOf(clonedObject, objectPrototype);
    }

    copyObjectIsFunctions(object, clone as Value);

    return clonedObject;
};
