/**
 * Get an empty version of the object with the same prototype it has.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getCleanClone = (input: unknown): any => {
    if (!input) {
        return Object.create(null);
    }

    const Constructor = input.constructor;

    if (Constructor === Object) {
        return input === Object.prototype ? {} : Object.create(Object.getPrototypeOf(input));
    }

    if (Function.prototype.toString.call(Constructor).includes("[native code]")) {
        try {
            // @ts-expect-error - We don't know the type of the object, can be a function
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            return new Constructor();
        } catch {
            /* empty */
        }
    }

    return Object.create(Object.getPrototypeOf(input));
};

export default getCleanClone;
