import type { State } from "../types";

const getStrictProperties = (object: unknown): (string | symbol)[] => [...(Object.getOwnPropertyNames(object) as (string | symbol)[]), ...Object.getOwnPropertySymbols(object)]

const copyOwnProperties = <Value>(value: Value, clone: Value, state: State): Value => {
    const properties = getStrictProperties(value);

    // eslint-disable-next-line no-loops/no-loops
    for (let index = 0, { length } = properties, property, descriptor; index < length; ++index) {
        property = properties[index];

        if (property === "callee" || property === "caller") {
            // eslint-disable-next-line no-continue
            continue;
        }

        descriptor = Object.getOwnPropertyDescriptor(value, property);

        if (!descriptor) {
            // In extra edge cases where the property descriptor cannot be retrived, fall back to
            // the loose assignment.
            // eslint-disable-next-line no-param-reassign
            clone[property] = state.clone(value[property], state);
            // eslint-disable-next-line no-continue
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
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,no-param-reassign
            clone[property] = descriptor.value;
        }
    }

    return clone;
}

export default copyOwnProperties;
