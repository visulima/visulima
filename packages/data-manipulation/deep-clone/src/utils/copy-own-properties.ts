import type { State } from "../types";

const getStrictProperties = (object: unknown): (string | symbol)[] => [
    ...(Object.getOwnPropertyNames(object) as (string | symbol)[]),
    ...Object.getOwnPropertySymbols(object),
];

/**
 * Strict copy all properties contained on the object.
 */
const copyOwnProperties = <Value>(value: Value, clone: Value, state: State): Value => {
    const properties = getStrictProperties(value);

    // eslint-disable-next-line no-loops/no-loops
    for (const property of properties) {
        if (property === "callee" || property === "caller") {
            continue;
        }

        const descriptor = Object.getOwnPropertyDescriptor(value, property);

        if (!descriptor) {
            // In extra edge cases where the property descriptor cannot be retrived, fall back to
            // the loose assignment.

            // eslint-disable-next-line no-param-reassign,@typescript-eslint/no-explicit-any
            (clone as any)[property] = state.clone((value as any)[property], state);

            continue;
        }

        // Only clone the value if actually a value, not a getter / setter.
        if (!descriptor.get && !descriptor.set) {
            descriptor.value = state.clone(descriptor.value, state);
        }

        try {
            Object.defineProperty(clone, property, descriptor);
        } catch {
            // Tee above can fail on node in edge cases, so fall back to the loose assignment.
            // eslint-disable-next-line no-param-reassign,@typescript-eslint/no-explicit-any
            (clone as any)[property] = descriptor.value;
        }
    }

    return clone;
};

export default copyOwnProperties;
