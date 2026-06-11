// Memoize the "is this a native-code constructor" verdict per constructor so that
// cloning many instances of the same class only stringifies the constructor once
// instead of on every single clone.
// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
const nativeConstructorCache = new WeakMap<Function, boolean>();

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
const isNativeConstructor = (Constructor: Function): boolean => {
    const cached = nativeConstructorCache.get(Constructor);

    if (cached !== undefined) {
        return cached;
    }

    const native = Function.prototype.toString.call(Constructor).includes("[native code]");

    nativeConstructorCache.set(Constructor, native);

    return native;
};

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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        return input === Object.prototype ? {} : Object.create(Object.getPrototypeOf(input));
    }

    if (isNativeConstructor(Constructor)) {
        try {
            // @ts-expect-error - We don't know the type of the object, can be a function
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            return new Constructor();
        } catch {
            /* empty */
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return Object.create(Object.getPrototypeOf(input));
};

export default getCleanClone;
